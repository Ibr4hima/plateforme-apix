#!/usr/bin/env python3
"""Saisie contrôlée — NACE édition 2025, groupes d'utilisation.

Exportations : tableaux 14 (valeur, millions FCFA) et 15 (poids net,
tonnes). Années 2021 à 2025, transcrites ligne à ligne. Les 9 groupes sont
EXHAUSTIFS : leur somme est le total du commerce extérieur. Libellés du
rapport (capitales, « ALIMENTATION - BOISSONS - TABACS ») ramenés à ceux,
normalisés, des éditions précédentes.
"""
import csv
from pathlib import Path

ANNEES = [2021, 2022, 2023, 2024, 2025]
EDITION = 2025

# groupe: ([valeur 2021..2025], [poids 2021..2025]) — ordre du rapport
EXPORT = {
    "Alimentation, boissons et tabacs":          ([697972, 851722, 780622, 756526, 839935],    [890008, 887204, 858499, 767894, 847353]),
    "Énergie et lubrifiants":                    ([447966, 650468, 692543, 1256813, 2504668],  [1376651, 1079559, 1256269, 2840023, 7497248]),
    "Matières premières animales et végétales":  ([188585, 137507, 89436, 99689, 47927],       [377392, 222971, 146677, 170408, 58356]),
    "Matières premières minérales":              ([223429, 316163, 265917, 306372, 271587],    [2056774, 2003890, 1915554, 2355070, 2030077]),
    "Autres demi-produits":                      ([572428, 806928, 648568, 658504, 711452],    [3192892, 2665415, 3138146, 3343045, 3598944]),
    "Produits finis destinés à l'agriculture":   ([163, 222, 254, 402, 643],                   [56, 99, 56, 95, 141]),
    "Produits finis destinés à l'industrie":     ([60019, 54318, 58448, 85484, 212393],        [18481, 12990, 15790, 43210, 60724]),
    "Produits finis destinés à la consommation": ([154463, 165424, 157734, 156765, 239025],    [126055, 97822, 97608, 80144, 93485]),
    "Or industriel":                             ([539778, 580607, 530410, 588502, 977997],    [19, 18, 17, 16, 19]),
}
TOTAL_EXPORT = {
    "valeur": [2884802, 3563359, 3223930, 3909058, 5805626],
    "poids":  [8038328, 6969968, 7428616, 9599905, 14186349],
}
IMPORT: dict = {}        # tableaux d'importations — à saisir
TOTAL_IMPORT: dict = {}

# Écrit à côté de lui-même : les CSV restent dans le dossier du script.
ici = Path(__file__).parent
with open(ici / f"edition_{EDITION}_groupes_utilisation.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["groupe", "sens", "annee", "valeur", "poids", "edition"])
    for sens, table in (("export", EXPORT), ("import", IMPORT)):
        for groupe, (val, pds) in table.items():
            assert len(val) == len(pds) == 5, groupe
            for i, an in enumerate(ANNEES):
                w.writerow([groupe, sens, an, val[i], pds[i], EDITION])
with open(ici / f"edition_{EDITION}_totaux_groupes.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sens", "mesure", "annee", "total", "edition"])
    for sens, totaux in (("export", TOTAL_EXPORT), ("import", TOTAL_IMPORT)):
        for mesure, tot in totaux.items():
            for i, an in enumerate(ANNEES):
                w.writerow([sens, mesure, an, tot[i], EDITION])
print(f"{len(EXPORT)} groupes export, {len(IMPORT)} groupes import × {len(ANNEES)} ans écrits.")
