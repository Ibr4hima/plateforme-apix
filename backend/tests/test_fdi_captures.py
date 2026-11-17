"""Verser une capture : la lecture, et le verdict sur chaque ligne lue.

Aucune base ni aucun appel réel : l'analyse est une fonction pure qui reçoit
la nomenclature et les lignes déjà relevées, et le client de l'API est
remplacé par un double.
"""
import asyncio
import json
from datetime import date
from types import SimpleNamespace

import pytest

from app.services import fdi_captures as C

REF = {
    "secteurs": [{"id": 1, "code": "communications", "libelle_en": "Communications"},
                 {"id": 2, "code": "textiles", "libelle_en": "Textiles"}],
    "sous": [{"id": 10, "code": "communications__wired", "secteur_id": 1,
              "libelle_en": "Wired telecommunication carriers"},
             {"id": 20, "code": "textiles__clothing", "secteur_id": 2,
              "libelle_en": "Clothing & clothing accessories"}],
    "activites": [{"id": 5, "code": "manufacturing", "libelle_en": "Manufacturing"},
                  {"id": 6, "code": "ict", "libelle_en": "ICT & Internet Infrastructure"}],
    "types": [{"id": 1, "code": "new", "libelle_en": "New"},
              {"id": 2, "code": "expansion", "libelle_en": "Expansion"}],
    "pays": {"SEN": 100, "MDG": 101, "TUR": 102, "KEN": 103, "CHE": 104},
}
CORR = {"senegal": "SEN", "madagascar": "MDG", "turkey": "TUR", "kenya": "KEN",
        "switzerland": "CHE"}


def cases(**kw):
    base = {"date": "Oct 2026", "parent": "Axian", "entreprise": "Yas", "source": "Madagascar",
            "dest": "Kenya", "secteur": "Communications", "sous_secteur": "Wired telecommunic…",
            "activite": "ICT & Internet Infras…", "capex": "* $122.20m", "emplois": "* 100",
            "type": "Expansion"}
    return {**base, **kw}


def connue(i, **kw):
    """Une ligne déjà en base, telle que la renvoie la requête de l'analyse."""
    base = {"id": i, "lot": "Afrique reçoit · page 0001", "ligne": i, "annee": 2026, "mois": 10,
            "parent_brut": "Axian", "entreprise_brut": "Yas", "pays_source_brut": "Madagascar",
            "pays_dest_brut": "Kenya", "secteur_brut": "Communications",
            "sous_secteur_brut": "Wired telecommunic…", "activite_brut": "ICT & Internet Infras…",
            "type_brut": "Expansion", "capex_musd": 122.2, "emplois": 100}
    return {**base, **kw}


def analyser(lignes, connues=()):
    return C.analyser_lignes("projets", [{"rang": i, "cases": c} for i, c in enumerate(lignes, 1)],
                             list(connues), REF, CORR)


# ── La comparaison tolère les coupes ─────────────────────────────────────────

@pytest.mark.parametrize("a, b, attendu", [
    ("Huawei Technologies", "huawei technologies", True),
    ("Huawei Technologi…", "Huawei Technologies", True),     # coupé / entier
    ("Huawei Technolog…", "Huawei Technologi…", True),       # deux coupes
    ("Huawei Technologi...", "Huawei Technologi…", True),    # trois points / caractère
    ("Huawei Technologi…", "Huawei Marine", False),
    ("Huawei", "Huawei Technologies", False),                # entier ≠ plus long
    ("-", "", True),
])
def test_compatibles(a, b, attendu):
    assert C.compatibles(a, b) is attendu
    assert C.compatibles(b, a) is attendu


# ── Le verdict ───────────────────────────────────────────────────────────────

def test_deja_relevee_malgre_une_autre_coupe():
    # Fenêtre plus étroite : « Wired telecommun… » au lieu de « Wired telecommunic… ».
    a = analyser([cases(sous_secteur="Wired telecommun…")], [connue(1)])
    (l,) = a["lignes"]
    assert l["statut"] == "deja" and l["inclure"] is False
    assert l["trouvee"] == {"id": 1, "lot": "Afrique reçoit · page 0001", "ligne": 1}
    assert any("déjà relevées" in x for x in a["alertes"])


