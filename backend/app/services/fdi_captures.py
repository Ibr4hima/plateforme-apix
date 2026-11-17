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
from app.services.fdi_projets import FIN_TRONQUEE as FIN_TRONQUEE_RE
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


def _supprimee(base: str, lue: dict, cle: str | None, supprimees: list[dict] | None) -> dict | None:
    """La trace d'une ligne supprimée à la main que cette ligne lue reproduit :
    un signal par son empreinte, un projet par ses cases — les mêmes, à
    troncature près, et le même mois."""
    for s in supprimees or []:
        if base == "signaux":
            if cle and s.get("empreinte") == cle:
                return s
        elif (s.get("annee") == lue["valeurs"].get("annee") and s.get("mois") == lue["valeurs"].get("mois")
              and not ecarts(base, lue, s)):
            return s
    return None


def analyser_lignes(base: str, lignes: list[dict], connues: list[dict], ref: dict,
                    correspondance: dict, identites: dict | None = None,
                    remarque: str | None = None, afrique: dict | None = None,
                    supprimees: list[dict] | None = None) -> dict:
    """Le verdict de chaque ligne lue, et ce que la page dit dans son ensemble.

    Pure : tout ce qui vient de la base arrive en paramètre. `connues` sont les
    lignes déjà en base des mois que la page couvre ; `identites`, pour les
    signaux, les empreintes déjà en base (empreinte → où elle est) ;
    `supprimees`, les traces des lignes supprimées à la main (migration 160).

    Statuts :
      nouvelle   à verser ;
      deja       déjà relevée — on ne la verse jamais, ce serait la doubler ;
      ressemble  presque identique à une ligne relevée (même mois, même
                 destination, même entreprise, une ou deux cases d'écart) :
                 une lecture fautive ou une révision de fDi. Non retenue par
                 défaut — un humain tranche ;
      illisible  une case indispensable ne se lit pas : à corriger d'abord ;
      supprimee  la ligne a été supprimée à la main dans l'administration.
                 Non retenue par défaut ; la cocher la RÉTABLIT telle qu'elle
                 était — elle n'est pas versée une seconde fois.
    """
    sen_id = ref["pays"].get("SEN")
    consommees: set[int] = set()
    sortie: list[dict] = []
    for l in lignes:
        cases = {c: " ".join(str((l.get("cases") or {}).get(c) or "").split()) for c in COLONNES[base]}
        valeurs, problemes = _lire_valeurs(base, cases)
        senegal = False
        destination_afrique = None
        cle = None
        if base == "projets":
            avert, dest_id = _rattachements_projet(cases, ref, correspondance)
            senegal = sen_id is not None and dest_id == sen_id
        else:
            listes, avert = _listes_signal(cases, ref, correspondance)
            # La destination que fDi a laissée visible est-elle africaine ? La
            # liste « Dest = Africa » garantit qu'au moins une l'est : si ce
            # n'est pas celle-ci, l'africaine est cachée derrière le bouton.
            if afrique is not None:
                destination_afrique = any(
                    d.get("pays_id") in afrique["pays"] or d.get("region_id") in afrique["regions"]
                    for d in listes["destinations"])
            if not any(p["bloquant"] for p in problemes):
                cle = cle_signal(cases, valeurs, listes)
        problemes += avert
        lue = {"cases": cases, "valeurs": valeurs}

        statut, trouvee, difference, trace = "nouvelle", None, [], None
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
            elif (trace := _supprimee(base, lue, cle, supprimees)) is not None:
                statut = "supprimee"
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
            "trouvee": ({"id": trouvee["id"], "lot": trouvee["lot"], "ligne": trouvee["ligne"]}
                        if trouvee else None),
            "destination_afrique": destination_afrique,
            "ecarts": [{"colonne": col, "message": _ecart(base, col, cases, trouvee)}
                       for col in difference],
            "supprimee": ({"id": trace.get("id"), "le": trace.get("le"), "par": trace.get("par")}
                          if trace else None),
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
    # Une ligne supprimée à la main est connue elle aussi : elle compte comme
    # relevée pour juger que la mise à jour est complète.
    deja = [a for a in sortie if a["statut"] in ("deja", "supprimee")]
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
              for k in ("nouvelle", "deja", "ressemble", "illisible", "supprimee")}
    compte["senegal"] = sum(1 for a in sortie if a["senegal"] and a["statut"] not in ("deja", "supprimee"))
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


