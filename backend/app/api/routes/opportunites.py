from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional, List
from pydantic import BaseModel
from app.core.database import get_db
from app.models.opportunites_model import Potentialite, AvantageIncitation
import os, shutil, uuid

router = APIRouter(prefix="/opportunites", tags=["opportunites"])

UPLOAD_DIR = "/tmp/avantages_fichiers"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── Schemas ──────────────────────────────────────────────────────────────────

class PotentialiteIn(BaseModel):
    titre: str
    pole_id: Optional[int] = None
    region_id: Optional[int] = None
    departement_id: Optional[int] = None
    arrondissement_id: Optional[int] = None
    secteur_ids: List[int] = []
    branche_ids: List[int] = []
    activite_ids: List[int] = []
    avantage_ids: List[int] = []
    ressources_naturelles: Optional[str] = None
    infrastructure: Optional[str] = None
    demographie: Optional[str] = None
    atouts_economiques: Optional[str] = None
    contraintes: Optional[str] = None
    autres: Optional[str] = None
    est_publie: bool = True

class AvantageIn(BaseModel):
    secteur_id: Optional[int] = None
    branche_id: Optional[int] = None
    activite_id: int
    avantages: str
    est_publie: bool = True

class ToggleIn(BaseModel):
    est_publie: bool

# ─── Helper potentialité ──────────────────────────────────────────────────────

async def enrichir_potentialite(p: Potentialite, db: AsyncSession) -> dict:
    d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
    if p.pole_id:
        r = await db.execute(text("SELECT pole_territoire FROM poles_territoires WHERE id=:id"), {"id": p.pole_id})
        row = r.fetchone()
        d["pole_nom"] = row[0] if row else None
        d["niveau"] = "pole"; d["niveau_nom"] = d["pole_nom"]
    elif p.region_id:
        r = await db.execute(text("SELECT nom FROM ref_regions WHERE id=:id"), {"id": p.region_id})
        row = r.fetchone(); d["region_nom"] = row[0] if row else None
        d["niveau"] = "region"; d["niveau_nom"] = d.get("region_nom")
    elif p.departement_id:
        r = await db.execute(text("SELECT nom FROM ref_departements WHERE id=:id"), {"id": p.departement_id})
        row = r.fetchone(); d["departement_nom"] = row[0] if row else None
        d["niveau"] = "departement"; d["niveau_nom"] = d.get("departement_nom")
    elif p.arrondissement_id:
        r = await db.execute(text("SELECT nom FROM ref_arrondissements WHERE id=:id"), {"id": p.arrondissement_id})
        row = r.fetchone(); d["arrondissement_nom"] = row[0] if row else None
        d["niveau"] = "arrondissement"; d["niveau_nom"] = d.get("arrondissement_nom")
    else:
        d["niveau"] = "global"; d["niveau_nom"] = "Global"
    return d

# ─── Helper avantage ──────────────────────────────────────────────────────────

async def enrichir_avantage(id: int, db: AsyncSession) -> dict:
    res = await db.execute(text("""
        SELECT a.id, a.secteur_id, a.branche_id, a.activite_id, a.avantages,
               a.est_publie, a.is_deleted, a.created_at, a.updated_at,
               s.nom as secteur_nom, b.nom as branche_nom, ac.nom as activite_nom
        FROM avantages_incitations a
        LEFT JOIN ref_secteurs s ON s.id = a.secteur_id
        LEFT JOIN ref_branches b ON b.id = a.branche_id
        LEFT JOIN ref_activites ac ON ac.id = a.activite_id
        WHERE a.id = :id
    """), {"id": id})
    row = res.fetchone()
    if not row: return {}
    d = {
        "id": row[0], "secteur_id": row[1], "branche_id": row[2],
        "activite_id": row[3], "avantages": row[4],
        "est_publie": row[5], "is_deleted": row[6],
        "created_at": str(row[7]), "updated_at": str(row[8]),
        "secteur_nom": row[9], "branche_nom": row[10], "activite_nom": row[11],
    }
    # Fichiers
    f_res = await db.execute(text(
        "SELECT id, fichier_nom, titre FROM avantages_incitations_fichiers WHERE avantage_id=:id ORDER BY id"
    ), {"id": id})
    d["fichiers"] = [{"id": r[0], "fichier_nom": r[1], "titre": r[2]} for r in f_res.fetchall()]
    return d

# ─── Routes Potentialités ─────────────────────────────────────────────────────


