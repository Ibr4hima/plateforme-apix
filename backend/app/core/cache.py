"""
Les réponses coûteuses qui ne changent qu'avec les imports, gardées en mémoire.

Certaines routes publiques recalculaient à chaque appel un résultat qui ne
bouge qu'aux imports : les filtres de la page Statistiques parcouraient les
2 millions de flux commerciaux (0,8 s, près d'un tiers du temps serveur du
banc), les agrégats du relevé fDi, les zones et leurs entreprises (4,7 Mo)…
Elles sont désormais calculées une fois, puis servies de la mémoire du
processus, prêtes à envoyer, tant que les tables dont elles dépendent n'ont
pas changé.

LE SIGNAL DE CHANGEMENT : les compteurs d'écritures que Postgres tient pour
chaque table (lignes insérées, modifiées, supprimées, vivantes), lus en une
requête de quelques dixièmes de milliseconde. Tous les processus de l'API les
voient, quel que soit celui qui a écrit, et rien n'est à ajouter aux imports :
un import, d'où qu'il vienne, fait bouger les compteurs. Postgres les publie
juste après la validation, parfois avec quelques secondes de retard (au plus
une dizaine, davantage sous très forte charge) : c'est le délai maximal de
fraîcheur d'une réponse publique après un import. L'administration, qui doit
voir aussitôt ce qu'elle vient d'enregistrer, demande sans cache
(en-tête `Cache-Control: no-cache`). Un âge maximal de dix minutes borne
aussi ce que les compteurs ne verraient pas.

N'utiliser que sur des routes publiques sans `response_model` : la réponse
est mise en forme ici comme FastAPI l'aurait fait (jsonable_encoder puis
JSONResponse), et le contrôle d'accès éventuel s'exécute avant, dans les
dépendances de la route.
"""
from __future__ import annotations

import asyncio
import functools
import inspect
import logging
import time
from collections import OrderedDict
from datetime import date
from typing import Any, Awaitable, Callable

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger("apix.cache")

# Les familles de données, par les tables dont elles dépendent (motifs LIKE)
GROUPES: dict[str, tuple[str, ...]] = {
    "statistiques": ("stat\\_%", "ref\\_pays", "ref\\_pays\\_groupements", "ref\\_groupements"),
    "fdi": ("fdi\\_%", "ref\\_pays", "ref\\_pays\\_groupements", "ref\\_groupements", "zones"),
    "nace": ("nace\\_%", "ref\\_pays", "ref\\_pays\\_groupements", "ref\\_groupements"),
    "zones": ("zones", "zone\\_%", "entreprises\\_installees", "ref\\_regions", "ref\\_departements",
              "ref\\_arrondissements", "poles\\_territoires", "ref\\_secteurs", "ref\\_branches", "ref\\_activites"),
    "ide": ("ide\\_%", "ref\\_pays", "ref\\_pays\\_groupements", "ref\\_groupements"),
    # Référentiels communs (NAEMA, géographie, pays, pôles) — et les formes
    # juridiques, tirées des entreprises
    "referentiels": ("ref\\_%", "poles\\_territoires", "pole\\_fichiers", "entreprises\\_installees"),
    "evenements": ("evenements", "evenement\\_%", "ref\\_pays"),
}

AGE_MAX_S = 600          # au-delà, une réponse est recalculée quoi qu'il arrive
VERSION_VALIDE_S = 1.0   # les compteurs d'une famille sont relus au plus une fois par seconde
ENTREES_MAX = 1000       # par processus (jusqu'à 8 processus, cf. demarrer.sh)
OCTETS_MAX = 64 * 1024 * 1024

_SQL_VERSION = text("""
    SELECT c.relname, pg_stat_get_tuples_inserted(c.oid), pg_stat_get_tuples_updated(c.oid),
           pg_stat_get_tuples_deleted(c.oid), pg_stat_get_live_tuples(c.oid)
      FROM pg_class c
     WHERE c.relkind IN ('r', 'p') AND pg_table_is_visible(c.oid) AND c.relname LIKE ANY(:motifs)
     ORDER BY c.relname""")


class _Entree:
    __slots__ = ("version", "corps", "quand")

    def __init__(self, version: tuple, corps: bytes):
        self.version, self.corps, self.quand = version, corps, time.monotonic()


_entrees: "OrderedDict[str, _Entree]" = OrderedDict()
_octets = 0
_versions: dict[str, tuple[tuple, float]] = {}
_verrous: dict[str, asyncio.Lock] = {}


async def _version(groupe: str, db: AsyncSession) -> tuple:
    connue = _versions.get(groupe)
    if connue and time.monotonic() - connue[1] < VERSION_VALIDE_S:
        return connue[0]
    lignes = (await db.execute(_SQL_VERSION, {"motifs": list(GROUPES[groupe])})).all()
    version = tuple(tuple(l) for l in lignes)
    _versions[groupe] = (version, time.monotonic())
    return version


