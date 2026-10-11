#!/usr/bin/env python3
"""Assemble la famille pays de l'édition 2025 et écrit ses CSV.

    python3 saisie_2025_pays.py

Sources (cf. README de ce dossier), toutes dans donnees_2025_pays.py :
  · valeurs : tableaux 31 (export) et 33 (import) ;
  · poids : tableaux 32 (export) et 34 (import), COMPLETS — l'ANSD les a
    transmis en Excel, leurs versions PDF étant l'une inutilisable (32),
    l'autre tronquée (34).

LE TABLEAU 32 N'A PAS DE COLONNE 2024 (EXPORT_POIDS_ANNEES) : les poids
export 2024 sont repris de l'édition 2024, libellé par libellé. Le rapport
2025 ne les révise pas — ses colonnes 2020–2023 sont celles de l'édition 2024
au poids près, ses valeurs 2024 aussi (tableau 31), et les poids 2024 repris
bouclent sur le tableau 20 (verifier_pays.py).

Contrôles, qui arrêtent l'assemblage :
  · le TOTAL de chaque tableau de poids = celui du tableau régions (20, 22) ;
  · tout pays d'un tableau de poids a sa ligne au tableau des valeurs du même
    sens, sous la même région — sans quoi son poids serait perdu ;
  · chaque case porte une valeur ET un poids, ou ni l'un ni l'autre (« - ») :
    un pays absent du tableau de poids y avait une ligne nulle, écartée à la
    conversion, et sa valeur doit être vide aussi.

« Divers », imprimé sans détail, prend les valeurs et poids des tableaux
régions (19–22), qui font foi (cf. README : sous-totaux fautifs des tableaux
31, 32 et 33).
"""
import csv
from pathlib import Path

import donnees_2025_pays as D

ICI = Path(__file__).parent.parent  # CSV dans scripts/nace
EDITION = 2025
AN = D.ANNEES
LIBELLE_DIVERS = "DIVERS (PBE,PBF,OM,nda..; etc)"

# Arbitrage Nicaragua / Nigeria 2024 (import, valeur), cf. README.
ARBITRAGE_VALEUR_IMPORT = {("NICARAGUA", 2024): 2432, ("NIGERIA", 2024): 542046}
# Le tableau 33 range le Royaume-Uni sous l'UE ; partout ailleurs, hors UE.
REGION_FORCEE = {"ROYAUME UNI": "Autres pays d'Europe"}
# TOTAL des poids : tableaux 20 (export) et 22 (import).
TOTAL_POIDS = {"export": [8038328, 6969968, 7428616, 9599905, 14186349],
               "import": [14064950, 14497275, 15170373, 15520015, 16350868]}
# sens, valeurs, poids, années que porte le tableau des poids, son TOTAL
SOURCES = (
    ("export", D.EXPORT_VALEUR, D.EXPORT_POIDS, D.EXPORT_POIDS_ANNEES, D.EXPORT_POIDS_TOTAL),
    ("import", D.IMPORT_VALEUR, D.IMPORT_POIDS, D.IMPORT_POIDS_ANNEES, D.IMPORT_POIDS_TOTAL),
)


def lire(f):
    return list(csv.DictReader(open(f, encoding="utf-8")))


def poids_2024(sens):
    out = {}
    for r in lire(ICI / "edition_2024_pays.csv"):
        if r["sens"] == sens:
            out[(r["pays"], int(r["annee"]))] = int(r["poids"]) if r["poids"] else None
    return out


def construire():
    regions = {(r["region"], r["sens"], int(r["annee"])): (int(r["valeur"]), int(r["poids"]))
               for r in lire(ICI / "edition_2025_regions.csv")}
    lignes = []
    for sens, valeurs, poids, annees_poids, total_poids in SOURCES:
        ancien = poids_2024(sens)
        for an, tot in zip(annees_poids, total_poids):
            if tot != TOTAL_POIDS[sens][AN.index(an)]:
                raise SystemExit(f"TOTAL des poids {sens} {an} : {tot} ≠ tableau régions")
        # {pays: (région, {année: poids})}
        tab_poids = {p: (reg, dict(zip(annees_poids, v)))
                     for reg, (_, pays) in poids.items() for p, v in pays.items()}
        region_valeur = {p: REGION_FORCEE.get(p, reg)
                         for reg, (_, pays) in valeurs.items() for p in pays}
        for p, (reg, _) in tab_poids.items():
            if p not in region_valeur:
                raise SystemExit(f"{p} : poids {sens} sans ligne de valeur")
            if reg != region_valeur[p]:
                raise SystemExit(f"{p} : région {reg} au tableau des poids, "
                                 f"{region_valeur[p]} à celui des valeurs ({sens})")
        for region, (_, pays) in valeurs.items():
            if region == "Divers":
                for an in AN:
                    v, w = regions[("Divers", sens, an)]
                    lignes.append([LIBELLE_DIVERS, "Divers", sens, an, v, w])
                continue
            for p, vals in pays.items():
                reg = REGION_FORCEE.get(p, region)
                for i, an in enumerate(AN):
                    v = ARBITRAGE_VALEUR_IMPORT.get((p, an), vals[i]) if sens == "import" else vals[i]
                    if an in annees_poids:
                        w = tab_poids[p][1][an] if p in tab_poids else None
                    else:  # année que le tableau ne porte pas (32 : 2024)
                        w = ancien.get((p, an))
                    if (v is None) != (w is None):
                        raise SystemExit(f"{p} · {sens} · {an} : valeur {v}, poids {w} "
                                         "— l'un sans l'autre")
                    lignes.append([p, reg, sens, an, "" if v is None else v, "" if w is None else w])
    return lignes


def ecrire():
    lignes = construire()
    with open(ICI / f"edition_{EDITION}_pays.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["pays", "region", "sens", "annee", "valeur", "poids", "edition"])
        for l in lignes:
            w.writerow(l + [EDITION])
    # Aucun poids n'est plus déclaré manquant : le tableau 32 complet a remplacé
    # les 152 poids export 2025 déclarés jusque-là. Un fichier resté d'une
    # génération antérieure ferait griser « Volume » à tort (API, page).
    (ICI / f"edition_{EDITION}_poids_manquants.csv").unlink(missing_ok=True)
    # TOTAL : valeurs des tableaux 31/33, poids des tableaux 20/22.
    with open(ICI / f"edition_{EDITION}_totaux_pays.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["sens", "mesure", "annee", "total", "edition"])
        for sens, tv in (("export", D.EXPORT_VALEUR_TOTAL), ("import", D.IMPORT_VALEUR_TOTAL)):
            for mesure, tot in (("valeur", tv), ("poids", TOTAL_POIDS[sens])):
                for i, an in enumerate(AN):
                    w.writerow([sens, mesure, an, tot[i], EDITION])
    print(f"{len(lignes)} lignes pays, valeur et poids complets dans les deux sens.")


if __name__ == "__main__":
    ecrire()
