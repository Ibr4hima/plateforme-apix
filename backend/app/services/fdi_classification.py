"""Lecture et import de la classification fDi Markets.

Deux moitiés, séparées à dessein :

  * `lire_csv()` et `verifier()` ne touchent pas la base. Ils lisent les CSV
    versionnés et vérifient leur cohérence — c'est ce que les tests exercent,
    sans PostgreSQL.
  * `importer()` écrit, en upsert sur la clé naturelle : le rejouer ne
    duplique rien, et il suit les CSV du dépôt.

Un import qui échoue à mi-course ne laisse pas la base à moitié à jour : la
transaction appartient à l'appelant, qui commit une fois le rapport obtenu.
"""
from __future__ import annotations

import csv
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover — annotation seule
    from sqlalchemy.ext.asyncio import AsyncSession

DOSSIER_CSV = Path(__file__).resolve().parents[2] / "scripts" / "fdi"

FICHIERS = {
    "secteurs": "fdi_secteurs.csv",
    "sous_secteurs": "fdi_sous_secteurs.csv",
    "activites": "fdi_business_activites.csv",
}


class ClassificationInvalide(ValueError):
    """Les CSV ne décrivent pas une nomenclature exploitable."""


# ── Dérivations, partagées par le générateur de CSV et l'écriture en base ─────
# Les deux chemins d'entrée dans la nomenclature — l'import des fichiers et la
# saisie à l'écran — doivent produire exactement les mêmes formes, sans quoi un
# poste ajouté à la main ne s'apparierait pas comme ses voisins.

def slug(valeur: str) -> str:
    """Un identifiant stable et lisible : « Coal, oil & gas » → coal_oil_gas."""
    txt = unicodedata.normalize("NFKD", valeur).encode("ascii", "ignore").decode()
    txt = txt.lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "_", txt).strip("_")


def sans_parenthese(libelle: str) -> str:
    """Retire la parenthèse de désambiguïsation finale : « Other (Metals) » → « Other »."""
    return re.sub(r"\s*\([^)]*\)\s*$", "", libelle).strip()


def cle_de(libelle: str) -> str:
    """Forme normalisée d'appariement : casse, accents et « & » neutralisés."""
    txt = unicodedata.normalize("NFKD", libelle).encode("ascii", "ignore").decode()
    txt = txt.lower().replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", txt)).strip()


def lire_csv(dossier: Path | None = None) -> dict[str, list[dict]]:
    """Les trois CSV, tels quels, sans conversion autre que l'entier d'ordre."""
    base = dossier or DOSSIER_CSV
    tables: dict[str, list[dict]] = {}
    for cle, nom in FICHIERS.items():
        chemin = base / nom
        if not chemin.exists():
            raise ClassificationInvalide(
                f"{nom} introuvable — le régénérer avec scripts/fdi/generer_csv.py"
            )
        with chemin.open(encoding="utf-8") as f:
            lignes = list(csv.DictReader(f))
        for l in lignes:
            l["ordre"] = int(l["ordre"])
        tables[cle] = lignes
    return tables


def verifier(tables: dict[str, list[dict]]) -> dict:
    """Les contrôles qui doivent tenir avant d'écrire quoi que ce soit.

    Ils reprennent ceux du générateur — sciemment. Le générateur protège la
    dérivation depuis Excel, ceux-ci protègent la base contre un CSV édité à
    la main entre-temps ; c'est le même invariant gardé aux deux bouts.
    """
    secteurs, sous, activites = tables["secteurs"], tables["sous_secteurs"], tables["activites"]
    if not secteurs or not sous or not activites:
        raise ClassificationInvalide("une des trois nomenclatures est vide")

    def unicite(nom: str, valeurs: list[str]) -> None:
        doublons = sorted(v for v, n in Counter(valeurs).items() if n > 1)
        if doublons:
            raise ClassificationInvalide(f"{nom} en double : {doublons[:5]}")

    unicite("code de secteur", [s["code"] for s in secteurs])
    unicite("libellé anglais de secteur", [s["libelle_en"] for s in secteurs])
    unicite("code de sous-secteur", [s["code"] for s in sous])
    unicite("libellé anglais de sous-secteur", [s["libelle_en"] for s in sous])
    unicite("code d'activité", [a["code"] for a in activites])
    unicite("libellé anglais d'activité", [a["libelle_en"] for a in activites])

    codes = {s["code"] for s in secteurs}
    orphelins = sorted({s["secteur_code"] for s in sous} - codes)
    if orphelins:
        raise ClassificationInvalide(f"sous-secteurs rattachés à un secteur inconnu : {orphelins}")

    # La clé d'appariement n'est unique que DANS son secteur — c'est toute la
    # raison d'être de la parenthèse de désambiguïsation de fDi.
    for code in codes:
        cles = [s["cle_appariement"] for s in sous if s["secteur_code"] == code]
        unicite(f"clé d'appariement du secteur « {code} »", cles)

    vides = [
        (t, l.get("code"))
        for t, lignes in tables.items() for l in lignes
        if not l.get("libelle_fr", "").strip() or not l.get("libelle_en", "").strip()
    ]
    if vides:
        raise ClassificationInvalide(f"libellés manquants : {vides[:5]}")

    sans_ss = sorted(codes - {s["secteur_code"] for s in sous})
    partages = sum(1 for _, n in Counter(s["cle_appariement"] for s in sous).items() if n > 1)
    return {
        "secteurs": len(secteurs),
        "sous_secteurs": len(sous),
        "activites": len(activites),
        "secteurs_sans_sous_secteur": sans_ss,
        "libelles_partages": partages,
    }


