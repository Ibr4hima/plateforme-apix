"""Les projets fDi Markets pour la page publique « Investissements projetés ».

Deux routes seulement, et la même règle dans les deux : ce qui est renvoyé est
ce qui a été chargé. Aucun secteur, aucun pays n'est proposé au filtre s'il ne
porte pas de projet — une liste de choix qui ne mène nulle part fait perdre du
temps et laisse croire à une lacune de données.

Le SENS est la clef de lecture de la page. Un même projet se lit de deux côtés :
son pays d'origine (d'où part l'argent) et son pays de destination (où il
arrive). Choisir « destination = Sénégal », c'est demander ce que le pays
reçoit ; choisir « source = France », c'est demander ce que la France implante
ailleurs. Le pays partenaire — celui de l'autre bout — est déduit du sens, pas
demandé à l'utilisateur.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.routes.fdi_projets import SAISIE_EN_TETE
from app.services.fdi_projets import COTE, filtres_multiples as _liste, sens_de_lecture as _sens

router = APIRouter(prefix="/fdi/public", tags=["fdi"])


# Partout où un pays, un secteur ou une activité est nommé, la même règle :
# le libellé français du référentiel, à défaut le libellé brut de la source.
# Un poste non rapproché reste ainsi visible dans les agrégats, sous le nom que
# fDi lui donne — un total muet vaut moins qu'un total complet dont une ligne
# est imparfaite.


# Les expressions de chaque facette, écrites une fois. Le nom qualifie et la
# clé sert de paramètre de requête ; les deux listes qui suivent — filtres et
# comptages — en dépendent, ce qui évite qu'une facette filtre sur une colonne
# et compte sur une autre.
FACETTES = {
    "secteurs":      "COALESCE(s.libelle_fr, p.secteur_brut)",
    "sous_secteurs": "COALESCE(ss.libelle_fr, p.sous_secteur_brut)",
    "activites":     "COALESCE(a.libelle_fr, p.activite_brut)",
    "types":         "COALESCE(t.libelle_fr, p.type_brut)",
}

JOINTURES = """
    FROM fdi_projets p
    LEFT JOIN ref_pays          ro ON ro.id = p.{observe}_id
    LEFT JOIN ref_pays          rp ON rp.id = p.{partenaire}_id
    LEFT JOIN fdi_secteurs      s  ON s.id  = p.secteur_id
    LEFT JOIN fdi_sous_secteurs ss ON ss.id = p.sous_secteur_id
    LEFT JOIN fdi_activites     a  ON a.id  = p.activite_id
    LEFT JOIN fdi_types_projet  t  ON t.id  = p.type_projet_id
    LEFT JOIN fdi_entreprises   e  ON e.id  = p.entreprise_id