async def _supprimees(db: "AsyncSession", base: str, mois: list[int], lignes: list[dict],
                      ref: dict, correspondance: dict) -> list[dict]:
    """Les traces des lignes supprimées à la main que cette page pourrait
    reproduire : les projets des mois qu'elle couvre, les signaux dont elle
    porte l'empreinte. Celles de la page elle-même comprises — reverser une
    page ne doit pas ramener ce qu'on en a supprimé."""
    from sqlalchemy import text

    def jour(v) -> str | None:
        return v.strftime("%d/%m/%Y") if v else None

    if base == "signaux":
        from app.services.fdi_suppressions import signaux_supprimes
        cles = []
        for l in lignes:
            cases = l.get("cases") or {}
            valeurs, bloquants = _lire_valeurs(base, cases)
            if not any(p["bloquant"] for p in bloquants):
                listes, _ = _listes_signal(cases, ref, correspondance)
                cles.append(cle_signal(cases, valeurs, listes))
        return [{"id": t["id"], "empreinte": e, "le": jour(t["le"]), "par": t["par"]}
                for e, t in (await signaux_supprimes(db, cles)).items()]
    if not mois:
        return []
    return [{**{k: r.donnees["ligne"].get(k) for k in
                ("annee", "mois", "parent_brut", "entreprise_brut", "pays_source_brut",
                 "pays_dest_brut", "secteur_brut", "sous_secteur_brut", "activite_brut",
                 "type_brut", "capex_musd", "emplois")},
             "id": r.id, "le": jour(r.supprime_le), "par": r.supprime_par}
            for r in (await db.execute(text(
                "SELECT id, donnees, supprime_le, supprime_par FROM fdi_lignes_supprimees "
                " WHERE base = 'projets' AND origine = 'import' "
                "   AND (annee * 100 + coalesce(mois, 0)) = ANY(:m)"), {"m": mois})).fetchall()]


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
    supprimees = await _supprimees(db, base, sorted(mois), lignes, ref, correspondance)
    afrique = await pays_africains(db) if base == "signaux" else None
    resultat = analyser_lignes(base, lignes, connues, ref, correspondance, identites, remarque,
                               afrique, supprimees)
    if afrique is not None:
        # L'écran en a besoin pour juger les destinations qu'on y ajoute.
        resultat["afrique"] = {"pays": sorted(afrique["pays"]), "regions": sorted(afrique["regions"])}
        # Un signal déjà relevé peut avoir reçu ses destinations cachées depuis
        # (à la main, ou par une capture précédente) : l'écran les montre, et
        # ne le signale à compléter que s'il ne vise toujours pas l'Afrique.
        ids = [a["trouvee"]["id"] for a in resultat["lignes"] if a["statut"] == "deja"]
        en_base = {r.id: r for r in (await db.execute(text(f"""
            SELECT s.id,
                   array_remove(array_agg(coalesce(p.nom_fr, rg.libelle_fr, d.brut) ORDER BY d.rang), NULL)
                       AS destinations,
                   {VISE_AFRIQUE} AS vise_afrique
              FROM fdi_signaux_investisseurs s
              LEFT JOIN fdi_signal_destinations d ON d.signal_id = s.id
              LEFT JOIN ref_pays p ON p.id = d.pays_id
              LEFT JOIN fdi_regions_monde rg ON rg.id = d.region_id
             WHERE s.id = ANY(:ids)
             GROUP BY s.id
        """), {"ids": ids})).fetchall()} if ids else {}
        for a in resultat["lignes"]:
            if a["statut"] == "deja" and a["trouvee"]["id"] in en_base:
                r_ = en_base[a["trouvee"]["id"]]
                a["en_base"] = {"destinations": list(r_.destinations or []),
                                "vise_afrique": bool(r_.vise_afrique)}

    # Pour chaque nom tronqué de la page, les noms complets qui le prolongent
    # et que la plateforme connaît déjà — entreprises au nom complet, et
    # propositions faites pour l'arbitrage. L'écran les offre d'un clic ; rien
    # n'est appliqué sans geste.
    cles: dict[int, dict[str, str]] = {}
    for l in lignes:
        for col in COLONNES_NOMS:
            v = " ".join(str((l.get("cases") or {}).get(col) or "").split())
            if P.est_tronque(v) and P.normaliser(v):
                cles.setdefault(l["rang"], {})[col] = P.normaliser(v)
    connus = await noms_connus(db, sorted({c for d in cles.values() for c in d.values()}))
    for a in resultat["lignes"]:
        a["connus"] = {col: connus[cle] for col, cle in cles.get(a["rang"], {}).items()
                       if connus.get(cle)}
    return resultat


