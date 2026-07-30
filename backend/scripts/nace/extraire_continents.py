#!/usr/bin/env python3
"""Génère edition_XXXX_continents.csv + _totaux_continents.csv.

Usage : extraire_continents.py <fichier.txt> <edition> <annee_min>
                               <T_expval> <T_exppds> <T_impval> <T_imppds>

Le fichier texte vient de `pdftotext -layout` ou, si le rendu est trop
irrégulier, de `extraire_tableau_bbox.py`.

Libellés normalisés : le rapport écrit « CONTINENT EUROPEEN », on retient
« Europe ». Les découpages varient selon les éditions (« CONTINENT
AUSTRALIEN ET OCEANIQUE » d'un côté, Australie et Océanie séparées de
l'autre) : toutes les variantes sont ramenées à « Océanie » et sommées,
pour que la série reste comparable d'une édition à l'autre.

Les continents sont exhaustifs (« Divers » incluse) : leur somme doit
égaler la ligne TOTAL du rapport, ce qui sert de contrôle d'intégrité.
"""
import csv
import re
import sys
import unicodedata

FIC, EDITION, AN_MIN = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
TABLES = sys.argv[4:8]
ANNEES = [AN_MIN + i for i in range(5)]

def cle(s: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", unicodedata.normalize("NFD", s.upper()))

CANON = {cle(k): v for k, v in {
    "CONTINENT EUROPEEN": "Europe",
    "CONTINENT AFRICAIN": "Afrique",
    "CONTINENT AMERICAIN": "Amérique",
    "CONTINENT ASIATIQUE": "Asie",
    "CONTINENT AUSTRALIEN ET OCEANIQUE": "Océanie",
    "CONTINENT AUSTRALIEN": "Océanie",
    "CONTINENT OCEANIQUE": "Océanie",
    "OCEANIE": "Océanie",
    "AUSTRALIE": "Océanie",
    "DIVERS (PBE,PBF,OM,NDA..)": "Divers",
    "DIVERS": "Divers",
}.items()}
ORDRE = ["Europe", "Afrique", "Amérique", "Asie", "Océanie", "Divers"]

def colonnes(l: str) -> list[str]:
    return [t.strip() for t in re.split(r"\s{2,}", l.strip()) if t.strip()]

def est_valeur(t: str) -> bool:
    return t == "-" or (bool(re.fullmatch(r"-?[\d ]+", t)) and any(c.isdigit() for c in t))

def nombre(t: str):
    return None if t == "-" else int(t.replace(" ", ""))

def est_entete_annees(vals: list[str]) -> bool:
    n = [v.replace(" ", "") for v in vals]
    return all(re.fullmatch(r"\d{4}", v) and 1990 <= int(v) <= 2100 for v in n)

txt = open(FIC, encoding="utf-8").read()

def parse(debut: str, fin: str | None):
    sec = txt.split(debut)[1]
    if fin:
        sec = sec.split(fin)[0]
    lignes: dict = {}
    total = None
    for l in sec.split("\n"):
        c = colonnes(l)
        if len(c) != 6 or est_valeur(c[0]) or not all(est_valeur(t) for t in c[1:]):
            continue
        if est_entete_annees(c[1:]):
            continue
        vals = [nombre(t) for t in c[1:]]
        k = cle(c[0])
        if k == "TOTAL":
            total = vals
        elif k in CANON:
            nom = CANON[k]
            if nom in lignes:      # découpage éclaté (Australie + Océanie)
                lignes[nom] = [(a or 0) + (b or 0) for a, b in zip(lignes[nom], vals)]
            else:
                lignes[nom] = vals
        else:
            raise SystemExit(f"{debut} : libellé de continent inconnu — {c[0]!r}")
    assert len(lignes) == 6, f"{debut} : {len(lignes)} continents au lieu de 6 — {sorted(lignes)}"
    assert total, f"{debut} : TOTAL introuvable"
    somme = [sum((v[i] or 0) for v in lignes.values()) for i in range(5)]
    for i, a in enumerate(ANNEES):
        assert abs(somme[i] - total[i]) <= 3, f"{debut} {a} : somme {somme[i]} ≠ total {total[i]}"
    return lignes, total

expv, totev = parse(TABLES[0], TABLES[1])
expp, totep = parse(TABLES[1], TABLES[2])
impv, totiv = parse(TABLES[2], TABLES[3])
impp, totip = parse(TABLES[3], None)

DEST = "/home/user/plateforme-apix/backend/scripts/nace"
with open(f"{DEST}/edition_{EDITION}_continents.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["continent", "sens", "annee", "valeur", "poids", "edition"])
    for sens, vals, pds in (("export", expv, expp), ("import", impv, impp)):
        for nom in ORDRE:
            for i, a in enumerate(ANNEES):
                v, p = vals[nom][i], pds[nom][i]
                w.writerow([nom, sens, a, "" if v is None else v, "" if p is None else p, EDITION])
with open(f"{DEST}/edition_{EDITION}_totaux_continents.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sens", "mesure", "annee", "total", "edition"])
    for sens, mesure, ts in (("export", "valeur", totev), ("export", "poids", totep),
                             ("import", "valeur", totiv), ("import", "poids", totip)):
        for i, a in enumerate(ANNEES):
            w.writerow([sens, mesure, a, ts[i], EDITION])
print(f"CSV {EDITION} continents générés — 6 continents × 2 sens × {len(ANNEES)} ans")
