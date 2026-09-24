#!/usr/bin/env python3
"""Saisie contrôlée — NACE édition 2025, principaux produits.

Exportations : tableau 6 (valeur, millions FCFA) et tableau 7 (poids net,
tonnes). Importations : tableau 8 (valeur) et tableau 9 (poids). Années
2021 à 2025, transcrites ligne à ligne depuis le rapport. Les libellés
d'import sont ceux, normalisés, des éditions précédentes (le rapport écrit
« Machines et Appareils », « Produits Céréaliers », « Matériels de
Transports et Pièces détachées » : cf. README du dossier parent). « - » du
rapport (absence de flux) = None, stocké vide (NULL), distinct d'un 0.
Les lignes TOTAL du rapport sont saisies à part : elles ne servent qu'au
contrôle (somme des lignes = TOTAL imprimé).
"""
import csv
from pathlib import Path

ANNEES = [2021, 2022, 2023, 2024, 2025]
EDITION = 2025
_ = None  # « - » du rapport

# produit: ([valeur 2021..2025], [poids 2021..2025]) — ordre du rapport
EXPORT = {
    "Produits halieutiques":      ([312981, 423370, 345278, 340509, 348311],  [312116, 299704, 273982, 251347, 251188]),
    "Produits arachidiers":       ([168571, 100838, 70223, 72275, 21915],     [348816, 191919, 121239, 127883, 24960]),
    "Huile brute de pétrole":     ([11017, 1545, 15959, 464555, 1527997],     [73045, 6928, 63690, 1427941, 5119888]),
    "Autres produits pétroliers": ([436885, 648822, 676438, 791942, 860646],  [1303545, 1072595, 1192516, 1412012, 1783976]),
    "Gaz naturel liquéfié":       ([_, _, _, _, 115868],                      [_, _, _, _, 593346]),
    "Acide phosphorique":         ([265348, 471868, 264686, 264417, 264696],  [478435, 558409, 492886, 499185, 415328]),
    "Ciment hydraulique":         ([86231, 75747, 106480, 108838, 113629],    [2123572, 1631621, 2149919, 2282279, 2527722]),
    "Phosphates":                 ([22050, 47732, 49886, 55433, 47141],       [553448, 486545, 569208, 717942, 619911]),
    "Engrais minéraux":           ([33057, 9318, 37787, 28830, 61251],        [121978, 30411, 130511, 67768, 156716]),
    "Cotons et tissus en coton":  ([9005, 12551, 8428, 6640, 6397],           [9160, 8931, 5991, 5643, 6319]),
    "Or industriel":              ([539778, 580607, 530410, 588502, 977997],  [19, 18, 17, 16, 19]),
    "Titane et zircon":           ([150304, 203428, 146605, 175572, 154143],  [679377, 597351, 476881, 668430, 701408]),
    "Préparations pour soupes, potages, bouillons":
                                  ([84285, 102989, 90341, 93465, 20765],      [79593, 81083, 66034, 67475, 15234]),
    "Autres produits":            ([765289, 884545, 881410, 918081, 1284870], [1955225, 2004454, 1885743, 2071985, 1970333]),
}
TOTAL_EXPORT = {
    "valeur": [2884802, 3563359, 3223930, 3909058, 5805626],
    "poids":  [8038328, 6969968, 7428616, 9599905, 14186349],
}

# Tableaux 8 et 9 — mêmes 11 produits que l'édition 2024.
IMPORT = {
    "Machines et appareils":                        ([681044, 788076, 878556, 964805, 844214],       [217875, 247700, 267066, 286098, 280281]),
    "Produits céréaliers":                          ([484919, 684327, 578778, 570792, 599768],       [2360667, 2768452, 2659353, 2833829, 3026811]),
    "Matériels de transport et pièces détachées":   ([389358, 612422, 776668, 571196, 784850],       [207933, 227618, 234090, 269536, 314733]),
    "Huiles brutes de pétrole":                     ([284625, 278083, 577392, 492592, 494510],       [1023899, 503909, 1318187, 1175330, 1420868]),
    "Produits pétroliers finis":                    ([1014771, 1992035, 1421415, 1592284, 1371333],  [3093699, 3645960, 3055172, 3744937, 3707450]),
    "Métaux communs et ouvrages en métaux communs": ([408603, 527293, 468394, 387465, 424833],       [753220, 737194, 716166, 559693, 860748]),
    "Matières plastiques et artificielles":         ([173074, 219988, 188673, 194255, 191571],       [181258, 201653, 218023, 236731, 227831]),
    "Produits pharmaceutiques":                     ([189115, 195813, 203219, 218793, 216602],       [17195, 18245, 18869, 19174, 22529]),
    "Huiles et graisses":                           ([123804, 127037, 119602, 107056, 114261],       [225294, 202602, 201001, 240288, 304889]),
    "Produits des industries parachimiques":        ([103961, 115921, 120749, 124742, 115138],       [80799, 90437, 81015, 97454, 86244]),
    "Autres produits":                              ([1525220, 2008368, 1874357, 1788397, 1816778],  [5903111, 5853505, 6401432, 6056945, 6098484]),
}
TOTAL_IMPORT = {
    "valeur": [5378494, 7549364, 7207803, 7012377, 6973859],
    "poids":  [14064950, 14497275, 15170373, 15520015, 16350868],
}

# Les CSV s'écrivent dans scripts/nace, où l'import de déploiement les lit ;
# ce dossier ne garde que les scripts de saisie et leurs notes.
ici = Path(__file__).parent.parent
with open(ici / f"edition_{EDITION}_principaux_produits.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["produit", "sens", "annee", "valeur", "poids", "edition"])
    for sens, table in (("export", EXPORT), ("import", IMPORT)):
        for produit, (val, pds) in table.items():
            assert len(val) == len(pds) == 5, produit
            for i, an in enumerate(ANNEES):
                w.writerow([produit, sens, an,
                            "" if val[i] is None else val[i],
                            "" if pds[i] is None else pds[i], EDITION])
with open(ici / f"edition_{EDITION}_totaux.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sens", "mesure", "annee", "total", "edition"])
    for sens, totaux in (("export", TOTAL_EXPORT), ("import", TOTAL_IMPORT)):
        for mesure, tot in totaux.items():
            for i, an in enumerate(ANNEES):
                w.writerow([sens, mesure, an, tot[i], EDITION])
print(f"{len(EXPORT)} produits export, {len(IMPORT)} produits import × {len(ANNEES)} ans écrits.")
