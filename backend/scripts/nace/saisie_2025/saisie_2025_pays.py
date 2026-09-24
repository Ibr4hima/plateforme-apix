#!/usr/bin/env python3
"""Assemble la famille pays de l'édition 2025 et écrit ses CSV.

    python3 saisie_2025_pays.py

Sources (cf. README de ce dossier) :
  · valeurs : tableaux 31 (export) et 33 (import), dans donnees_2025_pays.py ;
  · poids import : tableau 34, dont une partie manque au PDF ;
  · poids export : tableau 32 inutilisable (reprise de l'édition 2023).

LES POIDS QUE LE RAPPORT NE DONNE PAS NE SONT PAS INVENTÉS.
  · 2021–2024 : repris de l'édition 2024 pour chaque libellé. Le rapport 2025
    ne les révise pas (vérifié sur tout ce qu'il imprime : seuls Croatie,
    Chine, Nicaragua et Nigeria bougent, et ils figurent au tableau 34) ;
  · 2025 : laissés vides ET DÉCLARÉS dans edition_2025_poids_manquants.csv,
    que le vérificateur et l'API lisent. Une case vide non déclarée reste un
    « - » du rapport (absence de flux).

« Divers », imprimé sans détail, prend les valeurs et poids des tableaux
régions (19–22), qui font foi (cf. README : sous-totaux fautifs des tableaux
31 et 33).
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
    lignes, manquants = [], []
    for sens, valeurs, poids_saisis in (("export", D.EXPORT_VALEUR, {}),
                                        ("import", D.IMPORT_VALEUR, D.IMPORT_POIDS)):
        ancien = poids_2024(sens)
        tab_poids = {p: v for _, (_, pays) in poids_saisis.items() for p, v in pays.items()}
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
                    if p in tab_poids:
                        w = tab_poids[p][i]
                    elif an <= 2024:
                        w = ancien.get((p, an))
                        if v is not None and w is None and (p, an) not in ancien:
                            raise SystemExit(f"poids {sens} {an} introuvable pour {p}")
                    else:
                        w = None
                        if v is not None:
                            manquants.append([p, sens, an])
                    lignes.append([p, reg, sens, an, "" if v is None else v, "" if w is None else w])
    return lignes, manquants


def ecrire():
    lignes, manquants = construire()
    with open(ICI / f"edition_{EDITION}_pays.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["pays", "region", "sens", "annee", "valeur", "poids", "edition"])
        for l in lignes:
            w.writerow(l + [EDITION])
    with open(ICI / f"edition_{EDITION}_poids_manquants.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["pays", "sens", "annee"])
        w.writerows(manquants)
    # TOTAL : valeurs des tableaux 31/33, poids des tableaux 20/22.
    tot_poids = {"export": [8038328, 6969968, 7428616, 9599905, 14186349],
                 "import": [14064950, 14497275, 15170373, 15520015, 16350868]}
    with open(ICI / f"edition_{EDITION}_totaux_pays.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["sens", "mesure", "annee", "total", "edition"])
        for sens, tv in (("export", D.EXPORT_VALEUR_TOTAL), ("import", D.IMPORT_VALEUR_TOTAL)):
            for mesure, tot in (("valeur", tv), ("poids", tot_poids[sens])):
                for i, an in enumerate(AN):
                    w.writerow([sens, mesure, an, tot[i], EDITION])
    print(f"{len(lignes)} lignes pays, {len(manquants)} poids 2025 déclarés manquants.")


if __name__ == "__main__":
    ecrire()
