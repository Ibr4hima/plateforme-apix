from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List, Any

from app.core.database import get_db
from app.models.entreprise import (
    EntrepriseIntallee, EntreprisePointFocal,
    RefSecteur, RefBranche, RefActivite,
    RefRegion, RefDepartement, RefArrondissement,
)
from app.schemas.entreprise import (
    EntrepriseCreate, EntrepriseUpdate, EntrepriseResponse,
    EntrepriseListResponse, PointFocalCreate, PointFocalResponse,
    RefSecteurResponse, RefBrancheResponse, RefActiviteResponse,
)

router = APIRouter(prefix="/entreprises", tags=["Entreprises installées"])

# Cache en mémoire des refs NAEMA et geo (chargé une fois par requête via db)
def enrich_entreprise(e: EntrepriseIntallee) -> dict:
    """Convertit un objet EntrepriseIntallee en dict pour la réponse."""
    return {
        "id": e.id, "nom": e.nom, "forme_juridique": e.forme_juridique,
        "date_creation": e.date_creation, "pays": e.pays,
        "siege_pays_id": e.siege_pays_id,
        "region_id": e.region_id, "departement_id": e.departement_id, "arrondissement_id": e.arrondissement_id,
        "adresse": e.adresse, "telephone": e.telephone, "mail": e.mail, "siteweb": e.siteweb,
        "secteur_ids": e.secteur_ids or [], "branche_ids": e.branche_ids or [], "activite_ids": e.activite_ids or [],
        "est_publie": e.est_publie,
        "created_at": e.created_at, "updated_at": e.updated_at, "created_by": e.created_by,
        "is_deleted": e.is_deleted,
        "points_focaux": [
            {"id": pf.id, "nom": pf.nom, "prenom": pf.prenom, "civilite": pf.civilite,
             "poste": pf.poste, "telephone": pf.telephone, "mail": pf.mail, "est_principal": pf.est_principal}
            for pf in (e.points_focaux or [])
        ],
        # Champs enrichis résolus via joins (disponibles si selectinload)
        "region_nom": e.region.nom if hasattr(e, "region") and e.region else None,
        "departement_nom": e.departement.nom if hasattr(e, "departement") and e.departement else None,
        "arrondissement_nom": e.arrondissement.nom if hasattr(e, "arrondissement") and e.arrondissement else None,
        "pole_id": e.pole_id,
        "pole_territoire_nom": e.pole.pole_territoire if hasattr(e, "pole") and e.pole else None,
    }


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

from app.models.entreprise import (
    EntrepriseIntallee, EntreprisePointFocal,
    RefSecteur, RefBranche, RefActivite,
    RefRegion, RefDepartement, RefArrondissement,
)
from app.models.shared import RefPays

