from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import get_settings
from app.api.routes import (
    evenements, accords, entreprises, prospects, zones_types,
    projets, code_investissement, modalites_application, suivi_projets, classifications,
    ide, ref_pays, opportunites, ref_potentialites, ref_avantages,
    citi, dashboard, dashboard_tables, bdef, auth_users, statistiques, bmce,
    assistant, lexique, nace, fdi, fdi_projets, fdi_public, fdi_signaux, fdi_signaux_public,
    fdi_fiche_pays,
)
from contextlib import asynccontextmanager
import logging
import os

settings = get_settings()
logger = logging.getLogger("apix")


async def _une_seule_fois(cle: int, tache) -> None:
    """Les tâches planifiées vivent dans chaque processus de l'API : avec un
    processus par cœur, le rafraîchissement CNUCED partait autant de fois en
    même temps vers l'API distante. Un verrou consultatif de Postgres n'en
    laisse passer qu'un ; les autres s'effacent."""
    from sqlalchemy import text
    from app.core.database import engine
    async with engine.connect() as conn:
        pris = (await conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": cle})).scalar()
        # Le verrou est lié à la session, pas à la transaction : on referme
        # celle-ci, pour que la connexion qui le garde ne reste pas « inactive
        # dans une transaction » le temps de la tâche
        await conn.commit()
        if not pris:
            return
        try:
            await tache()
        finally:
            await conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": cle})
            await conn.commit()


async def _scheduled_ide_refresh():
    """Tâche hebdomadaire : récupère les nouvelles données UNCTAD si credentials configurés."""
    if not settings.UNCTAD_CLIENT_ID:
        return
    from app.api.routes.ide import _do_rafraichir
    from app.core.database import AsyncSessionLocal
    await _une_seule_fois(731_001, lambda: _do_rafraichir(AsyncSessionLocal))


async def _scheduled_expire_accords():
    """Tâche quotidienne : bascule en « expire » les accords dont la date
    d'expiration est passée, pour que la colonne statut reflète la réalité."""
    from sqlalchemy import text
    from app.core.database import AsyncSessionLocal

    async def basculer():
        async with AsyncSessionLocal() as session:
            await session.execute(text("""
                UPDATE accords_traites
                SET statut = 'expire', updated_at = NOW()
                WHERE date_expiration IS NOT NULL
                  AND date_expiration < CURRENT_DATE
                  AND statut IS DISTINCT FROM 'expire'
            """))
            await session.commit()

    await _une_seule_fois(731_002, basculer)


@asynccontextmanager
async def lifespan(application: FastAPI):
    if settings.AUTH_ENFORCED:
        logger.info("Authentification active : JWT + RBAC appliqués sur les routes protégées.")
    else:
        logger.warning(
            "⚠ AUTH_ENFORCED=false — API en mode démo OUVERT, aucun contrôle "
            "d'accès. Passer AUTH_ENFORCED=true (avec des secrets réels) avant "
            "toute exposition à des données sensibles."
        )
    # Rattrapage au démarrage : indépendant d'apscheduler.
    try:
        await _scheduled_expire_accords()
    except Exception:
        pass
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            _scheduled_ide_refresh,
            CronTrigger(day_of_week="sun", hour=2, minute=0),
            id="ide_weekly_refresh",
            replace_existing=True,
        )
        scheduler.add_job(
            _scheduled_expire_accords,
            CronTrigger(hour=0, minute=5),
            id="accords_daily_expire",
            replace_existing=True,
        )
        scheduler.start()
        application.state.scheduler = scheduler
    except ImportError:
        pass  # apscheduler non installé
    yield
    if hasattr(application.state, "scheduler"):
        application.state.scheduler.shutdown(wait=False)


app = FastAPI(
    lifespan=lifespan,
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url=f"{settings.API_PREFIX}/docs" if settings.DEBUG else None,
    redoc_url=f"{settings.API_PREFIX}/redoc" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # La visionneuse (pdf.js) lit les documents par morceaux : elle doit voir
    # ces en-têtes, même servie d'une autre origine (développement, banc)
    expose_headers=["Accept-Ranges", "Content-Range", "Content-Length", "Content-Disposition"],
)

# ── Quand la base ne suit pas : 503 « réessayez », pas 500 ────────────────────
# Une requête qui n'obtient pas de connexion à temps (serveur saturé), une base
# qui redémarre ou refuse la connexion, une requête SQL ou une attente de
# verrou arrêtées par leur durée maximale (app/core/database.py) : autant de
# situations passagères. L'API le dit (503, en-tête Retry-After) au lieu de
# répondre « erreur interne » après 30 s d'attente ; le site réessaie seul.
from fastapi import Request as _Request
from fastapi.responses import JSONResponse as _JSONResponse
from sqlalchemy.exc import DBAPIError as _DBAPIError, TimeoutError as _AttenteConnexion

# Codes SQLSTATE passagers : requête ou verrou arrêtés par leur durée maximale,
# base qui s'arrête ou démarre, connexion perdue (classe 08)
_SQLSTATE_PASSAGERS = {"57014", "55P03", "57P01", "57P02", "57P03"}


