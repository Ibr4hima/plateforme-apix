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

# Découpage linéaire des colonnes (2 espaces ou plus). Un motif « nombres »
# à quantificateurs imbriqués provoquerait un backtracking catastrophique
# sur les lignes qui ne correspondent pas.
def colonnes(l: str) -> list[str]:
    return [t.strip() for t in re.split(r"\s{2,}", l.strip()) if t.strip()]

def est_nombre(t: str) -> bool:
    return bool(re.fullmatch(r"-?[\d ]+", t)) and any(c.isdigit() for c in t)

def nombres_seuls(l: str) -> list[str] | None:
    """5 valeurs et rien d'autre (ligne de nombres d'un libellé coupé)."""
    c = colonnes(l)
    return c if len(c) == 5 and all(est_nombre(t) for t in c) else None

def libelle_seul(l: str) -> str | None:
    """Un libellé et rien d'autre (début ou fin d'un libellé coupé)."""
    c = colonnes(l)
    return c[0] if len(c) == 1 and re.fullmatch(r"[A-ZÉÈ][A-Za-zÉÈÀÔÎéè '\-\,\.]*", c[0]) else None

def prenormaliser(sec: str) -> str:
    """Recolle les libellés que le PDF coupe sur plusieurs lignes : les
    valeurs s'intercalent alors entre le début et la fin du libellé
    (« MATIERES PREMIERES ANIMALES ET » / nombres / « VEGETALES »)."""
    lignes = [l.rstrip() for l in sec.split("\n")]
    out, i = [], 0
    while i < len(lignes):
        lab = libelle_seul(lignes[i])
        nums = nombres_seuls(lignes[i + 1]) if lab and i + 1 < len(lignes) else None
        if lab and nums:
            suite = libelle_seul(lignes[i + 2]) if i + 2 < len(lignes) else None
            if suite and cle(f"{lab} {suite}") in CANON:
                out.append(f"{lab} {suite}   " + "   ".join(nums))
                i += 3
                continue
            out.append(f"{lab}   " + "   ".join(nums))
            i += 2
            continue
        out.append(lignes[i])
        i += 1
    return "\n".join(out)

def tableaux(debut: str, fin: str | None) -> list[tuple[dict, list]]:
    """Tous les tableaux complets (9 groupes + TOTAL) d'une section.

    Une section peut en contenir plusieurs : pdftotext restitue parfois le
    titre d'un tableau APRÈS ses données (édition 2022), si bien que le
    tableau suivant se retrouve rattaché à la section précédente.
    « ^ » comme début = le tableau commence en haut de l'extrait (son titre
    est resté sur la page précédente du rapport).
    """
    sec = txt if debut == "^" else txt.split(debut)[1]
    if fin:
        sec = sec.split(fin)[0]
    trouves: list[tuple[dict, list]] = []
    lignes: dict = {}
    for l in prenormaliser(sec).split("\n"):
        c = colonnes(l)
        if len(c) != 6 or est_nombre(c[0]) or not all(est_nombre(t) for t in c[1:]):
            continue
        vals = [int(t.replace(" ", "")) for t in c[1:]]
        k = cle(c[0])
        if k == "TOTAL":
            if len(lignes) == 9:            # tableau complet : on le clôt
                somme = [sum(v[i] for v in lignes.values()) for i in range(5)]
                for i, a in enumerate(ANNEES):
                    assert abs(somme[i] - vals[i]) <= 2, \
                        f"{debut} #{len(trouves)+1} {a} : somme {somme[i]} ≠ total {vals[i]}"
                trouves.append((lignes, vals))
            lignes = {}
        elif k in CANON:
            lignes[CANON[k]] = vals
    return trouves

def parse(debut: str, fin: str | None, rang: int = 0, obligatoire: bool = True):
    tabs = tableaux(debut, fin)
    if len(tabs) <= rang:
        assert not obligatoire, f"{debut} : tableau #{rang+1} introuvable ({len(tabs)} trouvé(s))"
        return None, None
    return tabs[rang]

expv, totev = parse(T_EXPV, T_EXPP)
expp, totep = parse(T_EXPP, T_IMPV)
impv, totiv = parse(T_IMPV, T_IMPP)
impp, totip = parse(T_IMPP, T_BAL)

# Contre-vérification indépendante : export − import = balance du PDF.
# Le tableau n'est pas toujours présent dans l'extrait ; quand son titre
# est restitué après ses données, il apparaît en 2e position de la section
# des importations en poids.
if T_BAL:
    bal, _ = parse(T_BAL, None, obligatoire=False)
    if bal is None:
        bal, _ = parse(T_IMPP, T_BAL, rang=1, obligatoire=False)
    if bal is None:
        print("  tableau balance absent de l'extrait — contrôle par les totaux seuls")
    else:
        for g in bal:
            for i, a in enumerate(ANNEES):
                calc = expv[g][i] - impv[g][i]
                assert abs(calc - bal[g][i]) <= 2, f"balance {g} {a} : {calc} ≠ {bal[g][i]}"
        print("  contre-vérification balance : OK sur 9 groupes × 5 ans")

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
