#!/usr/bin/env python3
"""Génère edition_XXXX_pays.csv + _regions.csv + _totaux_pays.csv.

Usage : extraire_pays.py <fichier.txt> <edition> <annee_min>
                         <T_expval> <T_exppds> <T_impval> <T_imppds>
                         [<borne_fin>]

`borne_fin` délimite le dernier tableau quand l'extrait contient la suite
du rapport (sans quoi la section déborde sur le tableau suivant).

Les tableaux 34 à 37 sont HIÉRARCHIQUES, à la différence des autres
familles : une ligne de région porte son sous-total, suivie du détail de
ses pays. Une seule lecture alimente donc les deux granularités.

Reconnaissance des lignes : une région commence par « LES » (« LES PAYS DE
L'AFRIQUE DE L'OUEST », « LES AUTRES PAYS DE L'EUROPE »), tout le reste
est un pays rattaché à la dernière région rencontrée. Les régions sont
ramenées à un libellé lisible ; les libellés de pays sont conservés
BRUTS, en capitales, parce qu'ils servent de clé de rapprochement au
référentiel (cf. alias_pays_nace.json) — l'affichage utilise ensuite
ref_pays.nom_fr, ou « Autres pays » pour les partenaires hors référentiel.

Trois contrôles d'intégrité, du plus local au plus global :
  1. Σ pays d'une région = sous-total imprimé de la région ;
  2. Σ régions            = ligne TOTAL du tableau ;
  3. Σ régions d'un continent = famille nace_continents (inter-familles),
     vérifié séparément par verifier_pays.py.
"""
import csv
import re
import sys
import unicodedata

FIC, EDITION, AN_MIN = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
TABLES = sys.argv[4:8]
BORNE_FIN = sys.argv[8] if len(sys.argv) > 8 else None
ANNEES = [AN_MIN + i for i in range(5)]
# Tolérances d'arrondi, calibrées sur les mesures de l'édition 2019 : le
# rapport arrondit chaque sous-total indépendamment de son détail, d'où un
# écart résiduel de 5 unités au pire sur une région et de 2 sur le TOTAL.
# Toute erreur réelle (ligne perdue, colonne décalée) se compte en milliers.
TOL_REGION, TOL_TOTAL = 6, 8
DEST = "/home/user/plateforme-apix/backend/scripts/nace"


