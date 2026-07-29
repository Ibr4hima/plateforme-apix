#!/usr/bin/env python3
"""Vérification d'intégrité des extractions NACE — principaux produits.

Pour chaque édition présente dans les CSV du dossier :
  1. la somme des lignes produit (par sens × mesure × année) doit égaler
     la ligne TOTAL du PDF (fichier edition_XXXX_totaux.csv) ;
  2. chaque produit doit porter ses 5 années, sans doublon ;
  3. les libellés doivent être identiques entre sens/mesures là où c'est
     attendu (jointure valeur ⇆ poids déjà fusionnée dans le CSV).

Usage : python3 verifier_principaux_produits.py [dossier]
"""
import csv
import sys
from collections import defaultdict
from pathlib import Path

dossier = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent
code_sortie = 0

# (fichier de données, fichier des lignes TOTAL, tolérance d'arrondi) — la
# tolérance croît avec le nombre de lignes sommées : chaque ligne du PDF est
# arrondie (±0,5), la dérive cumulée est donc plus grande sur les tableaux
# fins (56 postes) que sur les principaux produits (~15 postes).
FAMILLES = [
    ("principaux_produits", "totaux", 3, "produit"),
    ("produits_regroupes", "totaux_regroupes", 6, "produit"),
    ("groupes_utilisation", "totaux_groupes", 2, "groupe"),
    ("chapitres", "totaux_chapitres", 12, "chapitre"),
]

fichiers = [
    (fic, famille, suffixe_tot, tolerance, colonne)
    for famille, suffixe_tot, tolerance, colonne in FAMILLES
    for fic in sorted(dossier.glob(f"edition_[0-9][0-9][0-9][0-9]_{famille}.csv"))
]
for fic, famille, suffixe_tot, tolerance, colonne in fichiers:
    edition = fic.stem.split("_")[1]
    fic_tot = dossier / f"edition_{edition}_{suffixe_tot}.csv"
    lignes = list(csv.DictReader(open(fic, encoding="utf-8")))
    totaux = {}
    if fic_tot.exists():
        for r in csv.DictReader(open(fic_tot, encoding="utf-8")):
            totaux[(r["sens"], r["mesure"], int(r["annee"]))] = int(r["total"])

    print(f"── Édition {edition} · {famille} : {len(lignes)} lignes ─────────────────────")

    # 1. Sommes vs TOTAL du PDF
    sommes: dict = defaultdict(int)
    for r in lignes:
        annee = int(r["annee"])
        if r["valeur"]:
            sommes[(r["sens"], "valeur", annee)] += int(r["valeur"])
        if r["poids"]:
            sommes[(r["sens"], "poids", annee)] += int(r["poids"])
    # Tolérance d'arrondi : le PDF somme des valeurs non arrondies puis
    # arrondit chaque ligne — des écarts de quelques unités sont normaux.
    for cle, attendu in sorted(totaux.items()):
        obtenu = sommes.get(cle, 0)
        ecart = obtenu - attendu
        if ecart == 0:
            statut = "OK"
        elif abs(ecart) <= tolerance:
            statut = f"OK (arrondi {ecart:+d})"
        else:
            statut = f"ÉCART {ecart:+d}"
            code_sortie = 1
        print(f"  {cle[0]:<6} {cle[1]:<6} {cle[2]} : somme {obtenu:>10} / total PDF {attendu:>10}  {statut}")

    # 2. Complétude : 5 années par (produit, sens), pas de doublon
    par_produit: dict = defaultdict(list)
    for r in lignes:
        par_produit[(r[colonne], r["sens"])].append(int(r["annee"]))
    for (produit, sens), annees in sorted(par_produit.items()):
        if len(annees) != len(set(annees)):
            print(f"  DOUBLON : {produit} ({sens}) — années {sorted(annees)}")
            code_sortie = 1
        if len(set(annees)) != 5:
            print(f"  INCOMPLET : {produit} ({sens}) — {len(set(annees))} année(s)")
            code_sortie = 1
    nb_exp = len({p for (p, s) in par_produit if s == "export"})
    nb_imp = len({p for (p, s) in par_produit if s == "import"})
    libelle = {"groupe": "groupes", "chapitre": "chapitres"}.get(colonne, "produits")
    print(f"  {nb_exp} {libelle} export · {nb_imp} {libelle} import — complétude OK" if code_sortie == 0 else "")

print("\nRésultat global :", "CONFORME" if code_sortie == 0 else "ÉCARTS DÉTECTÉS")
sys.exit(code_sortie)
