#!/usr/bin/env python3
"""Saisie contrôlée — NACE édition 2025, groupes d'utilisation.

Exportations : tableaux 14 (valeur, millions FCFA) et 15 (poids net,
tonnes). Importations : tableaux 16 (valeur) et 17 (poids). Années 2021 à 2025, transcrites ligne à ligne. Les 9 groupes sont
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
# Tableaux 16 (valeur) et 17 (poids) — mêmes 9 groupes.
IMPORT = {
    "Alimentation, boissons et tabacs":          ([1098832, 1371667, 1282275, 1288469, 1344540], [3565834, 4050731, 4151577, 4414749, 4764538]),
    "Énergie et lubrifiants":                    ([1358956, 2389906, 2140360, 2186990, 1953086], [5076918, 5039603, 5888338, 6341760, 6440895]),
    "Matières premières animales et végétales":  ([81893, 108883, 93909, 94909, 90525],          [173170, 254400, 302578, 227331, 226531]),
    "Matières premières minérales":              ([110055, 186649, 94450, 90629, 140484],        [979093, 910592, 1073333, 960863, 931662]),
    "Autres demi-produits":                      ([1168732, 1543340, 1379389, 1229328, 1279100], [3364208, 3226693, 2673074, 2393684, 2740557]),
    "Produits finis destinés à l'agriculture":   ([14619, 12283, 16154, 13144, 13621],           [6723, 5756, 7657, 7119, 8222]),
    "Produits finis destinés à l'industrie":     ([854435, 1192982, 1374060, 1236153, 1310472],  [293568, 368362, 378126, 382075, 408716]),
    "Produits finis destinés à la consommation": ([690971, 743526, 825934, 872146, 842008],      [605435, 641138, 695688, 792434, 829747]),
    "Or industriel":                             ([1, 128, 1274, 609, 24],                       [0, 0, 0, 0, 0]),
}
TOTAL_IMPORT = {
    "valeur": [5378494, 7549364, 7207803, 7012377, 6973859],
    "poids":  [14064950, 14497275, 15170373, 15520015, 16350868],
}

# Les CSV s'écrivent dans scripts/nace, où l'import de déploiement les lit ;
# ce dossier ne garde que les scripts de saisie et leurs notes.
ici = Path(__file__).parent.parent
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
