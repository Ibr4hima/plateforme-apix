"""
Vérification automatisée des données BDEF importées — cœur PUR (sans BD).

Objectif : donner une assurance qualité sur les valeurs enregistrées sans avoir
à comparer manuellement le fichier source (gigantesque). Trois axes + un bonus :

  1. RECALCUL des indicateurs calculés
     On re-dérive act_tx_ca, act_tx_prod, inv_tx_autofin à partir des valeurs de
     base stockées et on compare au résultat stocké. Toute divergence supérieure
     à la tolérance d'arrondi révèle une incohérence d'écriture.

  2. COUVERTURE
     Pour chaque indicateur publié, on mesure le taux de remplissage
     (valeurs présentes / emplacements attendus). Un indicateur vide partout ou
     presque trahit une extraction_key erronée ou un parsing cassé.

  3. ANOMALIES statistiques & bornes
     - Bornes de plausibilité (montants FCFA négatifs, valeurs aberrantes).
     - Valeurs hors norme par rapport aux autres secteurs (écart robuste à la
       médiane via MAD) : candidates à une vérification ciblée.

  4. COHÉRENCE métier (identités comptables fortes)
     VA ≤ CA, EBE ≤ VA : une violation indique presque toujours une colonne mal
     mappée.

La couche BD (route /bdef/verification) charge les valeurs et appelle verifier().
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import NamedTuple


# ── Entrées ───────────────────────────────────────────────────────────────────

class IndicateurInfo(NamedTuple):
    libelle: str
    unite: str          # FCFA | ratio | % | jours
    mode: str           # lu | calcule | lu_ou_calcule


@dataclass
class SecteurValeurs:
    """Valeurs d'un secteur : {code_indicateur: {annee: valeur}} (inclut _raw_)."""
    niveau: str
    cible_id: int | None
    libelle: str
    valeurs: dict[str, dict[int, float]] = field(default_factory=dict)


# ── Sorties ───────────────────────────────────────────────────────────────────

@dataclass
class Anomalie:
    severite: str        # erreur | avertissement | info
    categorie: str       # recalcul | borne | outlier | coherence
    indicateur: str
    niveau: str
    cible_id: int | None
    libelle_cible: str
    annee: int | None
    message: str
    valeur: float | None = None
    attendu: float | None = None


@dataclass
class CouvertureIndic:
    code: str
    libelle: str
    annees_couvertes: int
    nb_present: int
    nb_attendu: int
    taux: float          # 0..1


@dataclass
class RapportVerification:
    nb_secteurs: int
    nb_valeurs: int
    annees: list[int]
    couverture: list[CouvertureIndic]
    anomalies: list[Anomalie]
    nb_erreurs: int
    nb_avertissements: int
    score: float         # 0..100 — % de valeurs sans erreur détectée


# ── Indicateurs non disponibles dans le fichier 2024 (cf. bdef_mapping) ────────
_NON_DISPONIBLES = {"eff_stock_mp", "eff_stock_march", "eff_stock_pf"}

# Montants FCFA qui ne peuvent jamais être négatifs (erreur de signe / colonne)
_MONTANTS_POSITIFS = {"act_ca", "act_production",
                      "inv_actif_immo", "inv_amortiss",
                      "_raw_caf", "_raw_achats_ht", "_raw_ca_ht",
                      "_raw_stocks_mp", "_raw_stocks_march", "_raw_stocks_pf"}

# Tolérances de recalcul (les valeurs sont stockées en Numeric(20,4))
_TOL_ABS = 1e-3
_TOL_REL = 1e-3


def _proche(a: float, b: float) -> bool:
    return abs(a - b) <= _TOL_ABS + _TOL_REL * abs(b)


def _taux_croissance(valeurs: dict[int, float]) -> dict[int, float]:
    """(V_T - V_{T-1}) / V_{T-1} — réimplémentation indépendante pour le contrôle."""
    out = {}
    annees = sorted(valeurs)
    for i in range(1, len(annees)):
        T, T1 = annees[i], annees[i - 1]
        v_T, v_T1 = valeurs.get(T), valeurs.get(T1)
        if v_T is not None and v_T1:
            out[T] = (v_T - v_T1) / v_T1
    return out


def _median(xs: list[float]) -> float:
    s = sorted(xs)
    n = len(s)
    m = n // 2
    return s[m] if n % 2 else (s[m - 1] + s[m]) / 2


# ── Axe 1 : recalcul des indicateurs calculés ─────────────────────────────────

