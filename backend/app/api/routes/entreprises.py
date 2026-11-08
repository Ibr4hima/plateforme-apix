from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List, Any

from app.core.database import get_db
from app.core.cache import en_cache
from app.core.auth import require_admin
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
        "siege_pays_nom": e.siege_pays_obj.nom_fr if getattr(e, "siege_pays_obj", None) else None,
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
@en_cache("referentiels")
async def liste_secteurs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefSecteur).where(RefSecteur.actif == True).order_by(RefSecteur.code))
    return [RefSecteurResponse.model_validate(s) for s in result.scalars().all()]

@router.get("/ref/branches", response_model=list[RefBrancheResponse])
@en_cache("referentiels")
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
@en_cache("referentiels")
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
@en_cache("referentiels")
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
async def modifier_branche(branche_id: int, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
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
async def supprimer_branche(branche_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    result = await db.execute(select(RefBranche).where(RefBranche.id == branche_id))
    branche = result.scalar_one_or_none()
    if not branche:
        raise HTTPException(status_code=404, detail="Branche introuvable")
    await db.delete(branche)
    await db.flush()


# ── CRUD Activités ────────────────────────────────────────────────────────────

@router.patch("/ref/activites/{activite_id}", response_model=RefActiviteResponse)
async def modifier_activite(activite_id: int, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
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
async def supprimer_activite(activite_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
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
@en_cache("referentiels")
async def liste_pays(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(
        select(RefPays).where(RefPays.actif == True).order_by(RefPays.nom_fr)
    )
    pays = result.scalars().all()
    return [{"id": p.id, "code_iso2": p.code_iso2, "nom_fr": p.nom_fr, "continent": p.continent} for p in pays]


# ── Référentiel géographie Sénégal ────────────────────────────────────────────

@router.get("/ref/regions")
@en_cache("referentiels")
async def liste_regions(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(
        select(RefRegion).where(RefRegion.actif == True).order_by(RefRegion.nom)
    )
    return [{"id": r.id, "nom": r.nom} for r in result.scalars().all()]

@router.get("/ref/departements")
@en_cache("referentiels")
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
@en_cache("referentiels")
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
@en_cache("referentiels")
async def liste_poles(db: AsyncSession = Depends(get_db)):
    from app.models.zone_types import PoleTerritoire
    result = await db.execute(select(PoleTerritoire).order_by(PoleTerritoire.pole_territoire))
    return [{"id": p.id, "nom": p.pole_territoire} for p in result.scalars().all()]

@router.post("/ref/branches", response_model=RefBrancheResponse, status_code=201)
async def creer_branche(payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    branche = RefBranche(**payload)
    db.add(branche)
    await db.flush()
    await db.refresh(branche)
    return RefBrancheResponse.model_validate(branche)

@router.post("/ref/activites", response_model=RefActiviteResponse, status_code=201)
async def creer_activite(payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
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
    pole_id:              Optional[int] = Query(None),
    db:           AsyncSession  = Depends(get_db),
):
    from sqlalchemy import any_ as sa_any
    filters = [] if admin else [EntrepriseIntallee.est_publie == True, EntrepriseIntallee.is_deleted == False]
    if pole_id:  filters.append(EntrepriseIntallee.pole_id == pole_id)
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
        # L'identifiant départage les homonymes, sans quoi ils pouvaient
        # passer d'une page à l'autre
        .order_by(EntrepriseIntallee.nom.asc(), EntrepriseIntallee.id.asc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    entreprises = result.scalars().all()
    return EntrepriseListResponse(total=total, page=page, per_page=per_page, data=[enrich_entreprise(e) for e in entreprises])


# ── GET /entreprises/cartes — l'annuaire, une page de cartes à la fois ────────
# La page Entreprises aspirait l'annuaire entier, cent fiches par requête avec
# leurs points focaux : à 12 000 entreprises, 109 requêtes et 10 Mo
# (perf/RESULTATS-2026-11-07.md). Les cartes n'affichent que le nom, la forme
# juridique, le pôle, la date de création et la région ; filtres, recherche et
# tri s'appliquent ici, et la fiche complète se demande à l'ouverture
# (GET /entreprises/{id}).
def _liste_ids(valeur: Optional[str]) -> list[int]:
    return [int(x) for x in (valeur or "").split(",") if x.strip().isdigit()]


@router.get("/cartes")
async def cartes_entreprises(
    q: Optional[str] = Query(None),
    formes: List[str] = Query(default=[], description="formes juridiques, une par paramètre"),
    secteurs: Optional[str] = Query(None),
    branches: Optional[str] = Query(None),
    activites: Optional[str] = Query(None),
    regions: Optional[str] = Query(None),
    departements: Optional[str] = Query(None),
    arrondissements: Optional[str] = Query(None),
    poles: Optional[str] = Query(None),
    annee_min: Optional[int] = Query(None),
    annee_max: Optional[int] = Query(None),
    tri: str = Query("desc", pattern="^(asc|desc|nom)$"),
    admin: bool = Query(False, description="l'administration : publiées ou non, recherche de ses cartes"),
    page: int = Query(1, ge=1),
    par_page: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text
    # L'administration voit tout, comme sa liste complète (GET /entreprises?admin=true)
    conds = ["true"] if admin else ["e.est_publie = true", "e.is_deleted = false"]
    params: dict = {}
    if q and q.strip():
        # La recherche de chaque page : nom, forme juridique et adresse pour
        # l'annuaire ; ce que montre la carte (nom, pôle, région, forme) pour
        # l'administration
        conds.append("(e.nom ILIKE :q OR pt.pole_territoire ILIKE :q OR r.nom ILIKE :q OR e.forme_juridique ILIKE :q)"
                     if admin else "(e.nom ILIKE :q OR e.forme_juridique ILIKE :q OR e.adresse ILIKE :q)")
        params["q"] = f"%{q.strip()}%"
    if formes:
        conds.append("e.forme_juridique = ANY(:formes)")
        params["formes"] = formes
    for nom, valeur, condition in (
        ("regions", regions, "e.region_id = ANY(:regions)"),
        ("departements", departements, "e.departement_id = ANY(:departements)"),
        ("arrondissements", arrondissements, "e.arrondissement_id = ANY(:arrondissements)"),
        ("poles", poles, "e.pole_id = ANY(:poles)"),
        ("secteurs", secteurs, "e.secteur_ids && CAST(:secteurs AS integer[])"),
        ("branches", branches, "e.branche_ids && CAST(:branches AS integer[])"),
        ("activites", activites, "e.activite_ids && CAST(:activites AS integer[])"),
    ):
        if ids := _liste_ids(valeur):
            conds.append(condition)
            params[nom] = ids
    # Les années de création ; une entreprise sans date reste affichée
    if annee_min is not None:
        conds.append("(e.date_creation IS NULL OR EXTRACT(YEAR FROM e.date_creation) >= :annee_min)")
        params["annee_min"] = annee_min
    if annee_max is not None:
        conds.append("(e.date_creation IS NULL OR EXTRACT(YEAR FROM e.date_creation) <= :annee_max)")
        params["annee_max"] = annee_max
    where = " AND ".join(conds)
    jointures = """
          FROM entreprises_installees e
          LEFT JOIN poles_territoires pt ON pt.id = e.pole_id
          LEFT JOIN ref_regions r ON r.id = e.region_id"""
    total = (await db.execute(text(f"SELECT count(*) {jointures} WHERE {where}"), params)).scalar_one()
    # Par date de création, les entreprises sans date en fin de liste ; à date
    # égale, par nom. L'administration range par nom.
    ordre = ("e.nom ASC, e.id ASC" if tri == "nom"
             else f"e.date_creation {'ASC' if tri == 'asc' else 'DESC'} NULLS LAST, e.nom ASC, e.id ASC")
    lignes = (await db.execute(text(f"""
        SELECT e.id, e.nom, e.forme_juridique, e.date_creation, pt.pole_territoire AS pole_territoire_nom,
               r.nom AS region_nom, e.est_publie
          {jointures}
         WHERE {where}
         ORDER BY {ordre}
         LIMIT :n OFFSET :o"""), {**params, "n": par_page, "o": (page - 1) * par_page})).mappings().all()
    return {
        "data": [{**r, "date_creation": r["date_creation"].isoformat() if r["date_creation"] else None} for r in lignes],
        "total": total, "page": page, "par_page": par_page,
        "pages": max(1, -(-total // par_page)),
    }


@router.get("/facettes")
async def facettes_entreprises(db: AsyncSession = Depends(get_db)):
    """Ce que la page affiche hors des cartes : le nombre d'entreprises
    publiées et la plage des années de création, bornes du curseur."""
    from sqlalchemy import text
    r = (await db.execute(text("""
        SELECT count(*), min(EXTRACT(YEAR FROM date_creation))::int, max(EXTRACT(YEAR FROM date_creation))::int
          FROM entreprises_installees WHERE est_publie = true AND is_deleted = false"""))).one()
    return {"total": r[0], "annee_min": r[1], "annee_max": r[2]}

@router.post("", response_model=EntrepriseResponse, status_code=201)
async def creer_entreprise(
    payload: EntrepriseCreate,
    db:      AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
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
    current_user: dict = Depends(require_admin),
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
    current_user: dict = Depends(require_admin),
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
        .where(EntrepriseIntallee.id == entreprise_id, EntrepriseIntallee.is_deleted == False)
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
    current_user: dict = Depends(require_admin),
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
    current_user: dict = Depends(require_admin),
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
async def creer_region(payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from sqlalchemy import select
    region = RefRegion(nom=payload["nom"])
    db.add(region)
    await db.flush()
    await db.refresh(region)
    return {"id": region.id, "nom": region.nom}

@router.patch("/ref/regions/{region_id}")
async def modifier_region(region_id: int, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from sqlalchemy import select
    result = await db.execute(select(RefRegion).where(RefRegion.id == region_id))
    r = result.scalar_one_or_none()
    if not r: raise HTTPException(status_code=404, detail="Région introuvable")
    if "nom" in payload: r.nom = payload["nom"]
    await db.flush()
    return {"id": r.id, "nom": r.nom}

@router.delete("/ref/regions/{region_id}", status_code=204)
async def supprimer_region(region_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from sqlalchemy import select
    result = await db.execute(select(RefRegion).where(RefRegion.id == region_id))
    r = result.scalar_one_or_none()
    if not r: raise HTTPException(status_code=404, detail="Région introuvable")
    await db.delete(r)
    await db.flush()

@router.post("/ref/departements", status_code=201)
async def creer_departement(payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    dep = RefDepartement(nom=payload["nom"], region_id=payload["region_id"])
    db.add(dep)
    await db.flush()
    await db.refresh(dep)
    return {"id": dep.id, "nom": dep.nom, "region_id": dep.region_id}

@router.patch("/ref/departements/{dep_id}")
async def modifier_departement(dep_id: int, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from sqlalchemy import select
    result = await db.execute(select(RefDepartement).where(RefDepartement.id == dep_id))
    d = result.scalar_one_or_none()
    if not d: raise HTTPException(status_code=404, detail="Département introuvable")
    if "nom" in payload: d.nom = payload["nom"]
    await db.flush()
    return {"id": d.id, "nom": d.nom, "region_id": d.region_id}

@router.delete("/ref/departements/{dep_id}", status_code=204)
async def supprimer_departement(dep_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from sqlalchemy import select
    result = await db.execute(select(RefDepartement).where(RefDepartement.id == dep_id))
    d = result.scalar_one_or_none()
    if not d: raise HTTPException(status_code=404, detail="Département introuvable")
    await db.delete(d)
    await db.flush()

@router.post("/ref/arrondissements", status_code=201)
async def creer_arrondissement(payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    arr = RefArrondissement(nom=payload["nom"], departement_id=payload["departement_id"])
    db.add(arr)
    await db.flush()
    await db.refresh(arr)
    return {"id": arr.id, "nom": arr.nom, "departement_id": arr.departement_id}

@router.post("/ref/arrondissements/bulk", status_code=201)
async def importer_arrondissements_bulk(payload: List[Any], db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
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
async def modifier_arrondissement(arr_id: int, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from sqlalchemy import select
    result = await db.execute(select(RefArrondissement).where(RefArrondissement.id == arr_id))
    a = result.scalar_one_or_none()
    if not a: raise HTTPException(status_code=404, detail="Arrondissement introuvable")
    if "nom" in payload: a.nom = payload["nom"]
    await db.flush()
    return {"id": a.id, "nom": a.nom, "departement_id": a.departement_id}

@router.delete("/ref/arrondissements/{arr_id}", status_code=204)
async def supprimer_arrondissement(arr_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from sqlalchemy import select
    result = await db.execute(select(RefArrondissement).where(RefArrondissement.id == arr_id))
    a = result.scalar_one_or_none()
    if not a: raise HTTPException(status_code=404, detail="Arrondissement introuvable")
    await db.delete(a)
    await db.flush()

