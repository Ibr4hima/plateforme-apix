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

    Sans les colonnes multiples dans l'empreinte, une ligne qui glisse de l'un à
    l'autre passait pour « le même signal », et le travail humain migrait du
    premier au second sans que rien ne le dise."""
    from app.services.fdi_signaux import empreinte_signal
    commun = dict(annee=2019, mois=8, parent="Swvl", entreprise="Swvl",
                  source="Egypt", funding=None, capex=None)
    assert (empreinte_signal(**commun, releve=("d:p119", "s:30"))
            != empreinte_signal(**commun, releve=("d:p101", "s:30")))


def test_une_saisie_et_un_import_donnent_LA_MEME_identite():
    """LA PROPRIÉTÉ QUI PERMET DE SAISIR SANS ATTENDRE L'EXPORT.

    La source affiche ses libellés tronqués — « New Funding/Resour… » — et un
    import recopie la troncature. Le formulaire de saisie, lui, fait CHOISIR
    dans le référentiel : il connaît le libellé entier. Si l'identité portait le
    texte, ces deux chemins produiraient deux signatures, et l'export qui
    apporterait plus tard un signal déjà saisi en créerait un doublon.

    Elle porte le POSTE : les deux écritures désignent la nature 3, donc le même
    signal."""
    from app.services.fdi_signaux import signature_releve
    tronque = signature_releve({"natures": [{"brut": "New Funding/Resour…", "nature_id": 3}]})
    entier = signature_releve({"natures": [
        {"brut": "New Funding / Resources for Expansion", "nature_id": 3}]})
    assert tronque == entier == ("n:3",)


def test_un_pays_et_une_region_de_meme_identifiant_ne_se_confondent_pas():
    """Les destinations réunissent DEUX référentiels dont les identifiants se
    recoupent : la région 1 et le pays 1 existent tous deux. Les signer pareil
    ferait de « Africa » et de l'Afghanistan le même signal."""
    from app.services.fdi_signaux import signature_releve
    pays = signature_releve({"destinations": [{"brut": "X", "pays_id": 1, "region_id": None}]})
    region = signature_releve({"destinations": [{"brut": "X", "pays_id": None, "region_id": 1}]})
    assert pays == ("d:p1",) and region == ("d:r1",)


def test_une_valeur_non_rattachee_se_signe_par_son_texte():
    """Faute de poste, on signe le texte normalisé — et on le marque d'un tilde
    pour qu'il ne se confonde jamais avec un identifiant.

    La conséquence est assumée et documentée : si la nomenclature est corrigée
    plus tard et que la valeur se rattache enfin, la signature change et
    l'import crée une seconde ligne. Le compte rendu l'annonce."""
    from app.services.fdi_signaux import signature_releve
    assert signature_releve({"secteurs": [{"brut": "Secteur Inconnu", "secteur_id": None}]}) \
        == ("s:~secteur inconnu",)


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
    source_seule = empreinte_signal(**commun, releve=("d:p119",))
    # La même ligne, après qu'un humain a ajouté le Kenya : le relevé n'a pas
    # bougé, donc l'empreinte non plus.
    apres_saisie = empreinte_signal(**commun, releve=("d:p119",))
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
                      10.0, None, ("d:r2", "s:30", "n:3")) == (
        "9e9d5b63c8bc205843002981970715783a5929c22aa4625f00cb10c5e23bfeeb")


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
                  source="United Kingdom", capex=None, releve=("d:r2", "s:30"))
    assert (cle_signal(2026, 9, funding=10.0, **commun)
            != cle_signal(2024, 1, funding=4.0, **commun))


def test_la_cle_est_insensible_au_marqueur_de_troncature():
    """Les exports écrivent « ... », le relevé manuel « … ». Une même ligne
    relevée des deux façons doit donner la même clé, sinon changer de mode de
    saisie doublerait tout le relevé."""
    from app.services.fdi_signaux import cle_signal
    commun = dict(annee=2026, mois=9, entreprise="Zeal Rewards",
                  source="United Kingdom", funding=10.0, capex=None)
    assert (cle_signal(parent="Radio-Canada (C...", **commun, releve=("d:r1",))
            == cle_signal(parent="Radio-Canada (C…", **commun, releve=("d:r1",)))
