"""Banc de mesure — la charge.

    python perf/charge.py routes   [--api URL] [--carte perf/pages.json]
    python perf/charge.py pages    [--api URL] [--site URL]
    python perf/charge.py paliers  --agents 10,25,50,100,200 --duree 60
    python perf/charge.py journee  --agents 1000,3000 --duree 120 --pause 20

Rejoue, contre une API et un site lancés comme en production, les appels
réels de chaque page, relevés par perf/cartographier.js :

- routes  : chaque adresse appelée seule, à froid puis à chaud ;
- pages   : chaque page ouverte par une seule personne (tous ses appels du
            premier écran partent ensemble, comme dans le navigateur) ;
- paliers : des agents qui ouvrent page sur page SANS PAUSE, palier par
            palier — la capacité et le point de rupture ;
- journee : des milliers d'agents qui lisent chaque page avant d'ouvrir la
            suivante (pause tirée au hasard autour de --pause secondes).

Mesures : durée de chaque requête et de chaque page (médiane, 95e et 99e
centiles), erreurs (5xx, délais dépassés, connexions refusées), débit, et,
chaque seconde, le processeur de l'API et de Postgres et les connexions
ouvertes sur la base. Résultats en JSON dans --sortie.
"""

import argparse
import asyncio
import json
import os
import random
import statistics
import sys
import time
from collections import defaultdict
from urllib.parse import urlsplit

import aiohttp

try:
    import psutil
except ImportError:  # la surveillance des processus est facultative
    psutil = None

try:
    import psycopg2
except ImportError:
    psycopg2 = None

R = random.Random(7)

# Le poids de chaque page dans la journée d'un agent : l'accueil, le tableau
# de bord, l'IDE et les prospects d'abord ; l'administration rarement
POIDS = {
    "/": 15, "/tableau-de-bord": 10, "/ide": 6, "/ide?section=projetes": 4, "/ide?section=projetes&vue=signaux": 2,
    "/ide?section=projetes&vue=entreprises": 2, "/prospects": 10, "/statistiques": 8, "/fiche-pays": 4,
    "/fiche-pays?pays=FRA": 4, "/entreprises": 6, "/opportunites": 5, "/accords": 5, "/evenements": 5, "/zones": 3,
    "/lexique": 2, "/code-investissements": 2, "/ide/rapport": 1, "/ide/rapport-signaux": 1,
}


def centiles(valeurs):
    if not valeurs:
        return {"n": 0}
    v = sorted(valeurs)
    pick = lambda q: v[min(len(v) - 1, int(q * len(v)))]  # noqa: E731
    return {"n": len(v), "p50": round(pick(.5), 1), "p95": round(pick(.95), 1), "p99": round(pick(.99), 1),
            "max": round(v[-1], 1), "moy": round(statistics.fmean(v), 1)}


class Mesures:
    def __init__(self):
        self.requetes = defaultdict(list)   # route → durées (ms)
        self.pages = defaultdict(list)      # page → durées (ms)
        self.erreurs = defaultdict(int)     # type → nombre
        self.erreurs_route = defaultdict(int)
        self.octets = 0
        self.nb = 0
        self.tentatives = 0

    def route(self, url):
        return urlsplit(url).path.replace("/api/v1", "", 1)


async def appel(session, url, m, delai, cle=None):
    cle = cle or m.route(url)
    debut = time.perf_counter()
    m.tentatives += 1
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=delai)) as r:
            corps = await r.read()
            ms = (time.perf_counter() - debut) * 1000
            m.nb += 1
            m.octets += len(corps)
            m.requetes[cle].append(ms)
            if r.status >= 500:
                m.erreurs[f"HTTP {r.status}"] += 1
                m.erreurs_route[cle] += 1
                return False
            return True
    except asyncio.TimeoutError:
        m.erreurs[f"délai > {delai} s"] += 1
        m.erreurs_route[cle] += 1
    except aiohttp.ClientError as e:
        m.erreurs[type(e).__name__] += 1
        m.erreurs_route[cle] += 1
    return False


async def ouvrir_page(session, api, site, page, appels, m, delai):
    """Une page : son HTML, puis tous ses appels du premier écran ensemble."""
    debut = time.perf_counter()
    await appel(session, site + page.split("?")[0], m, delai, cle="(HTML) " + page.split("?")[0])
    oks = await asyncio.gather(*(appel(session, api + a, m, delai) for a in appels))
    ms = (time.perf_counter() - debut) * 1000
    m.pages[page].append(ms)
    return all(oks)


# ── Surveillance du serveur ──────────────────────────────────────────────────

def processus():
    api, pg, site = [], [], []
    if not psutil:
        return api, pg, site
    for p in psutil.process_iter(["cmdline", "name"]):
        cmd = " ".join(p.info["cmdline"] or [])
        if "uvicorn" in cmd and "app.main:app" in cmd:
            # Le maître et ses processus de travail (lancés par multiprocessing)
            api.append(p)
            api.extend(p.children(recursive=True))
        elif (p.info["name"] or "").startswith("postgres"):
            pg.append(p)
        elif "server.js" in cmd:
            site.append(p)
    return api, pg, site


