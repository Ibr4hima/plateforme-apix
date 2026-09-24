#!/usr/bin/env python3
"""Saisie contrôlée — NACE édition 2025, continents.

Exportations : tableaux 23 (valeur, millions FCFA) et 24 (poids net,
tonnes). Importations : tableaux 25 (valeur) et 26 (poids). Années 2021 à 2025, transcrites ligne à ligne. Six modalités
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
# Tableaux 25 (valeur) et 26 (poids).
IMPORT = {
    "Europe":   ([2635826, 3576586, 3212405, 3083585, 2789773], [6169483, 5620376, 5853755, 5395999, 5266080]),
    "Afrique":  ([722712, 895862, 1214399, 1086271, 1091356],   [2875299, 3175189, 3651657, 3526197, 3829539]),
    "Amérique": ([399578, 560634, 457511, 521098, 616096],      [1138845, 1365632, 1178800, 1724162, 2155186]),
    "Asie":     ([1581546, 2440343, 2197049, 2221881, 2405295], [3796747, 4181713, 4381359, 4782711, 5056654]),
    "Océanie":  ([17486, 18718, 29786, 33731, 19631],           [12557, 8365, 11805, 41415, 6209]),
    "Divers":   ([21346, 57222, 96653, 65811, 51707],           [72019, 146000, 92996, 49529, 37200]),
}
# Le TOTAL 2022 en valeur est imprimé 7 549 365 dans ce tableau (7 549 364
# ailleurs) : repris tel quel, comme dans l'édition 2024 qui l'imprimait déjà
# ainsi — c'est une différence d'arrondi du rapport, non de saisie.
TOTAL_IMPORT = {
    "valeur": [5378494, 7549365, 7207803, 7012377, 6973859],
    "poids":  [14064950, 14497275, 15170373, 15520015, 16350868],
}

# Les CSV s'écrivent dans scripts/nace, où l'import de déploiement les lit ;
# ce dossier ne garde que les scripts de saisie et leurs notes.
ici = Path(__file__).parent.parent
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
