from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional
from uuid import UUID
import shutil, os, uuid as uuid_lib

from app.core.database import get_db
from datetime import date as date_type
from app.models.accord import Accord, AccordFichier
from app.schemas.accord import (
    AccordCreate, AccordUpdate,
    AccordResponse, AccordListResponse
)


def get_statut_calcule(accord) -> str:
    """Passe automatiquement en expiré si date_expiration < aujourd'hui"""
    if accord.date_expiration and accord.date_expiration < date_type.today():
        return "expire"
    return accord.statut or "en_vigueur"

def accord_to_response(a) -> AccordResponse:
    r = AccordResponse.model_validate(a)
    r.statut = get_statut_calcule(a)
    return r

router = APIRouter(prefix="/accords", tags=["Accords & Traités"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/accords")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── GET /accords ──
@router.get("", response_model=AccordListResponse)
async def liste_accords(
    page:            int           = Query(1, ge=1),
    per_page:        int           = Query(12, ge=1, le=100),
    statut:          Optional[str] = None,
    type_accord:     Optional[str] = None,
    secteur_activite:Optional[str] = None,
    pays_signataires:Optional[str] = None,
    search:          Optional[str] = None,
    db:              AsyncSession  = Depends(get_db),
):
    filters = [
        Accord.est_publie == True,
    ]
    if statut:           filters.append(Accord.statut == statut)
    if type_accord:      filters.append(Accord.type_accord.ilike(f"%{type_accord}%"))
    if secteur_activite: filters.append(Accord.secteur_activite.ilike(f"%{secteur_activite}%"))
    if pays_signataires: filters.append(Accord.pays_signataires.ilike(f"%{pays_signataires}%"))
    if search:
        filters.append(or_(
            Accord.titre.ilike(f"%{search}%"),
            Accord.reference.ilike(f"%{search}%"),
            Accord.commentaires.ilike(f"%{search}%"),
            Accord.pays_signataires.ilike(f"%{search}%"),
            Accord.type_accord.ilike(f"%{search}%"),
        ))

    total_q = await db.execute(
        select(func.count()).select_from(Accord).where(and_(*filters))
    )
    total = total_q.scalar()

    result = await db.execute(
        select(Accord)
        .where(and_(*filters))
        .order_by(Accord.date_signature.desc().nullslast())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    accords = result.scalars().all()

    return AccordListResponse(
        total=total, page=page, per_page=per_page,
        data=[accord_to_response(a) for a in accords]
    )


# ── GET /accords/:id ──
@router.get("/{accord_id}", response_model=AccordResponse)
async def detail_accord(
    accord_id: UUID,
    db:        AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Accord).where(Accord.id == accord_id)
    )
    accord = result.scalar_one_or_none()
    if not accord:
        raise HTTPException(status_code=404, detail="Accord introuvable")
    return accord_to_response(accord)


# ── POST /accords ── avec upload PDF optionnel
@router.post("", response_model=AccordResponse, status_code=201)
async def creer_accord(
    titre:                  str            = Form(...),
    reference:              Optional[str]  = Form(None),
    type_accord:            Optional[str]  = Form(None),
    pays_signataires:       Optional[str]  = Form(None),
    organisation_partenaire:Optional[str]  = Form(None),
    date_signature:         Optional[str]  = Form(None),
    date_ratification:      Optional[str]  = Form(None),
    date_entree_vigueur:    Optional[str]  = Form(None),
    date_expiration:        Optional[str]  = Form(None),
    secteur_activite:       Optional[str]  = Form(None),
    branche_activite:       Optional[str]  = Form(None),
    commentaires:           Optional[str]  = Form(None),
    domaines_couverts:      Optional[str]  = Form(None),
    avantages_principaux:   Optional[str]  = Form(None),
    statut:                 str            = Form("en_vigueur"),
    lien_texte_officiel:    Optional[str]  = Form(None),
    est_publie:             bool           = Form(True),
    note_interne:           Optional[str]  = Form(None),
    created_by:             Optional[str]  = Form(None),
    fichier:                Optional[UploadFile] = File(None),
    db:                     AsyncSession   = Depends(get_db),
):
    from datetime import date as date_type

    def parse_date(s):
        if not s: return None
        try: return date_type.fromisoformat(s)
        except: return None

    fichier_nom, fichier_path = None, None
    if fichier and fichier.filename:
        ext = os.path.splitext(fichier.filename)[1].lower()
        if ext != ".pdf":
            raise HTTPException(status_code=422, detail="Seuls les fichiers PDF sont acceptés")
        unique_name = f"{uuid_lib.uuid4()}{ext}"
        dest = os.path.join(UPLOAD_DIR, unique_name)
        with open(dest, "wb") as f:
            shutil.copyfileobj(fichier.file, f)
        fichier_nom  = fichier.filename
        fichier_path = dest

    accord = Accord(
        titre=titre, reference=reference, type_accord=type_accord,
        pays_signataires=pays_signataires,
        organisation_partenaire=organisation_partenaire,
        date_signature=parse_date(date_signature),
        date_ratification=parse_date(date_ratification),
        date_entree_vigueur=parse_date(date_entree_vigueur),
        date_expiration=parse_date(date_expiration),
        secteur_activite=secteur_activite, branche_activite=branche_activite,
        commentaires=commentaires, domaines_couverts=domaines_couverts,
        avantages_principaux=avantages_principaux,
        statut=statut, lien_texte_officiel=lien_texte_officiel,
        est_publie=est_publie, note_interne=note_interne,
        created_by=created_by,
        fichier_nom=fichier_nom, fichier_path=fichier_path,
    )
    db.add(accord)
    await db.flush()
    await db.refresh(accord)
    return accord_to_response(accord)


# ── GET /accords/:id/fichier — Télécharger le PDF ──
@router.get("/{accord_id}/fichier")
async def telecharger_fichier(
    accord_id: UUID,
    db:        AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Accord).where(Accord.id == accord_id)
    )
    accord = result.scalar_one_or_none()
    if not accord or not accord.fichier_path:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    if not os.path.exists(accord.fichier_path):
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    return FileResponse(
        accord.fichier_path,
        media_type="application/pdf",
        filename=accord.fichier_nom or "accord.pdf",
    )


# ── PATCH /accords/:id ──
@router.patch("/{accord_id}", response_model=AccordResponse)
async def modifier_accord(
    accord_id: UUID,
    payload:   AccordUpdate,
    db:        AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Accord).where(Accord.id == accord_id)
    )
    accord = result.scalar_one_or_none()
    if not accord:
        raise HTTPException(status_code=404, detail="Accord introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(accord, field, value)
    await db.flush()
    await db.refresh(accord)
    return accord_to_response(accord)


# ── DELETE /accords/:id ──
@router.delete("/{accord_id}", status_code=204)
async def supprimer_accord(
    accord_id: UUID,
    db:        AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Accord).where(Accord.id == accord_id)
    )
    accord = result.scalar_one_or_none()
    if not accord:
        raise HTTPException(status_code=404, detail="Accord introuvable")
    await db.delete(accord)
    await db.flush()