@router.get("/ref/pays")
async def liste_pays(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(
        select(RefPays).where(RefPays.actif == True).order_by(RefPays.nom_fr)
    )
    pays = result.scalars().all()
    return [{"id": p.id, "code_iso2": p.code_iso2, "nom_fr": p.nom_fr, "continent": p.continent} for p in pays]


# ── Référentiel géographie Sénégal ────────────────────────────────────────────

@router.get("/ref/regions")
async def liste_regions(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(
        select(RefRegion).where(RefRegion.actif == True).order_by(RefRegion.nom)
    )
    return [{"id": r.id, "nom": r.nom} for r in result.scalars().all()]

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
    return [{"id": d.id, "nom": d.nom, "region_id": d.region_id} for d in result.scalars().all()]

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
    return [{"id": a.id, "nom": a.nom, "departement_id": a.departement_id} for a in result.scalars().all()]



@router.get("/ref/poles")
async def liste_poles(db: AsyncSession = Depends(get_db)):
    from app.models.zone_types import PoleTerritoire
    result = await db.execute(select(PoleTerritoire).order_by(PoleTerritoire.pole_territoire))
    return [{"id": p.id, "nom": p.pole_territoire} for p in result.scalars().all()]

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
    per_page:     int           = Query(12, ge=1, le=500),
    region:       Optional[str] = None,
    pays:         Optional[str] = None,
    search:       Optional[str] = None,
    nom_list:     List[str]     = Query(default=[]),
    forme_juridique_list: List[str] = Query(default=[], alias="forme_juridique"),
    region_list:          List[str] = Query(default=[], alias="region_noms"),
    departement_list:     List[str] = Query(default=[], alias="departement_noms"),
    arrondissement_list:  List[str] = Query(default=[], alias="arrondissement_noms"),
    secteur_list:         List[str] = Query(default=[], alias="secteur_nom"),
    branche_list:         List[str] = Query(default=[], alias="branche_nom"),
    activite_list:        List[str] = Query(default=[], alias="activite_nom"),
    admin:                bool      = Query(False),
    db:           AsyncSession  = Depends(get_db),
):
    from sqlalchemy import any_ as sa_any
    filters = [] if admin else [EntrepriseIntallee.est_publie == True, EntrepriseIntallee.is_deleted == False]
    if region:  filters.append(EntrepriseIntallee.region_id.in_(select(RefRegion.id).where(RefRegion.nom.ilike(f"%{region}%"))))
    if pays:    filters.append(EntrepriseIntallee.pays.ilike(f"%{pays}%"))
    if search:
        filters.append(or_(EntrepriseIntallee.nom.ilike(f"%{search}%"), EntrepriseIntallee.mail.ilike(f"%{search}%"), EntrepriseIntallee.adresse.ilike(f"%{search}%")))
    if nom_list:              filters.append(or_(*[EntrepriseIntallee.nom == n for n in nom_list]))
    if forme_juridique_list:  filters.append(or_(*[EntrepriseIntallee.forme_juridique == f for f in forme_juridique_list]))
    if region_list:           filters.append(EntrepriseIntallee.region_id.in_(select(RefRegion.id).where(or_(*[RefRegion.nom == r for r in region_list]))))
    if departement_list:      filters.append(EntrepriseIntallee.departement_id.in_(select(RefDepartement.id).where(or_(*[RefDepartement.nom == d for d in departement_list]))))
    if arrondissement_list:   filters.append(EntrepriseIntallee.arrondissement_id.in_(select(RefArrondissement.id).where(or_(*[RefArrondissement.nom == a for a in arrondissement_list]))))
    # NAEMA via ARRAY — on cherche si l'ID est dans le tableau
    if secteur_list:
        ids = (await db.execute(select(RefSecteur.id).where(or_(*[RefSecteur.nom == n for n in secteur_list])))).scalars().all()
        if ids: filters.append(or_(*[EntrepriseIntallee.secteur_ids.any(id) for id in ids]))
    if branche_list:
        ids = (await db.execute(select(RefBranche.id).where(or_(*[RefBranche.nom == n for n in branche_list])))).scalars().all()
        if ids: filters.append(or_(*[EntrepriseIntallee.branche_ids.any(id) for id in ids]))
    if activite_list:
        ids = (await db.execute(select(RefActivite.id).where(or_(*[RefActivite.nom == n for n in activite_list])))).scalars().all()
        if ids: filters.append(or_(*[EntrepriseIntallee.activite_ids.any(id) for id in ids]))

    total = (await db.execute(select(func.count()).select_from(EntrepriseIntallee).where(and_(*filters)))).scalar()
    result = await db.execute(
        select(EntrepriseIntallee)
        .options(selectinload(EntrepriseIntallee.points_focaux))
        .where(and_(*filters))
        .order_by(EntrepriseIntallee.nom.asc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    entreprises = result.scalars().all()
    return EntrepriseListResponse(total=total, page=page, per_page=per_page, data=[enrich_entreprise(e) for e in entreprises])

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
        .options(selectinload(EntrepriseIntallee.points_focaux))
        .where(EntrepriseIntallee.id == entreprise.id)
    )
    e2 = (await db.execute(select(EntrepriseIntallee).options(selectinload(EntrepriseIntallee.points_focaux)).where(EntrepriseIntallee.id == entreprise.id))).scalar_one()
    return enrich_entreprise(e2)

@router.post("/{entreprise_id}/points-focaux", response_model=PointFocalResponse, status_code=201)
async def ajouter_point_focal(
    entreprise_id: UUID,
    payload:       PointFocalCreate,
    db:            AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EntrepriseIntallee).where(
            EntrepriseIntallee.id == entreprise_id,
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
    entreprise_id: int,
    focal_id:      int,
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
    entreprise_id: int,
    db:            AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EntrepriseIntallee)
        .options(selectinload(EntrepriseIntallee.points_focaux))
        .where(EntrepriseIntallee.id == entreprise_id)
    )
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
    return enrich_entreprise(e)

@router.patch("/{entreprise_id}", response_model=EntrepriseResponse)
async def modifier_entreprise(
    entreprise_id: int,
    payload:       EntrepriseUpdate,
    db:            AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EntrepriseIntallee).where(
            EntrepriseIntallee.id == entreprise_id,
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
        .options(selectinload(EntrepriseIntallee.points_focaux))
        .where(EntrepriseIntallee.id == entreprise_id)
    )
    e = result.scalar_one()
    return enrich_entreprise(e)

@router.delete("/{entreprise_id}", status_code=204)
async def supprimer_entreprise(
    entreprise_id: int,
    db:            AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EntrepriseIntallee).where(
            EntrepriseIntallee.id == entreprise_id,
            )
    )
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
    await db.delete(e)
    await db.flush()


