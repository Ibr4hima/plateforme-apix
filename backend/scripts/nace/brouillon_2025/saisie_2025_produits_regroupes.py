#!/usr/bin/env python3
"""Saisie contrôlée — NACE édition 2025, exportations par produits regroupés.

Tableau 10 (valeur, millions FCFA) et tableau 11 (poids net, tonnes),
années 2021 à 2025, transcrits ligne à ligne. Le rapport imprime ses
libellés en capitales sans accents : on reprend ceux, normalisés, des
éditions précédentes (cf. README du dossier parent), dans l'ordre du
rapport. « - » (absence de flux) = None, stocké vide (NULL) ; un « 0 »
imprimé reste 0 — le rapport distingue les deux (farine de froment 2024).
"""
import csv
from pathlib import Path

ANNEES = [2021, 2022, 2023, 2024, 2025]
EDITION = 2025
_ = None  # « - » du rapport

# produit: ([valeur 2021..2025], [poids 2021..2025])
EXPORT = {
    "Animaux vivants":                      ([45, 25, 57, 159, 429],                         [3, 1, 6, 18, 67]),
    "Poisson frais de mer":                 ([192498, 211364, 192025, 183510, 182834],       [280058, 260177, 238307, 210371, 210128]),
    "Crustacés, mollusques et coquillages": ([106966, 163614, 104674, 88827, 125990],        [25253, 24125, 21064, 20104, 27195]),
    "Légumes frais":                        ([41470, 35222, 44127, 36898, 41253],            [46506, 38670, 42069, 45083, 59660]),
    "Farine de froment":                    ([7719, 4661, 98, 0, _],                         [29249, 14003, 280, 0, _]),
    "Arachides non grillées":               ([154789, 84789, 66406, 65308, 1393],            [336002, 177917, 119412, 121798, 2519]),
    "Gomme arabique":                       ([561, 12724, 986, 680, 3848],                   [875, 4038, 3307, 390, 4057]),
    "Huile brute d'arachide":               ([13732, 15913, 3817, 6892, 20522],              [12629, 13615, 1827, 5997, 22441]),
    "Huile raffinée d'arachide":            ([38, 114, 0, 75, _],                            [35, 87, 0, 88, _]),
    "Conserves de poisson":                 ([11749, 46682, 47411, 67131, 37588],            [5062, 13880, 13576, 19550, 11557]),
    "Produits sucrés":                      ([3451, 3270, 2572, 2510, 2936],                 [3776, 2822, 1628, 1861, 2749]),
    "Tourteaux d'arachide":                 ([13, 23, _, _, _],                              [150, 300, _, _, _]),
    "Cigarettes":                           ([30646, 20968, 33827, 36123, 47497],            [2379, 1788, 2487, 2576, 3117]),
    "Sel brut":                             ([10269, 13378, 13546, 10983, 10187],            [318954, 398337, 349850, 323233, 252809]),
    "Phosphates":                           ([22050, 47732, 49886, 55433, 47141],            [553448, 486545, 569208, 717942, 619911]),
    "Ciment hydraulique":                   ([86231, 75747, 106480, 108838, 113629],         [2123572, 1631621, 2149919, 2282279, 2527722]),
    "Huiles brutes de pétrole":             ([11017, 1545, 15959, 464555, 1527997],          [73045, 6928, 63690, 1427941, 5119888]),
    "Produits pétroliers":                  ([436885, 648822, 676438, 791942, 860646],       [1303545, 1072595, 1192516, 1412012, 1783976]),
    "Gaz liquéfiés naturels":               ([_, _, _, _, 115868],                           [_, _, _, _, 593346]),
    "Engrais minéraux et chimiques":        ([33057, 9318, 37787, 28830, 61251],             [121978, 30411, 130511, 67768, 156716]),
    "Cuirs et peaux":                       ([1964, 1572, 356, 68, 166],                     [1301, 1364, 561, 151, 976]),
    "Coton en masse":                       ([8966, 12528, 8422, 6611, 6318],                [9140, 8920, 5986, 5612, 6139]),
    "Tissus en coton":                      ([39, 23, 6, 29, 78],                            [20, 10, 4, 31, 180]),
    "Chaussures":                           ([6157, 7203, 5407, 4144, 2998],                 [5859, 6017, 5018, 3700, 2893]),
    "Récipients en tôle, fer et acier":     ([99, 703, 293, 298, 20],                        [62, 296, 109, 106, 5]),
    "Acide phosphorique":                   ([265348, 471868, 264686, 264417, 264696],       [478435, 558409, 492886, 499185, 415328]),
    "Poissons séchés, salés ou en saumure": ([1768, 1710, 1167, 1041, 1898],                 [1743, 1522, 1036, 1321, 2309]),
    "Or non monétaire":                     ([539778, 580607, 530410, 588502, 977997],       [19, 18, 17, 16, 19]),
    "Zirconium":                            ([62464, 87623, 61478, 77459, 68389],            [91558, 89085, 74529, 98626, 119777]),
    "Titane":                               ([87840, 115805, 85127, 98113, 85754],           [587818, 508265, 402352, 569804, 581631]),
    "Préparations pour soupes, potages, bouillons":
                                            ([84285, 102989, 90341, 93465, 20765],           [79593, 81083, 66034, 67475, 15234]),
    "Autres produits":                      ([662907, 784820, 780143, 826218, 1175536],      [1546261, 1537117, 1480430, 1694868, 1644001]),
}
TOTAL_EXPORT = {
    "valeur": [2884802, 3563359, 3223930, 3909058, 5805626],
    "poids":  [8038328, 6969968, 7428616, 9599905, 14186349],
}
IMPORT: dict = {}        # tableaux 12 et 13 — à saisir
TOTAL_IMPORT: dict = {}

# Écrit à côté de lui-même : les CSV restent dans le dossier du script.
ici = Path(__file__).parent
with open(ici / f"edition_{EDITION}_produits_regroupes.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["produit", "sens", "annee", "valeur", "poids", "edition"])
    for sens, table in (("export", EXPORT), ("import", IMPORT)):
        for produit, (val, pds) in table.items():
            assert len(val) == len(pds) == 5, produit
            for i, an in enumerate(ANNEES):
                w.writerow([produit, sens, an, "" if val[i] is None else val[i],
                            "" if pds[i] is None else pds[i], EDITION])
with open(ici / f"edition_{EDITION}_totaux_regroupes.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sens", "mesure", "annee", "total", "edition"])
    for sens, totaux in (("export", TOTAL_EXPORT), ("import", TOTAL_IMPORT)):
        for mesure, tot in totaux.items():
            for i, an in enumerate(ANNEES):
                w.writerow([sens, mesure, an, tot[i], EDITION])
print(f"{len(EXPORT)} produits export, {len(IMPORT)} produits import × {len(ANNEES)} ans écrits.")
