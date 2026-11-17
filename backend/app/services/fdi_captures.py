"""Verser une capture d'écran de fDi : la lire, la vérifier, l'écrire.

POURQUOI. Mettre le relevé à jour passait par une session de transcription,
un fichier de page dans le dépôt, un commit puis un déploiement — une heure de
détours pour quinze lignes, et la raison pour laquelle les mises à jour
attendaient. L'administration reçoit désormais la capture elle-même.

TROIS TEMPS, ET UN SEUL ÉCRIT :

  lire()      l'API Claude transcrit la capture, VERBATIM : troncatures
              « … », astérisques d'estimation, tirets et « n/a » compris. C'est
              la règle des pages du dépôt, et pour la même raison : le
              rapprochement avec la nomenclature se fait sur le texte brut.

  analyser()  chaque ligne est confrontée à la nomenclature et à ce qui est
              DÉJÀ en base, sans rien écrire. C'est là que se rattrapent les
              lectures fautives : un sous-secteur qui ne commence comme aucun
              poste, une date qui remonte dans une liste triée par date, une
              ligne presque identique à une ligne déjà relevée.

  verser()    les lignes retenues par un humain entrent en base par les MÊMES
              importeurs que les pages du dépôt. Un seul chemin
              d'interprétation, quel que soit le geste qui apporte la donnée.

LA LISTE CAPTURÉE est celle de fDi triée par date, la plus récente en tête :
« Dest = Africa » pour les projets comme pour les signaux. On la descend de la
page 1 jusqu'à la première ligne déjà relevée. Comme dans les pages du dépôt,
une ligne SÉNÉGALAISE n'entre pas dans le relevé Afrique : le Sénégal est
relevé pour lui-même, et ses projets y entrent une seule fois.

« DÉJÀ RELEVÉE » NE PEUT PAS SE DÉCIDER PAR ÉGALITÉ DE TEXTE. fDi coupe à la
largeur de la colonne, et cette largeur dépend de la fenêtre : la même
entreprise s'écrit « Huawei Technologi… » sur une capture et « Huawei
Technolog… » sur une autre. Deux textes dont l'un est tronqué se valent donc
quand l'autre le prolonge — sans quoi chaque capture prise dans une fenêtre
plus étroite doublerait le relevé.
"""
from __future__ import annotations

import base64
import json
import logging
import re
from datetime import date
from typing import TYPE_CHECKING

from app.core.config import get_settings
from app.services import fdi_projets as P
from app.services import fdi_signaux as S

if TYPE_CHECKING:  # pragma: no cover — annotation seule
    from sqlalchemy.ext.asyncio import AsyncSession

journal = logging.getLogger(__name__)

BASES = ("projets", "signaux")

# Les colonnes dans l'ordre de l'écran de fDi — celui des pages du dépôt.
COLONNES = {
    "projets": [c for c in P.COLONNES if c != "ligne"],
    "signaux": [c for c in S.COLONNES if c != "ligne"],
}

# Ce que chaque colonne contient, dit au modèle dans l'ordre de l'écran. Les
# intitulés anglais sont ceux que fDi affiche en tête de colonne.
DESCRIPTIONS = {
    "projets": {
        "date": "Date — mois et année d'annonce, ex. « Oct 2026 »",
        "parent": "Parent company — la société mère",
        "entreprise": "Investing company — l'entreprise qui investit",
        "source": "Source country — pays d'origine",
        "dest": "Destination country — pays de destination",
        "secteur": "Industry sector — secteur",
        "sous_secteur": "Sub-sector — sous-secteur",
        "activite": "Business activity — activité",
        "capex": "Capital investment — montant, ex. « $9.98m » ou « * $122.20m »",
        "emplois": "Jobs created — emplois, ex. « 200 » ou « * 38 »",
        "type": "Project type — « New », « Expansion » ou « Co-location »",
    },
    "signaux": {
        "date": "Date — mois et année, ex. « Sep 2026 »",
        "parent": "Parent company — la société mère",
        "entreprise": "Company — l'entreprise",
        "source": "Source country — pays d'origine",
        "destination": "Destination — pays OU région du monde (« Africa », « Middle East »)",
        "secteur": "Industry sector — secteur",
        "activite": "Business activity — activité, souvent « n/a »",
        "signal": "Signal — la nature du signal, ex. « New Funding/Resour… »",
        "funding": "Funding raised — fonds levés, ex. « $10.00m » ou « - »",
        "capex": "Capital investment — montant prévu, ex. « $5.00m » ou « - »",
    },
}