# Les deux colonnes qu'un humain peut compléter à la place de l'arbitrage.
COLONNES_NOMS = ("parent", "entreprise")

# Ce qui fait qu'un signal « vise l'Afrique » — la règle de la vue des signaux
# (routes/fdi_signaux.py), reprise mot pour mot : un pays du continent, ou la
# région « Africa » de fDi.
VISE_AFRIQUE = """
    EXISTS (SELECT 1 FROM fdi_signal_destinations d2
              LEFT JOIN ref_pays p2 ON p2.id = d2.pays_id
              LEFT JOIN fdi_regions_monde r2 ON r2.id = d2.region_id
             WHERE d2.signal_id = s.id
               AND (p2.continent = 'Afrique' OR r2.libelle_en = 'Africa'))
"""


async def pays_africains(db: "AsyncSession") -> dict[str, set[int]]:
    from sqlalchemy import text

    return {
        "pays": {r.id for r in (await db.execute(text(
            "SELECT id FROM ref_pays WHERE continent = 'Afrique'"))).fetchall()},
        "regions": {r.id for r in (await db.execute(text(
            "SELECT id FROM fdi_regions_monde WHERE libelle_en = 'Africa'"))).fetchall()},
    }


def destinations_ajoutees(lignes: list[dict]) -> dict[int, list[dict]]:
    """{rang : [{pays_id | region_id}]} — les destinations ajoutées à l'écran.

    Une destination est un pays OU une région du monde, jamais les deux ni
    aucun ; une valeur répétée ne compte qu'une fois.
    """
    sortie: dict[int, list[dict]] = {}
    for l in lignes:
        vues = set()
        for d in l.get("destinations") or []:
            pays, region = d.get("pays_id"), d.get("region_id")
            if (pays is None) == (region is None):
                raise CaptureRefusee(f"Rang {l['rang']} : une destination est un pays OU une région du monde.")
            cle = ("p", pays) if pays is not None else ("r", region)
            if cle not in vues:
                vues.add(cle)
                sortie.setdefault(l["rang"], []).append({"pays_id": pays, "region_id": region})
    return sortie


async def _ajouter_destinations(db: "AsyncSession", signal_id: int, valeurs: list[dict],
                                utilisateur: str | None) -> int:
    """Ajoute à un signal les destinations que fDi cachait. Rend le nombre ajouté.

    Comme l'ajout à la main de la vue des signaux : rangs suivants, origine
    « saisie » — le réimport du relevé les laisse en place — et un doublon est
    ignoré plutôt que refusé.
    """
    from sqlalchemy import text

    rang = (await db.execute(text(
        "SELECT coalesce(max(rang), 0) FROM fdi_signal_destinations WHERE signal_id = :s"),
        {"s": signal_id})).scalar_one()
    ajoutees = 0
    for v in valeurs:
        if (await db.execute(text(
                "SELECT 1 FROM fdi_signal_destinations WHERE signal_id = :s "
                "   AND pays_id IS NOT DISTINCT FROM :p AND region_id IS NOT DISTINCT FROM :r"),
                {"s": signal_id, "p": v["pays_id"], "r": v["region_id"]})).first():
            continue
        rang += 1
        await db.execute(text(
            "INSERT INTO fdi_signal_destinations (signal_id, rang, brut, pays_id, region_id, origine) "
            "VALUES (:s, :rang, NULL, :p, :r, 'saisie')"),
            {"s": signal_id, "rang": rang, "p": v["pays_id"], "r": v["region_id"]})
        ajoutees += 1
    if ajoutees:
        await db.execute(text(
            "UPDATE fdi_signaux_investisseurs SET modifie_le = now(), modifie_par = :u WHERE id = :i"),
            {"u": utilisateur, "i": signal_id})
    return ajoutees


