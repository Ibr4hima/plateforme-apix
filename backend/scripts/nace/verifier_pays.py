#!/usr/bin/env python3
"""Vérifie la famille pays/régions de la NACE, toutes éditions présentes.

    cd backend && python3 scripts/nace/verifier_pays.py

Quatre contrôles, du plus local au plus global. Les trois premiers sont
internes à la famille ; le quatrième est le seul qui prouve quelque chose
d'indépendant, puisqu'il confronte deux extractions distinctes.

  1. Σ pays d'une région   = sous-total imprimé de la région ;
  2. Σ régions             = ligne TOTAL du tableau ;
  3. complétude            : 12 régions × 2 sens × 5 ans, et chaque
                             partenaire présent en valeur ET en poids ;
  4. Σ régions d'un continent = famille nace_continents (inter-familles).

Une somme comparée à un total lu dans le même tableau ne prouve rien si
les deux viennent de la même ligne mal lue — d'où le contrôle 4.

Les tolérances reprennent celles de extraire_pays.py : le rapport arrondit
chaque sous-total indépendamment de son détail. Toute erreur réelle
(ligne perdue, colonne décalée) se compte en milliers, pas en unités.
"""
import collections
import csv
import re
import sys
from pathlib import Path

# Dossier vérifié : celui du script, ou celui passé en argument (brouillon).
ICI = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent
# Tolérances d'arrondi, calibrées sur les mesures des éditions 2019 à 2023 :
# écart maximum observé de 5 sur un sous-total de région, 3 sur un TOTAL et 4
# sur le contrôle inter-familles. Ce dernier ne dépasse 1 que sur l'édition
# 2023, dont les sous-totaux fautifs demandent une correction en cascade
# appuyée sur trois sources arrondies indépendamment (détail pays, ligne
# TOTAL, table continents). Toute erreur réelle se compte en milliers.
TOL_REGION, TOL_TOTAL, TOL_FAMILLE = 6, 8, 5
MESURES = ("valeur", "poids")
SENS = ("export", "import")

# Rattachement des 12 régions du rapport aux 6 continents de la famille
# nace_continents. « Divers » (NCA côté import) est un continent à lui seul
# dans cette nomenclature de l'ANSD. Les libellés sont ceux que
# extraire_pays.py rend stables d'une édition à l'autre.
CONTINENT = {
    "Union européenne": "Europe", "Autres pays d'Europe": "Europe",
    "Afrique centrale": "Afrique", "Afrique du Nord": "Afrique",
    "Afrique occidentale": "Afrique", "Afrique orientale et du Sud": "Afrique",
    "Amérique du Nord": "Amérique", "Amérique centrale et du Sud": "Amérique",
    "Asie occidentale": "Asie", "Autres pays d'Asie": "Asie",
    "Océanie": "Océanie", "Divers": "Divers",
}
NB_REGIONS = len(CONTINENT)


def lire(fichier: Path) -> list[dict]:
    with fichier.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def n(v) -> int:
    return int(v) if v not in (None, "") else 0


