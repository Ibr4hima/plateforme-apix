"""Lecture des lignes de projets fDi : ce qui se résout, ce qui se refuse.

Les valeurs testées ici sont celles relevées sur une capture réelle de l'onglet
« Project database », périmètre Sénégal. Elles ne sont pas inventées : chaque
cas correspond à une ligne que l'import devra traiter.
"""
import csv

import pytest

from app.services.fdi_projets import (
    LigneInvalide,
    est_tronque,
    lire_date,
    lire_entier,
    lire_montant,
    normaliser,
    rapprocher,
)


@pytest.fixture(scope="module")
def sous_secteurs():
    with open("scripts/fdi/fdi_sous_secteurs.csv", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ── Montants et effectifs ─────────────────────────────────────────────────────

def test_l_asterisque_marque_une_estimation():
    assert lire_montant("* $9.60m") == (9.60, True)
    assert lire_montant("$9.98m") == (9.98, False)


def test_l_estimation_se_juge_champ_par_champ():
    """ACWA Power : 800 M$ déclarés, 773 emplois estimés — sur la même ligne.

    C'est la raison d'être des deux drapeaux distincts : un seul, porté par la
    ligne, aurait forcé à qualifier d'estimé un montant qui ne l'est pas.
    """
    assert lire_montant("$800.00m") == (800.0, False)
    assert lire_entier("* 773") == (773, True)


def test_une_valeur_absente_n_est_pas_estimee():
    """Le drapeau reste nul quand la valeur l'est : « estimé » ne veut rien dire
    sans montant, et un `false` laisserait croire à une donnée déclarée."""
    assert lire_montant(None) == (None, None)
    assert lire_montant("-") == (None, None)
    assert lire_entier(None) == (None, None)


def test_les_echelles_sont_ramenees_au_million():
    assert lire_montant("$1.50bn") == (1500.0, False)
    assert lire_montant("* $500k") == (0.5, True)


def test_un_montant_illisible_est_refuse():
    """Mieux vaut un import qui s'arrête qu'un montant inventé."""
    with pytest.raises(LigneInvalide):
        lire_montant("environ dix millions")


# ── Dates ─────────────────────────────────────────────────────────────────────

def test_la_source_ne_donne_que_le_mois():
    assert lire_date("Jun 2026") == (2026, 6)
    assert lire_date("Dec 2025") == (2025, 12)


def test_une_date_future_est_acceptee():
    """fDi date les ANNONCES : un projet annoncé pour 2026 est normal, et
    aucune contrainte ne doit l'interdire."""
    assert lire_date("May 2026")[0] == 2026


def test_une_date_sans_annee_est_refusee():
    with pytest.raises(LigneInvalide):
        lire_date("Juin")


# ── Troncature et rapprochement ───────────────────────────────────────────────

def test_la_troncature_se_detecte_dans_ses_deux_graphies():
    assert est_tronque("Banque de développp…")
    assert est_tronque("Industries Chimique...")
    assert not est_tronque("ACWA Power")


def test_la_normalisation_ignore_la_ponctuation_coupee():
    """La troncature tombe souvent au milieu d'un mot ou d'une ponctuation :
    comparer les chaînes brutes échouerait sur « Pesticide, fertilisers & … »."""
    assert normaliser("Pesticide, fertilisers & …") == "pesticide fertilisers and"


def test_un_libelle_tronque_se_resout_dans_son_secteur(sous_secteurs):
    chimie = [s for s in sous_secteurs if s["secteur_code"] == "chemicals"]
    verdict, trouves = rapprocher("Pesticide, fertilisers & …", chimie)
    assert verdict == "unique"
    assert trouves[0]["libelle_en"] == "Pesticide, fertilisers & other agricultural chemicals"


def test_deux_candidats_ne_sont_jamais_departages(sous_secteurs):
    """L'invariant qui protège la base : face à un doute, on ne devine pas.

    « Pipeline transportation… » vaut pour le pétrole brut comme pour le gaz.
    La ligne repartira sans rattachement, avec son texte brut, pour arbitrage.
    """
    transport = [s for s in sous_secteurs if s["secteur_code"] == "transportation_and_warehousing"]
    verdict, trouves = rapprocher("Pipeline transportation…", transport)
    assert verdict == "ambigu"
    assert len(trouves) == 2


def test_un_libelle_inconnu_est_signale(sous_secteurs):
    """Si fDi introduit un poste que nous n'avons pas, il faut le savoir — pas
    le rattacher au voisin le plus proche."""
    verdict, trouves = rapprocher("Quantum teleportation services", sous_secteurs)
    assert verdict == "aucun" and trouves == []


# ── Empreinte : ce qui décide si une saisie humaine survit à un réimport ──────

def test_l_empreinte_compare_des_nombres_pas_du_texte():
    """Régression. La base rend un Decimal(« 9.60 ») là où la source donne 9.6.

    Comparées en texte, ces deux valeurs déclaraient le projet « différent » à
    chaque réimport : la description saisie à la main était effacée, et
    l'arbitrage d'entreprise perdu. Le défaut a été trouvé en rejouant un import
    réel, pas en relisant le code.
    """
    from decimal import Decimal
    from app.services.fdi_projets import empreinte
    depuis_la_base = empreinte(2026, 5, "Banque de dévelo…", "Financial services",
                               "Retail banking", Decimal("9.60"), 27, "New")
    depuis_la_source = empreinte(2026, 5, "Banque de dévelo…", "Financial services",
                                 "Retail banking", 9.6, 27, "New")
    assert depuis_la_base == depuis_la_source


def test_l_empreinte_distingue_deux_projets_reellement_differents():
    """Les trois lignes Indorama d'octobre 2025 ne diffèrent que par leur montant
    et leur type : l'empreinte doit les séparer, sinon une description migrerait
    de l'une à l'autre."""
    from app.services.fdi_projets import empreinte
    base = dict(annee=2025, mois=10, entreprise="Industries Chimiq…", secteur="Chemicals",
                sous_secteur="Pesticide, fertilisers …", type_projet="New")
    a = empreinte(**base, capex=70.0, emplois=93)
    b = empreinte(**{**base, "type_projet": "Expansion"}, capex=105.0, emplois=139)
    assert a != b


def test_l_empreinte_ignore_les_variations_de_graphie():
    """Une capture à une autre largeur coupe le libellé ailleurs — mais tant que
    le préfixe conservé est le même, il s'agit du même projet."""
    from app.services.fdi_projets import empreinte
    a = empreinte(2026, 6, "AVCI Global", "Textiles", "Clothing & clothing a…", 9.98, 200, "New")
    b = empreinte(2026, 6, "AVCI  Global", "Textiles", "clothing & CLOTHING a…", 9.98, 200, "New")
    assert a == b


def test_le_csv_versionne_est_lisible_et_ordonne():
    from app.services.fdi_projets import lire_lot_csv, DOSSIER_PROJETS
    lignes = lire_lot_csv(DOSSIER_PROJETS / "senegal_p01.csv")
    assert len(lignes) == 15
    assert [l["ligne"] for l in lignes] == list(range(1, 16))
    assert lignes[0]["entreprise"] == "AVCI Global"
    assert lignes[5]["type"] == "Expansion"


# ── Pays : la correspondance anglais → référentiel ────────────────────────────

@pytest.fixture(scope="module")
def pays():
    from app.services.fdi_projets import lire_pays_csv
    return lire_pays_csv()


def test_la_correspondance_pays_est_explicite(pays):
    """fDi nomme en anglais, le référentiel en français : c'est une table, pas
    une ressemblance de chaînes."""
    assert pays[normaliser("Turkey")] == "TUR"
    assert pays[normaliser("Senegal")] == "SEN"
    assert pays[normaliser("United States")] == "USA"


def test_deux_pays_proches_ne_se_confondent_pas(pays):
    """La raison d'être de la table : « Niger » et « Nigeria » sont à deux
    lettres l'un de l'autre, et un projet attribué au mauvais pays serait une
    erreur invisible."""
    assert pays[normaliser("Niger")] == "NER"
    assert pays[normaliser("Nigeria")] == "NGA"


def test_une_graphie_variante_vise_le_meme_pays(pays):
    """La source change de graphie avec le temps ; le code ISO, lui, ne bouge
    pas — c'est par lui que passe le rattachement."""
    assert pays[normaliser("Türkiye")] == pays[normaliser("Turkey")]
    assert pays[normaliser("Ivory Coast")] == pays[normaliser("Côte d'Ivoire")]


def test_un_pays_inconnu_n_est_pas_devine():
    """Taiwan n'est pas au référentiel : la ligne entrera avec son texte brut
    et l'import le signalera, plutôt que de la rattacher à la Chine."""
    from app.services.fdi_projets import _pays, lire_pays_csv
    ident, motif = _pays("Taiwan", lire_pays_csv(), {"CHN": 1})
    assert ident is None and motif == "hors correspondance"


def test_un_pays_connu_absent_du_referentiel_est_distingue():
    """L'autre échec possible, qui n'appelle pas la même correction : le CSV
    connaît le pays, mais ref_pays ne le porte pas encore."""
    from app.services.fdi_projets import _pays, lire_pays_csv
    ident, motif = _pays("Turkey", lire_pays_csv(), {})
    assert ident is None and motif == "TUR absent de ref_pays"