async def surveiller(stop, releves, dsn):
    api, pg, site = processus()
    for p in api + pg + site:
        try:
            p.cpu_percent(None)
        except Exception:
            pass
    cx = None
    if psycopg2 and dsn:
        try:
            cx = psycopg2.connect(dsn)
            cx.autocommit = True
        except Exception:
            cx = None
    while not stop.is_set():
        await asyncio.sleep(1)
        r = {"t": time.time()}
        for nom, groupe in (("cpu_api", api), ("cpu_pg", pg), ("cpu_site", site)):
            tot = 0.0
            for p in groupe:
                try:
                    tot += p.cpu_percent(None)
                except Exception:
                    pass
            r[nom] = round(tot, 1)
        if psutil:
            r["cpu_machine"] = psutil.cpu_percent(None)
        if cx:
            try:
                with cx.cursor() as c:
                    c.execute("SELECT state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY state")
                    r["pg_connexions"] = {(s or "autre"): n for s, n in c.fetchall()}
            except Exception:
                pass
        releves.append(r)
    if cx:
        cx.close()


def resume_releves(releves):
    if not releves:
        return {}
    out = {}
    for k in ("cpu_api", "cpu_pg", "cpu_site", "cpu_machine"):
        v = [r[k] for r in releves if k in r]
        if v:
            out[k] = {"moy": round(statistics.fmean(v), 1), "max": round(max(v), 1)}
    act = [r.get("pg_connexions", {}).get("active", 0) for r in releves]
    tot = [sum(r.get("pg_connexions", {}).values()) for r in releves]
    out["pg_actives"] = {"moy": round(statistics.fmean(act), 1), "max": max(act)}
    out["pg_ouvertes"] = {"moy": round(statistics.fmean(tot), 1), "max": max(tot)}
    return out


# ── Les modes ────────────────────────────────────────────────────────────────

