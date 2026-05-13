from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.models.evenement import Evenement
from app.schemas.evenement import (
    EvenementCreate, EvenementUpdate,
    EvenementResponse, EvenementListResponse
)

router = APIRouter(prefix="/evenements", tags=["Événements"])


# ── GET /evenements — Liste publique avec filtres ──
@router.get("", response_model=EvenementListResponse)
async def liste_evenements(
    page:           int             = Query(1, ge=1),
    per_page:       int             = Query(12, ge=1, le=100),
    type_evenement: Optional[str]   = None,
    statut:         Optional[str]   = None,
    pays_nom:       Optional[str]   = None,
    annee:          Optional[int]   = None,
    search:         Optional[str]   = None,
    db:             AsyncSession    = Depends(get_db),
):
    filters = [
        Evenement.is_deleted == False,
        Evenement.est_publie == True,
    ]

    if type_evenement:  filters.append(Evenement.type_evenement == type_evenement)
    if statut:          filters.append(Evenement.statut == statut)
    if pays_nom:        filters.append(Evenement.pays_nom.ilike(f"%{pays_nom}%"))
    if annee:
        from sqlalchemy import extract
        filters.append(extract("year", Evenement.date_debut) == annee)
    if search:
        filters.append(or_(
            Evenement.nom_event.ilike(f"%{search}%"),
            Evenement.description.ilike(f"%{search}%"),
            Evenement.organisateur.ilike(f"%{search}%"),
            Evenement.ville.ilike(f"%{search}%"),
        ))

    total_q = await db.execute(select(func.count()).select_from(Evenement).where(and_(*filters)))
    total   = total_q.scalar()

    result  = await db.execute(
        select(Evenement)
        .where(and_(*filters))
        .order_by(Evenement.date_debut.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    evenements = result.scalars().all()

    return EvenementListResponse(
        total=total, page=page, per_page=per_page,
        data=[EvenementResponse.model_validate(e) for e in evenements]
    )


# ── GET /evenements/chronogramme — Regroupés par mois pour la timeline ──
@router.get("/chronogramme")
async def chronogramme(
    annee: int = Query(default=2025),
    db:    AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Evenement)
        .where(and_(
            Evenement.is_deleted == False,
            Evenement.est_publie == True,
        ))
        .order_by(Evenement.date_debut.asc())
    )
    evenements = result.scalars().all()

    # Grouper par mois
    from collections import defaultdict
    mois_labels = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"]
    grouped: dict = defaultdict(list)

    for e in evenements:
        mois_key = f"{e.date_debut.year}-{e.date_debut.month:02d}"
        grouped[mois_key].append(EvenementResponse.model_validate(e))

    return {
        "annee": annee,
        "mois":  mois_labels,
        "data":  {k: v for k, v in sorted(grouped.items())},
    }


# ── GET /evenements/:id — Détail d'un événement ──
@router.get("/{evenement_id}", response_model=EvenementResponse)
async def detail_evenement(
    evenement_id: UUID,
    db:           AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Evenement).where(
            Evenement.id == evenement_id,
            Evenement.is_deleted == False,
        )
    )
    evenement = result.scalar_one_or_none()
    if not evenement:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    return EvenementResponse.model_validate(evenement)


# ── POST /evenements — Créer (admin) ──
@router.post("", response_model=EvenementResponse, status_code=201)
async def creer_evenement(
    payload: EvenementCreate,
    db:      AsyncSession = Depends(get_db),
):
    if payload.date_fin < payload.date_debut:
        raise HTTPException(status_code=422, detail="date_fin ne peut pas être avant date_debut")

    evenement = Evenement(**payload.model_dump())
    db.add(evenement)
    await db.flush()
    await db.refresh(evenement)
    return EvenementResponse.model_validate(evenement)


# ── PATCH /evenements/:id — Modifier (admin) ──
@router.patch("/{evenement_id}", response_model=EvenementResponse)
async def modifier_evenement(
    evenement_id: UUID,
    payload:      EvenementUpdate,
    db:           AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Evenement).where(
            Evenement.id == evenement_id,
            Evenement.is_deleted == False,
        )
    )
    evenement = result.scalar_one_or_none()
    if not evenement:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(evenement, field, value)

    await db.flush()
    await db.refresh(evenement)
    return EvenementResponse.model_validate(evenement)


# ── DELETE /evenements/:id — Soft delete (admin) ──
@router.delete("/{evenement_id}", status_code=204)
async def supprimer_evenement(
    evenement_id: UUID,
    db:           AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Evenement).where(
            Evenement.id == evenement_id,
            Evenement.is_deleted == False,
        )
    )
    evenement = result.scalar_one_or_none()
    if not evenement:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    evenement.is_deleted = True
    await db.flush()
