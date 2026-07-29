#!/usr/bin/env python3
"""Génère edition_XXXX_groupes_utilisation.csv + _totaux_groupes.csv
en parsant le texte du PDF (pdftotext -layout).

Usage : gen_gu.py <fichier.txt> <edition> <annee_min> <T_expval> <T_exppds> <T_impval> <T_imppds> [T_balance]

Contrôles : somme des 9 groupes = TOTAL du PDF ; si le tableau balance
est fourni, export − import = balance ligne à ligne (contre-vérification
indépendante de la transcription).
"""
import csv
import re
import sys
import unicodedata

FIC, EDITION, AN_MIN = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
T_EXPV, T_EXPP, T_IMPV, T_IMPP = sys.argv[4:8]
T_BAL = sys.argv[8] if len(sys.argv) > 8 else None
ANNEES = [AN_MIN + i for i in range(5)]

def cle(s: str) -> str:
    s = unicodedata.normalize("NFD", s.upper())
    return re.sub(r"[^A-Z0-9]", "", s)

CANON = {cle(k): v for k, v in {
    "ALIMENTATION - BOISSONS - TABACS": "Alimentation, boissons et tabacs",
    "ENERGIE ET LUBRIFIANTS": "Énergie et lubrifiants",
    "MATIERES PREMIERES ANIMALES ET VEGETALES": "Matières premières animales et végétales",
    "MATIERES PREMIERES MINERALES": "Matières premières minérales",
    "AUTRES DEMI - PRODUITS": "Autres demi-produits",
    "PRODUITS FINIS DESTINES A L'AGRICULTURE": "Produits finis destinés à l'agriculture",
    "PRODUITS FINIS DESTINES A L'INDUSTRIE": "Produits finis destinés à l'industrie",
    "PRODUITS FINIS DESTINES A LA CONSOMMATION": "Produits finis destinés à la consommation",
    "OR INDUSTRIEL": "Or industriel",
}.items()}

txt = open(FIC, encoding="utf-8").read()

def parse(debut: str, fin: str | None):
    sec = txt.split(debut)[1]
    if fin:
        sec = sec.split(fin)[0]
    lignes, total = {}, None
    for l in sec.split("\n"):
        m = re.match(r"^([A-ZÉÈ][A-Za-zÉÈÀÔÎéè '\-\,\.]+?)\s{2,}((?:-?[\d\s]+)(?:\s{2,}-?[\d\s]+){4})\s*$", l.strip())
        if not m:
            continue
        toks = [t.strip() for t in re.split(r"\s{2,}", m.group(2).strip())]
        if len(toks) != 5:
            continue
        vals = [int(t.replace(" ", "")) for t in toks]
        k = cle(m.group(1))
        if k == "TOTAL":
            total = vals
        elif k in CANON:
            lignes[CANON[k]] = vals
    assert len(lignes) == 9, f"{debut} : {len(lignes)} groupes au lieu de 9 — {sorted(lignes)}"
    assert total, f"{debut} : TOTAL introuvable"
    somme = [sum(v[i] for v in lignes.values()) for i in range(5)]
    for i, a in enumerate(ANNEES):
        assert abs(somme[i] - total[i]) <= 2, f"{debut} {a} : somme {somme[i]} ≠ total {total[i]}"
    return lignes, total

expv, totev = parse(T_EXPV, T_EXPP)
expp, totep = parse(T_EXPP, T_IMPV)
impv, totiv = parse(T_IMPV, T_IMPP)
impp, totip = parse(T_IMPP, T_BAL)

# Contre-vérification indépendante : export − import = balance du PDF
if T_BAL:
    bal, _ = parse(T_BAL, None)
    for g in bal:
        for i, a in enumerate(ANNEES):
            calc = expv[g][i] - impv[g][i]
            assert abs(calc - bal[g][i]) <= 2, f"balance {g} {a} : {calc} ≠ {bal[g][i]}"
    print(f"  contre-vérification balance (T{T_BAL[-3:].strip(': ')}) : OK sur 9 groupes × 5 ans")

DEST = "/home/user/plateforme-apix/backend/scripts/nace"
with open(f"{DEST}/edition_{EDITION}_groupes_utilisation.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["groupe", "sens", "annee", "valeur", "poids", "edition"])
    for sens, vals, pds in (("export", expv, expp), ("import", impv, impp)):
        for g in vals:
            for i, a in enumerate(ANNEES):
                w.writerow([g, sens, a, vals[g][i], pds[g][i], EDITION])
with open(f"{DEST}/edition_{EDITION}_totaux_groupes.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sens", "mesure", "annee", "total", "edition"])
    for sens, mesure, ts in (("export", "valeur", totev), ("export", "poids", totep),
                             ("import", "valeur", totiv), ("import", "poids", totip)):
        for i, a in enumerate(ANNEES):
            w.writerow([sens, mesure, a, ts[i], EDITION])
print(f"CSV {EDITION} groupes d'utilisation générés — 9 groupes × 2 sens × {len(ANNEES)} ans")