def cle(s: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", unicodedata.normalize("NFD", s.upper()))


# Les 12 régions, ramenées à un libellé lisible et STABLE d'une édition à
# l'autre. Le rapport varie de trois façons, toutes vérifiées sur les
# éditions en main :
#
#  - renommages à membres identiques : « COMMUNAUTE EUROPEENNE » (éd. 2019)
#    devient « UNION EUROPEENNE » (éd. 2020+) avec les mêmes 27 partenaires,
#    Royaume-Uni compris ; « AFRIQUE DE L'OUEST » devient « AFRIQUE
#    OCCIDENTALE » avec les mêmes 15 ;
#  - fusion : l'édition 2019 sépare « CONTINENT AUSTRALIEN » d'« OCEANIE »,
#    les suivantes n'ont plus qu'« OCEANIE ». Vérifié sur l'année 2019
#    (3 192 + 1 = 3 193, valeur qu'imprime l'édition 2020). Les deux libellés
#    sont donc ramenés à « Océanie » et leurs sous-totaux sommés ;
#  - coquilles de graphie : « EUROPEENE » à un seul N, apostrophe doublée
#    dans « D''ASIE », apostrophe courbe dans « L’OCEANIE ». cle() retirant
#    toute ponctuation, une entrée couvre toutes les variantes d'apostrophe ;
#    les fautes de lettres demandent chacune la leur.
CANON = {cle(k): v for k, v in {
    "LES PAYS MEMBRES DE LA COMMUNAUTE EUROPEENNE": "Union européenne",
    "LES PAYS MEMBRES DE LA COMMUNAUTE EUROPEENE": "Union européenne",
    "LES PAYS MEMBRES DE LA COMMUNAUTE EUROPENNE": "Union européenne",
    "LES PAYS DE L'UNION EUROPEENNE": "Union européenne",
    "LES PAYS DE L'UNION EUROPEENE": "Union européenne",
    "LES AUTRES PAYS DE L'EUROPE": "Autres pays d'Europe",
    "LES AUTRES PAYS D'EUROPE": "Autres pays d'Europe",
    "LES PAYS DE L'AFRIQUE CENTRALE": "Afrique centrale",
    "LES PAYS DE L'AFRIQUE DU NORD": "Afrique du Nord",
    "LES PAYS DE L'AFRIQUE DE L'OUEST": "Afrique occidentale",
    "LES PAYS DE L'AFRIQUE OCCIDENTALE": "Afrique occidentale",
    "LES PAYS DE L'AFRIQUE ORIENTALE ET DU SUD": "Afrique orientale et du Sud",
    "LES PAYS DE L'AMERIQUE DU NORD": "Amérique du Nord",
    "LES PAYS DE L'AMERIQUE CENTRALE ET DU SUD": "Amérique centrale et du Sud",
    "LES PAYS DE L'ASIE OCCIDENTALE": "Asie occidentale",
    "LES AUTRES PAYS DE L'ASIE": "Autres pays d'Asie",
    "LES AUTRES PAYS D'ASIE": "Autres pays d'Asie",
    "LES PAYS DU CONTINENT AUSTRALIEN": "Océanie",
    "LES PAYS DE L'OCEANIE": "Océanie",
    # 13e groupe, sans détail pays : le « Divers » de la famille continents
    # (PBE = provisions de bord étrangères, PBF = françaises, OM = or
    # monétaire, nda = non dénommé ailleurs). Le suffixe varie en ponctuation.
    "DIVERS": "Divers",
    "DIVERS (PBE,PBF,OM,NDA..)": "Divers",
    "DIVERS (PBE, PBF, OM, NDA..)": "Divers",
    # Les tableaux d'import nomment ce même groupe « NCA » (non classé
    # ailleurs) : identité vérifiée au chiffre près contre nace_continents
    # (2019 : 4 922 / 4 342 / 5 696 / 5 147 / 15 001 MFCFA).
    "NCA": "Divers",
}.items()}
ORDRE = ["Union européenne", "Autres pays d'Europe",
         "Afrique centrale", "Afrique du Nord", "Afrique occidentale",
         "Afrique orientale et du Sud",
         "Amérique du Nord", "Amérique centrale et du Sud",
         "Asie occidentale", "Autres pays d'Asie",
         "Océanie", "Divers"]


# Une cellule est une suite de mots séparés par UN espace au plus : deux
# espaces consécutifs marquent la frontière entre colonnes.
CELLULE = re.compile(r"\S+(?: \S+)*")


def morceaux(l: str) -> list[tuple[str, int]]:
    """[(texte, position de fin)] — la position sert à recaler les lignes
    dont certaines cellules sont vides."""
    return [(m.group(), m.end()) for m in CELLULE.finditer(l)]


def colonnes(l: str) -> list[str]:
    return [t for t, _ in morceaux(l)]


def est_valeur(t: str) -> bool:
    return t == "-" or (bool(re.fullmatch(r"-?[\d ]+", t)) and any(c.isdigit() for c in t))


def nombre(t: str):
    return None if t == "-" else int(t.replace(" ", ""))


def est_entete_annees(vals: list[str]) -> bool:
    n = [v.replace(" ", "") for v in vals]
    return all(re.fullmatch(r"\d{4}", v) and 1990 <= int(v) <= 2100 for v in n)


txt = open(FIC, encoding="utf-8").read()


def annees_entete(sec: str) -> list[int]:
    """Millésimes de l'en-tête : on les lit plutôt que de supposer la
    largeur, le nombre de colonnes n'étant pas constant d'une édition
    à l'autre."""
    for l in sec.split("\n"):
        c = [t.replace(" ", "") for t in colonnes(l)]
        n = [int(t) for t in c if re.fullmatch(r"\d{4}", t) and 1990 <= int(t) <= 2100]
        if len(n) >= 5 and len(n) == len([t for t in c if re.fullmatch(r"[\d ]*\d", t)]) \
                and all(b - a == 1 for a, b in zip(n, n[1:])):
            return n
    return []


def repere_colonnes(sec: str, attendu: int) -> list[int]:
    """Bornes droites médianes des colonnes de valeurs, mesurées sur les
    lignes complètes du tableau."""
    fins: list[list[int]] = [[] for _ in range(attendu - 1)]
    for l in sec.split("\n"):
        m = morceaux(l)
        c = [t for t, _ in m]
        if len(c) != attendu or est_valeur(c[0]) or not all(est_valeur(t) for t in c[1:]):
            continue
        if est_entete_annees(c[1:]):
            continue
        for i, (_, f) in enumerate(m[1:]):
            fins[i].append(f)
    if any(len(f) < 5 for f in fins):
        return []
    return [sorted(f)[len(f) // 2] for f in fins]


def parse(debut: str, fin: str | None):
    """(régions, pays, total) d'un tableau. `régions` associe un libellé
    lisible à son sous-total imprimé ; `pays` associe un libellé BRUT au
    couple (région, valeurs)."""
    # [-1] et non [1] : les titres figurent aussi dans la table des matières,
    # la dernière occurrence est donc le tableau lui-même.
    sec = txt.split(debut)[-1]
    if fin:
        sec = sec.split(fin)[0]
    entete = annees_entete(sec)
    manquantes = [a for a in ANNEES if a not in entete] if entete else []
    if manquantes:
        assert len(entete) == 5, \
            f"{debut} : en-tête {entete} incompatible avec {ANNEES} et non repositionnable"
        print(f"  ⚠ {debut} : en-tête erroné {entete} — colonnes lues par position comme {ANNEES}")
        entete, garder = list(ANNEES), list(range(5))
    else:
        garder = [entete.index(a) for a in ANNEES] if entete else list(range(5))

    attendu = len(entete) + 1 if entete else 6
    # Bornes droites de référence des colonnes de valeurs, médianes sur les
    # lignes complètes. Les nombres sont alignés à droite : ces bornes
    # permettent de replacer les valeurs d'une ligne à cellules vides.
    #
    # Elles sont mesurées PAR PAGE, car `pdftotext -layout` réaligne les
    # colonnes à chaque page et un tableau en couvre plusieurs : des bornes
    # médianes sur l'ensemble ne colleraient à aucune page. Le tableau 37 de
    # l'édition 2020 imprime ainsi ses régions à trois indentations
    # différentes. Repli sur les bornes globales si une page est trop courte
    # pour en fournir.
    bornes_globales = repere_colonnes(sec, attendu)
    lignes_pagees: list[tuple[str, list[int]]] = []
    for page in sec.split("\f"):        # \f = saut de page de pdftotext
        b = repere_colonnes(page, attendu) or bornes_globales
        lignes_pagees += [(l, b) for l in page.split("\n")]

    regions: dict[str, list] = {}
    libelles_regions: dict[str, str] = {}   # libellé brut, pour les régions sans détail
    pays: dict[str, tuple[str, list]] = {}
    total = None
    courante = None
    for l, bornes in lignes_pagees:
        m = morceaux(l)
        c = [t for t, _ in m]
        if len(c) < 2 or est_valeur(c[0]) or not all(est_valeur(t) for t in c[1:]):
            continue
        if est_entete_annees(c[1:]):            # en-tête répété en tête de page
            continue
        if len(c) == attendu:
            brut = c[1:]
        elif bornes:
            # Ligne à cellules vides (« ILES PACIFIQUES US » du tableau 36 de
            # l'édition 2019 : la seule valeur imprimée est celle de 2019).
            # Chaque valeur est rendue à la colonne dont la borne droite est
            # la plus proche ; les colonnes non servies restent nulles.
            brut = [None] * (attendu - 1)
            for texte, fin in m[1:]:
                i = min(range(len(bornes)), key=lambda j: abs(bornes[j] - fin))
                if brut[i] is not None:
                    brut = None                 # ambiguïté : on abandonne
                    break
                brut[i] = texte
            if brut is None:
                print(f"  ⚠ {debut} : ligne {c[0]!r} illisible par position — ignorée")
                continue
            brut = ["-" if t is None else t for t in brut]
        else:
            continue
        vals = [nombre(brut[i]) for i in garder]
        libelle, k = c[0], cle(c[0])
        if k == "TOTAL":
            total = vals
        elif k in CANON:
            nom = CANON[k]
            if nom in regions:
                # Découpage éclaté ramené à un libellé unique (« CONTINENT
                # AUSTRALIEN » puis « OCEANIE » dans l'édition 2019) : les
                # sous-totaux se somment, et les pays des deux blocs se
                # rattachent à la même région.
                regions[nom] = [(a or 0) + (b or 0) for a, b in zip(regions[nom], vals)]
            else:
                regions[nom] = vals
            courante = nom
            libelles_regions.setdefault(nom, libelle)
        elif libelle.upper().startswith("LES "):
            # Garde-fou : toute nouvelle région doit être déclarée dans CANON,
            # sinon ses pays seraient silencieusement rattachés à la région
            # précédente et le contrôle 1 échouerait sans dire pourquoi.
            raise SystemExit(f"{debut} : région inconnue — {libelle!r}")
        else:
            assert courante, f"{debut} : pays {libelle!r} avant toute région"
            assert libelle not in pays, f"{debut} : pays {libelle!r} en double"
            pays[libelle] = (courante, vals)

    assert len(regions) == len(ORDRE), \
        f"{debut} : {len(regions)} régions au lieu de {len(ORDRE)} — " \
        f"manque {sorted(set(ORDRE) - set(regions))}"
    assert total, f"{debut} : TOTAL introuvable"

    # Région imprimée sans détail pays : sa ligne est à la fois le sous-total
    # et son unique partenaire, on l'inscrit donc aussi côté pays pour garder
    # Σ pays = TOTAL. C'est le cas de « DIVERS » dans les éditions 2019 et
    # 2020 — mais PAS en 2021, où le rapport détaille enfin ce groupe
    # (provisions de bord E et F, divers non déterminés ailleurs, origines
    # mélangées). Injecter sans condition y double-compterait la région.
    avec_detail = {r for r, _ in pays.values()}
    for nom, sous_total in regions.items():
        if nom not in avec_detail:
            pays[libelles_regions[nom]] = (nom, sous_total)

    # Contrôle 1 : la somme des pays d'une région = son sous-total imprimé.
    for nom, sous_total in regions.items():
        membres = [v for r, v in pays.values() if r == nom]
        somme = [sum((v[i] or 0) for v in membres) for i in range(5)]
        ecarts = [i for i in range(5) if abs(somme[i] - (sous_total[i] or 0)) > TOL_REGION]
        if ecarts:
            detail = ", ".join(f"{ANNEES[i]} : {sous_total[i]} ≠ {somme[i]}" for i in ecarts)
            print(f"  ⚠ {debut} · {nom} : sous-total imprimé ≠ Σ pays ({detail})")

    # Contrôle 2 : la somme des régions = la ligne TOTAL du tableau.
    somme = [sum((v[i] or 0) for v in regions.values()) for i in range(5)]
    ecarts = [i for i in range(5) if abs(somme[i] - total[i]) > TOL_TOTAL]
    if ecarts:
        detail = ", ".join(f"{ANNEES[i]} : {total[i]} ≠ {somme[i]}" for i in ecarts)
        print(f"  ⚠ {debut} : TOTAL imprimé ≠ Σ régions ({detail})")
    print(f"  {debut.split(':')[0].strip()} : {len(pays)} lignes pays · {len(regions)} régions")
    return regions, pays, total


expv_r, expv_p, totev = parse(TABLES[0], TABLES[1])
expp_r, expp_p, totep = parse(TABLES[1], TABLES[2])
impv_r, impv_p, totiv = parse(TABLES[2], TABLES[3])
impp_r, impp_p, totip = parse(TABLES[3], BORNE_FIN)

# Les tableaux valeur et poids d'un même sens doivent lister les mêmes
# partenaires : un écart trahit une ligne perdue au rendu du PDF.
for sens, a, b in (("export", expv_p, expp_p), ("import", impv_p, impp_p)):
    if set(a) != set(b):
        for cote, ecart in (("valeur seule", set(a) - set(b)), ("poids seul", set(b) - set(a))):
            if ecart:
                print(f"  ⚠ {sens} : {len(ecart)} pays en {cote} — {sorted(ecart)}")

with open(f"{DEST}/edition_{EDITION}_pays.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["pays", "region", "sens", "annee", "valeur", "poids", "edition"])
    for sens, vals, pds in (("export", expv_p, expp_p), ("import", impv_p, impp_p)):
        for nom in sorted(set(vals) | set(pds),
                          key=lambda n: (ORDRE.index((vals.get(n) or pds[n])[0]), n)):
            region = (vals.get(n2 := nom) or pds[n2])[0]
            for i, a in enumerate(ANNEES):
                v = vals[nom][1][i] if nom in vals else None
                p = pds[nom][1][i] if nom in pds else None
                w.writerow([nom, region, sens, a,
                            "" if v is None else v, "" if p is None else p, EDITION])

with open(f"{DEST}/edition_{EDITION}_regions.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["region", "sens", "annee", "valeur", "poids", "edition"])
    for sens, vals, pds in (("export", expv_r, expp_r), ("import", impv_r, impp_r)):
        for nom in ORDRE:
            for i, a in enumerate(ANNEES):
                v, p = vals[nom][i], pds[nom][i]
                w.writerow([nom, sens, a, "" if v is None else v, "" if p is None else p, EDITION])

with open(f"{DEST}/edition_{EDITION}_totaux_pays.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sens", "mesure", "annee", "total", "edition"])
    for sens, mesure, ts in (("export", "valeur", totev), ("export", "poids", totep),
                             ("import", "valeur", totiv), ("import", "poids", totip)):
        for i, a in enumerate(ANNEES):
            w.writerow([sens, mesure, a, ts[i], EDITION])

print(f"CSV {EDITION} pays/régions générés — {len(set(expv_p) | set(impv_p))} partenaires distincts, "
      f"{len(ORDRE)} régions × 2 sens × {len(ANNEES)} ans")