NOMS = {"projets": "Projects (projets annoncés)", "signaux": "Investor signals (signaux d'investisseur)"}

LIGNES_PAR_PAGE = 15

# Ce que l'API accepte, et ce qu'elle refuse au-delà : cinq méga-octets une
# fois l'image encodée en base64, soit un peu moins de quatre en octets bruts.
MEDIAS = ("image/png", "image/jpeg", "image/webp", "image/gif")
POIDS_MAX = 3_700_000

SYSTEME = """\
Tu transcris des captures d'écran de fDi Markets (Financial Times), la base des \
investissements directs étrangers annoncés dans le monde. Chaque capture montre \
une page de résultats : un tableau, une ligne par projet ou par signal.

Ta transcription alimente une base de données qui la rapproche, au caractère \
près, d'une nomenclature. Elle doit donc être VERBATIM :
- recopie chaque case EXACTEMENT comme elle est affichée ;
- un texte coupé par l'écran se termine par « … » : garde le début tel quel et \
termine par le caractère « … ». Ne complète JAMAIS un mot ou un nom coupé ;
- garde l'astérisque des valeurs estimées, suivi d'une espace : « * $122.20m », \
« * 100 » ;
- garde « - » pour une case vide et « n/a » quand c'est écrit ;
- ne traduis rien, ne corrige aucune faute, ne reformate aucun nombre : \
« $1,250.00m » reste « $1,250.00m », « $1.20bn » reste « $1.20bn » ;
- une case que tu ne peux pas lire avec certitude s'écrit « ? ». Ne devine pas : \
une lecture fausse est bien pire qu'un « ? », qu'un humain corrigera.

Transcris TOUTES les lignes de données entièrement visibles, de haut en bas, \
dans l'ordre de l'écran, sans en sauter, sans en inventer ni en répéter. Ignore \
l'en-tête du tableau, les filtres, la pagination, les menus et les panneaux. \
Une ligne coupée par le bord de la capture n'est pas transcrite : signale-la \
dans « remarque ».

« page_affichee » : le numéro de la page courante si la pagination le montre, \
sinon 0.
« remarque » : une phrase en français si quelque chose a gêné la lecture \
(ligne coupée, image floue, colonnes manquantes, capture qui n'est pas une page \
de résultats fDi), sinon une chaîne vide."""


class LectureImpossible(RuntimeError):
    """L'API n'a pas répondu, ou pas dans la forme attendue."""


class CaptureRefusee(ValueError):
    """Le versement demandé enfreindrait une règle du relevé."""


def actif() -> bool:
    return bool(get_settings().ANTHROPIC_API_KEY)


def modele() -> str:
    s = get_settings()
    return s.FDI_LECTURE_MODELE or s.ASSISTANT_MODELE


def schema(base: str) -> dict:
    cols = COLONNES[base]
    return {
        "type": "object",
        "properties": {
            "lignes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {c: {"type": "string"} for c in cols},
                    "required": cols,
                    "additionalProperties": False,
                },
            },
            "page_affichee": {"type": "integer"},
            "remarque": {"type": "string"},
        },
        "required": ["lignes", "page_affichee", "remarque"],
        "additionalProperties": False,
    }


def consigne(base: str) -> str:
    colonnes = "\n".join(f"{i}. {c} — {DESCRIPTIONS[base][c]}"
                         for i, c in enumerate(COLONNES[base], 1))
    return (f"Cette capture vient de la base {NOMS[base]} de fDi Markets. "
            f"Ses colonnes, de gauche à droite, et la clé à employer pour chacune :\n"
            f"{colonnes}\n\nTranscris la page.")


def _client():
    from anthropic import AsyncAnthropic

    return AsyncAnthropic(api_key=get_settings().ANTHROPIC_API_KEY, timeout=180, max_retries=1)


