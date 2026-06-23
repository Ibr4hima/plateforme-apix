"""
Authentification NextAuth — validation JWT côté backend.

Le frontend (Next.js + NextAuth v5) signe un JWT avec AUTH_SECRET (HS256).
Le backend le revalide avec ce même secret ; aucun appel à Azure AD n'est requis.
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
    """Retourne le hash bcrypt d'un mot de passe en clair."""
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Vérifie qu'un mot de passe en clair correspond à son hash."""
    try:
        return _pwd_context.verify(plain, hashed)
    except Exception:
        return False


def role_for_email(email: str) -> str:
    """Détermine le rôle d'un email : 'admin' s'il est dans ADMIN_EMAILS, sinon 'viewer'."""
    return "admin" if (email or "").strip().lower() in settings.admin_emails_list else "viewer"


def verify_nextauth_token(token: str) -> dict:
    """Valide et décode un JWT NextAuth signé avec AUTH_SECRET (HS256).

    Retourne le payload décodé (inclut au moins `email` et `role`).
    Lève HTTPException 401 si le token est invalide ou expiré.
    """
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


def _extract_bearer(request: Request) -> Optional[str]:
    """Extrait le token Bearer du header Authorization, ou None."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def get_current_user(request: Request) -> dict:
    """Dependency : lit le header Authorization, valide le JWT, retourne le payload.

    Lève HTTPException 401 si le token est absent ou invalide.
    Le payload contient au minimum : email (str), role (str).
    """
    token = _extract_bearer(request)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Token d'authentification manquant (Authorization: Bearer <token>)",
        )
    return verify_nextauth_token(token)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency : exige que l'utilisateur soit authentifié ET ait le rôle admin.

    Lève HTTPException 403 si le rôle n'est pas 'admin'.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Accès refusé — droits administrateur requis",
        )
    return current_user


def require_authenticated(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency : exige uniquement que l'utilisateur soit authentifié (tout rôle).

    Lève HTTPException 401 si pas de token valide.
    """
    return current_user


def optional_user(request: Request) -> Optional[dict]:
    """Dependency : retourne le payload utilisateur ou None sans bloquer.

    Utilisé pour les routes publiques qui peuvent enrichir la réponse
    si un utilisateur est connecté.
    """
    token = _extract_bearer(request)
    if not token:
        return None
    try:
        return verify_nextauth_token(token)
    except HTTPException:
        return None
