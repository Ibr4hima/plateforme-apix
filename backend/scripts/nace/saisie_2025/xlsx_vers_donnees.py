#!/usr/bin/env python3
"""Convertit un tableau « pays » fourni en Excel par l'ANSD en bloc Python
pour donnees_2025_pays.py.

    python3 -I xlsx_vers_donnees.py <fichier.xlsx> <NOM_DU_BLOC>
    (ex. : … Tableau_34.xlsx IMPORT_POIDS > bloc.py, puis recoller le bloc)

L'Excel porte les chiffres NON ARRONDIS, là où le PDF les arrondit à l'unité.
Ils sont ramenés à la règle du PDF, vérifiée sur les 610 poids du tableau 34
déjà saisis depuis le PDF (aucun écart) :
  · 0 exact          → « - » du PDF (None : absence de flux) ;
  · sinon            → arrondi au plus proche, DEMI VERS LE HAUT (0,5 → 1 ;
                       0,151 → 0, que le PDF imprime « 0 » et non « - »).
Les lignes nulles sur les cinq années (pays sans aucun échange, que le PDF
n'imprime pas) sont écartées : ce sont elles qui portent les doublons de
libellé (AFGANISTAN apparaît sous l'Asie occidentale ET sous les autres pays
d'Asie, à zéro dans le premier cas).

Lecture par la seule bibliothèque standard (un .xlsx est un zip de XML) : les
cellules sont lues comme des données, aucune formule n'est évaluée — et le
script refuse un classeur qui en contient, pour ne pas lire une valeur en
cache périmée. Il refuse aussi une ligne d'en-tête autre que 2021…2025, une
région inconnue, un doublon parmi les lignes non nulles.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from decimal import Decimal, ROUND_HALF_UP

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ANNEES = ["2021", "2022", "2023", "2024", "2025"]
# Libellés de région de l'ANSD → 12 libellés stables (REGIONS_ORDRE, nace.py).
REGIONS = {
    "UNION EUROPEENNE": "Union européenne", "AUTRES PAYS DE L'EUROPE": "Autres pays d'Europe",
    "AFRIQUE CENTRALE": "Afrique centrale", "AFRIQUE DU NORD": "Afrique du Nord",
    "AFRIQUE OCCIDENTALE": "Afrique occidentale",
    "AFRIQUE ORIENTALE ET DU SUD": "Afrique orientale et du Sud",
    "AMERIQUE CENTRALE ET DU SUD": "Amérique centrale et du Sud",
    "AMERIQUE DU NORD": "Amérique du Nord", "ASIE OCCIDENTALE": "Asie occidentale",
    "AUTRES PAYS D''ASIE": "Autres pays d'Asie", "AUTRES PAYS D'ASIE": "Autres pays d'Asie",
    "OCEANIE": "Océanie",
}


def arrondi(x: Decimal):
    return None if x == 0 else int(x.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def lire(chemin: str) -> list[list[str]]:
    z = zipfile.ZipFile(chemin)
    feuilles = [n for n in z.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)]
    if len(feuilles) != 1:
        sys.exit(f"une seule feuille attendue, trouvé {feuilles}")
    partage = []
    if "xl/sharedStrings.xml" in z.namelist():
        partage = ["".join(t.text or "" for t in si.iter("{%s}t" % NS["m"]))
                   for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)]
    lignes = []
    for row in ET.fromstring(z.read(feuilles[0])).findall("m:sheetData/m:row", NS):
        cel = {}
        for c in row.findall("m:c", NS):
            if c.find("m:f", NS) is not None:
                sys.exit(f"formule en {c.attrib['r']} : classeur refusé (valeur en cache)")
            v = c.find("m:v", NS)
            if v is not None:
                col = re.match(r"[A-Z]+", c.attrib["r"]).group(0)
                cel[col] = partage[int(v.text)] if c.attrib.get("t") == "s" else v.text
        lignes.append([cel.get(k, "") for k in "ABCDEF"])
    return lignes


def principal(chemin: str, nom: str) -> None:
    lignes = lire(chemin)
    if lignes[0][1:] != ANNEES:
        sys.exit(f"en-tête inattendu : {lignes[0]}")
    blocs: dict[str, tuple[list, dict]] = {}
    region, divers, total, ecartees = None, None, None, []
    for lib, *v in lignes[1:]:
        lib = lib.strip()
        vals = [Decimal(x) for x in v]
        if lib in REGIONS:
            region = REGIONS[lib]
            blocs[region] = ([arrondi(x) for x in vals], {})
        elif lib.startswith("DIVERS"):
            divers, region = [arrondi(x) for x in vals], None
        elif lib == "TOTAL":
            total = [arrondi(x) for x in vals]
        elif region is None:
            sys.exit(f"pays hors région : {lib}")
        elif all(x == 0 for x in vals):
            ecartees.append(f"{lib} ({region})")
        else:
            if any(lib in p for _, p in blocs.values()):
                sys.exit(f"libellé en double : {lib}")
            blocs[region][1][lib] = [arrondi(x) for x in vals]
    if divers is None or total is None or len(blocs) != len(set(REGIONS.values())):
        sys.exit("DIVERS, TOTAL ou une région manque")
    lit = lambda x: json.dumps(x, ensure_ascii=False)  # littéral Python valide
    print(f"{nom} = {{")
    for reg, (st, pays) in blocs.items():
        print(f"    {lit(reg)}: ({st}, {{".replace("None", "_"))
        for p, vals in pays.items():
            print(f"        {lit(p)}: {vals},".replace("None", "_"))
        print("    }),")
    print('    # Imprimé sans détail. Valeur IMPRIMÉE, arbitrée par saisie_2025_pays.py.')
    print(f'    "Divers": ({divers}, {{}}),')
    print("}")
    print(f"{nom}_TOTAL = {total}")
    print(f"# {len(ecartees)} lignes nulles sur les cinq années, écartées : {', '.join(ecartees)}",
          file=sys.stderr)


if __name__ == "__main__":
    principal(sys.argv[1], sys.argv[2])
