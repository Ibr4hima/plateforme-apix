from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional, List
import shutil, os, uuid as uuid_lib
import json

from app.core.database import get_db
from datetime import date as date_type
from app.models.accord import Accord, AccordFichier
from app.schemas.accord import (
    AccordCreate, AccordUpdate,
    AccordResponse, AccordListResponse
)

router = APIRouter(prefix="/accords", tags=["Accords & Traités"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/accords")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def parse_date(s):
    if not s: return None
    try: return date_type.fromisoformat(s)
    except: return None


def get_statut_calcule(accord) -> str:
    if accord.date_expiration and accord.date_expiration < date_type.today():
        return "expire"
    return accord.statut or "en_vigueur"


def accord_to_response(a) -> AccordResponse:
    r = AccordResponse.model_validate(a)
    r.statut = get_statut_calcule(a)
    return r


# ── GET /accords ──────────────────────────────────────────────────────────────
@router.get("", response_model=AccordListResponse)
async def liste_accords(
    page:                int           = Query(1, ge=1),
    per_page:            int           = Query(12, ge=1, le=100),
    statut:              Optional[str] = None,
    reference:           Optional[str] = None,
    parties_signataires: List[str]     = Query(default=[]),
    admin:               bool          = Query(False),
    db:                  AsyncSession  = Depends(get_db),
):
    filters = [] if admin else [Accord.est_publie == True, Accord.is_deleted == False]

    if statut:
        filters.append(Accord.statut == statut)
    if reference:
        filters.append(Accord.reference.ilike(f"%{reference}%"))
    if parties_signataires:
        filters.append(or_(*[Accord.parties_signataires.ilike(f"%{p}%") for p in parties_signataires]))

    total = (await db.execute(select(func.count()).select_from(Accord).where(and_(*filters)))).scalar()
    result = await db.execute(
        select(Accord).where(and_(*filters))
        .order_by(Accord.date_signature.desc().nullslast())
        .offset((page - 1) * per_page).limit(per_page)
    )
    return AccordListResponse(
        total=total, page=page, per_page=per_page,
        data=[accord_to_response(a) for a in result.scalars().all()]
    )


# ── GET /accords/parties-distinctes ──────────────────────────────────────────
@router.get("/parties-distinctes")
async def parties_distinctes(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text as sa_text
    # Récupérer tous les IDs de pays utilisés
    result = await db.execute(
        select(Accord.parties_pays_ids).where(Accord.est_publie == True)
    )
    all_ids: set = set()
    for row in result.scalars().all():
        if row: all_ids.update(row)
    # Récupérer les noms depuis ref_pays
    pays_list = []
    if all_ids:
        rows = await db.execute(
            sa_text("SELECT id, nom_fr, code_iso2 FROM ref_pays WHERE id = ANY(:ids) AND actif = TRUE ORDER BY nom_fr"),
            {"ids": list(all_ids)}
        )
        pays_list = [{"id": r.id, "nom": r.nom_fr, "code_iso2": r.code_iso2} for r in rows]
    # Organisations libres depuis parties_signataires
    org_result = await db.execute(
        select(Accord.parties_signataires).where(Accord.est_publie == True, Accord.parties_signataires != None)
    )
    org_set: set = set()
    for row in org_result.scalars().all():
        if row:
            for p in [x.strip() for x in row.split(",") if x.strip()]:
                org_set.add(p)
    return {"pays": pays_list, "organisations": sorted(list(org_set))}


# ── GET /accords/:id ──────────────────────────────────────────────────────────
@router.get("/{accord_id}", response_model=AccordResponse)
async def detail_accord(accord_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Accord).where(Accord.id == accord_id))
    accord = result.scalar_one_or_none()
    if not accord: raise HTTPException(status_code=404, detail="Accord introuvable")
    return accord_to_response(accord)


# ── POST /accords ─────────────────────────────────────────────────────────────
@router.post("", response_model=AccordResponse, status_code=201)
async def creer_accord(
    titre:               str            = Form(...),
    reference:           Optional[str]  = Form(None),
    parties_signataires: Optional[str]  = Form(None),  # organisations libres
    parties_pays_ids:    Optional[str]  = Form(None),  # JSON array d'IDs ref_pays
    date_signature:      Optional[str]  = Form(None),
    date_entree_vigueur: Optional[str]  = Form(None),
    date_expiration:     Optional[str]  = Form(None),
    secteur_ids:         Optional[str]  = Form(None),  # JSON array
    branche_ids:         Optional[str]  = Form(None),
    activite_ids:        Optional[str]  = Form(None),
    commentaires:        Optional[str]  = Form(None),
    statut:              str            = Form("en_vigueur"),
    est_publie:          bool           = Form(True),
    created_by:          Optional[str]  = Form(None),
    fichier:             Optional[UploadFile] = File(None),
    db:                  AsyncSession   = Depends(get_db),
):
    fichier_nom, fichier_path = None, None
    if fichier and fichier.filename:
        if not fichier.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=422, detail="Seuls les fichiers PDF sont acceptés")
        unique_name = f"{uuid_lib.uuid4()}.pdf"
        dest = os.path.join(UPLOAD_DIR, unique_name)
        with open(dest, "wb") as f:
            shutil.copyfileobj(fichier.file, f)
        fichier_nom, fichier_path = fichier.filename, dest

    def parse_ids(s): return json.loads(s) if s else []

    accord = Accord(
        titre=titre, reference=reference,
        parties_signataires=parties_signataires,
        parties_pays_ids=parse_ids(parties_pays_ids),
        date_signature=parse_date(date_signature),
        date_entree_vigueur=parse_date(date_entree_vigueur),
        date_expiration=parse_date(date_expiration),
        secteur_ids=parse_ids(secteur_ids),
        branche_ids=parse_ids(branche_ids),
        activite_ids=parse_ids(activite_ids),
        commentaires=commentaires, statut=statut,
        est_publie=est_publie, created_by=created_by,
        fichier_nom=fichier_nom, fichier_path=fichier_path,
    )
    db.add(accord)
    await db.flush()
    await db.refresh(accord)
    return accord_to_response(accord)


# ── PATCH /accords/:id ────────────────────────────────────────────────────────
@router.patch("/{accord_id}", response_model=AccordResponse)
async def modifier_accord(accord_id: int, payload: AccordUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Accord).where(Accord.id == accord_id))
    accord = result.scalar_one_or_none()
    if not accord: raise HTTPException(status_code=404, detail="Accord introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(accord, field, value)
    await db.flush()
    await db.refresh(accord)
    return accord_to_response(accord)


# ── DELETE /accords/:id ───────────────────────────────────────────────────────
@router.delete("/{accord_id}", status_code=204)
async def supprimer_accord(accord_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Accord).where(Accord.id == accord_id))
    accord = result.scalar_one_or_none()
    if not accord: raise HTTPException(status_code=404, detail="Accord introuvable")
    await db.delete(accord)
    await db.flush()


