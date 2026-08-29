"""Ingestion des projets fDi Markets : résolution des libellés, puis écriture.

La source affiche ses libellés TRONQUÉS côté serveur — « Clothing & clothing
acc… », « Banque de dévelo… ». Ce module fait donc deux choses distinctes, et
il importe de ne pas les confondre :

  * `resoudre_ligne()` **interprète** un libellé tronqué en le rapprochant de la
    nomenclature. L'interprétation réussit ou échoue, mais elle ne devine
    jamais : deux candidats possibles, et la ligne repart sans rattachement,
    avec son texte brut, pour arbitrage humain.

  * `importer_lot()` **écrit**, en remplaçant le lot entier. Aucun rapprochement
    ligne à ligne avec l'existant : sans identifiant de projet chez fDi, deux
    lignes jumelles ne se distinguent que par leur description, saisie plus
    tard. Fusionner à l'import détruirait des projets réels.

Le texte brut est conservé partout, à côté de chaque identifiant : c'est ce qui
rend l'interprétation rejouable, et une erreur détectable.
"""
from __future__ import annotations

import re
import unicodedata
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover — annotation seule
    from sqlalchemy.ext.asyncio import AsyncSession


class LigneInvalide(ValueError):
    """La ligne ne porte pas le minimum exigé pour être écrite."""


# Les points de suspension que les interfaces emploient pour couper un libellé,
# dans leurs deux graphies — le caractère unique et les trois points.
FIN_TRONQUEE = re.compile(r"\s*(?:…|\.\.\.)\s*$")


def est_tronque(v: str) -> bool:
    return bool(FIN_TRONQUEE.search(v or ""))


def normaliser(v: str) -> str:
    """Minuscules, sans accent, sans ponctuation, espaces réduits.

    C'est la forme sur laquelle on compare : elle absorbe « Coal, oil & gas »
    contre « coal oil and gas », et surtout la ponctuation que la troncature
    coupe au milieu d'un mot.
    """
    txt = unicodedata.normalize("NFKD", v or "").encode("ascii", "ignore").decode()
    txt = txt.lower().replace("&", " and ")
    txt = FIN_TRONQUEE.sub("", txt)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", txt)).strip()


def rapprocher(brut: str, candidats: list[dict], champ: str = "libelle_en") -> tuple[str, list[dict]]:
    """Rapproche un libellé, éventuellement tronqué, d'une liste de candidats.

    Renvoie (verdict, candidats retenus) où verdict vaut :
      exact   le libellé complet correspond ;
      unique  le libellé est tronqué mais un seul candidat commence ainsi ;
      ambigu  plusieurs candidats commencent ainsi — on ne tranche pas ;
      aucun   rien ne correspond, la source a peut-être changé.
    """
    if not brut or not brut.strip():
        return "aucun", []
    cle = normaliser(brut)
    exacts = [c for c in candidats if normaliser(c[champ]) == cle]
    if exacts:
        return "exact", exacts[:1]
    prefixes = [c for c in candidats if normaliser(c[champ]).startswith(cle)]
    if len(prefixes) == 1:
        return "unique", prefixes
    return ("ambigu", prefixes) if prefixes else ("aucun", [])


# ── Montants ─────────────────────────────────────────────────────────────────
MONTANT = re.compile(r"^\s*(\*)?\s*\$?\s*([\d\s.,]+)\s*(m|bn|k)?\s*$", re.I)
ECHELLE = {"k": 0.001, "m": 1.0, "bn": 1000.0, None: 1.0, "": 1.0}


def lire_montant(brut: str | None) -> tuple[float | None, bool | None]:
    """« * $9.60m » → (9.60, True). Le montant en MILLIONS, et l'estimation.

    L'astérisque marque les valeurs calculées par l'algorithme du Financial
    Times. Le drapeau reste nul quand la valeur l'est : « estimé » ne veut rien
    dire sans montant.
    """
    if brut is None or not str(brut).strip() or str(brut).strip() in {"-", "—", "n/a"}:
        return None, None
    m = MONTANT.match(str(brut))
    if not m:
        raise LigneInvalide(f"montant illisible : « {brut} »")
    estime = m.group(1) is not None
    nombre = m.group(2).replace(" ", "").replace(",", "")
    return round(float(nombre) * ECHELLE.get((m.group(3) or "").lower(), 1.0), 2), estime


def lire_entier(brut: str | None) -> tuple[int | None, bool | None]:
    """« * 415 » → (415, True). Même règle d'astérisque que les montants."""
    if brut is None or not str(brut).strip() or str(brut).strip() in {"-", "—", "n/a"}:
        return None, None
    txt = str(brut).strip()
    estime = txt.startswith("*")
    chiffres = re.sub(r"[^\d]", "", txt)
    if not chiffres:
        raise LigneInvalide(f"effectif illisible : « {brut} »")
    return int(chiffres), estime


MOIS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def lire_date(brut: str) -> tuple[int, int | None]:
    """« Jun 2026 » → (2026, 6). La source ne donne que le mois, jamais le jour."""
    txt = (brut or "").strip()
    an = re.search(r"(19|20)\d{2}", txt)
    if not an:
        raise LigneInvalide(f"date sans année : « {brut} »")
    mois = None
    for nom, num in MOIS.items():
        if nom in txt.lower():
            mois = num
            break
    return int(an.group(0)), mois
