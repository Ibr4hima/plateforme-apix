#!/usr/bin/env python3
"""Reconstruit les lignes d'un tableau PDF à partir des coordonnées des mots.

`pdftotext -layout` ne suffit pas sur certaines éditions : les cellules
d'une même ligne y sont réparties sur plusieurs lignes de texte, et un
même nombre peut être coupé en deux dans sa cellule (« 3 800 764 » rendu
« 3 800 » puis « 764 » en dessous). On repart donc de
`pdftotext -bbox-layout`, qui donne la position de chaque mot :

1. les libellés (colonne de gauche) définissent les lignes du tableau ;
2. chaque nombre est rattaché à la ligne dont le libellé est le plus
   proche verticalement ;
3. dans une ligne, les nombres sont regroupés en cellules par écart
   horizontal, puis les fragments qui se chevauchent en x sont fusionnés
   dans l'ordre de lecture — ce qui recolle les nombres coupés en deux.

Aucun ancrage sur l'en-tête des années n'est nécessaire : les pages de
continuation, qui n'en ont pas, sont traitées comme les autres.

Sortie : « libellé <3 espaces> val1 <3 espaces> val2 … » par ligne, au
format attendu par extraire_chapitres.py.
"""
import re
import subprocess
import sys
from xml.etree import ElementTree

NS = "{http://www.w3.org/1999/xhtml}"
DY_LIGNE = 9.0        # rattachement d'un nombre à la ligne la plus proche
ECART_CELLULE = 4.5   # écart horizontal séparant deux cellules (2,2 pt
                      # séparent les tranches d'un même nombre, 7,4 pt les cellules)

def mots_de(page):
    for w in page.iter(NS + "word"):
        txt = (w.text or "").strip()
        if txt:
            yield (round((float(w.get("yMin")) + float(w.get("yMax"))) / 2, 2),
                   float(w.get("xMin")), float(w.get("xMax")), txt)

def bandes(mots, tol=3.0):
    out: list[list] = []
    for m in sorted(mots):
        if out and abs(m[0] - out[-1][0][0]) <= tol:
            out[-1].append(m)
        else:
            out.append([m])
    return out

def est_valeur(t: str) -> bool:
    return t == "-" or bool(re.fullmatch(r"[\d ]+", t))

def est_entete(vals: list[str]) -> bool:
    """Ligne d'en-tête : cinq millésimes consécutifs. Elle serait sinon
    absorbée comme fragment de cellule par la ligne la plus proche."""
    n = [int(v.replace(" ", "")) for v in vals if re.fullmatch(r"[\d ]+", v)]
    return len(n) == 5 == len(vals) and all(1990 <= v <= 2100 for v in n) \
        and all(b - a == 1 for a, b in zip(n, n[1:]))

def lignes_page(page) -> list[str]:
    mots = list(mots_de(page))
    if not mots:
        return []
    # 1. Découpage de chaque bande : le libellé court jusqu'au dernier mot
    #    non numérique, le reste est valeurs. (Un seuil d'abscisse fixe ne
    #    tiendrait pas : la largeur de la colonne des libellés change d'une
    #    édition à l'autre, et « TOTAL 7 439 216 » perdrait son « 7 ».)
    #    Trois formes de bandes : « libellé seul » (L), « valeurs seules »
    #    (V) et « libellé + valeurs » (LV). Une ligne du tableau se compose
    #    d'un LV, ou d'un ou plusieurs L suivis d'un V — les deux dispositions
    #    coexistent selon les éditions.
    classees = []
    for b in bandes(mots):
        b.sort(key=lambda m: m[1])
        coupe = max((i for i, m in enumerate(b) if not est_valeur(m[3])), default=-1)
        libelle = " ".join(m[3] for m in b[:coupe + 1])
        vals = b[coupe + 1:]
        y = sum(m[0] for m in b) / len(b)
        if est_entete([m[3] for m in vals]):
            continue
        classees.append(("V" if coupe < 0 else "LV" if vals else "L", y, libelle, vals))

    #    Les fragments de libellé (L) sont émis tels quels, sur leur propre
    #    ligne : c'est le générateur qui les recollera, en s'appuyant sur la
    #    nomenclature de référence — la suite d'un libellé coupé se place
    #    tantôt avant, tantôt après ses valeurs, parfois dans un même
    #    rapport, et seul le vocabulaire attendu permet de trancher.
    lignes, hors_tableau = [], []
    for genre, y, libelle, vals in classees:
        if genre == "L":
            hors_tableau.append((y, libelle))
        elif genre == "LV":
            lignes.append({"y": y, "libelle": libelle, "vals": list(vals)})
    if not lignes:
        return [l for _, l in sorted(hors_tableau)]

    # 2. Bandes de valeurs seules : soit un fragment de cellule coupée en
    #    deux (tout près d'une ligne existante), soit les valeurs d'un
    #    libellé resté seul plus haut (nettement en dessous) — auquel cas
    #    on émet une ligne sans libellé, que le générateur appariera.
    for genre, y, _, vals in classees:
        if genre != "V":
            continue
        cible = min(lignes, key=lambda l: abs(l["y"] - y))
        if abs(cible["y"] - y) <= DY_LIGNE:
            cible["vals"] += vals
        else:
            lignes.append({"y": y, "libelle": "", "vals": list(vals)})

    sortie = []
    for l in lignes:
        # 3a. Cellules par sous-bande (une ligne peut s'étaler sur 2-3 y)
        cellules: list[dict] = []
        for sb in bandes(l["vals"]):
            sb.sort(key=lambda m: m[1])
            cour = None
            for y, x0, x1, txt in sb:
                if cour and x0 - cour["x1"] <= ECART_CELLULE:
                    cour["frags"].append((y, x0, txt)); cour["x1"] = x1
                else:
                    cour = {"x0": x0, "x1": x1, "frags": [(y, x0, txt)]}
                    cellules.append(cour)
        # 3b. Fusion des fragments qui se chevauchent horizontalement
        cellules.sort(key=lambda c: c["x0"])
        fusion: list[dict] = []
        for c in cellules:
            prec = fusion[-1] if fusion else None
            if prec and min(prec["x1"], c["x1"]) - max(prec["x0"], c["x0"]) > 0:
                prec["frags"] += c["frags"]
                prec["x0"] = min(prec["x0"], c["x0"]); prec["x1"] = max(prec["x1"], c["x1"])
            else:
                fusion.append(c)
        valeurs = [" ".join(t for _, _, t in sorted(c["frags"])) for c in fusion]
        texte = (l["libelle"] + "   " if l["libelle"] else "") + "   ".join(valeurs)
        sortie.append((l["y"], texte if valeurs else l["libelle"]))
    return [t for _, t in sorted(sortie + hors_tableau)]

if __name__ == "__main__":
    brut = subprocess.run(["pdftotext", "-bbox-layout", sys.argv[1], "-"],
                          capture_output=True, text=True, check=True).stdout
    for page in ElementTree.fromstring(brut).iter(NS + "page"):
        print("\n".join(lignes_page(page)))