# ── Fichiers PDF ──────────────────────────────────────────────────────────────

@router.get("/{accord_id}/fichiers")
async def liste_fichiers(accord_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AccordFichier).where(AccordFichier.accord_id == accord_id)
        .order_by(AccordFichier.created_at.asc())
    )
    return [{"id": f.id, "titre": f.titre, "fichier_nom": f.nom_fichier, "chemin": f.chemin} for f in result.scalars().all()]


@router.post("/{accord_id}/fichiers", status_code=201)
async def ajouter_fichier(
    accord_id: int,
    titre:     str        = Form(...),
    fichier:   UploadFile = File(...),
    db:        AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Accord).where(Accord.id == accord_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Accord introuvable")
    ext = os.path.splitext(fichier.filename)[1]
    nom_fichier = f"{uuid_lib.uuid4()}{ext}"
    chemin = os.path.join(UPLOAD_DIR, nom_fichier)
    with open(chemin, "wb") as f:
        shutil.copyfileobj(fichier.file, f)
    af = AccordFichier(accord_id=accord_id, titre=titre, nom_fichier=fichier.filename, chemin=f"/uploads/accords/{nom_fichier}")
    db.add(af)
    await db.flush()
    await db.refresh(af)
    return {"id": af.id, "titre": af.titre, "fichier_nom": af.nom_fichier, "chemin": af.chemin}


@router.get("/{accord_id}/fichiers/{fichier_id}/download")
async def telecharger_fichier(accord_id: int, fichier_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AccordFichier).where(AccordFichier.id == fichier_id, AccordFichier.accord_id == accord_id)
    )
    af = result.scalar_one_or_none()
    if not af: raise HTTPException(status_code=404, detail="Fichier introuvable")
    chemin_physique = os.path.join(os.path.dirname(__file__), "../../../", af.chemin.lstrip("/"))
    if not os.path.exists(chemin_physique): raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    return FileResponse(chemin_physique, media_type="application/pdf", filename=af.nom_fichier or "accord.pdf")


@router.delete("/{accord_id}/fichiers/{fichier_id}", status_code=204)
async def supprimer_fichier(accord_id: int, fichier_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AccordFichier).where(AccordFichier.id == fichier_id, AccordFichier.accord_id == accord_id)
    )
    af = result.scalar_one_or_none()
    if not af: raise HTTPException(status_code=404, detail="Fichier introuvable")
    chemin_physique = os.path.join(os.path.dirname(__file__), "../../../", af.chemin.lstrip("/"))
    if os.path.exists(chemin_physique): os.remove(chemin_physique)
    await db.delete(af)
    await db.flush()