def _verifier_recalculs(sv: SecteurValeurs) -> list[Anomalie]:
    anomalies: list[Anomalie] = []
    v = sv.valeurs

    def cmp(code_calc: str, attendus: dict[int, float], soft: bool):
        stockes = v.get(code_calc, {})
        for annee, attendu in attendus.items():
            if annee not in stockes:
                continue
            if not _proche(stockes[annee], attendu):
                anomalies.append(Anomalie(
                    severite="avertissement" if soft else "erreur",
                    categorie="recalcul", indicateur=code_calc,
                    niveau=sv.niveau, cible_id=sv.cible_id, libelle_cible=sv.libelle,
                    annee=annee, valeur=stockes[annee], attendu=attendu,
                    message=(f"Valeur stockée {stockes[annee]:.4f} ≠ recalcul {attendu:.4f}"
                             + (" (lu_ou_calcule, écart toléré)" if soft else "")),
                ))

    # act_tx_ca = taux de croissance du CA
    if "act_ca" in v:
        cmp("act_tx_ca", _taux_croissance(v["act_ca"]), soft=False)
    # act_tx_prod : lu_ou_calcule → la valeur lue prime, contrôle souple
    if "act_production" in v:
        cmp("act_tx_prod", _taux_croissance(v["act_production"]), soft=True)
    # inv_tx_autofin = (CAF / actif immobilisé) * 100
    if "_raw_caf" in v and "inv_actif_immo" in v:
        caf, inv = v["_raw_caf"], v["inv_actif_immo"]
        attendus = {a: caf[a] / inv[a] * 100 for a in set(caf) & set(inv) if inv[a]}
        cmp("inv_tx_autofin", attendus, soft=False)

    return anomalies


# ── Axe 2 : couverture ────────────────────────────────────────────────────────

def _verifier_couverture(
    secteurs: list[SecteurValeurs],
    indicateurs: dict[str, IndicateurInfo],
) -> tuple[list[CouvertureIndic], list[Anomalie]]:
    couverture: list[CouvertureIndic] = []
    anomalies: list[Anomalie] = []
    n_sect = len(secteurs) or 1

    for code, info in indicateurs.items():
        if code.startswith("_raw_") or code in _NON_DISPONIBLES:
            continue
        # années réellement couvertes par cet indicateur (les taux n'ont pas la
        # 1re année → on n'attend pas de valeur là où il n'y en a structurellement)
        annees_indic: set[int] = set()
        present = 0
        for sv in secteurs:
            d = sv.valeurs.get(code, {})
            present += len(d)
            annees_indic.update(d)
        nb_annees = len(annees_indic)
        attendu = n_sect * nb_annees
        taux = present / attendu if attendu else 0.0
        couverture.append(CouvertureIndic(
            code=code, libelle=info.libelle, annees_couvertes=nb_annees,
            nb_present=present, nb_attendu=attendu, taux=round(taux, 4),
        ))
        if attendu == 0:
            anomalies.append(Anomalie(
                severite="erreur", categorie="borne", indicateur=code,
                niveau="*", cible_id=None, libelle_cible="(tous secteurs)",
                annee=None, message="Aucune valeur enregistrée pour cet indicateur "
                                    "— extraction_key probablement erronée.",
            ))
        elif taux < 0.5:
            anomalies.append(Anomalie(
                severite="avertissement", categorie="borne", indicateur=code,
                niveau="*", cible_id=None, libelle_cible="(tous secteurs)",
                annee=None, message=f"Couverture faible : {present}/{attendu} "
                                    f"valeurs ({taux*100:.0f} %).",
            ))

    couverture.sort(key=lambda c: c.taux)
    return couverture, anomalies


# ── Axe 3 : bornes & outliers ─────────────────────────────────────────────────

def _verifier_bornes(secteurs: list[SecteurValeurs]) -> list[Anomalie]:
    anomalies: list[Anomalie] = []
    for sv in secteurs:
        for code, par_annee in sv.valeurs.items():
            for annee, val in par_annee.items():
                if abs(val) > 1e15:
                    anomalies.append(Anomalie(
                        severite="erreur", categorie="borne", indicateur=code,
                        niveau=sv.niveau, cible_id=sv.cible_id, libelle_cible=sv.libelle,
                        annee=annee, valeur=val,
                        message="Valeur démesurée — erreur de parsing probable.",
                    ))
                elif code in _MONTANTS_POSITIFS and val < 0:
                    anomalies.append(Anomalie(
                        severite="erreur", categorie="borne", indicateur=code,
                        niveau=sv.niveau, cible_id=sv.cible_id, libelle_cible=sv.libelle,
                        annee=annee, valeur=val,
                        message="Montant négatif impossible pour cet indicateur.",
                    ))
    return anomalies


