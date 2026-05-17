from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, extract
from typing import Optional, List
from uuid import UUID
from datetime import date as date_type

from app.core.database import get_db
from app.models.evenement import Evenement
from app.models.shared import RefPays as RefPaysEvenement
from app.schemas.evenement import (
    EvenementCreate, EvenementUpdate,
    EvenementResponse, EvenementListResponse
)

router = APIRouter(prefix="/evenements", tags=["Événements"])


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
        data=[EvenementResponse.model_validate(e) for e in evenements]
    )


# ── GET /evenements ────────────────────────────────────────────────────────────
@router.get("", response_model=EvenementListResponse)
async def liste_evenements(
    page:           int           = Query(1, ge=1),
    per_page:       int           = Query(12, ge=1, le=100),
    type_evenement: List[str]     = Query(default=[]),
    statut_calcule: Optional[str] = None,
    pays_nom:       List[str]     = Query(default=[]),   # noms pour compatibilité frontend
    annee:          Optional[int] = None,
    secteur:        List[str]     = Query(default=[]),
    branche:        List[str]     = Query(default=[]),
    activite:       List[str]     = Query(default=[]),
    db:             AsyncSession  = Depends(get_db),
):
    today = date_type.today()
    filters = [
        Evenement.est_publie  == True,
        Evenement.is_deleted  == False,   # ← correction bug
    ]

    if type_evenement:
        filters.append(or_(*[Evenement.type_evenement == t for t in type_evenement]))

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
        data=[EvenementResponse.model_validate(e) for e in evenements]
    )


# ── GET /evenements/stats ──────────────────────────────────────────────────────
@router.get("/stats")
async def stats_evenements(db: AsyncSession = Depends(get_db)):
    today = date_type.today()
    base  = and_(Evenement.is_deleted == False, Evenement.est_publie == True)
    total    = (await db.execute(select(func.count()).select_from(Evenement).where(base))).scalar()
    a_venir  = (await db.execute(select(func.count()).select_from(Evenement).where(and_(base, Evenement.date_debut > today)))).scalar()
    en_cours = (await db.execute(select(func.count()).select_from(Evenement).where(and_(base, Evenement.date_debut <= today, Evenement.date_fin >= today)))).scalar()
    return {"total": total, "a_venir": a_venir, "en_cours": en_cours}


# ── GET /evenements/pays-hotes ─────────────────────────────────────────────────
@router.get("/pays-hotes")
async def pays_hotes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RefPaysEvenement.nom_fr, RefPaysEvenement.code_iso2)
        .join(Evenement, Evenement.pays_hote_id == RefPaysEvenement.id)
        .where(Evenement.is_deleted == False, Evenement.est_publie == True)
        .distinct()
        .order_by(RefPaysEvenement.nom_fr)
    )
    return [r.nom_fr for r in result.all()]


# ── GET /evenements/:id ────────────────────────────────────────────────────────
@router.get("/{evenement_id}", response_model=EvenementResponse)
async def detail_evenement(evenement_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evenement).where(Evenement.id == evenement_id, Evenement.is_deleted == False))
    e = result.scalar_one_or_none()
    if not e: raise HTTPException(status_code=404, detail="Événement introuvable")
    return EvenementResponse.model_validate(e)


# ── POST /evenements ───────────────────────────────────────────────────────────
@router.post("", response_model=EvenementResponse, status_code=201)
async def creer_evenement(payload: EvenementCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump(exclude_none=True)
    e    = Evenement(**data)
    db.add(e)
    await db.flush()
    await db.refresh(e)
    return EvenementResponse.model_validate(e)


# ── PATCH /evenements/:id ──────────────────────────────────────────────────────
@router.patch("/{evenement_id}", response_model=EvenementResponse)
async def modifier_evenement(evenement_id: UUID, payload: EvenementUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evenement).where(Evenement.id == evenement_id, Evenement.is_deleted == False))
    e = result.scalar_one_or_none()
    if not e: raise HTTPException(status_code=404, detail="Événement introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    await db.flush()
    await db.refresh(e)
    return EvenementResponse.model_validate(e)


# ── DELETE /evenements/:id ─────────────────────────────────────────────────────
@router.delete("/{evenement_id}", status_code=204)
async def supprimer_evenement(evenement_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evenement).where(Evenement.id == evenement_id))
    e = result.scalar_one_or_none()
    if not e: raise HTTPException(status_code=404, detail="Événement introuvable")
    e.is_deleted = True
    await db.flush()
