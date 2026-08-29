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
