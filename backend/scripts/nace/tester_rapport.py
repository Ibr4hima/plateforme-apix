"""Contrôle de bout en bout de GET /nace/rapport, sans base PostgreSQL.

    cd backend && POSTGRES_HOST=x POSTGRES_DB=x POSTGRES_USER=x \
        POSTGRES_PASSWORD=x python3 scripts/nace/tester_rapport.py

Monte le VRAI routeur sur une base SQLite en mémoire, ensemencée depuis les
CSV vérifiés du dépôt : ce qui est exercé est donc le code livré, et non une
réimplémentation qui ne prouverait rien. Utile pour valider l'endpoint avant
de disposer d'une base, ou après une modification de son agrégation.

Requiert aiosqlite en plus des dépendances du backend. Trois détournements
assumés, tous limités à ce harnais : l'URL du moteur (la propriété
DATABASE_URL est calculée vers asyncpg), les modules d'authentification (que
GET /nace/rapport n'utilise pas), et la création des seules tables utiles
(d'autres modèles portent des colonnes ARRAY que SQLite ne rend pas).

Le contrôle qui compte est le dernier : la somme des continents doit égaler
le total du commerce extérieur, les continents étant exhaustifs.
"""
import asyncio, csv, json, sys
from pathlib import Path

RACINE = Path("/home/user/plateforme-apix/backend")
sys.path.insert(0, str(RACINE))
CSV = RACINE / "scripts" / "nace"

import sqlalchemy as sa
import sqlalchemy.ext.asyncio as sae
from sqlalchemy.ext.asyncio import async_sessionmaker

# app.core.database construit son moteur dès l'import, et son URL est une
# propriété calculée (postgresql+asyncpg) : on détourne la fabrique le temps
# de l'import pour obtenir un moteur SQLite, sans toucher au code livré.
_vrai = sae.create_async_engine
sae.create_async_engine = lambda url, **kw: _vrai("sqlite+aiosqlite:///:memory:")
import app.core.database as dbmod                        # noqa: E402
sae.create_async_engine = _vrai
moteur = dbmod.engine
Session = async_sessionmaker(moteur, expire_on_commit=False)

# `cryptography` est cassé dans ce bac à sable, or app.core.auth l'importe via
# python-jose. GET /nace/rapport n'utilise pas l'authentification (seul
# POST /importer le fait), on neutralise donc la chaîne le temps de l'import.
import types                                             # noqa: E402
for nom in ("jose", "jose.jwt", "jose.exceptions", "passlib", "passlib.context", "bcrypt"):
    mod = types.ModuleType(nom)
    if nom == "jose":
        mod.JWTError = type("JWTError", (Exception,), {})
        mod.jwt = types.SimpleNamespace(encode=lambda *a, **k: "", decode=lambda *a, **k: {})
    if nom == "bcrypt":
        mod.hashpw = lambda p, s: p
        mod.gensalt = lambda *a, **k: b""
        mod.checkpw = lambda p, h: p == h
    if nom == "passlib.context":
        mod.CryptContext = lambda **k: types.SimpleNamespace(
            hash=lambda p: p, verify=lambda p, h: p == h)
    sys.modules.setdefault(nom, mod)

from app.models.shared import RefPays                    # noqa: E402
from app.models import nace as M                         # noqa: E402
import app.api.routes.nace as R                          # noqa: E402

FAMILLES = [("principaux_produits", M.NacePrincipalProduit, "produit"),
            ("produits_regroupes", M.NaceProduitRegroupe, "produit"),
            ("groupes_utilisation", M.NaceGroupeUtilisation, "groupe"),
            ("chapitres", M.NaceChapitre, "chapitre"),
            ("continents", M.NaceContinent, "continent"),
            ("regions", M.NaceRegion, "region")]


