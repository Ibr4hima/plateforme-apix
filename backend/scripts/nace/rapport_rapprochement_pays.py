#!/usr/bin/env python3
"""Rapport de relecture des rattachements pays de la NACE, tels qu'en base.

    cd backend && python3 scripts/nace/rapport_rapprochement_pays.py

À la différence de verifier_rapprochement_pays.py — qui confronte une liste
de libellés au référentiel pour préparer l'arbitrage — ce script lit ce qui
a RÉELLEMENT été écrit par POST /nace/importer, en joignant nace_pays à
ref_pays. C'est donc l'état de la base qui est relu, pas une simulation.

Les rattachements sont classés par méthode, du plus sûr au plus risqué :

  1. EXACT     : le libellé égale un nom du référentiel (ou son nom CNUCED)
                 après retrait des accents et de la ponctuation. Sans risque.
  2. ALIAS     : arbitré à la main dans alias_pays_nace.json, avec sa note.
  3. RÉDUCTION : obtenu en retirant une forme d'État (« RÉPUBLIQUE DE
                 SLOVAQUIE » → Slovaquie). Faible risque.
  4. FLOU      : rapprochement approximatif, pour les coquilles
                 (« AFGANISTAN »). C'est ici que se cachent les erreurs.
  5. AUTRES PAYS : hors référentiel, par région, avec le motif et la part
                 du commerce de la région que ce regroupement représente.

Le poids commercial (valeur, dernière année de la dernière édition) est
indiqué partout : une erreur sur un partenaire à 300 milliards ne se relit
pas comme une erreur sur un partenaire à 2 millions.

Options : --ref FICHIER.tsv pour lire le référentiel hors ligne (cf.
verifier_rapprochement_pays.py), --tout pour lister aussi les
rattachements exacts un par un (ils sont résumés par défaut).
"""
import collections
import sys
from pathlib import Path

ICI = Path(__file__).parent
sys.path.insert(0, str(ICI))

from verifier_rapprochement_pays import (                        # noqa: E402
    AIDE_TSV, REQUETE_REF, charger_arbitrage, indexer_reference,
    lire_reference_tsv, pilote, url_base,
)
from app.utils.pays_matching import (                            # noqa: E402
    FORMES_ETAT, LIAISONS, normaliser_nom,
)

REQUETE_PAYS = """
SELECT p.pays, p.region, p.sens, p.annee, p.edition, p.valeur, r.nom_fr, r.code_iso2
FROM nace_pays p
LEFT JOIN ref_pays r ON r.id = p.ref_pays_id
"""


def methode(libelle: str, cible: str, alias: dict, index: dict) -> str:
    """Comment ce libellé a été rattaché — reconstruit a posteriori."""
    if libelle in alias:
        return "ALIAS"
    n = normaliser_nom(libelle)
    if n in index:
        return "EXACT"
    tokens = n.split()
    while len(tokens) > 1 and tokens[0] in FORMES_ETAT | LIAISONS:
        tokens.pop(0)
    if " ".join(tokens) in index:
        return "RÉDUCTION"
    if any(n.startswith(r + " ") and n[len(r) + 1:].split()[0] in LIAISONS for r in index):
        return "RÉDUCTION"
    return "FLOU"


def fmt(v: float) -> str:
    """Valeur brute en millions FCFA, ramenée en milliards au-delà de mille
    (le « milliard » long : mille millions)."""
    if v >= 1_000:
        return f"{v / 1_000:,.1f} Md FCFA".replace(",", " ")
    return f"{v:.0f} M FCFA"


