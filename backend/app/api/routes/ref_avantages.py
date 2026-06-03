from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db

router = APIRouter(prefix="/ref-avantages", tags=["ref-avantages"])

class TypeIn(BaseModel):
    libelle: str
    ordre: Optional[int] = 0
    actif: Optional[bool] = True

@router.get("")
async def list_types(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "SELECT id, libelle, ordre, actif FROM ref_avantages_types ORDER BY ordre, id"
    ))
    return [{"id":r[0],"libelle":r[1],"ordre":r[2],"actif":r[3]} for r in res.fetchall()]

@router.post("")
async def create_type(body: TypeIn, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "INSERT INTO ref_avantages_types (libelle,ordre,actif) VALUES (:l,:o,:a) RETURNING id,libelle,ordre,actif"
    ), {"l":body.libelle,"o":body.ordre,"a":body.actif})
    await db.commit(); r=res.fetchone()
    return {"id":r[0],"libelle":r[1],"ordre":r[2],"actif":r[3]}

@router.patch("/{id}")
async def update_type(id:int, body:TypeIn, db:AsyncSession=Depends(get_db)):
    res = await db.execute(text(
        "UPDATE ref_avantages_types SET libelle=:l,ordre=:o,actif=:a WHERE id=:id RETURNING id,libelle,ordre,actif"
    ), {"l":body.libelle,"o":body.ordre,"a":body.actif,"id":id})
    await db.commit(); r=res.fetchone()
    if not r: raise HTTPException(404)
    return {"id":r[0],"libelle":r[1],"ordre":r[2],"actif":r[3]}

@router.delete("/{id}")
async def delete_type(id:int, db:AsyncSession=Depends(get_db)):
    res = await db.execute(text("SELECT COUNT(*) FROM avantages_incitations_selections WHERE type_id=:id"),{"id":id})
    if res.scalar()>0: raise HTTPException(400,"Ce type est utilisé dans des fiches existantes.")
    await db.execute(text("DELETE FROM ref_avantages_types WHERE id=:id"),{"id":id})
    await db.commit(); return {"ok":True}

@router.patch("/{id}/toggle")
async def toggle_type(id:int, db:AsyncSession=Depends(get_db)):
    res = await db.execute(text(
        "UPDATE ref_avantages_types SET actif=NOT actif WHERE id=:id RETURNING id,libelle,actif"
    ),{"id":id}); await db.commit(); r=res.fetchone()
    if not r: raise HTTPException(404)
    return {"id":r[0],"libelle":r[1],"actif":r[2]}
