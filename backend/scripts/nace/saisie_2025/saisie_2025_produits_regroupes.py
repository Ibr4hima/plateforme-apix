#!/usr/bin/env python3
"""Saisie contrôlée — NACE édition 2025, produits regroupés.

Exportations : tableaux 10 (valeur, millions FCFA) et 11 (poids net,
tonnes). Importations : tableaux 12 (valeur) et 13 (poids).
Années 2021 à 2025, transcrites ligne à ligne. Le rapport imprime ses
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
# Tableaux 12 (valeur) et 13 (poids) — mêmes 56 postes, même ordre que
# l'édition 2024.
IMPORT = {
    "Produits laitiers":                              ([52009, 63190, 54627, 65739, 65281],             [32219, 34475, 31282, 33745, 32913]),
    "Fruits et légumes comestibles":                  ([66508, 65573, 75352, 86829, 96898],             [336976, 347591, 409888, 441237, 512852]),
    "Café":                                           ([2902, 2076, 1762, 2028, 2277],                  [7632, 3538, 1108, 1742, 3529]),
    "Thé":                                            ([3655, 7351, 3289, 4077, 7021],                  [6605, 8214, 8178, 8774, 11285]),
    "Froment et méteil":                              ([149256, 237738, 187049, 171374, 174998],        [753807, 860149, 897798, 904947, 982106]),
    "Maïs":                                           ([68534, 92318, 82534, 78359, 81501],             [398517, 400129, 430863, 512740, 533395]),
    "Riz":                                            ([262426, 346789, 301996, 315039, 336734],        [1194004, 1487336, 1302317, 1387343, 1476128]),
    "Mil et sorgho":                                  ([4692, 7469, 6982, 5965, 6345],                  [14327, 20832, 27088, 28602, 33836]),
    "Autres céréales":                                ([11, 12, 218, 54, 190],                          [13, 7, 1288, 196, 1347]),
    "Huiles et graisses animales et végétales":       ([123804, 127037, 119602, 107056, 114261],        [225294, 202602, 201001, 240288, 304889]),
    "Conserves de viande et de poisson":              ([2848, 3698, 2989, 3389, 3061],                  [3459, 4686, 3866, 4947, 5406]),
    "Sucres bruts et raffinés":                       ([42646, 65978, 73312, 59341, 69890],             [125395, 192414, 294709, 264994, 273319]),
    "Autres produits sucrés":                         ([9451, 13158, 10032, 13613, 11814],              [14361, 14203, 9643, 14444, 13706]),
    "Conserves de fruits et légumes":                 ([22575, 28027, 29961, 28468, 24307],             [43626, 48914, 49409, 44734, 46248]),
    "Vins et vermouths":                              ([2247, 2778, 2723, 2449, 1563],                  [1741, 2279, 1935, 3037, 1715]),
    "Autres boissons":                                ([28009, 24520, 21826, 16157, 12567],             [82689, 70934, 68242, 45477, 34947]),
    "Tabac brut et fabriqué":                         ([16513, 11988, 7597, 10784, 18478],              [4027, 2517, 2054, 2684, 3415]),
    "Huiles brutes de pétrole":                       ([284625, 278083, 577392, 492592, 494510],        [1023899, 503909, 1318187, 1175330, 1420868]),
    "Autres produits pétroliers":                     ([1014771, 1992035, 1421415, 1592284, 1371333],   [3093699, 3645960, 3055172, 3744937, 3707450]),
    "Produits chimiques organiques et inorganiques":  ([85760, 133495, 97070, 105408, 102701],          [179950, 223339, 215649, 239179, 268384]),
    "Produits pharmaceutiques":                       ([189115, 195813, 203219, 218793, 216602],        [17195, 18245, 18869, 19174, 22529]),
    "Engrais":                                        ([23632, 89009, 76683, 52357, 59424],             [87767, 159321, 199995, 171818, 217985]),
    "Teinture, vernis et peinture":                   ([16195, 12573, 16726, 18008, 16369],             [29694, 24943, 32483, 35238, 36996]),
    "Parfumerie":                                     ([11207, 12540, 11252, 14825, 16175],             [20065, 21670, 23105, 26111, 30301]),
    "Produits des industries parachimiques":          ([103961, 115921, 120749, 124742, 115138],        [80799, 90437, 81015, 97454, 86244]),
    "Matières plastiques artificielles":              ([173074, 219988, 188673, 194255, 191571],        [181258, 201653, 218023, 236731, 227831]),
    "Pneus et chambres à air":                        ([21370, 26715, 29784, 30438, 26734],             [27724, 29255, 38478, 38876, 38281]),
    "Bois et ouvrages":                               ([29551, 57758, 48521, 34621, 39213],             [119920, 234378, 269306, 107979, 129347]),
    "Papiers, cartons et applications":               ([82542, 104467, 102715, 99027, 105144],          [146892, 151486, 163675, 171209, 176840]),
    "Filés et fils textiles":                         ([5925, 7576, 4244, 4218, 4917],                  [6273, 7427, 7260, 7312, 9412]),
    "Tissus artificiels et synthétiques":             ([8097, 7469, 7129, 8324, 9250],                  [24242, 28964, 30404, 33697, 35831]),
    "Tissus de coton non imprimés":                   ([4391, 3439, 4352, 4761, 6045],                  [5980, 6127, 10177, 13635, 15805]),
    "Tissus de coton imprimés":                       ([1064, 1118, 1321, 1493, 1660],                  [3502, 3636, 4737, 4879, 4500]),
    "Autres tissus":                                  ([11158, 15787, 16116, 18009, 19975],             [19469, 20927, 25009, 28972, 34526]),
    "Articles en tissus":                             ([46128, 42676, 45229, 49491, 63304],             [91297, 91229, 107344, 117748, 137330]),
    "Sacs d'emballage":                               ([8418, 9365, 7707, 8066, 8188],                  [5023, 4917, 4601, 4861, 5013]),
    "Chaussures":                                     ([10659, 11112, 12563, 13457, 14398],             [21382, 22522, 27738, 27669, 28432]),
    "Pierre, céramique et verre":                     ([70555, 81406, 79932, 83628, 85678],             [390356, 438040, 522890, 493372, 465015]),
    "Métaux communs":                                 ([279285, 295933, 248005, 191783, 281135],        [660210, 584660, 566456, 433272, 740794]),
    "Tubes, tuyaux et accessoires":                   ([66058, 148498, 86554, 43996, 35279],            [57462, 83186, 68755, 44217, 46343]),
    "Articles de ménage et d'hygiène en métal":       ([5858, 4063, 3529, 4550, 6397],                  [8303, 6171, 6574, 8718, 7878]),
    "Autres ouvrages en métaux communs":              ([112893, 212757, 206240, 179152, 126227],        [77882, 139643, 136795, 110406, 103978]),
    "Outillage et quincaillerie":                     ([10217, 13066, 50895, 16880, 13438],             [13512, 16282, 22171, 20376, 21815]),
    "Meubles et divers en métal":                     ([10566, 14541, 10620, 11980, 11073],             [6824, 6719, 6342, 7297, 8097]),
    "Moteurs et machines à moteurs":                  ([47115, 40667, 67775, 63076, 48089],             [23306, 25078, 28388, 26912, 23623]),
    "Machines et appareils pour l'agriculture":       ([12250, 11199, 13689, 11613, 12348],             [5296, 4703, 6475, 5895, 7253]),
    "Machines et appareils pour industries alimentaires":
                                                      ([10600, 16054, 14039, 18212, 31750],             [2542, 3616, 3887, 5195, 7512]),
    "Machines et appareils pour autres industries":   ([162991, 219835, 206746, 207121, 140244],        [47671, 58566, 56448, 60338, 50821]),
    "Autres machines et appareils":                   ([448089, 500320, 576307, 664783, 611782],        [139060, 155737, 171868, 187759, 191072]),
    "Automobiles et cars":                            ([142547, 118533, 199675, 178620, 141691],        [65082, 47577, 56217, 60158, 55489]),
    "Camions et camionnettes":                        ([69052, 91262, 118848, 99898, 83954],            [28901, 31106, 33437, 35445, 30834]),
    "Pièces détachées automobiles":                   ([27115, 24729, 27697, 30801, 27595],             [27845, 30771, 30878, 35631, 32569]),
    "Autres véhicules terrestres":                    ([125628, 126059, 280087, 199914, 162793],        [82650, 78201, 90325, 92848, 92204]),
    "Autres matériels de transport":                  ([25016, 251840, 150361, 61963, 368817],          [3454, 39963, 23233, 45454, 103635]),
    "Optique, horlogerie et matériel scientifique":   ([87408, 79205, 107010, 97215, 76232],            [8670, 8648, 10887, 11706, 9214]),
    "Autres produits":                                ([675520, 862755, 785084, 791298, 799498],        [3985199, 3547441, 3736454, 3592275, 3447776]),
}
TOTAL_IMPORT = {
    "valeur": [5378494, 7549364, 7207803, 7012377, 6973859],
    "poids":  [14064950, 14497275, 15170373, 15520015, 16350868],
}

# Les CSV s'écrivent dans scripts/nace, où l'import de déploiement les lit ;
# ce dossier ne garde que les scripts de saisie et leurs notes.
ici = Path(__file__).parent.parent
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