def principal() -> int:
    args = sys.argv[1:]
    tout = "--tout" in args
    chemin_ref = None
    if "--ref" in args:
        chemin_ref = Path(args[args.index("--ref") + 1])

    alias, hors_ref = charger_arbitrage()
    if chemin_ref:
        sys.exit("--ref ne suffit pas ici : ce rapport lit la table nace_pays, "
                 "donc une connexion à la base est nécessaire.")
    pilote_pg = pilote()
    if pilote_pg is None:
        sys.exit(AIDE_TSV)
    with pilote_pg.connect(url_base()) as conn, conn.cursor() as cur:
        cur.execute(REQUETE_REF)
        index = indexer_reference(cur.fetchall())
        cur.execute(REQUETE_PAYS)
        lignes = cur.fetchall()
    if not lignes:
        sys.exit("nace_pays est vide : lancez POST /nace/importer d'abord.")
    index_noms = {k for k in index}

    # Dernière année de la dernière édition, pour peser chaque partenaire.
    edition = max(l[4] for l in lignes)
    annee = max(l[3] for l in lignes if l[4] == edition)
    poids: dict = collections.Counter()
    regions: dict = collections.defaultdict(set)
    cible: dict = {}
    sens_vus: dict = collections.defaultdict(set)
    for lib, region, sens, an, ed, valeur, nom_fr, iso2 in lignes:
        regions[lib].add(region)
        sens_vus[lib].add(sens)
        cible[lib] = (nom_fr, iso2)
        if ed == edition and an == annee and valeur is not None:
            poids[lib] += float(valeur)

    groupes: dict = collections.defaultdict(list)
    autres: dict = collections.defaultdict(list)
    for lib in sorted(cible):
        nom_fr, iso2 = cible[lib]
        if nom_fr is None:
            for region in sorted(regions[lib]):
                autres[region].append(lib)
        else:
            groupes[methode(lib, nom_fr, alias, index_noms)].append(lib)

    print(f"Base : {len(lignes)} lignes nace_pays · {len(cible)} libellés distincts")
    print(f"Poids commercial mesuré sur l'édition {edition}, année {annee}\n")

    ordre = ["EXACT", "ALIAS", "RÉDUCTION", "FLOU"]
    resume = " · ".join(f"{m} {len(groupes[m])}" for m in ordre if groupes[m])
    total_autres = sum(len(v) for v in autres.values())
    print(f"── RATTACHEMENTS : {resume} · Autres pays {total_autres} ──\n")

    notes = charger_notes()
    for m in ordre:
        libs = groupes[m]
        if not libs:
            continue
        risque = {"EXACT": "sans risque", "ALIAS": "arbitrés à la main",
                  "RÉDUCTION": "faible risque", "FLOU": "À RELIRE EN PRIORITÉ"}[m]
        print(f"── {m} — {len(libs)} libellés ({risque}) ──")
        if m == "EXACT" and not tout:
            print(f"   {', '.join(sorted(libs))}")
            print("   (--tout pour le détail ligne par ligne)\n")
            continue
        for lib in sorted(libs, key=lambda x: -poids[x]):
            nom_fr, iso2 = cible[lib]
            sens = "/".join(sorted(sens_vus[lib]))
            print(f"   {lib:32} → {nom_fr} [{iso2 or '--'}]  "
                  f"{fmt(poids[lib]):>14}  {sens}")
            if lib in notes:
                print(f"      ↳ {notes[lib]}")
        print()

    # « Autres pays » : la part du commerce de la région est le chiffre qui
    # décide si le regroupement est acceptable ou s'il faut compléter ref_pays.
    print("── AUTRES PAYS, par région ──")
    total_region: dict = collections.Counter()
    for lib, region, sens, an, ed, valeur, nom_fr, iso2 in lignes:
        if ed == edition and an == annee and valeur is not None:
            total_region[region] += float(valeur)
    for region in sorted(autres, key=lambda r: -sum(poids[l] for l in autres[r])):
        libs = autres[region]
        somme = sum(poids[l] for l in libs)
        base = total_region[region] or 1
        # La part n'a de sens qu'avec son assiette : « 85 % de l'Océanie »
        # porte sur 62 M FCFA, soit un pourcentage de presque rien.
        s = "s" if len(libs) > 1 else ""
        print(f"\n   {region} — {len(libs)} libellé{s}, {fmt(somme)} "
              f"sur {fmt(base)} soit {somme / base * 100:.2f} % de la région")
        for lib in sorted(libs, key=lambda x: -poids[x]):
            motif = hors_ref.get(lib, "⚠ hors référentiel SANS motif déclaré")
            print(f"      {lib:30} {fmt(poids[lib]):>14}  — {motif}")
    return 0


def charger_notes() -> dict:
    """Notes d'arbitrage de alias_pays_nace.json, affichées avec l'alias."""
    import json
    fic = ICI / "alias_pays_nace.json"
    if not fic.exists():
        return {}
    return json.loads(fic.read_text(encoding="utf-8")).get("_notes_alias", {})


if __name__ == "__main__":
    raise SystemExit(principal())
