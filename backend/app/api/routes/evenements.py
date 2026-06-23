from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, extract
from typing import Optional, List
from datetime import date as date_type

from app.core.database import get_db
from app.core.auth import require_admin
from app.models.evenement import Evenement
from app.models.shared import RefPays as RefPaysEvenement
from app.schemas.evenement import (
    EvenementCreate, EvenementUpdate,
    EvenementResponse, EvenementListResponse
)

router = APIRouter(prefix="/evenements", tags=["Événements"])


async def enrich_evenement(e: Evenement, db: AsyncSession) -> EvenementResponse:
    from sqlalchemy import text
    resp = EvenementResponse.model_validate(e)
    # Noms plats (compatibilité)
    if e.secteur_ids:
        r = await db.execute(text("SELECT nom FROM ref_secteurs WHERE id = ANY(:ids)"), {"ids": e.secteur_ids})
        resp.secteur_noms = [row[0] for row in r.fetchall()]
    if e.branche_ids:
        r = await db.execute(text("SELECT nom FROM ref_branches WHERE id = ANY(:ids)"), {"ids": e.branche_ids})
        resp.branche_noms = [row[0] for row in r.fetchall()]
    if e.activite_ids:
        r = await db.execute(text("SELECT nom FROM ref_activites WHERE id = ANY(:ids)"), {"ids": e.activite_ids})
        resp.activite_noms = [row[0] for row in r.fetchall()]
    # Pays invités
    if e.pays_invites_ids:
        r = await db.execute(text("SELECT nom_fr FROM ref_pays WHERE id = ANY(:ids)"), {"ids": e.pays_invites_ids})
        resp.pays_invites_noms = ", ".join(row[0] for row in r.fetchall())
    # Hiérarchie structurée pour l'affichage en arborescence
    if e.secteur_ids or e.branche_ids or e.activite_ids:
        r = await db.execute(text("""
            SELECT
                s.id   AS sec_id,   s.nom AS sec_nom,
                b.id   AS bra_id,   b.nom AS bra_nom,
                a.id   AS act_id,   a.nom AS act_nom
            FROM ref_secteurs s
            LEFT JOIN ref_branches b  ON b.secteur_id = s.id  AND b.id  = ANY(:bra_ids)
            LEFT JOIN ref_activites a ON a.branche_id = b.id  AND a.id  = ANY(:act_ids)
            WHERE s.id = ANY(:sec_ids)
              AND (b.id IS NULL OR b.id = ANY(:bra_ids))
            ORDER BY s.nom, b.nom, a.nom
        """), {
            "sec_ids": e.secteur_ids or [],
            "bra_ids": e.branche_ids or [],
            "act_ids": e.activite_ids or [],
        })
        rows = r.fetchall()
        # Construire la hiérarchie {sec_nom: {bra_nom: [act_nom]}}
        tree: dict = {}
        for row in rows:
            sec = row[1]; bra = row[3]; act = row[5]
            if sec not in tree:
                tree[sec] = {}
            if bra and bra not in tree[sec]:
                tree[sec][bra] = []
            if bra and act and act not in tree[sec][bra]:
                tree[sec][bra].append(act)
        resp.thematiques_tree = tree  # type: ignore
    return resp


def get_statut_calcule(e: Evenement) -> str:
    today = date_type.today()
    if e.date_debut > today:   return "a_venir"
    if e.date_debut <= today <= e.date_fin: return "en_cours"
    return "termine"


