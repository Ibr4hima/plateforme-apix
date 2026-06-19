"""Tests unitaires du service bdef_mapping — aucune BD, aucun fichier."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.bdef_excel import BlocTableau, LigneValeur, FEUILLE_COMPTES, FEUILLE_RATIOS
from app.services.bdef_mapping import (
    resoudre_indicateurs, grouper_par_secteur,
    IndicateurMeta, ValeursSecteur,
)

# ── Blocs mock ────────────────────────────────────────────────────────────────

def _bloc(code, niveau, feuille, type_bloc, lignes_data: dict[str, dict[int, float]]) -> BlocTableau:
    lignes = [LigneValeur(cle=k, libelle_brut=k, valeurs=v) for k, v in lignes_data.items()]
    annees = sorted({a for lv in lignes for a in lv.valeurs})
    return BlocTableau(
        code=code, niveau=niveau, libelle_secteur="SECTEUR TEST",
        feuille=feuille, type_bloc=type_bloc, sous_type="",
        annees=annees, lignes=lignes,
    )


BLOCS_COMPTES = [
    _bloc("3", "secteur", FEUILLE_COMPTES, "B", {
        "ref:TI": {2022: 1000.0, 2023: 1100.0, 2024: 1200.0},
        "ref:TN": {2022:  350.0, 2023:  385.0, 2024:  400.0},
        "ref:TQ": {2022:  200.0, 2023:  220.0, 2024:  240.0},
        "ref:TX": {2022:  150.0, 2023:  165.0, 2024:  180.0},
        "ref:AZ": {2022: 5000.0, 2023: 5200.0, 2024: 5400.0},
    }),
]
BLOCS_RATIOS = [
    _bloc("3", "secteur", FEUILLE_RATIOS, "E", {
        "lib:production": {2022: 1200.0, 2023: 1250.0, 2024: 1300.0},
    }),
    _bloc("3", "secteur", FEUILLE_RATIOS, "D", {
        "lib:capacite d autofinancement global cafg": {2022: 300.0, 2023: 320.0, 2024: 350.0},
    }),
    _bloc("3", "secteur", FEUILLE_RATIOS, "C", {
        "ratio:valeur ajoutee||production":               {2022: 0.29, 2023: 0.30, 2024: 0.31},
        "ratio:production n production n 1||production n 1": {2023: 0.042, 2024: 0.040},
        "ratio:resultat net||capitaux propres":           {2022: 0.08, 2023: 0.09, 2024: 0.10},
        "ratio:bfr||":                                    {2022: -500.0, 2023: -480.0, 2024: -450.0},
    }),
]

IND_BASE = [
    IndicateurMeta("act_ca",          "lu",            "ref:TI", None),
    IndicateurMeta("act_tx_ca",       "calcule",       None, ["act_ca"]),
    IndicateurMeta("act_va",          "lu",            "ref:TN", None),
    IndicateurMeta("act_tx_va",       "lu",            "ratio:valeur ajoutee||production", None),
    IndicateurMeta("act_production",  "lu",            "lib:production", None),
    IndicateurMeta("act_tx_prod",     "lu_ou_calcule", "ratio:production n production n 1||production n 1", ["act_production"]),
    IndicateurMeta("rent_ebe",        "lu",            "ref:TQ", None),
    IndicateurMeta("rent_rex",        "lu",            "ref:TX", None),
    IndicateurMeta("rent_fin",        "lu",            "ratio:resultat net||capitaux propres", None),
    IndicateurMeta("inv_actif_immo",  "lu",            "ref:AZ", None),
    IndicateurMeta("inv_tx_autofin",  "calcule",       None, ["_raw_caf", "inv_actif_immo"]),
    IndicateurMeta("liq_bfr",         "lu",            "ratio:bfr||", None),
    IndicateurMeta("eff_stock_mp",    "calcule",       None, ["_raw_stocks_mp", "_raw_achats_ht"]),
    IndicateurMeta("_raw_caf",        "lu",            "lib:capacite d autofinancement global cafg", None),
]


class TestResoudreIndicateurs:
    def _vs(self):
        blocs = BLOCS_COMPTES + BLOCS_RATIOS
        return resoudre_indicateurs(blocs, IND_BASE)

    def test_indicateur_lu_direct(self):
        vs = self._vs()
        vals = {v.annee: v.valeur for v in vs.valeurs["act_ca"]}
        assert vals == {2022: 1000.0, 2023: 1100.0, 2024: 1200.0}

    def test_source_est_lu(self):
        vs = self._vs()
        assert all(v.source == "lu" for v in vs.valeurs["act_ca"])

    def test_tx_ca_calcule_entre_annees_consecutives(self):
        vs = self._vs()
        vals = {v.annee: v.valeur for v in vs.valeurs["act_tx_ca"]}
        assert 2022 not in vals                   # pas de T-1 disponible
        assert abs(vals[2023] - 0.10) < 1e-9     # (1100-1000)/1000
        assert abs(vals[2024] - 100/1100) < 1e-9

    def test_source_est_calcule(self):
        vs = self._vs()
        assert all(v.source == "calcule" for v in vs.valeurs["act_tx_ca"])

    def test_lu_ou_calcule_priorite_lu(self):
        # act_tx_prod est dans l'index → doit être 'lu', pas 'calcule'
        vs = self._vs()
        assert any(v.source == "lu" for v in vs.valeurs["act_tx_prod"])

    def test_lu_ou_calcule_fallback(self):
        # Retirer le ratio de taux de production → doit basculer en calcul
        blocs_sans_ratio = [
            _bloc("3", "secteur", FEUILLE_RATIOS, "E", {
                "lib:production": {2022: 1200.0, 2023: 1250.0, 2024: 1300.0},
            }),
        ]
        vs = resoudre_indicateurs(BLOCS_COMPTES + blocs_sans_ratio, IND_BASE)
        sources = {v.source for v in vs.valeurs.get("act_tx_prod", [])}
        assert sources == {"calcule"}

    def test_tx_autofin_calcule(self):
        vs = self._vs()
        vals = {v.annee: v.valeur for v in vs.valeurs["inv_tx_autofin"]}
        assert abs(vals[2024] - (350.0 / 5400.0) * 100) < 1e-6

    def test_bfr_valeur_negative(self):
        vs = self._vs()
        vals = {v.annee: v.valeur for v in vs.valeurs["liq_bfr"]}
        assert vals[2024] == -450.0

    def test_non_disponibles(self):
        vs = self._vs()
        assert "eff_stock_mp" in vs.non_disponibles

    def test_blocs_vides(self):
        vs = resoudre_indicateurs([], IND_BASE)
        assert vs.valeurs == {}

    def test_meta_secteur(self):
        vs = self._vs()
        assert vs.code_bdef == "3"
        assert vs.niveau == "secteur"


class TestGrouperParSecteur:
    def test_separations_par_code(self):
        groupes = grouper_par_secteur(BLOCS_COMPTES, BLOCS_RATIOS)
        assert ("3", "secteur") in groupes
        assert len(groupes[("3", "secteur")]) == len(BLOCS_COMPTES) + len(BLOCS_RATIOS)

    def test_plusieurs_secteurs(self):
        bloc_autre = _bloc("101", "groupe", FEUILLE_COMPTES, "B", {"ref:TI": {2024: 500.0}})
        groupes = grouper_par_secteur(BLOCS_COMPTES + [bloc_autre], BLOCS_RATIOS)
        assert ("101", "groupe") in groupes
        assert ("3", "secteur") in groupes
        assert len(groupes) == 2
