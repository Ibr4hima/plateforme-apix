#!/usr/bin/env python3
"""Saisie contrôlée — NACE édition 2025, continents.

Exportations : tableaux 23 (valeur, millions FCFA) et 24 (poids net,
tonnes). Années 2021 à 2025, transcrites ligne à ligne. Six modalités
EXHAUSTIVES (Europe, Afrique, Amérique, Asie, Océanie, Divers) : leur somme
est le total du commerce extérieur. Libellés du rapport (« EUROPE »,
« AMERIQUE »…) ramenés aux formes courtes des éditions précédentes.
"""
import csv
from pathlib import Path

ANNEES = [2021, 2022, 2023, 2024, 2025]
EDITION = 2025

# continent: ([valeur 2021..2025], [poids 2021..2025]) — ordre du rapport
EXPORT = {
    "Europe":   ([831900, 891411, 793637, 1064313, 2424816],    [1184633, 1025172, 1022308, 1642367, 4771338]),
    "Afrique":  ([1152121, 1404451, 1409238, 1446165, 1679978], [4889026, 4208747, 4639324, 5049665, 5761428]),
    "Amérique": ([114152, 124436, 122255, 156728, 261196],      [248837, 167922, 187539, 203318, 646639]),
    "Asie":     ([577450, 866602, 626789, 922510, 1056632],     [1430816, 1360119, 1309906, 2285926, 2718344]),
    "Océanie":  ([122348, 142974, 109111, 90111, 206141],       [2292, 3195, 21789, 2643, 1955]),
    "Divers":   ([86830, 133485, 162901, 229230, 176863],       [282723, 204812, 247750, 415986, 286645]),
}
TOTAL_EXPORT = {
    "valeur": [2884802, 3563359, 3223930, 3909058, 5805626],
    "poids":  [8038328, 6969968, 7428616, 9599905, 14186349],
}
IMPORT: dict = {}        # tableaux d'importations — à saisir
TOTAL_IMPORT: dict = {}

# Écrit à côté de lui-même : les CSV restent dans le dossier du script.
ici = Path(__file__).parent
with open(ici / f"edition_{EDITION}_continents.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["continent", "sens", "annee", "valeur", "poids", "edition"])
    for sens, table in (("export", EXPORT), ("import", IMPORT)):
        for cont, (val, pds) in table.items():
            assert len(val) == len(pds) == 5, cont
            for i, an in enumerate(ANNEES):
                w.writerow([cont, sens, an, val[i], pds[i], EDITION])
with open(ici / f"edition_{EDITION}_totaux_continents.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sens", "mesure", "annee", "total", "edition"])
    for sens, totaux in (("export", TOTAL_EXPORT), ("import", TOTAL_IMPORT)):
        for mesure, tot in totaux.items():
            for i, an in enumerate(ANNEES):
                w.writerow([sens, mesure, an, tot[i], EDITION])
print(f"{len(EXPORT)} continents export, {len(IMPORT)} continents import × {len(ANNEES)} ans écrits.")
