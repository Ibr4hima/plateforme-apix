from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.models.entreprise import EntrepriseIntallee, EntreprisePointFocal, RefSecteur, RefBranche, RefActivite
from app.schemas.entreprise import (
    EntrepriseCreate, EntrepriseUpdate, EntrepriseResponse,
    EntrepriseListResponse, PointFocalCreate, PointFocalResponse,
    RefSecteurResponse, RefBrancheResponse, RefActiviteResponse,
)

router = APIRouter(prefix="/entreprises", tags=["Entreprises installées"])


# ── Référentiels NAEMA ────────────────────────────────────────────────────────

@router.get("/ref/secteurs", response_model=list[RefSecteurResponse])
async def liste_secteurs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefSecteur).where(RefSecteur.actif == True).order_by(RefSecteur.code))
    return [RefSecteurResponse.model_validate(s) for s in result.scalars().all()]

@router.get("/ref/branches", response_model=list[RefBrancheResponse])
async def liste_branches(
    secteur_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    q = select(RefBranche).where(RefBranche.actif == True)
    if secteur_id:
        q = q.where(RefBranche.secteur_id == secteur_id)
    result = await db.execute(q.order_by(RefBranche.code))
    return [RefBrancheResponse.model_validate(b) for b in result.scalars().all()]

@router.get("/ref/activites", response_model=list[RefActiviteResponse])
async def liste_activites(
    branche_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    q = select(RefActivite).where(RefActivite.actif == True)
    if branche_id:
        q = q.where(RefActivite.branche_id == branche_id)
    result = await db.execute(q.order_by(RefActivite.code))
    return [RefActiviteResponse.model_validate(a) for a in result.scalars().all()]


# ── Entreprises ───────────────────────────────────────────────────────────────

@router.get("/ref/formes-juridiques")
async def formes_juridiques_presentes(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select, distinct
    result = await db.execute(
        select(distinct(EntrepriseIntallee.forme_juridique))
        .where(
            EntrepriseIntallee.is_deleted == False,
            EntrepriseIntallee.forme_juridique != None,
            EntrepriseIntallee.forme_juridique != "",
        )
        .order_by(EntrepriseIntallee.forme_juridique)
    )
    return [row[0] for row in result.fetchall() if row[0]]

@router.get("/ref/noms")
async def noms_entreprises(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(
        select(EntrepriseIntallee.nom)
        .where(
            EntrepriseIntallee.is_deleted == False,
            EntrepriseIntallee.est_publie == True,
        )
        .order_by(EntrepriseIntallee.nom)
    )
    return [row[0] for row in result.fetchall() if row[0]]

@router.patch("/ref/branches/{branche_id}", response_model=RefBrancheResponse)
async def modifier_branche(branche_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefBranche).where(RefBranche.id == branche_id))
    branche = result.scalar_one_or_none()
    if not branche:
        raise HTTPException(status_code=404, detail="Branche introuvable")
    for k, v in payload.items():
        setattr(branche, k, v)
    await db.flush()
    await db.refresh(branche)
    return RefBrancheResponse.model_validate(branche)

@router.delete("/ref/branches/{branche_id}", status_code=204)
async def supprimer_branche(branche_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefBranche).where(RefBranche.id == branche_id))
    branche = result.scalar_one_or_none()
    if not branche:
        raise HTTPException(status_code=404, detail="Branche introuvable")
    await db.delete(branche)
    await db.flush()


# ── CRUD Activités ────────────────────────────────────────────────────────────

@router.patch("/ref/activites/{activite_id}", response_model=RefActiviteResponse)
async def modifier_activite(activite_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefActivite).where(RefActivite.id == activite_id))
    activite = result.scalar_one_or_none()
    if not activite:
        raise HTTPException(status_code=404, detail="Activité introuvable")
    for k, v in payload.items():
        setattr(activite, k, v)
    await db.flush()
    await db.refresh(activite)
    return RefActiviteResponse.model_validate(activite)

@router.delete("/ref/activites/{activite_id}", status_code=204)
async def supprimer_activite(activite_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefActivite).where(RefActivite.id == activite_id))
    activite = result.scalar_one_or_none()
    if not activite:
        raise HTTPException(status_code=404, detail="Activité introuvable")
    await db.delete(activite)
    await db.flush()