async def importer(db: "AsyncSession", dossier: Path | None = None) -> dict:
    """Écrit les trois nomenclatures en base. Idempotent, rejouable.

    Une ligne dont `origine` vaut « admin » — créée ou corrigée depuis
    l'administration — n'est PAS écrasée : la décision humaine l'emporte sur le
    fichier. L'écart est remonté dans le rapport, pour que celui qui déploie
    sache que le dépôt et la base divergent sur ces lignes, plutôt que de le
    découvrir un jour par une valeur inattendue.
    """
    # Import local : la moitié « lecture et vérification » de ce module reste
    # utilisable — et testable — sans SQLAlchemy ni pilote PostgreSQL.
    from sqlalchemy import select
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    from app.models.fdi import FdiActivite, FdiSecteur, FdiSousSecteur

    tables = lire_csv(dossier)
    rapport = verifier(tables)

    stmt = pg_insert(FdiSecteur).values([
        {k: s[k] for k in ("code", "libelle_en", "libelle_fr", "ordre")} for s in tables["secteurs"]
    ])
    await db.execute(stmt.on_conflict_do_update(
        index_elements=["code"],
        set_={"libelle_en": stmt.excluded.libelle_en, "libelle_fr": stmt.excluded.libelle_fr,
              "ordre": stmt.excluded.ordre},
        where=FdiSecteur.origine == "depot",
    ))

    # Les sous-secteurs référencent le secteur par son id : on relit les codes
    # après insertion plutôt que de supposer une numérotation.
    ids = dict((await db.execute(select(FdiSecteur.code, FdiSecteur.id))).all())
    stmt = pg_insert(FdiSousSecteur).values([
        {
            "code": s["code"], "secteur_id": ids[s["secteur_code"]],
            "libelle_en": s["libelle_en"], "libelle_fr": s["libelle_fr"],
            "libelle_en_base": s["libelle_en_base"], "cle_appariement": s["cle_appariement"],
            "ordre": s["ordre"],
        }
        for s in tables["sous_secteurs"]
    ])
    await db.execute(stmt.on_conflict_do_update(
        index_elements=["code"],
        set_={"secteur_id": stmt.excluded.secteur_id, "libelle_en": stmt.excluded.libelle_en,
              "libelle_fr": stmt.excluded.libelle_fr, "libelle_en_base": stmt.excluded.libelle_en_base,
              "cle_appariement": stmt.excluded.cle_appariement, "ordre": stmt.excluded.ordre},
        where=FdiSousSecteur.origine == "depot",
    ))

    stmt = pg_insert(FdiActivite).values([
        {k: a[k] for k in ("code", "libelle_en", "libelle_fr", "cle_appariement", "ordre")}
        for a in tables["activites"]
    ])
    await db.execute(stmt.on_conflict_do_update(
        index_elements=["code"],
        set_={"libelle_en": stmt.excluded.libelle_en, "libelle_fr": stmt.excluded.libelle_fr,
              "cle_appariement": stmt.excluded.cle_appariement, "ordre": stmt.excluded.ordre},
        where=FdiActivite.origine == "depot",
    ))

    # Trois populations à distinguer dans ce que la base porte et que le dépôt
    # ne décrit pas de la même façon :
    #
    #   ajouts_admin      créés à l'écran — attendus, pas des anomalies ;
    #   proteges          présents dans les CSV mais corrigés à l'écran : le
    #                     dépôt et la base divergent, et c'est la base qui a
    #                     gagné. À arbitrer un jour, en connaissance de cause ;
    #   orphelins         issus du dépôt mais disparus des CSV. Jamais
    #                     supprimés : un poste retiré emporterait le
    #                     rattachement des projets qui le référencent.
    lignes = {
        "secteurs": (await db.execute(select(FdiSecteur.code, FdiSecteur.origine))).all(),
        "sous_secteurs": (await db.execute(select(FdiSousSecteur.code, FdiSousSecteur.origine))).all(),
        "activites": (await db.execute(select(FdiActivite.code, FdiActivite.origine))).all(),
    }
    du_depot = {
        "secteurs": {s["code"] for s in tables["secteurs"]},
        "sous_secteurs": {s["code"] for s in tables["sous_secteurs"]},
        "activites": {a["code"] for a in tables["activites"]},
    }
    rapport["ajouts_admin"] = {
        f: sorted(c for c, o in rs if o == "admin" and c not in du_depot[f])
        for f, rs in lignes.items()
    }
    rapport["proteges"] = {
        f: sorted(c for c, o in rs if o == "admin" and c in du_depot[f])
        for f, rs in lignes.items()
    }
    rapport["orphelins_en_base"] = {
        f: sorted(c for c, o in rs if o == "depot" and c not in du_depot[f])
        for f, rs in lignes.items()
    }
    return rapport
