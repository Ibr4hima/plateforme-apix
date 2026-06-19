"""Tests de bdef_verification — pur, sans BD ni fichier."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.bdef_verification import (
    verifier, SecteurValeurs, IndicateurInfo, comparer_fidelite,
)

# Référentiel d'indicateurs minimal pour les tests
INDS = {
    "act_ca":         IndicateurInfo("Chiffre d'affaires", "FCFA", "lu"),
    "act_tx_ca":      IndicateurInfo("Taux croissance CA", "%", "calcule"),
    "act_production": IndicateurInfo("Production", "FCFA", "lu"),
    "act_tx_prod":    IndicateurInfo("Taux croissance prod", "%", "lu_ou_calcule"),
    "act_va":         IndicateurInfo("Valeur ajoutée", "FCFA", "lu"),
    "rent_ebe":       IndicateurInfo("EBE", "FCFA", "lu"),
    "inv_actif_immo": IndicateurInfo("Actif immobilisé", "FCFA", "lu"),
    "inv_tx_autofin": IndicateurInfo("Taux autofin", "%", "calcule"),
    "_raw_caf":       IndicateurInfo("CAF", "FCFA", "lu"),
}


def _sect(niveau, cible, libelle, valeurs):
    return SecteurValeurs(niveau=niveau, cible_id=cible, libelle=libelle, valeurs=valeurs)


def _anoms(rapport, categorie=None, severite=None, indicateur=None):
    return [a for a in rapport.anomalies
            if (categorie is None or a.categorie == categorie)
            and (severite is None or a.severite == severite)
            and (indicateur is None or a.indicateur == indicateur)]


class TestRecalcul:
    def test_tx_ca_coherent_aucune_anomalie(self):
        # CA 100 → 110 : taux = 0.1, correctement stocké
        sv = _sect("secteur", 1, "S1", {
            "act_ca": {2023: 100.0, 2024: 110.0},
            "act_tx_ca": {2024: 0.1},
        })
        r = verifier([sv], INDS)
        assert _anoms(r, categorie="recalcul") == []

    def test_tx_ca_incoherent_erreur(self):
        # taux stocké faux (0.5 au lieu de 0.1) → erreur de recalcul
        sv = _sect("secteur", 1, "S1", {
            "act_ca": {2023: 100.0, 2024: 110.0},
            "act_tx_ca": {2024: 0.5},
        })
        r = verifier([sv], INDS)
        errs = _anoms(r, categorie="recalcul", severite="erreur", indicateur="act_tx_ca")
        assert len(errs) == 1
        assert errs[0].annee == 2024

    def test_tx_prod_incoherent_avertissement_pas_erreur(self):
        # act_tx_prod est lu_ou_calcule → divergence = avertissement, pas erreur
        sv = _sect("secteur", 1, "S1", {
            "act_production": {2023: 200.0, 2024: 220.0},
            "act_tx_prod": {2024: 0.9},
        })
        r = verifier([sv], INDS)
        assert _anoms(r, categorie="recalcul", severite="erreur") == []
        assert len(_anoms(r, categorie="recalcul", severite="avertissement")) == 1

    def test_tx_autofin_recalcul(self):
        # (CAF 50 / immo 200) * 100 = 25
        ok = _sect("secteur", 1, "OK", {
            "_raw_caf": {2024: 50.0}, "inv_actif_immo": {2024: 200.0},
            "inv_tx_autofin": {2024: 25.0},
        })
        ko = _sect("secteur", 2, "KO", {
            "_raw_caf": {2024: 50.0}, "inv_actif_immo": {2024: 200.0},
            "inv_tx_autofin": {2024: 99.0},
        })
        r = verifier([ok, ko], INDS)
        errs = _anoms(r, categorie="recalcul", indicateur="inv_tx_autofin", severite="erreur")
        assert len(errs) == 1
        assert errs[0].cible_id == 2


class TestCouverture:
    def test_indicateur_vide_erreur(self):
        # act_va défini dans le référentiel mais absent partout → erreur couverture
        sv = _sect("secteur", 1, "S1", {"act_ca": {2024: 100.0}})
        r = verifier([sv], INDS)
        errs = _anoms(r, categorie="borne", indicateur="act_va", severite="erreur")
        assert len(errs) == 1
        cov = next(c for c in r.couverture if c.code == "act_va")
        assert cov.nb_present == 0

    def test_couverture_complete(self):
        secteurs = [
            _sect("secteur", i, f"S{i}", {"act_ca": {2024: 100.0 + i}})
            for i in range(1, 4)
        ]
        r = verifier(secteurs, {"act_ca": INDS["act_ca"]})
        cov = next(c for c in r.couverture if c.code == "act_ca")
        assert cov.taux == 1.0
        assert cov.nb_present == 3

    def test_raw_exclu_de_la_couverture(self):
        sv = _sect("secteur", 1, "S1", {"_raw_caf": {2024: 10.0}})
        r = verifier([sv], INDS)
        assert all(c.code != "_raw_caf" for c in r.couverture)


class TestBornes:
    def test_montant_negatif_erreur(self):
        sv = _sect("secteur", 1, "S1", {"act_ca": {2024: -5.0}})
        r = verifier([sv], {"act_ca": INDS["act_ca"]})
        errs = _anoms(r, categorie="borne", indicateur="act_ca", severite="erreur")
        assert len(errs) == 1

    def test_valeur_demesuree_erreur(self):
        sv = _sect("secteur", 1, "S1", {"act_va": {2024: 1e16}})
        r = verifier([sv], {"act_va": INDS["act_va"]})
        assert len(_anoms(r, categorie="borne", severite="erreur")) >= 1

    def test_ebe_negatif_autorise(self):
        # rent_ebe n'est pas dans la liste des montants strictement positifs
        sv = _sect("secteur", 1, "S1", {"rent_ebe": {2024: -10.0}})
        r = verifier([sv], {"rent_ebe": INDS["rent_ebe"]})
        assert _anoms(r, categorie="borne", indicateur="rent_ebe") == []


class TestOutliers:
    def test_outlier_detecte(self):
        # 9 secteurs autour de 100, un à 100000 → outlier
        secteurs = [_sect("secteur", i, f"S{i}", {"act_ca": {2024: 100.0 + i}})
                    for i in range(1, 10)]
        secteurs.append(_sect("secteur", 99, "ABERRANT", {"act_ca": {2024: 100000.0}}))
        r = verifier(secteurs, {"act_ca": INDS["act_ca"]})
        outs = _anoms(r, categorie="outlier", indicateur="act_ca")
        assert len(outs) == 1
        assert outs[0].cible_id == 99

    def test_pas_doutlier_sur_petit_echantillon(self):
        secteurs = [_sect("secteur", 1, "S1", {"act_ca": {2024: 100.0}}),
                    _sect("secteur", 2, "S2", {"act_ca": {2024: 100000.0}})]
        r = verifier(secteurs, {"act_ca": INDS["act_ca"]})
        assert _anoms(r, categorie="outlier") == []


class TestCoherence:
    def test_va_superieure_ca(self):
        sv = _sect("secteur", 1, "S1", {
            "act_ca": {2024: 100.0}, "act_va": {2024: 150.0},
        })
        r = verifier([sv], INDS)
        assert len(_anoms(r, categorie="coherence", indicateur="act_va")) == 1

    def test_ebe_superieur_va(self):
        sv = _sect("secteur", 1, "S1", {
            "act_va": {2024: 80.0}, "rent_ebe": {2024: 120.0},
        })
        r = verifier([sv], INDS)
        assert len(_anoms(r, categorie="coherence", indicateur="rent_ebe")) == 1

    def test_relations_normales_ok(self):
        sv = _sect("secteur", 1, "S1", {
            "act_ca": {2024: 200.0}, "act_va": {2024: 120.0}, "rent_ebe": {2024: 60.0},
        })
        r = verifier([sv], INDS)
        assert _anoms(r, categorie="coherence") == []


class TestScore:
    def test_score_parfait_sans_erreur(self):
        sv = _sect("secteur", 1, "S1", {
            "act_ca": {2023: 100.0, 2024: 110.0}, "act_tx_ca": {2024: 0.1},
        })
        r = verifier([sv], {"act_ca": INDS["act_ca"], "act_tx_ca": INDS["act_tx_ca"]})
        assert r.score == 100.0
        assert r.nb_erreurs == 0

    def test_score_baisse_avec_erreurs(self):
        secteurs = [_sect("secteur", i, f"S{i}",
                          {"act_ca": {2024: 100.0 + i}}) for i in range(1, 5)]
        secteurs[0].valeurs["act_ca"][2024] = -1.0   # 1 valeur en erreur sur 4
        r = verifier(secteurs, {"act_ca": INDS["act_ca"]})
        assert r.score == 75.0


class TestFidelite:
    def test_tout_identique(self):
        attendu = {("act_ca", "secteur", 1, 2024): 100.0,
                   ("act_va", "secteur", 1, 2024): 60.0}
        relu = dict(attendu)
        r = comparer_fidelite(attendu, relu)
        assert r.total == 2
        assert r.identiques == 2
        assert r.divergences == []
        assert r.taux == 1.0

    def test_arrondi_stockage_tolere(self):
        # la base stocke en Numeric(20,4) → 0.12345 devient 0.1234/0.1235
        attendu = {("rent_eco", "secteur", 1, 2024): 0.12345}
        relu = {("rent_eco", "secteur", 1, 2024): 0.1234}
        r = comparer_fidelite(attendu, relu)
        assert r.identiques == 1
        assert r.divergences == []

    def test_valeur_manquante_en_base(self):
        attendu = {("act_ca", "secteur", 1, 2024): 100.0}
        r = comparer_fidelite(attendu, {})
        assert r.identiques == 0
        assert len(r.divergences) == 1
        assert r.divergences[0].trouve is None

    def test_valeur_alteree(self):
        attendu = {("act_ca", "secteur", 1, 2024): 100.0}
        relu = {("act_ca", "secteur", 1, 2024): 999.0}
        r = comparer_fidelite(attendu, relu)
        assert len(r.divergences) == 1
        assert r.divergences[0].attendu == 100.0
        assert r.divergences[0].trouve == 999.0

    def test_taux_partiel(self):
        attendu = {("a", "secteur", 1, 2024): 1.0, ("b", "secteur", 1, 2024): 2.0,
                   ("c", "secteur", 1, 2024): 3.0, ("d", "secteur", 1, 2024): 4.0}
        relu = {("a", "secteur", 1, 2024): 1.0, ("b", "secteur", 1, 2024): 2.0,
                ("c", "secteur", 1, 2024): 3.0, ("d", "secteur", 1, 2024): 999.0}
        r = comparer_fidelite(attendu, relu)
        assert r.taux == 0.75
