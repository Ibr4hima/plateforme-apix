"""
Authentification par email + mot de passe, restreinte au domaine @apix.sn.

Mode de test/transition : permet de créer un compte et de se connecter sans
Microsoft Entra ID. Quand Azure AD sera configuré, le frontend basculera sur
le provider Microsoft ; ces routes pourront rester pour les comptes locaux.

Le frontend (NextAuth) appelle /auth/login, puis émet lui-même le JWT de
session (HS256) que le backend revalide sur les autres routes.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import hash_password, verify_password, role_for_email
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

ALLOWED_DOMAIN = "@apix.sn"
MIN_PASSWORD_LEN = 8


class RegisterPayload(BaseModel):
    email: EmailStr
    password: str


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


def _check_domain(email: str) -> str:
    normalized = email.strip().lower()
    if not normalized.endswith(ALLOWED_DOMAIN):
        raise HTTPException(
            status_code=403,
            detail=f"Seules les adresses {ALLOWED_DOMAIN} sont autorisées.",
        )
    return normalized


@router.post("/register")
async def register(payload: RegisterPayload, db: AsyncSession = Depends(get_db)):
    """Crée un compte. L'email doit se terminer par @apix.sn."""
    email = _check_domain(payload.email)
    if len(payload.password) < MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=422,
            detail=f"Le mot de passe doit contenir au moins {MIN_PASSWORD_LEN} caractères.",
        )

    existing = await db.execute(select(User).where(func.lower(User.email) == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet email.")

    user = User(email=email, hashed_password=hash_password(payload.password))
    db.add(user)
    await db.flush()
    return {"email": user.email, "role": role_for_email(user.email)}


@router.post("/login")
async def login(payload: LoginPayload, db: AsyncSession = Depends(get_db)):
    """Vérifie les identifiants et retourne email + rôle (NextAuth émet le JWT)."""
    email = payload.email.strip().lower()
    res = await db.execute(select(User).where(func.lower(User.email) == email))
    user = res.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé.")
    return {"email": user.email, "role": role_for_email(user.email)}
