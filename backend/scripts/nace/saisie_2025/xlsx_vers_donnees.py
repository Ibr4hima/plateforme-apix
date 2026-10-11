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

LES COLONNES SONT LUES PAR ANNÉE, sur l'en-tête, et non par position :
l'Excel du tableau 32 porte 2020, 2021, 2022, 2023, 2025 — pas de 2024. Seules
les années de l'édition (2021–2025) sont gardées, et le bloc ne porte que
celles que le fichier donne, nommées dans <NOM>_ANNEES. Une année absente
n'est ni mise à zéro ni comblée ici : c'est saisie_2025_pays.py qui dit d'où
elle vient.

Les lignes nulles sur toutes les années gardées (pays sans aucun échange, que
le PDF n'imprime pas) sont écartées : ce sont elles qui portent les doublons de
libellé (AFGANISTAN apparaît sous l'Asie occidentale ET sous les autres pays
d'Asie, à zéro dans le premier cas).

Lecture par la seule bibliothèque standard (un .xlsx est un zip de XML) : les
cellules sont lues comme des données, aucune formule n'est évaluée — et le
script refuse un classeur qui en contient, pour ne pas lire une valeur en
cache périmée. Il refuse aussi : un en-tête qui n'est pas une suite croissante
d'années finissant en 2025 (le PDF du tableau 32 avait une 5e colonne
« 2022 »), une ligne ou colonne masquée, une cellule vide ou illisible, un
nombre négatif, une région inconnue ou répétée, un doublon parmi les lignes non
nulles.

Les sous-totaux des tableaux de l'ANSD ont des défauts connus (cf. README) :
ils ne bloquent pas la conversion — le détail fait foi —, mais chaque écart
entre un sous-total et la somme de ses pays est imprimé sur la sortie
d'erreur, au millième près, avec le « DIVERS » que le TOTAL implique.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ANNEES = [2021, 2022, 2023, 2024, 2025]
# Écart en deçà duquel deux sommes sont égales : les cellules portent le
# flottant binaire du tableur (17 chiffres), au plus 3 décimales réelles.
EPSILON = Decimal("0.0005")
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


def nombre(texte: str, ou: str) -> Decimal:
    try:
        x = Decimal(texte)
    except InvalidOperation:
        sys.exit(f"nombre illisible {texte!r} : {ou}")
    if not x.is_finite() or x < 0:
        sys.exit(f"nombre refusé {texte!r} : {ou}")
    return x


def lire(chemin: str) -> list[dict[str, str]]:
    """Les lignes de l'unique feuille, chacune en {colonne: texte}."""
    z = zipfile.ZipFile(chemin)
    feuilles = [n for n in z.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)]
    if len(feuilles) != 1:
        sys.exit(f"une seule feuille attendue, trouvé {feuilles}")
    partage = []
    if "xl/sharedStrings.xml" in z.namelist():
        partage = ["".join(t.text or "" for t in si.iter("{%s}t" % NS["m"]))
                   for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)]
    feuille = ET.fromstring(z.read(feuilles[0]))
    if any(c.attrib.get("hidden") in ("1", "true") for c in feuille.findall("m:cols/m:col", NS)):
        sys.exit("colonne masquée : classeur à examiner")
    lignes = []
    for row in feuille.findall("m:sheetData/m:row", NS):
        if row.attrib.get("hidden") in ("1", "true"):
            sys.exit(f"ligne {row.attrib.get('r')} masquée : classeur à examiner")
        cel = {}
        for c in row.findall("m:c", NS):
            if c.find("m:f", NS) is not None:
                sys.exit(f"formule en {c.attrib['r']} : classeur refusé (valeur en cache)")
            col = re.match(r"[A-Z]+", c.attrib["r"]).group(0)
            if c.attrib.get("t") == "inlineStr":
                cel[col] = "".join(t.text or "" for t in c.iter("{%s}t" % NS["m"]))
            elif (v := c.find("m:v", NS)) is not None:
                cel[col] = partage[int(v.text)] if c.attrib.get("t") == "s" else v.text
        lignes.append({k: x.strip() for k, x in cel.items() if x and x.strip()})
    return lignes


