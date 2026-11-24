"""Lire la fiche d'un signal : l'appel à l'API, et le rattachement des
destinations lues. Aucune base ni aucun appel réel."""
import asyncio
import json
from types import SimpleNamespace

import pytest

from app.services import fdi_captures as C
from app.services import fdi_fiches as F

REF = {
    "pays": {"SEN": 100, "KEN": 103, "TUR": 102, "CIV": 105},
    "regions": [{"id": 3, "code": "middle_east", "libelle_en": "Middle East"},
                {"id": 4, "code": "africa", "libelle_en": "Africa"}],
}
CORR = {"senegal": "SEN", "kenya": "KEN", "turkey": "TUR", "ivory coast": "CIV",
        "cote d ivoire": "CIV"}
AFRIQUE = {"pays": {100, 103, 105}, "regions": {4}}


def test_rattacher():
    noms = ["Senegal", "Kenya", "Middle East", "West Africa", "senegal", "Ivory Coast",
            "Côte d'Ivoire", "Turkey", "  "]
    lues, inconnues = F.rattacher(noms, REF, CORR, deja={("pays", 103)}, afrique=AFRIQUE)
    assert [(d["nature"], d["pays_id"] or d["region_id"]) for d in lues] == [
        ("pays", 100), ("pays", 103), ("region", 3), ("pays", 105), ("pays", 102)]
    sen, ken, mo, civ, tur = lues
    assert sen["afrique"] and not sen["deja"]
    assert ken["deja"]                                 # le signal la porte déjà
    assert not mo["afrique"] and mo["region_id"] == 3
    assert civ["brut"] == "Ivory Coast"                # deux graphies, un seul pays
    assert not tur["afrique"]
    assert inconnues == ["West Africa"]                # à ajouter à la main


class _Messages:
    def __init__(self, reponse):
        self.reponse, self.requetes = reponse, []

    async def create(self, **kw):
        self.requetes.append(kw)
        return self.reponse


def _double(monkeypatch, rendu):
    messages = _Messages(SimpleNamespace(stop_reason="end_turn", content=[
        SimpleNamespace(type="text", text=json.dumps(rendu))]))
    monkeypatch.setattr(F, "_client", lambda: SimpleNamespace(messages=messages))
    monkeypatch.setattr(F, "actif", lambda: True)
    return messages


def test_lecture_texte(monkeypatch):
    messages = _double(monkeypatch, {
        "description_en": "Zeal Rewards has raised  $10m.\r\n\r\nIt will expand  to Senegal.",
        "description_fr": "Zeal Rewards a levé 10 M$.",
        "destinations": [" Senegal ", "", "Middle East"],
        "remarque": ""})
    lu = asyncio.run(F.lire_fiche(contexte="« Zeal Rewards », pays d'origine : Turkey.",
                                  regions=["Middle East", "Africa"], texte="la fiche…\r\n\r\nsuite"))
    # Espaces réduits, paragraphes gardés ; destinations nettoyées.
    assert lu["description_en"] == "Zeal Rewards has raised $10m.\n\nIt will expand to Senegal."
    assert lu["destinations"] == ["Senegal", "Middle East"]
    assert lu["remarque"] is None
    (req,) = messages.requetes
    assert req["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert req["output_config"]["format"]["schema"] == F.SCHEMA
    (contenu,) = req["messages"][0]["content"]
    assert contenu["type"] == "text"
    assert "Zeal Rewards" in contenu["text"] and "Middle East, Africa" in contenu["text"]
    # Les sauts de ligne d'un formulaire (CRLF) redeviennent des paragraphes.
    assert contenu["text"].endswith("la fiche…\n\nsuite")


def test_lecture_capture(monkeypatch):
    messages = _double(monkeypatch, {"description_en": "", "description_fr": "",
                                     "destinations": [], "remarque": "Fiche d'une autre entreprise."})
    lu = asyncio.run(F.lire_fiche(contexte="« X ».", regions=["Africa"],
                                  image=b"\x89PNG...", media="image/png"))
    assert lu["remarque"] == "Fiche d'une autre entreprise."
    image, consigne = messages.requetes[0]["messages"][0]["content"]
    assert image["type"] == "image" and image["source"]["media_type"] == "image/png"
    assert consigne["type"] == "text"


def test_lecture_sans_cle(monkeypatch):
    monkeypatch.setattr(F, "actif", lambda: False)
    with pytest.raises(C.LectureImpossible, match="clé API"):
        asyncio.run(F.lire_fiche(contexte="", regions=[], texte="x"))
