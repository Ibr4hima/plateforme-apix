#!/usr/bin/env python3
"""Saisie contrôlée — NACE édition 2025, régions.

Exportations : tableaux 19 (valeur, millions FCFA) et 20 (poids net,
tonnes). Importations : tableaux 21 (valeur) et 22 (poids). Années 2021 à 2025. L'édition 2025 publie les régions dans des
tableaux à part (jusqu'en 2024, elles n'existaient que comme sous-totaux des
tableaux par pays). Libellés ramenés aux 12 régions stables des éditions
précédentes (cf. REGIONS_ORDRE dans app/api/routes/nace.py).

DEUX POINTS PROPRES À CETTE ÉDITION, établis contre le détail par pays de
l'édition 2024 (cf. README du dossier) :

1. LES ÉTIQUETTES DES DEUX RÉGIONS D'AMÉRIQUE SONT INTERVERTIES dans les
   tableaux 19 et 20. Les montants imprimés sur la ligne « AMERIQUE DU NORD »
   sont exactement ceux de l'Amérique centrale et du Sud de l'édition 2024,
   et inversement, pour les 4 années communes, en valeur comme en poids
   (16 égalités). « Amérique du Nord » = États-Unis + Canada : 70 741 MFCFA
   en 2021, quand la ligne ainsi étiquetée porte 43 412. Chaque montant est
   donc saisi sous sa VRAIE région.

2. LE ROYAUME-UNI SORT DE L'UNION EUROPÉENNE (Brexit, appliqué dès 2021) :
   la région perd chaque année exactement les exportations britanniques, que
   « Autres pays d'Europe » gagne. Changement réel, conservé tel quel.
"""
import csv
from pathlib import Path

ANNEES = [2021, 2022, 2023, 2024, 2025]
EDITION = 2025

# région: ([valeur 2021..2025], [poids 2021..2025]) — ordre du rapport
EXPORT = {
    "Union européenne":            ([327069, 354541, 297088, 459469, 1549081],     [553995, 552770, 622871, 991966, 4152963]),
    "Autres pays d'Europe":        ([504832, 536871, 496549, 604844, 875735],      [630639, 472402, 399437, 650401, 618375]),
    "Afrique centrale":            ([56135, 47261, 53404, 43047, 60679],           [47090, 46736, 44378, 37346, 39385]),
    "Afrique du Nord":             ([10175, 19691, 26575, 38003, 83948],           [9607, 19828, 22723, 29022, 260873]),
    "Afrique occidentale":         ([1078579, 1330147, 1322560, 1353306, 1526954], [4768169, 4137996, 4568833, 4956104, 5458050]),
    "Afrique orientale et du Sud": ([7232, 7353, 6700, 11809, 8397],               [64160, 4187, 3391, 27193, 3121]),
    # Imprimé sur la ligne « LES PAYS DE L'AMERIQUE CENTRALE ET DU SUD » (étiquettes interverties).
    "Amérique du Nord":            ([70741, 104844, 96709, 136216, 225952],        [145656, 108531, 70589, 73456, 516430]),
    # Imprimé sur la ligne « LES PAYS DE L'AMERIQUE DU NORD » (étiquettes interverties).
    "Amérique centrale et du Sud": ([43412, 19592, 25545, 20512, 35244],           [103182, 59390, 116950, 129862, 130208]),
    "Asie occidentale":            ([43590, 68506, 58694, 56779, 107833],          [186163, 189552, 6770, 3896, 142654]),
    "Autres pays d'Asie":          ([533860, 798096, 568095, 865731, 948799],      [1244653, 1170568, 1303136, 2282030, 2575690]),
    "Océanie":                     ([122348, 142974, 109111, 90111, 206141],       [2292, 3195, 21789, 2643, 1955]),
    "Divers":                      ([86830, 133485, 162901, 229230, 176863],       [282723, 204812, 247750, 415986, 286645]),
}
TOTAL_EXPORT = {
    "valeur": [2884802, 3563359, 3223930, 3909058, 5805626],
    "poids":  [8038328, 6969968, 7428616, 9599905, 14186349],
}
# Tableaux 21 (valeur) et 22 (poids) — même interversion des deux lignes
# d'Amérique qu'à l'export (vérifiée de même contre l'édition 2024).
IMPORT = {
    "Union européenne":            ([1831925, 2585777, 2288963, 2076758, 1888516], [3297827, 3652777, 3153186, 3020946, 2821726]),
    "Autres pays d'Europe":        ([803902, 990809, 923442, 1006827, 901257],     [2871655, 1967599, 2700569, 2375054, 2444354]),
    "Afrique centrale":            ([19410, 20020, 19600, 19859, 15337],           [78209, 81681, 85322, 79151, 75110]),
    "Afrique du Nord":             ([183143, 212397, 279360, 241560, 243920],      [992899, 1368756, 1005761, 773967, 876073]),
    "Afrique occidentale":         ([430163, 488753, 756711, 676091, 700625],      [1341406, 918251, 1680962, 1658059, 1985852]),
    "Afrique orientale et du Sud": ([89996, 174692, 158727, 148760, 131474],       [462785, 806501, 879612, 1015020, 892504]),
    # Imprimé sur la ligne « LES PAYS DE L'AMERIQUE CENTRALE ET DU SUD ».
    "Amérique du Nord":            ([178182, 227203, 198649, 223609, 291845],      [267779, 299816, 228562, 387742, 715335]),
    # Imprimé sur la ligne « LES PAYS DE L'AMERIQUE DU NORD ».
    "Amérique centrale et du Sud": ([221396, 333430, 258862, 297489, 324251],      [871067, 1065816, 950238, 1336420, 1439851]),
    "Asie occidentale":            ([293117, 498735, 457115, 525104, 411407],      [1196933, 1256556, 1311655, 1595213, 1253038]),
    "Autres pays d'Asie":          ([1288429, 1941608, 1739934, 1696777, 1993889], [2599814, 2925157, 3069704, 3187498, 3803616]),
    "Océanie":                     ([17486, 18718, 29786, 33731, 19631],           [12557, 8365, 11805, 41415, 6209]),
    "Divers":                      ([21346, 57222, 96653, 65811, 51707],           [72019, 146000, 92996, 49529, 37200]),
}
TOTAL_IMPORT = {
    "valeur": [5378494, 7549365, 7207803, 7012377, 6973859],
    "poids":  [14064950, 14497275, 15170373, 15520015, 16350868],
}

# Écrit à côté de lui-même : les CSV restent dans le dossier du script.
ici = Path(__file__).parent
with open(ici / f"edition_{EDITION}_regions.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["region", "sens", "annee", "valeur", "poids", "edition"])
    for sens, table in (("export", EXPORT), ("import", IMPORT)):
        for region, (val, pds) in table.items():
            assert len(val) == len(pds) == 5, region
            for i, an in enumerate(ANNEES):
                w.writerow([region, sens, an, val[i], pds[i], EDITION])
# Les TOTAL des tableaux régions ne servent qu'au contrôle : ils rejoindront
# edition_2025_totaux_pays.csv avec les tableaux par pays.
TOTAUX = {"export": TOTAL_EXPORT, "import": TOTAL_IMPORT}
print(f"{len(EXPORT)} régions export, {len(IMPORT)} régions import × {len(ANNEES)} ans écrits.")