def test_jumelles_une_seule_en_base():
    # fDi publie des lignes identiques ; une seule est connue, la seconde est nouvelle.
    a = analyser([cases(), cases()], [connue(1)])
    assert [l["statut"] for l in a["lignes"]] == ["deja", "nouvelle"]


def test_ressemble_une_case_d_ecart():
    a = analyser([cases(capex="* $142.20m")], [connue(1)])
    (l,) = a["lignes"]
    assert l["statut"] == "ressemble" and l["inclure"] is False
    assert [e["colonne"] for e in l["ecarts"]] == ["capex"]
    assert "142.20" in l["ecarts"][0]["message"] and "122,20 M$" in l["ecarts"][0]["message"]


def test_autre_destination_nouvelle():
    # Même entreprise, même mois, autre pays : un autre projet, pas une lecture fautive.
    a = analyser([cases(dest="Senegal")], [connue(1)])
    (l,) = a["lignes"]
    assert l["statut"] == "nouvelle" and l["senegal"] is True and l["inclure"] is True
    assert a["compte"]["senegal"] == 1


def test_case_illisible_bloque():
    a = analyser([cases(capex="?"), cases(date="Octobre")])
    assert [l["statut"] for l in a["lignes"]] == ["illisible", "illisible"]
    assert a["lignes"][0]["problemes"] == [
        {"colonne": "capex", "bloquant": True, "message": "Montant illisible sur la capture."}]
    assert a["lignes"][1]["problemes"][0]["colonne"] == "date"
    assert not any(l["inclure"] for l in a["lignes"])


def test_nomenclature_inconnue_avertit_sans_bloquer():
    a = analyser([cases(sous_secteur="Wired telecomunic…", dest="Kenia")])
    (l,) = a["lignes"]
    assert l["statut"] == "nouvelle" and l["inclure"] is True
    assert {p["colonne"] for p in l["problemes"]} == {"sous_secteur", "dest"}
    assert not any(p["bloquant"] for p in l["problemes"])


def test_alertes_de_page():
    a = analyser([cases(date="Oct 2026"), cases(date="Nov 2026", entreprise="Autre"),
                  cases(date="Sep 2026", entreprise="Tardive")],
                 [connue(1)])
    textes = " ".join(a["alertes"])
    assert "3 lignes au lieu de 15" in textes
    assert "Rang 2 : « Nov 2026 » après « Oct 2026 »" in textes
    # Le rang 1 est connu ; les rangs 2 et 3, nouveaux sous lui, sont signalés.
    assert "Rangs 2, 3 : nouveau sous une ligne déjà relevée (rang 1)" in textes
    assert a["compte"] == {"nouvelle": 2, "deja": 1, "ressemble": 0, "illisible": 0, "senegal": 0}


def test_signal_reconnu_par_son_empreinte():
    ref = {**REF, "natures": [{"id": 7, "code": "new_funding",
                               "libelle_en": "New Funding / Resources for Expansion"}],
           "regions": [{"id": 3, "code": "middle_east", "libelle_en": "Middle East"}]}
    c = {"date": "Sep 2026", "parent": "Zeal Rewards", "entreprise": "Zeal Rewards",
         "source": "Turkey", "destination": "Middle East", "secteur": "Textiles",
         "activite": "n/a", "signal": "New Funding/Resour…", "funding": "$10.00m", "capex": "-"}
    valeurs, _ = C._lire_valeurs("signaux", c)
    listes, problemes = C._listes_signal(c, ref, CORR)
    assert problemes == []
    assert listes["destinations"][0]["region_id"] == 3 and listes["natures"][0]["nature_id"] == 7
    cle = C.cle_signal(c, valeurs, listes)
    a = C.analyser_lignes("signaux", [{"rang": 1, "cases": c}], [], ref, CORR,
                          identites={cle: {"id": 9, "lot": "Signaux Afrique · page 001", "ligne": 4}})
    assert a["lignes"][0]["statut"] == "deja"
    assert a["lignes"][0]["trouvee"] == {"id": 9, "lot": "Signaux Afrique · page 001", "ligne": 4}