@router.get("/potentialites/used-geo")
async def potentialites_used_geo(db: AsyncSession = Depends(get_db)):
    """Retourne les IDs géographiques déjà utilisés dans les potentialités."""
    res = await db.execute(text("""
        SELECT pole_id, region_id, departement_id, arrondissement_id
        FROM potentialites WHERE is_deleted = FALSE
    """))
    used = {"pole_ids": [], "region_ids": [], "departement_ids": [], "arrondissement_ids": []}
    for r in res.fetchall():
        if r[0]: used["pole_ids"].append(r[0])
        if r[1]: used["region_ids"].append(r[1])
        if r[2]: used["departement_ids"].append(r[2])
        if r[3]: used["arrondissement_ids"].append(r[3])
    return used

@router.get("/avantages/used-activites")
async def avantages_used_activites(db: AsyncSession = Depends(get_db)):
    """Retourne les IDs d'activités déjà utilisés dans les avantages."""
    res = await db.execute(text(
        "SELECT activite_id FROM avantages_incitations WHERE is_deleted = FALSE"
    ))
    return {"activite_ids": [r[0] for r in res.fetchall()]}

@router.get("/potentialites")
async def list_potentialites(
    q: Optional[str] = None, pole_id: Optional[int] = None,
    region_id: Optional[int] = None, niveau: Optional[str] = None,
    admin: bool = False, page: int = 1, per_page: int = 20,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Potentialite).where(Potentialite.is_deleted == False)
    if not admin: stmt = stmt.where(Potentialite.est_publie == True)
    if q: stmt = stmt.where(Potentialite.titre.ilike(f"%{q}%"))
    if pole_id: stmt = stmt.where(Potentialite.pole_id == pole_id)
    if region_id: stmt = stmt.where(Potentialite.region_id == region_id)
    if niveau == "pole": stmt = stmt.where(Potentialite.pole_id.isnot(None))
    elif niveau == "region": stmt = stmt.where(Potentialite.region_id.isnot(None))
    elif niveau == "departement": stmt = stmt.where(Potentialite.departement_id.isnot(None))
    elif niveau == "arrondissement": stmt = stmt.where(Potentialite.arrondissement_id.isnot(None))

    count_res = await db.execute(stmt)
    total = len(count_res.scalars().all())
    stmt = stmt.order_by(Potentialite.created_at.desc()).offset((page-1)*per_page).limit(per_page)
    res = await db.execute(stmt)
    items = res.scalars().all()
    return {"total": total, "data": [await enrichir_potentialite(p, db) for p in items]}

@router.get("/potentialites/{id}")
async def get_potentialite(id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Potentialite).where(Potentialite.id == id, Potentialite.is_deleted == False))
    p = res.scalar_one_or_none()
    if not p: raise HTTPException(404)
    return await enrichir_potentialite(p, db)

@router.post("/potentialites")
async def create_potentialite(body: PotentialiteIn, db: AsyncSession = Depends(get_db)):
    p = Potentialite(**body.dict())
    db.add(p); await db.commit(); await db.refresh(p)
    return await enrichir_potentialite(p, db)

@router.patch("/potentialites/{id}")
async def update_potentialite(id: int, body: PotentialiteIn, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Potentialite).where(Potentialite.id == id, Potentialite.is_deleted == False))
    p = res.scalar_one_or_none()
    if not p: raise HTTPException(404)
    for k, v in body.dict().items(): setattr(p, k, v)
    await db.commit(); await db.refresh(p)
    return await enrichir_potentialite(p, db)

@router.patch("/potentialites/{id}/toggle")
async def toggle_potentialite(id: int, body: ToggleIn, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Potentialite).where(Potentialite.id == id, Potentialite.is_deleted == False))
    p = res.scalar_one_or_none()
    if not p: raise HTTPException(404)
    p.est_publie = body.est_publie
    await db.commit(); await db.refresh(p)
    return await enrichir_potentialite(p, db)

@router.delete("/potentialites/{id}")
async def delete_potentialite(id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Potentialite).where(Potentialite.id == id))
    p = res.scalar_one_or_none()
    if not p: raise HTTPException(404)
    p.is_deleted = True
    await db.commit()
    return {"ok": True}

# ─── Routes Avantages & Incitations ──────────────────────────────────────────