async def noms_connus(db: "AsyncSession", cles: list[str]) -> dict[str, list[dict]]:
    """{clé normalisée : [{nom, origine, confiance}]} — au plus quatre par clé.

    D'abord les entreprises déjà connues sous un nom complet qui prolonge le
    texte coupé : ce sont des faits de la base. Puis la proposition faite pour
    l'arbitrage, si ce texte y est déjà passé.
    """
    from sqlalchemy import text

    sortie: dict[str, list[dict]] = {}
    if not cles:
        return sortie
    for r in (await db.execute(text("""
        SELECT c.cle, e.nom
        FROM unnest(CAST(:cles AS text[])) AS c(cle)
        JOIN LATERAL (
            SELECT nom FROM fdi_entreprises
             WHERE statut_nom = 'complet'
               AND nom_normalise >= c.cle AND nom_normalise < c.cle || chr(1114111)
               AND starts_with(nom_normalise, c.cle)
             ORDER BY nom LIMIT 4
        ) e ON true
    """), {"cles": cles})).fetchall():
        sortie.setdefault(r.cle, []).append({"nom": r.nom, "origine": "connu", "confiance": None})
    for r in (await db.execute(text(
            "SELECT alias_normalise AS cle, nom, confiance FROM fdi_propositions_noms "
            " WHERE alias_normalise = ANY(:cles) AND nom IS NOT NULL"), {"cles": cles})).fetchall():
        liste = sortie.setdefault(r.cle, [])
        if r.nom not in {x["nom"] for x in liste} and len(liste) < 4:
            liste.append({"nom": r.nom, "origine": "proposition", "confiance": r.confiance})
    return sortie


def accepter_nom(brut: str, nom: str) -> str | None:
    """Le nom qu'un humain donne à un texte coupé, s'il lui correspond.

    Il peut PROLONGER le texte affiché (« Huawei Technologi… » → « Huawei
    Technologies »), l'ÉGALER, ou le RACCOURCIR : sur « Aya Gold & Silver (… »,
    on peut juger que la partie utile est « Aya Gold & Silver » et laisser
    tomber la parenthèse entamée. Il ne peut pas en DIFFÉRER : un autre début,
    c'est une autre entreprise — ou une lecture fausse, qui se corrige dans la
    case elle-même. Il ne peut pas non plus être coupé lui-même.
    """
    nom = " ".join(str(nom or "").split())
    if not nom or P.est_tronque(nom):
        return None
    p, n = P.normaliser(brut), P.normaliser(nom)
    if len(n) < 2 or not (n.startswith(p) or p.startswith(n)):
        return None
    return nom


def noms_completes(lignes: list[dict]) -> dict[str, str]:
    """{texte coupé : nom complet} — les décisions de la page, vérifiées.

    La décision porte sur le TEXTE, pas sur la case : un même nom coupé revient
    sur plusieurs lignes, et en société mère comme en entreprise. Deux noms
    différents pour un même texte, sur une même page, sont refusés : il faut
    choisir.
    """
    sortie: dict[str, str] = {}
    for l in lignes:
        for col, nom in (l.get("noms") or {}).items():
            if col not in COLONNES_NOMS or not " ".join(str(nom or "").split()):
                continue
            brut = " ".join(str((l.get("cases") or {}).get(col) or "").split())
            if not P.est_tronque(brut):
                raise CaptureRefusee(f"Rang {l['rang']} : « {brut} » n'est pas tronqué, "
                                     "il n'y a rien à compléter.")
            complet = accepter_nom(brut, nom)
            if not complet:
                raise CaptureRefusee(f"Rang {l['rang']} : « {nom} » ne correspond pas à « {brut} » "
                                     "tel que fDi l'affiche — corriger la case si c'est la "
                                     "lecture qui est fausse.")
            if brut in sortie and P.normaliser(sortie[brut]) != P.normaliser(complet):
                raise CaptureRefusee(f"« {brut} » a reçu deux noms sur cette page : "
                                     f"« {sortie[brut]} » et « {complet} ».")
            sortie[brut] = complet
    return sortie


