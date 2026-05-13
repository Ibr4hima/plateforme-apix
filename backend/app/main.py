from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.routes import evenements

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(evenements.router, prefix=settings.API_PREFIX)


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
