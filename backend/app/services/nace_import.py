"""Import en base des CSV vérifiés de la NACE (Note d'analyse du commerce
extérieur, ANSD), versionnés dans backend/scripts/nace.

Ce module ne dépend que de la base et des modèles, comme les imports fDi
(app/services/fdi_*.py). La route POST /nace/importer l'appelle, et les
scripts de déploiement et de mise à jour locale aussi, sans FastAPI : tant
que l'import vivait dans la route, le script le tirait avec elle et échouait
sur un poste dont le Python ne l'a pas.
"""
import csv
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.nace import (
    NacePrincipalProduit, NaceProduitRegroupe, NaceGroupeUtilisation, NaceChapitre,
    NaceContinent, NaceRegion, NacePays,
)
from app.models.shared import RefPays
from app.utils.pays_matching import correspondre_pays, normaliser_nom

DOSSIER_CSV = Path(__file__).resolve().parents[2] / "scripts" / "nace"
FICHIER_ARBITRAGE = DOSSIER_CSV / "alias_pays_nace.json"

# Familles extraites des annexes : motif de fichier CSV → modèle et nom de
# la colonne portant la modalité (produit, groupe, chapitre ou continent).
FAMILLES = [
    ("principaux_produits", NacePrincipalProduit, "produit"),
    ("produits_regroupes", NaceProduitRegroupe, "produit"),
    ("groupes_utilisation", NaceGroupeUtilisation, "groupe"),
    ("chapitres", NaceChapitre, "chapitre"),
    ("continents", NaceContinent, "continent"),
    ("regions", NaceRegion, "region"),
]

# Lignes synthétiques produites par l'extraction : elles portent le résidu
# d'une région que le rapport ne ventile pas (cf. scripts/nace/extraire_pays.py).
# Reconnues à leur préfixe, elles n'ont pas à être énumérées dans l'arbitrage.
PREFIXE_NON_VENTILE = "NON VENTILE —"


def _arbitrage_pays() -> tuple[dict, set]:
    """(alias vers ref_pays, libellés assumés hors référentiel).

    Arbitrage figé dans alias_pays_nace.json : noms coloniaux (« HONDURAS
    BRITANIQUE » = Belize), renommages (« SWAZILAND » = Eswatini),
    coquilles, et pseudo-partenaires (« DIVERS », « NCA ») qui ne sont pas
    des pays. Cf. scripts/nace/verifier_rapprochement_pays.py.
    """
    if not FICHIER_ARBITRAGE.exists():
        return {}, set()
    doc = json.loads(FICHIER_ARBITRAGE.read_text(encoding="utf-8"))
    return doc.get("alias", {}), set(doc.get("hors_referentiel", {}))


async def _index_ref_pays(db: AsyncSession) -> dict:
    """{nom normalisé: id} sur nom_fr ET nom_cnuced des pays actifs."""
    res = await db.execute(
        select(RefPays.id, RefPays.nom_fr, RefPays.nom_cnuced)
        .where(RefPays.actif.isnot(False)))
    index: dict = {}
    for pid, nom_fr, nom_cnuced in res:
        for nom in (nom_fr, nom_cnuced):
            if nom:
                index.setdefault(normaliser_nom(nom), pid)
    return index


# ── Import des CSV vérifiés du dépôt ──────────────────────────────────────────
# Charge (upsert) les sept familles extraites des annexes de la NACE, toutes
# éditions présentes dans backend/scripts/nace. Idempotent : rejouable sans
# effet de bord, ce qui permet de l'appeler à chaque déploiement pour que les
# données suivent les CSV versionnés.
#
# Appelé par la route POST /nace/importer, qui purge ensuite son cache de
# lectures, et par scripts/nace/importer.py (déploiement, mise à jour locale)
# — sans passer par HTTP, donc sans authentification.
async def importer_csv(db: AsyncSession) -> dict:
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    rapport: dict = {}
    for famille, modele, col in FAMILLES:
        fichiers = sorted(DOSSIER_CSV.glob(f"edition_[0-9][0-9][0-9][0-9]_{famille}.csv"))
        total, editions = 0, []
        for fic in fichiers:
            lignes = [
                {
                    col: r[col],
                    "sens": r["sens"],
                    "annee": int(r["annee"]),
                    "valeur": r["valeur"] or None,
                    "poids": r["poids"] or None,
                    "edition": int(r["edition"]),
                }
                for r in csv.DictReader(open(fic, encoding="utf-8"))
            ]
            if not lignes:
                continue
            stmt = pg_insert(modele).values(lignes)
            stmt = stmt.on_conflict_do_update(
                index_elements=[col, "sens", "annee", "edition"],
                set_={"valeur": stmt.excluded.valeur, "poids": stmt.excluded.poids},
            )
            await db.execute(stmt)
            total += len(lignes)
            editions.append(lignes[0]["edition"])
        rapport[famille] = {"fichiers": len(fichiers), "lignes": total, "editions": editions}

    # Famille pays : à part des autres, car chaque ligne doit être rattachée
    # au référentiel. Les libellés arbitrés hors référentiel gardent
    # ref_pays_id NULL sans être signalés ; un libellé NI rattaché NI arbitré
    # est remonté dans le rapport — c'est le signal qu'une nouvelle édition a
    # introduit un partenaire à trancher dans alias_pays_nace.json.
    alias_pays, hors_ref = _arbitrage_pays()
    index = await _index_ref_pays(db)
    # Les ~11 000 lignes pays ne portent que ~200 libellés distincts : sans
    # mémoïsation, le rapprochement flou serait relancé pour chacune.
    resolu: dict[str, int | None] = {}
    fichiers = sorted(DOSSIER_CSV.glob("edition_[0-9][0-9][0-9][0-9]_pays.csv"))
    total, editions, rattaches, assumes = 0, [], 0, 0
    non_arbitres: set = set()
    for fic in fichiers:
        lignes = []
        for r in csv.DictReader(open(fic, encoding="utf-8")):
            libelle = r["pays"]
            pid = None
            if libelle in hors_ref or libelle.startswith(PREFIXE_NON_VENTILE):
                assumes += 1
            else:
                if libelle not in resolu:
                    resolu[libelle] = correspondre_pays(alias_pays.get(libelle, libelle), index)
                pid = resolu[libelle]
                if pid is None:
                    non_arbitres.add(libelle)
                else:
                    rattaches += 1
            lignes.append({
                "pays": libelle,
                "region": r["region"],
                "ref_pays_id": pid,
                "sens": r["sens"],
                "annee": int(r["annee"]),
                "valeur": r["valeur"] or None,
                "poids": r["poids"] or None,
                "edition": int(r["edition"]),
            })
        if not lignes:
            continue
        stmt = pg_insert(NacePays).values(lignes)
        stmt = stmt.on_conflict_do_update(
            index_elements=["pays", "sens", "annee", "edition"],
            set_={"valeur": stmt.excluded.valeur, "poids": stmt.excluded.poids,
                  "region": stmt.excluded.region, "ref_pays_id": stmt.excluded.ref_pays_id},
        )
        await db.execute(stmt)
        total += len(lignes)
        editions.append(lignes[0]["edition"])
    rapport["pays"] = {
        "fichiers": len(fichiers), "lignes": total, "editions": editions,
        "rattachees": rattaches, "hors_referentiel": assumes,
        "non_arbitres": sorted(non_arbitres),
    }
    return rapport
