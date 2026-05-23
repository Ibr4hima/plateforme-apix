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


def pole_to_dict(p: PoleTerritoire) -> dict:
    return {
        "id":              p.id,
        "pole_territoire": p.pole_territoire,
        "localisation":    p.localisation,
        "region_ids":      p.region_ids or [],
        "description":     p.description,
    }


# ── POST /zones-types/poles ───────────────────────────────────────────────────
@router.post("/poles", status_code=201)
async def creer_pole(payload: dict, db: AsyncSession = Depends(get_db)):
    from app.models.entreprise import RefRegion
    nom = payload.get("pole_territoire", "").strip()
    if not nom: raise HTTPException(422, "Le nom du pôle est obligatoire")
    region_ids = payload.get("region_ids", [])
    description = payload.get("description") or None
    # Construire le libellé localisation depuis les noms des régions
    if region_ids:
        res = await db.execute(select(RefRegion).where(RefRegion.id.in_(region_ids)).order_by(RefRegion.nom))
        localisation = ", ".join(r.nom for r in res.scalars())
    else:
        localisation = None
    p = PoleTerritoire(pole_territoire=nom, region_ids=region_ids, localisation=localisation, description=description)
    db.add(p)
    await db.flush()
    await db.refresh(p)
    return pole_to_dict(p)


# ── PATCH /zones-types/poles/:id ─────────────────────────────────────────────
@router.patch("/poles/{pole_id}")
async def modifier_pole(pole_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from app.models.entreprise import RefRegion
    result = await db.execute(select(PoleTerritoire).where(PoleTerritoire.id == pole_id))
    p = result.scalar_one_or_none()
    if not p: raise HTTPException(404, "Pôle introuvable")
    if "pole_territoire" in payload and payload["pole_territoire"]:
        p.pole_territoire = payload["pole_territoire"]
    if "region_ids" in payload:
        region_ids = payload["region_ids"] or []
        p.region_ids = region_ids
        if region_ids:
            res = await db.execute(select(RefRegion).where(RefRegion.id.in_(region_ids)).order_by(RefRegion.nom))
            p.localisation = ", ".join(r.nom for r in res.scalars())
        else:
            p.localisation = None
    if "description" in payload:
        p.description = payload["description"] or None
    await db.flush()
    await db.refresh(p)
    return pole_to_dict(p)


# ── DELETE /zones-types/poles/:id ─────────────────────────────────────────────
@router.delete("/poles/{pole_id}", status_code=204)
async def supprimer_pole(pole_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PoleTerritoire).where(PoleTerritoire.id == pole_id))
    p = result.scalar_one_or_none()
    if not p: raise HTTPException(404, "Pôle introuvable")
    await db.delete(p)
    await db.flush()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/zones_types")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Config par type ────────────────────────────────────────────────────────────
TYPE_CONFIG = {
    "ZES": {"model": ZoneZES, "fichier": ZoneZESFichier, "ent": ZoneZESEntreprise, "prefix": "ZES"},
    "ZAI": {"model": ZoneZAI, "fichier": ZoneZAIFichier, "ent": ZoneZAIEntreprise, "prefix": "ZAI"},
    "ZFI": {"model": ZoneZFI, "fichier": ZoneZFIFichier, "ent": ZoneZFIEntreprise, "prefix": "ZFI"},
}