async def principal():
    # Seules les tables utiles : d'autres modèles portent des colonnes ARRAY
    # que SQLite ne sait pas rendre.
    tables = [RefPays.__table__] + [m.__table__ for _, m, _ in FAMILLES] + [M.NacePays.__table__]
    async with moteur.begin() as c:
        await c.run_sync(lambda cc: dbmod.Base.metadata.create_all(cc, tables=tables))

    # ref_pays : les cibles d'alias + une forme titre pour chaque libellé, ce
    # qui suffit à exercer le rapprochement sans la vraie base.
    doc = json.loads((CSV / "alias_pays_nace.json").read_text(encoding="utf-8"))
    alias, hors = doc["alias"], set(doc["hors_referentiel"])
    libs = set()
    for f in sorted(CSV.glob("edition_[0-9][0-9][0-9][0-9]_pays.csv")):
        for r in csv.DictReader(f.open(encoding="utf-8")):
            libs.add(r["pays"])
    noms = set(alias.values()) | {l.title() for l in libs
                                  if l not in hors and l not in alias and not l.startswith("NON VENTILE")}
    async with Session() as s:
        for i, nom in enumerate(sorted(noms), 1):
            s.add(RefPays(id=i, nom_fr=nom, code_iso2=None, actif=True))
        for famille, modele, col in FAMILLES:
            for f in sorted(CSV.glob(f"edition_[0-9][0-9][0-9][0-9]_{famille}.csv")):
                for r in csv.DictReader(f.open(encoding="utf-8")):
                    s.add(modele(**{col: r[col], "sens": r["sens"], "annee": int(r["annee"]),
                                    "valeur": r["valeur"] or None, "poids": r["poids"] or None,
                                    "edition": int(r["edition"])}))
        for f in sorted(CSV.glob("edition_[0-9][0-9][0-9][0-9]_pays.csv")):
            for r in csv.DictReader(f.open(encoding="utf-8")):
                s.add(M.NacePays(pays=r["pays"], region=r["region"], ref_pays_id=None,
                                 sens=r["sens"], annee=int(r["annee"]),
                                 valeur=r["valeur"] or None, poids=r["poids"] or None,
                                 edition=int(r["edition"])))
        await s.commit()
        # Rattachement, comme le fait POST /nace/importer
        index = await R._index_ref_pays(s)
        from app.utils.pays_matching import correspondre_pays
        rows = (await s.execute(sa.select(M.NacePays))).scalars().all()
        for r in rows:
            if r.pays in hors or r.pays.startswith("NON VENTILE"):
                continue
            r.ref_pays_id = correspondre_pays(alias.get(r.pays, r.pays), index)
        await s.commit()

        rap = await R.rapport(annee=None, db=s)
    return rap


rap = asyncio.run(principal())
print(f"disponible {rap['disponible']} · année {rap['annee']} · édition {rap['edition']}")
print(f"annees : {rap['annees']}")
t = rap["totaux"]
print(f"\nTOTAUX {rap['annee']} : export {t['export']:,.0f} · import {t['import']:,.0f} "
      f"· solde {t['solde']:,.0f} · couverture {t['couverture']:.1f} %".replace(",", " "))
print(f"série : {len(rap['serie'])} années")
print("\nPRODUITS")
for cle, p in rap["produits"].items():
    print(f"  {cle:11} symétrique={str(p['symetrique']):5} modalités {p['modalites']} "
          f"· 1er export : {p['export'][0]['nom'][:38]} ({p['export'][0]['part']:.1f} %)")
print("\nGÉO")
print(f"  continents : {[c['nom'] for c in rap['geo']['continents']]}")
print(f"  régions    : {len(rap['geo']['regions'])}")
print(f"  top pays export : {[(x['nom'], round(x['part'],1)) for x in rap['geo']['pays']['export'][:4]]}")
print("  par continent :")
for c in rap["geo"]["par_continent"]:
    cl = ", ".join(f"{x['nom']} {x['part']:.0f} %" for x in c["clients"][:3])
    fo = ", ".join(f"{x['nom']} {x['part']:.0f} %" for x in c["fournisseurs"][:3])
    print(f"    {c['continent']:10} clients : {cl}")
    print(f"    {'':10} fourniss.: {fo}")
# contrôles
som = sum(c["export"] for c in rap["geo"]["continents"])
print(f"\nCONTRÔLE Σ continents export = {som:,.0f} vs total {t['export']:,.0f} "
      f"→ écart {abs(som-t['export']):,.0f}".replace(",", " "))
