import os, shutil, uuid as uuid_lib
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID

from app.core.database import get_db
from app.models.zone_types import (
    ZoneZES, ZoneZESFichier, ZoneZESEntreprise,
    ZoneZAI, ZoneZAIFichier, ZoneZAIEntreprise,
    ZoneZFI, ZoneZFIFichier, ZoneZFIEntreprise,
    PoleTerritoire,
)
from app.models.entreprise import EntrepriseIntallee, RefSecteur, RefBranche, RefActivite, RefRegion, RefDepartement, RefArrondissement

router = APIRouter(prefix="/zones-types", tags=["Zones ZES/ZAI/ZFI"])

# ── GET /zones-types/poles ────────────────────────────────────────────────────
@router.get("/poles")
async def liste_poles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PoleTerritoire).order_by(PoleTerritoire.id))
    poles = result.scalars().all()
    return [
        {
            "id":              p.id,
            "pole_territoire": p.pole_territoire,
            "localisation":    p.localisation,
            "region_ids":      p.region_ids or [],
            "description":     p.description,
        }
        for p in poles
    ]

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/zones_types")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Config par type ────────────────────────────────────────────────────────────
TYPE_CONFIG = {
    "ZES": {"model": ZoneZES, "fichier": ZoneZESFichier, "ent": ZoneZESEntreprise, "prefix": "ZES"},
    "ZAI": {"model": ZoneZAI, "fichier": ZoneZAIFichier, "ent": ZoneZAIEntreprise, "prefix": "ZAI"},
    "ZFI": {"model": ZoneZFI, "fichier": ZoneZFIFichier, "ent": ZoneZFIEntreprise, "prefix": "ZFI"},
}

ENT_LOAD_OPTS = [
    selectinload(EntrepriseIntallee.secteur),
    selectinload(EntrepriseIntallee.branche),
    selectinload(EntrepriseIntallee.activite),
    selectinload(EntrepriseIntallee.region_obj),
    selectinload(EntrepriseIntallee.departement_obj),
    selectinload(EntrepriseIntallee.siege_pays_obj),
    selectinload(EntrepriseIntallee.points_focaux),
]


def get_load_opts(cfg: dict):
    ZoneEnt = cfg["ent"]
    return [
        selectinload(cfg["model"].fichiers),
        selectinload(cfg["model"].entreprises).selectinload(ZoneEnt.entreprise).options(*ENT_LOAD_OPTS),
    ]


def ent_to_dict(e: EntrepriseIntallee) -> dict:
    return {
        "id":               str(e.id),
        "nom":              e.nom,
        "forme_juridique":  e.forme_juridique,
        "date_creation":    e.date_creation.isoformat() if e.date_creation else None,
        "statut":           e.statut,
        "pays":             e.pays,
        "adresse":          e.adresse,
        "telephone":        e.telephone,
        "mail":             e.mail,
        "siteweb":          e.siteweb,
        "secteur":          {"id": e.secteur.id, "nom": e.secteur.nom} if e.secteur else None,
        "branche":          {"id": e.branche.id, "nom": e.branche.nom} if e.branche else None,
        "activite":         {"id": e.activite.id, "nom": e.activite.nom} if e.activite else None,
        "region_nom":       e.region_obj.nom if e.region_obj else None,
        "departement_nom":  e.departement_obj.nom if e.departement_obj else None,
        "siege_pays_nom":   e.siege_pays_obj.nom_fr if e.siege_pays_obj else None,
        "points_focaux": [
            {"nom": pf.nom, "prenom": pf.prenom, "poste": pf.poste, "telephone": pf.telephone, "mail": pf.mail, "est_principal": pf.est_principal}
            for pf in (e.points_focaux or [])
        ],
    }


async def get_geo_noms(zones: list, db: AsyncSession) -> dict:
    noms: dict = {}
    r_ids = {z.region_id for z in zones if z.region_id}
    d_ids = {z.departement_id for z in zones if z.departement_id}
    a_ids = {z.arrondissement_id for z in zones if z.arrondissement_id}
    if r_ids:
        res = await db.execute(select(RefRegion).where(RefRegion.id.in_(r_ids)))
        for r in res.scalars(): noms[f"r_{r.id}"] = r.nom
    if d_ids:
        res = await db.execute(select(RefDepartement).where(RefDepartement.id.in_(d_ids)))
        for d in res.scalars(): noms[f"d_{d.id}"] = d.nom
    if a_ids:
        res = await db.execute(select(RefArrondissement).where(RefArrondissement.id.in_(a_ids)))
        for a in res.scalars(): noms[f"a_{a.id}"] = a.nom
    return noms


async def get_pole_noms(zones: list, db: AsyncSession) -> dict:
    pole_ids = {z.pole_id for z in zones if z.pole_id}
    if not pole_ids:
        return {}
    result = await db.execute(select(PoleTerritoire).where(PoleTerritoire.id.in_(pole_ids)))
    return {p.id: p.pole_territoire for p in result.scalars()}


