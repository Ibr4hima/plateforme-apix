from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # Projet
    PROJECT_NAME: str = "APIX - Plateforme Investissements"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Base de données
    POSTGRES_HOST: str
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # UNCTAD API (optionnel — pour l'auto-refresh IDE)
    UNCTAD_CLIENT_ID: str = ""
    UNCTAD_CLIENT_SECRET: str = ""

    # Relais des imports vers la production (optionnel — environnement local
    # uniquement) : quand configuré, l'admin propose « Envoyer aussi en
    # production » et le backend relaie les fichiers importés vers l'API de
    # prod, à travers son basic-auth Caddy. Laisser vide en production.
    PROD_SYNC_URL: str = ""       # ex. https://demo-plateforme-apix.com/api/v1
    PROD_SYNC_USER: str = ""      # identifiant basic-auth (ex. apix)
    PROD_SYNC_PASSWORD: str = ""  # mot de passe basic-auth

    # Sécurité JWT (clé interne legacy)
    SECRET_KEY: str = "changeme_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Auth NextAuth — même secret que le frontend
    AUTH_SECRET: str = "changeme_auth_secret_in_production"

    # Admins : liste d'emails séparés par virgule dans la variable d'env ADMIN_EMAILS
    # Exemple : ADMIN_EMAILS=alice@apix.sn,bob@apix.sn
    ADMIN_EMAILS: str = ""

    @property
    def admin_emails_list(self) -> List[str]:
        """Retourne la liste des emails admin en minuscules."""
        return [e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()]

    # Développeur(s) : accès total, défini uniquement par variable d'environnement
    # (jamais modifiable depuis l'interface). Ex : DEV_EMAILS=ibra.ba@apix.sn
    DEV_EMAILS: str = "ibra.ba@apix.sn,ibrahima.28@outlook.com"

    @property
    def dev_emails_list(self) -> List[str]:
        return [e.strip().lower() for e in self.DEV_EMAILS.split(",") if e.strip()]

    # Interrupteur de mise en application de l'authentification sur l'API.
    # False = mode développement actuel (aucun contrôle) ; passer à True pour
    # activer la vérification JWT + RBAC sur toutes les routes protégées.
    AUTH_ENFORCED: bool = False

    # CORS — origines autorisées (séparées par virgule)
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    model_config = {
        "env_file": "../.env",
        "case_sensitive": True,
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
