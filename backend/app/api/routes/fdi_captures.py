"""Verser une capture d'écran de fDi — administration → fDi Markets.

Quatre routes, un seul geste humain :

  POST /fdi/captures/lire      la capture → ses lignes, lues et déjà vérifiées
  POST /fdi/captures/verifier  les lignes corrigées à l'écran → leur verdict
  POST /fdi/captures/verser    les lignes retenues → en base
  GET  /fdi/captures/serie     ce qui a déjà été versé ce jour-là

Le détail des règles est dans app/services/fdi_captures.py.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.database import get_db
from app.services import fdi_captures as C

router = APIRouter(prefix="/fdi/captures", tags=["fdi"])


def _base(base: str) -> str:
    if base not in C.BASES:
        raise HTTPException(400, f"Base inconnue « {base} » : projets ou signaux.")
    return base


def _jour(jour: date | None) -> date:
    """La date de la capture : aujourd'hui par défaut. Une date à venir n'a pas
    de sens — c'est presque toujours une faute de frappe dans l'année."""
    j = jour or date.today()
    if j > date.today() + timedelta(days=1):
        raise HTTPException(400, "La date de capture est dans le futur.")
    return j


def _page(page: int) -> int:
    if not 1 <= page <= 9999:
        raise HTTPException(400, "Numéro de page hors bornes.")
    return page


@router.get("/serie")
async def serie(base: str = "projets", jour: date | None = None,
                db: AsyncSession = Depends(get_db)):
    return {**await C.serie(db, _base(base), _jour(jour)), "jour": _jour(jour).isoformat(),
            "lecture_active": C.actif()}


@router.post("/lire")
async def lire(fichier: UploadFile = File(...), base: str = Form("projets"),
               jour: date | None = Form(None), page: int | None = Form(None),
               db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    """La capture lue par l'API Claude, puis analysée. Rien n'est écrit."""
    base, j = _base(base), _jour(jour)
    media = (fichier.content_type or "").split(";")[0].strip().lower()
    if media not in C.MEDIAS:
        raise HTTPException(415, "Format d'image non pris en charge : PNG, JPEG, WebP ou GIF.")
    contenu = await fichier.read(C.POIDS_MAX + 1)
    if len(contenu) > C.POIDS_MAX:
        raise HTTPException(413, "Image trop lourde : la recadrer sur le tableau, "
                                 "ou la réduire (moins de 3,7 Mo).")
    if not contenu:
        raise HTTPException(400, "Image vide.")
    try:
        lecture = await C.lire(contenu, media, base)
    except C.LectureImpossible as e:
        raise HTTPException(503, f"Lecture impossible : {e}.")
    p = _page(page) if page else (await C.serie(db, base, j))["suivante"]
    lignes = [{"rang": i, "cases": l} for i, l in enumerate(lecture["lignes"], 1)]
    analyse = await C.analyser(db, base, lignes, j, p, lecture["remarque"])
    return {"base": base, "jour": j.isoformat(), "page": p,
            "page_affichee": lecture["page_affichee"], "remarque": lecture["remarque"],
            "lignes": lignes, "analyse": analyse}


class DestinationIn(BaseModel):
    pays_id: int | None = None
    region_id: int | None = None


class LigneIn(BaseModel):
    rang: int = Field(ge=1, le=100)
    cases: dict[str, str]
    inclure: bool = False
    # Les noms complétés à l'écran, pour « parent » et « entreprise » : la case
    # garde le texte coupé de fDi, le nom complet désigne l'entreprise.
    noms: dict[str, str] = Field(default_factory=dict)
    # Signaux : les destinations que fDi cachait, ajoutées à l'écran. Elles
    # valent pour la ligne versée, ou pour le signal déjà relevé qu'elle est.
    destinations: list[DestinationIn] = Field(default_factory=list, max_length=60)


class PageIn(BaseModel):
    base: str
    jour: date
    page: int
    lignes: list[LigneIn] = Field(max_length=100)


@router.post("/verifier")
async def verifier(body: PageIn, db: AsyncSession = Depends(get_db),
                   user: dict = Depends(require_admin)):
    """Le verdict, refait après une correction à l'écran. Rien n'est écrit."""
    base, j, p = _base(body.base), _jour(body.jour), _page(body.page)
    return await C.analyser(db, base, [l.model_dump() for l in body.lignes], j, p)


@router.post("/verser")
async def verser(body: PageIn, db: AsyncSession = Depends(get_db),
                 user: dict = Depends(require_admin)):
    base, j, p = _base(body.base), _jour(body.jour), _page(body.page)
    rangs = [l.rang for l in body.lignes]
    if len(set(rangs)) != len(rangs):
        raise HTTPException(400, "Deux lignes portent le même rang.")
    if not any(l.inclure or l.destinations or l.noms for l in body.lignes):
        raise HTTPException(400, "Aucune ligne retenue, aucun nom ni destination ajoutés.")
    try:
        rapport = await C.verser(db, base, j, p, [l.model_dump() for l in body.lignes],
                                 str(user.get("email") or "admin"))
    except C.CaptureRefusee as e:
        await db.rollback()
        raise HTTPException(400, str(e))
    return {**rapport, "serie": await C.serie(db, base, j)}
