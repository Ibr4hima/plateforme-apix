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


# ── Page publique : le sens de lecture ────────────────────────────────────────

def test_le_sens_choisit_quel_pays_est_observe():
    """« Destination » observe le pays d'arrivée et montre les pays d'origine en
    face ; « Source » fait l'inverse. C'est toute la bascule de la page."""
    from app.services.fdi_projets import sens_de_lecture as _sens
    assert _sens("destination") == ("pays_dest", "pays_source")
    assert _sens("source") == ("pays_source", "pays_dest")


def test_un_sens_inconnu_retombe_sur_la_destination():
    """Une URL bricolée ne doit pas casser la page : le sens par défaut est
    celui qui intéresse l'APIX, ce que le Sénégal reçoit."""
    from app.services.fdi_projets import sens_de_lecture as _sens
    assert _sens("n'importe quoi") == ("pays_dest", "pays_source")


def test_les_filtres_multiples_se_separent_par_barre_verticale():
    """La virgule et le point-virgule apparaissent dans les libellés eux-mêmes
    (« Pesticide, fertilisers & … ») : les prendre pour séparateurs couperait
    un secteur en deux filtres qui ne trouveraient rien."""
    from app.services.fdi_projets import filtres_multiples as _liste
    assert _liste("Produits chimiques|Services financiers") == ["Produits chimiques", "Services financiers"]
    assert _liste("Pesticide, fertilisers & other agricultural chemicals") == \
        ["Pesticide, fertilisers & other agricultural chemicals"]
    assert _liste(None) == [] and _liste("") == []


# ── Variantes de graphie : quand fDi se contredit lui-même ────────────────────

def test_la_source_ecrit_deux_fois_le_meme_poste():
    """Régression, relevée sur la page 2 du Sénégal.

    Le classeur de classification écrit « Computing infrastucture », la table
    des projets « Computing infrastructure ». Le libellé de la nomenclature
    reste verbatim — c'est la source — et la variante s'ajoute comme second
    chemin vers le même poste.
    """
    from app.services.fdi_projets import lire_variantes
    variantes = lire_variantes()
    codes = [c for c, _ in variantes.get("sous", [])]
    assert "communications__computing_infrastucture_providers_data_p" in codes


def test_deux_graphies_du_meme_poste_ne_font_pas_une_ambiguite():
    """L'ambiguïté, c'est deux POSTES possibles — pas deux libellés d'un seul.

    Sans cette distinction, ajouter une variante rendrait indécidable ce qui
    l'était parfaitement.
    """
    candidats = [
        {"id": 68, "libelle_en": "Computing infrastucture providers, data processing"},
        {"id": 68, "libelle_en": "Computing infrastructure providers, data processing"},
    ]
    verdict, trouves = rapprocher("Computing infrastruc…", candidats)
    assert verdict == "unique" and trouves[0]["id"] == 68


def test_deux_postes_distincts_restent_ambigus():
    """Le garde-fou de la règle précédente : des identifiants différents
    n'autorisent toujours aucune devinette."""
    candidats = [{"id": 1, "libelle_en": "Pipeline transportation of crude oil"},
                 {"id": 2, "libelle_en": "Pipeline transportation of natural gas"}]
    verdict, trouves = rapprocher("Pipeline transportation…", candidats)
    assert verdict == "ambigu" and len(trouves) == 2


def test_la_page_2_est_lisible_et_ordonnee():
    from app.services.fdi_projets import lire_lot_csv, DOSSIER_PROJETS
    lignes = lire_lot_csv(DOSSIER_PROJETS / "senegal_p02.csv")
    assert len(lignes) == 15
    assert [l["ligne"] for l in lignes] == list(range(1, 16))
    # Le milliard de DP World, déclaré ; ses 3 000 emplois, estimés.
    dp = lignes[12]
    assert dp["entreprise"] == "DP World"
    assert lire_montant(dp["capex"]) == (1200.0, False)
    assert lire_entier(dp["emplois"]) == (3000, True)


def test_les_pages_relevees_sont_lisibles():
    """Chaque page est un lot de quinze lignes, rangs 1 à 15 : c'est ce que la
    source pagine, et ce sur quoi la préservation des saisies s'appuie. La
    numérotation doit rester continue — une page sautée passerait inaperçue."""
    from app.services.fdi_projets import lire_lot_csv, DOSSIER_PROJETS
    pages = sorted(DOSSIER_PROJETS.glob("senegal_p*.csv"))
    assert [p.name for p in pages] == [f"senegal_p{n:02d}.csv" for n in range(1, len(pages) + 1)]
    for chemin in pages:
        lignes = lire_lot_csv(chemin)
        assert [l["ligne"] for l in lignes] == list(range(1, len(lignes) + 1))
    # Quinze lignes par page, sauf la dernière que la source ne remplit pas.
    tailles = [len(lire_lot_csv(p)) for p in pages]
    assert set(tailles[:-1]) == {15} and 1 <= tailles[-1] <= 15
    # Le compte annoncé par fDi pour le périmètre Sénégal. Une page relevée
    # deux fois, ou une ligne oubliée, se verrait ici.
    assert sum(tailles) == 235


