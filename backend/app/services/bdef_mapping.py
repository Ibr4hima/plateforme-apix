"""
Mapping des blocs extraits vers les valeurs d'indicateurs BDEF.

Rôle : relier les BlocTableau produits par bdef_excel.py aux indicateurs
définis dans bdef_indicateurs (via leur champ extraction_key).

Interface principale :
    resoudre_indicateurs(blocs, indicateurs) → ValeursSecteur

Ne touche pas à la BD — la persistance est la responsabilité du service
d'import (bdef_import.py à venir).

Indicateurs calculés gérés ici :
    act_tx_ca    → taux de croissance du CA d'une année sur l'autre
    inv_tx_autofin → CAF / actif immobilisé * 100
    eff_stock_*  → non calculables (données absentes du fichier 2024) →
                   None jusqu'au fichier multi-années
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import NamedTuple

from app.services.bdef_excel import BlocTableau, FEUILLE_COMPTES, FEUILLE_RATIOS


# ── Types ─────────────────────────────────────────────────────────────────────

class ValeurAnnee(NamedTuple):
    annee: int
    valeur: float
    source: str   # 'lu' | 'calcule' | 'lu_ou_calcule'


@dataclass
class ValeursSecteur:
    """Toutes les valeurs résolues pour un secteur donné."""
    code_bdef: str                                     # "3", "101", "201"…
    libelle_brut: str
    niveau: str | None
    # { code_indicateur : [ValeurAnnee, …] }
    valeurs: dict[str, list[ValeurAnnee]] = field(default_factory=dict)
    # Indicateurs sans données dans ce fichier (ex. stocks MP/march/PF)
    non_disponibles: list[str] = field(default_factory=list)


@dataclass
class IndicateurMeta:
    """Métadonnées minimales d'un indicateur (sous-ensemble de bdef_indicateurs)."""
    code: str
    mode: str           # 'lu' | 'calcule' | 'lu_ou_calcule'
    extraction_key: str | None
    formule_vars: list[str] | None


# ── Construction de l'index d'extraction ──────────────────────────────────────

def _indexer_blocs(blocs: list[BlocTableau]) -> dict[str, dict[str, dict[int, float]]]:
    """
    Retourne un index {extraction_key → {annee → valeur}} construit à partir
    des blocs d'UN secteur donné (même code + niveau).

    Plusieurs blocs peuvent porter la même clé (ex. deux blocs C dans RATIOS) ;
    on prend la première valeur rencontrée pour chaque année.
    """
    index: dict[str, dict[int, float]] = {}
    for bloc in blocs:
        for lv in bloc.lignes:
            if lv.cle not in index:
                index[lv.cle] = {}
            for annee, val in lv.valeurs.items():
                index[lv.cle].setdefault(annee, val)
    return index


def _annees_communes(blocs: list[BlocTableau]) -> list[int]:
    """Toutes les années présentes dans la liste de blocs, triées."""
    annees: set[int] = set()
    for b in blocs:
        annees.update(b.annees)
    return sorted(annees)


# ── Formules ──────────────────────────────────────────────────────────────────

def _taux_croissance(valeurs: dict[int, float]) -> dict[int, float]:
    """(V_T - V_{T-1}) / V_{T-1} pour chaque paire d'années consécutives."""
    result = {}
    annees = sorted(valeurs)
    for i in range(1, len(annees)):
        T, T1 = annees[i], annees[i - 1]
        v_T, v_T1 = valeurs.get(T), valeurs.get(T1)
        if v_T is not None and v_T1 and v_T1 != 0:
            result[T] = (v_T - v_T1) / v_T1
    return result


def _tx_autofin(caf: dict[int, float], inv: dict[int, float]) -> dict[int, float]:
    """(CAF / Actif immobilisé) * 100."""
    result = {}
    for annee in set(caf) & set(inv):
        if inv[annee] and inv[annee] != 0:
            result[annee] = (caf[annee] / inv[annee]) * 100
    return result