# ── Référentiel pays ──────────────────────────────────────────────────────────

from app.models.entreprise import RefSecteur  # déjà importé plus haut
from sqlalchemy import Column, Integer, String, Boolean
from app.core.database import Base as _Base

class RefPays(_Base):
    __tablename__ = "ref_pays"
    id          = Column(Integer, primary_key=True)
    code_iso2   = Column(String(2))
    code_iso3   = Column(String(3))
    nom_fr      = Column(String(100))
    nom_en      = Column(String(100))
    region_monde= Column(String(100))
    actif       = Column(Boolean, default=True)

@router.get("/ref/pays")
async def liste_pays(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(
        select(RefPays).where(RefPays.actif == True).order_by(RefPays.nom_fr)
    )
    pays = result.scalars().all()
    return [{"id": p.id, "code_iso2": p.code_iso2, "nom_fr": p.nom_fr, "region_monde": p.region_monde} for p in pays]


# ── Référentiel géographie Sénégal ────────────────────────────────────────────

class RefRegion(_Base):
    __tablename__ = "ref_regions"
    id    = Column(Integer, primary_key=True)
    code  = Column(String(10))
    nom   = Column(String(100))
    actif = Column(Boolean, default=True)

class RefDepartement(_Base):
    __tablename__ = "ref_departements"
    id        = Column(Integer, primary_key=True)
    region_id = Column(Integer)
    code      = Column(String(10))
    nom       = Column(String(100))
    actif     = Column(Boolean, default=True)

class RefArrondissement(_Base):
    __tablename__ = "ref_arrondissements"
    id             = Column(Integer, primary_key=True)
    departement_id = Column(Integer)
    code           = Column(String(10))
    nom            = Column(String(100))
    actif          = Column(Boolean, default=True)

@router.get("/ref/regions")
async def liste_regions(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(
        select(RefRegion).where(RefRegion.actif == True).order_by(RefRegion.nom)
    )
    return [{"id": r.id, "code": r.code, "nom": r.nom} for r in result.scalars().all()]

@router.get("/ref/departements")
async def liste_departements(
    region_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import select
    q = select(RefDepartement).where(RefDepartement.actif == True)
    if region_id:
        q = q.where(RefDepartement.region_id == region_id)
    result = await db.execute(q.order_by(RefDepartement.nom))
    return [{"id": d.id, "code": d.code, "nom": d.nom, "region_id": d.region_id} for d in result.scalars().all()]

@router.get("/ref/arrondissements")
async def liste_arrondissements(
    departement_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import select
    q = select(RefArrondissement).where(RefArrondissement.actif == True)
    if departement_id:
        q = q.where(RefArrondissement.departement_id == departement_id)
    result = await db.execute(q.order_by(RefArrondissement.nom))
    return [{"id": a.id, "code": a.code, "nom": a.nom, "departement_id": a.departement_id} for a in result.scalars().all()]

@router.post("/ref/branches", response_model=RefBrancheResponse, status_code=201)
async def creer_branche(payload: dict, db: AsyncSession = Depends(get_db)):
    branche = RefBranche(**payload)
    db.add(branche)
    await db.flush()
    await db.refresh(branche)
    return RefBrancheResponse.model_validate(branche)

@router.post("/ref/activites", response_model=RefActiviteResponse, status_code=201)
async def creer_activite(payload: dict, db: AsyncSession = Depends(get_db)):
    activite = RefActivite(**payload)
    db.add(activite)
    await db.flush()
    await db.refresh(activite)
    return RefActiviteResponse.model_validate(activite)

@router.get("", response_model=EntrepriseListResponse)
async def liste_entreprises(
    page:         int           = Query(1, ge=1),
    per_page:     int           = Query(12, ge=1, le=100),
    statut:       Optional[str] = None,
    secteur_id:   Optional[int] = None,
    branche_id:   Optional[int] = None,
    region:       Optional[str] = None,
    pays:         Optional[str] = None,
    search:       Optional[str] = None,
    forme_juridique:    Optional[str] = None,
    region_noms:        Optional[str] = None,
    departement_noms:   Optional[str] = None,
    arrondissement_noms:Optional[str] = None,
    # Filtres multi (noms séparés par virgules)
    secteur_nom:  Optional[str] = None,
    branche_nom:  Optional[str] = None,
    activite_nom: Optional[str] = None,
    db:           AsyncSession  = Depends(get_db),
):
    filters = [
        EntrepriseIntallee.is_deleted == False,
        EntrepriseIntallee.est_publie == True,
    ]
    if statut:     filters.append(EntrepriseIntallee.statut == statut)
    if secteur_id: filters.append(EntrepriseIntallee.secteur_id == secteur_id)
    if branche_id: filters.append(EntrepriseIntallee.branche_id == branche_id)
    if region:     filters.append(EntrepriseIntallee.region.ilike(f"%{region}%"))
    if pays:       filters.append(EntrepriseIntallee.pays.ilike(f"%{pays}%"))
    if search:
        filters.append(or_(
            EntrepriseIntallee.nom.ilike(f"%{search}%"),
            EntrepriseIntallee.mail.ilike(f"%{search}%"),
            EntrepriseIntallee.commune.ilike(f"%{search}%"),
            EntrepriseIntallee.adresse.ilike(f"%{search}%"),
        ))

    if forme_juridique:
        formes = [f.strip() for f in forme_juridique.split(",") if f.strip()]
        if formes:
            filters.append(EntrepriseIntallee.forme_juridique.in_(formes))

    if forme_juridique:
        formes = [f.strip() for f in forme_juridique.split(",") if f.strip()]
        if formes:
            filters.append(EntrepriseIntallee.forme_juridique.in_(formes))

    # Filtres géographie multi-valeurs
    if region_noms:
        noms = [n.strip() for n in region_noms.split(",") if n.strip()]
        if noms:
            filters.append(EntrepriseIntallee.region.in_(noms))
    if departement_noms:
        noms = [n.strip() for n in departement_noms.split(",") if n.strip()]
        if noms:
            filters.append(EntrepriseIntallee.departement.in_(noms))
    if arrondissement_noms:
        noms = [n.strip() for n in arrondissement_noms.split(",") if n.strip()]
        if noms:
            filters.append(EntrepriseIntallee.commune.in_(noms))

    # Filtres NAEMA multi-valeurs
    if secteur_nom:
        noms = [n.strip() for n in secteur_nom.split(",") if n.strip()]
        if noms:
            filters.append(
                EntrepriseIntallee.secteur_id.in_(
                    select(RefSecteur.id).where(RefSecteur.nom.in_(noms))
                )
            )
    if branche_nom:
        noms = [n.strip() for n in branche_nom.split(",") if n.strip()]
        if noms:
            filters.append(
                EntrepriseIntallee.branche_id.in_(
                    select(RefBranche.id).where(RefBranche.nom.in_(noms))
                )
            )
    if activite_nom:
        noms = [n.strip() for n in activite_nom.split(",") if n.strip()]
        if noms:
            filters.append(
                EntrepriseIntallee.activite_id.in_(
                    select(RefActivite.id).where(RefActivite.nom.in_(noms))
                )
            )

    total_q = await db.execute(
        select(func.count()).select_from(EntrepriseIntallee).where(and_(*filters))
    )
    total = total_q.scalar()

    result = await db.execute(
        select(EntrepriseIntallee)
        .options(
            selectinload(EntrepriseIntallee.points_focaux),
            selectinload(EntrepriseIntallee.secteur),
            selectinload(EntrepriseIntallee.branche),
            selectinload(EntrepriseIntallee.activite),
        )
        .where(and_(*filters))
        .order_by(EntrepriseIntallee.nom.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    entreprises = result.scalars().all()

    return EntrepriseListResponse(
        total=total, page=page, per_page=per_page,
        data=[EntrepriseResponse.model_validate(e) for e in entreprises]
    )

@router.post("", response_model=EntrepriseResponse, status_code=201)
async def creer_entreprise(
    payload: EntrepriseCreate,
    db:      AsyncSession = Depends(get_db),
):
    points_focaux_data = payload.points_focaux or []
    data = payload.model_dump(exclude={"points_focaux"})
    entreprise = EntrepriseIntallee(**data)
    db.add(entreprise)
    await db.flush()

    for pf in points_focaux_data:
        focal = EntreprisePointFocal(entreprise_id=entreprise.id, **pf.model_dump())
        db.add(focal)

    await db.flush()
    result = await db.execute(
        select(EntrepriseIntallee)
        .options(
            selectinload(EntrepriseIntallee.points_focaux),
            selectinload(EntrepriseIntallee.secteur),
            selectinload(EntrepriseIntallee.branche),
            selectinload(EntrepriseIntallee.activite),
        )
        .where(EntrepriseIntallee.id == entreprise.id)
    )
    return EntrepriseResponse.model_validate(result.scalar_one())

@router.post("/{entreprise_id}/points-focaux", response_model=PointFocalResponse, status_code=201)
async def ajouter_point_focal(
    entreprise_id: UUID,
    payload:       PointFocalCreate,
    db:            AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EntrepriseIntallee).where(
            EntrepriseIntallee.id == entreprise_id,
            EntrepriseIntallee.is_deleted == False,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
    focal = EntreprisePointFocal(entreprise_id=entreprise_id, **payload.model_dump())
    db.add(focal)
    await db.flush()
    await db.refresh(focal)
    return PointFocalResponse.model_validate(focal)

@router.delete("/{entreprise_id}/points-focaux/{focal_id}", status_code=204)
async def supprimer_point_focal(
    entreprise_id: UUID,
    focal_id:      UUID,
    db:            AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EntreprisePointFocal).where(
            EntreprisePointFocal.id == focal_id,
            EntreprisePointFocal.entreprise_id == entreprise_id,
        )
    )
    focal = result.scalar_one_or_none()
    if not focal:
        raise HTTPException(status_code=404, detail="Point focal introuvable")
    await db.delete(focal)
    await db.flush()


# ── CRUD Branches ─────────────────────────────────────────────────────────────

@router.get("/{entreprise_id}", response_model=EntrepriseResponse)
async def detail_entreprise(
    entreprise_id: UUID,
    db:            AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EntrepriseIntallee)
        .options(
            selectinload(EntrepriseIntallee.points_focaux),
            selectinload(EntrepriseIntallee.secteur),
            selectinload(EntrepriseIntallee.branche),
            selectinload(EntrepriseIntallee.activite),
        )
        .where(EntrepriseIntallee.id == entreprise_id, EntrepriseIntallee.is_deleted == False)
    )
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
    return EntrepriseResponse.model_validate(e)

@router.patch("/{entreprise_id}", response_model=EntrepriseResponse)
async def modifier_entreprise(
    entreprise_id: UUID,
    payload:       EntrepriseUpdate,
    db:            AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EntrepriseIntallee).where(
            EntrepriseIntallee.id == entreprise_id,
            EntrepriseIntallee.is_deleted == False,
        )
    )
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(e, field, value)
    await db.flush()

    # Recharger avec toutes les relations
    result = await db.execute(
        select(EntrepriseIntallee)
        .options(
            selectinload(EntrepriseIntallee.points_focaux),
            selectinload(EntrepriseIntallee.secteur),
            selectinload(EntrepriseIntallee.branche),
            selectinload(EntrepriseIntallee.activite),
        )
        .where(EntrepriseIntallee.id == entreprise_id)
    )
    e = result.scalar_one()
    return EntrepriseResponse.model_validate(e)

@router.delete("/{entreprise_id}", status_code=204)
async def supprimer_entreprise(
    entreprise_id: UUID,
    db:            AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EntrepriseIntallee).where(
            EntrepriseIntallee.id == entreprise_id,
            EntrepriseIntallee.is_deleted == False,
        )
    )
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
    e.is_deleted = True
    await db.flush()


# ── Points focaux ─────────────────────────────────────────────────────────────


# ── CRUD Géographie ───────────────────────────────────────────────────────────

@router.post("/ref/regions", status_code=201)
async def creer_region(payload: dict, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    region = RefRegion(**payload)
    db.add(region)
    await db.flush()
    await db.refresh(region)
    return {"id": region.id, "code": region.code, "nom": region.nom}

@router.patch("/ref/regions/{region_id}")
async def modifier_region(region_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(RefRegion).where(RefRegion.id == region_id))
    r = result.scalar_one_or_none()
    if not r: raise HTTPException(status_code=404, detail="Région introuvable")
    for k, v in payload.items(): setattr(r, k, v)
    await db.flush()
    return {"id": r.id, "code": r.code, "nom": r.nom}

@router.delete("/ref/regions/{region_id}", status_code=204)
async def supprimer_region(region_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(RefRegion).where(RefRegion.id == region_id))
    r = result.scalar_one_or_none()
    if not r: raise HTTPException(status_code=404, detail="Région introuvable")
    await db.delete(r)
    await db.flush()

@router.post("/ref/departements", status_code=201)
async def creer_departement(payload: dict, db: AsyncSession = Depends(get_db)):
    dep = RefDepartement(**payload)
    db.add(dep)
    await db.flush()
    await db.refresh(dep)
    return {"id": dep.id, "code": dep.code, "nom": dep.nom, "region_id": dep.region_id}

@router.patch("/ref/departements/{dep_id}")
async def modifier_departement(dep_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(RefDepartement).where(RefDepartement.id == dep_id))
    d = result.scalar_one_or_none()
    if not d: raise HTTPException(status_code=404, detail="Département introuvable")
    for k, v in payload.items(): setattr(d, k, v)
    await db.flush()
    return {"id": d.id, "code": d.code, "nom": d.nom, "region_id": d.region_id}

@router.delete("/ref/departements/{dep_id}", status_code=204)
async def supprimer_departement(dep_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(RefDepartement).where(RefDepartement.id == dep_id))
    d = result.scalar_one_or_none()
    if not d: raise HTTPException(status_code=404, detail="Département introuvable")
    await db.delete(d)
    await db.flush()

@router.post("/ref/arrondissements", status_code=201)
async def creer_arrondissement(payload: dict, db: AsyncSession = Depends(get_db)):
    arr = RefArrondissement(**payload)
    db.add(arr)
    await db.flush()
    await db.refresh(arr)
    return {"id": arr.id, "code": arr.code, "nom": arr.nom, "departement_id": arr.departement_id}

@router.patch("/ref/arrondissements/{arr_id}")
async def modifier_arrondissement(arr_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(RefArrondissement).where(RefArrondissement.id == arr_id))
    a = result.scalar_one_or_none()
    if not a: raise HTTPException(status_code=404, detail="Arrondissement introuvable")
    for k, v in payload.items(): setattr(a, k, v)
    await db.flush()
    return {"id": a.id, "code": a.code, "nom": a.nom, "departement_id": a.departement_id}

@router.delete("/ref/arrondissements/{arr_id}", status_code=204)
async def supprimer_arrondissement(arr_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(RefArrondissement).where(RefArrondissement.id == arr_id))
    a = result.scalar_one_or_none()
    if not a: raise HTTPException(status_code=404, detail="Arrondissement introuvable")
    await db.delete(a)
    await db.flush()
