from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import get_settings
from app.api.routes import evenements, accords, entreprises, prospects, zones, zones_types, projets, code_investissement, suivi_projets, classifications, ide, ref_pays, opportunites, ref_potentialites
import os

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(evenements.router,  prefix=settings.API_PREFIX)
app.include_router(accords.router,     prefix=settings.API_PREFIX)
app.include_router(entreprises.router, prefix=settings.API_PREFIX)
app.include_router(prospects.router,   prefix=settings.API_PREFIX)
app.include_router(zones.router,       prefix=settings.API_PREFIX)
app.include_router(zones_types.router, prefix=settings.API_PREFIX)
app.include_router(projets.router,             prefix=settings.API_PREFIX)
app.include_router(code_investissement.router, prefix=settings.API_PREFIX)
app.include_router(suivi_projets.router,       prefix=settings.API_PREFIX)
app.include_router(classifications.router,     prefix=settings.API_PREFIX)
app.include_router(ide.router,                prefix=settings.API_PREFIX)
app.include_router(ref_pays.router,           prefix=settings.API_PREFIX)
app.include_router(opportunites.router,       prefix=settings.API_PREFIX)
app.include_router(ref_potentialites.router,  prefix=settings.API_PREFIX)

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