async def lire(image: bytes, media: str, base: str) -> dict:
    """La page transcrite : {"lignes": [{colonne: texte}], "page_affichee", "remarque"}."""
    if not actif():
        raise LectureImpossible("l'assistant IA n'est pas configuré sur ce serveur (clé API absente)")
    try:
        reponse = await _client().messages.create(
            model=modele(),
            # Quinze lignes de onze cases tiennent en deux mille jetons ; la
            # marge couvre une page plus dense sans jamais couper le JSON.
            max_tokens=8000,
            system=[{"type": "text", "text": SYSTEME, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media,
                                             "data": base64.b64encode(image).decode()}},
                {"type": "text", "text": consigne(base)},
            ]}],
            output_config={"format": {"type": "json_schema", "schema": schema(base)}},
        )
    except Exception as e:  # réseau, clé refusée, image refusée : rien d'écrit
        journal.warning("lecture d'une capture fDi : appel refusé (%s)", e)
        raise LectureImpossible(f"l'API n'a pas répondu ({type(e).__name__})") from e
    if reponse.stop_reason not in ("end_turn", "stop_sequence"):
        raise LectureImpossible(f"lecture interrompue ({reponse.stop_reason})")
    bloc = next((b for b in reponse.content if getattr(b, "type", None) == "text"), None)
    try:
        donnees = json.loads(bloc.text if bloc else "")
    except ValueError as e:
        raise LectureImpossible("réponse illisible") from e
    lignes = [{c: " ".join(str(l.get(c) or "").split()) for c in COLONNES[base]}
              for l in donnees.get("lignes", []) if isinstance(l, dict)]
    page = donnees.get("page_affichee")
    return {"lignes": lignes,
            "page_affichee": page if isinstance(page, int) and page > 0 else None,
            "remarque": " ".join(str(donnees.get("remarque") or "").split()) or None}


# ── Les lots d'une capture ───────────────────────────────────────────────────
#
# « capture du … » et non « relevé du … » : ces lots n'ont pas de fichier dans
# le dépôt, et leur libellé ne doit jamais pouvoir croiser celui d'une série
# versionnée — le libellé est la clé d'idempotence des importeurs.
#
# Les lignes sénégalaises d'une page Afrique vont dans un lot à part, du MÊME
# numéro de page : reverser une page remplace alors ses deux lots ensemble,
# sans jamais doubler le Sénégal.

def libelles(base: str, jour: date, page: int) -> list[str]:
    d = f"{jour:%d/%m/%Y}"
    if base == "projets":
        return [f"Afrique reçoit · capture du {d} · page {page:02d}",
                f"Sénégal reçoit · capture Afrique du {d} · page {page:02d}"]
    return [f"Signaux Afrique · capture du {d} · page {page:02d}"]


async def serie(db: "AsyncSession", base: str, jour: date) -> dict:
    """Les pages déjà versées pour cette date, et la suivante à verser."""
    from sqlalchemy import text

    lots = (await db.execute(text(
        "SELECT libelle, nb_lignes FROM fdi_lots_import "
        " WHERE base = :b AND source = 'capture' AND libelle LIKE :motif"),
        {"b": base, "motif": f"% du {jour:%d/%m/%Y} · page %"})).fetchall()
    pages: dict[int, int] = {}
    for l in lots:
        m = re.search(r"· page (\d+)$", l.libelle)
        if m:
            pages[int(m.group(1))] = pages.get(int(m.group(1)), 0) + (l.nb_lignes or 0)
    return {"pages": [{"page": p, "lignes": n} for p, n in sorted(pages.items())],
            "suivante": max(pages, default=0) + 1}


# ── L'analyse : rien n'est écrit ─────────────────────────────────────────────

def compatibles(a: str | None, b: str | None) -> bool:
    """Deux cases désignent-elles la même chose, troncatures comprises ?

    Égales une fois normalisées, ou l'une tronquée et prolongée par l'autre.
    Deux coupes différentes du même nom — fenêtre plus ou moins large — sont
    ainsi reconnues, et un nom complet reconnaît sa forme coupée.
    """
    na, nb = P.normaliser(a or ""), P.normaliser(b or "")
    if na == nb:
        return True
    return (P.est_tronque(a or "") and nb.startswith(na)) or \
           (P.est_tronque(b or "") and na.startswith(nb))


def _montant(v) -> float | None:
    return None if v is None else round(float(v), 2)