ENT_LOAD_OPTS = [
    selectinload(EntrepriseIntallee.region),
    selectinload(EntrepriseIntallee.departement),
    selectinload(EntrepriseIntallee.arrondissement),
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
        "id":               e.id,
        "nom":              e.nom,
        "forme_juridique":  e.forme_juridique,
        "date_creation":    e.date_creation.isoformat() if e.date_creation else None,
        "pays":             e.pays,
        "adresse":          e.adresse,
        "telephone":        e.telephone,
        "mail":             e.mail,
        "siteweb":          e.siteweb,
        "secteur_ids":      e.secteur_ids or [],
        "branche_ids":      e.branche_ids or [],
        "activite_ids":     e.activite_ids or [],
        "region_nom":       e.region.nom if e.region else None,
        "departement_nom":  e.departement.nom if e.departement else None,
        "pole_territoire_nom": e.pole_territoire.pole_territoire if e.pole_territoire else None,
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


async def get_naema_noms(zones: list, db: AsyncSession) -> dict:
    from app.models.entreprise import RefSecteur, RefBranche, RefActivite
    noms: dict = {}
    s_ids = set()
    b_ids = set()
    a_ids = set()
    for z in zones:
        for sid in (z.secteur_ids or []): s_ids.add(sid)
        for bid in (z.branche_ids or []): b_ids.add(bid)
        for aid in (z.activite_ids or []): a_ids.add(aid)
    if s_ids:
        res = await db.execute(select(RefSecteur).where(RefSecteur.id.in_(s_ids)))
        for s in res.scalars(): noms[f"s_{s.id}"] = s.nom
    if b_ids:
        res = await db.execute(select(RefBranche).where(RefBranche.id.in_(b_ids)))
        for b in res.scalars(): noms[f"b_{b.id}"] = b.nom
    if a_ids:
        res = await db.execute(select(RefActivite).where(RefActivite.id.in_(a_ids)))
        for a in res.scalars(): noms[f"a_{a.id}"] = a.nom
    return noms


def zone_to_dict(z, geo_noms: dict, pole_noms: dict = {}, naema_noms: dict = {}) -> dict:
    secteur_ids  = z.secteur_ids  or []
    branche_ids  = z.branche_ids  or []
    activite_ids = z.activite_ids or []

    # Reconstruire thematiques multi au format "sec:X, bra:Y, act:Z"
    parts = []
    for sid in secteur_ids:
        nom = naema_noms.get(f"s_{sid}")
        if nom: parts.append(f"sec:{nom}")
    for bid in branche_ids:
        nom = naema_noms.get(f"b_{bid}")
        if nom: parts.append(f"bra:{nom}")
    for aid in activite_ids:
        nom = naema_noms.get(f"a_{aid}")
        if nom: parts.append(f"act:{nom}")

    return {
        "id":               z.id,
        "nom_zone":         z.nom_zone,
        "type_zone":        z.id[:3],
        "pole_id":          z.pole_id,
        "pole_nom":         pole_noms.get(z.pole_id),
        "description":      z.description,
        "date_creation":    z.date_creation.isoformat() if z.date_creation else None,
        "decret_creation":  z.decret_creation,
        "superficie":       float(z.superficie) if z.superficie else None,
        "region_id":        z.region_id,
        "departement_id":   z.departement_id,
        "arrondissement_id":z.arrondissement_id,
        "secteur_ids":      secteur_ids,
        "branche_ids":      branche_ids,
        "activite_ids":     activite_ids,
        "thematiques":      ", ".join(parts) if parts else None,
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


# ── GET /zones-types/entreprises-assignees ────────────────────────────────────
@router.get("/entreprises-assignees")
async def entreprises_assignees(db: AsyncSession = Depends(get_db)):
    """Retourne tous les IDs d'entreprises déjà assignées à une zone (toutes tables)."""
    from sqlalchemy import union_all, literal_column
    ids = set()
    for cls in [ZoneZESEntreprise, ZoneZAIEntreprise, ZoneZFIEntreprise]:
        result = await db.execute(select(cls.entreprise_id))
        ids.update(r[0] for r in result.fetchall())
    return list(ids)




# ── GET /zones-types ──────────────────────────────────────────────────────────
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
    naema_noms = await get_naema_noms(zones, db)
    return [zone_to_dict(z, geo_noms, pole_noms, naema_noms) for z in zones]


# ── POST /zones-types ──────────────────────────────────────────────────────────
@router.post("", status_code=201)
async def creer_zone(
    type_zone:        str            = Form(...),
    nom_zone:         str            = Form(...),
    pole_id:          Optional[str]  = Form(None),
    description:      Optional[str]  = Form(None),
    date_creation:    Optional[str]  = Form(None),
    decret_creation:  Optional[str]  = Form(None),
    superficie:       Optional[str]  = Form(None),
    region_id:        Optional[int]  = Form(None),
    departement_id:   Optional[int]  = Form(None),
    arrondissement_id:Optional[int]  = Form(None),
    secteur_ids:      Optional[str]  = Form(None),   # JSON array string "[1,2]"
    branche_ids:      Optional[str]  = Form(None),
    activite_ids:     Optional[str]  = Form(None),
    db:               AsyncSession   = Depends(get_db),
):
    import json as json_mod
    from datetime import date as date_type
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")

    def parse_ids(s): 
        try: return json_mod.loads(s) if s else []
        except: return []

    def parse_date(s):
        if not s: return None
        try:
            d = date_type.fromisoformat(s)
            if d > date_type.today(): raise HTTPException(422, "La date de création ne peut pas être dans le futur")
            return d
        except ValueError: return None

    from sqlalchemy import text
    await db.execute(text(f"""
        INSERT INTO {cfg['model'].__tablename__}
            (id, nom_zone, pole_id, description, date_creation, decret_creation, superficie,
             region_id, departement_id, arrondissement_id,
             secteur_ids, branche_ids, activite_ids)
        VALUES
            ('', :nom_zone, :pole_id, :description, :date_creation, :decret_creation, :superficie,
             :region_id, :departement_id, :arrondissement_id,
             :secteur_ids, :branche_ids, :activite_ids)
    """), {
        "nom_zone": nom_zone,
        "pole_id": int(pole_id) if pole_id and pole_id not in ("", "0") else None,
        "description": description,
        "date_creation": parse_date(date_creation),
        "decret_creation": decret_creation,
        "superficie": float(superficie) if superficie else None,
        "region_id": region_id, "departement_id": departement_id,
        "arrondissement_id": arrondissement_id,
        "secteur_ids": parse_ids(secteur_ids),
        "branche_ids": parse_ids(branche_ids),
        "activite_ids": parse_ids(activite_ids),
    })
    await db.flush()

    last = await db.execute(
        select(cfg["model"]).where(cfg["model"].is_deleted == False)
        .order_by(cfg["model"].created_at.desc()).limit(1)
    )
    z = last.scalar_one()
    result = await db.execute(select(cfg["model"]).options(*get_load_opts(cfg)).where(cfg["model"].id == z.id))
    zone = result.scalar_one()
    geo_noms = await get_geo_noms([zone], db)
    pole_noms = await get_pole_noms([zone], db)
    naema_noms = await get_naema_noms([zone], db)
    return zone_to_dict(zone, geo_noms, pole_noms, naema_noms)
    naema_noms = await get_naema_noms([zone], db)
    return zone_to_dict(zone, geo_noms, pole_noms, naema_noms)


# ── PATCH /zones-types/:id ────────────────────────────────────────────────────
from pydantic import BaseModel as PydanticBaseModel

class ZonePatchPayload(PydanticBaseModel):
    nom_zone:          Optional[str]   = None
    pole_id:           Optional[str]   = None
    description:       Optional[str]   = "__UNSET__"
    date_creation:     Optional[str]   = "__UNSET__"
    decret_creation:   Optional[str]   = "__UNSET__"
    superficie:        Optional[str]   = "__UNSET__"
    region_id:         Optional[str]   = None
    departement_id:    Optional[str]   = None
    arrondissement_id: Optional[str]   = None
    secteur_ids:       Optional[str]   = None
    branche_ids:       Optional[str]   = None
    activite_ids:      Optional[str]   = None


@router.patch("/{zone_id}")
async def modifier_zone(
    zone_id: str,
    payload: ZonePatchPayload,
    db:      AsyncSession = Depends(get_db),
):
    import json as json_mod
    from datetime import date as date_type

    def to_int_or_none(v):
        if v is None or v == "" or v == "0": return None
        try: return int(v)
        except: return None

    def parse_ids(s):
        if s is None: return None
        try: return json_mod.loads(s)
        except: return []

    type_zone = zone_id[:3]
    cfg = TYPE_CONFIG.get(type_zone)
    if not cfg: raise HTTPException(400, f"Type inconnu: {type_zone}")
    Model = cfg["model"]

    result = await db.execute(select(Model).where(Model.id == zone_id, Model.is_deleted == False))
    z = result.scalar_one_or_none()
    if not z: raise HTTPException(404, "Zone introuvable")

    if payload.nom_zone is not None:
        z.nom_zone = payload.nom_zone if payload.nom_zone else z.nom_zone
    if payload.pole_id is not None:
        z.pole_id = to_int_or_none(payload.pole_id)

    # Champs vidables — None = absent, "" = vider, valeur = mettre à jour
    if payload.description   != "__UNSET__": z.description    = payload.description   if payload.description   != "" else None
    if payload.decret_creation != "__UNSET__": z.decret_creation = payload.decret_creation if payload.decret_creation != "" else None
    if payload.superficie    != "__UNSET__":
        z.superficie = float(payload.superficie) if payload.superficie not in (None, "") else None
    if payload.date_creation != "__UNSET__":
        if not payload.date_creation or payload.date_creation == "":
            z.date_creation = None
        else:
            try:
                d = date_type.fromisoformat(payload.date_creation)
                if d > date_type.today(): raise HTTPException(422, "Date dans le futur non autorisée")
                z.date_creation = d
            except ValueError: pass

    if payload.region_id         is not None: z.region_id         = to_int_or_none(payload.region_id)
    if payload.departement_id    is not None: z.departement_id    = to_int_or_none(payload.departement_id)
    if payload.arrondissement_id is not None: z.arrondissement_id = to_int_or_none(payload.arrondissement_id)
    ids = parse_ids(payload.secteur_ids);  
    if ids is not None: z.secteur_ids = ids
    ids = parse_ids(payload.branche_ids);  
    if ids is not None: z.branche_ids = ids
    ids = parse_ids(payload.activite_ids); 
    if ids is not None: z.activite_ids = ids

    await db.flush()
    result = await db.execute(select(Model).options(*get_load_opts(cfg)).where(Model.id == zone_id))
    zone = result.scalar_one()
    geo_noms   = await get_geo_noms([zone], db)
    pole_noms  = await get_pole_noms([zone], db)
    naema_noms = await get_naema_noms([zone], db)
    return zone_to_dict(zone, geo_noms, pole_noms, naema_noms)


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
    entreprise_id:int,
    db:           AsyncSession = Depends(get_db),
):
    from sqlalchemy import text as sa_text
    import uuid as uuid_lib
    type_zone = zone_id[:3]
    table_map = {"ZES": "zone_zes_entreprises", "ZAI": "zone_zai_entreprises", "ZFI": "zone_zfi_entreprises"}
    table = table_map.get(type_zone)
    if not table: raise HTTPException(400, f"Type inconnu: {type_zone}")

    # Vérifier si déjà assignée dans n'importe quelle zone
    check = await db.execute(sa_text("""
        SELECT zone_id FROM zone_zes_entreprises WHERE entreprise_id = :eid
        UNION ALL
        SELECT zone_id FROM zone_zai_entreprises WHERE entreprise_id = :eid
        UNION ALL
        SELECT zone_id FROM zone_zfi_entreprises WHERE entreprise_id = :eid
        LIMIT 1
    """), {"eid": entreprise_id})
    existing = check.fetchone()
    if existing:
        raise HTTPException(400, f"Entreprise déjà assignée à la zone {existing[0]}")

    new_id = str(uuid_lib.uuid4())
    await db.execute(
        sa_text(f"INSERT INTO {table} (zone_id, entreprise_id) VALUES (:zone_id, :entreprise_id)"),
        {"zone_id": zone_id, "entreprise_id": entreprise_id}
    )
    await db.flush()
    return {"ok": True}


# ── DELETE /zones-types/:id/entreprises/:ze_id ────────────────────────────────
@router.delete("/{zone_id}/entreprises/{ze_id}", status_code=204)
async def retirer_entreprise(zone_id: str, ze_id: int, db: AsyncSession = Depends(get_db)):
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
