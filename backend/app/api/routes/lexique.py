from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import require_admin

# Lexique de l'investissement — glossaire éditable depuis l'admin.
# GET public (page /lexique) ; POST/PATCH/DELETE réservés aux administrateurs.
router = APIRouter(prefix="/lexique", tags=["lexique"])


class TermeIn(BaseModel):
    terme: str
    categorie: str
    definition: str
    ordre: Optional[int] = 0
    actif: Optional[bool] = True


def _row(r):
    return {"id": r[0], "terme": r[1], "categorie": r[2], "definition": r[3], "ordre": r[4], "actif": r[5]}


@router.get("")
async def list_termes(inclure_inactifs: bool = False, db: AsyncSession = Depends(get_db)):
    where = "" if inclure_inactifs else "WHERE actif = TRUE"
    res = await db.execute(text(
        f"SELECT id, terme, categorie, definition, ordre, actif FROM lexique {where} "
        "ORDER BY terme, id"
    ))
    return [_row(r) for r in res.fetchall()]


@router.post("")
async def create_terme(body: TermeIn, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text(
        "INSERT INTO lexique (terme, categorie, definition, ordre, actif) "
        "VALUES (:t, :c, :d, :o, :a) RETURNING id, terme, categorie, definition, ordre, actif"
    ), {"t": body.terme.strip(), "c": body.categorie, "d": body.definition.strip(), "o": body.ordre, "a": body.actif})
    await db.commit()
    return _row(res.fetchone())


@router.patch("/{id}")
async def update_terme(id: int, body: TermeIn, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(text(
        "UPDATE lexique SET terme=:t, categorie=:c, definition=:d, ordre=:o, actif=:a, updated_at=NOW() "
        "WHERE id=:id RETURNING id, terme, categorie, definition, ordre, actif"
    ), {"t": body.terme.strip(), "c": body.categorie, "d": body.definition.strip(), "o": body.ordre, "a": body.actif, "id": id})
    await db.commit()
    r = res.fetchone()
    if not r:
        raise HTTPException(404, "Terme introuvable.")
    return _row(r)


@router.delete("/{id}")
async def delete_terme(id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    await db.execute(text("DELETE FROM lexique WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}