# Les cases texte comparées, et leur colonne en base, par base.
TEXTES = {
    "projets": (("parent", "parent_brut"), ("entreprise", "entreprise_brut"),
                ("source", "pays_source_brut"), ("dest", "pays_dest_brut"),
                ("secteur", "secteur_brut"), ("sous_secteur", "sous_secteur_brut"),
                ("activite", "activite_brut"), ("type", "type_brut")),
    "signaux": (("parent", "parent_brut"), ("entreprise", "entreprise_brut"),
                ("source", "pays_source_brut"), ("destination", "destination"),
                ("secteur", "secteur"), ("activite", "activite"), ("signal", "nature")),
}
NOMBRES = {
    "projets": (("capex", "capex_musd"), ("emplois", "emplois")),
    "signaux": (("funding", "funding_musd"), ("capex", "capex_musd")),
}
DESTINATION = {"projets": "dest", "signaux": "destination"}

LIBELLES = {
    "date": "date", "parent": "société mère", "entreprise": "entreprise", "source": "origine",
    "dest": "destination", "destination": "destination", "secteur": "secteur",
    "sous_secteur": "sous-secteur", "activite": "activité", "type": "type",
    "signal": "signal", "capex": "montant", "funding": "fonds levés", "emplois": "emplois",
}


def ecarts(base: str, lue: dict, connue: dict) -> list[str]:
    """Les colonnes où une ligne lue diffère d'une ligne connue."""
    sortie = [col for col, champ in TEXTES[base]
              if not compatibles(lue["cases"].get(col), connue.get(champ))]
    sortie += [col for col, champ in NOMBRES[base]
               if lue["valeurs"].get(col) != (_montant(connue.get(champ))
                                              if col != "emplois" else connue.get(champ))]
    return sortie


def _lire_valeurs(base: str, cases: dict) -> tuple[dict, list[dict]]:
    """Date et nombres lus ; les cases illisibles sont des problèmes BLOQUANTS."""
    valeurs: dict = {}
    problemes: list[dict] = []
    for col in COLONNES[base]:
        if (cases.get(col) or "").strip() == "?":
            problemes.append({"colonne": col, "bloquant": True,
                              "message": f"{LIBELLES[col].capitalize()} illisible sur la capture."})
    illisibles = {p["colonne"] for p in problemes}
    if "date" not in illisibles:
        try:
            valeurs["annee"], valeurs["mois"] = P.lire_date(cases.get("date") or "")
        except P.LigneInvalide as e:
            problemes.append({"colonne": "date", "bloquant": True, "message": f"Date : {e}."})
    for col, _ in NOMBRES[base]:
        if col in illisibles:
            continue
        lecteur = P.lire_entier if col == "emplois" else P.lire_montant
        try:
            v, _est = lecteur(cases.get(col))
            valeurs[col] = v if col == "emplois" else _montant(v)
        except P.LigneInvalide as e:
            problemes.append({"colonne": col, "bloquant": True,
                              "message": f"{LIBELLES[col].capitalize()} : {e}."})
    return valeurs, problemes


def _rattachements_projet(cases: dict, ref: dict, pays_en: dict) -> tuple[list[dict], int | None]:
    """Ce que la nomenclature ne reconnaît pas (avertissements), et la destination."""
    problemes: list[dict] = []

    def poste(col, candidats, nom):
        brut = cases.get(col) or ""
        if not brut.strip():
            return None
        verdict, retenus = P.rapprocher(brut, candidats)
        if verdict in ("exact", "unique"):
            return retenus[0]["id"]
        problemes.append({"colonne": col, "bloquant": False, "message":
                          f"{nom} « {brut} » : " + ("plusieurs postes commencent ainsi."
                                                    if verdict == "ambigu" else
                                                    "aucun poste ne commence ainsi — mal lu ?")})
        return None

    secteur = poste("secteur", ref["secteurs"], "Secteur")
    if secteur is not None:
        poste("sous_secteur", [s for s in ref["sous"] if s["secteur_id"] == secteur], "Sous-secteur")
    poste("activite", ref["activites"], "Activité")
    poste("type", ref["types"], "Type")
    dest_id = None
    for col, nom in (("source", "Pays d'origine"), ("dest", "Destination")):
        brut = cases.get(col) or ""
        pays, motif = P._pays(brut, pays_en, ref["pays"])
        if motif:
            problemes.append({"colonne": col, "bloquant": False,
                              "message": f"{nom} « {brut} » : {motif}."})
        if col == "dest":
            dest_id = pays
    return problemes, dest_id


