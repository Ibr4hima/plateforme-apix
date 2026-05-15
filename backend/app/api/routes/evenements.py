from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, cast, Date
from sqlalchemy.sql.expression import text
from typing import Optional
from uuid import UUID
from datetime import date as date_type

from app.core.database import get_db
from app.models.evenement import Evenement
from app.schemas.evenement import (
    EvenementCreate, EvenementUpdate,
    EvenementResponse, EvenementListResponse
)

router = APIRouter(prefix="/evenements", tags=["Événements"])


def clean_payload(data: dict) -> dict:
    optional_fields = [
        "edition", "role_apix", "description", "lien_site_officiel",
        "frequence", "pays_nom", "ville", "lieu_nom", "lien_virtuel",
        "thematiques", "pays_invites", "entreprises_invitees",
        "lien_rapport", "note_interne", "created_by",
    ]
    for field in optional_fields:
        if field in data and data[field] == "":
            data[field] = None
    return data


def get_statut_calcule(e: Evenement) -> str:
    today = date_type.today()
    if e.date_debut > today:
        return "a_venir"
    elif e.date_debut <= today <= e.date_fin:
        return "en_cours"
    else:
        return "termine"


@router.get("", response_model=EvenementListResponse)
async def liste_evenements(
    page:           int             = Query(1, ge=1),
    per_page:       int             = Query(12, ge=1, le=100),
    type_evenement: Optional[str]   = None,
    statut_calcule: Optional[str]   = None,  # a_venir | en_cours | termine
    pays_nom:       Optional[str]   = None,
    annee:          Optional[int]   = None,
    search:         Optional[str]   = None,
    thematique:     Optional[str]   = None,
    db:             AsyncSession    = Depends(get_db),
):
    today = date_type.today()
    filters = [
        Evenement.est_publie == True,
    ]

    if type_evenement:  filters.append(Evenement.type_evenement == type_evenement)
    if pays_nom:        filters.append(Evenement.pays_nom == pays_nom)
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
    if thematique:
        filters.append(Evenement.thematiques.ilike(f"%{thematique}%"))

    # Statut calculé à partir des dates
    if statut_calcule == "a_venir":
        filters.append(Evenement.date_debut > today)
    elif statut_calcule == "en_cours":
        filters.append(and_(Evenement.date_debut <= today, Evenement.date_fin >= today))
    elif statut_calcule == "termine":
        filters.append(Evenement.date_fin < today)

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


@router.get("/pays-hotes")
async def pays_hotes(db: AsyncSession = Depends(get_db)):
    """Retourne les pays hôtes distincts présents en BDD"""
    result = await db.execute(
        select(Evenement.pays_nom)
        .where(
                Evenement.est_publie == True,
            Evenement.pays_nom != None,
            Evenement.pays_nom != "",
        )
        .distinct()
        .order_by(Evenement.pays_nom)
    )
    pays = [row[0] for row in result.fetchall() if row[0]]
    return pays


@router.get("/stats")
async def stats_evenements(db: AsyncSession = Depends(get_db)):
    """Stats pour le badge titre"""
    today = date_type.today()
    base = and_(Evenement.is_deleted == False, Evenement.est_publie == True)

    r_avenir  = await db.execute(select(func.count()).select_from(Evenement).where(and_(base, Evenement.date_debut > today)))
    nb_avenir = r_avenir.scalar()

    r_encours  = await db.execute(select(func.count()).select_from(Evenement).where(and_(base, Evenement.date_debut <= today, Evenement.date_fin >= today)))
    nb_encours = r_encours.scalar()

    return {
        "a_venir":  nb_avenir,
        "en_cours": nb_encours,
        "total":    nb_avenir + nb_encours,
    }


@router.get("/chronogramme")
async def chronogramme(
    annee: int = Query(default=2026),
    db:    AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Evenement)
        .where(and_(Evenement.is_deleted == False, Evenement.est_publie == True))
        .order_by(Evenement.date_debut.asc())
    )
    evenements = result.scalars().all()

    from collections import defaultdict
    grouped: dict = defaultdict(list)
    for e in evenements:
        mois_key = f"{e.date_debut.year}-{e.date_debut.month:02d}"
        grouped[mois_key].append(EvenementResponse.model_validate(e))

    return {"annee": annee, "data": {k: v for k, v in sorted(grouped.items())}}


@router.get("/{evenement_id}", response_model=EvenementResponse)
async def detail_evenement(evenement_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Evenement).where(Evenement.id == evenement_id)
    )
    evenement = result.scalar_one_or_none()
    if not evenement:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    return EvenementResponse.model_validate(evenement)


@router.post("", response_model=EvenementResponse, status_code=201)
async def creer_evenement(payload: EvenementCreate, db: AsyncSession = Depends(get_db)):
    if payload.date_fin < payload.date_debut:
        raise HTTPException(status_code=422, detail="date_fin ne peut pas être avant date_debut")
    data = clean_payload(payload.model_dump())
    evenement = Evenement(**data)
    db.add(evenement)
    await db.flush()
    await db.refresh(evenement)
    return EvenementResponse.model_validate(evenement)


@router.patch("/{evenement_id}", response_model=EvenementResponse)
async def modifier_evenement(evenement_id: UUID, payload: EvenementUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Evenement).where(Evenement.id == evenement_id)
    )
    evenement = result.scalar_one_or_none()
    if not evenement:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    data = clean_payload(payload.model_dump(exclude_unset=True))
    for field, value in data.items():
        setattr(evenement, field, value)
    await db.flush()
    await db.refresh(evenement)
    return EvenementResponse.model_validate(evenement)


@router.delete("/{evenement_id}", status_code=204)
async def supprimer_evenement(evenement_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Evenement).where(Evenement.id == evenement_id)
    )
    evenement = result.scalar_one_or_none()
    if not evenement:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    await db.delete(evenement)
    await db.flush()