def meme_texte(brut_ligne: str | None, brut_capture: str, nom: str) -> bool:
    """Une ligne en base porte-t-elle le même nom coupé que la capture ?

    fDi coupe à la largeur de la colonne, et la largeur change d'une fenêtre à
    l'autre : « ATOMIC (ATOMIC … » dans le relevé, « ATOMIC (ATOMIC Li… » dans
    une capture plus large. Deux textes coupés désignent donc le même nom quand
    l'un commence comme l'autre — et que le plus court en garde au moins les
    trois quarts : « ATOMIC… », coupé bien plus tôt, pourrait être n'importe
    quelle entreprise qui commence ainsi, et l'on ne décide pas pour elle. Le
    nom choisi doit enfin correspondre au texte de la ligne elle-même.
    """
    if not P.est_tronque(brut_ligne or ""):
        return False
    a, b, n = P.normaliser(brut_ligne or ""), P.normaliser(brut_capture), P.normaliser(nom)
    if not a or not b:
        return False
    court, long_ = sorted((a, b), key=len)
    if not long_.startswith(court) or len(court) < 0.75 * len(long_):
        return False
    # Le plus long ajoute-t-il un MOT au plus court ? « Standard Chartered Ke… »
    # ajoute « Ke » à « Standard Chartere… » : il précise, il peut désigner une
    # autre entreprise (la filiale kényane). Le nom choisi ne doit alors rien
    # devoir à ce mot en plus — « ATOMIC » vaut pour « ATOMIC (ATOMIC … » comme
    # pour « ATOMIC (ATOMIC Li… », « Standard Chartered Kenya » non. Une coupe
    # dans le même mot (« Technolog… », « Technologi… ») ne précise rien.
    if " " in long_[len(court):]:
        return court.startswith(n)
    return n.startswith(a) or a.startswith(n)


async def entreprise_nommee(db: "AsyncSession", nom: str, utilisateur: str | None) -> tuple[int, str | None]:
    """L'entreprise de ce nom, retrouvée par sa clef normalisée ou créée.

    LE LIBELLÉ TAPÉ L'EMPORTE. Deux cas où l'on se rattachait à une entreprise
    existante sans toucher à son libellé, et où la correction semblait perdue :

      · garder la partie visible d'un nom coupé — « Continental Reins » pour
        « Continental Reins… » : sa clef est celle de l'entreprise au nom coupé
        que l'import avait créée, et les lignes y retournaient… avec leurs
        points de suspension. Elle prend le nom tapé, et devient complète ;

      · corriger une graphie — « Nestlé » contre « Nestle » : même clef, même
        entreprise, mais l'écran affichait toujours l'ancienne.

    Ce n'est jamais un changement d'identité : la clef est la même des deux
    côtés. Rend aussi l'ancienne graphie quand une entreprise DÉJÀ CONNUE sous
    un nom complet vient d'être renommée — un fait qui dépasse la ligne
    corrigée, à dire à l'écran. Un nom coupé qui prend son nom complet n'est
    pas une entreprise « déjà connue » : rien à signaler.
    """
    from sqlalchemy import text

    cle = P.normaliser(nom)
    r = (await db.execute(text(
        "SELECT id, nom, statut_nom FROM fdi_entreprises WHERE nom_normalise = :c"),
        {"c": cle})).first()
    if not r:
        return (await db.execute(text(
            "INSERT INTO fdi_entreprises (nom, nom_normalise, statut_nom, modifie_le, modifie_par) "
            "VALUES (:n, :c, 'complet', now(), :u) RETURNING id"),
            {"n": nom, "c": cle, "u": utilisateur})).scalar_one(), None
    if r.nom == nom and r.statut_nom == "complet":
        return r.id, None
    await db.execute(text(
        "UPDATE fdi_entreprises SET nom = :n, statut_nom = 'complet', "
        "       modifie_le = now(), modifie_par = :u WHERE id = :i"),
        {"n": nom, "u": utilisateur, "i": r.id})
    return r.id, (r.nom if r.statut_nom == "complet" else None)