def _listes_signal(cases: dict, ref: dict, corr: dict) -> tuple[dict, list[dict]]:
    """Les quatre colonnes multiples rattachées, comme l'importeur les écrirait."""
    problemes: list[dict] = []
    listes: dict[str, list[dict]] = {"destinations": [], "secteurs": [], "activites": [], "natures": []}
    brut = (cases.get("destination") or "").strip()
    if not P._est_vide(brut):
        pays, region, motif = S._destination(brut, ref, corr)
        listes["destinations"].append({"rang": 1, "brut": brut, "pays_id": pays, "region_id": region})
        if motif:
            problemes.append({"colonne": "destination", "bloquant": False,
                              "message": f"Destination « {brut} » : {motif}."})
    for col, famille, cle, candidats, nom in (
            ("secteur", "secteurs", "secteur_id", ref["secteurs"], "Secteur"),
            ("activite", "activites", "activite_id", ref["activites"], "Activité"),
            ("signal", "natures", "nature_id", ref["natures"], "Signal")):
        brut = (cases.get(col) or "").strip()
        if P._est_vide(brut):
            continue
        ident, motif = S._poste(brut, candidats)
        listes[famille].append({"rang": 1, "brut": brut, cle: ident})
        if motif:
            problemes.append({"colonne": col, "bloquant": False,
                              "message": f"{nom} « {brut} » : {motif} — mal lu ?"})
    source = cases.get("source") or ""
    _, motif = P._pays(source, corr, ref["pays"])
    if motif:
        problemes.append({"colonne": "source", "bloquant": False,
                          "message": f"Pays d'origine « {source} » : {motif}."})
    return listes, problemes


def cle_signal(cases: dict, valeurs: dict, listes: dict) -> str:
    """L'identité qu'aura le signal en base — exactement celle de l'importeur."""
    def brut(c):
        return (cases.get(c) or "").strip() or None
    return S.cle_signal(valeurs.get("annee"), valeurs.get("mois"), brut("parent"),
                        brut("entreprise"), brut("source"), valeurs.get("funding"),
                        valeurs.get("capex"), S.signature_releve(listes))


