from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import require_admin
from app.models.ref_potentialites_model import RefPotentialiteAvantage

router = APIRouter(prefix="/ref-potentialites", tags=["ref-potentialites"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CategorieIn(BaseModel):
    libelle: str
    ordre: Optional[int] = 0
    actif: Optional[bool] = True

class AvantageIn(BaseModel):
    categorie_id: int
    libelle: str
    ordre: Optional[int] = 0
    actif: Optional[bool] = True


# ─── Catégories ───────────────────────────────────────────────────────────────

@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("""
        SELECT id, libelle, ordre, actif
        FROM ref_potentialites_categories
        ORDER BY ordre, id
    """))
    return [{"id":r[0],"libelle":r[1],"ordre":r[2],"actif":r[3]} for r in res.fetchall()]

@router.post("/categories")
async def create_categorie(body: CategorieIn, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text("""
        INSERT INTO ref_potentialites_categories (libelle, ordre, actif)
        VALUES (:libelle, :ordre, :actif)
        RETURNING id, libelle, ordre, actif
    """), {"libelle": body.libelle, "ordre": body.ordre, "actif": body.actif})
    await db.commit()
    r = res.fetchone()
    return {"id":r[0],"libelle":r[1],"ordre":r[2],"actif":r[3]}

@router.patch("/categories/{id}")
async def update_categorie(id: int, body: CategorieIn, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text("""
        UPDATE ref_potentialites_categories
        SET libelle=:libelle, ordre=:ordre, actif=:actif, updated_at=NOW()
        WHERE id=:id
        RETURNING id, libelle, ordre, actif
    """), {"id": id, "libelle": body.libelle, "ordre": body.ordre, "actif": body.actif})
    await db.commit()
    r = res.fetchone()
    if not r: raise HTTPException(404)
    return {"id":r[0],"libelle":r[1],"ordre":r[2],"actif":r[3]}

@router.delete("/categories/{id}")
async def delete_categorie(id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    # Vérifier qu'il n'y a pas d'avantages liés
    res = await db.execute(text(
        "SELECT COUNT(*) FROM ref_potentialites_avantages WHERE categorie_id=:id"
    ), {"id": id})
    count = res.scalar()
    if count > 0:
        raise HTTPException(400, f"Impossible : {count} avantage(s) sont liés à cette catégorie. Supprimez-les d'abord.")
    await db.execute(text("DELETE FROM ref_potentialites_categories WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}

@router.patch("/categories/{id}/toggle")
async def toggle_categorie(id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text("""
        UPDATE ref_potentialites_categories
        SET actif = NOT actif, updated_at=NOW()
        WHERE id=:id
        RETURNING id, libelle, ordre, actif
    """), {"id": id})
    await db.commit()
    r = res.fetchone()
    if not r: raise HTTPException(404)
    return {"id":r[0],"libelle":r[1],"ordre":r[2],"actif":r[3]}


# ─── Avantages ────────────────────────────────────────────────────────────────

@router.get("")
async def list_all(db: AsyncSession = Depends(get_db)):
    """Retourne catégories + avantages groupés."""
    cats = await db.execute(text(
        "SELECT id, libelle, ordre, actif FROM ref_potentialites_categories ORDER BY ordre, id"
    ))
    categories = [{"id":r[0],"libelle":r[1],"ordre":r[2],"actif":r[3],"avantages":[]} for r in cats.fetchall()]

    avs = await db.execute(text("""
        SELECT id, categorie_id, libelle, ordre, actif
        FROM ref_potentialites_avantages
        ORDER BY categorie_id, ordre, id
    """))
    cat_map = {c["id"]: c for c in categories}
    for r in avs.fetchall():
        cid = r[1]
        if cid in cat_map:
            cat_map[cid]["avantages"].append({"id":r[0],"categorie_id":r[1],"libelle":r[2],"ordre":r[3],"actif":r[4]})
    return categories

@router.get("/flat")
async def list_flat(actif_only: bool = True, db: AsyncSession = Depends(get_db)):
    """Liste plate pour les modals (checkboxes)."""
    where = "WHERE a.actif = TRUE AND c.actif = TRUE" if actif_only else ""
    res = await db.execute(text(f"""
        SELECT a.id, a.categorie_id, a.libelle, a.ordre, a.actif, c.libelle as cat_libelle
        FROM ref_potentialites_avantages a
        JOIN ref_potentialites_categories c ON c.id = a.categorie_id
        {where}
        ORDER BY c.ordre, a.ordre, a.id
    """))
    return [{"id":r[0],"categorie_id":r[1],"libelle":r[2],"ordre":r[3],"actif":r[4],"categorie_libelle":r[5]}
            for r in res.fetchall()]

@router.post("")
async def create_avantage(body: AvantageIn, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text("""
        INSERT INTO ref_potentialites_avantages (categorie_id, libelle, ordre, actif)
        VALUES (:categorie_id, :libelle, :ordre, :actif)
        RETURNING id, categorie_id, libelle, ordre, actif
    """), body.dict())
    await db.commit()
    r = res.fetchone()
    return {"id":r[0],"categorie_id":r[1],"libelle":r[2],"ordre":r[3],"actif":r[4]}

@router.patch("/{id}")
async def update_avantage(id: int, body: AvantageIn, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text("""
        UPDATE ref_potentialites_avantages
        SET categorie_id=:categorie_id, libelle=:libelle, ordre=:ordre, actif=:actif, updated_at=NOW()
        WHERE id=:id
        RETURNING id, categorie_id, libelle, ordre, actif
    """), {**body.dict(), "id": id})
    await db.commit()
    r = res.fetchone()
    if not r: raise HTTPException(404)
    return {"id":r[0],"categorie_id":r[1],"libelle":r[2],"ordre":r[3],"actif":r[4]}

@router.delete("/{id}")
async def delete_avantage(id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    await db.execute(text("DELETE FROM ref_potentialites_avantages WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}

@router.patch("/{id}/toggle")
async def toggle_avantage(id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text("""
        UPDATE ref_potentialites_avantages
        SET actif = NOT actif, updated_at=NOW()
        WHERE id=:id
        RETURNING id, categorie_id, libelle, ordre, actif
    """), {"id": id})
    await db.commit()
    r = res.fetchone()
    if not r: raise HTTPException(404)
    return {"id":r[0],"categorie_id":r[1],"libelle":r[2],"ordre":r[3],"actif":r[4]}
