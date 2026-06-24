"""
Authentification NextAuth — validation JWT côté backend.

Le frontend (Next.js + NextAuth v5) signe un JWT avec AUTH_SECRET (HS256).
Le backend le revalide avec ce même secret ; aucun appel à Azure AD n'est requis.

NOTE : les dépendances get_current_user / require_admin / require_authenticated
sont temporairement désactivées (mode dev). À réactiver avant la mise en prod.
"""

from typing import Optional
from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

_ALGORITHM = "HS256"

# Hachage des mots de passe (bcrypt).
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(plain, hashed)
    except Exception:
        return False


def role_for_email(email: str) -> str:
    return "admin" if (email or "").strip().lower() in settings.admin_emails_list else "viewer"


def verify_nextauth_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.AUTH_SECRET,
            algorithms=[_ALGORITHM],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Token invalide : {exc}")


# ── Dependencies FastAPI ──────────────────────────────────────────────────────

_DEV_USER = {"email": "dev@apix.sn", "role": "admin"}


def _extract_bearer(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def get_current_user(request: Request) -> dict:
    # DEV MODE — auth désactivée
    return _DEV_USER


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    # DEV MODE — auth désactivée
    return current_user


def require_authenticated(current_user: dict = Depends(get_current_user)) -> dict:
    # DEV MODE — auth désactivée
    return current_user


def optional_user(request: Request) -> Optional[dict]:
    token = _extract_bearer(request)
    if not token:
        return None
    try:
        return verify_nextauth_token(token)
    except HTTPException:
        return None
