#!/usr/bin/env python3
"""Génère edition_XXXX_chapitres.csv + _totaux_chapitres.csv (chapitres SH).

Usage : gen_ch.py <fichier.txt> <edition> <annee_min> <T_expval> <T_exppds> <T_impval> <T_imppds>

Particularités de cette famille :
- jusqu'à 97 chapitres par sens, libellés longs souvent coupés sur deux
  lignes AVANT les valeurs (l'inverse des groupes d'utilisation) ;
- les en-têtes d'années sont eux aussi des lignes de 5 nombres — ils sont
  reconnus et ignorés ;
- « - » signifie absence de flux (NULL, distinct d'un 0) ;
- les exportations ne couvrent pas tous les chapitres (84 en 2019 contre
  96 à l'import) : les listes ne sont pas identiques entre sens.
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

FIC, EDITION, AN_MIN = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
TABLES = sys.argv[4:8]
ANNEES = [AN_MIN + i for i in range(5)]

LEXIQUE = json.loads((Path(__file__).parent / "lexique_chapitres.json").read_text(encoding="utf-8"))

def colonnes(l: str) -> list[str]:
    return [t.strip() for t in re.split(r"\s{2,}", l.strip()) if t.strip()]

def est_valeur(t: str) -> bool:
    return t == "-" or (bool(re.fullmatch(r"-?[\d ]+", t)) and any(c.isdigit() for c in t))

def nombre(t: str):
    return None if t == "-" else int(t.replace(" ", ""))

def est_entete_annees(vals: list[str]) -> bool:
    return all(re.fullmatch(r"\d{4}", v.replace(" ", "")) and 1990 <= int(v.replace(" ", "")) <= 2100
               for v in vals)

def normaliser_espaces(s: str) -> str:
    """Clé de rapprochement : le recollage des libellés coupés crée des
    variantes d'espacement (« MEDICO- CHIRURGICAUX », « MUSIQUE ; »)."""
    s = re.sub(r"\s*([;,])\s*", r"\1", s)
    s = re.sub(r"-\s+", "-", s)
    return re.sub(r"\s+", " ", s).strip().upper()

def joli(brut: str) -> str:
    """Libellé lisible : casse normale, accents restitués mot à mot via le
    lexique, séparateurs « ; » homogénéisés en « , »."""
    s = normaliser_espaces(brut)
    s = s.replace(";", ", ").replace(" ,", ",")
    s = re.sub(r",\s*", ", ", s)
    mots = re.split(r"([ ,'\-()])", s.lower())
    sortie = []
    for m in mots:
        sortie.append(LEXIQUE.get(unicodedata.normalize("NFD", m), m))
    s = "".join(sortie)
    s = re.sub(r"\s+", " ", s).strip().rstrip(",")
    return s[:1].upper() + s[1:]

txt = open(FIC, encoding="utf-8").read()

# Nomenclature de référence : les 96 chapitres SH, identiques d'une édition
# à l'autre. Elle sert d'arbitre quand un libellé est coupé en deux, car la
# suite se place tantôt avant, tantôt après la ligne des valeurs — parfois
# au sein d'un même rapport.
REFERENCE: set[str] = set()
_ref = Path("/home/user/plateforme-apix/backend/scripts/nace/edition_2019_chapitres.csv")
if _ref.exists():
    REFERENCE = {r["chapitre"] for r in csv.DictReader(_ref.open(encoding="utf-8"))}

