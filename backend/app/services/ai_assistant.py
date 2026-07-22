"""Assistant IA de la plateforme (API Claude / Anthropic).

Un seul outil est exposé à Claude : ``consulter_donnees`` qui rappelle les
endpoints publics de lecture de la plateforme *en interne* (transport ASGI, sans
passer par le réseau ni supposer un port). Claude connaît le catalogue d'API via
son prompt système et décide lui-même quelles données aller chercher — c'est ce
qui permet la « recherche en profondeur » sans dupliquer la moindre requête SQL.

La clé API reste strictement côté serveur. La route (``routes/assistant.py``)
gère le streaming SSE, le rate-limit par IP et le plafond de tokens.
"""

from __future__ import annotations

import json
from typing import Any, AsyncGenerator

import httpx

from app.core.config import get_settings

# ── Périmètre autorisé ────────────────────────────────────────────────────────
# Liste blanche des modules publics interrogeables (préfixes de chemin, après le
# préfixe /api/v1). Tout le reste — auth, utilisateurs, prospects/projets (CRM
# interne), imports, écritures — est hors de portée de l'assistant.
_MODULES_AUTORISES = (
    "/bmce",
    "/statistiques",
    "/ide",
    "/accords",
    "/evenements",
    "/entreprises",
    "/ref-pays",
    "/ref-potentialites",
    "/ref-avantages",
    "/code-investissement",
    "/modalites-application",
    "/classifications",
    "/dashboard",
    "/zones-types",
    "/opportunites",
    "/prospects",
    "/projets",
    "/suivi-projets",
    "/bdef",
)
# Fragments interdits même sous un module autorisé (téléchargements de fichiers,
# imports, opérations d'écriture qui pourraient exister en GET par mégarde).
_FRAGMENTS_INTERDITS = ("importer", "fichiers", "sync", "rafraichir", "associer", "creer")

# Taille max d'un résultat d'outil renvoyé à Claude (garde-fou de coût/latence).
_MAX_RESULTAT = 8000

# Nombre max d'allers-retours d'outils par réponse (évite les boucles).
# Plus élevé qu'avant : la recherche « en profondeur » enchaîne souvent
# découverte des identifiants → détail → recoupement.
_MAX_ITERATIONS = 9


# ── Catalogue d'API décrit à Claude ───────────────────────────────────────────
CATALOGUE = """\
Modules interrogeables (chemins relatifs, méthode GET uniquement). Beaucoup
d'endpoints ont besoin d'IDENTIFIANTS (id de pays, pays_id…) : commence toujours
par les endpoints de « découverte » pour les récupérer, puis interroge le détail.

INDICATEURS MACRO-ÉCONOMIQUES (Statistiques → Indicateurs économiques)
  /statistiques/pays              → liste des pays disponibles avec leur id (le Sénégal est la référence)
  /statistiques/indicateurs       → indicateurs disponibles (population, superficie, densité,
                                     PIB prix courants, PIB par habitant, etc.)
  /statistiques/donnees?pays=<id> → séries annuelles de TOUS ces indicateurs pour un pays
                                     (ex. population par année 1948→2024, PIB…)
  /statistiques/comparaison?pays=<id1,id2>       → comparaison multi-pays
  /statistiques/ide_flux?pays=<id>&indicateur=flux|stock  → flux/stock d'IDE (CNUCED)
  → Pour « population/PIB/superficie du Sénégal » : /statistiques/pays (trouver l'id du
    Sénégal) puis /statistiques/donnees?pays=<id>, et lis l'année demandée dans la série.

COMMERCE EXTÉRIEUR (Statistiques → Commerce extérieur ; données ANSD/BMSCE)
  /bmce/rapport?annee=AAAA        → briefing : balance commerciale (FAB−CAF), taux de couverture,
                                     évolution mensuelle, top produits, top pays, par continent
  /bmce/bulletins                 → périodes/bulletins importés
  /statistiques/commerce/filtres  → pays disponibles (avec pays_id), années, produits
  /statistiques/commerce/kpis?pays_id=<id>&direction=exportateur|importateur[&annees=2024]
  /statistiques/commerce/tops?pays_id=<id>&direction=…[&annees=…&limite=10]
  /statistiques/commerce/balance?pays_id=<id>[&annees=…]
  /statistiques/commerce/repartition?pays_id=<id>&direction=…
  /statistiques/commerce/bilateral?pays_a=<id>&pays_b=<id>&annee=AAAA
  → direction=exportateur = exportations du pays, importateur = importations.
    /statistiques/commerce/filtres donne les pays_id et années valides.

INVESTISSEMENTS DIRECTS ÉTRANGERS (IDE)
  /ide/monde, /ide/secteurs, /ide/cnuced/annees, /ide/cnuced/pays-disponibles, /ide/cnuced/kpis-calcules

ACCORDS & TRAITÉS
  /accords → liste ; /accords/{id} → détail

ÉVÉNEMENTS
  /evenements → liste ; /evenements/stats → statistiques ; /evenements/{id} → détail

ENTREPRISES & RÉFÉRENTIELS
  /entreprises → liste (filtres secteur/région) ; /entreprises/{id} → détail
  /entreprises/ref/secteurs, /entreprises/ref/regions, /entreprises/ref/poles
  /ref-pays → référentiel des pays

OPPORTUNITÉS · PROSPECTS · PROJETS · ZONES
  /opportunites → opportunités d'investissement ; /prospects → prospects ;
  /projets → projets ; /zones-types → zones et pôles territoriaux

CODE DES INVESTISSEMENTS
  /code-investissement → chapitres, sections, articles (texte juridique)"""


