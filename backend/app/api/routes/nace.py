# Commerce extérieur du Sénégal — Note d'Analyse du Commerce Extérieur
# (NACE, ANSD, rapport annuel). Principaux produits exportés/importés en
# valeur (millions FCFA) et poids net (tonnes), extraits des annexes des
# éditions 2019 à 2024 (CSV vérifiés dans backend/scripts/nace).
#
# Chaque édition N couvre les années N-4..N : les fenêtres se chevauchent
# et une année peut être révisée d'une édition à l'autre. À la lecture,
# chaque année est résolue avec l'édition la plus récente qui la couvre,
# puis les libellés sont ramenés à la nomenclature la plus récente via
# une table d'alias (renommages et regroupements vérifiés, cf. README).
import csv
from collections import defaultdict
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.database import get_db
from app.models.nace import NacePrincipalProduit

router = APIRouter(prefix="/nace", tags=["nace"])

DOSSIER_CSV = Path(__file__).resolve().parents[3] / "scripts" / "nace"

# Renommages / regroupements entre éditions (cf. backend/scripts/nace/README.md).
# Appliqués à la lecture uniquement — la base garde les libellés d'origine.
ALIAS = {
    "export": {
        "Or non monétaire": "Or industriel",                     # éd. 2019
        "Produits de la pêche": "Produits halieutiques",         # éd. 2019
        "Ciment": "Ciment hydraulique",                          # éd. 2019
        "Titane": "Titane et zircon",                            # éd. 2019 (fusion)
        "Zirconium": "Titane et zircon",                         # éd. 2019 (fusion)
        "Produits pétroliers": "Autres produits pétroliers",     # éd. ≤ 2023
    },
    "import": {
        "Matières plastiques artificielles": "Matières plastiques et artificielles",   # éd. 2020
        "Métaux et ouvrages en métaux": "Métaux communs et ouvrages en métaux communs",  # éd. 2020
        "Riz": "Produits céréaliers",                            # éd. 2022 (fusion)
        "Blé": "Produits céréaliers",                            # éd. 2022 (fusion)
        "Maïs": "Produits céréaliers",                           # éd. 2022 (fusion)
        "Autres céréales": "Produits céréaliers",                # éd. 2022 (fusion)
    },
}


# ── POST /nace/importer ───────────────────────────────────────────────────────
# Charge (upsert) les CSV vérifiés du dépôt dans nace_principaux_produits.
@router.post("/importer")
async def importer_nace(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    fichiers = sorted(DOSSIER_CSV.glob("edition_*_principaux_produits.csv"))
    total, editions = 0, []
    for fic in fichiers:
        lignes = [
            {
                "produit": r["produit"],
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
        stmt = pg_insert(NacePrincipalProduit).values(lignes)
        stmt = stmt.on_conflict_do_update(
            index_elements=["produit", "sens", "annee", "edition"],
            set_={"valeur": stmt.excluded.valeur, "poids": stmt.excluded.poids},
        )
        await db.execute(stmt)
        total += len(lignes)
        editions.append(lignes[0]["edition"])
    return {"fichiers": len(fichiers), "lignes": total, "editions": editions}


# ── GET /nace/principaux-produits ─────────────────────────────────────────────
# Données résolues : pour chaque (sens, année), l'édition la plus récente
# qui couvre l'année, libellés ramenés à la nomenclature courante (les
# lignes fusionnées — Titane+Zirconium, Riz/Blé/Maïs… — sont sommées).
@router.get("/principaux-produits")
async def principaux_produits(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(NacePrincipalProduit))
    rows = res.scalars().all()
    if not rows:
        return {"disponible": False, "annees": [], "editions": [], "donnees": {"export": [], "import": []}}

    # Édition retenue par (sens, année)
    retenue: dict = {}
    for r in rows:
        cle = (r.sens, r.annee)
        if r.edition > retenue.get(cle, 0):
            retenue[cle] = r.edition

    # Agrégat par (sens, année, libellé canonique)
    agreg: dict = defaultdict(lambda: {"valeur": 0.0, "poids": 0.0, "v": False, "p": False})
    for r in rows:
        if retenue[(r.sens, r.annee)] != r.edition:
            continue
        produit = ALIAS.get(r.sens, {}).get(r.produit, r.produit)
        a = agreg[(r.sens, r.annee, produit)]
        if r.valeur is not None:
            a["valeur"] += float(r.valeur); a["v"] = True
        if r.poids is not None:
            a["poids"] += float(r.poids); a["p"] = True

    donnees: dict = {"export": [], "import": []}
    for (sens, annee, produit), a in sorted(agreg.items(), key=lambda x: (x[0][1], x[0][2])):
        donnees[sens].append({
            "produit": produit, "annee": annee,
            "valeur": a["valeur"] if a["v"] else None,
            "poids": a["poids"] if a["p"] else None,
            "edition": retenue[(sens, annee)],
        })
    annees = sorted({annee for (_, annee) in retenue})
    return {
        "disponible": True,
        "annees": annees,
        "editions": sorted({r.edition for r in rows}),
        "donnees": donnees,
    }