def zone_to_dict(z, geo_noms: dict, pole_noms: dict = {}) -> dict:
    return {
        "id":               z.id,
        "nom_zone":         z.nom_zone,
        "type_zone":        z.id[:3],
        "pole_id":          z.pole_id,
        "pole_nom":         pole_noms.get(z.pole_id),
        "description":      z.description,
        "region_id":        z.region_id,
        "departement_id":   z.departement_id,
        "arrondissement_id":z.arrondissement_id,
        "secteur_id":       z.secteur_id,
        "branche_id":       z.branche_id,
        "activite_id":      z.activite_id,
        "region_nom":          geo_noms.get(f"r_{z.region_id}"),
        "departement_nom":     geo_noms.get(f"d_{z.departement_id}"),
        "arrondissement_nom":  geo_noms.get(f"a_{z.arrondissement_id}"),
        "created_at":       z.created_at.isoformat() if z.created_at else None,
        "entreprises": [
            {
                "id":           str(ze.id),
                "entreprise_id":str(ze.entreprise_id),
                "entreprise":   ent_to_dict(ze.entreprise) if ze.entreprise else None,
            }
            for ze in (z.entreprises or [])
        ],
        "fichiers": [
            {"id": str(f.id), "titre": f.titre, "fichier_nom": f.fichier_nom}
            for f in (z.fichiers or [])
        ],
    }


# ── GET /zones-types?type_zone=ZES ────────────────────────────────────────────
@router.get("")
async def liste_zones(type_zone: str = Query(...), db: AsyncSession = Depends(get_db)):
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")
    Model = cfg["model"]
    opts  = get_load_opts(cfg)
    result = await db.execute(
        select(Model).options(*opts).where(Model.is_deleted == False).order_by(Model.nom_zone)
    )
    zones = result.scalars().all()
    geo_noms = await get_geo_noms(zones, db)
    pole_noms = await get_pole_noms(zones, db)
    return [zone_to_dict(z, geo_noms, pole_noms) for z in zones]


# ── POST /zones-types ──────────────────────────────────────────────────────────
@router.post("", status_code=201)
async def creer_zone(
    type_zone:        str           = Form(...),
    nom_zone:         str           = Form(...),
    pole_id:          Optional[int] = Form(None),
    description:      Optional[str] = Form(None),
    region_id:        Optional[int] = Form(None),
    departement_id:   Optional[int] = Form(None),
    arrondissement_id:Optional[int] = Form(None),
    secteur_id:       Optional[int] = Form(None),
    branche_id:       Optional[int] = Form(None),
    activite_id:      Optional[int] = Form(None),
    db:               AsyncSession  = Depends(get_db),
):
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")

    # Insérer via SQL brut pour contourner la limitation SQLAlchemy avec les triggers
    from sqlalchemy import text
    await db.execute(text(f"""
        INSERT INTO {cfg['model'].__tablename__}
            (id, nom_zone, pole_id, description, region_id, departement_id, arrondissement_id,
             secteur_id, branche_id, activite_id)
        VALUES
            ('', :nom_zone, :pole_id, :description, :region_id, :departement_id, :arrondissement_id,
             :secteur_id, :branche_id, :activite_id)
    """), {
        "nom_zone": nom_zone, "pole_id": pole_id, "description": description,
        "region_id": region_id, "departement_id": departement_id,
        "arrondissement_id": arrondissement_id,
        "secteur_id": secteur_id, "branche_id": branche_id, "activite_id": activite_id,
    })
    await db.flush()

    # Récupérer la zone créée (dernière insérée pour ce type)
    last = await db.execute(
        select(cfg["model"]).where(cfg["model"].is_deleted == False)
        .order_by(cfg["model"].created_at.desc()).limit(1)
    )
    z = last.scalar_one()
    result = await db.execute(select(cfg["model"]).options(*get_load_opts(cfg)).where(cfg["model"].id == z.id))
    zone = result.scalar_one()
    geo_noms = await get_geo_noms([zone], db)
    pole_noms = await get_pole_noms([zone], db)
    return zone_to_dict(zone, geo_noms, pole_noms)


# ── PATCH /zones-types/:id ────────────────────────────────────────────────────
@router.patch("/{zone_id}")
async def modifier_zone(
    zone_id:          str,
    nom_zone:         Optional[str] = Form(None),
    pole_id:          Optional[int] = Form(None),
    description:      Optional[str] = Form(None),
    region_id:        Optional[int] = Form(None),
    departement_id:   Optional[int] = Form(None),
    arrondissement_id:Optional[int] = Form(None),
    secteur_id:       Optional[int] = Form(None),
    branche_id:       Optional[int] = Form(None),
    activite_id:      Optional[int] = Form(None),
    db:               AsyncSession  = Depends(get_db),
):
    type_zone = zone_id[:3]
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")
    Model = cfg["model"]

    result = await db.execute(select(Model).where(Model.id == zone_id, Model.is_deleted == False))
    z = result.scalar_one_or_none()
    if not z: raise HTTPException(404, "Zone introuvable")

    if nom_zone         is not None: z.nom_zone         = nom_zone
    if pole_id          is not None: z.pole_id          = pole_id
    if description      is not None: z.description      = description
    if region_id        is not None: z.region_id        = region_id
    if departement_id   is not None: z.departement_id   = departement_id
    if arrondissement_id is not None: z.arrondissement_id = arrondissement_id
    if secteur_id       is not None: z.secteur_id       = secteur_id
    if branche_id       is not None: z.branche_id       = branche_id
    if activite_id      is not None: z.activite_id      = activite_id

    await db.flush()
    result = await db.execute(select(Model).options(*get_load_opts(cfg)).where(Model.id == zone_id))
    zone = result.scalar_one()
    geo_noms = await get_geo_noms([zone], db)
    pole_noms = await get_pole_noms([zone], db)
    return zone_to_dict(zone, geo_noms, pole_noms)