async def appliquer_nom(db: "AsyncSession", brut: str, nom: str,
                        utilisateur: str | None) -> tuple[int, str | None]:
    """Donne ce nom à toutes les lignes qui portent ce texte coupé. Rend le
    nombre de lignes touchées, en entreprise comme en société mère, et
    l'ancienne graphie d'une entreprise connue renommée (cf. `entreprise_nommee`).

    PARTOUT, ET PAS SEULEMENT SUR LA LIGNE VERSÉE. Corriger « Aya Gold & Silver
    (… » laissait les cinq autres projets de l'entreprise sous leurs points de
    suspension. Le nom vaut donc pour toutes les lignes — projets et signaux,
    entreprise et société mère — dont le texte, une fois normalisé, est celui-ci
    le même nom coupé (cf. `meme_texte`) : deux captures prises dans des
    fenêtres différentes coupent « ATOMIC (ATOMIC Li… » et « ATOMIC (ATOMIC … »,
    c'est la même entreprise.

    MAIS SEULEMENT CE QUI ATTEND ENCORE SON NOM. Une entreprise déjà tranchée
    (statut « résolu ») ou une société mère déjà rattachée à un nom complet ne
    bouge pas : un texte coupé peut recouvrir deux entreprises, et une décision
    prise à la main ne se défait pas en silence. Les lignes rejoignent
    l'entreprise au nom complet, retrouvée ou créée (cf. `entreprise_nommee`).

    Le texte coupé est mémorisé comme alias : l'arbitrage et les captures
    suivantes le proposeront d'emblée.
    """
    from sqlalchemy import text

    # LES LIGNES VISÉES SE LISENT AVANT DE NOMMER L'ENTREPRISE. Garder la partie
    # visible rend complète l'entreprise au nom coupé que ces lignes désignent
    # déjà : lues après, leurs sociétés mères ne se reconnaîtraient plus comme
    # « en attente » et le compte rendu annoncerait zéro ligne.
    # Un premier tri par le premier mot, sur l'index de la base ; la décision
    # fine se prend ici, avec la normalisation de tout le relevé.
    debut = FIN_TRONQUEE_RE.sub("", brut)
    premier = (debut.split() or [""])[0].replace("\\", "").replace("%", "").replace("_", "")
    motif = f"{premier}%"
    visees = {}
    for table in ("fdi_projets", "fdi_signaux_investisseurs"):
        ids = [r.id for r in (await db.execute(text(
            f"SELECT id, entreprise_brut FROM {table} "
            f" WHERE statut_entreprise <> 'resolu' AND entreprise_brut ILIKE :m"),
            {"m": motif})).fetchall()
            if meme_texte(r.entreprise_brut, brut, nom)]
        meres = [r.id for r in (await db.execute(text(
            f"SELECT t.id, t.parent_brut FROM {table} t "
            f"  LEFT JOIN fdi_entreprises m ON m.id = t.parent_id "
            f" WHERE t.parent_brut ILIKE :m AND (m.id IS NULL OR m.statut_nom = 'tronque')"),
            {"m": motif})).fetchall()
            if meme_texte(r.parent_brut, brut, nom)]
        visees[table] = (ids, meres)

    eid, renomme = await entreprise_nommee(db, nom, utilisateur)
    total = 0
    for table, (ids, meres) in visees.items():
        if ids:
            await db.execute(text(
                f"UPDATE {table} SET entreprise_id = :e, statut_entreprise = 'resolu', "
                f"  modifie_le = now(), modifie_par = :u WHERE id = ANY(:ids)"),
                {"e": eid, "u": utilisateur, "ids": ids})
        if meres:
            await db.execute(text(
                f"UPDATE {table} SET parent_id = :e, modifie_le = now(), modifie_par = :u "
                f" WHERE id = ANY(:ids)"),
                {"e": eid, "u": utilisateur, "ids": meres})
        total += len(set(ids) | set(meres))
    await db.execute(text(
        "INSERT INTO fdi_entreprise_alias (alias_brut, alias_normalise, tronque, entreprise_id, decide_par) "
        "VALUES (:b, :c, true, :e, :u) ON CONFLICT (alias_normalise, entreprise_id) DO UPDATE "
        "SET occurrences = fdi_entreprise_alias.occurrences + 1, decide_par = EXCLUDED.decide_par"),
        {"b": brut, "c": P.normaliser(brut), "e": eid, "u": utilisateur})
    return total, renomme


# ── Le versement ─────────────────────────────────────────────────────────────

