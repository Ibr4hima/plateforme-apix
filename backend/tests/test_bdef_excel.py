"""Tests du parseur bdef_excel — données mock, aucun fichier requis."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.bdef_excel import (
    extraire_blocs,
    FEUILLE_COMPTES,
    FEUILLE_RATIOS,
)


# Un bloc COMPTES (PRODUITS) : en-tête TABLEAU, ligne secteur, en-tête Réf.,
# ligne années, puis lignes de données par code Réf.
COMPTES_ROWS = [
    ("TABLEAU : 3-B  PRODUITS", None, None, None, None),
    (None, None, None, None, None),
    ("3", "-", "INDUSTRIES EXTRACTIVES", None, None),
    ("PRODUITS", "Réf.", "net", "net", "net"),
    (None, None, 2022, 2023, 2024),
    ("Chiffre d'affaires", "TI", 100.0, 110.0, 120.0),
    ("Valeur ajoutée", "TN", 40.0, 44.0, 48.0),
    ("Ligne sans réf", None, 1.0, 2.0, 3.0),
]


# Un bloc RATIOS C : ratios en modèle fraction (numérateur porte la valeur,
# dénominateur sur la ligne suivante sans valeur). Colonnes années décalées.
RATIOS_C_ROWS = [
    ("TABLEAU : 0-C ", None, None, None, None),
    ("0", "-", "GLOBAL DES SECTEURS", None, None),
    ("RATIOS", None, 2022, 2023, 2024),
    ("VALEUR AJOUTEE", None, 0.30, 0.28, 0.25),
    ("PRODUCTION", None, None, None, None),
    ("EBE", None, 0.40, 0.41, 0.40),
    ("VALEUR AJOUTEE", None, None, None, None),
]


# Un bloc RATIOS E : libellés simples avec valeurs sur la même ligne.
RATIOS_E_ROWS = [
    ("TABLEAU : 0-E ", None, None, None, None),
    (None, "E - AUTRES INDICATEURS", None, None, None),
    (None, None, 2022, 2023, 2024),
    ("Production", None, 900.0, 950.0, 1000.0),
    ("Valeur Ajoutée Globale (VAG)", None, 300.0, 310.0, 320.0),
]


class TestComptes:
    def test_lecture_par_ref(self):
        blocs = extraire_blocs(COMPTES_ROWS, FEUILLE_COMPTES)
        assert len(blocs) == 1
        b = blocs[0]
        assert b.code == "3"
        assert b.niveau == "secteur"
        assert b.libelle_secteur == "INDUSTRIES EXTRACTIVES"
        assert b.type_bloc == "B"
        assert b.sous_type == "PRODUITS"
        assert b.annees == [2022, 2023, 2024]
        cles = {lv.cle: lv for lv in b.lignes}
        assert cles["ref:TI"].valeurs == {2022: 100.0, 2023: 110.0, 2024: 120.0}
        assert cles["ref:TN"].valeurs[2024] == 48.0

    def test_ligne_sans_ref_ignoree(self):
        b = extraire_blocs(COMPTES_ROWS, FEUILLE_COMPTES)[0]
        # seules les lignes avec un code Réf. à 2 lettres sont retenues
        assert all(lv.cle.startswith("ref:") for lv in b.lignes)
        assert len(b.lignes) == 2


class TestRatiosFraction:
    def test_paires_numerateur_denominateur(self):
        b = extraire_blocs(RATIOS_C_ROWS, FEUILLE_RATIOS)[0]
        assert b.type_bloc == "C"
        cles = {lv.cle: lv for lv in b.lignes}
        assert "ratio:valeur ajoutee||production" in cles
        assert "ratio:ebe||valeur ajoutee" in cles
        assert cles["ratio:valeur ajoutee||production"].valeurs[2024] == 0.25

    def test_ligne_entete_ratios_ignoree(self):
        b = extraire_blocs(RATIOS_C_ROWS, FEUILLE_RATIOS)[0]
        assert all("ratios||" not in lv.cle for lv in b.lignes)


class TestRatiosSimple:
    def test_lecture_par_libelle(self):
        b = extraire_blocs(RATIOS_E_ROWS, FEUILLE_RATIOS)[0]
        assert b.type_bloc == "E"
        cles = {lv.cle: lv for lv in b.lignes}
        assert cles["lib:production"].valeurs[2024] == 1000.0
        assert cles["lib:valeur ajoutee globale vag"].valeurs[2024] == 320.0


class TestColonnesAnnees:
    def test_colonnes_non_fixes(self):
        # Les années ne sont pas en colonne fixe : ici décalées d'une colonne.
        rows = [
            ("TABLEAU : 0-E ", None, None, None, None, None),
            (None, None, None, 2022, 2023, 2024),
            ("Production", None, None, 1.0, 2.0, 3.0),
        ]
        b = extraire_blocs(rows, FEUILLE_RATIOS)[0]
        assert b.annees == [2022, 2023, 2024]
        assert b.lignes[0].valeurs == {2022: 1.0, 2023: 2.0, 2024: 3.0}


class TestRobustesse:
    def test_feuille_vide(self):
        assert extraire_blocs([], FEUILLE_COMPTES) == []

    def test_bloc_sans_annees_ignore(self):
        rows = [
            ("TABLEAU : 0-A  ACTIF", None, None),
            ("0", "-", "GLOBAL"),
            ("Charges", "AA", "texte"),
        ]
        assert extraire_blocs(rows, FEUILLE_COMPTES) == []