SYSTEME_BASE = f"""\
Tu es l'assistant intelligent de la plateforme APIX Sénégal — la plateforme
d'intelligence économique de l'APIX (Agence de Promotion des Investissements et
des Grands Travaux du Sénégal). Tu aides les utilisateurs à naviguer dans la
plateforme et à obtenir des réponses PRÉCISES à partir de ses données.

La plateforme contient énormément de données publiques : indicateurs macro
(population, superficie, densité, PIB, PIB/habitant, historiques depuis 1948),
commerce extérieur (balance, imports/exports, produits, pays partenaires),
investissements directs étrangers, accords et traités, événements, entreprises
et référentiels, opportunités, prospects, projets, zones/pôles territoriaux, et
le code des investissements.

RÈGLE DE RECHERCHE (la plus importante)
- Avant de dire que tu n'as pas une information, CHERCHE-LA avec l'outil
  consulter_donnees. La plupart des questions économiques/statistiques sur le
  Sénégal ONT une réponse dans la plateforme — y compris la démographie et le PIB
  (indicateurs macro), pas seulement le commerce.
- Procède par étapes : appelle d'abord un endpoint de découverte pour obtenir les
  identifiants (/statistiques/pays pour l'id du Sénégal, /statistiques/commerce/filtres
  pour les pays_id et années, /ide/cnuced/annees…), PUIS l'endpoint de détail.
  Enchaîne plusieurs appels si nécessaire. Si un appel renvoie une erreur, corrige
  le chemin ou les paramètres et réessaie.
- Ne décline que si la question est vraiment sans rapport avec le Sénégal, son
  économie, ses investissements ou la plateforme (ex. météo, culture générale
  mondiale) — ou si, après avoir réellement cherché, la donnée n'existe pas.

AUTRES RÈGLES
- Réponds toujours en français, clair et concis.
- N'invente JAMAIS de chiffres : n'affirme que ce que les endpoints renvoient
  réellement. Cite les valeurs avec leur unité et leur année/période, et formate
  les grands nombres lisiblement (milliards/millions).
- Va droit au but : le chiffre d'abord, puis un court contexte si utile. Évite les
  longues introductions.

Tu disposes d'un seul outil, consulter_donnees, qui interroge l'API interne de la
plateforme (lecture seule). {CATALOGUE}"""


TOOLS = [
    {
        "name": "consulter_donnees",
        "description": (
            "Interroge l'API interne de la plateforme (lecture seule) pour obtenir "
            "des données réelles. Fournis un chemin du catalogue et, si besoin, des "
            "paramètres de requête. Renvoie le JSON de l'endpoint."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "chemin": {
                    "type": "string",
                    "description": "Chemin relatif du catalogue, ex. /bmce/rapport ou /accords",
                },
                "parametres": {
                    "type": "object",
                    "description": "Paramètres de requête (query string), ex. {\"annee\": 2025}",
                    "additionalProperties": True,
                },
            },
            "required": ["chemin"],
        },
    }
]