"""


def _conditions(observe: str, pays, annee_min, annee_max, secteurs, sous_secteurs,
                activites, types, recherche,
                sauf: str | None = None) -> tuple[list[str], list[str], dict]:
    """Les conditions, séparées en DEUX : le sujet de la page, et les facettes.

    LA DISTINCTION COMMANDE CE QUE LA COLONNE DE FILTRES MONTRE. Le sujet — le
    sens de lecture et le pays observé — dit de quoi la page parle : une liste
    de secteurs n'a aucune raison de proposer des secteurs absents du pays lu.
    Les facettes, elles, ne retirent plus rien de la liste : elles ne font que
    changer les COMPTES.

    C'est ce qui remplace le filtrage en cascade. Une facette cochée réduisait
    les autres listes, et les valeurs sans correspondance disparaissaient — on
    ne pouvait plus voir, ni choisir, ce que la sélection excluait. Elles
    restent désormais toutes affichées, avec le nombre que le clic rendrait
    vraiment : zéro quand la combinaison est vide, ce qui se lit et se comprend.

    `sauf` reste, et pour la même raison qu'avant : une facette ne se compte
    jamais sous son propre filtre, sinon cocher « Communications » ramènerait
    ce seul secteur à un compte non nul et l'on ne pourrait plus en ajouter un
    second en connaissance de cause.

    Secteur et sous-secteur forment UNE hiérarchie, pas deux facettes : ils se
    combinent par un OU, jamais par un ET. L'écran envoie d'un côté les
    secteurs retenus en entier, de l'autre les sous-secteurs retenus dans les
    secteurs où l'on est descendu ; les additionner par un ET aurait vidé la
    sélection dès qu'on précise un secteur tout en en gardant un autre entier.
    """
    contexte, facettes, params = ["1 = 1"], ["1 = 1"], {}
    # LE PAYS NE SE FILTRE PAS LUI-MÊME quand on compte les pays : sans cela la
    # liste se réduirait au pays retenu une fraction de seconde après le
    # chargement, et il n'y aurait plus moyen d'en choisir un autre.
    # Tant qu'un seul périmètre était relevé, l'oubli ne se voyait pas — la
    # liste ne contenait qu'un pays de toute façon. Au deuxième, elle se
    # réduisait au pays retenu une fraction de seconde après le chargement :
    # les autres apparaissaient, puis s'effaçaient, sans plus aucun moyen d'en
    # choisir un.
    if pays and sauf != "pays":
        contexte.append(f"COALESCE(ro.nom_fr, p.{observe}_brut) = :pays")
        params["pays"] = pays

    # LA PÉRIODE EST UNE FACETTE, elle aussi : restreindre 2015-2019 ne doit pas
    # faire disparaître un secteur de la liste, seulement mettre son compte à
    # zéro s'il n'a rien annoncé pendant ces années-là.
    if annee_min is not None:
        facettes.append("p.annee >= :a0"); params["a0"] = annee_min
    if annee_max is not None:
        facettes.append("p.annee <= :a1"); params["a1"] = annee_max

    if sauf != "secteurs":
        branches = []
        for cle, brut in (("secteurs", secteurs), ("sous_secteurs", sous_secteurs)):
            valeurs = _liste(brut)
            if valeurs:
                branches.append(f"{FACETTES[cle]} = ANY(:{cle})")
                params[cle] = valeurs
        if branches:
            facettes.append(f"({' OR '.join(branches)})")

    for cle, brut in (("activites", activites), ("types", types)):
        valeurs = _liste(brut)
        if valeurs and cle != sauf:
            facettes.append(f"{FACETTES[cle]} = ANY(:{cle})")
            params[cle] = valeurs
    if recherche and recherche.strip():
        facettes.append("(lower(COALESCE(e.nom, p.entreprise_brut)) LIKE :q "
                        "OR lower(COALESCE(p.description_fr, p.description_en, '')) LIKE :q)")
        params["q"] = f"%{recherche.strip().lower()}%"
    return contexte, facettes, params


def _filtres(*args, **kw) -> tuple[list[str], dict]:
    """Toutes les conditions réunies — ce que la LISTE et les COMPTEURS appliquent.

    La colonne de filtres, elle, a besoin de les distinguer : voir
    `_conditions`. Ici rien ne se distingue, tout filtre.
    """
    contexte, facettes, params = _conditions(*args, **kw)
    return contexte + facettes, params


@router.get("/perimetre")
async def perimetre(
    sens: str = "destination",
    pays: str | None = None,
    annee_min: int | None = None,
    annee_max: int | None = None,
    secteurs: str | None = None,
    sous_secteurs: str | None = None,
    activites: str | None = None,
    types: str | None = None,
    recherche: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """De quoi remplir les filtres : tout ce que les données portent sur le
    périmètre lu, et le nombre que chaque choix rendrait.

    AUCUNE FACETTE N'EN EXCLUT UNE AUTRE. La liste des secteurs est celle du
    pays observé, entière, qu'on ait coché une activité ou non ; ce que la
    sélection change, c'est le COMPTE en regard — zéro quand la combinaison est
    vide. On voit donc ce qu'on écarte au lieu de le voir disparaître, et l'on
    peut toujours en changer.

    D'où la forme de la requête : le WHERE porte le sujet de la page — sens et
    pays —, et le compte porte les facettes dans un FILTER. Une seule passe, et
    les valeurs à zéro survivent au GROUP BY puisqu'elles satisfont le WHERE.
    """
    observe, partenaire = _sens(sens)
    joint = JOINTURES.format(observe=observe, partenaire=partenaire)

    async def compter(expr: str, sauf: str | None):
        contexte, facettes, params = _conditions(
            observe, pays, annee_min, annee_max,
            secteurs, sous_secteurs, activites, types, recherche, sauf)
        return (await db.execute(text(f"""
            SELECT {expr} AS nom,
                   count(*) FILTER (WHERE {' AND '.join(facettes)}) AS nb
            {joint} WHERE {' AND '.join(contexte)} AND {expr} IS NOT NULL
            GROUP BY 1
            ORDER BY count(*) FILTER (WHERE {' AND '.join(facettes)}) DESC, 1"""),
            params)).fetchall()

    # LES PAYS PROPOSÉS SONT CEUX DONT LE PÉRIMÈTRE EST COMPLET dans ce sens.
    # Un relevé « Dest = Sénégal » fait apparaître la France, la Turquie, le
    # Mali… mais seulement pour ce qu'ils ont envoyé au Sénégal : les proposer
    # comme périmètres à part entière laisserait croire que la plateforme
    # connaît tout ce que la France annonce, alors qu'elle n'en connaît que la
    # part sénégalaise.
    # Un périmètre est un PAYS (« Sénégal ») ou une ZONE (« Afrique ») : un
    # relevé « Dest = Africa » rend complet chacun des pays africains, pas une
    # ligne « Afrique » qui n'existe dans aucun référentiel. Les deux se
    # résolvent d'une seule requête, sur le nom ou sur le continent.
    releves = [r.perimetre for r in (await db.execute(text(
        # « base = projets » n'est pas décoratif : les signaux d'investisseur
        # vivent dans les mêmes lots, et un lot de signaux lu ici ferait
        # déclarer complet un périmètre de projets qui ne l'est pas.
        "SELECT DISTINCT perimetre FROM fdi_lots_import "
        " WHERE base = 'projets' AND sens = :s AND perimetre IS NOT NULL"),
        {"s": sens if sens in COTE else "destination"})).fetchall()]
    # La même requête rend le continent et la région : l'écran range les pays
    # par zone plutôt qu'en une liste de cinquante-cinq lignes, et le
    # groupement est celui de ref_pays — le seul du produit, pour qu'un même
    # pays ne change pas de région d'un écran à l'autre.
    rangs = (await db.execute(text(
        "SELECT nom_fr, continent, region_geo FROM ref_pays "
        " WHERE nom_fr = ANY(:p) OR continent = ANY(:p)"),
        {"p": releves})).fetchall() if releves else []
    complets = {r.nom_fr for r in rangs}
    geo = {r.nom_fr: r for r in rangs}

    lignes_pays = [r for r in await compter(f"COALESCE(ro.nom_fr, p.{observe}_brut)", "pays")
                   if r.nom in complets]
    lignes_sec = await compter(FACETTES["secteurs"], "secteurs")

    # Les sous-secteurs portent le nom de leur secteur : l'écran les emboîte
    # sous lui, et un même libellé — « Other » vit sous vingt-quatre secteurs
    # chez fDi — ne se confond pas avec son homonyme.
    ctx_ss, fac_ss, params_ss = _conditions(observe, pays, annee_min, annee_max,
                                            secteurs, sous_secteurs, activites, types,
                                            recherche, "secteurs")
    lignes_ss = (await db.execute(text(f"""
        SELECT {FACETTES["sous_secteurs"]} AS nom, {FACETTES["secteurs"]} AS secteur,
               count(*) FILTER (WHERE {' AND '.join(fac_ss)}) AS nb
        {joint} WHERE {' AND '.join(ctx_ss)} AND {FACETTES["sous_secteurs"]} IS NOT NULL
        GROUP BY 1, 2
        ORDER BY count(*) FILTER (WHERE {' AND '.join(fac_ss)}) DESC, 1"""),
        params_ss)).fetchall()
    lignes_act = await compter(FACETTES["activites"], "activites")
    lignes_typ = await compter(FACETTES["types"], "types")

    # Les sens qui ont au moins un périmètre relevé. L'écran s'en sert pour
    # n'offrir la bascule que le jour où elle a un sens : proposer « Source »
    # sans lot source afficherait une liste de pays vide.
    dispo = [r.sens for r in (await db.execute(text(
        "SELECT DISTINCT sens FROM fdi_lots_import WHERE base = 'projets' ORDER BY sens"))).fetchall()]

    # Les bornes de la période restent celles du jeu complet : un curseur dont
    # les extrémités bougent à chaque clic devient impossible à manœuvrer.
    bornes = (await db.execute(text(
        "SELECT min(annee) AS a0, max(annee) AS a1, count(*) AS n FROM fdi_projets"))).first()

    return {
        "sens": sens if sens in COTE else "destination",
        "annees": [bornes.a0, bornes.a1],
        "total_projets": bornes.n,
        # Ce que la plateforme peut affirmer sans réserve, dans ce sens.
        "perimetres_complets": sorted(complets),
        "sens_disponibles": dispo,
        "pays": [{"nom": r.nom, "nb": r.nb,
                  # Peuvent être nuls : un pays non rapproché du référentiel
                  # n'a ni continent ni région, et l'écran le range alors sous
                  # « Autre » plutôt que de le laisser tomber.
                  "continent": geo[r.nom].continent if r.nom in geo else None,
                  "region_geo": geo[r.nom].region_geo if r.nom in geo else None}
                 for r in lignes_pays],
        "secteurs": [{"nom": r.nom, "nb": r.nb} for r in lignes_sec],
        "sous_secteurs": [{"nom": r.nom, "secteur": r.secteur, "nb": r.nb} for r in lignes_ss],
        "activites": [{"nom": r.nom, "nb": r.nb} for r in lignes_act],
        "types": [{"nom": r.nom, "nb": r.nb} for r in lignes_typ],
    }


@router.get("/projets")
async def projets(
    sens: str = "destination",
    pays: str | None = None,
    annee_min: int | None = None,
    annee_max: int | None = None,
    secteurs: str | None = None,
    sous_secteurs: str | None = None,
    activites: str | None = None,
    types: str | None = None,
    recherche: str | None = None,
    page: int = 1,
    par_page: int = 30,
    db: AsyncSession = Depends(get_db),
):
    """Les projets du périmètre demandé, leurs agrégats et leurs classements.

    LA PAGINATION NE PORTE QUE SUR LA LISTE. Compteurs, séries annuelles et
    classements restent calculés sur TOUT le filtre — c'est la règle de cet
    écran : un chiffre qu'on ne retrouve pas dans la liste en dessous est un
    chiffre qu'on ne peut pas défendre, mais un total qui ne vaudrait que pour
    trente lignes ne vaudrait rien du tout.

    Les filtres à choix multiple (`secteurs`, `activites`, `types`) reçoivent
    des libellés séparés par une barre verticale : le point-virgule et la
    virgule apparaissent dans les libellés eux-mêmes.

    Tout est calculé sur le MÊME filtre : les compteurs du haut, les séries par
    année et les classements décrivent exactement la table du bas. Un chiffre
    qui ne se retrouve pas dans la liste en dessous est un chiffre qu'on ne
    peut pas défendre en réunion.
    """
    observe, partenaire = _sens(sens)
    where, params = _filtres(observe, pays, annee_min, annee_max,
                             secteurs, sous_secteurs, activites, types, recherche)

    # Une seule expression de jointure, réutilisée par toutes les agrégations :
    # deux formulations différentes finiraient par diverger, et deux chiffres
    # qui se contredisent sur le même écran valent moins que pas de chiffre.
    base = JOINTURES.format(observe=observe, partenaire=partenaire) + \
        f"        WHERE {' AND '.join(where)}\n"

    k = (await db.execute(text(f"""
        SELECT count(*) AS nb,
               sum(p.capex_musd) AS capex, sum(p.emplois) AS emplois,
               count(*) FILTER (WHERE p.capex_estime) AS capex_estimes,
               count(DISTINCT COALESCE(e.nom, p.entreprise_brut)) AS entreprises,
               count(DISTINCT COALESCE(rp.nom_fr, p.{partenaire}_brut)) AS partenaires,
               min(p.annee) AS a0, max(p.annee) AS a1
        {base}"""), params)).first()

    par_annee = (await db.execute(text(f"""
        SELECT p.annee AS annee, count(*) AS nb,
               sum(p.capex_musd) AS capex, sum(p.emplois) AS emplois
        {base} GROUP BY p.annee ORDER BY p.annee"""), params)).fetchall()

    async def classement(expr: str, iso: str | None = None):
        """Un classement, et pour les PAYS le code ISO qui porte leur drapeau.

        `min()` sur le code, et non le code lui-même : on groupe sur le NOM du
        pays, qui peut venir du référentiel ou du libellé brut du relevé, et
        deux lignes d'un même nom pourraient porter des codes différents — l'une
        rapprochée du référentiel, l'autre non. L'agrégat retient alors le code
        connu plutôt que de faire éclater le pays en deux entrées. Il reste nul
        quand aucune ligne n'a été rapprochée : le drapeau disparaît, le nom
        reste.
        """
        col_iso = f", min({iso}) AS iso" if iso else ""
        return (await db.execute(text(f"""
            SELECT {expr} AS nom, count(*) AS nb, sum(p.capex_musd) AS capex,
                   sum(p.emplois) AS emplois{col_iso}
            {base} AND {expr} IS NOT NULL
            GROUP BY 1 ORDER BY count(*) DESC, sum(p.capex_musd) DESC NULLS LAST, 1
            LIMIT 12"""), params)).fetchall()

    tops = {
        "partenaires": await classement(f"COALESCE(rp.nom_fr, p.{partenaire}_brut)", "rp.code_iso2"),
        "secteurs":    await classement("COALESCE(s.libelle_fr, p.secteur_brut)"),
        "activites":   await classement("COALESCE(a.libelle_fr, p.activite_brut)"),
        "entreprises": await classement("COALESCE(e.nom, p.entreprise_brut)"),
        "types":       await classement("COALESCE(t.libelle_fr, p.type_brut)"),
    }

    # Le nombre de pages se déduit du compteur, déjà calculé sur tout le filtre :
    # une requête de comptage de plus ne dirait rien que celui-ci ne dise.
    par_page = max(1, min(par_page, 100))
    page = max(1, page)

    lignes = (await db.execute(text(f"""
        SELECT p.id, p.annee, p.mois,
               COALESCE(e.nom, p.entreprise_brut) AS entreprise,
               p.statut_entreprise,
               COALESCE(ro.nom_fr, p.{observe}_brut) AS pays_observe, ro.code_iso2 AS iso_observe,
               COALESCE(rp.nom_fr, p.{partenaire}_brut) AS pays_partenaire, rp.code_iso2 AS iso_partenaire,
               COALESCE(s.libelle_fr, p.secteur_brut) AS secteur,
               COALESCE(ss.libelle_fr, p.sous_secteur_brut) AS sous_secteur,
               COALESCE(a.libelle_fr, p.activite_brut) AS activite,
               COALESCE(t.libelle_fr, p.type_brut) AS type_projet,
               p.capex_musd, p.capex_estime, p.emplois, p.emplois_estime,
               p.description_fr, p.description_en
        {base}
        -- LE PLUS RÉCEMMENT CONNU D'ABORD, PUIS LE PLUS GROS. À l'intérieur
        -- d'un mois, cet écran range par montant — c'est le classement voulu,
        -- et il ne change pas. Mais un projet saisi à la main se rangeait à son
        -- montant comme n'importe quelle ligne du relevé, donc disparaissait au
        -- milieu de la page alors qu'on vient de l'ajouter. Il passe désormais
        -- en tête de son mois, la dernière saisie d'abord, exactement comme sur
        -- les signaux et sur le tableau d'administration.
        --
        -- L'IDENTIFIANT FERME LE TRI, et ce n'est pas décoratif : deux projets
        -- du même mois au même montant n'avaient aucun départage, si bien que
        -- Postgres pouvait les rendre dans un ordre différent d'une page à
        -- l'autre — donc en montrer un deux fois et en sauter un autre à la
        -- frontière des pages.
        ORDER BY p.annee DESC, p.mois DESC NULLS LAST, {SAISIE_EN_TETE},
                 p.capex_musd DESC NULLS LAST, p.id
        LIMIT :n OFFSET :o"""),
        {**params, "n": par_page, "o": (page - 1) * par_page})).fetchall()

    def nb(v):
        return float(v) if v is not None else None

    return {
        "sens": sens if sens in COTE else "destination",
        "page": page,
        "pages": max(1, -(-k.nb // par_page)) if k.nb else 1,
        "kpis": {
            "projets": k.nb, "capex_musd": nb(k.capex), "emplois": k.emplois,
            "capex_moyen": nb(k.capex) / k.nb if k.capex and k.nb else None,
            "entreprises": k.entreprises, "partenaires": k.partenaires,
            # La part estimée n'est pas un détail de méthode : sur ce périmètre
            # l'essentiel des montants est estimé par le Financial Times, et un
            # total présenté comme un fait serait indéfendable.
            "part_estimee": round(100 * k.capex_estimes / k.nb, 1) if k.nb else None,
            "annees": [k.a0, k.a1],
        },
        "par_annee": [{"annee": r.annee, "nb": r.nb, "capex_musd": nb(r.capex),
                       "emplois": r.emplois} for r in par_annee],
        # `iso` n'accompagne que le classement des PAYS ; les autres l'ignorent.
        "tops": {
            nom: [{"nom": r.nom, "nb": r.nb, "capex_musd": nb(r.capex), "emplois": r.emplois,
                   **({"iso": (r.iso or "").strip() or None} if hasattr(r, "iso") else {})}
                  for r in rows]
            for nom, rows in tops.items()
        },
        "projets": [
            {"id": r.id, "periode": f"{r.annee}-{r.mois:02d}" if r.mois else str(r.annee),
             "annee": r.annee, "entreprise": r.entreprise,
             "entreprise_a_arbitrer": r.statut_entreprise != "resolu",
             # Le code ISO accompagne le nom : c'est lui qui porte le drapeau,
             # partout ailleurs sur la plateforme. Il est nul quand le pays
             # n'a pas été rapproché — le drapeau disparaît, le nom reste.
             "pays": r.pays_observe, "pays_iso": (r.iso_observe or "").strip() or None,
             "partenaire": r.pays_partenaire, "partenaire_iso": (r.iso_partenaire or "").strip() or None,
             "secteur": r.secteur, "sous_secteur": r.sous_secteur,
             "activite": r.activite, "type_projet": r.type_projet,
             "capex_musd": nb(r.capex_musd), "capex_estime": r.capex_estime,
             "emplois": r.emplois, "emplois_estime": r.emplois_estime,
             # Les deux langues séparément : la fiche les présente l'une sous
             # l'autre. Les replier en une seule ferait disparaître l'anglais
             # dès qu'une traduction existe, alors que c'est la version de la
             # source — celle qu'on cite.
             "description_fr": r.description_fr, "description_en": r.description_en}
            for r in lignes
        ],
    }


# ── Les entreprises investisseuses ───────────────────────────────────────────
# TIRÉES DES SEULS PROJETS ANNONCÉS. Les signaux d'investisseur parlent des
# mêmes entreprises, mais ils décrivent des INTENTIONS : les mêler ici ferait
# compter comme investissement ce qui n'est encore qu'une étude.
#
# LE GROUPEMENT SE FAIT SUR LE COUPLE (NOM, PAYS D'ORIGINE), et le second terme
# n'est pas décoratif : une même raison sociale peut désigner deux entités
# distinctes selon le pays d'où part l'investissement — les filiales nationales
# des grands groupes portent souvent le nom du groupe. Grouper sur le seul nom
# les confondrait, et l'écran annoncerait un investisseur unique là où il y en a
# deux.


# Les jointures nécessaires pour lire un projet du point de vue de son
# INVESTISSEUR : son nom, son pays d'origine, et les nomenclatures qui
# qualifient ce qu'il est venu faire.
JOINTURES_ENTREPRISE = """
    FROM fdi_projets p
    LEFT JOIN fdi_entreprises   e  ON e.id  = p.entreprise_id
    LEFT JOIN fdi_entreprises   pa ON pa.id = p.parent_id
    LEFT JOIN ref_pays          rp ON rp.id = p.pays_source_id
    LEFT JOIN ref_pays          rd ON rd.id = p.pays_dest_id
    LEFT JOIN fdi_secteurs      s  ON s.id  = p.secteur_id
    LEFT JOIN fdi_sous_secteurs ss ON ss.id = p.sous_secteur_id
    LEFT JOIN fdi_activites     a  ON a.id  = p.activite_id
