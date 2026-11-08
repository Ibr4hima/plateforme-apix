import os

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings

settings = get_settings()


def _entier(nom: str, defaut: int) -> int:
    try:
        return int(os.environ.get(nom) or defaut)
    except ValueError:
        return defaut


# ── Les connexions à la base ──────────────────────────────────────────────────
# Postgres en accepte 100 (réglage par défaut de l'image de production) ;
# l'API en prend au plus DB_CONNEXIONS_MAX (80), partagées entre ses processus
# (API_WORKERS, fixé par demarrer.sh selon les cœurs du serveur). Le reste
# sert aux imports du déploiement, à psql et à l'entretien de la base. Avec
# 2 processus : 40 chacun ; avec 8 : 10 chacun.
PROCESSUS = max(1, _entier("API_WORKERS", 2))
PAR_PROCESSUS = max(4, _entier("DB_CONNEXIONS_MAX", 80) // PROCESSUS)

# ── Garde-fous de l'API ───────────────────────────────────────────────────────
# Durée maximale d'une requête SQL, d'une attente de verrou, d'une transaction
# laissée ouverte : sans elles, une requête emballée ou un verrou tenu
# bloquait une connexion — et la page — indéfiniment. Activés par demarrer.sh
# pour l'API seulement : les imports lancés à côté (docker compose exec,
# scripts/) gardent les mains libres. Réglables par l'environnement.
GARDE_FOUS = os.environ.get("APIX_GARDE_FOUS") == "1"
_REGLAGES_SESSION = {
    "statement_timeout": str(_entier("DB_DELAI_REQUETE_MS", 120_000)),
    "lock_timeout": str(_entier("DB_DELAI_VERROU_MS", 20_000)),
    "idle_in_transaction_session_timeout": str(_entier("DB_DELAI_TRANSACTION_MS", 600_000)),
}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=PAR_PROCESSUS // 2,
    max_overflow=PAR_PROCESSUS - PAR_PROCESSUS // 2,
    # Une requête qui attend une connexion libre abandonne au bout de 10 s
    # (au lieu de 30) : l'API répond alors 503 « réessayez » (app/main.py).
    pool_timeout=10,
    # Chaque connexion est vérifiée avant usage : après un redémarrage de la
    # base, les connexions mortes du pool ne font plus échouer les premières
    # requêtes.
    pool_pre_ping=True,
    connect_args={"server_settings": _REGLAGES_SESSION} if GARDE_FOUS else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
