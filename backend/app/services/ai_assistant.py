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
_MAX_RESULTAT = 12000

# Nombre max d'allers-retours d'outils par réponse (évite les boucles).
# Plus élevé qu'avant : la recherche « en profondeur » enchaîne souvent
# découverte des identifiants → détail → recoupement.
_MAX_ITERATIONS = 9


# ── Catalogue d'API décrit à Claude ───────────────────────────────────────────
CATALOGUE = """\
Modules interrogeables (GET uniquement, chemins relatifs à /api/v1). Commence par
un endpoint de « découverte » pour obtenir les identifiants, puis interroge le
détail. Filtre par année (annee_min/annee_max/annees) pour des résultats compacts.

═ INDICATEURS MACRO (Statistiques → Indicateurs économiques) ═
  /statistiques/pays                        → pays disponibles (id, nom, code_iso3)
  /statistiques/indicateurs                 → indicateurs (population, superficie, densité, PIB, PIB/hab…)
  /statistiques/donnees?pays=<id>[&annee_min=&annee_max=]   → séries annuelles d'un pays
  /statistiques/comparaison?pays=<id1,id2>[&annee=]         → comparaison multi-pays
  /statistiques/ide_flux?pays=<id>&indicateur=flux|stock    → IDE entrant/sortant (CNUCED)

═ COMMERCE EXTÉRIEUR (Statistiques → Commerce ; ANSD/BMSCE) ═
  /bmce/rapport?annee=AAAA        → briefing annuel : balance (FAB−CAF), taux de couverture,
                                    évolution mensuelle, tops produits/pays, par continent
  /bmce/apercu                    → KPIs du dernier mois + séries de l'année courante
  /bmce/bulletins                 → périodes importées
  /bmce/flux?categorie=<c>&sens=export|import      (categorie: groupe_utilisation|produit_regroupe|chapitre|pays)
  /bmce/series?categorie=<c>&sens=export|import    → séries mensuelles + dérivés (VU, variation, part)
  /statistiques/commerce/filtres  → pays disponibles (pays_id), années, produits
  /statistiques/commerce/kpis?pays_id=<id>&direction=exportateur|importateur[&annees=2024&ressources=]
  /statistiques/commerce/tops?pays_id=<id>&direction=…[&annees=&limite=10]
  /statistiques/commerce/balance?pays_id=<id>[&annees=]
  /statistiques/commerce/repartition?pays_id=<id>&direction=…
  /statistiques/commerce/concentration?pays_id=<id>&direction=…
  /statistiques/commerce/bilateral?pays_a=<id>&pays_b=<id>&annee=AAAA
  /statistiques/commerce/detail?pays_id=<id>&direction=…&annee=AAAA
  (direction=exportateur = exportations ; importateur = importations)

═ IDE (Investissements Directs Étrangers) ═
  /ide/cnuced/kpis-calcules       → KPIs IDE du Sénégal
  /ide/cnuced[?direction=&indicateur=&annee_min=&annee_max=&annees=]   → séries CNUCED (défaut : Sénégal)
  /ide/cnuced/annees · /ide/cnuced/pays-disponibles · /ide/cnuced/stats
  /ide/secteurs                   → référentiel des secteurs IDE
  /ide/cnuced-secteurs[?secteur_ids=&annees=]     → IDE par secteur
  /ide/monde/groupements · /ide/monde[?codes_list=CEDEAO,G7&annees=]   → IDE Monde par groupement
  /ide/analyses[?publie=true]     → analyses éditoriales IDE

═ ACCORDS & TRAITÉS ═
  /accords[?statut=&reference=&parties_signataires=&page=&per_page=]
  /accords/parties-distinctes · /accords/{id}

═ ÉVÉNEMENTS ═
  /evenements[?statut_calcule=a_venir|en_cours|termine&pays_nom=&annee=&secteur=&page=]
  /evenements/stats · /evenements/pays-hotes · /evenements/{id}

═ ENTREPRISES & RÉFÉRENTIELS ═
  /entreprises[?search=&region=&pays=&secteur_nom=&branche_nom=&activite_nom=&pole_id=&page=&per_page=]
  /entreprises/{id}
  /entreprises/ref/secteurs · ref/branches?secteur_id= · ref/activites?branche_id=
  /entreprises/ref/regions · ref/departements?region_id= · ref/arrondissements?departement_id=
  /entreprises/ref/poles · ref/formes-juridiques · ref/pays

═ OPPORTUNITÉS · PROSPECTS · PROJETS · ZONES ═
  /opportunites/potentialites[?q=&pole_id=&region_id=&niveau=&page=] · /opportunites/potentialites/{id}
  /opportunites/avantages[?q=&activite_id=&page=] · /opportunites/avantages/{id}
  /prospects[?q=&contactes=&conclu=&page=] · /prospects/{id} · /prospects/{id}/echanges
  /projets[?q=&page=] · /projets/devises · /suivi-projets/{projet_id}
  /zones-types[?type_zone=ZES|ZAI|ZFI] · /zones-types/poles · /zones-types/{zone_id}/entreprises-eligibles

═ TABLEAU DE BORD — SYNTHÈSES & ANALYSES ═
  /dashboard/stats   → tous les compteurs clés (entreprises, accords, événements, prospects,
                       projets + montants, zones, pôles, indicateurs globaux)
  /dashboard/indicateur?dimension=pays|secteurs|branches|activites&indicateur=installees|ciblees|contactees
  /dashboard/tables/<nom>  → 50+ tableaux d'analyse prêts (sans paramètre). Noms disponibles :
    entreprises-par-region, entreprises-par-pays, entreprises-par-continent, hierarchie-sectorielle,
    evolution-creations, entreprises-multi-secteurs, top-departements, entreprises-par-arrondissement,
    anciennete-entreprises, avant-apres-pivot, creations-par-decennie, tendances-recentes, activites-emergentes,
    secteurs-investissement-classement, branches-classement, activites-classement-national,
    activites-par-region, activites-par-departement, activites-par-arrondissement, activites-par-pole,
    evolution-par-secteur, secteurs-par-region, branches-par-region, pays-par-region, secteur-x-pays-origine,
    zones-detail, taux-occupation-zones, zones-vides, densite-zones, diversification-zones,
    classement-zones-entreprises, activites-par-zone, matrice-region-zone, entreprises-par-zone-detail,
    poles-detail, poles-sans-zones, vue-pole-zone-activite,
    vue-region, classement-regions-complet, classement-departements-complet, classement-arrondissements-complet,
    score-attractivite, concentration-sectorielle, densite-economique-departements,
    local-vs-etranger, entreprises-etrangeres-localisation, activites-entreprises-etrangeres,
    secteurs-etrangers-par-continent, etrangeres-par-pays-region, etrangeres-recentes-par-pays,
    diversite-investisseurs-zones
  (Aussi /dashboard/viz/<nom> pour des agrégats de graphes : entreprises-par-secteur,
   entreprises-par-region, zones-par-type, entreprises-par-annee, entreprises-par-pays…)

═ CODE DES INVESTISSEMENTS & TEXTES JURIDIQUES ═
  /code-investissement            → arbre complet chapitres/sections/articles
  /code-investissement/search?q=<mots>   → recherche full-text dans les articles
  /modalites-application · /modalites-application/search?q=<mots>   → modalités d'application

═ CLASSIFICATIONS & AUTRES RÉFÉRENTIELS ═
  /classifications · /classifications/{code}/items?q=&niveau=&parent=   (CITI, NACE, NAEMA)
  /ref-pays[?q=&continent=&region_geo=] · /ref-pays/meta · /ref-pays/groupements/liste
  /ref-potentialites · /ref-avantages
  /bdef/valeurs?niveau=global|secteur|groupe|macro_secteur[&cible_id=] · /bdef/secteurs · /bdef/verification"""


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
- N'ajoute AUCUNE mise en garde sur la qualité ou la complétude des données
  (« ces chiffres semblent faibles/partiels/filtrés », « échantillon »…) et ne
  propose pas de recouper avec un autre endpoint. Présente simplement le résultat
  renvoyé ; si une donnée manque réellement, dis-le en une phrase, sans spéculer.