def test_la_source_ecrit_la_cote_d_ivoire_sans_apostrophe(pays):
    """Relevé page 3 : fDi écrit « Côte d Ivoire ». La normalisation retire la
    ponctuation avant de comparer, donc les trois graphies mènent au même pays."""
    assert pays[normaliser("Côte d Ivoire")] == "CIV"


def test_un_pays_tronque_se_resout_par_prefixe(pays):
    """Relevé page 11 : la colonne Source est tronquée comme les autres —
    « Republic of the C… ». Un seul pays commence ainsi, on tranche."""
    from app.services.fdi_projets import _pays
    ref = {c: 1 for c in pays.values()}
    assert _pays("Republic of the C…", pays, ref) == (1, None)


def test_un_prefixe_de_pays_ambigu_est_refuse(pays):
    """« Turk… » vaut pour la Turquie comme pour le Turkménistan : la ligne
    entre avec son texte brut plutôt qu'avec un pays inventé."""
    from app.services.fdi_projets import _pays
    ref = {c: 1 for c in pays.values()}
    assert _pays("Turk…", pays, ref) == (None, "préfixe ambigu")


# ── Le relevé Afrique ─────────────────────────────────────────────────────────

def test_les_pages_afrique_sont_lisibles():
    """Même exigence que pour le Sénégal : pagination continue, quinze lignes
    par page. Sur mille cent vingt-six pages annoncées par la source, c'est le
    seul contrôle qui verra une page sautée ou relevée deux fois."""
    from app.services.fdi_projets import lire_lot_csv, DOSSIER_PROJETS
    pages = sorted(DOSSIER_PROJETS.glob("afrique_p*.csv"))
    assert [p.name for p in pages] == [f"afrique_p{n:02d}.csv" for n in range(1, len(pages) + 1)]
    tailles = [len(lire_lot_csv(p)) for p in pages]
    assert set(tailles[:-1]) == {15} and 1 <= tailles[-1] <= 15
    for chemin in pages:
        lignes = lire_lot_csv(chemin)
        assert [l["ligne"] for l in lignes] == list(range(1, len(lignes) + 1))


def test_le_releve_afrique_ne_reprend_pas_le_senegal():
    """Le Sénégal est relevé pays par pays. S'il revenait par le relevé
    continental, ses projets seraient comptés deux fois — et le faux total ne
    se verrait qu'au moment où quelqu'un le citerait."""
    from app.services.fdi_projets import lire_lot_csv, DOSSIER_PROJETS
    for chemin in sorted(DOSSIER_PROJETS.glob("afrique_p*.csv")):
        for ligne in lire_lot_csv(chemin):
            assert ligne["dest"].strip().lower() != "senegal", f"{chemin.name} L{ligne['ligne']}"


def test_les_pays_du_releve_afrique_sont_tous_connus():
    """Un pays hors correspondance entrerait en base sans rattachement : la
    ligne existerait, mais aucun filtre ni aucun total ne la verrait passer."""
    from app.services.fdi_projets import lire_lot_csv, lire_pays_csv, DOSSIER_PROJETS, normaliser
    connus = lire_pays_csv()
    for chemin in sorted(DOSSIER_PROJETS.glob("afrique_p*.csv")):
        for ligne in lire_lot_csv(chemin):
            for cote in ("source", "dest"):
                assert normaliser(ligne[cote]) in connus, f"{chemin.name} L{ligne['ligne']} · {ligne[cote]}"


# ── Cascade des facettes : aucune ne se filtre elle-même ─────────────────────

def _where(**kw):
    from app.api.routes.fdi_public import _filtres
    base = dict(observe="pays_dest", pays=None, annee_min=None, annee_max=None,
                secteurs=None, sous_secteurs=None, activites=None, types=None,
                recherche=None, sauf=None)
    return " ".join(_filtres(**{**base, **kw})[0])


def test_le_pays_ne_se_filtre_pas_lui_meme():
    """Compter les pays sous le filtre pays réduit la liste au pays retenu :
    les autres s'affichent au chargement puis disparaissent dès que le premier
    est sélectionné, et plus rien ne permet d'en choisir un second.

    Invisible tant qu'un seul périmètre était relevé — la liste n'avait qu'une
    ligne de toute façon. Le Sénégal et l'Algérie côte à côte l'ont révélé."""
    assert ":pays" in _where(pays="Sénégal")
    assert ":pays" not in _where(pays="Sénégal", sauf="pays")


def test_les_autres_filtres_entrent_bien_dans_le_comptage_des_pays():
    """La cascade doit rester vraie dans l'autre sens : restreindre à un
    secteur ou à une période doit retirer de la liste les pays qui n'ont rien
    annoncé là — sinon on proposerait un pays menant à zéro projet."""
    w = _where(pays="Sénégal", sauf="pays", secteurs="Caoutchouc", annee_min=2015)
    assert ":secteurs" in w and ":a0" in w


def test_chaque_facette_s_exclut_a_son_tour():
    for cle, valeur in (("secteurs", "Textiles"), ("activites", "Fabrication"),
                        ("types", "Extension")):
        assert f":{cle}" in _where(**{cle: valeur})
        assert f":{cle}" not in _where(sauf=cle, **{cle: valeur})
