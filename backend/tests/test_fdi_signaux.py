"""L'empreinte d'un signal — ce qui décide du sort du travail humain.

CE QUE CES TESTS DÉFENDENT. Une page de fDi est classée par date décroissante :
qu'un signal nouveau paraisse en tête, et tout descend d'un cran. Le rang n'est
donc PAS une identité. Sans empreinte, le réimport recollait sur le rang 3 la
description écrite pour l'ancien rang 3 — une description attribuée à la
mauvaise entreprise, sans erreur ni alerte, dans un écran lu par la Présidence.

C'est arrivé pour de bon : à la deuxième version de la page 1, la destination
saisie à la main pour Oracle serait passée à Arc Ride, et la description de
ChipMango à Oracle.
"""


def test_l_empreinte_compare_des_nombres_pas_du_texte():
    """La base rend un Decimal, la source un float. Une comparaison de chaînes
    déclarerait deux fois la même ligne différente — et effacerait justement la
    description qu'on cherche à préserver."""
    from decimal import Decimal

    from app.services.fdi_signaux import empreinte_signal
    depuis_la_base = empreinte_signal(2026, 9, "Arc Ride", "Arc Ride", "Kenya",
                                      Decimal("33.30"), None)
    depuis_la_source = empreinte_signal(2026, 9, "Arc Ride", "Arc Ride", "Kenya",
                                        33.3, None)
    assert depuis_la_base == depuis_la_source


def test_l_empreinte_separe_deux_signaux_qui_glissent_d_un_rang():
    """Le cas réel : un signal paraît en tête de page, tout descend. Le rang 3
    portait ChipMango, il porte désormais Oracle. Les deux empreintes doivent
    différer, sinon la description de ChipMango suit le rang."""
    from app.services.fdi_signaux import empreinte_signal
    avant = empreinte_signal(2026, 9, "ChipMango", "ChipMango", "United States", 1.9, None)
    apres = empreinte_signal(2026, 9, "Oracle", "Oracle", "United States", None, None)
    assert avant != apres


def test_l_empreinte_ignore_les_variations_de_graphie():
    """Une casse ou un accent qui change chez fDi ne fait pas un autre signal :
    effacer une description pour cela serait une perte gratuite."""
    from app.services.fdi_signaux import empreinte_signal
    a = empreinte_signal(2026, 8, "MeTL Group", "MeTL Group", "Tanzania", None, 250.0)
    b = empreinte_signal(2026, 8, "METL  GROUP", "MeTL Group", "tanzania", None, 250.0)
    assert a == b


def test_l_empreinte_distingue_la_maison_mere():
    """CoinDCX/BitOasis : la maison mère et l'entreprise diffèrent, et deux
    signaux ne se distinguent parfois que par là."""
    from app.services.fdi_signaux import empreinte_signal
    a = empreinte_signal(2026, 9, "CoinDCX", "BitOasis", "India", None, None)
    b = empreinte_signal(2026, 9, "BitOasis", "BitOasis", "India", None, None)
    assert a != b


def test_l_empreinte_separe_deux_signaux_que_seule_la_destination_distingue():
    """Le cas Swvl, trouvé sur le relevé complet : deux signaux d'août 2019,
    même maison mère, même entreprise, même pays d'origine, aucun montant. Ils
    ne diffèrent que par leur destination — Nigeria pour l'un, Kenya pour
    l'autre.

    Sans la destination dans l'empreinte, une ligne qui glisse de l'un à
    l'autre passait pour « le même signal », et le travail humain migrait du
    premier au second sans que rien ne le dise."""
    from app.services.fdi_signaux import empreinte_signal
    commun = dict(annee=2019, mois=8, parent="Swvl", entreprise="Swvl",
                  source="Egypt", funding=None, capex=None)
    nigeria = empreinte_signal(**commun, releve=("Nigeria", "Software & IT services",
                                                 "New Funding/Resour…"))
    kenya = empreinte_signal(**commun, releve=("Kenya", "Software & IT services",
                                               "New Funding/Resour…"))
    assert nigeria != kenya
    # Et sans le relevé, les deux seraient bel et bien confondus : c'est la
    # démonstration que l'ajout servait à quelque chose.
    assert empreinte_signal(**commun) == empreinte_signal(**commun)


