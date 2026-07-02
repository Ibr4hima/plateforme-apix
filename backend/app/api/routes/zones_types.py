import os, shutil, uuid as uuid_lib
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional
from pydantic import BaseModel as PydanticBaseModel
import json as json_mod
from datetime import date as date_type

from app.core.database import get_db
from app.core.auth import require_admin
from app.models.entreprise import (
    EntrepriseIntallee, RefSecteur, RefBranche, RefActivite,
    RefRegion, RefDepartement, RefArrondissement
)

router = APIRouter(prefix="/zones-types", tags=["Zones ZES/ZAI/ZFI"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/zones_types")
os.makedirs(UPLOAD_DIR, exist_ok=True)

TYPES_VALIDES = {"ZES", "ZAI", "ZFI"}


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def parse_ids(s):
    try: return json_mod.loads(s) if s else []
    except: return []

def to_int_or_none(v):
    if v is None or v == "" or v == "0": return None
    try: return int(v)
    except: return None

def parse_date(s):
    if not s: return None
    try:
        d = date_type.fromisoformat(s)
        if d > date_type.today():
            raise HTTPException(422, "La date de création ne peut pas être dans le futur")
        return d
    except ValueError:
        return None


async def next_zone_id(type_zone: str, db: AsyncSession) -> str:
    """Génère le prochain ID lisible : ZES-8, ZAI-4, etc."""
    res = await db.execute(
        text("""
            SELECT COALESCE(MAX(CAST(SPLIT_PART(id, '-', 2) AS INTEGER)), 0) + 1
            FROM zones WHERE type_zone = :t AND is_deleted = FALSE
        """),
        {"t": type_zone}
    )
    n = res.scalar()
    return f"{type_zone}-{n}"


async def get_geo_noms(zones: list, db: AsyncSession) -> dict:
    noms: dict = {}
    r_ids = {z["region_id"] for z in zones if z.get("region_id")}
    d_ids = {z["departement_id"] for z in zones if z.get("departement_id")}
    a_ids = {z["arrondissement_id"] for z in zones if z.get("arrondissement_id")}
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


async def get_pole_noms(pole_ids: set, db: AsyncSession) -> dict:
    if not pole_ids: return {}
    from app.models.zone_types import PoleTerritoire
    res = await db.execute(
        select(PoleTerritoire).where(PoleTerritoire.id.in_(pole_ids))
    )
    return {p.id: p.pole_territoire for p in res.scalars()}


async def get_naema_noms(zones_rows: list, db: AsyncSession) -> dict:
    noms: dict = {}
    s_ids, b_ids, a_ids = set(), set(), set()
    for z in zones_rows:
        for sid in (z.get("secteur_ids") or []): s_ids.add(sid)
        for bid in (z.get("branche_ids") or []): b_ids.add(bid)
        for aid in (z.get("activite_ids") or []): a_ids.add(aid)
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


async def enrichir_zones(rows: list, db: AsyncSession) -> list:
    """Ajoute noms géo, pôle, NAEMA et entreprises à chaque zone brute."""
    if not rows: return []

    geo_noms   = await get_geo_noms(rows, db)
    pole_ids   = {r["pole_id"] for r in rows if r.get("pole_id")}
    pole_noms  = await get_pole_noms(pole_ids, db)
    naema_noms = await get_naema_noms(rows, db)

    # Charger les entreprises via zone_entreprises (avec statut)
    all_zone_ids = [r["id"] for r in rows]
    ze_res = await db.execute(text("""
        SELECT ze.zone_id, ze.entreprise_id, ze.statut,
               e.nom, e.forme_juridique, e.adresse, e.telephone, e.mail, e.siteweb,
               r.nom as region_nom
        FROM zone_entreprises ze
        JOIN entreprises_installees e ON e.id = ze.entreprise_id
        LEFT JOIN ref_regions r ON r.id = e.region_id
        WHERE ze.zone_id = ANY(:ids)
        ORDER BY ze.created_at
    """), {"ids": all_zone_ids})
    ze_map: dict = {}
    for ze in ze_res.fetchall():
        zd = dict(ze._mapping)
        ze_map.setdefault(zd["zone_id"], []).append({
            "id":           str(zd["entreprise_id"]),
            "entreprise_id":str(zd["entreprise_id"]),
            "statut":       zd["statut"],
            "entreprise": {
                "id":              zd["entreprise_id"],
                "nom":             zd["nom"],
                "forme_juridique": zd["forme_juridique"],
                "adresse":         zd["adresse"],
                "telephone":       zd["telephone"],
                "mail":            zd["mail"],
                "siteweb":         zd["siteweb"],
                "region_nom":      zd["region_nom"],
            }
        })

    result = []
    for r in rows:
        sec_ids = r.get("secteur_ids") or []
        bra_ids = r.get("branche_ids") or []
        act_ids = r.get("activite_ids") or []
        parts   = []
        for sid in sec_ids:
            nom = naema_noms.get(f"s_{sid}")
            if nom: parts.append(f"sec:{nom}")
        for bid in bra_ids:
            nom = naema_noms.get(f"b_{bid}")
            if nom: parts.append(f"bra:{nom}")
        for aid in act_ids:
            nom = naema_noms.get(f"a_{aid}")
            if nom: parts.append(f"act:{nom}")

        result.append({
            "id":                r["id"],
            "nom_zone":          r["nom_zone"],
            "type_zone":         r["type_zone"],
            "pole_id":           r["pole_id"],
            "pole_nom":          pole_noms.get(r["pole_id"]) if r.get("pole_id") else None,
            "description":       r["description"],
            "date_creation":     r["date_creation"].isoformat() if r.get("date_creation") else None,
            "decret_creation":   r["decret_creation"],
            "superficie":        float(r["superficie"]) if r.get("superficie") else None,
            "region_id":         r["region_id"],
            "departement_id":    r["departement_id"],
            "arrondissement_id": r["arrondissement_id"],
            "secteur_ids":       sec_ids,
            "branche_ids":       bra_ids,
            "activite_ids":      act_ids,
            "entreprise_ids":    r.get("entreprise_ids") or [],
            "thematiques":       ", ".join(parts) if parts else None,
            "region_nom":        geo_noms.get(f"r_{r['region_id']}"),
            "departement_nom":   geo_noms.get(f"d_{r['departement_id']}"),
            "arrondissement_nom":geo_noms.get(f"a_{r['arrondissement_id']}"),
            "entreprises":       ze_map.get(r["id"], []),
            "fichiers":          r.get("fichiers", []),
        })
    return result


# ══════════════════════════════════════════════════════════════════════════════
# PÔLES
# ══════════════════════════════════════════════════════════════════════════════

def pole_to_dict(p) -> dict:
    return {
        "id":              p.id,
        "pole_territoire": p.pole_territoire,
        "localisation":    p.localisation,
        "region_ids":      p.region_ids or [],
        "entreprise_ids":  p.entreprise_ids or [],
        "description":     p.description,
    }


@router.get("/poles")
async def liste_poles(db: AsyncSession = Depends(get_db)):
    from app.models.zone_types import PoleTerritoire
    res = await db.execute(select(PoleTerritoire).order_by(PoleTerritoire.id))
    rows = [pole_to_dict(p) for p in res.scalars()]
    # Fichiers PDF attachés (chargés en une seule requête)
    ids = [r["id"] for r in rows]
    if ids:
        fres = await db.execute(text(
            "SELECT id, pole_id, nom FROM pole_fichiers WHERE pole_id = ANY(:ids) ORDER BY created_at"
        ), {"ids": ids})
        fmap: dict = {}
        for f in fres.fetchall():
            fmap.setdefault(f._mapping["pole_id"], []).append({"id": f._mapping["id"], "titre": f._mapping["nom"]})
        for r in rows:
            r["fichiers"] = fmap.get(r["id"], [])
    return rows


@router.post("/poles", status_code=201)
async def creer_pole(payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from app.models.zone_types import PoleTerritoire
    nom = payload.get("pole_territoire", "").strip()
    if not nom: raise HTTPException(422, "Le nom du pôle est obligatoire")
    region_ids = payload.get("region_ids", [])
    if region_ids:
        res = await db.execute(select(RefRegion).where(RefRegion.id.in_(region_ids)).order_by(RefRegion.nom))
        localisation = ", ".join(r.nom for r in res.scalars())
    else:
        localisation = None
    p = PoleTerritoire(
        pole_territoire=nom, region_ids=region_ids,
        localisation=localisation, description=payload.get("description") or None,
        entreprise_ids=[]
    )
    db.add(p); await db.flush(); await db.refresh(p)
    return pole_to_dict(p)


@router.patch("/poles/{pole_id}")
async def modifier_pole(pole_id: int, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from app.models.zone_types import PoleTerritoire
    res = await db.execute(select(PoleTerritoire).where(PoleTerritoire.id == pole_id))
    p = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Pôle introuvable")
    if payload.get("pole_territoire"):
        p.pole_territoire = payload["pole_territoire"]
    if "region_ids" in payload:
        region_ids = payload["region_ids"] or []
        p.region_ids = region_ids
        if region_ids:
            r = await db.execute(select(RefRegion).where(RefRegion.id.in_(region_ids)).order_by(RefRegion.nom))
            p.localisation = ", ".join(x.nom for x in r.scalars())
        else:
            p.localisation = None
    if "description" in payload:
        p.description = payload["description"] or None
    if "entreprise_ids" in payload:
        p.entreprise_ids = payload["entreprise_ids"] or []
    await db.flush(); await db.refresh(p)
    return pole_to_dict(p)


@router.delete("/poles/{pole_id}", status_code=204)
async def supprimer_pole(pole_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from app.models.zone_types import PoleTerritoire
    res = await db.execute(select(PoleTerritoire).where(PoleTerritoire.id == pole_id))
    p = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Pôle introuvable")
    # Fichiers physiques attachés au pôle
    fres = await db.execute(text("SELECT url FROM pole_fichiers WHERE pole_id = :id"), {"id": pole_id})
    for f in fres.fetchall():
        if f[0] and os.path.exists(f[0]):
            try: os.remove(f[0])
            except OSError: pass
    await db.delete(p); await db.flush()


# ── Fichiers PDF des pôles ─────────────────────────────────────────────────────

@router.post("/poles/{pole_id}/fichiers", status_code=201)
async def ajouter_fichier_pole(
    pole_id: int,
    titre:   str        = Form(""),
    fichier: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    ext = os.path.splitext(fichier.filename)[1].lower()
    if ext != ".pdf": raise HTTPException(422, "PDF uniquement")
    unique_name = f"{uuid_lib.uuid4()}{ext}"
    dest = os.path.join(UPLOAD_DIR, unique_name)
    with open(dest, "wb") as f:
        shutil.copyfileobj(fichier.file, f)
    res = await db.execute(text("""
        INSERT INTO pole_fichiers (pole_id, nom, url, type_fichier)
        VALUES (:pole_id, :nom, :url, 'PDF')
        RETURNING id
    """), {"pole_id": pole_id, "nom": titre or fichier.filename, "url": dest})
    fid = res.fetchone()[0]
    await db.flush()
    return {"id": fid, "titre": titre or fichier.filename}


@router.delete("/poles/{pole_id}/fichiers/{fichier_id}", status_code=204)
async def supprimer_fichier_pole(pole_id: int, fichier_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text(
        "SELECT url FROM pole_fichiers WHERE id = :id AND pole_id = :pole_id"
    ), {"id": fichier_id, "pole_id": pole_id})
    f = res.fetchone()
    if not f: raise HTTPException(404, "Fichier introuvable")
    if f[0] and os.path.exists(f[0]):
        os.remove(f[0])
    await db.execute(text("DELETE FROM pole_fichiers WHERE id = :id"), {"id": fichier_id})
    await db.flush()


@router.get("/poles/{pole_id}/fichiers/{fichier_id}/download")
async def telecharger_fichier_pole(pole_id: int, fichier_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "SELECT nom, url FROM pole_fichiers WHERE id = :id AND pole_id = :pole_id"
    ), {"id": fichier_id, "pole_id": pole_id})
    f = res.fetchone()
    if not f or not f[1]: raise HTTPException(404, "Fichier introuvable")
    # Fallback machine-indépendant si le chemin absolu enregistré n'existe plus
    path = f[1]
    if not os.path.exists(path):
        path = os.path.join(UPLOAD_DIR, os.path.basename(f[1]))
    if not os.path.exists(path):
        raise HTTPException(404, "Fichier introuvable sur le serveur")
    return FileResponse(path, filename=f"{f[0]}.pdf" if not f[0].lower().endswith(".pdf") else f[0], media_type="application/pdf")


# ══════════════════════════════════════════════════════════════════════════════
# ZONES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/entreprises-assignees")
async def entreprises_assignees(db: AsyncSession = Depends(get_db)):
    """IDs d'entreprises déjà assignées à une zone."""
    res = await db.execute(text("""
        SELECT DISTINCT unnest(entreprise_ids) FROM zones WHERE is_deleted = FALSE
    """))
    return [r[0] for r in res.fetchall()]


@router.get("")
async def liste_zones(type_zone: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    q = "SELECT * FROM zones WHERE is_deleted = FALSE"
    params = {}
    if type_zone:
        if type_zone not in TYPES_VALIDES:
            raise HTTPException(400, f"Type inconnu: {type_zone}")
        q += " AND type_zone = :t"
        params["t"] = type_zone
    q += " ORDER BY nom_zone"
    res = await db.execute(text(q), params)
    rows = [dict(r._mapping) for r in res.fetchall()]

    # Charger les fichiers
    if rows:
        zone_ids = [r["id"] for r in rows]
        fres = await db.execute(text(
            "SELECT * FROM zone_fichiers WHERE zone_id = ANY(:ids) ORDER BY created_at"
        ), {"ids": zone_ids})
        fmap: dict = {}
        for f in fres.fetchall():
            fd = dict(f._mapping)
            fmap.setdefault(fd["zone_id"], []).append({
                "id": fd["id"], "titre": fd["nom"], "fichier_nom": fd["nom"], "url": fd["url"]
            })
        for r in rows:
            r["fichiers"] = fmap.get(r["id"], [])

    return await enrichir_zones(rows, db)


@router.post("", status_code=201)
async def creer_zone(
    type_zone:         str           = Form(...),
    nom_zone:          str           = Form(...),
    pole_id:           Optional[str] = Form(None),
    description:       Optional[str] = Form(None),
    date_creation:     Optional[str] = Form(None),
    decret_creation:   Optional[str] = Form(None),
    superficie:        Optional[str] = Form(None),
    region_id:         Optional[int] = Form(None),
    departement_id:    Optional[int] = Form(None),
    arrondissement_id: Optional[int] = Form(None),
    secteur_ids:       Optional[str] = Form(None),
    branche_ids:       Optional[str] = Form(None),
    activite_ids:      Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    if type_zone not in TYPES_VALIDES:
        raise HTTPException(400, f"Type inconnu: {type_zone}")

    zone_id = await next_zone_id(type_zone, db)

    await db.execute(text("""
        INSERT INTO zones
            (id, type_zone, nom_zone, pole_id, description, date_creation, decret_creation,
             superficie, region_id, departement_id, arrondissement_id,
             secteur_ids, branche_ids, activite_ids, entreprise_ids, est_publie, is_deleted)
        VALUES
            (:id, :type_zone, :nom_zone, :pole_id, :description, :date_creation, :decret_creation,
             :superficie, :region_id, :departement_id, :arrondissement_id,
             :secteur_ids, :branche_ids, :activite_ids, '{}', TRUE, FALSE)
    """), {
        "id": zone_id, "type_zone": type_zone, "nom_zone": nom_zone,
        "pole_id": to_int_or_none(pole_id),
        "description": description or None,
        "date_creation": parse_date(date_creation),
        "decret_creation": decret_creation or None,
        "superficie": float(superficie) if superficie else None,
        "region_id": region_id, "departement_id": departement_id,
        "arrondissement_id": arrondissement_id,
        "secteur_ids": parse_ids(secteur_ids),
        "branche_ids": parse_ids(branche_ids),
        "activite_ids": parse_ids(activite_ids),
    })
    await db.flush()

    res = await db.execute(text("SELECT * FROM zones WHERE id = :id"), {"id": zone_id})
    row = dict(res.fetchone()._mapping)
    row["fichiers"] = []
    zones = await enrichir_zones([row], db)
    return zones[0]


class ZonePatchPayload(PydanticBaseModel):
    nom_zone:          Optional[str] = None
    pole_id:           Optional[str] = None
    description:       Optional[str] = "__UNSET__"
    date_creation:     Optional[str] = "__UNSET__"
    decret_creation:   Optional[str] = "__UNSET__"
    superficie:        Optional[str] = "__UNSET__"
    region_id:         Optional[str] = None
    departement_id:    Optional[str] = None
    arrondissement_id: Optional[str] = None
    secteur_ids:       Optional[str] = None
    branche_ids:       Optional[str] = None
    activite_ids:      Optional[str] = None


@router.patch("/{zone_id}")
async def modifier_zone(zone_id: str, payload: ZonePatchPayload, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text("SELECT * FROM zones WHERE id = :id AND is_deleted = FALSE"), {"id": zone_id})
    row = res.fetchone()
    if not row: raise HTTPException(404, "Zone introuvable")

    updates = []
    params: dict = {"id": zone_id}

    if payload.nom_zone:
        updates.append("nom_zone = :nom_zone"); params["nom_zone"] = payload.nom_zone
    if payload.pole_id is not None:
        updates.append("pole_id = :pole_id"); params["pole_id"] = to_int_or_none(payload.pole_id)
    if payload.description != "__UNSET__":
        updates.append("description = :description"); params["description"] = payload.description or None
    if payload.decret_creation != "__UNSET__":
        updates.append("decret_creation = :decret_creation"); params["decret_creation"] = payload.decret_creation or None
    if payload.superficie != "__UNSET__":
        updates.append("superficie = :superficie")
        params["superficie"] = float(payload.superficie) if payload.superficie else None
    if payload.date_creation != "__UNSET__":
        updates.append("date_creation = :date_creation")
        params["date_creation"] = parse_date(payload.date_creation) if payload.date_creation else None
    if payload.region_id is not None:
        updates.append("region_id = :region_id"); params["region_id"] = to_int_or_none(payload.region_id)
    if payload.departement_id is not None:
        updates.append("departement_id = :departement_id"); params["departement_id"] = to_int_or_none(payload.departement_id)
    if payload.arrondissement_id is not None:
        updates.append("arrondissement_id = :arrondissement_id"); params["arrondissement_id"] = to_int_or_none(payload.arrondissement_id)
    if payload.secteur_ids is not None:
        updates.append("secteur_ids = :secteur_ids"); params["secteur_ids"] = parse_ids(payload.secteur_ids)
    if payload.branche_ids is not None:
        updates.append("branche_ids = :branche_ids"); params["branche_ids"] = parse_ids(payload.branche_ids)
    if payload.activite_ids is not None:
        updates.append("activite_ids = :activite_ids"); params["activite_ids"] = parse_ids(payload.activite_ids)

    if updates:
        updates.append("updated_at = NOW()")
        await db.execute(text(f"UPDATE zones SET {', '.join(updates)} WHERE id = :id"), params)
        await db.flush()

    res2 = await db.execute(text("SELECT * FROM zones WHERE id = :id"), {"id": zone_id})
    row2 = dict(res2.fetchone()._mapping)
    fres = await db.execute(text("SELECT * FROM zone_fichiers WHERE zone_id = :id ORDER BY created_at"), {"id": zone_id})
    row2["fichiers"] = [{"id": f._mapping["id"], "titre": f._mapping["nom"], "url": f._mapping["url"]} for f in fres.fetchall()]
    zones = await enrichir_zones([row2], db)
    return zones[0]


@router.delete("/{zone_id}", status_code=204)
async def supprimer_zone(zone_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    # Supprimer les fichiers physiques
    fres = await db.execute(text("SELECT url FROM zone_fichiers WHERE zone_id = :id"), {"id": zone_id})
    for f in fres.fetchall():
        url = f._mapping["url"]
        if url and os.path.exists(url):
            os.remove(url)
    await db.execute(text("DELETE FROM zone_fichiers WHERE zone_id = :id"), {"id": zone_id})
    await db.execute(text("DELETE FROM zones WHERE id = :id"), {"id": zone_id})
    await db.flush()


# ══════════════════════════════════════════════════════════════════════════════
# ENTREPRISES ↔ ZONES  (table zone_entreprises avec statut)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{zone_id}/entreprises-eligibles")
async def entreprises_eligibles(zone_id: str, db: AsyncSession = Depends(get_db)):
    """
    Retourne toutes les entreprises publiées avec leur statut vis-à-vis de la zone :
    - installee   : dans zone_entreprises avec statut='installee'
    - eligible_declaree : dans zone_entreprises avec statut='eligible'
    - eligible    : activité commune avec la zone, pas encore dans zone_entreprises
    - non_eligible: aucune activité commune
    """
    z = await db.execute(text(
        "SELECT activite_ids FROM zones WHERE id = :id"
    ), {"id": zone_id})
    zone_row = z.fetchone()
    if not zone_row:
        raise HTTPException(404, "Zone introuvable")
    zone_act_ids = set(zone_row[0] or [])

    # Entreprises déjà dans la table avec leur statut
    ze_res = await db.execute(text(
        "SELECT entreprise_id, statut FROM zone_entreprises WHERE zone_id = :zid"
    ), {"zid": zone_id})
    ze_map = {row[0]: row[1] for row in ze_res.fetchall()}

    # Toutes les entreprises publiées
    res = await db.execute(text("""
        SELECT e.id, e.nom, e.forme_juridique, e.activite_ids, r.nom as region_nom
        FROM entreprises_installees e
        LEFT JOIN ref_regions r ON r.id = e.region_id
        WHERE e.is_deleted = FALSE AND e.est_publie = TRUE
        ORDER BY e.nom
    """))

    result = []
    for row in res.fetchall():
        eid         = row[0]
        ent_act_ids = set(row[3] or [])
        commun      = zone_act_ids & ent_act_ids

        if eid in ze_map:
            statut = ze_map[eid]  # 'installee' ou 'eligible'
        elif commun:
            statut = "eligible"
        else:
            statut = "non_eligible"

        result.append({
            "id":               eid,
            "nom":              row[1],
            "forme_juridique":  row[2],
            "region_nom":       row[4],
            "activite_ids":     list(ent_act_ids),
            "activites_communes": list(commun),
            "statut":           statut,
            "en_base":          eid in ze_map,
        })

    return result


@router.post("/{zone_id}/entreprises", status_code=201)
async def ajouter_entreprise(
    zone_id:      str,
    entreprise_id:int,
    statut:       str = "installee",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    if statut not in ("eligible", "installee"):
        raise HTTPException(400, "Statut invalide")

    # Upsert — si déjà présente, mettre à jour le statut
    await db.execute(text("""
        INSERT INTO zone_entreprises (zone_id, entreprise_id, statut)
        VALUES (:zid, :eid, :statut)
        ON CONFLICT (zone_id, entreprise_id) DO UPDATE SET statut = :statut
    """), {"zid": zone_id, "eid": entreprise_id, "statut": statut})

    # Sync entreprise_ids[] sur la table zones (pour compatibilité)
    if statut == "installee":
        await db.execute(text("""
            UPDATE zones SET entreprise_ids = array_append(
                array_remove(entreprise_ids, :eid), :eid
            ) WHERE id = :zid
        """), {"eid": entreprise_id, "zid": zone_id})

    await db.flush()
    return {"ok": True, "statut": statut}


@router.patch("/{zone_id}/entreprises/{entreprise_id}", status_code=200)
async def modifier_statut_entreprise(
    zone_id:      str,
    entreprise_id:int,
    payload:      dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    statut = payload.get("statut")
    if statut not in ("eligible", "installee"):
        raise HTTPException(400, "Statut invalide")

    await db.execute(text("""
        UPDATE zone_entreprises SET statut = :statut
        WHERE zone_id = :zid AND entreprise_id = :eid
    """), {"statut": statut, "zid": zone_id, "eid": entreprise_id})

    # Si on passe à installee, ajouter dans entreprise_ids
    if statut == "installee":
        await db.execute(text("""
            UPDATE zones SET entreprise_ids = array_append(
                array_remove(entreprise_ids, :eid), :eid
            ) WHERE id = :zid
        """), {"eid": entreprise_id, "zid": zone_id})

    await db.flush()
    return {"ok": True}


@router.delete("/{zone_id}/entreprises/{entreprise_id}", status_code=204)
async def retirer_entreprise(zone_id: str, entreprise_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    await db.execute(text("""
        DELETE FROM zone_entreprises WHERE zone_id = :zid AND entreprise_id = :eid
    """), {"zid": zone_id, "eid": entreprise_id})
    await db.execute(text("""
        UPDATE zones SET entreprise_ids = array_remove(entreprise_ids, :eid), updated_at = NOW()
        WHERE id = :zid
    """), {"eid": entreprise_id, "zid": zone_id})
    await db.flush()


# ══════════════════════════════════════════════════════════════════════════════
# FICHIERS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{zone_id}/fichiers", status_code=201)
async def ajouter_fichier(
    zone_id: str,
    titre:   str        = Form(""),
    fichier: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    ext = os.path.splitext(fichier.filename)[1].lower()
    if ext != ".pdf": raise HTTPException(422, "PDF uniquement")
    unique_name = f"{uuid_lib.uuid4()}{ext}"
    dest = os.path.join(UPLOAD_DIR, unique_name)
    with open(dest, "wb") as f:
        shutil.copyfileobj(fichier.file, f)
    res = await db.execute(text("""
        INSERT INTO zone_fichiers (zone_id, nom, url, type_fichier)
        VALUES (:zone_id, :nom, :url, 'PDF')
        RETURNING id
    """), {"zone_id": zone_id, "nom": titre or fichier.filename, "url": dest})
    fid = res.fetchone()[0]
    await db.flush()
    return {"id": fid, "titre": titre or fichier.filename, "fichier_nom": fichier.filename}


@router.delete("/{zone_id}/fichiers/{fichier_id}", status_code=204)
async def supprimer_fichier(zone_id: str, fichier_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text(
        "SELECT url FROM zone_fichiers WHERE id = :id AND zone_id = :zone_id"
    ), {"id": fichier_id, "zone_id": zone_id})
    f = res.fetchone()
    if not f: raise HTTPException(404, "Fichier introuvable")
    if f[0] and os.path.exists(f[0]):
        os.remove(f[0])
    await db.execute(text("DELETE FROM zone_fichiers WHERE id = :id"), {"id": fichier_id})
    await db.flush()


@router.get("/{zone_id}/fichiers/{fichier_id}/download")
async def telecharger_fichier(zone_id: str, fichier_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "SELECT nom, url FROM zone_fichiers WHERE id = :id AND zone_id = :zone_id"
    ), {"id": fichier_id, "zone_id": zone_id})
    f = res.fetchone()
    if not f or not f[1]: raise HTTPException(404, "Fichier introuvable")
    return FileResponse(f[1], filename=f[0], media_type="application/pdf")

# Note: Le modèle PoleTerritoire doit avoir entreprise_ids
# Ajouter dans app/models/zone_types.py :
# entreprise_ids = Column(ARRAY(Integer), default=[])