def test_libelles_des_lots():
    assert C.libelles("projets", date(2026, 11, 17), 3) == [
        "Afrique reçoit · capture du 17/11/2026 · page 03",
        "Sénégal reçoit · capture Afrique du 17/11/2026 · page 03"]
    assert C.libelles("signaux", date(2026, 11, 17), 12) == [
        "Signaux Afrique · capture du 17/11/2026 · page 12"]


# ── La lecture : un double du client ─────────────────────────────────────────

class _Messages:
    def __init__(self, reponse):
        self.reponse, self.requetes = reponse, []

    async def create(self, **kw):
        self.requetes.append(kw)
        return self.reponse


def test_lecture(monkeypatch):
    rendu = {"lignes": [{**cases(), "parent": "  SYGMA   Engineerin… "}],
             "page_affichee": 0, "remarque": ""}
    messages = _Messages(SimpleNamespace(stop_reason="end_turn", content=[
        SimpleNamespace(type="text", text=json.dumps(rendu))]))
    monkeypatch.setattr(C, "_client", lambda: SimpleNamespace(messages=messages))
    monkeypatch.setattr(C, "actif", lambda: True)
    lu = asyncio.run(C.lire(b"\x89PNG...", "image/png", "projets"))
    assert lu["lignes"][0]["parent"] == "SYGMA Engineerin…"     # espaces réduits
    assert lu["page_affichee"] is None and lu["remarque"] is None

    (req,) = messages.requetes
    image, consigne = req["messages"][0]["content"]
    assert image["type"] == "image" and image["source"]["media_type"] == "image/png"
    assert consigne["type"] == "text" and "11. type" in consigne["text"]
    schema = req["output_config"]["format"]["schema"]
    assert schema["properties"]["lignes"]["items"]["required"] == C.COLONNES["projets"]


def test_lecture_sans_cle(monkeypatch):
    monkeypatch.setattr(C, "actif", lambda: False)
    with pytest.raises(C.LectureImpossible, match="clé API"):
        asyncio.run(C.lire(b"x", "image/png", "projets"))


# ── Les noms complétés à l'écran ─────────────────────────────────────────────

def test_completion_par_texte():
    lignes = [{"rang": 7, "cases": {"parent": "Cassa depositi e p…", "entreprise": "Cassa depositi e p…"},
               "noms": {"parent": "Cassa depositi e prestiti", "entreprise": "Cassa depositi e prestiti",
                        "source": "Italie", "dest": ""}},
              {"rang": 9, "cases": {"entreprise": "Aya Gold & Silver (…"},
               "noms": {"entreprise": "Aya Gold & Silver"}}]
    # La décision porte sur le texte coupé ; les autres colonnes et les
    # complétions vides sont ignorées.
    assert C.noms_completes(lignes) == {"Cassa depositi e p…": "Cassa depositi e prestiti",
                                        "Aya Gold & Silver (…": "Aya Gold & Silver"}


@pytest.mark.parametrize("brut, nom, attendu", [
    ("Huawei Technologi…", "Huawei Technologies", "Huawei Technologies"),     # prolonge
    ("Aya Gold & Silver (…", "Aya Gold & Silver", "Aya Gold & Silver"),       # raccourcit
    ("Aya Gold & Silver …", "Aya Gold & Silver", "Aya Gold & Silver"),        # égale
    ("China Railway Sig…", "China Rail Signal", None),                        # autre début
    ("China Railway Sig…", "China Railway Sig…", None),                       # encore coupé
    ("China Railway Sig…", "C", None),                                        # trop court
])
def test_nom_accepte(brut, nom, attendu):
    assert C.accepter_nom(brut, nom) == attendu


