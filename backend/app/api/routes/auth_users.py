"""
Authentification par email + mot de passe, restreinte au domaine @apix.sn.

Mode de test/transition : permet de créer un compte et de se connecter sans
Microsoft Entra ID. Quand Azure AD sera configuré, le frontend basculera sur
le provider Microsoft ; ces routes pourront rester pour les comptes locaux.

Le frontend (NextAuth) appelle /auth/login, puis émet lui-même le JWT de
session (HS256) que le backend revalide sur les autres routes.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import hash_password, verify_password, role_for_email, require_admin, get_current_user, peut_editer_admin
from app.core.passwords import valider_mot_de_passe
from app.core.config import get_settings
from app.models.user import User, AuthThrottle

router = APIRouter(prefix="/auth", tags=["auth"])

_settings = get_settings()

# Pages d'administration (slugs) — pour le rôle admin_plus, `modules` liste les
# pages admin sur lesquelles il a le droit d'édition (ajout/modif/suppression).
MODULES = [
    "utilisateurs", "evenements", "accords", "entreprises", "gestion-zones",
    "opportunites", "intentions", "prospects", "analyse",
    "statistiques", "ref-pays", "geo", "naema", "classifications", "ide", "bdef",
    "code-investissement",
]

ROLES_VALIDES = ("agent", "admin", "admin_plus")


def _public_user(u: User) -> dict:
    email = (u.email or "").lower()
    role = "dev" if email in _settings.dev_emails_list else ("admin_plus" if email in _settings.admin_emails_list else (u.role or "agent"))
    return {"id": u.id, "email": u.email, "prenom": u.prenom or "", "nom": u.nom or "",
            "role": role, "modules": list(u.modules or []),
            "is_active": u.is_active, "created_at": u.created_at}

ALLOWED_DOMAIN = "@apix.sn"
MIN_PASSWORD_LEN = 8


class RegisterPayload(BaseModel):
    email: EmailStr
    password: str


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


# ── Anti-force-brute ──────────────────────────────────────────────────────────
# 5 échecs → verrouillage 15 min, puis 30, 60… (doublé à chaque palier de 5,
# plafonné à 24 h). Compté par compte ET par IP, en base (table auth_throttle).
# Un échec vieux de plus d'une heure remet le compteur à zéro.
SEUIL_ECHECS   = 5
VERROU_BASE_MIN = 15
VERROU_MAX_MIN  = 24 * 60
FENETRE_MIN     = 60

# Hash factice : égalise le temps de réponse quand l'email n'existe pas
_DUMMY_HASH = hash_password("dummy-timing-equalizer")


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "inconnu"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _verifier_verrous(db: AsyncSession, cles: List[str]) -> None:
    res = await db.execute(select(AuthThrottle).where(AuthThrottle.cle.in_(cles)))
    for row in res.scalars().all():
        if row.verrouille_jusqua and row.verrouille_jusqua > _now():
            restant = int((row.verrouille_jusqua - _now()).total_seconds() // 60) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Trop de tentatives. Réessayez dans {restant} minute{'s' if restant > 1 else ''}.",
            )


async def _enregistrer_echec(db: AsyncSession, cles: List[str]) -> dict:
    """Incrémente les compteurs et pose les verrous — puis commit explicite :
    get_db fait un rollback quand l'endpoint lève une HTTPException.
    Retourne l'état du premier compteur (le compte) : verrouillage éventuel
    et nombre de tentatives restantes avant le prochain verrou."""
    etat = {"verrouille_min": 0, "restantes": SEUIL_ECHECS}
    for i, cle in enumerate(cles):
        row = (await db.execute(select(AuthThrottle).where(AuthThrottle.cle == cle))).scalar_one_or_none()
        if not row:
            row = AuthThrottle(cle=cle, echecs=0)
            db.add(row)
        if row.dernier_echec and (_now() - row.dernier_echec) > timedelta(minutes=FENETRE_MIN):
            row.echecs = 0
        row.echecs += 1
        row.dernier_echec = _now()
        if row.echecs >= SEUIL_ECHECS and row.echecs % SEUIL_ECHECS == 0:
            palier = row.echecs // SEUIL_ECHECS
            duree = min(VERROU_BASE_MIN * (2 ** (palier - 1)), VERROU_MAX_MIN)
            row.verrouille_jusqua = _now() + timedelta(minutes=duree)
            if i == 0:
                etat["verrouille_min"] = duree
        if i == 0:
            etat["restantes"] = SEUIL_ECHECS - (row.echecs % SEUIL_ECHECS) if row.echecs % SEUIL_ECHECS else 0
    await db.commit()
    return etat


async def _reinitialiser_compteurs(db: AsyncSession, cles: List[str]) -> None:
    res = await db.execute(select(AuthThrottle).where(AuthThrottle.cle.in_(cles)))
    for row in res.scalars().all():
        await db.delete(row)


def _check_domain(email: str) -> str:
    normalized = email.strip().lower()
    if not normalized.endswith(ALLOWED_DOMAIN):
        raise HTTPException(
            status_code=403,
            detail=f"Seules les adresses {ALLOWED_DOMAIN} sont autorisées.",
        )
    return normalized


@router.post("/register")
async def register(payload: RegisterPayload, request: Request, db: AsyncSession = Depends(get_db)):
    """Crée un compte. L'email doit se terminer par @apix.sn."""
    ip = _client_ip(request)
    await _verifier_verrous(db, [f"register-ip:{ip}"])
    email = _check_domain(payload.email)
    erreurs = await valider_mot_de_passe(payload.password, email)
    if erreurs:
        raise HTTPException(
            status_code=422,
            detail="Le mot de passe doit : " + " ; ".join(erreurs) + ".",
        )

    existing = await db.execute(select(User).where(func.lower(User.email) == email))
    if existing.scalar_one_or_none():
        await _enregistrer_echec(db, [f"register-ip:{ip}"])
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet email.")

    role = role_for_email(email)
    # Validation par un administrateur : les comptes naissent désactivés, sauf
    # les emails dev/admin (définis par l'environnement) — sans quoi le tout
    # premier compte de la plateforme ne pourrait jamais être activé.
    actif_immediat = role in ("dev", "admin_plus")
    user = User(email=email, hashed_password=hash_password(payload.password),
                role=role if role != "dev" else "agent",
                modules=list(MODULES) if role == "admin_plus" else [],
                is_active=actif_immediat)
    db.add(user)
    await db.flush()
    return {"email": user.email, "role": role, "modules": [], "pending": not actif_immediat}


