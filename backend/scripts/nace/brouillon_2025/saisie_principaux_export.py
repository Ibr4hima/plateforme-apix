#!/usr/bin/env python3
"""Saisie contrôlée — NACE édition 2025, principaux produits EXPORTÉS.

Tableau 6 (valeur, millions FCFA) et tableau 7 (poids net, tonnes),
années 2021 à 2025, transcrits ligne à ligne depuis le rapport. « - » du
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

ici = Path(__file__).parent
with open(ici / f"edition_{EDITION}_principaux_produits.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["produit", "sens", "annee", "valeur", "poids", "edition"])
    for produit, (val, pds) in EXPORT.items():
        assert len(val) == len(pds) == 5, produit
        for i, an in enumerate(ANNEES):
            w.writerow([produit, "export", an,
                        "" if val[i] is None else val[i],
                        "" if pds[i] is None else pds[i], EDITION])
with open(ici / f"edition_{EDITION}_totaux.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sens", "mesure", "annee", "total", "edition"])
    for mesure, tot in TOTAL_EXPORT.items():
        for i, an in enumerate(ANNEES):
            w.writerow(["export", mesure, an, tot[i], EDITION])
print(f"{len(EXPORT)} produits export × {len(ANNEES)} ans écrits.")
