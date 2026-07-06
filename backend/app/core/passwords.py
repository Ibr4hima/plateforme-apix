"""
Politique de mots de passe de la plateforme.

Règles (source de vérité côté backend, l'UI ne fait que refléter) :
  - 12 caractères minimum, 72 octets maximum (limite dure de bcrypt) ;
  - au moins une minuscule, une majuscule, un chiffre et un caractère spécial ;
  - ne doit pas contenir l'adresse email (ni sa partie locale) ;
  - rejet des mots de passe archi-courants (liste locale) ;
  - rejet des mots de passe présents dans des fuites connues, via l'API
    Have I Been Pwned en k-anonymity : seuls les 5 premiers caractères du
    hash SHA-1 sont envoyés — le mot de passe ne quitte jamais le serveur.
    Si le service est injoignable, on ne bloque pas (les autres règles
    restent le filet de sécurité).
"""

import hashlib
import re
from typing import List, Optional

import httpx

MIN_LEN = 12
MAX_BYTES = 72

# Mots de passe (ou racines) ultra-courants — comparés en minuscules.
_COMMON = {
    "password", "password1", "password123", "motdepasse", "motdepasse1", "motdepasse123",
    "123456", "1234567", "12345678", "123456789", "1234567890", "12345678910",
    "azerty", "azerty123", "azertyuiop", "qwerty", "qwerty123", "qwertyuiop",
    "abc123", "abcd1234", "111111", "000000", "121212", "654321",
    "iloveyou", "jetaime", "welcome", "bonjour", "soleil", "chocolat",
    "letmein", "admin", "administrateur", "root", "test", "demo",
    "senegal", "senegal2024", "senegal2025", "dakar", "dakar2024", "dakar2025",
    "apix", "apix2024", "apix2025", "apix2026", "apixsn", "apix123",
    "passw0rd", "p@ssword", "p@ssw0rd", "pa$$word", "secret", "secret123",
    "football", "superman", "batman", "dragon", "monkey", "shadow",
    "sunshine", "princess", "master", "hello123", "bienvenue", "bienvenue1",
}


def _sans_suffixe_trivial(pw: str) -> str:
    """Retire un suffixe trivial (chiffres / !@#$*.) pour attraper « Apix2025! » etc."""
    return re.sub(r"[\d!@#$%^&*.?]{1,6}$", "", pw)


async def est_compromis_hibp(password: str) -> Optional[bool]:
    """True si présent dans une fuite, False si absent, None si service injoignable."""
    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            r = await client.get(
                f"https://api.pwnedpasswords.com/range/{prefix}",
                headers={"Add-Padding": "true", "User-Agent": "apix-plateforme"},
            )
        if r.status_code != 200:
            return None
        for line in r.text.splitlines():
            h, _, count = line.partition(":")
            if h.strip() == suffix and int(count.strip() or 0) > 0:
                return True
        return False
    except Exception:
        return None


async def valider_mot_de_passe(password: str, email: str = "") -> List[str]:
    """Retourne la liste des règles non respectées (vide = mot de passe accepté)."""
    erreurs: List[str] = []
    pw = password or ""

    if len(pw) < MIN_LEN:
        erreurs.append(f"contenir au moins {MIN_LEN} caractères")
    if len(pw.encode("utf-8")) > MAX_BYTES:
        erreurs.append(f"ne pas dépasser {MAX_BYTES} octets")
    if not re.search(r"[a-z]", pw):
        erreurs.append("contenir une minuscule")
    if not re.search(r"[A-Z]", pw):
        erreurs.append("contenir une majuscule")
    if not re.search(r"\d", pw):
        erreurs.append("contenir un chiffre")
    if not re.search(r"[^A-Za-z0-9]", pw):
        erreurs.append("contenir un caractère spécial")

    # Aucune séquence de 4 caractères consécutifs ne doit être commune au mot de
    # passe et à la partie locale de l'email (Ibrahima@… → « Ibra@7738 » refusé).
    e = (email or "").strip().lower()
    local = e.split("@")[0] if "@" in e else e
    pw_lower = pw.lower()
    if local:
        if len(local) >= 4:
            if any(local[i:i + 4] in pw_lower for i in range(len(local) - 3)):
                erreurs.append("ne pas contenir votre adresse email (4 caractères consécutifs en commun)")
        elif len(local) >= 3 and local in pw_lower:
            erreurs.append("ne pas contenir votre adresse email")

    if pw_lower in _COMMON or _sans_suffixe_trivial(pw_lower) in _COMMON:
        erreurs.append("ne pas être un mot de passe courant")

    # HIBP en dernier : seulement si les règles locales passent (économise l'appel)
    if not erreurs and await est_compromis_hibp(pw):
        erreurs.append("ne pas figurer dans des fuites de données connues — celui-ci y figure, choisissez-en un autre")

    return erreurs