# ── Résolution ────────────────────────────────────────────────────────────────

def resoudre_indicateurs(
    blocs: list[BlocTableau],
    indicateurs: list[IndicateurMeta],
) -> ValeursSecteur:
    """
    Résout les valeurs de tous les indicateurs pour un groupe de blocs
    appartenant au MÊME secteur (même code BDEF + même niveau).

    `blocs`        : blocs du secteur, toutes feuilles confondues.
    `indicateurs`  : liste de IndicateurMeta pour les 26 indicateurs publiés
                     + les _raw_ variables.

    Retourne un ValeursSecteur avec les valeurs résolues et les non-disponibles.
    """
    if not blocs:
        return ValeursSecteur(code_bdef="", libelle_brut="", niveau=None)

    b0 = blocs[0]
    vs = ValeursSecteur(
        code_bdef=b0.code,
        libelle_brut=b0.libelle_secteur,
        niveau=b0.niveau,
    )

    index = _indexer_blocs(blocs)

    # --- Passe 1 : indicateurs "lu" et "lu_ou_calcule" ----------------------
    intermediaires: dict[str, dict[int, float]] = {}  # pour les formules
    for ind in indicateurs:
        if ind.mode not in ("lu", "lu_ou_calcule") or not ind.extraction_key:
            continue
        valeurs_brutes = index.get(ind.extraction_key, {})
        if valeurs_brutes:
            intermediaires[ind.code] = valeurs_brutes
            vs.valeurs[ind.code] = [
                ValeurAnnee(a, v, "lu") for a, v in sorted(valeurs_brutes.items())
            ]

    # --- Passe 2 : indicateurs "calcule" et fallback "lu_ou_calcule" --------
    for ind in indicateurs:
        if ind.code in vs.valeurs:
            continue  # déjà résolu

        if ind.code == "act_tx_ca":
            base = intermediaires.get("act_ca", {})
            if base:
                calc = _taux_croissance(base)
                if calc:
                    intermediaires["act_tx_ca"] = calc
                    vs.valeurs["act_tx_ca"] = [
                        ValeurAnnee(a, v, "calcule") for a, v in sorted(calc.items())
                    ]

        elif ind.code == "act_tx_prod":
            # fallback uniquement (la clé n'était pas dans l'index ou vide)
            base = intermediaires.get("act_production", {})
            if base:
                calc = _taux_croissance(base)
                if calc:
                    intermediaires["act_tx_prod"] = calc
                    vs.valeurs["act_tx_prod"] = [
                        ValeurAnnee(a, v, "calcule") for a, v in sorted(calc.items())
                    ]

        elif ind.code == "inv_tx_autofin":
            caf = intermediaires.get("_raw_caf", {})
            inv = intermediaires.get("inv_actif_immo", {})
            if caf and inv:
                calc = _tx_autofin(caf, inv)
                if calc:
                    vs.valeurs["inv_tx_autofin"] = [
                        ValeurAnnee(a, v, "calcule") for a, v in sorted(calc.items())
                    ]

        elif ind.code in ("eff_stock_mp", "eff_stock_march", "eff_stock_pf"):
            vs.non_disponibles.append(ind.code)

    return vs


# ── Groupement des blocs par secteur ─────────────────────────────────────────

def grouper_par_secteur(
    blocs_comptes: list[BlocTableau],
    blocs_ratios: list[BlocTableau],
) -> dict[tuple[str, str | None], list[BlocTableau]]:
    """
    Regroupe les blocs COMPTES + RATIOS par (code_bdef, niveau).
    Retourne {(code, niveau): [blocs]} prêt pour `resoudre_indicateurs`.
    """
    groupes: dict[tuple[str, str | None], list[BlocTableau]] = {}
    for b in blocs_comptes + blocs_ratios:
        key = (b.code, b.niveau)
        groupes.setdefault(key, []).append(b)
    return groupes