MISE EN FORME (important)
- Ne raconte PAS tes recherches en cours (pas de « je vais consulter… », « voici
  l'article, je récupère… ») : appelle les outils silencieusement et rédige
  directement la réponse finale.
- Rédige en Markdown propre : paragraphes séparés par une ligne vide, **gras**
  pour les chiffres et termes clés, listes à puces ou numérotées, et de VRAIS
  tableaux Markdown (lignes « | col | col | » avec une ligne « |---|---| » sous
  l'en-tête) dès qu'il y a plusieurs lignes/colonnes à comparer.
- Soigne l'orthographe et les espaces : jamais de mots collés, une espace après
  la ponctuation.

DÉNOMBREMENT & LISTES (pagination propre)
- Pour compter ou agréger, préfère les endpoints agrégés (/dashboard/stats,
  /dashboard/tables/*, /evenements/stats, /accords/parties-distinctes) plutôt que
  de dénombrer une liste paginée — sinon tu ne comptes qu'une page.
- Pour lister, utilise page & per_page (ex. per_page=20). Si l'endpoint renvoie
  un total/nombre de pages, indique-le et propose la suite au lieu de tout
  charger. Ne présente jamais une page partielle comme la liste complète.

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


async def _get_interne(chemin_clean: str, parametres: dict | None) -> tuple[int, str]:
    """Appel GET interne (transport ASGI, sans réseau) — renvoie (status, texte
    complet, non tronqué). Import tardif de `app` pour éviter l'import circulaire."""
    settings = get_settings()
    url = settings.API_PREFIX + chemin_clean
    from app.main import app

    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://assistant.interne", timeout=30.0
    ) as client:
        resp = await client.get(url, params=parametres or {})
    return resp.status_code, resp.text


async def _consulter_donnees(chemin: str, parametres: dict | None) -> str:
    """Exécute l'appel interne et renvoie une chaîne (JSON ou message d'erreur)
    destinée à Claude. Ne lève jamais : les erreurs sont renvoyées comme texte
    pour que le modèle puisse se corriger et réessayer."""
    if not _chemin_autorise(chemin):
        return (
            "Erreur : chemin non autorisé ou hors périmètre. Utilise uniquement "
            "les chemins du catalogue (modules publics en lecture)."
        )
    chemin_clean = "/" + chemin.split("?")[0].strip().lstrip("/")
    try:
        status, texte = await _get_interne(chemin_clean, parametres)
    except Exception as exc:  # noqa: BLE001 — on renvoie l'erreur à Claude
        return f"Erreur lors de l'appel {chemin_clean} : {exc}"

    if status >= 400:
        return (
            f"Erreur {status} sur {chemin_clean}. Vérifie le chemin et les "
            f"paramètres. Détail : {texte[:500]}"
        )
    if len(texte) > _MAX_RESULTAT:
        texte = texte[:_MAX_RESULTAT] + (
            "\n… (résultat tronqué — filtre par année ou par identifiant pour "
            "réduire la taille)"
        )
    return texte


# Id du Sénégal (référentiel RefPays) résolu une fois puis mémorisé : il sert
# de pays / pays_id pour /statistiques/donnees et /statistiques/commerce, ce qui
# évite à Claude de le chercher dans une longue liste (qui serait tronquée).
_ID_SENEGAL: int | None = None
_ID_SENEGAL_RESOLU = False


async def _resoudre_id_senegal() -> int | None:
    global _ID_SENEGAL, _ID_SENEGAL_RESOLU
    if _ID_SENEGAL_RESOLU:
        return _ID_SENEGAL
    try:
        status, texte = await _get_interne("/statistiques/pays", None)
        if status < 400:
            for p in json.loads(texte):
                iso = (p.get("code_iso3") or "").upper()
                nom = (p.get("nom") or "").lower()
                if iso == "SEN" or nom.startswith("séné") or nom.startswith("sene"):
                    _ID_SENEGAL = p.get("id")
                    break
    except Exception:  # noqa: BLE001 — dégradation gracieuse
        _ID_SENEGAL = None
    _ID_SENEGAL_RESOLU = True
    return _ID_SENEGAL


def _client():
    from anthropic import AsyncAnthropic

    return AsyncAnthropic(api_key=get_settings().ANTHROPIC_API_KEY)


def construire_systeme(id_senegal: int | None = None) -> str:
    """Partie STABLE du prompt système (base + catalogue + id du Sénégal),
    identique d'une requête à l'autre → mise en cache. Le contexte de page,
    volatile, est ajouté séparément (bloc non caché) par stream_reponse."""
    systeme = SYSTEME_BASE
    if id_senegal is not None:
        systeme += (
            f"\n\nIDENTIFIANT DÉJÀ CONNU : l'id du Sénégal est {id_senegal}. "
            "Utilise-le directement — NE le cherche PAS dans /statistiques/pays. "
            f"Ex. population/PIB en 2014 : /statistiques/donnees?pays={id_senegal}"
            "&annee_min=2014&annee_max=2014 ; commerce détaillé : "
            f"/statistiques/commerce/kpis?pays_id={id_senegal}&direction=exportateur. "
            "Filtre toujours par année (annee_min/annee_max ou annees) pour garder "
            "des résultats compacts."
        )
    return systeme


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
    id_senegal = await _resoudre_id_senegal()

    # Prompt système en blocs : la partie stable (base + catalogue + id) est mise
    # en cache d'une requête à l'autre ; le contexte de page (volatile) suit, non
    # caché, pour ne pas casser le préfixe partagé.
    systeme: list[dict] = [
        {
            "type": "text",
            "text": construire_systeme(id_senegal),
            "cache_control": {"type": "ephemeral"},
        }
    ]
    if contexte_page:
        systeme.append(
            {
                "type": "text",
                "text": (
                    "CONTEXTE : l'utilisateur consulte actuellement cette page de "
                    "la plateforme. Utilise-le pour interpréter « résume/explique "
                    f"cette page ».\n{contexte_page.strip()}"
                ),
            }
        )
    conversation = list(messages)

    for _ in range(_MAX_ITERATIONS):
        texte_emis = False
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
                    texte_emis = True
                    yield event.delta.text
            final = await stream.get_final_message()

        conversation.append({"role": "assistant", "content": final.content})

        if final.stop_reason != "tool_use":
            return
        # Séparateur : évite que le texte d'un tour se colle à celui du suivant.
        if texte_emis:
            yield "\n\n"

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