def _sqlstate(exc: BaseException) -> str | None:
    for e in (getattr(exc, "orig", None), getattr(getattr(exc, "orig", None), "__cause__", None)):
        code = getattr(e, "sqlstate", None) or getattr(e, "pgcode", None)
        if code:
            return str(code)
    return None


def _reessayez(message: str) -> _JSONResponse:
    return _JSONResponse({"detail": message}, status_code=503, headers={"Retry-After": "2"})


@app.exception_handler(_AttenteConnexion)
async def _serveur_sature(request: _Request, exc: _AttenteConnexion):
    logger.warning("503 — aucune connexion libre à temps : %s %s", request.method, request.url.path)
    return _reessayez("Serveur momentanément saturé : réessayez dans un instant.")


@app.exception_handler(_DBAPIError)
async def _base_indisponible(request: _Request, exc: _DBAPIError):
    code = _sqlstate(exc)
    if code in ("57014", "55P03"):   # durée maximale atteinte (requête, attente de verrou)
        logger.warning("503 — opération interrompue, trop longue (%s) : %s %s", code, request.method, request.url.path)
        return _reessayez("Opération interrompue : elle prenait trop de temps. Réessayez dans un instant.")
    if exc.connection_invalidated or (code and (code in _SQLSTATE_PASSAGERS or code.startswith("08"))):
        logger.warning("503 — base indisponible (%s) : %s %s", code, request.method, request.url.path)
        return _reessayez("Base de données momentanément indisponible : réessayez dans un instant.")
    logger.error("Erreur de base de données : %s %s", request.method, request.url.path, exc_info=exc)
    return _JSONResponse({"detail": "Internal Server Error"}, status_code=500)


@app.exception_handler(ConnectionError)
async def _base_injoignable(request: _Request, exc: ConnectionError):
    # Base arrêtée : la connexion est refusée avant même d'atteindre Postgres
    logger.warning("503 — connexion refusée : %s %s", request.method, request.url.path)
    return _reessayez("Base de données momentanément indisponible : réessayez dans un instant.")


UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(evenements.router,          prefix=settings.API_PREFIX)
app.include_router(accords.router,             prefix=settings.API_PREFIX)
app.include_router(entreprises.router,         prefix=settings.API_PREFIX)
app.include_router(prospects.router,           prefix=settings.API_PREFIX)
app.include_router(zones_types.router,         prefix=settings.API_PREFIX)
app.include_router(bmce.router,                prefix=settings.API_PREFIX)
app.include_router(nace.router,                prefix=settings.API_PREFIX)
app.include_router(projets.router,             prefix=settings.API_PREFIX)
app.include_router(code_investissement.router,   prefix=settings.API_PREFIX)
app.include_router(modalites_application.router, prefix=settings.API_PREFIX)
app.include_router(suivi_projets.router,       prefix=settings.API_PREFIX)
app.include_router(classifications.router,     prefix=settings.API_PREFIX)
app.include_router(ide.router,                 prefix=settings.API_PREFIX)
app.include_router(ref_pays.router,            prefix=settings.API_PREFIX)
app.include_router(opportunites.router,        prefix=settings.API_PREFIX)
app.include_router(ref_potentialites.router,   prefix=settings.API_PREFIX)
app.include_router(ref_avantages.router,       prefix=settings.API_PREFIX)
app.include_router(lexique.router,             prefix=settings.API_PREFIX)
app.include_router(citi.router,                prefix=settings.API_PREFIX)
app.include_router(dashboard.router,           prefix=settings.API_PREFIX)
app.include_router(dashboard_tables.router,    prefix=settings.API_PREFIX)
app.include_router(bdef.router,                prefix=settings.API_PREFIX)
app.include_router(auth_users.router,          prefix=settings.API_PREFIX)
app.include_router(statistiques.router,        prefix=settings.API_PREFIX)
app.include_router(assistant.router,           prefix=settings.API_PREFIX)
app.include_router(fdi.router,                  prefix=settings.API_PREFIX)
app.include_router(fdi_projets.router,          prefix=settings.API_PREFIX)
app.include_router(fdi_public.router,           prefix=settings.API_PREFIX)
app.include_router(fdi_signaux.router,          prefix=settings.API_PREFIX)
app.include_router(fdi_signaux_public.router,   prefix=settings.API_PREFIX)
app.include_router(fdi_fiche_pays.router,       prefix=settings.API_PREFIX)

@app.get("/")
async def root():
    return {
        "projet":  settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status":  "opérationnel",
        "docs":    f"{settings.API_PREFIX}/docs",
    }

@app.get("/health")
async def health():
    """Le contrôle de santé (Docker) : l'API répond ET la base aussi. Il
    répondait « ok » base arrêtée, pendant que toutes les pages échouaient."""
    import asyncio
    from sqlalchemy import text
    from app.core.database import engine

    async def interroger():
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))

    try:
        await asyncio.wait_for(interroger(), timeout=3)
    except Exception as e:  # base injoignable, saturée ou trop lente
        logger.warning("Contrôle de santé : base injoignable (%s)", type(e).__name__)
        return _JSONResponse({"status": "degrade", "base": "injoignable"}, status_code=503)
    return {"status": "ok", "base": "ok"}