# ── Fichiers PDF ──────────────────────────────────────────────────────────────

@router.get("/{accord_id}/fichiers")
async def liste_fichiers(accord_id: UUID, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(
        select(AccordFichier)
        .where(AccordFichier.accord_id == accord_id)
        .order_by(AccordFichier.created_at.asc())
    )
    fichiers = result.scalars().all()
    return [{"id": str(f.id), "titre": f.titre, "nom_fichier": f.nom_fichier, "chemin": f.chemin, "created_at": f.created_at} for f in fichiers]


@router.post("/{accord_id}/fichiers", status_code=201)
async def ajouter_fichier(
    accord_id: UUID,
    titre:    str  = Form(...),
    fichier:  UploadFile = File(...),
    db:       AsyncSession = Depends(get_db),
):
    import os, shutil
    result = await db.execute(select(Accord).where(Accord.id == accord_id))
    accord = result.scalar_one_or_none()
    if not accord:
        raise HTTPException(status_code=404, detail="Accord introuvable")

    UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/accords")
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    import uuid as uuid_mod
    ext = os.path.splitext(fichier.filename)[1]
    nom_fichier = f"{uuid_mod.uuid4()}{ext}"
    chemin = os.path.join(UPLOAD_DIR, nom_fichier)

    with open(chemin, "wb") as f:
        shutil.copyfileobj(fichier.file, f)

    af = AccordFichier(
        accord_id=accord_id,
        titre=titre,
        nom_fichier=fichier.filename,
        chemin=f"/uploads/accords/{nom_fichier}",
    )
    db.add(af)
    await db.flush()
    await db.refresh(af)
    return {"id": str(af.id), "titre": af.titre, "nom_fichier": af.nom_fichier, "chemin": af.chemin}


@router.delete("/{accord_id}/fichiers/{fichier_id}", status_code=204)
async def supprimer_fichier(
    accord_id:  UUID,
    fichier_id: UUID,
    db:         AsyncSession = Depends(get_db),
):
    import os
    from sqlalchemy import select
    result = await db.execute(
        select(AccordFichier).where(
            AccordFichier.id == fichier_id,
            AccordFichier.accord_id == accord_id,
        )
    )
    af = result.scalar_one_or_none()
    if not af:
        raise HTTPException(status_code=404, detail="Fichier introuvable")

    # Supprimer le fichier physique
    chemin_physique = os.path.join(os.path.dirname(__file__), "../../../", af.chemin.lstrip("/"))
    if os.path.exists(chemin_physique):
        os.remove(chemin_physique)

    await db.delete(af)
    await db.flush()