def analyser_lignes(base: str, lignes: list[dict], connues: list[dict], ref: dict,
                    correspondance: dict, identites: dict | None = None,
                    remarque: str | None = None) -> dict:
    """Le verdict de chaque ligne lue, et ce que la page dit dans son ensemble.

    Pure : tout ce qui vient de la base arrive en paramètre. `connues` sont les
    lignes déjà en base des mois que la page couvre ; `identites`, pour les
    signaux, les empreintes déjà en base (empreinte → où elle est).

    Statuts :
      nouvelle   à verser ;
      deja       déjà relevée — on ne la verse jamais, ce serait la doubler ;
      ressemble  presque identique à une ligne relevée (même mois, même
                 destination, même entreprise, une ou deux cases d'écart) :
                 une lecture fautive ou une révision de fDi. Non retenue par
                 défaut — un humain tranche ;
      illisible  une case indispensable ne se lit pas : à corriger d'abord.
    """
    sen_id = ref["pays"].get("SEN")
    consommees: set[int] = set()
    sortie: list[dict] = []
    for l in lignes:
        cases = {c: " ".join(str((l.get("cases") or {}).get(c) or "").split()) for c in COLONNES[base]}
        valeurs, problemes = _lire_valeurs(base, cases)
        senegal = False
        cle = None
        if base == "projets":
            avert, dest_id = _rattachements_projet(cases, ref, correspondance)
            senegal = sen_id is not None and dest_id == sen_id
        else:
            listes, avert = _listes_signal(cases, ref, correspondance)
            if not any(p["bloquant"] for p in problemes):
                cle = cle_signal(cases, valeurs, listes)
        problemes += avert
        lue = {"cases": cases, "valeurs": valeurs}

        statut, trouvee, difference = "nouvelle", None, []
        if any(p["bloquant"] for p in problemes):
            statut = "illisible"
        else:
            meme_mois = [c for c in connues
                         if c["annee"] == valeurs["annee"] and c["mois"] == valeurs["mois"]]
            exacte = next((c for c in meme_mois
                           if c["id"] not in consommees and not ecarts(base, lue, c)), None)
            if exacte is None and cle and identites and cle in identites:
                exacte = identites[cle]
            if exacte is not None:
                statut, trouvee = "deja", exacte
                consommees.add(exacte["id"])
            else:
                dest = DESTINATION[base]
                for c in meme_mois:
                    champ_dest = dict(TEXTES[base])[dest]
                    if not compatibles(cases.get(dest), c.get(champ_dest)):
                        continue
                    if not (compatibles(cases.get("entreprise"), c.get("entreprise_brut"))
                            or compatibles(cases.get("parent"), c.get("parent_brut"))):
                        continue
                    e = ecarts(base, lue, c)
                    if 0 < len(e) <= 2:
                        statut, trouvee, difference = "ressemble", c, e
                        break
        sortie.append({
            "rang": l["rang"],
            "statut": statut,
            "senegal": senegal,
            "tronquee": P.est_tronque(cases.get("entreprise") or ""),
            "problemes": problemes,
            "trouvee": ({"lot": trouvee["lot"], "ligne": trouvee["ligne"]} if trouvee else None),
            "ecarts": [{"colonne": col, "message": _ecart(base, col, cases, trouvee)}
                       for col in difference],
            "inclure": statut == "nouvelle",
        })

    alertes: list[str] = []
    if remarque:
        alertes.append(f"Lecture : {remarque}")
    if not lignes:
        alertes.append("Aucune ligne lue sur cette capture.")
    elif len(lignes) < LIGNES_PAR_PAGE:
        alertes.append(f"{len(lignes)} ligne{'s' if len(lignes) > 1 else ''} au lieu de "
                       f"{LIGNES_PAR_PAGE} : dernière page de la liste, ou capture coupée ?")
    # La liste est triée par date décroissante : une date qui remonte a
    # presque toujours été mal lue.
    precedente = None
    for l, a in zip(lignes, sortie):
        if a["statut"] == "illisible":
            continue
        try:
            d = P.lire_date(l["cases"].get("date") or "")
        except P.LigneInvalide:
            continue
        cle_d = (d[0], d[1] or 0)
        if precedente and cle_d > precedente[0]:
            alertes.append(f"Rang {l['rang']} : « {l['cases'].get('date')} » après "
                           f"« {precedente[1]} » — la liste est triée par date décroissante, "
                           f"une date a peut-être été mal lue.")
        precedente = (cle_d, l["cases"].get("date"))
    deja = [a for a in sortie if a["statut"] == "deja"]
    if sortie and len(deja) == len(sortie):
        alertes.append("Toutes les lignes sont déjà relevées : la mise à jour est complète, "
                       "inutile d'aller plus loin.")
    elif deja:
        premiere = min(a["rang"] for a in deja)
        tardives = [a["rang"] for a in sortie if a["rang"] > premiere and a["statut"] == "nouvelle"]
        if tardives:
            alertes.append(
                f"Rang{'s' if len(tardives) > 1 else ''} {', '.join(map(str, tardives))} : "
                f"nouveau sous une ligne déjà relevée (rang {premiere}). Projet ajouté tard "
                f"par fDi, ou ligne mal lue : à vérifier avant de verser.")

    compte = {k: sum(1 for a in sortie if a["statut"] == k)
              for k in ("nouvelle", "deja", "ressemble", "illisible")}
    compte["senegal"] = sum(1 for a in sortie if a["senegal"] and a["statut"] != "deja")
    return {"lignes": sortie, "alertes": alertes, "compte": compte}


def _ecart(base: str, col: str, cases: dict, connue: dict | None) -> str:
    champ = dict(TEXTES[base] + NOMBRES[base]).get(col)
    en_base = connue.get(champ) if connue and champ else None
    if isinstance(en_base, float) or (en_base is not None and col in ("capex", "funding")):
        en_base = f"{float(en_base):,.2f} M$".replace(",", " ").replace(".", ",")
    return (f"{LIBELLES[col].capitalize()} : « {cases.get(col) or '—'} » ici, "
            f"« {en_base if en_base not in (None, '') else '—'} » en base.")