def _chemin_autorise(chemin: str) -> bool:
    c = (chemin or "").split("?")[0].strip()
    if not c.startswith("/"):
        return False
    if any(frag in c.lower() for frag in _FRAGMENTS_INTERDITS):
        return False
    return any(c == m or c.startswith(m + "/") for m in _MODULES_AUTORISES)


async def _consulter_donnees(chemin: str, parametres: dict | None) -> str:
    """Exécute l'appel interne et renvoie une chaîne (JSON ou message d'erreur)
    destinée à Claude. Ne lève jamais : les erreurs sont renvoyées comme texte
    pour que le modèle puisse se corriger et réessayer."""
    if not _chemin_autorise(chemin):
        return (
            "Erreur : chemin non autorisé ou hors périmètre. Utilise uniquement "
            "les chemins du catalogue (modules publics en lecture)."
        )
    settings = get_settings()
    chemin_clean = "/" + chemin.split("?")[0].strip().lstrip("/")
    url = settings.API_PREFIX + chemin_clean
    try:
        # Import tardif : évite un import circulaire (main importe ce module).
        from app.main import app

        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://assistant.interne", timeout=30.0
        ) as client:
            resp = await client.get(url, params=parametres or {})
    except Exception as exc:  # noqa: BLE001 — on renvoie l'erreur à Claude
        return f"Erreur lors de l'appel {chemin_clean} : {exc}"

    if resp.status_code >= 400:
        detail = resp.text[:500]
        return (
            f"Erreur {resp.status_code} sur {chemin_clean}. Vérifie le chemin et les "
            f"paramètres. Détail : {detail}"
        )
    texte = resp.text
    if len(texte) > _MAX_RESULTAT:
        texte = texte[:_MAX_RESULTAT] + "\n… (résultat tronqué, affine ta requête)"
    return texte


def _client():
    from anthropic import AsyncAnthropic

    return AsyncAnthropic(api_key=get_settings().ANTHROPIC_API_KEY)


def construire_systeme(contexte_page: str | None) -> str:
    """Prompt système, enrichi du contexte de la page courante si fourni."""
    if contexte_page:
        return (
            SYSTEME_BASE
            + "\n\nCONTEXTE : l'utilisateur consulte actuellement la page suivante "
            "de la plateforme. Utilise-le pour interpréter les demandes du type "
            f"« résume-moi ça » ou « explique cette page ».\n{contexte_page.strip()}"
        )
    return SYSTEME_BASE


async def stream_reponse(
    messages: list[dict[str, Any]],
    contexte_page: str | None = None,
) -> AsyncGenerator[str, None]:
    """Génère la réponse de l'assistant en flux (fragments de texte).

    Gère la boucle tool-use côté serveur : tant que Claude demande des données,
    on exécute l'outil et on relance, sans jamais renvoyer les allers-retours
    d'outils au client — seul le texte est diffusé.
    """
    settings = get_settings()
    client = _client()
    systeme = construire_systeme(contexte_page)
    conversation = list(messages)

    for _ in range(_MAX_ITERATIONS):
        async with client.messages.stream(
            model=settings.ASSISTANT_MODELE,
            max_tokens=settings.ASSISTANT_MAX_TOKENS,
            system=systeme,
            tools=TOOLS,
            thinking={"type": "disabled"},
            messages=conversation,
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta" and event.delta.type == "text_delta":
                    yield event.delta.text
            final = await stream.get_final_message()

        conversation.append({"role": "assistant", "content": final.content})

        if final.stop_reason != "tool_use":
            return

        # Exécuter chaque outil demandé, puis relancer avec les résultats.
        resultats = []
        for bloc in final.content:
            if getattr(bloc, "type", None) != "tool_use":
                continue
            entree = bloc.input or {}
            texte = await _consulter_donnees(
                entree.get("chemin", ""), entree.get("parametres")
            )
            resultats.append(
                {
                    "type": "tool_result",
                    "tool_use_id": bloc.id,
                    "content": texte,
                }
            )
        if not resultats:
            return
        conversation.append({"role": "user", "content": resultats})

    # Sécurité : trop d'itérations d'outils.
    yield "\n\n(Je n'ai pas pu finaliser la recherche. Reformule ou précise ta question.)"


def assistant_actif() -> bool:
    return bool(get_settings().ANTHROPIC_API_KEY)
