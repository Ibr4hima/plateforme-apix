"""
Cœur de décision de l'import BDEF — PUR, sans dépendance à la base.

À partir des blocs parsés, des métadonnées d'indicateurs, des candidats et des
alias, décide secteur par secteur :
  - match certain  → à écrire dans bdef_valeurs
  - incertain      → mis en revue

Import BLOQUANT (décision produit) : `DecisionImport.bloque` est vrai dès qu'un
secteur est en revue ; la couche BD (bdef_import.py) n'écrit alors aucune valeur.

Isolé de bdef_import.py pour rester testable sans SQLAlchemy ni fichier.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.bdef_mapping import resoudre_indicateurs, IndicateurMeta, ValeursSecteur
from app.utils.bdef_matching import matcher_secteur, NIVEAU_GLOBAL


@dataclass
class SecteurMatche:
    code: str
    niveau: str
    libelle_brut: str
    cible_id: int | None         # None pour le niveau global
    valeurs: ValeursSecteur


@dataclass
class SecteurEnRevue:
    code: str
    niveau: str
    libelle_brut: str
    score: float | None
    candidats: list[dict]        # [{cible_id, libelle, score}]


@dataclass
class DecisionImport:
    matches: list[SecteurMatche] = field(default_factory=list)
    revue: list[SecteurEnRevue] = field(default_factory=list)
    annees: list[int] = field(default_factory=list)

    @property
    def bloque(self) -> bool:
        return len(self.revue) > 0


def decider_import(
    groupes: dict[tuple[str, str | None], list],
    indicateurs: list[IndicateurMeta],
    candidats_par_niveau: dict[str, list[dict]],
    alias_par_niveau: dict[str, dict[str, int]],
) -> DecisionImport:
    """
    Décide, secteur par secteur, entre match certain et mise en revue.

    `groupes`              : {(code, niveau): [BlocTableau]} (cf. grouper_par_secteur)
    `indicateurs`          : métadonnées des indicateurs
    `candidats_par_niveau` : {niveau: [{"id","libelle","code"}]}
    `alias_par_niveau`     : {niveau: {libelle_brut: cible_id}}
    """
    decision = DecisionImport()
    annees: set[int] = set()

    for (code, niveau), blocs in sorted(
        groupes.items(), key=lambda kv: (kv[0][1] or "", kv[0][0])
    ):
        vs = resoudre_indicateurs(blocs, indicateurs)
        for b in blocs:
            annees.update(b.annees)

        # Niveau global : pas de matching, cible = None
        if niveau == NIVEAU_GLOBAL:
            decision.matches.append(SecteurMatche(code, niveau, vs.libelle_brut, None, vs))
            continue

        candidats = candidats_par_niveau.get(niveau, [])
        alias = alias_par_niveau.get(niveau, {})
        res = matcher_secteur(vs.libelle_brut, candidats, alias)

        if res.confiance == "certain" and res.secteur_id is not None:
            decision.matches.append(
                SecteurMatche(code, niveau, vs.libelle_brut, res.secteur_id, vs)
            )
        else:
            decision.revue.append(SecteurEnRevue(
                code=code, niveau=niveau, libelle_brut=vs.libelle_brut,
                score=res.score,
                candidats=[
                    {"cible_id": c.secteur_id, "libelle": c.libelle_raw, "score": round(c.score, 1)}
                    for c in res.candidats
                ],
            ))

    decision.annees = sorted(annees)
    return decision
