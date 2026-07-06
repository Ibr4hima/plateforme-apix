"""
Authentification par email + mot de passe, restreinte au domaine @apix.sn.

Mode de test/transition : permet de créer un compte et de se connecter sans
Microsoft Entra ID. Quand Azure AD sera configuré, le frontend basculera sur
le provider Microsoft ; ces routes pourront rester pour les comptes locaux.

Le frontend (NextAuth) appelle /auth/login, puis émet lui-même le JWT de
session (HS256) que le backend revalide sur les autres routes.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import hash_password, verify_password, role_for_email, require_admin, get_current_user
from app.core.passwords import valider_mot_de_passe
from app.core.config import get_settings
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

_settings = get_settings()

# Modules protégés de la plateforme (slugs) — la page admin « Utilisateurs &
# accès » s'appuie sur cette liste pour le rôle restreint.
MODULES = [
    "tableau-de-bord", "ide", "prospects", "opportunites",
    "evenements", "accords", "zones", "entreprises",
]


def _public_user(u: User) -> dict:
    email = (u.email or "").lower()
    role = "dev" if email in _settings.dev_emails_list else ("admin" if email in _settings.admin_emails_list else (u.role or "restreint"))
    return {"id": u.id, "email": u.email, "role": role, "modules": list(u.modules or []),
            "is_active": u.is_active, "created_at": u.created_at}

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
    erreurs = await valider_mot_de_passe(payload.password, email)
    if erreurs:
        raise HTTPException(
            status_code=422,
            detail="Le mot de passe doit : " + " ; ".join(erreurs) + ".",
        )

    existing = await db.execute(select(User).where(func.lower(User.email) == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet email.")

    role = role_for_email(email)
    user = User(email=email, hashed_password=hash_password(payload.password),
                role=role if role != "dev" else "restreint", modules=[])
    db.add(user)
    await db.flush()
    return {"email": user.email, "role": role, "modules": []}


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
    pu = _public_user(user)
    return {"email": user.email, "role": pu["role"], "modules": pu["modules"]}


# ── Profil courant & gestion des accès (page admin « Utilisateurs & accès ») ──

@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    """Rôle et modules de l'utilisateur courant (relus depuis la base)."""
    return current_user


@router.get("/modules")
async def liste_modules():
    """Slugs des modules protégés, pour la page d'attribution des accès."""
    return MODULES


@router.get("/users")
async def liste_users(db: AsyncSession = Depends(get_db), _: dict = Depends(require_admin)):
    res = await db.execute(select(User).order_by(User.email))
    return [_public_user(u) for u in res.scalars().all()]


class UserUpdatePayload(BaseModel):
    role: Optional[str] = None          # admin | agent | restreint
    modules: Optional[List[str]] = None
    is_active: Optional[bool] = None


@router.patch("/users/{user_id}")
async def modifier_user(user_id: int, payload: UserUpdatePayload,
                        db: AsyncSession = Depends(get_db),
                        current_user: dict = Depends(require_admin)):
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    email = (user.email or "").lower()
    # Le rôle dev est défini par l'environnement : intouchable depuis l'interface.
    if email in _settings.dev_emails_list:
        raise HTTPException(status_code=403, detail="Le compte développeur n'est pas modifiable.")
    if payload.role is not None:
        if payload.role not in ("admin", "agent", "restreint"):
            raise HTTPException(status_code=422, detail="Rôle invalide.")
        user.role = payload.role
    if payload.modules is not None:
        invalides = [m for m in payload.modules if m not in MODULES]
        if invalides:
            raise HTTPException(status_code=422, detail=f"Module(s) inconnu(s) : {', '.join(invalides)}")
        user.modules = payload.modules
    if payload.is_active is not None:
        user.is_active = payload.is_active
    await db.flush()
    return _public_user(user)
