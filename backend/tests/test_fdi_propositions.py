"""Propositions de nom complet pour les libellés tronqués par fDi.

Aucun appel réel : le client de l'API est remplacé par un double qui rend la
réponse qu'on lui dicte. Ce qu'on vérifie, c'est ce que la plateforme FAIT de
la réponse — le garde-fou du préfixe surtout, qui ne dépend pas du modèle.
"""
import asyncio
import json
from types import SimpleNamespace

import pytest

from app.services import fdi_propositions as P


# ── Le garde-fou : le nom complet prolonge le texte affiché ──────────────────

@pytest.mark.parametrize("brut, nom, attendu", [
    ("Huawei Technologi…", "Huawei Technologies", "Huawei Technologies"),
    # La casse de la partie affichée est celle de fDi, et elle l'emporte.
    ("Huawei Technologi…", "Huawei technologies", "Huawei Technologies"),
    ("TotalEnergies (Tot…", "TotalEnergies (Total)", "TotalEnergies (Total)"),
    # Les trois points d'un export valent le caractère unique.
    ("Radio-Canada (C...", "Radio-Canada (CBC)", "Radio-Canada (CBC)"),
    # Un accent manquant ne fait pas un autre nom : la normalisation l'absorbe.
    ("Banque de dévelo…", "Banque de Developpement du Mali", "Banque de Developpement du Mali"),
    # Espaces superflus réduits.
    ("Standard Chartere…", "  Standard   Chartered Bank ", "Standard Chartered Bank"),
])
def test_proposition_retenue(brut, nom, attendu):
    assert P.valider(brut, nom) == attendu


@pytest.mark.parametrize("brut, nom", [
    ("Huawei Technologi…", "Huawai Technologies"),      # un autre début
    ("Huawei Technologi…", "Huawei Technologi"),        # rien de plus que l'affiché
    ("Huawei Technologi…", "Huawei Technologies…"),     # encore tronqué
    ("Huawei Technologi…", ""),
    ("Huawei Technologi…", None),
    ("Standard Chartere…", "Chartered Bank"),
])
def test_proposition_ecartee(brut, nom):
    assert P.valider(brut, nom) is None


def test_prefixe_sans_points_de_suspension():
    assert P.prefixe("Sales, Marketing & …") == "Sales, Marketing &"
    assert P.prefixe("Radio-Canada (C...") == "Radio-Canada (C"


def test_description_du_libelle():
    projets = [
        {"parent": "Vodafone Group", "annee": 2019, "origine": "United Kingdom",
         "destination": "Tanzania", "secteur": "Communications",
         "sous_secteur": "Wireless telecommunic…", "activite": "ICT & Internet Infras…"},
        {"parent": "Vodafone Group", "annee": 2021, "origine": "United Kingdom",
         "destination": "Tanzania", "secteur": "Communications",
         "sous_secteur": "Wireless telecommunic…", "activite": "Sales, Marketing & …"},
    ]
    texte = P.decrire(3, "Vodacom Tanzan…", projets, ["Vodacom Tanzania"])
    assert texte.startswith("3. « Vodacom Tanzan… » — 2 projets, 2019–2021")
    assert "Société mère : Vodafone Group" in texte
    assert "Destinations : Tanzania" in texte          # dédoublonné
    assert "Activités : ICT & Internet Infras…, Sales, Marketing & …" in texte
    assert "commencent ainsi : Vodacom Tanzania" in texte


# ── L'appel : un double du client ────────────────────────────────────────────

class _Messages:
    def __init__(self, reponses):
        self.reponses = reponses      # une fonction (requête) → réponse
        self.requetes = []

    async def create(self, **kw):
        self.requetes.append(kw)
        return self.reponses(kw)


def _reponse(propositions, stop="end_turn"):
    return SimpleNamespace(stop_reason=stop, content=[
        SimpleNamespace(type="text", text=json.dumps({"propositions": propositions}))])


