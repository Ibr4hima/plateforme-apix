"""Le nom complet PROPOSÉ pour un libellé d'entreprise tronqué par fDi.

POURQUOI CE MODULE. fDi coupe ses noms à la largeur de la colonne : un nom de
plus de vingt caractères n'apparaît JAMAIS en entier dans son tableau, ni chez
la société mère, ni dans les signaux — mesuré sur les deux relevés, 21 des
2 838 libellés tronqués trouvent un candidat par recoupement, pas davantage.
Le seul moyen de les compléter était d'aller chercher chaque nom dans fDi, un
par un, et c'est ce travail-là qui n'avançait pas.

CE QU'IL FAIT. Il demande à l'API Claude le nom complet le plus probable, à
partir de ce que le relevé dit du libellé : la société mère, les pays, les
secteurs, les dates. Pour « Huawei Technologi… », la réponse ne fait pas de
doute ; pour « International Wor… », elle en fait — et le modèle doit le dire.

CE QU'IL NE FAIT PAS : décider. Une proposition pré-remplit le champ de
l'écran d'arbitrage, et rien n'est rattaché tant qu'un humain ne l'a pas
validée. C'est la règle de toute la chaîne fDi : ce qui ne se résout pas n'est
jamais deviné en silence.

LE GARDE-FOU QUI NE DÉPEND PAS DU MODÈLE. fDi garde le DÉBUT du nom : le nom
complet commence donc exactement par le texte affiché. Toute proposition qui
ne le prolonge pas est écartée, quoi que le modèle en pense — c'est la seule
chose qu'on sache avec certitude, et elle suffit à rejeter les inventions les
plus grossières.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING

from app.core.config import get_settings
from app.services.fdi_projets import FIN_TRONQUEE, est_tronque, normaliser

if TYPE_CHECKING:  # pragma: no cover — annotation seule
    from sqlalchemy.ext.asyncio import AsyncSession

journal = logging.getLogger(__name__)

# Combien de libellés par appel. Dix tiennent en quelques secondes ; les
# appels d'une même page partent en parallèle, si bien qu'une page de vingt
# libellés n'attend que le plus lent des deux.
PAR_APPEL = 10
# Au-delà, une demande n'est plus celle d'un écran : on la refuse plutôt que
# de lancer cent appels sur un clic.
MAX_PAR_DEMANDE = 40

CONFIANCES = ("haute", "moyenne", "basse")

SCHEMA = {
    "type": "object",
    "properties": {
        "propositions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "numero": {"type": "integer"},
                    "nom": {"type": "string"},
                    "confiance": {"type": "string", "enum": list(CONFIANCES)},
                    "indice": {"type": "string"},
                },
                "required": ["numero", "nom", "confiance", "indice"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["propositions"],
    "additionalProperties": False,
}

SYSTEME = """\
Tu complètes des noms d'entreprise TRONQUÉS par la base fDi Markets (Financial \
Times), qui recense les projets d'investissement direct étranger annoncés dans \
le monde.

