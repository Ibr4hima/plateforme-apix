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
import json
from collections import defaultdict
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.database import get_db
from app.models.nace import (
    NacePrincipalProduit, NaceProduitRegroupe, NaceGroupeUtilisation, NaceChapitre,
    NaceContinent, NaceRegion, NacePays,
)
from app.models.shared import RefPays
from app.utils.pays_matching import correspondre_pays, normaliser_nom

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

# Les 12 régions dans l'ordre du rapport (Europe → Océanie, « Divers » en
# fin) : l'ordre alphabétique n'a pas de sens pour une nomenclature
# géographique, la lecture le restitue donc explicitement. Les libellés sont
# ceux que scripts/nace/extraire_pays.py rend stables d'une édition à
# l'autre, le rapport renommant ses régions au fil des ans (« Communauté »
# puis « Union » européenne, « Afrique de l'Ouest » puis « occidentale ») et
# ayant fusionné « Continent australien » dans « Océanie » après 2019.
REGIONS_ORDRE = [
    "Union européenne", "Autres pays d'Europe",
    "Afrique centrale", "Afrique du Nord", "Afrique occidentale",
    "Afrique orientale et du Sud",
    "Amérique du Nord", "Amérique centrale et du Sud",
    "Asie occidentale", "Autres pays d'Asie",
    "Océanie", "Divers",
]

# Rattachement des 12 régions aux 6 continents de la famille nace_continents,
# ce qui permet à la lecture de naviguer d'une granularité à l'autre
# (continent → région → pays). « Divers » — le groupe résiduel du rapport,
# nommé « NCA » côté import — est un continent à lui seul dans cette
# nomenclature de l'ANSD. Même table que scripts/nace/verifier_pays.py, qui
# s'en sert pour le contrôle inter-familles.
REGION_CONTINENT = {
    "Union européenne": "Europe", "Autres pays d'Europe": "Europe",
    "Afrique centrale": "Afrique", "Afrique du Nord": "Afrique",
    "Afrique occidentale": "Afrique", "Afrique orientale et du Sud": "Afrique",
    "Amérique du Nord": "Amérique", "Amérique centrale et du Sud": "Amérique",
    "Asie occidentale": "Asie", "Autres pays d'Asie": "Asie",
    "Océanie": "Océanie", "Divers": "Divers",
}

# Partenaires hors référentiel, regroupés à la lecture sous ce libellé —
# au sein de LEUR région, ce qui préserve l'égalité entre la somme des
# pays et le sous-total imprimé de la région.
AUTRES_PAYS = "Autres pays"
FICHIER_ARBITRAGE = DOSSIER_CSV / "alias_pays_nace.json"

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