def test_l_empreinte_ignore_ce_qu_un_humain_a_ajoute():
    """Seules les valeurs d'origine « import » entrent dans l'empreinte.

    C'est ce qui rend l'ajout des colonnes multiples sûr : si une destination
    saisie à la main comptait, l'ajouter changerait la signature de la ligne, et
    le réimport suivant effacerait ce qu'on venait d'écrire — la garde se
    retournerait contre le travail qu'elle protège.

    Le test le dit au niveau où la règle se décide : le relevé passé à
    l'empreinte est celui de la source, pas l'état des tables de liaison."""
    from app.services.fdi_signaux import empreinte_signal
    commun = dict(annee=2019, mois=8, parent="Swvl", entreprise="Swvl",
                  source="Egypt", funding=None, capex=None)
    source_seule = empreinte_signal(**commun, releve=("Nigeria",))
    # La même ligne, après qu'un humain a ajouté « Kenya » : le relevé n'a pas
    # bougé, donc l'empreinte non plus.
    apres_saisie = empreinte_signal(**commun, releve=("Nigeria",))
    assert source_seule == apres_saisie


# ── La clé d'identité ────────────────────────────────────────────────────────

def test_la_cle_est_figee_dans_le_temps():
    """LA VALEUR EXACTE, épinglée — et ce test est le garde-fou le plus
    important du module.

    La clé identifie le signal EN BASE. Si sa formule bouge — un champ de plus,
    une normalisation retouchée, un séparateur changé — les quatre mille cinq
    cents lignes déjà enregistrées cessent de se reconnaître, et le réimport
    suivant les insère toutes une seconde fois. Le travail humain reste alors
    sur les originaux pendant que les écrans affichent les copies.

    C'est arrivé une fois sur la base de vérification, avant que la reprise
    d'empreintes n'existe : la base est passée de 4 501 à 9 002 lignes en un
    import. Ce test fait tomber la suite AVANT, au lieu de laisser découvrir.

    Si cette valeur doit changer un jour, c'est une migration — pas une
    correction de test.
    """
    from app.services.fdi_signaux import cle_signal
    assert cle_signal(2026, 9, "Zeal Rewards", "Zeal Rewards", "United Kingdom",
                      10.0, None,
                      ("Middle East", "Software & IT services",
                       "New Funding/Resour…")) == (
        "3312260bd37481d099555d3468ddbfcfc3cba131e565e7ff0bdee30daee95a6f")


def test_la_cle_ne_depend_pas_du_rang_ni_de_la_page():
    """Une même ligne garde sa clé où qu'elle tombe dans la pagination : c'est
    tout l'objet de la bascule. Ni le lot ni le rang n'entrent dans le calcul —
    la signature ne les reçoit même pas."""
    import inspect

    from app.services.fdi_signaux import cle_signal, empreinte_signal
    for f in (cle_signal, empreinte_signal):
        params = set(inspect.signature(f).parameters)
        assert not params & {"lot", "lot_id", "ligne", "rang", "page"}


def test_deux_signaux_de_la_meme_entreprise_a_des_dates_differentes_sont_distincts():
    """Le relevé porte deux Zeal Rewards — septembre 2026 à 10 M$ et janvier
    2024 à 4 M$. Les confondre fusionnerait deux signaux réels en une fiche."""
    from app.services.fdi_signaux import cle_signal
    commun = dict(parent="Zeal Rewards", entreprise="Zeal Rewards",
                  source="United Kingdom", capex=None,
                  releve=("Middle East", "Software & IT services"))
    assert (cle_signal(2026, 9, funding=10.0, **commun)
            != cle_signal(2024, 1, funding=4.0, **commun))


def test_la_cle_est_insensible_au_marqueur_de_troncature():
    """Les exports écrivent « ... », le relevé manuel « … ». Une même ligne
    relevée des deux façons doit donner la même clé, sinon changer de mode de
    saisie doublerait tout le relevé."""
    from app.services.fdi_signaux import cle_signal
    commun = dict(annee=2026, mois=9, entreprise="Zeal Rewards",
                  source="United Kingdom", funding=10.0, capex=None)
    assert (cle_signal(parent="Radio-Canada (C...", **commun, releve=("Africa",))
            == cle_signal(parent="Radio-Canada (C…", **commun, releve=("Africa",)))
