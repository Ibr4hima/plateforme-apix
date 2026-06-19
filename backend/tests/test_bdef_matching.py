"""Tests unitaires pour bdef_matching — aucun accès BD, données mock en paramètre."""
import sys
import os

# Permet d'importer depuis backend/app sans installer le package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app.utils.bdef_matching import (
    normaliser,
    matcher_secteur,
    detecter_niveau,
    SEUIL_AUTO,
    SEUIL_SUGGER,
    NIVEAU_GLOBAL,
    NIVEAU_SECTEUR,
    NIVEAU_GROUPE,
    NIVEAU_MACRO,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

SECTEURS_BASE = [
    {"id": 1, "libelle": "Industries extractives", "code": "012"},
    {"id": 2, "libelle": "Agriculture, élevage, chasse et sylviculture", "code": "001"},
    {"id": 3, "libelle": "Bâtiment et travaux publics", "code": "030"},
    {"id": 4, "libelle": "Commerce de gros", "code": "045"},
    {"id": 5, "libelle": "Transport et communications", "code": "060"},
]

ALIAS_VIDES: dict[str, int] = {}


# ── Normalisation ─────────────────────────────────────────────────────────────

class TestNormaliser:
    def test_minuscules(self):
        assert normaliser("INDUSTRIES EXTRACTIVES") == "industries extractives"

    def test_accents_supprimes(self):
        assert normaliser("Élevage") == "elevage"
        assert normaliser("bâtiment") == "batiment"

    def test_code_numerique_long(self):
        assert normaliser("012 Industries extractives") == "industries extractives"

    def test_code_numerique_court(self):
        assert normaliser("3 INDUSTRIES EXTRACTIVES") == "industries extractives"

    def test_code_avec_tiret(self):
        assert normaliser("012-Industries extractives") == "industries extractives"

    def test_code_avec_point(self):
        assert normaliser("012. Industries extractives") == "industries extractives"

    def test_tirets_remplaces(self):
        assert normaliser("Bâtiment-travaux") == "batiment travaux"

    def test_underscores_remplaces(self):
        assert normaliser("commerce_de_gros") == "commerce de gros"

    def test_espaces_multiples(self):
        assert normaliser("commerce   de   gros") == "commerce de gros"

    def test_chaine_vide(self):
        assert normaliser("") == ""

    def test_accents_complexes(self):
        # agriculture, élevage, chasse et sylviculture
        result = normaliser("Agriculture, élevage, chasse et sylviculture")
        assert result == "agriculture elevage chasse et sylviculture"


# ── Match exact normalisé ─────────────────────────────────────────────────────

class TestMatchExact:
    def test_libelle_identique(self):
        res = matcher_secteur("Industries extractives", SECTEURS_BASE, ALIAS_VIDES)
        assert res.secteur_id == 1
        assert res.confiance == "certain"
        assert res.score == 100.0
        assert res.source == "exact"

    def test_libelle_majuscules(self):
        res = matcher_secteur("INDUSTRIES EXTRACTIVES", SECTEURS_BASE, ALIAS_VIDES)
        assert res.secteur_id == 1
        assert res.confiance == "certain"
        assert res.source == "exact"

    def test_libelle_avec_accents_differents(self):
        # La base a "Agriculture, élevage..." — on envoie sans accent
        res = matcher_secteur(
            "Agriculture, elevage, chasse et sylviculture", SECTEURS_BASE, ALIAS_VIDES
        )
        assert res.secteur_id == 2
        assert res.source == "exact"

    def test_libelle_avec_code_numerique(self):
        # "012 Industries extractives" → normalise → "industries extractives" → exact
        res = matcher_secteur("012 Industries extractives", SECTEURS_BASE, ALIAS_VIDES)
        assert res.secteur_id == 1
        assert res.source == "exact"

    def test_libelle_code_court(self):
        res = matcher_secteur("3 industries extractives", SECTEURS_BASE, ALIAS_VIDES)
        assert res.secteur_id == 1
        assert res.source == "exact"


# ── Match via alias ───────────────────────────────────────────────────────────

class TestMatchAlias:
    def test_alias_connu(self):
        alias = {"BTP": 3}
        res = matcher_secteur("BTP", SECTEURS_BASE, alias)
        assert res.secteur_id == 3
        assert res.confiance == "certain"
        assert res.score == 100.0
        assert res.source == "alias"

    def test_alias_prioritaire_sur_exact(self):
        # L'alias est testé en premier — même si l'exact matcherait aussi
        alias = {"Industries extractives": 99}
        res = matcher_secteur("Industries extractives", SECTEURS_BASE, alias)
        assert res.secteur_id == 99
        assert res.source == "alias"

    def test_alias_brut_sensible_casse(self):
        # Les alias sont stockés en brut exact : "btp" ≠ "BTP"
        alias = {"BTP": 3}
        res = matcher_secteur("btp", SECTEURS_BASE, alias)
        # "btp" n'est pas dans l'alias → ne doit pas retourner source=alias
        assert res.source != "alias"


