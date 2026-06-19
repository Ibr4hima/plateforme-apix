"""Tests du cœur de décision bdef_decision — pur, sans BD ni fichier."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.bdef_excel import BlocTableau, LigneValeur, FEUILLE_COMPTES, FEUILLE_RATIOS
from app.services.bdef_mapping import IndicateurMeta
from app.services.bdef_decision import decider_import
from app.utils.bdef_matching import NIVEAU_SECTEUR, NIVEAU_GROUPE, NIVEAU_MACRO, NIVEAU_GLOBAL


def _bloc(code, niveau, libelle, feuille, type_bloc, data):
    lignes = [LigneValeur(cle=k, libelle_brut=k, valeurs=v) for k, v in data.items()]
    annees = sorted({a for lv in lignes for a in lv.valeurs})
    return BlocTableau(code=code, niveau=niveau, libelle_secteur=libelle,
                       feuille=feuille, type_bloc=type_bloc, sous_type="",
                       annees=annees, lignes=lignes)


IND = [IndicateurMeta("act_ca", "lu", "ref:TI", None)]

CANDIDATS = {
    NIVEAU_SECTEUR: [
        {"id": 12, "libelle": "Industries extractives", "code": "012"},
        {"id": 3,  "libelle": "Production de viande et de poissons", "code": "003"},
    ],
    NIVEAU_GROUPE: [
        {"id": 105, "libelle": "Commerce", "code": "105"},
    ],
    NIVEAU_MACRO: [
        {"id": 203, "libelle": "Commerce", "code": "203"},
    ],
}


def _groupes(*blocs):
    g = {}
    for b in blocs:
        g.setdefault((b.code, b.niveau), []).append(b)
    return g


class TestDecision:
    def test_match_certain_par_libelle(self):
        # code 3 au fichier mais libellé "Industries extractives" → cible 12
        b = _bloc("3", NIVEAU_SECTEUR, "INDUSTRIES EXTRACTIVES", FEUILLE_COMPTES, "B",
                  {"ref:TI": {2024: 100.0}})
        d = decider_import(_groupes(b), IND, CANDIDATS, {})
        assert not d.bloque
        assert len(d.matches) == 1
        assert d.matches[0].cible_id == 12

    def test_global_sans_matching(self):
        b = _bloc("0", NIVEAU_GLOBAL, "GLOBAL DES SECTEURS", FEUILLE_COMPTES, "B",
                  {"ref:TI": {2024: 999.0}})
        d = decider_import(_groupes(b), IND, CANDIDATS, {})
        assert len(d.matches) == 1
        assert d.matches[0].cible_id is None
        assert d.matches[0].niveau == NIVEAU_GLOBAL

    def test_incertain_part_en_revue_et_bloque(self):
        b = _bloc("99", NIVEAU_SECTEUR, "Quelque chose de totalement inconnu xyz",
                  FEUILLE_COMPTES, "B", {"ref:TI": {2024: 1.0}})
        d = decider_import(_groupes(b), IND, CANDIDATS, {})
        assert d.bloque
        assert len(d.revue) == 1
        assert d.revue[0].code == "99"
        assert d.revue[0].candidats  # top candidats fournis

    def test_alias_resout_incertain(self):
        b = _bloc("99", NIVEAU_SECTEUR, "Truc ambigu", FEUILLE_COMPTES, "B",
                  {"ref:TI": {2024: 1.0}})
        alias = {NIVEAU_SECTEUR: {"Truc ambigu": 12}}
        d = decider_import(_groupes(b), IND, CANDIDATS, alias)
        assert not d.bloque
        assert d.matches[0].cible_id == 12

    def test_commerce_groupe_vs_macro_par_niveau(self):
        # Même libellé "COMMERCE" à deux niveaux → chacun matché dans son niveau
        bg = _bloc("105", NIVEAU_GROUPE, "COMMERCE", FEUILLE_COMPTES, "B", {"ref:TI": {2024: 1.0}})
        bm = _bloc("203", NIVEAU_MACRO, "COMMERCE", FEUILLE_COMPTES, "B", {"ref:TI": {2024: 2.0}})
        d = decider_import(_groupes(bg, bm), IND, CANDIDATS, {})
        cibles = {(m.niveau, m.cible_id) for m in d.matches}
        assert (NIVEAU_GROUPE, 105) in cibles
        assert (NIVEAU_MACRO, 203) in cibles

    def test_annees_collectees(self):
        b = _bloc("3", NIVEAU_SECTEUR, "INDUSTRIES EXTRACTIVES", FEUILLE_COMPTES, "B",
                  {"ref:TI": {2022: 1.0, 2023: 2.0, 2024: 3.0}})
        d = decider_import(_groupes(b), IND, CANDIDATS, {})
        assert d.annees == [2022, 2023, 2024]

    def test_un_seul_incertain_bloque_tout(self):
        ok = _bloc("3", NIVEAU_SECTEUR, "INDUSTRIES EXTRACTIVES", FEUILLE_COMPTES, "B", {"ref:TI": {2024: 1.0}})
        ko = _bloc("99", NIVEAU_SECTEUR, "zzz inconnu", FEUILLE_COMPTES, "B", {"ref:TI": {2024: 1.0}})
        d = decider_import(_groupes(ok, ko), IND, CANDIDATS, {})
        assert d.bloque
        assert len(d.matches) == 1   # le certain est résolu mais non écrit (couche BD)
        assert len(d.revue) == 1
