from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.database import get_db
from app.services.fdi_classification import cle_de, sans_parenthese, slug

# Classification sectorielle fDi Markets.
#
# Lecture publique, écriture réservée aux administrateurs. Deux opérations
# seulement : créer et corriger. Pas de suppression, et ce n'est pas un oubli —
# un poste supprimé emporterait avec lui le rattachement de tous les projets
# qui le référencent, y compris ceux d'il y a quinze ans. Un poste que fDi ne
# publie plus reste donc en base, où il continue de décrire le passé.
#
# Renommer, en revanche, se propage tout seul : un projet porte l'identifiant
# du secteur, jamais son libellé. Corriger un nom, c'est un UPDATE sur une
# ligne ; tous les projets rattachés affichent aussitôt le nouveau nom.
#
# Ce que l'on ne touche jamais après création : le `code`. C'est l'identité
# stable de la ligne — ce à quoi les imports s'apparient et ce que les URL
# portent. Il est dérivé du libellé anglais à la création, puis figé.
router = APIRouter(prefix="/fdi", tags=["fdi"])


# ── Lecture ───────────────────────────────────────────────────────────────────
@router.get("/classification")
async def classification(db: AsyncSession = Depends(get_db)):
    """L'arbre secteurs → sous-secteurs, et les activités économiques.

    Une seule réponse plutôt que trois requêtes : 324 lignes au total, que
    l'écran filtre et déplie côté client. Aller-retour unique, pas d'état de
    chargement partiel.
    """
    secteurs = (await db.execute(text(
        "SELECT id, code, libelle_en, libelle_fr, ordre, origine, modifie_le "
        "FROM fdi_secteurs ORDER BY libelle_fr"
    ))).fetchall()

    sous = (await db.execute(text(
        "SELECT id, secteur_id, code, libelle_en, libelle_fr, libelle_en_base, "
        "       cle_appariement, ordre, origine, modifie_le "
        "FROM fdi_sous_secteurs ORDER BY libelle_fr"
    ))).fetchall()

    activites = (await db.execute(text(
        "SELECT id, code, libelle_en, libelle_fr, ordre, origine, modifie_le "
        "FROM fdi_activites ORDER BY libelle_fr"
    ))).fetchall()

    # Un libellé qui sert à plusieurs secteurs — « Other » en sert 24 — n'est
    # pas une anomalie mais une propriété de la nomenclature. Le compter ici
    # évite que chaque écran le recalcule, et permet de le signaler à l'œil.
    partages: dict[str, int] = {}
    for r in sous:
        partages[r.cle_appariement] = partages.get(r.cle_appariement, 0) + 1

    par_secteur: dict[int, list] = {}
    for r in sous:
        par_secteur.setdefault(r.secteur_id, []).append({
            "id": r.id,
            "code": r.code,
            "libelle_en": r.libelle_en,
            "libelle_fr": r.libelle_fr,
            "libelle_en_base": r.libelle_en_base,
            "partage": partages[r.cle_appariement] > 1,
            "origine": r.origine,
            "modifie_le": r.modifie_le.isoformat() if r.modifie_le else None,
            "ordre": r.ordre,
        })

    return {
        "secteurs": [
            {
                "id": s.id, "code": s.code, "libelle_en": s.libelle_en,
                "libelle_fr": s.libelle_fr, "ordre": s.ordre, "origine": s.origine,
                "modifie_le": s.modifie_le.isoformat() if s.modifie_le else None,
                "sous_secteurs": par_secteur.get(s.id, []),
            }
            for s in secteurs
        ],
        "activites": [
            {"id": a.id, "code": a.code, "libelle_en": a.libelle_en,
             "libelle_fr": a.libelle_fr, "ordre": a.ordre, "origine": a.origine,
             "modifie_le": a.modifie_le.isoformat() if a.modifie_le else None}
            for a in activites
        ],
        "totaux": {
            "secteurs": len(secteurs),
            "sous_secteurs": len(sous),
            "activites": len(activites),
            "libelles_partages": sum(1 for n in partages.values() if n > 1),
            "lignes_admin": sum(1 for r in list(secteurs) + list(sous) + list(activites)
                                if r.origine == "admin"),
        },
    }


# ── Écriture ──────────────────────────────────────────────────────────────────
class LibellesIn(BaseModel):
    libelle_fr: str = Field(min_length=1)
    libelle_en: str = Field(min_length=1)


class SousSecteurIn(LibellesIn):
    secteur_id: int


TABLES = {
    "secteur":  "fdi_secteurs",
    "sous":     "fdi_sous_secteurs",
    "activite": "fdi_activites",
}


def _propre(v: str) -> str:
    """Espaces de bordure et espaces doubles retirés : ils fausseraient
    l'appariement des exports de projets, et ne se voient pas à la saisie."""
    return " ".join(v.split())