def _lire(cle: str, version: tuple) -> bytes | None:
    e = _entrees.get(cle)
    if e is None or e.version != version or time.monotonic() - e.quand > AGE_MAX_S:
        return None
    _entrees.move_to_end(cle)
    return e.corps


def _ecrire(cle: str, version: tuple, corps: bytes) -> None:
    global _octets
    ancienne = _entrees.pop(cle, None)
    if ancienne is not None:
        _octets -= len(ancienne.corps)
    _entrees[cle] = _Entree(version, corps)
    _octets += len(corps)
    while _entrees and (len(_entrees) > ENTREES_MAX or _octets > OCTETS_MAX):
        _, vieille = _entrees.popitem(last=False)
        _octets -= len(vieille.corps)
    if len(_verrous) > 2 * ENTREES_MAX:
        for c in [c for c, v in _verrous.items() if not v.locked()]:
            del _verrous[c]


def invalider(groupe: str | None = None) -> None:
    """Oublie les réponses d'une famille (toutes si None) dans ce processus —
    à appeler après une écriture : les autres processus le verront aux
    compteurs de Postgres."""
    global _octets
    if groupe is None:
        _entrees.clear()
        _octets = 0
        _versions.clear()
        return
    _versions.pop(groupe, None)
    prefixe = f"{groupe}|"
    for cle in [c for c in _entrees if c.startswith(prefixe)]:
        _octets -= len(_entrees.pop(cle).corps)


def _json(valeur: Any) -> bytes:
    return JSONResponse(content=jsonable_encoder(valeur)).body


async def reponse_en_cache(groupe: str, requete: Request, db: AsyncSession,
                           calcul: Callable[[], Awaitable[Any]], selon_le_jour: bool = False) -> Any:
    """La réponse de `calcul`, servie de la mémoire tant que les tables de
    `groupe` n'ont pas changé. Un seul calcul à la fois par adresse : les
    requêtes qui arrivent pendant ce temps attendent son résultat.
    `selon_le_jour` : la réponse dépend aussi de la date du jour (« à venir »,
    « prochain événement ») — elle change à minuit sans qu'aucune table ne
    bouge."""
    jour = date.today().isoformat() if selon_le_jour else ""
    cle = f"{groupe}|{jour}|{requete.url.path}?{requete.url.query}"
    sans_cache = "no-cache" in requete.headers.get("cache-control", "").lower()
    try:
        version = await _version(groupe, db)
    except Exception:
        # Base injoignable : la dernière réponse connue vaut mieux qu'une
        # erreur — les pages publiques tiennent pendant une courte coupure
        if not sans_cache and (e := _entrees.get(cle)) is not None:
            log.warning("cache %s : base injoignable, dernière réponse connue servie", groupe)
            return Response(content=e.corps, media_type="application/json")
        log.warning("cache %s : compteurs illisibles, réponse calculée sans cache", groupe, exc_info=True)
        return await calcul()
    if not sans_cache and (corps := _lire(cle, version)) is not None:
        return Response(content=corps, media_type="application/json")
    verrou = _verrous.setdefault(cle, asyncio.Lock())
    async with verrou:
        if not sans_cache and (corps := _lire(cle, version)) is not None:
            return Response(content=corps, media_type="application/json")
        valeur = await calcul()
        if isinstance(valeur, Response):  # réponse déjà faite (fichier…) : pas de cache
            return valeur
        corps = _json(valeur)
        _ecrire(cle, version, corps)
        return Response(content=corps, media_type="application/json")


def en_cache(groupe: str, selon_le_jour: bool = False):
    """Décore une route GET publique (sans response_model) dont la base de
    données arrive par le paramètre `db` :

        @router.get("/commerce/filtres")
        @en_cache("statistiques")
        async def commerce_filtres(db: AsyncSession = Depends(get_db)): ...
    """
    if groupe not in GROUPES:
        raise ValueError(f"Famille de cache inconnue : {groupe}")

    def decorer(route):
        signature = inspect.signature(route)
        if "db" not in signature.parameters:
            raise TypeError(f"{route.__name__} : en_cache attend un paramètre `db`")

        @functools.wraps(route)
        async def enveloppe(*args, **kwargs):
            requete = kwargs.pop("_requete_cache")
            return await reponse_en_cache(groupe, requete, kwargs["db"], lambda: route(*args, **kwargs),
                                          selon_le_jour)

        # FastAPI lit la signature pour injecter les dépendances : la requête
        # s'y ajoute, la route d'origine ne la voit pas
        enveloppe.__signature__ = signature.replace(parameters=[
            *signature.parameters.values(),
            inspect.Parameter("_requete_cache", inspect.Parameter.KEYWORD_ONLY, annotation=Request),
        ])
        return enveloppe

    return decorer
