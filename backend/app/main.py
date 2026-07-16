from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import get_settings
from app.api.routes import (
    evenements, accords, entreprises, prospects, zones_types,
    projets, code_investissement, modalites_application, suivi_projets, classifications,
    ide, ref_pays, opportunites, ref_potentialites, ref_avantages,
    citi, dashboard, dashboard_tables, bdef, auth_users, statistiques
)
from contextlib import asynccontextmanager
import logging
import os

settings = get_settings()
logger = logging.getLogger("apix")


async def _scheduled_ide_refresh():
    """Tâche hebdomadaire : récupère les nouvelles données UNCTAD si credentials configurés."""
    if not settings.UNCTAD_CLIENT_ID:
        return
    from app.api.routes.ide import _do_rafraichir
    from app.core.database import AsyncSessionLocal
    await _do_rafraichir(AsyncSessionLocal)


async def _scheduled_expire_accords():
    """Tâche quotidienne : bascule en « expire » les accords dont la date
    d'expiration est passée, pour que la colonne statut reflète la réalité."""
    from sqlalchemy import text
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        await session.execute(text("""
            UPDATE accords_traites
            SET statut = 'expire', updated_at = NOW()
            WHERE date_expiration IS NOT NULL
              AND date_expiration < CURRENT_DATE
              AND statut IS DISTINCT FROM 'expire'
        """))
        await session.commit()


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
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(evenements.router,          prefix=settings.API_PREFIX)
app.include_router(accords.router,             prefix=settings.API_PREFIX)
app.include_router(entreprises.router,         prefix=settings.API_PREFIX)
app.include_router(prospects.router,           prefix=settings.API_PREFIX)
app.include_router(zones_types.router,         prefix=settings.API_PREFIX)
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
app.include_router(citi.router,                prefix=settings.API_PREFIX)
app.include_router(dashboard.router,           prefix=settings.API_PREFIX)
app.include_router(dashboard_tables.router,    prefix=settings.API_PREFIX)
app.include_router(bdef.router,                prefix=settings.API_PREFIX)
app.include_router(auth_users.router,          prefix=settings.API_PREFIX)
app.include_router(statistiques.router,        prefix=settings.API_PREFIX)

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
    return {"status": "ok"}
