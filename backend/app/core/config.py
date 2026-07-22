from pydantic import model_validator
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List
from urllib.parse import quote

# Valeurs de repli du mode démo (AUTH_ENFORCED=false). Dès que l'auth est
# activée, ces valeurs sont refusées au démarrage : voir _verrouiller_secrets.
_SECRET_KEY_DEMO = "changeme_in_production"
_AUTH_SECRET_DEMO = "changeme_auth_secret_in_production"


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

    # Identifiants encodés : un @ ou un : dans le mot de passe casserait le
    # parsing de l'URL (l'hôte deviendrait « mdp@hôte » → erreur DNS).
    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{quote(self.POSTGRES_USER, safe='')}:{quote(self.POSTGRES_PASSWORD, safe='')}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return (
            f"postgresql://{quote(self.POSTGRES_USER, safe='')}:{quote(self.POSTGRES_PASSWORD, safe='')}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # UNCTAD API (optionnel — pour l'auto-refresh IDE)
    UNCTAD_CLIENT_ID: str = ""
    UNCTAD_CLIENT_SECRET: str = ""

    # Assistant IA (API Claude / Anthropic) — clé côté serveur uniquement,
    # jamais exposée au frontend. Laisser vide désactive l'assistant (la route
    # renvoie 503). Modèle et plafonds réglables sans redéploiement.
    ANTHROPIC_API_KEY: str = ""
    ASSISTANT_MODELE: str = "claude-sonnet-5"
    ASSISTANT_MAX_TOKENS: int = 1500          # plafond de sortie par réponse
    ASSISTANT_RATE_LIMIT: int = 20            # requêtes/IP par fenêtre
    ASSISTANT_RATE_FENETRE: int = 3600        # fenêtre du rate-limit (secondes)

    # Relais des imports vers la production (optionnel — environnement local
    # uniquement) : quand configuré, l'admin propose « Envoyer aussi en
    # production » et le backend relaie les fichiers importés vers l'API de
    # prod, à travers son basic-auth Caddy. Laisser vide en production.
    PROD_SYNC_URL: str = ""       # ex. https://demo-plateforme-apix.com/api/v1
    PROD_SYNC_USER: str = ""      # identifiant basic-auth (ex. apix)
    PROD_SYNC_PASSWORD: str = ""  # mot de passe basic-auth

    # Sécurité JWT (clé interne legacy)
    SECRET_KEY: str = _SECRET_KEY_DEMO
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Auth NextAuth — même secret que le frontend
    AUTH_SECRET: str = _AUTH_SECRET_DEMO

    # Admins : liste d'emails séparés par virgule dans la variable d'env ADMIN_EMAILS
    # Exemple : ADMIN_EMAILS=alice@apix.sn,bob@apix.sn
    ADMIN_EMAILS: str = ""

    @property
    def admin_emails_list(self) -> List[str]:
        """Retourne la liste des emails admin en minuscules."""
        return [e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()]

    # Développeur(s) : accès total, défini uniquement par variable d'environnement
    # (jamais modifiable depuis l'interface). Ex : DEV_EMAILS=ibra.ba@apix.sn
    DEV_EMAILS: str = ""

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

    @model_validator(mode="after")
    def _verrouiller_secrets(self) -> "Settings":
        """Fail-safe : dès que l'authentification est activée, le backend
        refuse de démarrer avec les secrets de démo — plutôt que de retomber
        silencieusement sur une API « tout ouvert » validée par un secret
        connu de tous."""
        if not self.AUTH_ENFORCED:
            return self
        problemes = []
        if self.AUTH_SECRET == _AUTH_SECRET_DEMO or len(self.AUTH_SECRET) < 32:
            problemes.append(
                "AUTH_SECRET doit être un secret réel d'au moins 32 caractères "
                "(identique à AUTH_SECRET côté frontend) — ex. `openssl rand -base64 48`"
            )
        if self.SECRET_KEY == _SECRET_KEY_DEMO or len(self.SECRET_KEY) < 32:
            problemes.append(
                "SECRET_KEY doit être un secret réel d'au moins 32 caractères "
                "— ex. `openssl rand -base64 48`"
            )
        if problemes:
            raise ValueError(
                "AUTH_ENFORCED=true mais la configuration n'est pas sûre :\n  - "
                + "\n  - ".join(problemes)
            )
        return self


@lru_cache()
def get_settings() -> Settings:
    return Settings()