@router.get("/avantages")
async def list_avantages(
    q: Optional[str] = None, activite_id: Optional[int] = None,
    admin: bool = False, page: int = 1, per_page: int = 20,
    db: AsyncSession = Depends(get_db)
):
    where = ["a.is_deleted = FALSE"]
    params: dict = {}
    if not admin: where.append("a.est_publie = TRUE")
    if q: where.append("(a.avantages ILIKE :q OR ac.nom ILIKE :q)"); params["q"] = f"%{q}%"
    if activite_id: where.append("a.activite_id = :activite_id"); params["activite_id"] = activite_id

    where_clause = "WHERE " + " AND ".join(where)
    count_res = await db.execute(text(f"SELECT COUNT(*) FROM avantages_incitations a LEFT JOIN ref_activites ac ON ac.id=a.activite_id {where_clause}"), params)
    total = count_res.scalar()

    res = await db.execute(text(f"""
        SELECT a.id FROM avantages_incitations a
        LEFT JOIN ref_activites ac ON ac.id = a.activite_id
        {where_clause}
        ORDER BY a.created_at DESC
        LIMIT :limit OFFSET :offset
    """), {**params, "limit": per_page, "offset": (page-1)*per_page})
    ids = [r[0] for r in res.fetchall()]
    data = [await enrichir_avantage(id, db) for id in ids]
    return {"total": total, "data": data}

@router.get("/avantages/{id}")
async def get_avantage(id: int, db: AsyncSession = Depends(get_db)):
    d = await enrichir_avantage(id, db)
    if not d: raise HTTPException(404)
    return d

@router.post("/avantages")
async def create_avantage(body: AvantageIn, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("""
        INSERT INTO avantages_incitations (secteur_id, branche_id, activite_id, avantages, est_publie)
        VALUES (:secteur_id, :branche_id, :activite_id, :avantages, :est_publie)
        RETURNING id
    """), body.dict())
    await db.commit()
    new_id = res.fetchone()[0]
    return await enrichir_avantage(new_id, db)

@router.patch("/avantages/{id}")
async def update_avantage(id: int, body: AvantageIn, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE avantages_incitations
        SET secteur_id=:secteur_id, branche_id=:branche_id, activite_id=:activite_id,
            avantages=:avantages, est_publie=:est_publie, updated_at=NOW()
        WHERE id=:id AND is_deleted=FALSE
    """), {**body.dict(), "id": id})
    await db.commit()
    return await enrichir_avantage(id, db)

@router.patch("/avantages/{id}/toggle")
async def toggle_avantage(id: int, body: ToggleIn, db: AsyncSession = Depends(get_db)):
    await db.execute(text(
        "UPDATE avantages_incitations SET est_publie=:v, updated_at=NOW() WHERE id=:id"
    ), {"v": body.est_publie, "id": id})
    await db.commit()
    return await enrichir_avantage(id, db)

@router.delete("/avantages/{id}")
async def delete_avantage(id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(text(
        "UPDATE avantages_incitations SET is_deleted=TRUE WHERE id=:id"
    ), {"id": id})
    await db.commit()
    return {"ok": True}

# ─── Fichiers avantages ───────────────────────────────────────────────────────

@router.post("/avantages/{id}/fichiers")
async def upload_fichier(id: int, fichier: UploadFile = File(...), titre: str = Form(""), db: AsyncSession = Depends(get_db)):
    ext = os.path.splitext(fichier.filename or "")[1]
    nom = f"{uuid.uuid4()}{ext}"
    path = os.path.join(UPLOAD_DIR, nom)
    with open(path, "wb") as f: shutil.copyfileobj(fichier.file, f)
    await db.execute(text("""
        INSERT INTO avantages_incitations_fichiers (avantage_id, fichier_nom, titre)
        VALUES (:avantage_id, :fichier_nom, :titre)
    """), {"avantage_id": id, "fichier_nom": nom, "titre": titre or fichier.filename})
    await db.commit()
    return await enrichir_avantage(id, db)

@router.get("/avantages/{id}/fichiers/{fid}/download")
async def download_fichier(id: int, fid: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "SELECT fichier_nom, titre FROM avantages_incitations_fichiers WHERE id=:fid AND avantage_id=:id"
    ), {"fid": fid, "id": id})
    row = res.fetchone()
    if not row: raise HTTPException(404)
    path = os.path.join(UPLOAD_DIR, row[0])
    if not os.path.exists(path): raise HTTPException(404)
    return FileResponse(path, filename=row[1] or row[0])

@router.delete("/avantages/{id}/fichiers/{fid}")
async def delete_fichier(id: int, fid: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "SELECT fichier_nom FROM avantages_incitations_fichiers WHERE id=:fid AND avantage_id=:id"
    ), {"fid": fid, "id": id})
    row = res.fetchone()
    if row:
        path = os.path.join(UPLOAD_DIR, row[0])
        if os.path.exists(path): os.remove(path)
    await db.execute(text("DELETE FROM avantages_incitations_fichiers WHERE id=:fid"), {"fid": fid})
    await db.commit()
    return {"ok": True}