"""
# Pas de jointure sur fdi_types_projet : plus rien ici ne lit la nature de
# l'implantation depuis que la fiche ne l'affiche plus. La garder aurait coûté
# une jointure à CHACUNE des requêtes de l'écran — les trois de la liste, les
# trois du périmètre, les quatre de la fiche — pour une colonne que personne ne
# demande.

# ── L'INVESTISSEUR EST LA SOCIÉTÉ MÈRE, PAS LA FILIALE QUI SIGNE ─────────────
# POURQUOI LE RELEVÉ NOMME LES DEUX. fDi enregistre, pour chaque projet,
# l'entité qui investit ET le groupe auquel elle appartient. L'entité est
# souvent une filiale nommée d'après son pays d'implantation — « Standard
# Chartered Kenya Bank », « Orange Mali », « Total Nigeria » — c'est-à-dire un
# nom qui désigne un BUREAU, pas un investisseur.
#
# CE QUE GROUPER SUR LA FILIALE PRODUISAIT : un même groupe éclaté en autant de
# lignes que de pays où il s'est implanté. TotalEnergies apparaissait sous
# vingt-deux raisons sociales, Orange sous vingt et une, Tata sous dix-neuf —
# chacune avec deux ou trois projets, aucune ne disant que le groupe en a
# vingt-six, quarante-neuf, quarante-six. La question que pose cet écran est
# « quels groupes investissent en Afrique » ; elle appelle le nom du groupe.
#
# Le regroupement passe donc à la mère, et 8 701 lignes deviennent 7 245.
#
# LE PAYS D'ORIGINE RESTE DANS LA CLEF, et ce n'est pas un oubli. fDi tronque
# les raisons sociales longues : « National Bank of … » recouvre des banques des
# Émirats, du Koweït, du Kenya et de Grèce, que le seul nom fondrait en un
# investisseur unique. Le pays les sépare. Le prix de cette prudence est connu
# et mesuré : 42 groupes sur 7 199 se présentent sous plusieurs origines, le
# plus souvent parce qu'ils ont réellement déménagé leur siège — International
# Workplace Group du Luxembourg vers la Suisse, Shell des Pays-Bas vers le
# Royaume-Uni. Le jour où l'on préférera l'inverse, c'est ORIGINE_ENTREPRISE
# qui sort de la clef, ici et dans la fiche.
NOM_ENTREPRISE = "COALESCE(pa.nom, p.parent_brut, e.nom, p.entreprise_brut)"
# Le nom porté par le projet lui-même : il ne sert plus à grouper, mais la
# recherche le fouille encore et la fiche l'énumère. Qui tape « Orange Mali »
# doit trouver Orange, et non un écran vide.
NOM_FILIALE = "COALESCE(e.nom, p.entreprise_brut)"
ORIGINE_ENTREPRISE = "COALESCE(rp.nom_fr, p.pays_source_brut)"


def _filtres_entreprises(recherche, secteurs, sous_secteurs, activites,
                         origines=None, sauf: str | None = None) -> tuple[list[str], dict]:
    """Les conditions, éventuellement privées d'une facette.

    LE FILTRE PORTE SUR LES PROJETS, PUIS L'ON GROUPE. Une entreprise apparaît
    donc si l'un de ses projets répond, et ses comptes ne portent que sur ces
    projets-là : sous « Communications », « 12 projets » se lit « 12 projets de
    communications », non « 12 projets dont certains de communications ». C'est
    la seule lecture qui se vérifie ligne à ligne dans la vue Projets.

    ATTENTION À CE QUE CELA VEUT DIRE D'UNE SÉLECTION MULTIPLE. Cocher deux
    secteurs ne retient pas les entreprises présentes dans LES DEUX, mais celles
    présentes dans L'UN OU L'AUTRE — le OU porte sur les projets, et un projet
    n'a qu'un secteur. C'est le même comportement que la vue Projets, où l'on
    coche deux secteurs pour en voir l'union ; l'entreprise qui n'en fait qu'un
    des deux reste donc dans la liste, avec ses seuls projets de ce secteur.

    `sauf` sert au filtrage EN CASCADE : pour compter les options d'une facette,
    on applique tous les filtres sauf le sien.
    """
    from app.api.routes.fdi_projets import CLE_DEST, _reduire

    where, params = ["1 = 1"], {}
    if recherche and recherche.strip():
        reduit = _reduire(recherche.strip())
        if reduit:
            # ON CHERCHE DANS LES DEUX NOMS, celui du groupe et celui de la
            # filiale qui signe. Depuis que l'écran range par société mère,
            # chercher « Orange Mali » sur le seul nom de groupe ne rendrait
            # rien — alors que c'est sous ce nom-là que le projet est annoncé,
            # et donc sous celui-là qu'on l'a lu ailleurs. Le groupe remonte,
            # sous son nom de groupe : c'est lui la ligne de cet écran.
            #
            # La carte ne compte alors que les projets retenus — ceux de la
            # filiale cherchée — comme sous n'importe quel autre filtre de cette
            # colonne. La FICHE, elle, n'est pas filtrée et rend le groupe
            # entier : c'est là qu'on voit les quarante-neuf projets d'Orange.
            where.append(
                f"(position(:q in {CLE_DEST.format(c=NOM_ENTREPRISE)}) > 0"
                f" OR position(:q in {CLE_DEST.format(c=NOM_FILIALE)}) > 0)")
            params["q"] = reduit

    # SECTEUR ET SOUS-SECTEUR FORMENT UNE HIÉRARCHIE, PAS DEUX FACETTES : ils se
    # combinent par un OU, jamais par un ET — exactement comme dans la vue
    # Projets, dont l'écran reprend le filtre emboîté. L'écran envoie d'un côté
    # les secteurs retenus EN ENTIER, de l'autre les sous-secteurs retenus dans
    # les secteurs où l'on est descendu ; les additionner par un ET viderait la
    # sélection dès qu'on précise un secteur tout en en gardant un autre entier.
    #
    # D'où le `sauf` unique pour les deux : compter les sous-secteurs sous le
    # filtre sectoriel les réduirait à ceux déjà retenus, et l'on ne pourrait
    # plus en cocher un second.
    if sauf != "secteurs":
        branches = []
        for cle, brut in (("secteurs", secteurs), ("sous_secteurs", sous_secteurs)):
            valeurs = _liste(brut)
            if valeurs:
                branches.append(f"{FACETTES[cle]} = ANY(:{cle})")
                params[cle] = valeurs
        if branches:
            where.append(f"({' OR '.join(branches)})")

    # L'activité est un groupe À PART, joint aux précédents par un ET : elle dit
    # ce que l'entreprise vient FAIRE, indépendamment de son secteur. Ses
    # valeurs, elles, s'ajoutent entre elles par un OU — cocher deux activités
    # élargit, comme partout ailleurs sur la plateforme.
    valeurs = _liste(activites)
    if valeurs and sauf != "activites":
        where.append(f"{FACETTES['activites']} = ANY(:activites)")
        params["activites"] = valeurs

    # LE PAYS D'ORIGINE EST LA SEULE FACETTE QUI QUALIFIE L'ENTREPRISE ELLE-MÊME
    # et non ce qu'elle a annoncé. Les trois autres décrivent des projets — un
    # secteur, un sous-secteur, une activité — et l'entreprise n'apparaît que
    # parce que l'un des siens répond. L'origine, elle, fait partie de la CLEF
    # de groupement : cocher « France » ne retient pas les entreprises ayant un
    # projet français, il retient les entreprises FRANÇAISES.
    #
    # La conséquence pratique : contrairement aux autres facettes, celle-ci ne
    # change pas les comptes affichés sur les cartes retenues. Une entreprise
    # française garde ses 72 projets, qu'on ait coché « France » ou non.
    #
    # Plusieurs origines cochées s'ajoutent par un OU, comme partout ailleurs.
    valeurs = _liste(origines)
    if valeurs and sauf != "origines":
        where.append(f"{ORIGINE_ENTREPRISE} = ANY(:origines)")
        params["origines"] = valeurs
    return where, params


@router.get("/entreprises/perimetre")
async def perimetre_entreprises(
    recherche: str | None = None,
    secteurs: str | None = None,
    sous_secteurs: str | None = None,
    activites: str | None = None,
    origines: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """De quoi remplir la colonne de filtres.

    LE COMPTE EST UN NOMBRE D'ENTREPRISES, pas de projets : la question posée
    ici est « combien d'investisseurs dans ce secteur », et afficher un nombre
    de projets à côté d'une liste d'entreprises ferait lire l'un pour l'autre.
    """
    # AUCUNE FACETTE N'EN EXCLUT UNE AUTRE : la liste vient de tout le relevé —
    # le WHERE ne porte que l'existence de la valeur — et les facettes passent
    # en FILTER sur le compte. Une combinaison vide s'affiche à zéro au lieu de
    # disparaître de la colonne.
    async def compter(expr: str, sauf: str, avec_secteur: bool = False):
        where, params = _filtres_entreprises(recherche, secteurs, sous_secteurs,
                                             activites, origines, sauf)
        secteur_col = f", {FACETTES['secteurs']} AS secteur" if avec_secteur else ""
        compte = (f"count(DISTINCT ({NOM_ENTREPRISE}, {ORIGINE_ENTREPRISE}))"
                  f" FILTER (WHERE {' AND '.join(where)})")
        return (await db.execute(text(f"""
            SELECT {expr} AS nom{secteur_col}, {compte} AS nb
            {JOINTURES_ENTREPRISE}
            WHERE {expr} IS NOT NULL AND {NOM_ENTREPRISE} IS NOT NULL
            GROUP BY 1{', 2' if avec_secteur else ''}
            ORDER BY {compte} DESC, 1"""), params)).fetchall()

    lignes_sec = await compter(FACETTES["secteurs"], "secteurs")
    # Les sous-secteurs portent le nom de leur secteur : l'écran les emboîte
    # sous lui, et un même libellé — « Other » vit sous vingt-quatre secteurs
    # chez fDi — ne se confond pas avec son homonyme.
    #
    # Ils sont comptés hors du filtre SECTORIEL TOUT ENTIER, secteurs compris :
    # c'est une seule hiérarchie, et les compter sous les secteurs déjà retenus
    # ferait disparaître de la liste ceux qu'on n'a pas encore cochés.
    lignes_ss = await compter(FACETTES["sous_secteurs"], "secteurs", avec_secteur=True)
    lignes_act = await compter(FACETTES["activites"], "activites")
    # Les origines comptent des ENTREPRISES, comme les autres facettes : sous
    # « France · 312 », on lit trois cent douze investisseurs français, non
    # trois cent douze projets français.
    lignes_ori = await compter(ORIGINE_ENTREPRISE, "origines")

    return {
        "secteurs":      [{"nom": r.nom, "nb": r.nb} for r in lignes_sec],
        "sous_secteurs": [{"nom": r.nom, "secteur": r.secteur, "nb": r.nb} for r in lignes_ss],
        "activites":     [{"nom": r.nom, "nb": r.nb} for r in lignes_act],
        "origines":      [{"nom": r.nom, "nb": r.nb} for r in lignes_ori],
    }


@router.get("/entreprises/fiche")
async def fiche_entreprise(
    nom: str,
    origine: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Tout ce que les projets annoncés disent d'un investisseur.

    LA CLEF EST LE COUPLE (NOM, PAYS D'ORIGINE) — celui du groupement. Sans le
    pays, deux entités homonymes venues de deux pays seraient fondues en une, et
    la fiche additionnerait des projets qui n'appartiennent pas au même
    investisseur.

    Les listes sont rendues AVEC LEUR COMPTE : une entreprise peut investir dans
    plusieurs secteurs, et faire ailleurs une activité qu'elle ne fait pas ici.
    Dire « Manufacturing » sans dire combien de fois laisserait croire à une
    activité principale là où il s'agit peut-être d'un projet isolé.
    """
    params = {"nom": nom, "origine": origine}
    ou = (f"{NOM_ENTREPRISE} = :nom AND "
          + (f"{ORIGINE_ENTREPRISE} = :origine" if origine
             else f"{ORIGINE_ENTREPRISE} IS NULL"))

    base = (await db.execute(text(f"""
        SELECT count(*) AS projets,
               count(DISTINCT COALESCE(rd.nom_fr, p.pays_dest_brut)) AS pays,
               min(p.annee) AS a0, max(p.annee) AS a1,
               min(rp.code_iso2) AS origine_iso
        {JOINTURES_ENTREPRISE} WHERE {ou}"""), params)).first()
    if not base or not base.projets:
        raise HTTPException(404, "Entreprise introuvable.")

    async def liste(expr: str):
        return [{"nom": r.nom, "nb": r.nb} for r in (await db.execute(text(f"""
            SELECT {expr} AS nom, count(*) AS nb
            {JOINTURES_ENTREPRISE} WHERE {ou} AND {expr} IS NOT NULL
            GROUP BY 1 ORDER BY count(*) DESC, 1"""), params)).fetchall()]

    # LES FILIALES QUI ONT SIGNÉ SOUS CE GROUPE. C'est la contrepartie du
    # regroupement : l'écran ne montre plus « Orange Mali », il faut donc que la
    # fiche du groupe dise sous quels noms ses projets ont été annoncés —
    # sinon l'information ne serait plus lisible nulle part.
    #
    # LES PROJETS SIGNÉS PAR LE GROUPE LUI-MÊME N'Y FIGURENT PAS. fDi répète le
    # nom du groupe dans la colonne « entreprise » quand aucune filiale n'est
    # distinguée ; l'inscrire comme sa propre filiale n'apprendrait rien et
    # ferait douter du reste de la liste. Une somme des filiales inférieure au
    # total de la fiche s'explique donc par les projets menés en propre.
    filiales = [{"nom": r.nom, "nb": r.nb} for r in (await db.execute(text(f"""
        SELECT {NOM_FILIALE} AS nom, count(*) AS nb
        {JOINTURES_ENTREPRISE} WHERE {ou}
          AND {NOM_FILIALE} IS NOT NULL AND {NOM_FILIALE} <> {NOM_ENTREPRISE}
        GROUP BY 1 ORDER BY count(*) DESC, 1"""), params)).fetchall()]

    return {
        "nom": nom, "origine": origine, "origine_iso": base.origine_iso,
        "projets": base.projets, "pays": base.pays,
        "annees": [base.a0, base.a1],
        "filiales": filiales,
        "destinations":  await liste("COALESCE(rd.nom_fr, p.pays_dest_brut)"),
        "secteurs":      await liste(FACETTES["secteurs"]),
        "sous_secteurs": await liste(FACETTES["sous_secteurs"]),
        "activites":     await liste(FACETTES["activites"]),
        # La NATURE DE L'IMPLANTATION — nouvelle implantation, extension,
        # co-implantation — ne figure plus ici. Elle qualifie un PROJET, et se
        # lit sur sa carte ; au niveau de l'entreprise elle ne disait presque
        # rien : la quasi-totalité des investisseurs n'annonce que des
        # nouvelles implantations, et la ligne se répétait à l'identique d'une
        # fiche à l'autre. La requête qui l'alimentait part avec elle : une
        # fiche de moins à interroger, sur les cinq qu'elle demandait.
    }