# ── DELETE /zones-types/:id (suppression physique) ────────────────────────────
@router.delete("/{zone_id}", status_code=204)
async def supprimer_zone(zone_id: str, db: AsyncSession = Depends(get_db)):
    type_zone = zone_id[:3]
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")
    result = await db.execute(
        select(cfg["model"]).options(*get_load_opts(cfg)).where(cfg["model"].id == zone_id)
    )
    z = result.scalar_one_or_none()
    if not z: raise HTTPException(404, "Zone introuvable")
    # Supprimer les fichiers physiques
    for f in z.fichiers:
        if f.fichier_path and os.path.exists(f.fichier_path):
            os.remove(f.fichier_path)
    await db.delete(z)
    await db.flush()


# ── POST /zones-types/:id/entreprises ─────────────────────────────────────────
@router.post("/{zone_id}/entreprises", status_code=201)
async def ajouter_entreprise(
    zone_id:      str,
    entreprise_id:UUID,
    db:           AsyncSession = Depends(get_db),
):
    type_zone = zone_id[:3]
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")
    ze = cfg["ent"](zone_id=zone_id, entreprise_id=entreprise_id)
    db.add(ze)
    await db.flush()
    return {"id": str(ze.id)}


# ── DELETE /zones-types/:id/entreprises/:ze_id ────────────────────────────────
@router.delete("/{zone_id}/entreprises/{ze_id}", status_code=204)
async def retirer_entreprise(zone_id: str, ze_id: UUID, db: AsyncSession = Depends(get_db)):
    type_zone = zone_id[:3]
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")
    ZoneEnt = cfg["ent"]
    result = await db.execute(select(ZoneEnt).where(ZoneEnt.id == ze_id, ZoneEnt.zone_id == zone_id))
    ze = result.scalar_one_or_none()
    if not ze: raise HTTPException(404, "Association introuvable")
    await db.delete(ze)
    await db.flush()


# ── POST /zones-types/:id/fichiers ────────────────────────────────────────────
@router.post("/{zone_id}/fichiers", status_code=201)
async def ajouter_fichier(
    zone_id: str,
    titre:   str        = Form(""),
    fichier: UploadFile = File(...),
    db:      AsyncSession = Depends(get_db),
):
    type_zone = zone_id[:3]
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")
    ext = os.path.splitext(fichier.filename)[1].lower()
    if ext != ".pdf": raise HTTPException(422, "PDF uniquement")
    unique_name = f"{uuid_lib.uuid4()}{ext}"
    dest = os.path.join(UPLOAD_DIR, unique_name)
    with open(dest, "wb") as f:
        shutil.copyfileobj(fichier.file, f)
    zf = cfg["fichier"](zone_id=zone_id, titre=titre or fichier.filename, fichier_nom=fichier.filename, fichier_path=dest)
    db.add(zf)
    await db.flush()
    return {"id": str(zf.id), "titre": zf.titre, "fichier_nom": zf.fichier_nom}


# ── DELETE /zones-types/:id/fichiers/:fid ─────────────────────────────────────
@router.delete("/{zone_id}/fichiers/{fichier_id}", status_code=204)
async def supprimer_fichier(zone_id: str, fichier_id: UUID, db: AsyncSession = Depends(get_db)):
    type_zone = zone_id[:3]
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")
    ZoneFich = cfg["fichier"]
    result = await db.execute(select(ZoneFich).where(ZoneFich.id == fichier_id, ZoneFich.zone_id == zone_id))
    zf = result.scalar_one_or_none()
    if not zf: raise HTTPException(404, "Fichier introuvable")
    if zf.fichier_path and os.path.exists(zf.fichier_path):
        os.remove(zf.fichier_path)
    await db.delete(zf)
    await db.flush()


# ── GET /zones-types/:id/fichiers/:fid/download ───────────────────────────────
@router.get("/{zone_id}/fichiers/{fichier_id}/download")
async def telecharger_fichier(zone_id: str, fichier_id: UUID, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import FileResponse
    type_zone = zone_id[:3]
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")
    ZoneFich = cfg["fichier"]
    result = await db.execute(select(ZoneFich).where(ZoneFich.id == fichier_id, ZoneFich.zone_id == zone_id))
    zf = result.scalar_one_or_none()
    if not zf or not zf.fichier_path: raise HTTPException(404, "Fichier introuvable")
    return FileResponse(zf.fichier_path, filename=zf.fichier_nom, media_type="application/pdf")