async def _code_libre(db: AsyncSession, table: str, base: str) -> str:
    """Un code non pris, suffixé au besoin.

    La collision est rare (deux libellés anglais aux mêmes 40 premiers
    caractères) mais un ajout à l'écran ne doit pas échouer pour si peu : on
    numérote plutôt que de refuser.
    """
    code = base
    for n in range(2, 50):
        pris = (await db.execute(
            text(f"SELECT 1 FROM {table} WHERE code = :c"), {"c": code}
        )).first()
        if not pris:
            return code
        code = f"{base}_{n}"
    raise HTTPException(500, "Impossible de dériver un code libre.")


async def _refuser_doublon_en(db: AsyncSession, table: str, libelle_en: str, sauf_id: int | None):
    q = f"SELECT id FROM {table} WHERE libelle_en = :l"
    p: dict = {"l": libelle_en}
    if sauf_id is not None:
        q += " AND id <> :i"
        p["i"] = sauf_id
    if (await db.execute(text(q), p)).first():
        raise HTTPException(409, f"Le libellé anglais « {libelle_en} » est déjà utilisé.")


async def _refuser_doublon_cle(db: AsyncSession, secteur_id: int, cle: str, sauf_id: int | None):
    """Dans un secteur, deux sous-secteurs ne peuvent pas porter le même libellé.

    C'est la contrainte que fDi contourne par sa parenthèse : « Other » existe
    24 fois, mais jamais deux fois dans le même secteur.
    """
    q = ("SELECT id FROM fdi_sous_secteurs "
         "WHERE secteur_id = :s AND cle_appariement = :c")
    p: dict = {"s": secteur_id, "c": cle}
    if sauf_id is not None:
        q += " AND id <> :i"
        p["i"] = sauf_id
    if (await db.execute(text(q), p)).first():
        raise HTTPException(409, "Ce libellé existe déjà dans ce secteur.")


def _signature(user: dict) -> str:
    return str(user.get("email") or user.get("sub") or "admin")


@router.post("/secteurs", status_code=201)
async def creer_secteur(body: LibellesIn, db: AsyncSession = Depends(get_db),
                        user: dict = Depends(require_admin)):
    fr, en = _propre(body.libelle_fr), _propre(body.libelle_en)
    await _refuser_doublon_en(db, "fdi_secteurs", en, None)
    code = await _code_libre(db, "fdi_secteurs", slug(en))
    ordre = ((await db.execute(text("SELECT COALESCE(MAX(ordre), 0) FROM fdi_secteurs"))).scalar() or 0) + 1
    r = (await db.execute(text(
        "INSERT INTO fdi_secteurs (code, libelle_en, libelle_fr, ordre, origine, modifie_le, modifie_par) "
        "VALUES (:c, :en, :fr, :o, 'admin', :d, :u) RETURNING id"
    ), {"c": code, "en": en, "fr": fr, "o": ordre, "d": datetime.now(timezone.utc),
        "u": _signature(user)})).first()
    await db.commit()
    return {"id": r.id, "code": code}


@router.post("/sous-secteurs", status_code=201)
async def creer_sous_secteur(body: SousSecteurIn, db: AsyncSession = Depends(get_db),
                             user: dict = Depends(require_admin)):
    fr, en = _propre(body.libelle_fr), _propre(body.libelle_en)
    secteur = (await db.execute(
        text("SELECT code FROM fdi_secteurs WHERE id = :i"), {"i": body.secteur_id}
    )).first()
    if not secteur:
        raise HTTPException(404, "Secteur introuvable.")
    base = sans_parenthese(en)
    cle = cle_de(base)
    await _refuser_doublon_en(db, "fdi_sous_secteurs", en, None)
    await _refuser_doublon_cle(db, body.secteur_id, cle, None)
    code = await _code_libre(db, "fdi_sous_secteurs", f"{secteur.code}__{slug(base)[:40].rstrip('_')}")
    ordre = ((await db.execute(text("SELECT COALESCE(MAX(ordre), 0) FROM fdi_sous_secteurs"))).scalar() or 0) + 1
    r = (await db.execute(text(
        "INSERT INTO fdi_sous_secteurs (code, secteur_id, libelle_en, libelle_fr, "
        "  libelle_en_base, cle_appariement, ordre, origine, modifie_le, modifie_par) "
        "VALUES (:c, :s, :en, :fr, :b, :k, :o, 'admin', :d, :u) RETURNING id"
    ), {"c": code, "s": body.secteur_id, "en": en, "fr": fr, "b": base, "k": cle,
        "o": ordre, "d": datetime.now(timezone.utc), "u": _signature(user)})).first()
    await db.commit()
    return {"id": r.id, "code": code}