# ── Points focaux ─────────────────────────────────────────────────────────────


# ── CRUD Géographie ───────────────────────────────────────────────────────────

@router.post("/ref/regions", status_code=201)
async def creer_region(payload: dict, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    region = RefRegion(nom=payload["nom"])
    db.add(region)
    await db.flush()
    await db.refresh(region)
    return {"id": region.id, "nom": region.nom}

@router.patch("/ref/regions/{region_id}")
async def modifier_region(region_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(RefRegion).where(RefRegion.id == region_id))
    r = result.scalar_one_or_none()
    if not r: raise HTTPException(status_code=404, detail="Région introuvable")
    if "nom" in payload: r.nom = payload["nom"]
    await db.flush()
    return {"id": r.id, "nom": r.nom}

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
    dep = RefDepartement(nom=payload["nom"], region_id=payload["region_id"])
    db.add(dep)
    await db.flush()
    await db.refresh(dep)
    return {"id": dep.id, "nom": dep.nom, "region_id": dep.region_id}

@router.patch("/ref/departements/{dep_id}")
async def modifier_departement(dep_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(RefDepartement).where(RefDepartement.id == dep_id))
    d = result.scalar_one_or_none()
    if not d: raise HTTPException(status_code=404, detail="Département introuvable")
    if "nom" in payload: d.nom = payload["nom"]
    await db.flush()
    return {"id": d.id, "nom": d.nom, "region_id": d.region_id}

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
    arr = RefArrondissement(nom=payload["nom"], departement_id=payload["departement_id"])
    db.add(arr)
    await db.flush()
    await db.refresh(arr)
    return {"id": arr.id, "nom": arr.nom, "departement_id": arr.departement_id}

@router.post("/ref/arrondissements/bulk", status_code=201)
async def importer_arrondissements_bulk(payload: List[Any], db: AsyncSession = Depends(get_db)):
    """
    payload: [{ departement_id: int, noms: [str] }, ...]
    Insère tous les arrondissements listés pour chaque département.
    Ignore les noms vides ou déjà existants.
    """
    from sqlalchemy import select
    total = 0
    for item in payload:
        dep_id = item.get("departement_id")
        noms   = [n.strip() for n in (item.get("noms") or []) if n.strip()]
        if not dep_id or not noms:
            continue
        # Noms déjà présents pour ce département
        existing = set((await db.execute(
            select(RefArrondissement.nom).where(RefArrondissement.departement_id == dep_id)
        )).scalars().all())
        for nom in noms:
            if nom not in existing:
                db.add(RefArrondissement(departement_id=dep_id, nom=nom))
                existing.add(nom)
                total += 1
    await db.flush()
    return {"created": total}

@router.patch("/ref/arrondissements/{arr_id}")
async def modifier_arrondissement(arr_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(RefArrondissement).where(RefArrondissement.id == arr_id))
    a = result.scalar_one_or_none()
    if not a: raise HTTPException(status_code=404, detail="Arrondissement introuvable")
    if "nom" in payload: a.nom = payload["nom"]
    await db.flush()
    return {"id": a.id, "nom": a.nom, "departement_id": a.departement_id}

@router.delete("/ref/arrondissements/{arr_id}", status_code=204)
async def supprimer_arrondissement(arr_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(RefArrondissement).where(RefArrondissement.id == arr_id))
    a = result.scalar_one_or_none()
    if not a: raise HTTPException(status_code=404, detail="Arrondissement introuvable")
    await db.delete(a)
    await db.flush()


@router.get("/{entreprise_id}", response_model=EntrepriseResponse)
async def get_entreprise(entreprise_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EntrepriseIntallee)
        .options(selectinload(EntrepriseIntallee.points_focaux))
        .where(EntrepriseIntallee.id == entreprise_id, EntrepriseIntallee.is_deleted == False)
    )
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
    return enrich_entreprise(e)