async def verser(db: "AsyncSession", base: str, jour: date, page: int, lignes: list[dict],
                 utilisateur: str | None) -> dict:
    """Écrit les lignes retenues de la page, par les importeurs du relevé.

    L'analyse est REFAITE ici, sur ce que la base contient à cet instant :
    l'écran a pu vieillir, une autre page a pu être versée entre-temps. Une
    ligne illisible ou déjà relevée est refusée, quoi que l'écran ait coché.
    """
    from sqlalchemy import text

    from app.services import fdi_suppressions as SUP

    analyse = await analyser(db, base, lignes, jour, page)
    verdicts = {a["rang"]: a for a in analyse["lignes"]}
    retenues = []
    a_retablir: dict[int, int] = {}
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
        if a["statut"] == "supprimee":
            # Cochée : on la RÉTABLIT telle qu'elle était, à sa place — la
            # verser créerait une seconde ligne, que le réimport doublerait.
            a_retablir[l["rang"]] = a["supprimee"]["id"]
            continue
        retenues.append((l, a))
    # Les noms complétés valent pour les lignes versées ET pour les lignes déjà
    # relevées : c'est sur elles, justement, que les points de suspension
    # restaient.
    completions = noms_completes([l for l in lignes
                                  if l.get("inclure") or verdicts.get(l["rang"], {}).get("statut") == "deja"])
    # Les destinations cachées que l'écran a rendues : pour les lignes versées,
    # et pour les signaux DÉJÀ relevés — c'est ainsi qu'une page ancienne,
    # recapturée, complète le relevé sans rien y doubler.
    retablies: dict[int, int] = {}
    for rang, trace_id in a_retablir.items():
        try:
            retablies[rang] = (await SUP.retablir(db, trace_id))["id"]
        except (SUP.LigneIntrouvable, SUP.RetablissementImpossible) as e:
            raise CaptureRefusee(f"Rang {rang} : {e}") from e
    ajouts = destinations_ajoutees(lignes) if base == "signaux" else {}
    a_completer = {rang: verdicts[rang]["trouvee"]["id"] for rang in ajouts
                   if verdicts.get(rang, {}).get("statut") == "deja"}
    a_completer |= {rang: i for rang, i in retablies.items() if rang in ajouts}
    lot_de: dict[int, int] = {}

    def page_csv(rows):
        return [{"ligne": l["rang"], **{c: " ".join(str((l.get("cases") or {}).get(c) or "").split())
                                         for c in COLONNES[base]}} for l in rows]

    rapport: dict = {"lots": [], "lignes": len(retenues), "a_arbitrer": 0, "non_rattaches": 0,
                     "retablies": len(retablies)}
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
            rapport["non_rattaches"] += len(r["non_resolus"])
            lot_de.update({l["rang"]: r["lot_id"] for l in rows})
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
            lot_de.update({l["rang"]: r["lot_id"] for l in rows})

    # Les noms complétés à l'écran : chaque ligne garde le texte de fDi, et
    # toutes celles qui portent ce texte et attendaient leur nom rejoignent
    # l'entreprise au nom complet — elles n'ont plus à passer par l'arbitrage.
    # Puis le compte de ce qui reste à trancher, sur ce que la base porte
    # désormais.
    table = "fdi_projets" if base == "projets" else "fdi_signaux_investisseurs"
    renommees = 0
    for brut, nom in completions.items():
        renommees += (await appliquer_nom(db, brut, nom, utilisateur))[0]
    rapport["noms_completes"] = len(completions)
    rapport["lignes_renommees"] = renommees

    if ajouts:
        cibles: dict[int, int] = dict(a_completer)
        for rang in ajouts:
            if rang in lot_de:
                cibles[rang] = (await db.execute(text(
                    "SELECT id FROM fdi_signaux_investisseurs WHERE lot_id = :l AND ligne = :r"),
                    {"l": lot_de[rang], "r": rang})).scalar_one()
        ajoutees, completes = 0, set()
        for rang, signal_id in cibles.items():
            n = await _ajouter_destinations(db, signal_id, ajouts[rang], utilisateur)
            ajoutees += n
            if n:
                completes.add(signal_id)
        rapport["destinations_ajoutees"] = ajoutees
        rapport["signaux_completes"] = len(completes)
        rapport["signaux_deja_completes"] = sum(1 for i in a_completer.values() if i in completes)
    if lot_de:
        rapport["a_arbitrer"] = (await db.execute(text(
            f"SELECT count(*) FROM {table} WHERE lot_id = ANY(:l) AND statut_entreprise <> 'resolu'"),
            {"l": sorted(set(lot_de.values()))})).scalar_one()
    await db.commit()
    return rapport