# ── POST /nace/importer ───────────────────────────────────────────────────────
# Charge (upsert) les CSV vérifiés du dépôt : les cinq familles
# (principaux produits, produits regroupés, groupes d'utilisation,
# chapitres SH, continents), toutes éditions présentes dans
# backend/scripts/nace.
@router.post("/importer")
async def importer_nace(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
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
                pid = correspondre_pays(alias_pays.get(libelle, libelle), index)
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


# Résolution commune : pour chaque (sens, année), l'édition la plus récente
# qui couvre l'année ; libellés ramenés à la nomenclature courante via
# `alias` (les lignes fusionnées — Titane+Zirconium, Riz/Blé/Maïs… — sont
# sommées).
def _resoudre(rows, alias: dict, col: str = "produit") -> dict:
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
        brut = getattr(r, col)
        produit = alias.get(r.sens, {}).get(brut, brut)
        a = agreg[(r.sens, r.annee, produit)]
        if r.valeur is not None:
            a["valeur"] += float(r.valeur); a["v"] = True
        if r.poids is not None:
            a["poids"] += float(r.poids); a["p"] = True

    donnees: dict = {"export": [], "import": []}
    for (sens, annee, produit), a in sorted(agreg.items(), key=lambda x: (x[0][1], x[0][2])):
        donnees[sens].append({
            col: produit, "annee": annee,
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


# ── GET /nace/principaux-produits ─────────────────────────────────────────────
@router.get("/principaux-produits")
async def principaux_produits(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(NacePrincipalProduit))
    return _resoudre(res.scalars().all(), ALIAS)


# ── GET /nace/produits-regroupes ──────────────────────────────────────────────
# Nomenclature fine (30–31 postes export, 56 import) — libellés stables
# d'une édition à l'autre (normalisés à l'extraction), aucun alias requis.
@router.get("/produits-regroupes")
async def produits_regroupes(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(NaceProduitRegroupe))
    return _resoudre(res.scalars().all(), {})


# ── GET /nace/groupes-utilisation ─────────────────────────────────────────────
# 9 groupes exhaustifs par sens : leur somme est le total du commerce
# extérieur (aucune ligne « Autres »). Libellés stables entre éditions.
@router.get("/groupes-utilisation")
async def groupes_utilisation(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(NaceGroupeUtilisation))
    return _resoudre(res.scalars().all(), {}, col="groupe")


# ── GET /nace/chapitres ───────────────────────────────────────────────────────
# Nomenclature du Système Harmonisé (jusqu'à 97 chapitres par sens),
# exhaustive elle aussi. Libellés stables entre éditions.
@router.get("/chapitres")
async def chapitres(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(NaceChapitre))
    return _resoudre(res.scalars().all(), {}, col="chapitre")


# ── GET /nace/continents ──────────────────────────────────────────────────────
# Europe, Afrique, Amérique, Asie, Océanie et Divers — exhaustifs (leur
# somme est le total du commerce extérieur). Les découpages qui varient
# d'une édition à l'autre (Australie séparée de l'Océanie, par exemple)
# sont déjà ramenés au libellé canonique à l'extraction ; la résolution
# somme les lignes qui le partagent.
@router.get("/continents")
async def continents(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(NaceContinent))
    return _resoudre(res.scalars().all(), {}, col="continent")


# ── GET /nace/regions ─────────────────────────────────────────────────────────
# Les 12 sous-totaux régionaux tels qu'imprimés (tableaux 34–37). Ils sont
# exhaustifs : leur somme est le total du commerce extérieur.
@router.get("/regions")
async def regions(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(NaceRegion))
    reponse = _resoudre(res.scalars().all(), {}, col="region")
    reponse["ordre"] = REGIONS_ORDRE
    reponse["continents"] = REGION_CONTINENT
    return reponse


# ── GET /nace/pays ────────────────────────────────────────────────────────────
# Détail par pays partenaire. Les partenaires hors référentiel (DOM-TOM,
# RAS chinoises, entités disparues, pseudo-partenaire « Divers »/« NCA »)
# sont regroupés sous « Autres pays » DE LEUR RÉGION : la somme des pays
# d'une région reste ainsi exactement égale à son sous-total imprimé, et
# aucune donnée du rapport n'est perdue. Le corps est isolé dans
# `_pays_resolus` car le rapport d'analyse s'en sert aussi.
@router.get("/pays")
async def pays(db: AsyncSession = Depends(get_db)):
    return await _pays_resolus(db)


async def _pays_resolus(db: AsyncSession) -> dict:
    res = await db.execute(
        select(NacePays, RefPays.nom_fr, RefPays.code_iso2)
        .outerjoin(RefPays, NacePays.ref_pays_id == RefPays.id))
    lignes = res.all()
    if not lignes:
        return {"disponible": False, "annees": [], "editions": [], "ordre": REGIONS_ORDRE,
                "donnees": {"export": [], "import": []}}

    # Édition retenue par (sens, année) : la plus récente qui couvre l'année.
    retenue: dict = {}
    for r, _, _ in lignes:
        cle = (r.sens, r.annee)
        if r.edition > retenue.get(cle, 0):
            retenue[cle] = r.edition

    agreg: dict = defaultdict(lambda: {"valeur": 0.0, "poids": 0.0, "v": False,
                                       "p": False, "iso2": None, "membres": 0})
    for r, nom_fr, iso2 in lignes:
        if retenue[(r.sens, r.annee)] != r.edition:
            continue
        nom = nom_fr or AUTRES_PAYS
        a = agreg[(r.sens, r.annee, r.region, nom)]
        a["membres"] += 1
        if nom_fr:
            a["iso2"] = iso2
        if r.valeur is not None:
            a["valeur"] += float(r.valeur); a["v"] = True
        if r.poids is not None:
            a["poids"] += float(r.poids); a["p"] = True

    rang = {nom: i for i, nom in enumerate(REGIONS_ORDRE)}
    donnees: dict = {"export": [], "import": []}
    for cle in sorted(agreg, key=lambda k: (k[1], rang.get(k[2], 99),
                                            k[3] == AUTRES_PAYS, k[3])):
        sens, annee, region, nom = cle
        a = agreg[cle]
        donnees[sens].append({
            "pays": nom, "code_iso2": a["iso2"], "region": region, "annee": annee,
            "valeur": a["valeur"] if a["v"] else None,
            "poids": a["poids"] if a["p"] else None,
            # Nombre de libellés du rapport agrégés : > 1 pour « Autres pays »
            # et pour les pays que plusieurs graphies désignent (Yémen).
            "libelles": a["membres"],
            "edition": retenue[(sens, annee)],
        })
    return {
        "disponible": True,
        "annees": sorted({annee for (_, annee) in retenue}),
        "editions": sorted({r.edition for r, _, _ in lignes}),
        "ordre": REGIONS_ORDRE,
        "continents": REGION_CONTINENT,
        "donnees": donnees,
    }


# ── GET /nace/rapport ─────────────────────────────────────────────────────────
# Assemble en une réponse tout ce qu'un rapport d'analyse doit montrer pour
# une année : totaux et leur évolution sur toute la période, les quatre
# nomenclatures de produits, les trois granularités géographiques, et le
# classement des partenaires DANS chaque continent.
#
# Un endpoint dédié plutôt que sept appels côté client : /nace/pays pèse à lui
# seul un demi-mégaoctet (toutes années, tous partenaires), là où le rapport
# n'a besoin que de deux millésimes ; et le classement par continent se calcule
# ici, où vit la table de rattachement des régions.

TOP_RAPPORT = 10          # profondeur des classements de produits et de pays
TOP_PAR_CONTINENT = 5     # partenaires détaillés dans chaque continent


AUTRES_PRODUITS = "Autres produits"


def _classer(index: dict, sens: str, annee: int, total: float, top: int | None,
             precedent: dict | None = None, exclure: str | None = None) -> list[dict]:
    """Classement décroissant d'une famille pour un sens et une année.

    `index` est {(sens, annee, modalité): (valeur, poids)}. `exclure` écarte la
    modalité fourre-tout : « Autres produits » domine sinon le classement des
    principaux produits (23,5 % des exportations 2024, soit le premier rang)
    alors que ce n'est pas un produit. Elle est renvoyée à part, sous `reste`.
    """
    lignes = []
    for (s, a, nom), (valeur, poids) in index.items():
        if s != sens or a != annee or nom == exclure:
            continue
        v = float(valeur or 0)
        avant = (precedent or {}).get((sens, annee - 1, nom))
        vp = float((avant or (None, None))[0] or 0) if avant else None
        lignes.append({
            "nom": nom,
            "valeur": v,
            "poids": float(poids) if poids is not None else None,
            "part": (v / total * 100) if total else None,
            "variation": ((v - vp) / abs(vp) * 100) if vp else None,
        })
    lignes.sort(key=lambda x: -x["valeur"])
    return lignes[:top] if top else lignes


def _indexer(reponse: dict, col: str) -> dict:
    """{(sens, annee, modalité): (valeur, poids)} depuis une réponse résolue."""
    idx: dict = {}
    for sens in ("export", "import"):
        for r in reponse.get("donnees", {}).get(sens, []):
            idx[(sens, r["annee"], r[col])] = (r["valeur"], r["poids"])
    return idx


@router.get("/rapport")
async def rapport(annee: int | None = None, db: AsyncSession = Depends(get_db)):
    # Les six familles, résolues comme par leurs endpoints respectifs.
    familles: dict[str, tuple[dict, str]] = {}
    for cle, modele, col, alias in (
        ("principaux", NacePrincipalProduit, "produit", ALIAS),
        ("regroupes", NaceProduitRegroupe, "produit", {}),
        ("groupes", NaceGroupeUtilisation, "groupe", {}),
        ("chapitres", NaceChapitre, "chapitre", {}),
        ("continents", NaceContinent, "continent", {}),
        ("regions", NaceRegion, "region", {}),
    ):
        res = await db.execute(select(modele))
        familles[cle] = (_resoudre(res.scalars().all(), alias, col=col), col)

    cont, _ = familles["continents"]
    if not cont["disponible"]:
        return {"disponible": False, "annees": []}

    annees = cont["annees"]
    an = annee if annee in annees else annees[-1]
    idx = {cle: _indexer(rep, col) for cle, (rep, col) in familles.items()}

    # Totaux : les continents sont exhaustifs, leur somme EST le commerce
    # extérieur — c'est la propriété que verifier_pays.py contrôle.
    def total(sens: str, a: int, mesure: int = 0) -> float:
        return sum(float((v[mesure] or 0)) for (s, y, _), v in idx["continents"].items()
                   if s == sens and y == a)

    serie = [{
        "annee": a,
        "export": total("export", a), "import": total("import", a),
        "solde": total("export", a) - total("import", a),
        "couverture": (total("export", a) / total("import", a) * 100) if total("import", a) else None,
        "export_poids": total("export", a, 1), "import_poids": total("import", a, 1),
    } for a in annees]

    # Produits : une nomenclature est dite symétrique si elle liste les mêmes
    # modalités dans les deux sens. Seules celles-là ont une balance par ligne
    # (cf. le commentaire du tableau de classement côté client).
    produits = {}
    for cle in ("principaux", "groupes", "regroupes", "chapitres"):
        mods = {s: {nom for (ss, a, nom) in idx[cle] if ss == s and a == an} for s in ("export", "import")}
        # Le fourre-tout n'existe que dans les nomenclatures non exhaustives.
        fourre = AUTRES_PRODUITS if AUTRES_PRODUITS in mods["export"] | mods["import"] else None
        reste = {}
        if fourre:
            for s in ("export", "import"):
                v = float((idx[cle].get((s, an, fourre)) or (0, 0))[0] or 0)
                reste[s] = {"nom": fourre, "valeur": v,
                            "part": (v / total(s, an) * 100) if total(s, an) else None}
        produits[cle] = {
            "symetrique": bool(mods["export"]) and mods["export"] == mods["import"],
            "modalites": {s: len(mods[s] - {fourre}) for s in mods},
            "reste": reste or None,
            "export": _classer(idx[cle], "export", an, total("export", an), TOP_RAPPORT, idx[cle], fourre),
            "import": _classer(idx[cle], "import", an, total("import", an), TOP_RAPPORT, idx[cle], fourre),
        }

    # Géographie : continents et régions en entier (exhaustifs), avec leur
    # balance — les deux sens y portent les mêmes modalités.
    def zones(cle: str) -> list[dict]:
        noms = [n for (s, a, n) in idx[cle] if s == "export" and a == an]
        rang = {n: i for i, n in enumerate(REGIONS_ORDRE)}
        out = []
        for nom in noms:
            e = float((idx[cle].get(("export", an, nom)) or (0, 0))[0] or 0)
            i = float((idx[cle].get(("import", an, nom)) or (0, 0))[0] or 0)
            ep = float((idx[cle].get(("export", an - 1, nom)) or (0, 0))[0] or 0)
            ip = float((idx[cle].get(("import", an - 1, nom)) or (0, 0))[0] or 0)
            out.append({
                "nom": nom, "export": e, "import": i, "solde": e - i,
                "part_export": (e / total("export", an) * 100) if total("export", an) else None,
                "part_import": (i / total("import", an) * 100) if total("import", an) else None,
                "var_export": ((e - ep) / abs(ep) * 100) if ep else None,
                "var_import": ((i - ip) / abs(ip) * 100) if ip else None,
                "continent": REGION_CONTINENT.get(nom) if cle == "regions" else None,
            })
        out.sort(key=lambda x: rang.get(x["nom"], 99) if cle == "regions" else -(x["export"] + x["import"]))
        return out

    # Pays : classement mondial, puis DANS chaque continent — c'est la lecture
    # qu'un rapport doit offrir, « qui achète quoi où ».
    rep_pays = await _pays_resolus(db)
    par_pays: dict = {}
    for sens in ("export", "import"):
        for r in rep_pays.get("donnees", {}).get(sens, []):
            if r["annee"] not in (an, an - 1):
                continue
            cle = (sens, r["annee"], r["pays"], r["region"])
            v = par_pays.setdefault(cle, {"valeur": 0.0, "poids": 0.0, "iso2": r["code_iso2"]})
            v["valeur"] += float(r["valeur"] or 0)
            v["poids"] += float(r["poids"] or 0)

    def classer_pays(sens: str, continent: str | None, top: int) -> list[dict]:
        agg: dict = {}
        for (s, a, nom, region), v in par_pays.items():
            if s != sens or a != an or nom == AUTRES_PAYS:
                continue
            if continent and REGION_CONTINENT.get(region) != continent:
                continue
            e = agg.setdefault(nom, {"nom": nom, "iso2": v["iso2"], "valeur": 0.0,
                                     "region": region, "precedent": 0.0})
            e["valeur"] += v["valeur"]
        for (s, a, nom, _region), v in par_pays.items():
            if s == sens and a == an - 1 and nom in agg:
                agg[nom]["precedent"] += v["valeur"]
        base = total(sens, an) if continent is None else sum(x["valeur"] for x in agg.values())
        # Un partenaire sans échange sur l'année n'est pas un partenaire : sans
        # ce filtre, l'Océanie alignait trois lignes à « 0 Md · 0 % ».
        agg = {k: v for k, v in agg.items() if v["valeur"] > 0}
        for x in agg.values():
            x["part"] = (x["valeur"] / base * 100) if base else None
            p = x.pop("precedent")
            x["variation"] = ((x["valeur"] - p) / abs(p) * 100) if p else None
        return sorted(agg.values(), key=lambda x: -x["valeur"])[:top]

    continents = zones("continents")
    return {
        "disponible": True,
        "annee": an, "annees": annees,
        "editions": cont["editions"],
        # Édition qui a fourni l'année affichée (la plus récente la couvrant).
        "edition": max((r["edition"] for r in cont["donnees"]["export"] if r["annee"] == an),
                       default=None),
        "serie": serie,
        "totaux": next((x for x in serie if x["annee"] == an), None),
        "precedent": next((x for x in serie if x["annee"] == an - 1), None),
        "produits": produits,
        "geo": {
            "continents": continents,
            "regions": zones("regions"),
            "pays": {s: classer_pays(s, None, TOP_RAPPORT) for s in ("export", "import")},
            # Pour chaque continent réel (« Divers » n'en est pas un), les
            # premiers clients et fournisseurs qui s'y trouvent.
            "par_continent": [{
                "continent": c["nom"],
                "export": c["export"], "import": c["import"],
                "clients": classer_pays("export", c["nom"], TOP_PAR_CONTINENT),
                "fournisseurs": classer_pays("import", c["nom"], TOP_PAR_CONTINENT),
            } for c in continents if c["nom"] != "Divers"],
        },
    }