async def mode_routes(a, carte):
    """Chaque adresse seule : un appel à froid, puis trois à chaud."""
    adresses = sorted({x for v in carte.values() for x in v["appels"]})
    # Une adresse par route et par jeu de paramètres hors pagination : les
    # 200 pages d'une liste se mesurent sur la première et la dernière
    retenues, vues = [], set()
    for x in adresses:
        cle = x.split("?")[0] + "?" + "&".join(sorted(p for p in (x.split("?")[1].split("&") if "?" in x else [])
                                                      if not p.startswith("page=")))
        if cle in vues:
            continue
        vues.add(cle)
        retenues.append(x)
    res = []
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit=4)) as s:
        for x in retenues:
            m = Mesures()
            await appel(s, a.api + x, m, a.delai, cle="x")
            froid = m.requetes["x"][-1] if m.requetes["x"] else None
            for _ in range(3):
                await appel(s, a.api + x, m, a.delai, cle="x")
            chaud = sorted(m.requetes["x"][1:])
            res.append({"adresse": x, "froid_ms": round(froid, 1) if froid else None,
                        "chaud_ms": round(chaud[len(chaud) // 2], 1) if chaud else None,
                        "octets": m.octets // max(1, m.nb), "erreurs": dict(m.erreurs)})
            print(f"  {res[-1]['chaud_ms'] or -1:>9.1f} ms  {res[-1]['octets']:>10,} o  {x[:110]}".replace(",", " "))
    res.sort(key=lambda r: -(r["chaud_ms"] or 1e9))
    return {"routes": res}


async def mode_pages(a, carte):
    """Chaque page, une seule personne : trois ouvertures, la médiane."""
    res = {}
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit=0)) as s:
        for page, v in carte.items():
            m = Mesures()
            for _ in range(3):
                await ouvrir_page(s, a.api, a.site, page, v["appels_premier_ecran"], m, a.delai)
            d = sorted(m.pages[page])
            res[page] = {"appels": len(v["appels_premier_ecran"]), "mediane_ms": round(d[1], 0),
                         "octets": m.octets // 3, "erreurs": dict(m.erreurs)}
            print(f"  {page:40s} {res[page]['appels']:4d} appels  {res[page]['mediane_ms']:>8.0f} ms  "
                  f"{res[page]['octets'] / 1e6:6.2f} Mo")
    return {"pages": res}


async def palier(a, carte, agents, duree, pause_moy):
    pages = [p for p in POIDS if p in carte and p not in a.sans.split(",")]
    poids = [POIDS[p] for p in pages]
    m = Mesures()
    stop = asyncio.Event()
    releves = []
    connecteur = aiohttp.TCPConnector(limit=a.connexions, limit_per_host=a.connexions)
    async with aiohttp.ClientSession(connector=connecteur) as s:
        fin = time.time() + duree
        pages_ok = [0]

        async def agent(k):
            # Les agents n'arrivent pas tous dans la même seconde
            await asyncio.sleep(R.uniform(0, min(duree / 4, pause_moy if pause_moy else 5)))
            while time.time() < fin:
                page = R.choices(pages, poids)[0]
                if await ouvrir_page(s, a.api, a.site, page, carte[page]["appels_premier_ecran"], m, a.delai):
                    pages_ok[0] += 1
                if pause_moy:
                    await asyncio.sleep(min(R.expovariate(1 / pause_moy), pause_moy * 4))

        surv = asyncio.create_task(surveiller(stop, releves, a.dsn))
        t0 = time.time()
        await asyncio.gather(*(agent(k) for k in range(agents)))
        ecoule = time.time() - t0
        stop.set()
        await surv
    toutes = [x for v in m.requetes.values() for x in v]
    pages_ms = [x for v in m.pages.values() for x in v]
    lentes = sorted(((r, centiles(v)) for r, v in m.requetes.items()), key=lambda x: -x[1].get("p95", 0))[:12]
    return {
        "agents": agents, "duree_s": round(ecoule, 1), "pause_moy_s": pause_moy,
        "requetes": m.nb, "requetes_par_s": round(m.nb / ecoule, 1), "pages": len(pages_ms),
        "pages_par_s": round(len(pages_ms) / ecoule, 2), "mo_servis": round(m.octets / 1e6, 1),
        "requete_ms": centiles(toutes), "page_ms": centiles(pages_ms),
        "par_page": {p: centiles(v) for p, v in m.pages.items()},
        "routes_les_plus_lentes": [{"route": r, **c} for r, c in lentes],
        "erreurs": dict(m.erreurs), "erreurs_par_route": dict(sorted(m.erreurs_route.items(), key=lambda x: -x[1])[:12]),
        "taux_erreur_pct": round(100 * sum(m.erreurs.values()) / max(1, m.tentatives), 2),
        "serveur": resume_releves(releves),
    }


def afficher_palier(r):
    rq, pg = r["requete_ms"], r["page_ms"]
    err = sum(r["erreurs"].values())
    print(f"  {r['agents']:>5} agents | {r['requetes_par_s']:>7} req/s | {r['pages_par_s']:>6} pages/s | "
          f"requête p50 {rq.get('p50', '-')} / p95 {rq.get('p95', '-')} ms | page p50 {pg.get('p50', '-')} / p95 {pg.get('p95', '-')} ms | "
          f"erreurs {err} ({r['taux_erreur_pct']} %) | CPU api {r['serveur'].get('cpu_api', {}).get('moy', '-')} % "
          f"pg {r['serveur'].get('cpu_pg', {}).get('moy', '-')} % | connexions pg max {r['serveur'].get('pg_ouvertes', {}).get('max', '-')}")
    if r["erreurs"]:
        print(f"           erreurs : {r['erreurs']}")


async def principal():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["routes", "pages", "paliers", "journee"])
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--site", default="http://127.0.0.1:3200")
    ap.add_argument("--carte", default="perf/pages.json")
    ap.add_argument("--agents", default="10,25,50,100,200")
    ap.add_argument("--duree", type=float, default=60)
    ap.add_argument("--pause", type=float, default=20, help="journee : pause moyenne entre deux pages (s)")
    ap.add_argument("--delai", type=float, default=60, help="au-delà, une requête compte comme abandonnée (s)")
    ap.add_argument("--connexions", type=int, default=1500, help="plafond de connexions simultanées du banc")
    ap.add_argument("--dsn", default="host=127.0.0.1 port=5600 dbname=apixbanc user=apix password=apix")
    ap.add_argument("--sans", default="", help="pages retirées du tirage, séparées par des virgules")
    ap.add_argument("--simuler-pagination", action="store_true",
                    help="ne garde que la première page des listes aspirées en entier : la plateforme une fois paginée côté serveur")
    ap.add_argument("--sortie", default=None)
    a = ap.parse_args()
    carte = json.load(open(a.carte, encoding="utf-8"))
    if a.simuler_pagination:
        import re
        suite = re.compile(r"[?&]page=(?:[2-9]|\d{2,})(?:&|$)")
        for v in carte.values():
            for k in ("appels_premier_ecran", "appels"):
                v[k] = [x for x in v[k] if not suite.search(x)]
    # Les adresses relevées commencent par /api/v1 : --api est la seule racine
    if a.mode == "routes":
        out = await mode_routes(a, carte)
    elif a.mode == "pages":
        out = await mode_pages(a, carte)
    else:
        out = {"paliers": []}
        for n in [int(x) for x in a.agents.split(",")]:
            r = await palier(a, carte, n, a.duree, a.pause if a.mode == "journee" else 0)
            out["paliers"].append(r)
            afficher_palier(r)
            await asyncio.sleep(5)  # le serveur souffle entre deux paliers
    if a.sortie:
        os.makedirs(os.path.dirname(a.sortie), exist_ok=True)
        json.dump(out, open(a.sortie, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"→ {a.sortie}")


if __name__ == "__main__":
    try:
        import uvloop
        uvloop.install()
    except ImportError:
        pass
    asyncio.run(principal())
