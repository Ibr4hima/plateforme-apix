"""
Matching de secteurs BDEF entre un libellé brut (fichier Excel)
et nos secteurs en base.

Cascade à 4 niveaux (s'arrête au premier match certain) :
  1. Match exact normalisé
  2. Alias connus (mémoire persistante)
  3. Fuzzy matching (token_sort_ratio)
  4. → File de revue si aucun match certain

Normalisation :
  - casse : tout en minuscules
  - accents : supprimés (NFD → ASCII)
  - ponctuation/espaces : espaces multiples → espace simple
  - tirets/underscores → espace
  - codes numériques en début de libellé : retirés pour le matching
    ex. "012 Industries extractives" → "industries extractives"
    ex. "3 industries extractives"   → "industries extractives"

Le code numérique (si présent) est conservé comme signal de confirmation
quand deux candidats fuzzy ont des scores proches (écart < 5 pts).
"""
import re
import unicodedata
from dataclasses import dataclass

from rapidfuzz import fuzz

# Seuils
SEUIL_AUTO   = 92   # >= → match automatique (sans revue)
SEUIL_SUGGER = 78   # >= → match suggéré (à valider par un humain)
                    # <  → aucune suggestion fiable

TOP_N = 5           # nombre de candidats conservés dans la file de revue


@dataclass
class Candidat:
    secteur_id: int
    libelle_norm: str   # libellé normalisé du secteur en base
    libelle_raw: str    # libellé original du secteur en base
    code: str | None    # code numérique du secteur (ex: "012")
    score: float        # 0-100


@dataclass
class ResultatMatching:
    """Résultat d'une tentative de matching."""
    secteur_id: int | None
    confiance: str           # 'certain' | 'suggere' | 'aucun'
    score: float | None
    candidats: list[Candidat]  # top N, pour la file de revue
    source: str              # 'exact' | 'alias' | 'fuzzy' | 'aucun'


def normaliser(texte: str) -> str:
    """Normalise un libellé pour le matching : casse, accents, codes numériques."""
    if not texte:
        return ""
    # NFD → retire les diacritiques
    t = unicodedata.normalize("NFD", texte)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = t.lower()
    # codes numériques en tête (ex. "012 " ou "3 " ou "012-")
    t = re.sub(r"^\d+[\s\-\.]+", "", t)
    # tirets et underscores → espace
    t = re.sub(r"[-_]", " ", t)
    # ponctuation lourde
    t = re.sub(r"[^\w\s]", " ", t)
    # espaces multiples
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _extraire_code(texte: str) -> str | None:
    """Extrait le code numérique en début de libellé, ou None."""
    m = re.match(r"^(\d+)[\s\-\.]+", texte.strip())
    return m.group(1) if m else None


def matcher_secteur(
    libelle_brut: str,
    secteurs: list[dict],     # [{"id": int, "libelle": str, "code": str|None}, ...]
    alias: dict[str, int],    # {libelle_brut: secteur_id} — chargé depuis bdef_secteur_alias
) -> ResultatMatching:
    """
    Trouve le secteur correspondant à un libellé brut.

    `secteurs` : tous les secteurs de la base, avec leurs libellés et codes.
    `alias`    : table d'alias {libellé_brut_exact → secteur_id}.
    """
    # Niveau 2 : alias exact (avant normalisation — on stocke le brut)
    if libelle_brut in alias:
        sid = alias[libelle_brut]
        return ResultatMatching(
            secteur_id=sid, confiance="certain", score=100.0,
            candidats=[], source="alias",
        )

    norme = normaliser(libelle_brut)
    code_brut = _extraire_code(libelle_brut)

    # Préparer les candidats normalisés
    candidats_norm = [
        Candidat(
            secteur_id=s["id"],
            libelle_norm=normaliser(s["libelle"]),
            libelle_raw=s["libelle"],
            code=s.get("code"),
            score=0.0,
        )
        for s in secteurs
    ]

    # Niveau 1 : match exact normalisé
    for c in candidats_norm:
        if c.libelle_norm == norme:
            return ResultatMatching(
                secteur_id=c.secteur_id, confiance="certain", score=100.0,
                candidats=[], source="exact",
            )

    # Niveau 3 : fuzzy
    for c in candidats_norm:
        c.score = fuzz.token_sort_ratio(norme, c.libelle_norm)

    # Si un code numérique est présent dans le brut, bonus pour les secteurs
    # dont le code correspond — départage les candidats proches
    if code_brut:
        for c in candidats_norm:
            if c.code and (c.code.lstrip("0") == code_brut.lstrip("0")):
                c.score = min(100.0, c.score + 5.0)

    top = sorted(candidats_norm, key=lambda c: c.score, reverse=True)[:TOP_N]
    meilleur = top[0] if top else None

    if meilleur is None or meilleur.score < SEUIL_SUGGER:
        return ResultatMatching(
            secteur_id=None, confiance="aucun", score=meilleur.score if meilleur else None,
            candidats=top, source="aucun",
        )

    if meilleur.score >= SEUIL_AUTO:
        return ResultatMatching(
            secteur_id=meilleur.secteur_id, confiance="certain", score=meilleur.score,
            candidats=top, source="fuzzy",
        )

    return ResultatMatching(
        secteur_id=meilleur.secteur_id, confiance="suggere", score=meilleur.score,
        candidats=top, source="fuzzy",
    )
