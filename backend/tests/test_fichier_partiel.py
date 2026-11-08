"""FichierPartiel : un fichier servi en entier, ou par morceaux (en-tête Range),
comme le demande la visionneuse de documents du site (pdf.js)."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.fichier_partiel import FichierPartiel


@pytest.fixture
def servi(tmp_path):
    chemin = tmp_path / "document.pdf"
    donnees = bytes(range(256)) * 40          # 10 240 octets, tous distincts par position modulo 256
    chemin.write_bytes(donnees)
    app = FastAPI()

    @app.get("/fichier")
    def fichier():
        return FichierPartiel(str(chemin), filename="document.pdf", media_type="application/pdf")

    return TestClient(app), donnees


def test_sans_plage_le_fichier_entier_et_l_annonce_des_plages(servi):
    client, donnees = servi
    r = client.get("/fichier")
    assert r.status_code == 200
    assert r.content == donnees
    assert r.headers["accept-ranges"] == "bytes"
    assert r.headers["content-length"] == str(len(donnees))
    assert "document.pdf" in r.headers["content-disposition"]


@pytest.mark.parametrize("plage, debut, fin", [
    ("bytes=100-199", 100, 199),        # une plage fermée
    ("bytes=10000-", 10000, 10239),     # jusqu'à la fin
    ("bytes=-50", 10190, 10239),        # les 50 derniers octets
    ("bytes=10200-99999", 10200, 10239),  # fin au-delà du fichier : ramenée
    ("bytes=0-0", 0, 0),                # un seul octet
])
def test_une_plage_206_la_plage_seule(servi, plage, debut, fin):
    client, donnees = servi
    r = client.get("/fichier", headers={"Range": plage})
    assert r.status_code == 206
    assert r.content == donnees[debut:fin + 1]
    assert r.headers["content-range"] == f"bytes {debut}-{fin}/{len(donnees)}"
    assert r.headers["content-length"] == str(fin - debut + 1)
    assert r.headers["content-type"] == "application/pdf"


def test_une_plage_hors_du_fichier_416(servi):
    client, donnees = servi
    r = client.get("/fichier", headers={"Range": "bytes=20000-20010"})
    assert r.status_code == 416
    assert r.headers["content-range"] == f"bytes */{len(donnees)}"


@pytest.mark.parametrize("plage", ["bytes=0-1,5-6", "octets=0-10", "bytes=-"])
def test_une_forme_non_servie_le_fichier_entier(servi, plage):
    client, donnees = servi
    r = client.get("/fichier", headers={"Range": plage})
    assert r.status_code == 200
    assert r.content == donnees
