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


def test_l_empreinte_ne_regarde_pas_les_colonnes_multiples():
    """Les destinations, secteurs, activités et natures vivent en tables de
    liaison. Les faire entrer dans l'empreinte retournerait la garde contre le
    travail qu'elle protège : une destination ajoutée à la main changerait la
    signature de la ligne, et le réimport suivant l'effacerait elle-même."""
    import inspect

    from app.services.fdi_signaux import empreinte_signal
    parametres = list(inspect.signature(empreinte_signal).parameters)
    assert parametres == ["annee", "mois", "parent", "entreprise", "source",
                          "funding", "capex"]