async def _connues(db: "AsyncSession", base: str, mois: list[int], exclus: list[str]) -> list[dict]:
    from sqlalchemy import text

    if not mois:
        return []
    if base == "projets":
        sql = """
            SELECT p.id, p.ligne, l.libelle AS lot, p.annee, p.mois, p.parent_brut,
                   p.entreprise_brut, p.pays_source_brut, p.pays_dest_brut, p.secteur_brut,
                   p.sous_secteur_brut, p.activite_brut, p.type_brut, p.capex_musd, p.emplois
              FROM fdi_projets p JOIN fdi_lots_import l ON l.id = p.lot_id
             WHERE l.base = 'projets' AND (p.annee * 100 + coalesce(p.mois, 0)) = ANY(:mois)
               AND NOT (l.libelle = ANY(:exclus))
             ORDER BY l.id, p.ligne"""
    else:
        # La valeur visible de chaque colonne multiple : la première du relevé,
        # à défaut la première saisie (un signal créé à la main n'en a pas
        # d'autre).
        def premiere(table, alias):
            return (f"(SELECT x.brut FROM {table} x WHERE x.signal_id = s.id "
                    f"ORDER BY (x.origine <> 'import'), x.rang LIMIT 1) AS {alias}")
        sql = f"""
            SELECT s.id, s.ligne, l.libelle AS lot, s.annee, s.mois, s.parent_brut,
                   s.entreprise_brut, s.pays_source_brut, s.funding_musd, s.capex_musd,
                   {premiere('fdi_signal_destinations', 'destination')},
                   {premiere('fdi_signal_secteurs', 'secteur')},
                   {premiere('fdi_signal_activites', 'activite')},
                   {premiere('fdi_signal_natures', 'nature')}
              FROM fdi_signaux_investisseurs s JOIN fdi_lots_import l ON l.id = s.lot_id
             WHERE (s.annee * 100 + coalesce(s.mois, 0)) = ANY(:mois)
               AND NOT (l.libelle = ANY(:exclus))
             ORDER BY l.id, s.ligne"""
    return [dict(r._mapping) for r in (await db.execute(text(sql),
                                                         {"mois": mois, "exclus": exclus})).fetchall()]


async def analyser(db: "AsyncSession", base: str, lignes: list[dict], jour: date, page: int,
                   remarque: str | None = None) -> dict:
    """L'analyse d'une page lue, pour la page `page` de la capture du `jour`.

    Les lots de CETTE page sont exclus de la comparaison : reverser une page
    pour la corriger ne doit pas trouver ses propres lignes « déjà relevées ».
    """
    from sqlalchemy import text

    ref = await (P._referentiels(db) if base == "projets" else S.referentiels(db))
    correspondance = P.lire_pays_csv()
    mois = set()
    for l in lignes:
        try:
            a, m = P.lire_date((l.get("cases") or {}).get("date") or "")
            mois.add(a * 100 + (m or 0))
        except P.LigneInvalide:
            pass
    exclus = libelles(base, jour, page)
    connues = await _connues(db, base, sorted(mois), exclus)
    identites = None
    if base == "signaux":
        # L'empreinte exacte que l'importeur calculera : une ligne qui la
        # partage avec un signal déjà en base serait DÉPLACÉE dans ce lot, pas
        # ajoutée — on la traite donc comme déjà relevée.
        cles = []
        for l in lignes:
            cases = l.get("cases") or {}
            valeurs, bloquants = _lire_valeurs(base, cases)
            if not any(p["bloquant"] for p in bloquants):
                listes, _ = _listes_signal(cases, ref, correspondance)
                cles.append(cle_signal(cases, valeurs, listes))
        if cles:
            identites = {r.empreinte: {"id": r.id, "lot": r.lot, "ligne": r.ligne}
                         for r in (await db.execute(text(
                             "SELECT s.id, s.empreinte, s.ligne, l.libelle AS lot "
                             "  FROM fdi_signaux_investisseurs s "
                             "  JOIN fdi_lots_import l ON l.id = s.lot_id "
                             " WHERE s.empreinte = ANY(:c) AND NOT (l.libelle = ANY(:x))"),
                             {"c": cles, "x": exclus})).fetchall()}
    return analyser_lignes(base, lignes, connues, ref, correspondance, identites, remarque)


# ── Le versement ─────────────────────────────────────────────────────────────

