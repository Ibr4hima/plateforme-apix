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
import bcrypt

from app.core.config import get_settings

settings = get_settings()

_ALGORITHM = "HS256"


# Hachage des mots de passe — bcrypt appelé directement (passlib n'est plus
# maintenu et plante avec bcrypt >= 4.1). bcrypt ignore tout au-delà de
# 72 octets : on tronque explicitement pour rester déterministe.
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], (hashed or "").encode("utf-8"))
    except Exception:
        return False


def role_for_email(email: str) -> str:
    """Rôle par défaut à la création du compte (dev/admin via env, sinon restreint)."""
    e = (email or "").strip().lower()
    if e in settings.dev_emails_list:
        return "dev"
    if e in settings.admin_emails_list:
        return "admin"
    return "restreint"


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
#
# RBAC à quatre niveaux :
#   dev       → accès total (emails DEV_EMAILS, jamais stocké en base)
#   admin     → tous les modules + routes d'administration
#   agent     → tous les modules en consultation
#   restreint → uniquement les modules listés dans users.modules
#
# Tant que AUTH_ENFORCED=False (mode développement), les dépendances laissent
# tout passer avec un utilisateur dev fictif. Passer AUTH_ENFORCED=true dans
# l'environnement pour activer la vérification réelle.

_DEV_USER = {"email": "dev@apix.sn", "role": "dev", "modules": []}


def _extract_bearer(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


async def _load_user(email: str) -> dict:
    """Recharge rôle et modules depuis la base à chaque requête : la révocation
    d'un accès par un admin prend effet immédiatement, sans attendre l'expiration
    du JWT. Le rôle dev (env) prime toujours sur la base."""
    from sqlalchemy import select, func as sqlfunc
    from app.core.database import AsyncSessionLocal
    from app.models.user import User

    e = (email or "").strip().lower()
    if e in settings.dev_emails_list:
        return {"email": e, "role": "dev", "modules": []}
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(sqlfunc.lower(User.email) == e))
        user = res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Compte inconnu ou désactivé.")
    role = "admin" if e in settings.admin_emails_list else (user.role or "restreint")
    return {"email": e, "role": role, "modules": list(user.modules or [])}


async def get_current_user(request: Request) -> dict:
    if not settings.AUTH_ENFORCED:
        return _DEV_USER
    token = _extract_bearer(request)
    if not token:
        raise HTTPException(status_code=401, detail="Authentification requise.")
    payload = verify_nextauth_token(token)
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Token sans identité.")
    return await _load_user(email)


async def require_authenticated(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if settings.AUTH_ENFORCED and current_user.get("role") not in ("admin", "dev"):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs.")
    return current_user


def require_module(slug: str):
    """Fabrique de dépendance : l'utilisateur doit avoir accès au module `slug`.
    dev/admin/agent → tous les modules ; restreint → slug ∈ users.modules."""
    async def _dep(current_user: dict = Depends(get_current_user)) -> dict:
        if not settings.AUTH_ENFORCED:
            return current_user
        role = current_user.get("role")
        if role in ("dev", "admin", "agent"):
            return current_user
        if slug in (current_user.get("modules") or []):
            return current_user
        raise HTTPException(status_code=403, detail=f"Accès au module « {slug} » non autorisé.")
    return _dep