def parse(debut: str, fin: str | None):
    """Lit une section et renvoie {clé: (libellé brut, valeurs)} + TOTAL.

    Les libellés longs sont coupés sur deux lignes, la suite se plaçant
    tantôt avant, tantôt après la ligne des valeurs — parfois dans un même
    rapport. On collecte donc séparément les fragments et les lignes
    porteuses de valeurs, puis on teste les combinaisons possibles contre
    la nomenclature de référence (96 chapitres SH, stable entre éditions).
    """
    sec = txt.split(debut)[1]
    if fin:
        sec = sec.split(fin)[0]

    items = []          # ("frag", libellé) | ("row", libellé, valeurs)
    for l in sec.split("\n"):
        c = colonnes(l)
        if not c:
            continue
        if all(est_valeur(t) for t in c):
            if len(c) == 5 and not est_entete_annees(c):
                items.append(("row", "", [nombre(t) for t in c]))
            continue
        vals = [t for t in c[1:] if est_valeur(t)]
        if len(c) >= 2 and len(vals) == len(c) - 1 == 5:
            if est_entete_annees(vals):
                continue
            items.append(("row", c[0], [nombre(t) for t in vals]))
        elif len(c) == 1 and re.match(r"^[A-ZÉÈ]", c[0]) \
                and "Source" not in c[0] and "Tableau" not in c[0]:
            items.append(("frag", c[0]))

    def connu(lib: str) -> bool:
        return not REFERENCE or joli(lib) in REFERENCE

    rows, total, utilises = {}, None, set()
    for i, it in enumerate(items):
        if it[0] != "row":
            continue
        propre = it[1]
        avant = items[i - 1][1] if i and items[i - 1][0] == "frag" and i - 1 not in utilises else None
        apres = items[i + 1][1] if i + 1 < len(items) and items[i + 1][0] == "frag" else None
        essais = [(propre, None)]
        if avant:
            essais.insert(0, (f"{avant} {propre}".strip(), i - 1))
        if apres:
            essais.append((f"{propre} {apres}".strip(), i + 1))
        if avant and apres:
            essais.append((f"{avant} {propre} {apres}".strip(), i - 1))
        libelle, idx = next(((lib, j) for lib, j in essais if lib and connu(lib)), (None, None))
        if libelle is None:
            libelle, idx = essais[0]
        if idx is not None:
            utilises.add(idx)
            if idx == i + 1 and avant:      # « avant » restait disponible
                utilises.add(i - 1)
        if normaliser_espaces(libelle) == "TOTAL":
            total = it[2]
        elif libelle:
            rows[normaliser_espaces(libelle)] = (libelle, it[2])

    assert total, f"{debut} : TOTAL introuvable"
    somme = [sum((v[1][i] or 0) for v in rows.values()) for i in range(5)]
    # Un TOTAL imprimé aberrant (> 5 %) est une erreur du rapport, pas de
    # l'extraction : on retient la somme et on le signale (cas connu : T39
    # de l'édition 2021, cf. README).
    if any(abs(somme[i] - total[i]) > max(12, 0.05 * total[i]) for i in range(5)):
        print(f"  ⚠ {debut} : TOTAL imprimé aberrant {total} — remplacé par la somme des chapitres {somme}")
        total = somme
    for i, a in enumerate(ANNEES):
        assert abs(somme[i] - total[i]) <= 12, f"{debut} {a} : somme {somme[i]} ≠ total {total[i]}"
    return rows, total

expv, totev = parse(TABLES[0], TABLES[1])
expp, totep = parse(TABLES[1], TABLES[2])
impv, totiv = parse(TABLES[2], TABLES[3])
impp, totip = parse(TABLES[3], None)

for nom, a, b in (("export", expv, expp), ("import", impv, impp)):
    assert set(a) == set(b), f"{nom} : libellés valeur/poids différents — {set(a) ^ set(b)}"

DEST = "/home/user/plateforme-apix/backend/scripts/nace"
inconnus = set()
with open(f"{DEST}/edition_{EDITION}_chapitres.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["chapitre", "sens", "annee", "valeur", "poids", "edition"])
    for sens, vals, pds in (("export", expv, expp), ("import", impv, impp)):
        for k in vals:
            lib = joli(vals[k][0])
            inconnus |= {m for m in re.findall(r"[a-zà-ÿ]+", lib.lower())
                         if unicodedata.normalize("NFD", m) not in LEXIQUE and len(m) > 2}
            for i, a in enumerate(ANNEES):
                v, p = vals[k][1][i], pds[k][1][i]
                w.writerow([lib, sens, a, "" if v is None else v, "" if p is None else p, EDITION])
with open(f"{DEST}/edition_{EDITION}_totaux_chapitres.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sens", "mesure", "annee", "total", "edition"])
    for sens, mesure, ts in (("export", "valeur", totev), ("export", "poids", totep),
                             ("import", "valeur", totiv), ("import", "poids", totip)):
        for i, a in enumerate(ANNEES):
            w.writerow([sens, mesure, a, ts[i], EDITION])
print(f"CSV {EDITION} chapitres générés — {len(expv)} chapitres export, {len(impv)} import")
if inconnus:
    print("  mots hors lexique (à vérifier) :", ", ".join(sorted(inconnus)))
