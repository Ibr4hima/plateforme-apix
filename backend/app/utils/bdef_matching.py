"""
Matching de secteurs BDEF entre un libellé brut (fichier Excel)
et nos secteurs en base.

Cascade à 4 niveaux (s'arrête au premier match certain) :
  1. Alias connus (mémoire persistante)
  2. Match exact normalisé
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

IMPORTANT — le code numérique du BDEF n'est PAS un signal d'identité.
Les numérotations divergent entre sources : dans le BDEF officiel 2024,
le code 3 = « Industries extractives », alors que dans notre base le même
secteur porte le code 012. Utiliser le code pour confirmer l'identité
pousserait donc vers le MAUVAIS secteur. Le code sert uniquement à
déterminer le NIVEAU de lecture (global / secteur / groupe / macro-secteur)
via `detecter_niveau`. L'appelant filtre alors les candidats sur ce niveau
et le matching d'identité se fait sur le libellé seul.
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

# Niveaux de lecture (alignés sur bdef_valeurs.niveau)
NIVEAU_GLOBAL  = "global"
NIVEAU_SECTEUR = "secteur"
NIVEAU_GROUPE  = "groupe"
NIVEAU_MACRO   = "macro_secteur"


@dataclass
class Candidat:
    secteur_id: int
    libelle_norm: str   # libellé normalisé du secteur en base
    libelle_raw: str    # libellé original du secteur en base
    code: str | None    # code du secteur en base (ex: "012") — informatif
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


def detecter_niveau(code: str | int | None) -> str | None:
    """
    Déduit le niveau de lecture à partir du code BDEF du tableau.

    Convention observée dans le BDEF officiel :
        0          → global (« GLOBAL DES SECTEURS »)
        1   – 99   → secteur d'activité détaillé (1-35)
        100 – 199  → groupe (101-109)
        200 – 299  → macro-secteur (201-204)

    Retourne None si le code est absent ou hors plage connue.
    """
    if code is None or str(code).strip() == "":
        return None
    s = str(code).strip()
    if not s.lstrip("0").isdigit() and not s.isdigit():
        return None
    n = int(s)
    if n == 0:
        return NIVEAU_GLOBAL
    if 1 <= n <= 99:
        return NIVEAU_SECTEUR
    if 100 <= n <= 199:
        return NIVEAU_GROUPE
    if 200 <= n <= 299:
        return NIVEAU_MACRO
    return None


def matcher_secteur(
    libelle_brut: str,
    secteurs: list[dict],     # [{"id": int, "libelle": str, "code": str|None}, ...]
    alias: dict[str, int],    # {libelle_brut: secteur_id} — chargé depuis bdef_secteur_alias
) -> ResultatMatching:
    """
    Trouve le secteur correspondant à un libellé brut, par le LIBELLÉ seul.

    `secteurs` : les candidats à comparer. L'appelant doit les avoir filtrés
                 sur le bon niveau (cf. `detecter_niveau`) — c'est ce qui lève
                 l'ambiguïté entre, p. ex., le groupe « Commerce » (105) et le
                 macro-secteur « Commerce » (203).
    `alias`    : table d'alias {libellé_brut_exact → secteur_id}.
    """
    # Niveau 1 : alias exact (sur le brut, avant normalisation)
    if libelle_brut in alias:
        return ResultatMatching(
            secteur_id=alias[libelle_brut], confiance="certain", score=100.0,
            candidats=[], source="alias",
        )

    norme = normaliser(libelle_brut)

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

    # Niveau 2 : match exact normalisé
    for c in candidats_norm:
        if c.libelle_norm == norme and norme:
            return ResultatMatching(
                secteur_id=c.secteur_id, confiance="certain", score=100.0,
                candidats=[], source="exact",
            )

    # Niveau 3 : fuzzy sur le libellé
    for c in candidats_norm:
        c.score = fuzz.token_sort_ratio(norme, c.libelle_norm)

    top = sorted(candidats_norm, key=lambda c: c.score, reverse=True)[:TOP_N]
    meilleur = top[0] if top else None

    if meilleur is None or meilleur.score < SEUIL_SUGGER:
        return ResultatMatching(
            secteur_id=None, confiance="aucun",
            score=meilleur.score if meilleur else None,
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