@router.post("/activites", status_code=201)
async def creer_activite(body: LibellesIn, db: AsyncSession = Depends(get_db),
                         user: dict = Depends(require_admin)):
    fr, en = _propre(body.libelle_fr), _propre(body.libelle_en)
    await _refuser_doublon_en(db, "fdi_activites", en, None)
    cle = cle_de(en)
    if (await db.execute(text("SELECT 1 FROM fdi_activites WHERE cle_appariement = :c"),
                         {"c": cle})).first():
        raise HTTPException(409, "Une activité équivalente existe déjà.")
    code = await _code_libre(db, "fdi_activites", slug(en))
    ordre = ((await db.execute(text("SELECT COALESCE(MAX(ordre), 0) FROM fdi_activites"))).scalar() or 0) + 1
    r = (await db.execute(text(
        "INSERT INTO fdi_activites (code, libelle_en, libelle_fr, cle_appariement, ordre, "
        "  origine, modifie_le, modifie_par) "
        "VALUES (:c, :en, :fr, :k, :o, 'admin', :d, :u) RETURNING id"
    ), {"c": code, "en": en, "fr": fr, "k": cle, "o": ordre,
        "d": datetime.now(timezone.utc), "u": _signature(user)})).first()
    await db.commit()
    return {"id": r.id, "code": code}


@router.patch("/secteurs/{secteur_id}")
async def modifier_secteur(secteur_id: int, body: LibellesIn, db: AsyncSession = Depends(get_db),
                           user: dict = Depends(require_admin)):
    fr, en = _propre(body.libelle_fr), _propre(body.libelle_en)
    await _refuser_doublon_en(db, "fdi_secteurs", en, secteur_id)
    r = (await db.execute(text(
        "UPDATE fdi_secteurs SET libelle_en = :en, libelle_fr = :fr, origine = 'admin', "
        "  modifie_le = :d, modifie_par = :u WHERE id = :i RETURNING id"
    ), {"en": en, "fr": fr, "d": datetime.now(timezone.utc), "u": _signature(user),
        "i": secteur_id})).first()
    if not r:
        raise HTTPException(404, "Secteur introuvable.")
    await db.commit()
    return {"id": secteur_id}


@router.patch("/sous-secteurs/{sous_id}")
async def modifier_sous_secteur(sous_id: int, body: LibellesIn, db: AsyncSession = Depends(get_db),
                                user: dict = Depends(require_admin)):
    fr, en = _propre(body.libelle_fr), _propre(body.libelle_en)
    actuel = (await db.execute(
        text("SELECT secteur_id FROM fdi_sous_secteurs WHERE id = :i"), {"i": sous_id}
    )).first()
    if not actuel:
        raise HTTPException(404, "Sous-secteur introuvable.")
    base = sans_parenthese(en)
    cle = cle_de(base)
    await _refuser_doublon_en(db, "fdi_sous_secteurs", en, sous_id)
    await _refuser_doublon_cle(db, actuel.secteur_id, cle, sous_id)
    # Le libellé anglais change, donc ses formes dérivées aussi : sans cela,
    # l'appariement d'un futur export continuerait de viser l'ancien nom.
    await db.execute(text(
        "UPDATE fdi_sous_secteurs SET libelle_en = :en, libelle_fr = :fr, "
        "  libelle_en_base = :b, cle_appariement = :k, origine = 'admin', "
        "  modifie_le = :d, modifie_par = :u WHERE id = :i"
    ), {"en": en, "fr": fr, "b": base, "k": cle, "d": datetime.now(timezone.utc),
        "u": _signature(user), "i": sous_id})
    await db.commit()
    return {"id": sous_id}


@router.patch("/activites/{activite_id}")
async def modifier_activite(activite_id: int, body: LibellesIn, db: AsyncSession = Depends(get_db),
                            user: dict = Depends(require_admin)):
    fr, en = _propre(body.libelle_fr), _propre(body.libelle_en)
    await _refuser_doublon_en(db, "fdi_activites", en, activite_id)
    cle = cle_de(en)
    if (await db.execute(text(
        "SELECT 1 FROM fdi_activites WHERE cle_appariement = :c AND id <> :i"
    ), {"c": cle, "i": activite_id})).first():
        raise HTTPException(409, "Une activité équivalente existe déjà.")
    r = (await db.execute(text(
        "UPDATE fdi_activites SET libelle_en = :en, libelle_fr = :fr, cle_appariement = :k, "
        "  origine = 'admin', modifie_le = :d, modifie_par = :u WHERE id = :i RETURNING id"
    ), {"en": en, "fr": fr, "k": cle, "d": datetime.now(timezone.utc),
        "u": _signature(user), "i": activite_id})).first()
    if not r:
        raise HTTPException(404, "Activité introuvable.")
    await db.commit()
    return {"id": activite_id}