def _libelles(*bruts):
    return [{"brut": b, "projets": [{"annee": 2020, "destination": "Senegal"}], "connus": []}
            for b in bruts]


@pytest.fixture
def client(monkeypatch):
    double = SimpleNamespace(messages=None)
    monkeypatch.setattr(P, "_client", lambda: double)
    monkeypatch.setattr(P, "actif", lambda: True)
    return double


def test_reponse_lue_et_filtree(client):
    client.messages = _Messages(lambda kw: _reponse([
        {"numero": 1, "nom": "Huawei Technologies", "confiance": "haute", "indice": ""},
        # Ne prolonge pas l'affiché : écartée, mais gardée — nom vide.
        {"numero": 2, "nom": "Chartered Bank", "confiance": "haute", "indice": "?"},
        {"numero": 1, "nom": "Huawei Tech Co", "confiance": "basse", "indice": ""},  # doublon
        {"numero": 9, "nom": "Hors liste", "confiance": "haute", "indice": ""},      # inconnu
    ]))
    sortie = asyncio.run(P.proposer(_libelles("Huawei Technologi…", "Standard Chartere…")))
    assert sortie["Huawei Technologi…"] == {"nom": "Huawei Technologies", "confiance": "haute",
                                           "indice": None}
    assert sortie["Standard Chartere…"] == {"nom": None, "confiance": "basse", "indice": None}
    assert len(sortie) == 2

    (req,) = client.messages.requetes
    # Une sortie structurée, un prompt système stable et mis en cache.
    assert req["output_config"]["format"]["type"] == "json_schema"
    assert req["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert "1. « Huawei Technologi… »" in req["messages"][0]["content"]
    assert "2. « Standard Chartere… »" in req["messages"][0]["content"]


def test_paquets_paralleles(client):
    def repondre(kw):
        n = kw["messages"][0]["content"].count("\n\n") + 1
        return _reponse([{"numero": i, "nom": "", "confiance": "basse", "indice": ""}
                         for i in range(1, n + 1)])
    client.messages = _Messages(repondre)
    bruts = [f"Entreprise {i:02d} lon…" for i in range(23)]
    sortie = asyncio.run(P.proposer(_libelles(*bruts)))
    assert [r["messages"][0]["content"].count("«") for r in client.messages.requetes] == [10, 10, 3]
    assert set(sortie) == set(bruts)


def test_echec_partiel_puis_total(client):
    def repondre(kw):
        if "Entreprise 00" in kw["messages"][0]["content"]:
            raise RuntimeError("réseau")
        return _reponse([{"numero": 1, "nom": "Entreprise 10 longue", "confiance": "moyenne",
                          "indice": "x"}])
    client.messages = _Messages(repondre)
    bruts = [f"Entreprise {i:02d} lon…" for i in range(11)]
    # Le premier paquet échoue, le second répond : on rend ce qu'on a.
    sortie = asyncio.run(P.proposer(_libelles(*bruts)))
    assert sortie == {"Entreprise 10 lon…": {"nom": "Entreprise 10 longue",
                                             "confiance": "moyenne", "indice": "x"}}
    # Tout échoue : on le dit.
    with pytest.raises(P.PropositionsIndisponibles):
        asyncio.run(P.proposer(_libelles("Entreprise 00 lon…")))


def test_reponse_interrompue(client):
    client.messages = _Messages(lambda kw: _reponse([], stop="max_tokens"))
    with pytest.raises(P.PropositionsIndisponibles, match="interrompue"):
        asyncio.run(P.proposer(_libelles("Huawei Technologi…")))


def test_sans_cle_aucun_appel(monkeypatch):
    monkeypatch.setattr(P, "actif", lambda: False)
    monkeypatch.setattr(P, "_client", lambda: pytest.fail("aucun client ne doit être créé"))
    with pytest.raises(P.PropositionsIndisponibles, match="clé API"):
        asyncio.run(P.proposer(_libelles("Huawei Technologi…")))