# ── Fuzzy > seuil AUTO ────────────────────────────────────────────────────────

class TestFuzzyAuto:
    def test_faute_de_frappe_mineure(self):
        # "Industrie extractive" (singulier, sans s) reste très proche
        res = matcher_secteur("Industrie extractive", SECTEURS_BASE, ALIAS_VIDES)
        assert res.confiance == "certain"
        assert res.source == "fuzzy"
        assert res.secteur_id == 1
        assert res.score >= SEUIL_AUTO

    def test_candidats_presents(self):
        res = matcher_secteur("Industrie extractive", SECTEURS_BASE, ALIAS_VIDES)
        assert len(res.candidats) > 0
        assert res.candidats[0].secteur_id == 1


# ── Fuzzy entre SUGGER et AUTO ────────────────────────────────────────────────

class TestFuzzySuggere:
    def test_score_dans_zone_incertaine(self):
        # Libellé dégradé mais encore reconnaissable — on vérifie que le score
        # réel tombe bien entre les deux seuils avant d'asserter la confiance.
        secteurs = [
            {"id": 10, "libelle": "Fabrication de textiles et articles d habillement", "code": "020"},
        ]
        # "fabrication textiles habillement" vs "fabrication de textiles et articles d habillement"
        # token_sort_ratio ≈ 84 → zone suggere
        res = matcher_secteur("fabrication textiles habillement", secteurs, ALIAS_VIDES)
        assert SEUIL_SUGGER <= res.score < SEUIL_AUTO, (
            f"Score attendu dans [{SEUIL_SUGGER}, {SEUIL_AUTO}), obtenu {res.score}"
        )
        assert res.confiance == "suggere"
        assert res.source == "fuzzy"
        assert res.secteur_id == 10


# ── Fuzzy < SUGGER ────────────────────────────────────────────────────────────

class TestFuzzyAucun:
    def test_libelle_hors_domaine(self):
        res = matcher_secteur("xyzzy foo bar baz qux", SECTEURS_BASE, ALIAS_VIDES)
        assert res.confiance == "aucun"
        assert res.secteur_id is None
        assert res.source == "aucun"

    def test_chaine_vide(self):
        res = matcher_secteur("", SECTEURS_BASE, ALIAS_VIDES)
        assert res.confiance == "aucun"
        assert res.secteur_id is None


# ── Détection de niveau (le code sert au niveau, pas à l'identité) ──────────────

class TestDetecterNiveau:
    def test_global(self):
        assert detecter_niveau("0") == NIVEAU_GLOBAL
        assert detecter_niveau(0) == NIVEAU_GLOBAL

    def test_secteur(self):
        assert detecter_niveau("1") == NIVEAU_SECTEUR
        assert detecter_niveau("3") == NIVEAU_SECTEUR
        assert detecter_niveau("35") == NIVEAU_SECTEUR

    def test_groupe(self):
        assert detecter_niveau("101") == NIVEAU_GROUPE
        assert detecter_niveau("109") == NIVEAU_GROUPE

    def test_macro(self):
        assert detecter_niveau("201") == NIVEAU_MACRO
        assert detecter_niveau("204") == NIVEAU_MACRO

    def test_absent_ou_hors_plage(self):
        assert detecter_niveau(None) is None
        assert detecter_niveau("") is None
        assert detecter_niveau("999") is None


# ── Cas réel BDEF : le code ne doit JAMAIS servir à l'identité ──────────────────

class TestCodeNonUtilisePourIdentite:
    def test_code_bdef_divergent_matche_par_libelle(self):
        # Cas réel du BDEF officiel 2024 : « Industries extractives » porte le
        # code 3 dans le fichier, mais le code 012 dans notre base. Le matching
        # doit suivre le LIBELLÉ (→ id 1), jamais le code (qui pointerait vers
        # un secteur sans rapport).
        res = matcher_secteur("3 INDUSTRIES EXTRACTIVES", SECTEURS_BASE, ALIAS_VIDES)
        assert res.secteur_id == 1
        assert res.confiance == "certain"

    def test_code_trompeur_ignore(self):
        # Le brut porte le code "001" (qui chez nous = Agriculture), mais le
        # libellé dit clairement « Industries extractives » → on suit le libellé.
        res = matcher_secteur("001 Industries extractives", SECTEURS_BASE, ALIAS_VIDES)
        assert res.secteur_id == 1