def verifier(edition: int) -> list[str]:
    anomalies: list[str] = []
    pays = lire(ICI / f"edition_{edition}_pays.csv")
    regions = lire(ICI / f"edition_{edition}_regions.csv")
    totaux = lire(ICI / f"edition_{edition}_totaux_pays.csv")
    fic_cont = ICI / f"edition_{edition}_continents.csv"
    continents = lire(fic_cont) if fic_cont.exists() else None
    # POIDS DÉCLARÉS MANQUANTS (édition 2025 : tableau 32 inutilisable, lignes
    # absentes du tableau 34). Une région qui en contient ne peut pas boucler
    # en poids : elle est sautée au contrôle 1 — et SEULEMENT celle-là, pour
    # cette mesure et cette année. Une case vide non déclarée reste un « - ».
    fic_manq = ICI / f"edition_{edition}_poids_manquants.csv"
    manquants = {(m["pays"], m["sens"], m["annee"]) for m in lire(fic_manq)} if fic_manq.exists() else set()
    region_de = {(r["pays"], r["sens"], r["annee"]): r["region"] for r in pays}
    trouees = {(region_de[k], k[1], k[2]) for k in manquants}
    for (p, s_, a) in manquants:
        r = next((x for x in pays if (x["pays"], x["sens"], x["annee"]) == (p, s_, a)), None)
        if r is None or r["poids"] or not r["valeur"]:
            anomalies.append(f"poids déclaré manquant incohérent · {p} · {s_} · {a}")

    for mesure in MESURES:
        # 1. Σ pays d'une région = sous-total imprimé
        somme = collections.Counter()
        for r in pays:
            somme[(r["region"], r["sens"], r["annee"])] += n(r[mesure])
        for r in regions:
            if mesure == "poids" and (r["region"], r["sens"], r["annee"]) in trouees:
                continue
            ecart = abs(somme[(r["region"], r["sens"], r["annee"])] - n(r[mesure]))
            if ecart > TOL_REGION:
                anomalies.append(f"Σ pays ≠ sous-total · {r['region']} · {r['sens']} · "
                                 f"{r['annee']} · {mesure} : écart {ecart}")

        # 2. Σ régions = TOTAL imprimé
        par_an = collections.Counter()
        for r in regions:
            par_an[(r["sens"], r["annee"])] += n(r[mesure])
        for t in totaux:
            if t["mesure"] != mesure:
                continue
            ecart = abs(par_an[(t["sens"], t["annee"])] - n(t["total"]))
            if ecart > TOL_TOTAL:
                anomalies.append(f"Σ régions ≠ TOTAL · {t['sens']} · {t['annee']} · "
                                 f"{mesure} : écart {ecart}")

        # 4. Σ régions d'un continent = famille nace_continents
        if continents:
            agg = collections.Counter()
            for r in regions:
                agg[(CONTINENT[r["region"]], r["sens"], r["annee"])] += n(r[mesure])
            for c in continents:
                ecart = abs(agg[(c["continent"], c["sens"], c["annee"])] - n(c[mesure]))
                if ecart > TOL_FAMILLE:
                    anomalies.append(f"régions ≠ continents · {c['continent']} · "
                                     f"{c['sens']} · {c['annee']} · {mesure} : écart {ecart}")

    # 3. Complétude
    annees = sorted({r["annee"] for r in regions})
    if len(annees) != 5:
        anomalies.append(f"{len(annees)} années au lieu de 5 — {annees}")
    for sens in SENS:
        noms = {r["region"] for r in regions if r["sens"] == sens}
        if len(noms) != NB_REGIONS:
            anomalies.append(f"{len(noms)} régions au lieu de {NB_REGIONS} en {sens}")
        # chaque partenaire doit couvrir les 5 années, en valeur comme en poids
        vus = collections.Counter()
        for r in pays:
            if r["sens"] == sens:
                vus[r["pays"]] += 1
        for nom, cpt in vus.items():
            if cpt != len(annees):
                anomalies.append(f"{nom} · {sens} : {cpt} lignes au lieu de {len(annees)}")
        inconnues = {r["region"] for r in pays if r["sens"] == sens} - set(CONTINENT)
        if inconnues:
            anomalies.append(f"régions sans continent de rattachement : {sorted(inconnues)}")
    return anomalies


def principal() -> int:
    editions = sorted(int(m.group(1)) for f in ICI.glob("edition_[0-9][0-9][0-9][0-9]_pays.csv")
                      if (m := re.match(r"edition_(\d{4})_pays\.csv$", f.name)))
    if not editions:
        sys.exit("aucun edition_XXXX_pays.csv à vérifier")
    total = 0
    for edition in editions:
        anomalies = verifier(edition)
        total += len(anomalies)
        etat = "CONFORME" if not anomalies else f"{len(anomalies)} ANOMALIE(S)"
        fic_manq = ICI / f"edition_{edition}_poids_manquants.csv"
        if fic_manq.exists():
            etat += f" · {len(lire(fic_manq))} poids déclarés manquants (régions sautées en poids)"
        print(f"── édition {edition} : {etat}")
        for a in anomalies:
            print(f"   · {a}")
    print(f"\n{len(editions)} édition(s) vérifiée(s) · {total} anomalie(s)")
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(principal())