@pytest.mark.parametrize("cases, noms, motif", [
    ({"entreprise": "Givaudan"}, {"entreprise": "Givaudan SA"}, "n'est pas tronqué"),
    ({"entreprise": "China Railway Sig…"}, {"entreprise": "China Rail Signal"}, "ne correspond pas"),
])
def test_completion_refusee(cases, noms, motif):
    with pytest.raises(C.CaptureRefusee, match=motif):
        C.noms_completes([{"rang": 1, "cases": cases, "noms": noms}])


def test_deux_noms_pour_un_texte():
    with pytest.raises(C.CaptureRefusee, match="deux noms"):
        C.noms_completes([
            {"rang": 1, "cases": {"entreprise": "Standard Chartere…"}, "noms": {"entreprise": "Standard Chartered Bank"}},
            {"rang": 2, "cases": {"entreprise": "Standard Chartere…"}, "noms": {"entreprise": "Standard Chartered Kenya"}},
        ])


# ── Signaux : la destination africaine cachée ────────────────────────────────

REF_SIGNAUX = {**REF, "natures": [{"id": 7, "code": "new_funding",
                                   "libelle_en": "New Funding / Resources for Expansion"}],
               "regions": [{"id": 3, "code": "middle_east", "libelle_en": "Middle East"},
                           {"id": 4, "code": "africa", "libelle_en": "Africa"}]}
AFRIQUE = {"pays": {100, 103}, "regions": {4}}       # Sénégal, Kenya, région « Africa »


def signal(destination):
    return {"date": "Nov 2026", "parent": "Banc Ride", "entreprise": "Banc Ride", "source": "Turkey",
            "destination": destination, "secteur": "Textiles", "activite": "n/a",
            "signal": "New Funding/Resour…", "funding": "$10.00m", "capex": "-"}


@pytest.mark.parametrize("destination, attendu", [
    ("Middle East", False),      # l'africaine est cachée derrière le bouton
    ("Kenya", True),
    ("Senegal", True),
    ("Africa", True),            # la région « Africa » de fDi vaut l'Afrique
    ("Switzerland", False),
    ("n/a", False),
])
def test_destination_africaine_visible(destination, attendu):
    a = C.analyser_lignes("signaux", [{"rang": 1, "cases": signal(destination)}], [], REF_SIGNAUX,
                          CORR, afrique=AFRIQUE)
    assert a["lignes"][0]["destination_afrique"] is attendu


def test_projets_sans_drapeau_de_destination():
    assert analyser([cases()])["lignes"][0]["destination_afrique"] is None


def test_destinations_ajoutees():
    lignes = [{"rang": 2, "destinations": [{"pays_id": 100}, {"region_id": 4}, {"pays_id": 100}]},
              {"rang": 3, "destinations": []}]
    assert C.destinations_ajoutees(lignes) == {
        2: [{"pays_id": 100, "region_id": None}, {"pays_id": None, "region_id": 4}]}
    for faute in ({}, {"pays_id": 1, "region_id": 2}):
        with pytest.raises(C.CaptureRefusee, match="pays OU une région"):
            C.destinations_ajoutees([{"rang": 1, "destinations": [faute]}])


@pytest.mark.parametrize("ligne, capture, nom, attendu", [
    ("Aya Gold & Silver …", "Aya Gold & Silver (…", "Aya Gold & Silver", True),     # même texte
    ("ATOMIC (ATOMIC …", "ATOMIC (ATOMIC Li…", "ATOMIC", True),                     # autre largeur
    ("ATOMIC (ATOMIC Limited)", "ATOMIC (ATOMIC Li…", "ATOMIC", False),             # nom complet : déjà tranché
    ("ATOMIC…", "ATOMIC (ATOMIC Li…", "ATOMIC", False),                             # coupé bien plus tôt
    ("Standard Chartere…", "Standard Chartered Ke…", "Standard Chartered Kenya", False),  # autre texte
    ("Huawei Technolog…", "Huawei Technologi…", "Huawei Technologies", True),
    ("Standard Chartered Ke…", "Standard Chartere…", "Standard Chartered Bank", False),  # ligne plus précise
])
def test_meme_texte(ligne, capture, nom, attendu):
    assert C.meme_texte(ligne, capture, nom) is attendu