@router.get("/entreprises")
async def entreprises_publiques(
    recherche: str | None = None,
    secteurs: str | None = None,
    sous_secteurs: str | None = None,
    activites: str | None = None,
    origines: str | None = None,
    page: int = 1,
    par_page: int = 24,
    db: AsyncSession = Depends(get_db),
):
    """Les investisseurs, un par couple (nom, pays d'origine).

    Chaque fiche porte ce qui se compte sans ambiguïté : le nombre de projets
    annoncés, et le nombre de PAYS DISTINCTS où l'entreprise a annoncé. Les
    montants n'y figurent pas — un total par entreprise mêlerait des projets
    déclarés et des projets estimés par l'algorithme du Financial Times, et
    l'écran ne pourrait plus dire lequel il montre.
    """
    where, params = _filtres_entreprises(recherche, secteurs, sous_secteurs, activites, origines)

    par_page = max(1, min(par_page, 100))
    page = max(1, page)
    filtre = " AND ".join(where)

    groupes = f"""
        SELECT {NOM_ENTREPRISE}     AS nom,
               {ORIGINE_ENTREPRISE} AS origine,
               min(rp.code_iso2)    AS origine_iso,
               count(*)             AS projets,
               count(DISTINCT COALESCE(rd.nom_fr, p.pays_dest_brut)) AS pays
        {JOINTURES_ENTREPRISE}
        WHERE {filtre} AND {NOM_ENTREPRISE} IS NOT NULL
        GROUP BY 1, 2"""

    total = (await db.execute(text(
        f"SELECT count(*) FROM ({groupes}) g"), params)).scalar_one()

    lignes = (await db.execute(text(f"""
        SELECT * FROM ({groupes}) g
        ORDER BY g.projets DESC, g.nom
        LIMIT :n OFFSET :o"""),
        {**params, "n": par_page, "o": (page - 1) * par_page})).fetchall()

    return {
        "entreprises": [{"nom": r.nom, "origine": r.origine, "origine_iso": r.origine_iso,
                         "projets": r.projets, "pays": r.pays} for r in lignes],
        "page": page,
        "pages": max(1, -(-total // par_page)),
        "total": total,
    }


# ── Le rapport des investisseurs ─────────────────────────────────────────────
# CE QU'IL DIT ET QUE LE RAPPORT DES PROJETS NE DIT PAS. Les deux lisent le même
# relevé, mais pas la même unité : là-bas un PROJET, ici un INVESTISSEUR. La
# différence n'est pas de présentation, elle change les réponses. « Quarante-six
# pays d'origine » se lit de la même façon dans les deux ; « les dix premiers
# investisseurs portent 4 % des projets » n'a de sens que lorsque la ligne est
# une entreprise, et c'est pourtant ce chiffre-là qui dit s'il faut démarcher
# quelques grands groupes ou ratisser large.
#
# TOUT EST CALCULÉ SOUS LES FILTRES DE LA COLONNE. Le rapport porte sur ce que
# le lecteur regardait — son secteur, son activité, ses pays d'origine — et non
# sur le relevé entier : un document qui changerait de périmètre au moment où on
# l'ouvre ne serait pas citable.
SENEGAL = "Sénégal"


@router.get("/entreprises/rapport")
async def rapport_entreprises(
    recherche: str | None = None,
    secteurs: str | None = None,
    sous_secteurs: str | None = None,
    activites: str | None = None,
    origines: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Tout ce qu'un décideur peut tirer du relevé, l'investisseur pour unité."""
    where, params = _filtres_entreprises(recherche, secteurs, sous_secteurs,
                                         activites, origines)
    filtre = " AND ".join(where)
    params = {**params, "senegal": SENEGAL}

    # LA MÊME BASE POUR TOUTES LES QUESTIONS. Une seule expression de projet
    # filtré, et un seul regroupement par investisseur : deux formulations
    # finiraient par diverger, et deux chiffres qui se contredisent sur le même
    # document valent moins que pas de chiffre.
    #
    # `au_senegal` est porté par le GROUPE, non par le projet : la question
    # n'est pas « ce projet est-il au Sénégal » mais « cet investisseur y est-il
    # déjà venu », et c'est elle qui sépare un prospect d'un installé.
    SOCLE = f"""
    WITH base AS (
        SELECT {NOM_ENTREPRISE} AS nom, {ORIGINE_ENTREPRISE} AS origine,
               rp.code_iso2 AS origine_iso,
               COALESCE(rd.nom_fr, p.pays_dest_brut) AS dest,
               {FACETTES['secteurs']}  AS secteur,
               {FACETTES['activites']} AS activite,
               p.annee AS annee
        {JOINTURES_ENTREPRISE}
        WHERE {filtre} AND {NOM_ENTREPRISE} IS NOT NULL
    ), g AS (
        SELECT nom, origine, min(origine_iso) AS iso,
               count(*) AS projets,
               count(DISTINCT dest) AS pays,
               min(annee) AS a0, max(annee) AS a1,
               bool_or(dest = :senegal) AS au_senegal
        FROM base GROUP BY nom, origine
    )"""

    async def q(corps: str):
        return (await db.execute(text(SOCLE + corps), params)).fetchall()

    # ── Les compteurs ────────────────────────────────────────────────────────
    k = (await q("""
        SELECT count(*) AS investisseurs, sum(projets) AS projets,
               count(DISTINCT origine) AS origines,
               count(DISTINCT origine) FILTER (WHERE origine IS NOT NULL) AS origines_nommees,
               min(a0) AS a0, max(a1) AS a1,
               count(*) FILTER (WHERE au_senegal) AS au_senegal,
               count(*) FILTER (WHERE projets = 1) AS uniques,
               count(*) FILTER (WHERE pays = 1) AS mono_pays
        FROM g"""))[0]

    total_projets = k.projets or 0

    async def classement(corps: str, limite: int = 15):
        return [dict(r._mapping) for r in await q(corps + f" LIMIT {limite}")]

    # ── Le classement des investisseurs ──────────────────────────────────────
    # `au_senegal` VOYAGE AVEC CHAQUE LIGNE : le document ne sépare plus les
    # présents des absents en deux listes, c'est une colonne du classement qui
    # le dit. Une seule liste à lire, et la question « celui-là est-il déjà
    # venu ? » trouve sa réponse sur la ligne même.
    actifs = await classement("""
        SELECT nom, origine, iso, projets, pays, a0, a1, au_senegal
        FROM g ORDER BY projets DESC, nom""")

    # ── Le classement AU SÉNÉGAL ─────────────────────────────────────────────
    # LE COMPTE N'EST PAS CELUI DU CLASSEMENT AFRICAIN. Il ne retient que les
    # projets dont la DESTINATION est le Sénégal : Orange en a annoncé
    # soixante-douze sur le continent, la question posée ici est combien il en a
    # annoncé ICI. Prendre le total africain ferait lire un chiffre pour un
    # autre, et classerait les groupes dans le mauvais ordre.
    #
    # Le regroupement reste celui de tout l'écran — la maison mère, non la
    # filiale qui signe : « Orange Sénégal » et « Sonatel » sont le même
    # investisseur, et les compter à part le ferait paraître deux fois plus
    # petit qu'il n'est.
    senegal = await classement("""
        SELECT nom, origine, min(origine_iso) AS iso, count(*) AS projets
        FROM base WHERE dest = :senegal
        GROUP BY nom, origine ORDER BY count(*) DESC, nom""", 10)

    # ── Les origines, comptées en INVESTISSEURS ──────────────────────────────
    # Et non en projets : la question est « combien d'entreprises françaises
    # investissent en Afrique », pas « combien de projets français ». Le nombre
    # de projets suit, pour dire si ces entreprises reviennent.
    origines_top = await classement("""
        SELECT origine AS nom, min(iso) AS iso, count(*) AS investisseurs,
               sum(projets) AS projets,
               count(*) FILTER (WHERE au_senegal) AS au_senegal
        FROM g WHERE origine IS NOT NULL
        GROUP BY origine ORDER BY count(*) DESC, origine""")

    # ── Secteurs et activités, à deux comptes ────────────────────────────────
    # LE RAPPORT DES DEUX EST L'INFORMATION. Un secteur à 300 projets pour
    # 40 investisseurs est tenu par quelques habitués qui reviennent ; le même
    # volume réparti sur 250 entreprises est un marché ouvert. Le nombre de
    # projets seul ne distingue pas les deux.
    async def par(colonne: str):
        return [dict(r._mapping) for r in await q(f"""
            SELECT {colonne} AS nom, count(*) AS projets,
                   count(DISTINCT (nom, origine)) AS investisseurs
            FROM base WHERE {colonne} IS NOT NULL
            GROUP BY 1 ORDER BY count(DISTINCT (nom, origine)) DESC, 1 LIMIT 12""")]

    return {
        "kpis": {
            "investisseurs": k.investisseurs, "projets": total_projets,
            "origines": k.origines_nommees,
            "projets_par_investisseur": round(total_projets / k.investisseurs, 2)
                if k.investisseurs else None,
            "annees": [k.a0, k.a1],
            "au_senegal": k.au_senegal,
            "un_seul_projet": k.uniques,
            "un_seul_pays": k.mono_pays,
        },
        "actifs": actifs,
        "senegal": senegal,
        "origines": origines_top,
        "secteurs": await par("secteur"),
        "activites": await par("activite"),
    }