async def verser(db: "AsyncSession", base: str, jour: date, page: int, lignes: list[dict],
                 utilisateur: str | None) -> dict:
    """Écrit les lignes retenues de la page, par les importeurs du relevé.

    L'analyse est REFAITE ici, sur ce que la base contient à cet instant :
    l'écran a pu vieillir, une autre page a pu être versée entre-temps. Une
    ligne illisible ou déjà relevée est refusée, quoi que l'écran ait coché.
    """
    from sqlalchemy import text

    analyse = await analyser(db, base, lignes, jour, page)
    verdicts = {a["rang"]: a for a in analyse["lignes"]}
    retenues = []
    for l in lignes:
        if not l.get("inclure"):
            continue
        a = verdicts[l["rang"]]
        if a["statut"] == "illisible":
            raise CaptureRefusee(f"Rang {l['rang']} : {a['problemes'][0]['message']} "
                                 "Corriger la case avant de verser.")
        if a["statut"] == "deja":
            raise CaptureRefusee(
                f"Rang {l['rang']} : ligne déjà relevée ({a['trouvee']['lot']}, rang "
                f"{a['trouvee']['ligne']}) — la verser la doublerait.")
        retenues.append((l, a))

    def page_csv(rows):
        return [{"ligne": l["rang"], **{c: " ".join(str((l.get("cases") or {}).get(c) or "").split())
                                         for c in COLONNES[base]}} for l in rows]

    rapport: dict = {"lots": [], "lignes": len(retenues), "a_arbitrer": 0, "non_rattaches": 0}
    if base == "projets":
        afrique = [l for l, a in retenues if not a["senegal"]]
        senegal = [l for l, a in retenues if a["senegal"]]
        lab_afr, lab_sen = libelles(base, jour, page)
        for libelle, perimetre, rows in ((lab_afr, "Afrique", afrique), (lab_sen, "Sénégal", senegal)):
            existe = (await db.execute(text(
                "SELECT id FROM fdi_lots_import WHERE libelle = :l AND base = 'projets'"),
                {"l": libelle})).first()
            if not rows and not existe:
                continue
            r = await P.importer_lot(db, libelle, perimetre, page_csv(rows), utilisateur,
                                     "destination", source="capture")
            if not rows:
                # Reversée sans ligne pour ce lot : il n'a plus de raison d'être.
                await db.execute(text(
                    "DELETE FROM fdi_lots_import l WHERE l.id = :i "
                    "AND NOT EXISTS (SELECT 1 FROM fdi_projets p WHERE p.lot_id = l.id)"),
                    {"i": r["lot_id"]})
            rapport["lots"].append({"libelle": libelle, "lignes": len(rows)})
            rapport["a_arbitrer"] += r["entreprises_a_arbitrer"]
            rapport["non_rattaches"] += len(r["non_resolus"])
    else:
        (libelle,) = libelles(base, jour, page)
        existe = (await db.execute(text(
            "SELECT id FROM fdi_lots_import WHERE libelle = :l AND base = 'signaux'"),
            {"l": libelle})).first()
        rows = [l for l, _ in retenues]
        if rows or existe:
            r = await S.importer_lot(db, libelle, "Dest = Afrique", "destination", page_csv(rows),
                                     await S.referentiels(db), P.lire_pays_csv(), utilisateur,
                                     source="capture")
            # Reversée : ce que la page ne porte plus était une lecture
            # fautive. Les lignes écrites à l'instant portent l'heure de
            # cette transaction ; les autres, plus anciennes, partent.
            await db.execute(text(
                "DELETE FROM fdi_signaux_investisseurs "
                " WHERE lot_id = :i AND coalesce(modifie_le, '-infinity') < now()"),
                {"i": r["lot_id"]})
            await db.execute(text(
                "UPDATE fdi_lots_import SET nb_lignes = "
                "  (SELECT count(*) FROM fdi_signaux_investisseurs WHERE lot_id = :i) WHERE id = :i"),
                {"i": r["lot_id"]})
            if not rows:
                await db.execute(text(
                    "DELETE FROM fdi_lots_import l WHERE l.id = :i "
                    "AND NOT EXISTS (SELECT 1 FROM fdi_signaux_investisseurs s WHERE s.lot_id = l.id)"),
                    {"i": r["lot_id"]})
            rapport["lots"].append({"libelle": libelle, "lignes": len(rows)})
            rapport["non_rattaches"] += len(r["manques"])
            rapport["a_arbitrer"] += (await db.execute(text(
                "SELECT count(*) FROM fdi_signaux_investisseurs "
                " WHERE lot_id = :i AND statut_entreprise <> 'resolu'"),
                {"i": r["lot_id"]})).scalar_one()
    await db.commit()
    return rapport