# ── GET /evenements/admin — tous les événements (publiés ET non publiés) ──────
@router.get("/admin", response_model=EvenementListResponse)
async def liste_evenements_admin(
    page:     int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    db:       AsyncSession = Depends(get_db),
):
    filters = [Evenement.is_deleted == False]
    total_q = await db.execute(select(func.count()).select_from(Evenement).where(and_(*filters)))
    total   = total_q.scalar()
    result  = await db.execute(
        select(Evenement).where(and_(*filters))
        .order_by(Evenement.date_debut.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    evenements = result.scalars().all()
    return EvenementListResponse(
        total=total, page=page, per_page=per_page,
        data=[await enrich_evenement(e, db) for e in evenements]
    )


# ── GET /evenements ────────────────────────────────────────────────────────────
@router.get("", response_model=EvenementListResponse)
async def liste_evenements(
    page:           int           = Query(1, ge=1),
    per_page:       int           = Query(12, ge=1, le=100),
    statut_calcule: Optional[str] = None,
    pays_nom:       List[str]     = Query(default=[]),
    annee:          Optional[int] = None,
    secteur:        List[str]     = Query(default=[]),
    branche:        List[str]     = Query(default=[]),
    activite:       List[str]     = Query(default=[]),
    admin:          bool          = Query(False),  # si True → pas de filtre est_publie
    db:             AsyncSession  = Depends(get_db),
):
    today = date_type.today()
    filters = []
    if not admin:
        filters.append(Evenement.est_publie == True)


    # Pays hôte — OR intra
    if pays_nom:
        filters.append(Evenement.pays_hote_id.in_(
            select(RefPaysEvenement.id).where(or_(*[RefPaysEvenement.nom_fr == p for p in pays_nom]))
        ))

    if annee:
        filters.append(extract("year", Evenement.date_debut) == annee)

    # Thématiques — OR intra-groupe, ET inter-groupes
    if secteur:
        filters.append(or_(*[Evenement.thematiques_naema.ilike(f"%sec:{s}%") for s in secteur]))
    if branche:
        filters.append(or_(*[Evenement.thematiques_naema.ilike(f"%bra:{b}%") for b in branche]))
    if activite:
        filters.append(or_(*[Evenement.thematiques_naema.ilike(f"%act:{a}%") for a in activite]))

    if statut_calcule == "a_venir":
        filters.append(Evenement.date_debut > today)
    elif statut_calcule == "en_cours":
        filters.append(and_(Evenement.date_debut <= today, Evenement.date_fin >= today))
    elif statut_calcule == "termine":
        filters.append(Evenement.date_fin < today)

    total_q = await db.execute(select(func.count()).select_from(Evenement).where(and_(*filters)))
    total   = total_q.scalar()

    result  = await db.execute(
        select(Evenement).where(and_(*filters))
        .order_by(Evenement.date_debut.asc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    evenements = result.scalars().all()
    return EvenementListResponse(
        total=total, page=page, per_page=per_page,
        data=[await enrich_evenement(e, db) for e in evenements]
    )


# ── GET /evenements/stats ──────────────────────────────────────────────────────
@router.get("/stats")
async def stats_evenements(db: AsyncSession = Depends(get_db)):
    today = date_type.today()
    base  = and_(Evenement.est_publie == True)
    total    = (await db.execute(select(func.count()).select_from(Evenement).where(base))).scalar()
    a_venir  = (await db.execute(select(func.count()).select_from(Evenement).where(and_(base, Evenement.date_debut > today)))).scalar()
    en_cours = (await db.execute(select(func.count()).select_from(Evenement).where(and_(base, Evenement.date_debut <= today, Evenement.date_fin >= today)))).scalar()
    termine  = (await db.execute(select(func.count()).select_from(Evenement).where(and_(base, Evenement.date_fin < today)))).scalar()
    return {"total": total, "a_venir": a_venir, "en_cours": en_cours, "termine": termine}


# ── GET /evenements/pays-hotes ─────────────────────────────────────────────────
@router.get("/pays-hotes")
async def pays_hotes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RefPaysEvenement.nom_fr, RefPaysEvenement.code_iso2)
        .join(Evenement, Evenement.pays_hote_id == RefPaysEvenement.id)
        .where(Evenement.est_publie == True)
        .distinct()
        .order_by(RefPaysEvenement.nom_fr)
    )
    return [r.nom_fr for r in result.all()]


# ── GET /evenements/:id ────────────────────────────────────────────────────────
@router.get("/{evenement_id}", response_model=EvenementResponse)
async def detail_evenement(evenement_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evenement).where(Evenement.id == evenement_id))
    e = result.scalar_one_or_none()
    if not e: raise HTTPException(status_code=404, detail="Événement introuvable")
    return await enrich_evenement(e, db)


# ── POST /evenements ───────────────────────────────────────────────────────────
@router.post("", response_model=EvenementResponse, status_code=201)
async def creer_evenement(payload: EvenementCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from datetime import date as date_type
    data = payload.model_dump(exclude_none=True)
    # Validation : date_debut >= aujourd'hui
    if "date_debut" in data and data["date_debut"] < date_type.today():
        raise HTTPException(422, "La date de début ne peut pas être dans le passé")
    data.pop("statut", None)  # sécurité
    e = Evenement(**data)
    db.add(e)
    await db.flush()
    await db.refresh(e)
    return await enrich_evenement(e, db)


# ── PATCH /evenements/:id ──────────────────────────────────────────────────────
@router.patch("/{evenement_id}", response_model=EvenementResponse)
async def modifier_evenement(evenement_id: int, payload: EvenementUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    result = await db.execute(select(Evenement).where(Evenement.id == evenement_id))
    e = result.scalar_one_or_none()
    if not e: raise HTTPException(status_code=404, detail="Événement introuvable")
    updates = payload.model_dump(exclude_unset=True)
    updates.pop("statut", None)
    # Ne pas écraser les dates existantes avec null si l'événement en avait déjà
    for f in ["date_debut", "date_fin"]:
        if f in updates and updates[f] is None and getattr(e, f) is not None:
            updates.pop(f)
    for k, v in updates.items():
        setattr(e, k, v)
    await db.flush()
    await db.refresh(e)
    return await enrich_evenement(e, db)


# ── DELETE /evenements/:id ─────────────────────────────────────────────────────
@router.delete("/{evenement_id}", status_code=204)
async def supprimer_evenement(evenement_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    result = await db.execute(select(Evenement).where(Evenement.id == evenement_id))
    e = result.scalar_one_or_none()
    if not e: raise HTTPException(status_code=404, detail="Événement introuvable")
    await db.delete(e)
    await db.flush()
