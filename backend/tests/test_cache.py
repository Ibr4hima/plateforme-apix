"""Le cache des réponses publiques (app/core/cache.py), sans base de données :
la « base » est simulée et ne sert que les compteurs d'écritures."""
import asyncio
import json

from fastapi import Depends, FastAPI, Query
from fastapi.testclient import TestClient

from app.core import cache
from app.core.cache import en_cache


class _Resultat:
    def __init__(self, lignes):
        self._lignes = lignes

    def all(self):
        return self._lignes


class _BaseSimulee:
    """Répond aux lectures des compteurs : une ligne par table, ses compteurs."""
    def __init__(self):
        self.ecritures = 0
        self.lectures = 0

    async def execute(self, *_args, **_kwargs):
        self.lectures += 1
        return _Resultat([("stat_transactions", self.ecritures, 0, 0, 100)])


base = _BaseSimulee()
calculs = {"n": 0}


async def _db():
    yield base


app = FastAPI()


@app.get("/filtres")
@en_cache("statistiques")
async def filtres(annee: int | None = Query(None), db=Depends(_db)):
    calculs["n"] += 1
    await asyncio.sleep(0.05)   # un calcul qui prend du temps
    return {"annee": annee, "calcul": calculs["n"], "pays": ["Sénégal", "Mali"]}


def _remise_a_zero():
    cache.invalider()
    calculs["n"] = 0
    base.ecritures = 0


def test_la_reponse_est_celle_de_fastapi_et_servie_du_cache():
    _remise_a_zero()
    with TestClient(app) as client:
        r1 = client.get("/filtres?annee=2024")
        r2 = client.get("/filtres?annee=2024")
    assert r1.status_code == r2.status_code == 200
    assert r1.headers["content-type"] == "application/json"
    # Mise en forme identique à celle de FastAPI (UTF-8, sans espaces)
    assert r1.content == json.dumps({"annee": 2024, "calcul": 1, "pays": ["Sénégal", "Mali"]},
                                    ensure_ascii=False, separators=(",", ":")).encode()
    assert r2.content == r1.content
    assert calculs["n"] == 1


def test_chaque_adresse_a_sa_reponse():
    _remise_a_zero()
    with TestClient(app) as client:
        a = client.get("/filtres?annee=2023").json()
        b = client.get("/filtres?annee=2024").json()
    assert (a["annee"], b["annee"]) == (2023, 2024)
    assert calculs["n"] == 2


def test_une_ecriture_fait_recalculer(monkeypatch):
    _remise_a_zero()
    monkeypatch.setattr(cache, "VERSION_VALIDE_S", 0)   # compteurs relus à chaque appel
    with TestClient(app) as client:
        client.get("/filtres")
        base.ecritures += 1
        r = client.get("/filtres").json()
        client.get("/filtres")
    assert r["calcul"] == 2
    assert calculs["n"] == 2


def test_l_administration_lit_sans_cache():
    _remise_a_zero()
    with TestClient(app) as client:
        client.get("/filtres")
        r = client.get("/filtres", headers={"Cache-Control": "no-cache"}).json()
        apres = client.get("/filtres").json()
    assert r["calcul"] == 2
    assert apres["calcul"] == 2   # la lecture fraîche a rafraîchi le cache pour tous


def test_un_seul_calcul_pour_des_requetes_simultanees():
    _remise_a_zero()

    class _Requete:
        class url:
            path, query = "/filtres", ""
        headers = {}

    async def scenario():
        async def calcul():
            calculs["n"] += 1
            await asyncio.sleep(0.05)
            return {"ok": True}
        return await asyncio.gather(*[cache.reponse_en_cache("statistiques", _Requete, base, calcul) for _ in range(20)])

    reponses = asyncio.run(scenario())
    assert calculs["n"] == 1
    assert {r.body for r in reponses} == {b'{"ok":true}'}


def test_la_signature_garde_les_parametres_de_la_route():
    import inspect
    noms = list(inspect.signature(filtres).parameters)
    assert noms == ["annee", "db", "_requete_cache"]