def principal(chemin: str, nom: str) -> None:
    lignes = lire(chemin)
    entete = lignes[0]
    cols = sorted((k for k in entete if k != "A"), key=lambda k: (len(k), k))
    annees_fichier = [entete[k] for k in cols]
    if (not annees_fichier or not all(re.fullmatch(r"\d{4}", a) for a in annees_fichier)
            or [int(a) for a in annees_fichier] != sorted({int(a) for a in annees_fichier})
            or int(annees_fichier[-1]) != ANNEES[-1]):
        sys.exit(f"en-tête inattendu : {annees_fichier}")
    garde = [(k, int(a)) for k, a in zip(cols, annees_fichier) if int(a) in ANNEES]
    annees = [a for _, a in garde]
    ignorees = [a for a in annees_fichier if int(a) not in ANNEES]
    absentes = [a for a in ANNEES if a not in annees]

    blocs: dict[str, tuple[list, dict]] = {}
    bruts: dict[str, tuple[list, list]] = {}    # contrôles des sous-totaux
    region, divers, total, ecartees = None, None, None, []
    for n, cel in enumerate(lignes[1:], start=2):
        if not cel:
            continue
        lib = cel.get("A")
        if lib is None:
            sys.exit(f"ligne {n} : chiffres sans libellé")
        if hors := sorted(set(cel) - {"A"} - set(cols)):
            sys.exit(f"ligne {n} ({lib}) : colonne(s) sans année {hors}")
        if vides := [k for k, _ in garde if k not in cel]:
            sys.exit(f"ligne {n} ({lib}) : cellule(s) vide(s) {vides}")
        vals = [nombre(cel[k], f"ligne {n} ({lib}), colonne {k}") for k, _ in garde]
        if lib in REGIONS:
            region = REGIONS[lib]
            if region in blocs:
                sys.exit(f"région en double : {lib}")
            blocs[region] = ([arrondi(x) for x in vals], {})
            bruts[region] = (vals, [])
        elif lib.startswith("DIVERS"):
            divers, region = vals, None
        elif lib == "TOTAL":
            total = vals
        elif region is None:
            sys.exit(f"pays hors région : {lib}")
        else:
            bruts[region][1].append(vals)
            if all(x == 0 for x in vals):
                ecartees.append(f"{lib} ({region})")
                continue
            if any(lib in p for _, p in blocs.values()):
                sys.exit(f"libellé en double : {lib}")
            blocs[region][1][lib] = [arrondi(x) for x in vals]
    if divers is None or total is None or len(blocs) != len(set(REGIONS.values())):
        sys.exit("DIVERS, TOTAL ou une région manque")

    lit = lambda x: json.dumps(x, ensure_ascii=False)  # littéral Python valide
    print(f"{nom}_ANNEES = {annees}")
    print(f"{nom} = {{")
    for reg, (st, pays) in blocs.items():
        print(f"    {lit(reg)}: ({st}, {{".replace("None", "_"))
        for p, vals in pays.items():
            print(f"        {lit(p)}: {vals},".replace("None", "_"))
        print("    }),")
    print('    # Imprimé sans détail. Valeur IMPRIMÉE, arbitrée par saisie_2025_pays.py.')
    print(f'    "Divers": ({[arrondi(x) for x in divers]}, {{}}),'.replace("None", "_"))
    print("}")
    print(f"{nom}_TOTAL = {[arrondi(x) for x in total]}".replace("None", "_"))

    err = lambda m: print(f"# {m}", file=sys.stderr)
    if ignorees:
        err(f"colonnes hors édition, ignorées : {', '.join(ignorees)}")
    if absentes:
        err(f"années de l'édition ABSENTES du fichier : {', '.join(map(str, absentes))}")
    for reg, (st, pays) in bruts.items():
        for j, an in enumerate(annees):
            if abs(e := sum(p[j] for p in pays) - st[j]) > EPSILON:
                err(f"contrôle · {reg} {an} : Σ pays − sous-total imprimé = {e:+.3f}")
    for j, an in enumerate(annees):
        reste = total[j] - sum(p[j] for _, pays in bruts.values() for p in pays)
        if abs(e := divers[j] - reste) > EPSILON:
            err(f"contrôle · DIVERS {an} : imprimé {divers[j]:.3f}, TOTAL − Σ pays = {reste:.3f} "
                f"(écart {e:+.3f})")
    quand = "les cinq années" if not absentes else "les années " + ", ".join(map(str, annees))
    err(f"{len(ecartees)} lignes nulles sur {quand}, écartées : {', '.join(ecartees)}")


if __name__ == "__main__":
    principal(sys.argv[1], sys.argv[2])