def _verifier_outliers(
    secteurs: list[SecteurValeurs],
    indicateurs: dict[str, IndicateurInfo],
    seuil: float = 5.0,
    min_echantillon: int = 8,
) -> list[Anomalie]:
    """Écart robuste à la médiane (MAD) par (indicateur, année), inter-secteurs."""
    anomalies: list[Anomalie] = []
    # regroupe les valeurs par (code, année) avec leur secteur d'origine
    groupes: dict[tuple[str, int], list[tuple[float, SecteurValeurs]]] = {}
    for sv in secteurs:
        for code, par_annee in sv.valeurs.items():
            if code.startswith("_raw_"):
                continue
            for annee, val in par_annee.items():
                groupes.setdefault((code, annee), []).append((val, sv))

    for (code, annee), items in groupes.items():
        if len(items) < min_echantillon:
            continue
        vals = [v for v, _ in items]
        med = _median(vals)
        mad = _median([abs(v - med) for v in vals])
        if mad == 0:
            continue
        sigma = 1.4826 * mad        # estimateur robuste de l'écart-type
        for val, sv in items:
            ecart = abs(val - med) / sigma
            if ecart > seuil:
                anomalies.append(Anomalie(
                    severite="avertissement", categorie="outlier", indicateur=code,
                    niveau=sv.niveau, cible_id=sv.cible_id, libelle_cible=sv.libelle,
                    annee=annee, valeur=val, attendu=med,
                    message=f"Valeur atypique ({ecart:.1f}σ de la médiane "
                            f"{med:.4g} des autres secteurs).",
                ))
    return anomalies


# ── Axe 4 : cohérence métier ──────────────────────────────────────────────────

def _verifier_coherence(secteurs: list[SecteurValeurs]) -> list[Anomalie]:
    anomalies: list[Anomalie] = []
    # marge de 0.5 % pour absorber les arrondis sur des montants agrégés
    def viole(grand: float, petit: float) -> bool:
        return petit > grand * 1.005 and grand > 0

    for sv in secteurs:
        ca  = sv.valeurs.get("act_ca", {})
        va  = sv.valeurs.get("act_va", {})
        ebe = sv.valeurs.get("rent_ebe", {})
        for annee in set(va) & set(ca):
            if viole(ca[annee], va[annee]):
                anomalies.append(Anomalie(
                    severite="avertissement", categorie="coherence", indicateur="act_va",
                    niveau=sv.niveau, cible_id=sv.cible_id, libelle_cible=sv.libelle,
                    annee=annee, valeur=va[annee], attendu=ca[annee],
                    message=f"Valeur ajoutée ({va[annee]:.4g}) > chiffre d'affaires "
                            f"({ca[annee]:.4g}) — colonnes possiblement inversées.",
                ))
        for annee in set(ebe) & set(va):
            if viole(va[annee], ebe[annee]):
                anomalies.append(Anomalie(
                    severite="avertissement", categorie="coherence", indicateur="rent_ebe",
                    niveau=sv.niveau, cible_id=sv.cible_id, libelle_cible=sv.libelle,
                    annee=annee, valeur=ebe[annee], attendu=va[annee],
                    message=f"EBE ({ebe[annee]:.4g}) > valeur ajoutée "
                            f"({va[annee]:.4g}) — incohérence comptable.",
                ))
    return anomalies


# ── Orchestration ─────────────────────────────────────────────────────────────

def verifier(
    secteurs: list[SecteurValeurs],
    indicateurs: dict[str, IndicateurInfo],
) -> RapportVerification:
    """Produit le rapport de vérification complet pour un jeu de secteurs."""
    anomalies: list[Anomalie] = []
    for sv in secteurs:
        anomalies += _verifier_recalculs(sv)
    couverture, anom_couv = _verifier_couverture(secteurs, indicateurs)
    anomalies += anom_couv
    anomalies += _verifier_bornes(secteurs)
    anomalies += _verifier_outliers(secteurs, indicateurs)
    anomalies += _verifier_coherence(secteurs)

    # tri : erreurs d'abord, puis avertissements, puis info
    ordre = {"erreur": 0, "avertissement": 1, "info": 2}
    anomalies.sort(key=lambda a: (ordre.get(a.severite, 9), a.categorie, a.indicateur))

    nb_valeurs = sum(len(d) for sv in secteurs for d in sv.valeurs.values())
    nb_err = sum(1 for a in anomalies if a.severite == "erreur")
    nb_avt = sum(1 for a in anomalies if a.severite == "avertissement")
    # score = part des valeurs sans erreur ponctuelle détectée
    err_ponctuelles = sum(1 for a in anomalies if a.severite == "erreur" and a.annee is not None)
    score = 100.0 if not nb_valeurs else round(100 * (nb_valeurs - err_ponctuelles) / nb_valeurs, 1)

    return RapportVerification(
        nb_secteurs=len(secteurs),
        nb_valeurs=nb_valeurs,
        annees=sorted({a for sv in secteurs for d in sv.valeurs.values() for a in d}),
        couverture=couverture,
        anomalies=anomalies,
        nb_erreurs=nb_err,
        nb_avertissements=nb_avt,
        score=score,
    )
