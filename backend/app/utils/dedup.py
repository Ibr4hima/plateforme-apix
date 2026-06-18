"""
Normalisation des coordonnées de prospects pour la déduplication.

ATTENTION : les règles ci-dessous doivent rester STRICTEMENT IDENTIQUES à celles
du backfill SQL (database/migrations/067_prospect_dedup_contacts.sql). Toute
divergence ferait passer un doublon entre deux saisies (l'une normalisée en SQL,
l'autre en Python).
"""
import re

# Libellés lisibles pour les messages d'erreur
LABELS = {
    "telephone": "Le numéro de téléphone",
    "email":     "L'adresse e-mail",
    "siteweb":   "Le site web",
    "linkedin":  "Le profil LinkedIn",
}


def norm_tel(val: str | None) -> str:
    """E.164 pragmatique : on ne garde que les chiffres et le +, 00 -> +."""
    if not val:
        return ""
    v = re.sub(r"[^0-9+]", "", val)
    v = re.sub(r"^00", "+", v)
    return v


def norm_email(val: str | None) -> str:
    """Minuscules + suppression des espaces autour."""
    if not val:
        return ""
    return val.strip().lower()


def norm_web(val: str | None) -> str:
    """Domaine seul : sans protocole, sans www., sans chemin."""
    if not val:
        return ""
    v = val.strip().lower()
    v = re.sub(r"^https?://", "", v)
    v = re.sub(r"^www\.", "", v)
    v = re.sub(r"/.*$", "", v)
    return v


def norm_linkedin(val: str | None) -> str:
    """LinkedIn : on conserve le chemin (le profil/company identifie l'entité)."""
    if not val:
        return ""
    v = val.strip().lower()
    v = re.sub(r"^https?://", "", v)
    v = re.sub(r"^www\.", "", v)
    v = re.sub(r"[?#].*$", "", v)   # retire query string + fragment
    v = re.sub(r"/+$", "", v)        # retire les / de fin
    return v


def collect_contacts(payload: dict) -> dict:
    """
    Extrait de la charge utile toutes les coordonnées (entreprise + points focaux),
    normalisées et dédupliquées entre elles.

    Retourne un dict { (type, valeur_normalisee) -> {type, valeur_normalisee,
    valeur_affichee, origine} }. La déduplication interne évite qu'un même numéro
    saisi à la fois pour l'entreprise et un point focal du MÊME prospect ne se
    bloque lui-même.
    """
    seen: dict[tuple[str, str], dict] = {}

    def add(type_: str, raw: str, norm: str, origine: str):
        if not norm:
            return
        key = (type_, norm)
        if key not in seen:
            seen[key] = {
                "type": type_,
                "valeur_normalisee": norm,
                "valeur_affichee": (raw or "").strip(),
                "origine": origine,
            }

    for tel in payload.get("telephones") or []:
        add("telephone", tel, norm_tel(tel), "entreprise")
    for mail in payload.get("mails") or []:
        add("email", mail, norm_email(mail), "entreprise")

    for pf in payload.get("points_focaux") or []:
        for tel in pf.get("telephones") or []:
            add("telephone", tel, norm_tel(tel), "point_focal")
        for mail in pf.get("mails") or []:
            add("email", mail, norm_email(mail), "point_focal")

    add("siteweb", payload.get("siteweb"), norm_web(payload.get("siteweb")), "entreprise")
    add("linkedin", payload.get("linkedin"), norm_linkedin(payload.get("linkedin")), "entreprise")

    return seen
