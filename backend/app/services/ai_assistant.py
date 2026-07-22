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
    "/code-investissement",
    "/classifications",
    "/dashboard",
    "/zones-types",
    "/opportunites",
)
# Fragments interdits même sous un module autorisé (téléchargements de fichiers,
# imports, opérations d'écriture qui pourraient exister en GET par mégarde).
_FRAGMENTS_INTERDITS = ("importer", "fichiers", "sync", "rafraichir", "associer", "creer")

# Taille max d'un résultat d'outil renvoyé à Claude (garde-fou de coût/latence).
_MAX_RESULTAT = 8000

# Nombre max d'allers-retours d'outils par réponse (évite les boucles).
_MAX_ITERATIONS = 6


# ── Catalogue d'API décrit à Claude ───────────────────────────────────────────
CATALOGUE = """\
Modules interrogeables (chemins relatifs, méthode GET uniquement) :

COMMERCE EXTÉRIEUR (données ANSD/BMSCE)
  /bmce/rapport?annee=AAAA   → briefing : balance commerciale, taux de couverture,
                               évolution mensuelle, top produits, top pays, par continent
  /bmce/bulletins            → liste des bulletins importés (périodes disponibles)
  /bmce/apercu               → aperçu synthétique
  /bmce/series               → séries temporelles
  /statistiques/commerce/filtres      → valeurs de filtres disponibles (années, produits, pays)
  /statistiques/commerce/kpis         → indicateurs clés
  /statistiques/commerce/tops         → tops produits / pays
  /statistiques/commerce/balance      → balance commerciale
  /statistiques/commerce/bilateral    → échanges bilatéraux avec un pays
  /statistiques/commerce/repartition  → répartition par rubrique
  /statistiques/commerce/concentration→ concentration des échanges

INVESTISSEMENTS DIRECTS ÉTRANGERS (IDE)
  /ide/monde                 → flux IDE par pays
  /ide/secteurs              → flux IDE par secteur
  /ide/cnuced/annees         → années disponibles
  /ide/cnuced/pays-disponibles
  /ide/cnuced/kpis-calcules  → KPIs IDE

ACCORDS & TRAITÉS
  /accords                   → liste des accords et traités
  /accords/{id}              → détail d'un accord

ÉVÉNEMENTS
  /evenements                → liste des événements
  /evenements/stats          → statistiques
  /evenements/{id}           → détail d'un événement

ENTREPRISES & RÉFÉRENTIELS
  /entreprises               → liste des entreprises (filtres secteur/région possibles)
  /entreprises/{id}          → détail d'une entreprise
  /entreprises/ref/secteurs, /entreprises/ref/regions, /entreprises/ref/poles
  /ref-pays                  → référentiel des pays

CODE DES INVESTISSEMENTS
  /code-investissement       → chapitres, sections, articles (texte juridique)

Astuce : pour le commerce extérieur, appelle d'abord /statistiques/commerce/filtres
pour connaître les années et libellés valides avant d'interroger le détail."""


SYSTEME_BASE = f"""\
Tu es l'assistant intelligent de la plateforme APIX Sénégal — la plateforme
d'intelligence économique de l'APIX (Agence de Promotion des Investissements et
des Grands Travaux du Sénégal). Tu aides les utilisateurs à naviguer dans la
plateforme et à obtenir des réponses précises sur le commerce extérieur, les
investissements directs étrangers (IDE), les accords, les événements, les
entreprises et le code des investissements.

RÈGLES ABSOLUES
- Réponds toujours en français, de façon claire, concise et professionnelle.
- Ne réponds qu'aux questions en rapport avec la plateforme et ses données
  (économie, investissement et commerce du Sénégal). Pour toute question hors
  sujet, décline poliment et rappelle ton périmètre.
- N'invente JAMAIS de chiffres. Pour toute donnée chiffrée, utilise l'outil
  consulter_donnees et n'affirme que ce que les données renvoient réellement.
  Si une donnée n'est pas disponible, dis-le simplement.
- Cite les valeurs avec leur unité et leur année/période. Formate les grands
  nombres lisiblement (milliards/millions de FCFA).
- Sois synthétique : va à l'essentiel, puis propose d'approfondir si utile.

Tu disposes d'un seul outil, consulter_donnees, qui interroge l'API interne de
la plateforme (lecture seule). {CATALOGUE}"""


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