@router.post("/login")
async def login(payload: LoginPayload, request: Request, db: AsyncSession = Depends(get_db)):
    """Vérifie les identifiants et retourne email + rôle (NextAuth émet le JWT)."""
    email = payload.email.strip().lower()
    ip = _client_ip(request)
    cles = [f"login:{email}", f"login-ip:{ip}"]
    await _verifier_verrous(db, cles)

    res = await db.execute(select(User).where(func.lower(User.email) == email))
    user = res.scalar_one_or_none()
    def _msg_echec(etat: dict) -> str:
        if etat["verrouille_min"]:
            return (f"Email ou mot de passe incorrect. Compte temporairement verrouillé : "
                    f"réessayez dans {etat['verrouille_min']} minutes.")
        n = etat["restantes"]
        return (f"Email ou mot de passe incorrect — il vous reste {n} tentative{'s' if n > 1 else ''} "
                "avant verrouillage temporaire.")

    if not user:
        verify_password(payload.password, _DUMMY_HASH)  # temps de réponse constant
        etat = await _enregistrer_echec(db, cles)
        raise HTTPException(status_code=401, detail=_msg_echec(etat))
    if not verify_password(payload.password, user.hashed_password):
        etat = await _enregistrer_echec(db, cles)
        raise HTTPException(status_code=401, detail=_msg_echec(etat))
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte en attente de validation par un administrateur, ou désactivé.")
    await _reinitialiser_compteurs(db, cles)
    pu = _public_user(user)
    return {"email": user.email, "prenom": pu["prenom"], "nom": pu["nom"],
            "role": pu["role"], "modules": pu["modules"]}


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
    prenom: Optional[str] = None
    nom: Optional[str] = None
    role: Optional[str] = None          # agent | admin | admin_plus
    modules: Optional[List[str]] = None  # pages admin éditables (admin_plus)
    is_active: Optional[bool] = None


@router.patch("/users/{user_id}")
async def modifier_user(user_id: int, payload: UserUpdatePayload,
                        db: AsyncSession = Depends(get_db),
                        current_user: dict = Depends(require_admin)):
    # Écriture : dev, ou admin_plus avec la page « utilisateurs » cochée
    if not peut_editer_admin(current_user, "utilisateurs"):
        raise HTTPException(status_code=403, detail="Modification des utilisateurs non autorisée.")
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    email = (user.email or "").lower()
    # Le compte dev : prénom/nom modifiables, mais rôle/modules/statut intouchables
    # (définis par l'environnement).
    if email in _settings.dev_emails_list and (
        payload.role is not None or payload.modules is not None or payload.is_active is not None
    ):
        raise HTTPException(status_code=403, detail="Le rôle et le statut du compte développeur ne sont pas modifiables.")
    if payload.prenom is not None:
        user.prenom = payload.prenom.strip() or None
    if payload.nom is not None:
        user.nom = payload.nom.strip() or None
    if payload.role is not None:
        if payload.role not in ROLES_VALIDES:
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


@router.delete("/users/{user_id}", status_code=204)
async def supprimer_user(user_id: int,
                         db: AsyncSession = Depends(get_db),
                         current_user: dict = Depends(require_admin)):
    if not peut_editer_admin(current_user, "utilisateurs"):
        raise HTTPException(status_code=403, detail="Suppression des utilisateurs non autorisée.")
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    if (user.email or "").lower() in _settings.dev_emails_list:
        raise HTTPException(status_code=403, detail="Le compte développeur n'est pas supprimable.")
    await db.delete(user)
    await db.flush()