Le tableau de fDi coupe chaque nom à la largeur de sa colonne et le termine par \
« … » : « Huawei Technologi… », « Standard Chartere… », « TotalEnergies (Tot… ». \
Le début affiché est EXACT. Le nom complet commence donc toujours, caractère \
pour caractère, par ce début.

Pour chaque libellé, propose le nom complet tel que fDi l'écrit, à partir de ce \
que tu sais de l'entreprise et du contexte fourni (société mère, pays d'origine, \
pays de destination, secteurs, activités, dates, montants).

Les usages de fDi, à respecter :
- le nom courant de l'entreprise, en anglais ou dans sa langue d'origine s'il \
s'écrit en alphabet latin : « Huawei Technologies », « Banco de Fomento Angola », \
« Banque Ouest Africaine de Développement » ;
- une parenthèse donne l'ancien nom, le sigle ou la marque d'origine : \
« TotalEnergies (Total) », « Meta (Facebook) », « Equinor (Statoil) », \
« Ernst & Young (EY) », « ABB (Asea Brown Boveri) » ;
- une filiale locale porte souvent le pays de destination : « MTN Ghana », \
« Airtel Kenya », « Toyota South Africa » — mais seulement quand le début \
affiché et le contexte y conduisent : n'ajoute pas un pays par habitude ;
- pas de forme juridique (« Ltd », « SA », « Inc ») sauf si elle fait partie du \
nom usuel.

La confiance :
- « haute » : il n'y a qu'une complétion raisonnable — grand groupe connu, \
société mère explicite, nom sans variante plausible ;
- « moyenne » : l'entreprise est identifiée, mais la forme exacte chez fDi peut \
différer (parenthèse, filiale, mot final) ;
- « basse » : hypothèse. Si tu ne reconnais pas l'entreprise, renvoie un nom \
vide plutôt que d'en inventer un.

L'indice : une phrase courte, en français, qui dit sur quoi repose la \
proposition (« filiale kényane de Standard Chartered », « opérateur télécoms \
chinois »). Vide si le nom est évident.

Réponds pour CHAQUE numéro reçu, une seule fois, dans l'ordre."""


def prefixe(brut: str) -> str:
    """Le texte affiché par fDi, sans ses points de suspension."""
    return FIN_TRONQUEE.sub("", " ".join((brut or "").split())).strip()


def valider(brut: str, nom: str | None) -> str | None:
    """La proposition, si elle prolonge le texte affiché ; sinon None.

    La casse de la partie AFFICHÉE est celle de fDi, et elle l'emporte : si le
    modèle écrit « Huawei technologies » pour « Huawei Technologi… », c'est
    « Huawei Technologies » qu'on garde. Les écarts d'accent ou de ponctuation
    sont tolérés — c'est ce que la normalisation absorbe partout ailleurs —
    mais pas un début différent.
    """
    nom = " ".join((nom or "").split())
    if not nom or est_tronque(nom):
        return None
    debut = prefixe(brut)
    cle, cle_nom = normaliser(debut), normaliser(nom)
    if not cle or not cle_nom.startswith(cle) or len(cle_nom) <= len(cle):
        return None
    if nom.casefold().startswith(debut.casefold()):
        nom = debut + nom[len(debut):]
    return nom


def _liste(valeurs, n: int = 6) -> str:
    vues: list[str] = []
    for v in valeurs:
        v = " ".join((v or "").split())
        if v and v not in vues:
            vues.append(v)
    reste = len(vues) - n
    return ", ".join(vues[:n]) + (f" (+{reste})" if reste > 0 else "")


def decrire(numero: int, brut: str, projets: list[dict], connus: list[str]) -> str:
    """Ce que le relevé dit d'un libellé, en quelques lignes.

    Les valeurs restent celles de fDi, en anglais et tronquées s'il le faut :
    c'est le vocabulaire que le modèle connaît, et le traduire ferait perdre
    des indices.
    """
    annees = sorted({p["annee"] for p in projets if p.get("annee")})
    periode = (f"{annees[0]}–{annees[-1]}" if len(annees) > 1
               else str(annees[0]) if annees else "?")
    lignes = [f"{numero}. « {brut} » — {len(projets)} projet{'s' if len(projets) > 1 else ''}, {periode}"]
    meres = _liste(p.get("parent") for p in projets)
    if meres:
        lignes.append(f"   Société mère : {meres}")
    lignes.append(f"   Pays d'origine : {_liste(p.get('origine') for p in projets) or '?'}")
    lignes.append(f"   Destinations : {_liste(p.get('destination') for p in projets) or '?'}")
    lignes.append(f"   Secteurs : {_liste(p.get('secteur') for p in projets) or '?'}")
    sous = _liste(p.get("sous_secteur") for p in projets)
    if sous:
        lignes.append(f"   Sous-secteurs : {sous}")
    act = _liste(p.get("activite") for p in projets)
    if act:
        lignes.append(f"   Activités : {act}")
    if connus:
        lignes.append(f"   Noms complets déjà connus qui commencent ainsi : {_liste(connus, 8)}")
    return "\n".join(lignes)


def _client():
    from anthropic import AsyncAnthropic

    return AsyncAnthropic(api_key=get_settings().ANTHROPIC_API_KEY, timeout=90, max_retries=2)


def modele() -> str:
    s = get_settings()
    return s.FDI_PROPOSITIONS_MODELE or s.ASSISTANT_MODELE


def actif() -> bool:
    return bool(get_settings().ANTHROPIC_API_KEY)


class PropositionsIndisponibles(RuntimeError):
    """L'API n'a pas répondu, ou pas dans la forme attendue."""


async def _appel(client, libelles: list[dict]) -> dict[str, dict]:
    """Un appel pour au plus PAR_APPEL libellés : {brut: proposition}."""
    texte = "\n\n".join(
        decrire(i, l["brut"], l["projets"], l.get("connus", []))
        for i, l in enumerate(libelles, 1))
    try:
        reponse = await client.messages.create(
            model=modele(),
            max_tokens=200 + 140 * len(libelles),
            system=[{"type": "text", "text": SYSTEME, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": texte}],
            output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        )
    except Exception as e:  # réseau, clé refusée, quota : rien d'écrit
        journal.warning("propositions de noms fDi : appel refusé (%s)", e)
        raise PropositionsIndisponibles(type(e).__name__) from e
    if reponse.stop_reason not in ("end_turn", "stop_sequence"):
        raise PropositionsIndisponibles(f"réponse interrompue ({reponse.stop_reason})")
    bloc = next((b for b in reponse.content if getattr(b, "type", None) == "text"), None)
    try:
        donnees = json.loads(bloc.text if bloc else "")
    except ValueError as e:
        raise PropositionsIndisponibles("réponse illisible") from e

    sortie: dict[str, dict] = {}
    for p in donnees.get("propositions", []):
        i = p.get("numero")
        if not isinstance(i, int) or not 1 <= i <= len(libelles):
            continue
        brut = libelles[i - 1]["brut"]
        if brut in sortie:
            continue
        nom = valider(brut, p.get("nom"))
        confiance = p.get("confiance") if p.get("confiance") in CONFIANCES else "basse"
        indice = " ".join((p.get("indice") or "").split())[:200] or None
        # Une proposition écartée garde sa place, nom vide : on sait alors
        # qu'il n'y a rien à proposer, et l'on ne redemande pas sans fin.
        sortie[brut] = {"nom": nom, "confiance": confiance if nom else "basse",
                        "indice": indice if nom else None}
    return sortie


async def proposer(libelles: list[dict]) -> dict[str, dict]:
    """{brut: {nom, confiance, indice}} pour chaque libellé reçu.

    `libelles` : [{"brut", "projets": [...], "connus": [...]}]. Les appels
    partent en parallèle, par paquets de PAR_APPEL ; un libellé auquel le
    modèle n'a pas répondu est simplement absent du résultat.
    """
    if not actif():
        raise PropositionsIndisponibles("assistant IA non configuré (clé API absente)")
    client = _client()
    paquets = [libelles[i:i + PAR_APPEL] for i in range(0, len(libelles), PAR_APPEL)]
    resultats = await asyncio.gather(*(_appel(client, p) for p in paquets),
                                     return_exceptions=True)
    sortie: dict[str, dict] = {}
    erreurs = [r for r in resultats if isinstance(r, BaseException)]
    for r in resultats:
        if isinstance(r, dict):
            sortie.update(r)
    # Tout a échoué : on le dit. Une partie seulement : on rend ce qu'on a, le
    # reste sera redemandé à la prochaine ouverture de la page.
    if erreurs and not sortie:
        raise erreurs[0] if isinstance(erreurs[0], PropositionsIndisponibles) \
            else PropositionsIndisponibles(type(erreurs[0]).__name__)
    return sortie


async def enregistrer(db: "AsyncSession", propositions: dict[str, dict]) -> None:
    from sqlalchemy import text

    for brut, p in propositions.items():
        await db.execute(text("""
            INSERT INTO fdi_propositions_noms (alias_normalise, brut, nom, confiance, indice, modele)
            VALUES (:c, :b, :n, :conf, :i, :m)
            ON CONFLICT (alias_normalise) DO UPDATE SET
                brut = EXCLUDED.brut, nom = EXCLUDED.nom, confiance = EXCLUDED.confiance,
                indice = EXCLUDED.indice, modele = EXCLUDED.modele, cree_le = now()
        """), {"c": normaliser(brut), "b": brut, "n": p["nom"], "conf": p["confiance"],
               "i": p["indice"], "m": modele()})
