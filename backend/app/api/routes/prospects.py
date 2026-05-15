from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
from datetime import date as date_type

from app.core.database import get_db
from app.models.prospect import Prospect, ProspectPointFocal, ProspectContact, ProspectContactHistorique
from app.schemas.prospect import (
    ProspectCreate, ProspectUpdate, ProspectResponse, ProspectListResponse,
    ContactCreate, ContactUpdate, ContactResponse,
    HistoriqueCreate, HistoriqueResponse,
    PointFocalProspectCreate, PointFocalProspectResponse,
)

router = APIRouter(prefix="/prospects", tags=["Prospects"])

LOAD_OPTS = [
    selectinload(Prospect.points_focaux),
    selectinload(Prospect.secteur),
    selectinload(Prospect.branche),
    selectinload(Prospect.activite),
    selectinload(Prospect.contacts).selectinload(ProspectContact.historique),
]


async def get_full(prospect_id: UUID, db: AsyncSession) -> Prospect:
    result = await db.execute(
        select(Prospect).options(*LOAD_OPTS)
        .where(Prospect.id == prospect_id, Prospect.is_deleted == False)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Prospect introuvable")
    return p


# ── Liste & détail ────────────────────────────────────────────────────────────

@router.get("", response_model=ProspectListResponse)
async def liste_prospects(
    page:         int           = Query(1, ge=1),
    per_page:     int           = Query(12, ge=1, le=100),
    search:       Optional[str] = None,
    secteur_nom:  Optional[str] = None,
    branche_nom:  Optional[str] = None,
    activite_nom: Optional[str] = None,
    region:       Optional[str] = None,
    est_contacte: Optional[bool]= None,
    db:           AsyncSession  = Depends(get_db),
):
    from app.models.entreprise import RefSecteur, RefBranche, RefActivite

    filters = [Prospect.is_deleted == False, Prospect.est_publie == True]

    if search:
        filters.append(or_(
            Prospect.nom.ilike(f"%{search}%"),
            Prospect.mail.ilike(f"%{search}%"),
            Prospect.region.ilike(f"%{search}%"),
        ))
    if region:     filters.append(Prospect.region.ilike(f"%{region}%"))
    if secteur_nom:
        noms = [n.strip() for n in secteur_nom.split(",") if n.strip()]
        if noms:
            filters.append(Prospect.secteur_id.in_(
                select(RefSecteur.id).where(RefSecteur.nom.in_(noms))
            ))
    if branche_nom:
        noms = [n.strip() for n in branche_nom.split(",") if n.strip()]
        if noms:
            filters.append(Prospect.branche_id.in_(
                select(RefBranche.id).where(RefBranche.nom.in_(noms))
            ))
    if activite_nom:
        noms = [n.strip() for n in activite_nom.split(",") if n.strip()]
        if noms:
            filters.append(Prospect.activite_id.in_(
                select(RefActivite.id).where(RefActivite.nom.in_(noms))
            ))
    if est_contacte is True:
        filters.append(Prospect.id.in_(
            select(ProspectContact.prospect_id).where(ProspectContact.is_deleted == False)
        ))
    elif est_contacte is False:
        filters.append(Prospect.id.notin_(
            select(ProspectContact.prospect_id).where(ProspectContact.is_deleted == False)
        ))

    total = (await db.execute(select(func.count()).select_from(Prospect).where(and_(*filters)))).scalar()
    result = await db.execute(
        select(Prospect).options(*LOAD_OPTS)
        .where(and_(*filters))
        .order_by(Prospect.nom)
        .offset((page - 1) * per_page).limit(per_page)
    )
    return ProspectListResponse(
        total=total, page=page, per_page=per_page,
        data=[ProspectResponse.model_validate(p) for p in result.scalars().all()]
    )


@router.get("/{prospect_id}", response_model=ProspectResponse)
async def detail_prospect(prospect_id: UUID, db: AsyncSession = Depends(get_db)):
    return ProspectResponse.model_validate(await get_full(prospect_id, db))


# ── CRUD Prospect ─────────────────────────────────────────────────────────────

@router.post("", response_model=ProspectResponse, status_code=201)
async def creer_prospect(payload: ProspectCreate, db: AsyncSession = Depends(get_db)):
    pf_data = payload.points_focaux
    data    = payload.model_dump(exclude={"points_focaux"})
    for k, v in data.items():
        if v == "": data[k] = None
    p = Prospect(**data)
    db.add(p)
    await db.flush()
    for pf in pf_data:
        db.add(ProspectPointFocal(prospect_id=p.id, **pf.model_dump()))
    await db.flush()
    return ProspectResponse.model_validate(await get_full(p.id, db))


@router.patch("/{prospect_id}", response_model=ProspectResponse)
async def modifier_prospect(prospect_id: UUID, payload: ProspectUpdate, db: AsyncSession = Depends(get_db)):
    p = await get_full(prospect_id, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v if v != "" else None)
    await db.flush()
    return ProspectResponse.model_validate(await get_full(prospect_id, db))


@router.delete("/{prospect_id}", status_code=204)
async def supprimer_prospect(prospect_id: UUID, db: AsyncSession = Depends(get_db)):
    p = await get_full(prospect_id, db)
    p.is_deleted = True
    await db.flush()


# ── Contacts ──────────────────────────────────────────────────────────────────

@router.get("/{prospect_id}/contacts", response_model=list[ContactResponse])
async def liste_contacts(prospect_id: UUID, db: AsyncSession = Depends(get_db)):
    await get_full(prospect_id, db)
    result = await db.execute(
        select(ProspectContact)
        .options(selectinload(ProspectContact.historique))
        .where(ProspectContact.prospect_id == prospect_id, ProspectContact.is_deleted == False)
        .order_by(ProspectContact.date_premier_contact.desc())
    )
    return [ContactResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/{prospect_id}/contacts", response_model=ContactResponse, status_code=201)
async def ajouter_contact(prospect_id: UUID, payload: ContactCreate, db: AsyncSession = Depends(get_db)):
    await get_full(prospect_id, db)
    contact = ProspectContact(prospect_id=prospect_id, **payload.model_dump())
    db.add(contact)
    await db.flush()
    # Créer automatiquement le premier historique
    db.add(ProspectContactHistorique(
        contact_id=contact.id,
        etat=payload.etat_avancement,
        commentaire=payload.commentaires,
    ))
    await db.flush()
    result = await db.execute(
        select(ProspectContact).options(selectinload(ProspectContact.historique))
        .where(ProspectContact.id == contact.id)
    )
    return ContactResponse.model_validate(result.scalar_one())


@router.patch("/{prospect_id}/contacts/{contact_id}", response_model=ContactResponse)
async def modifier_contact(
    prospect_id: UUID, contact_id: UUID,
    payload: ContactUpdate, db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProspectContact).options(selectinload(ProspectContact.historique))
        .where(ProspectContact.id == contact_id, ProspectContact.prospect_id == prospect_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact introuvable")

    old_etat = contact.etat_avancement
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(contact, k, v)
    await db.flush()

    # Si l'état change, enregistrer dans l'historique
    if payload.etat_avancement and payload.etat_avancement != old_etat:
        db.add(ProspectContactHistorique(
            contact_id=contact.id,
            etat=payload.etat_avancement,
            commentaire=payload.commentaires,
        ))
        await db.flush()

    result = await db.execute(
        select(ProspectContact).options(selectinload(ProspectContact.historique))
        .where(ProspectContact.id == contact_id)
    )
    return ContactResponse.model_validate(result.scalar_one())


@router.delete("/{prospect_id}/contacts/{contact_id}", status_code=204)
async def supprimer_contact(
    prospect_id: UUID, contact_id: UUID, db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProspectContact)
        .where(ProspectContact.id == contact_id, ProspectContact.prospect_id == prospect_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact introuvable")
    contact.is_deleted = True
    await db.flush()
