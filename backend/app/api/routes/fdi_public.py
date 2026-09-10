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


def _filtres(observe: str, pays, annee_min, annee_max, secteurs, sous_secteurs,
             activites, types, recherche, sauf: str | None = None) -> tuple[list[str], dict]:
    """Les conditions du périmètre demandé, éventuellement privées d'une facette.

    `sauf` sert au filtrage EN CASCADE : pour compter les options d'une
    facette, on applique tous les filtres SAUF le sien. Sans cela, cocher
    « Communications » réduirait la liste des secteurs à « Communications »
    seul, et l'on ne pourrait plus en ajouter un deuxième.

    Secteur et sous-secteur forment UNE hiérarchie, pas deux facettes : ils se
    combinent par un OU, jamais par un ET. L'écran envoie d'un côté les
    secteurs retenus en entier, de l'autre les sous-secteurs retenus dans les
    secteurs où l'on est descendu ; les additionner par un ET aurait vidé la
    sélection dès qu'on précise un secteur tout en en gardant un autre entier.
    """
    where, params = ["1 = 1"], {}
    # LE PAYS EST UNE FACETTE COMME LES AUTRES : il ne se filtre pas lui-même.
    # Tant qu'un seul périmètre était relevé, l'oubli ne se voyait pas — la
    # liste ne contenait qu'un pays de toute façon. Au deuxième, elle se
    # réduisait au pays retenu une fraction de seconde après le chargement :
    # les autres apparaissaient, puis s'effaçaient, sans plus aucun moyen d'en
    # choisir un.
    if pays and sauf != "pays":
        where.append(f"COALESCE(ro.nom_fr, p.{observe}_brut) = :pays")
        params["pays"] = pays
    if annee_min is not None:
        where.append("p.annee >= :a0"); params["a0"] = annee_min
    if annee_max is not None:
        where.append("p.annee <= :a1"); params["a1"] = annee_max

    if sauf != "secteurs":
        branches = []
        for cle, brut in (("secteurs", secteurs), ("sous_secteurs", sous_secteurs)):
            valeurs = _liste(brut)
            if valeurs:
                branches.append(f"{FACETTES[cle]} = ANY(:{cle})")
                params[cle] = valeurs
        if branches:
            where.append(f"({' OR '.join(branches)})")

    for cle, brut in (("activites", activites), ("types", types)):
        valeurs = _liste(brut)
        if valeurs and cle != sauf:
            where.append(f"{FACETTES[cle]} = ANY(:{cle})")
            params[cle] = valeurs
    if recherche and recherche.strip():
        where.append("(lower(COALESCE(e.nom, p.entreprise_brut)) LIKE :q "
                     "OR lower(COALESCE(p.description_fr, p.description_en, '')) LIKE :q)")
        params["q"] = f"%{recherche.strip().lower()}%"
    return where, params


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
    """De quoi remplir les filtres : uniquement ce que les données portent, et
    uniquement ce qui reste atteignable COMPTE TENU des autres filtres.

    Chaque facette est comptée sous les filtres des AUTRES facettes, jamais
    sous le sien : cocher un secteur doit restreindre les activités proposées,
    pas la liste des secteurs — sinon on ne pourrait plus en cocher un second.
    """
    observe, partenaire = _sens(sens)
    joint = JOINTURES.format(observe=observe, partenaire=partenaire)

    async def compter(expr: str, sauf: str | None):
        where, params = _filtres(observe, pays, annee_min, annee_max,
                                 secteurs, sous_secteurs, activites, types, recherche, sauf)
        return (await db.execute(text(f"""
            SELECT {expr} AS nom, count(*) AS nb
            {joint} WHERE {' AND '.join(where)} AND {expr} IS NOT NULL
            GROUP BY 1 ORDER BY count(*) DESC, 1"""), params)).fetchall()

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
    where_ss, params_ss = _filtres(observe, pays, annee_min, annee_max,
                                   secteurs, sous_secteurs, activites, types, recherche, "secteurs")
    lignes_ss = (await db.execute(text(f"""
        SELECT {FACETTES["sous_secteurs"]} AS nom, {FACETTES["secteurs"]} AS secteur,
               count(*) AS nb
        {joint} WHERE {' AND '.join(where_ss)} AND {FACETTES["sous_secteurs"]} IS NOT NULL
        GROUP BY 1, 2 ORDER BY count(*) DESC, 1"""), params_ss)).fetchall()
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
    db: AsyncSession = Depends(get_db),
):
    """Les projets du périmètre demandé, leurs agrégats et leurs classements.

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

    async def classement(expr: str):
        return (await db.execute(text(f"""
            SELECT {expr} AS nom, count(*) AS nb, sum(p.capex_musd) AS capex,
                   sum(p.emplois) AS emplois
            {base} AND {expr} IS NOT NULL
            GROUP BY 1 ORDER BY count(*) DESC, sum(p.capex_musd) DESC NULLS LAST, 1
            LIMIT 12"""), params)).fetchall()

    tops = {
        "partenaires": await classement(f"COALESCE(rp.nom_fr, p.{partenaire}_brut)"),
        "secteurs":    await classement("COALESCE(s.libelle_fr, p.secteur_brut)"),
        "activites":   await classement("COALESCE(a.libelle_fr, p.activite_brut)"),
        "entreprises": await classement("COALESCE(e.nom, p.entreprise_brut)"),
        "types":       await classement("COALESCE(t.libelle_fr, p.type_brut)"),
    }

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
        ORDER BY p.annee DESC, p.mois DESC NULLS LAST, p.capex_musd DESC NULLS LAST
        LIMIT 400"""), params)).fetchall()

    def nb(v):
        return float(v) if v is not None else None

    return {
        "sens": sens if sens in COTE else "destination",
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
        "tops": {
            nom: [{"nom": r.nom, "nb": r.nb, "capex_musd": nb(r.capex), "emplois": r.emplois}
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
    LEFT JOIN ref_pays          rp ON rp.id = p.pays_source_id
    LEFT JOIN ref_pays          rd ON rd.id = p.pays_dest_id
    LEFT JOIN fdi_secteurs      s  ON s.id  = p.secteur_id
    LEFT JOIN fdi_sous_secteurs ss ON ss.id = p.sous_secteur_id
    LEFT JOIN fdi_activites     a  ON a.id  = p.activite_id
    LEFT JOIN fdi_types_projet  t  ON t.id  = p.type_projet_id
"""

NOM_ENTREPRISE = "COALESCE(e.nom, p.entreprise_brut)"
ORIGINE_ENTREPRISE = "COALESCE(rp.nom_fr, p.pays_source_brut)"


def _filtres_entreprises(recherche, secteurs, sous_secteurs, activites,
                         sauf: str | None = None) -> tuple[list[str], dict]:
    """Les conditions, éventuellement privées d'une facette.

    LE FILTRE PORTE SUR LES PROJETS, PUIS L'ON GROUPE. Une entreprise apparaît
    donc si l'un de ses projets répond, et ses comptes ne portent que sur ces
    projets-là : sous « Communications », « 12 projets » se lit « 12 projets de
    communications », non « 12 projets dont certains de communications ». C'est
    la seule lecture qui se vérifie ligne à ligne dans la vue Projets.
    """
    from app.api.routes.fdi_projets import CLE_DEST, _reduire

    where, params = ["1 = 1"], {}
    if recherche and recherche.strip():
        reduit = _reduire(recherche.strip())
        if reduit:
            where.append(f"position(:q in {CLE_DEST.format(c=NOM_ENTREPRISE)}) > 0")
            params["q"] = reduit

    # ICI SECTEUR ET SOUS-SECTEUR SE COMBINENT PAR UN ET, à la différence de la
    # vue Projets qui les combine par un OU. Ce n'est pas une incohérence : là
    # -bas l'écran offre une sélection MULTIPLE et emboîtée — des secteurs
    # entiers d'un côté, des sous-secteurs précis de l'autre — et un ET viderait
    # la sélection dès qu'on précise un secteur tout en en gardant un second
    # entier. Ici chaque facette n'admet qu'un choix : « Communications » puis
    # « Équipements de communication » se lit comme un affinement, et un OU
    # élargirait au lieu de restreindre — exactement le contraire de ce que le
    # geste annonce.
    for cle, brut in (("secteurs", secteurs), ("sous_secteurs", sous_secteurs),
                      ("activites", activites)):
        valeurs = _liste(brut)
        if valeurs and sauf != cle:
            where.append(f"{FACETTES[cle]} = ANY(:{cle})")
            params[cle] = valeurs
    return where, params


@router.get("/entreprises/perimetre")
async def perimetre_entreprises(
    recherche: str | None = None,
    secteurs: str | None = None,
    sous_secteurs: str | None = None,
    activites: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """De quoi remplir la colonne de filtres.

    LE COMPTE EST UN NOMBRE D'ENTREPRISES, pas de projets : la question posée
    ici est « combien d'investisseurs dans ce secteur », et afficher un nombre
    de projets à côté d'une liste d'entreprises ferait lire l'un pour l'autre.
    """
    async def compter(expr: str, sauf: str, avec_secteur: bool = False):
        where, params = _filtres_entreprises(recherche, secteurs, sous_secteurs,
                                             activites, sauf)
        secteur_col = f", {FACETTES['secteurs']} AS secteur" if avec_secteur else ""
        return (await db.execute(text(f"""
            SELECT {expr} AS nom{secteur_col},
                   count(DISTINCT ({NOM_ENTREPRISE}, {ORIGINE_ENTREPRISE})) AS nb
            {JOINTURES_ENTREPRISE}
            WHERE {' AND '.join(where)} AND {expr} IS NOT NULL
              AND {NOM_ENTREPRISE} IS NOT NULL
            GROUP BY 1{', 2' if avec_secteur else ''}
            ORDER BY 
              count(DISTINCT ({NOM_ENTREPRISE}, {ORIGINE_ENTREPRISE})) DESC, 1"""),
            params)).fetchall()

    lignes_sec = await compter(FACETTES["secteurs"], "secteurs")
    # Les sous-secteurs portent le nom de leur secteur : « Other » revient sous
    # vingt-quatre secteurs chez fDi et ne s'identifie pas seul.
    lignes_ss = await compter(FACETTES["sous_secteurs"], "sous_secteurs", avec_secteur=True)
    lignes_act = await compter(FACETTES["activites"], "activites")

    return {
        "secteurs":      [{"nom": r.nom, "nb": r.nb} for r in lignes_sec],
        "sous_secteurs": [{"nom": r.nom, "secteur": r.secteur, "nb": r.nb} for r in lignes_ss],
        "activites":     [{"nom": r.nom, "nb": r.nb} for r in lignes_act],
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

    return {
        "nom": nom, "origine": origine, "origine_iso": base.origine_iso,
        "projets": base.projets, "pays": base.pays,
        "annees": [base.a0, base.a1],
        "destinations":  await liste("COALESCE(rd.nom_fr, p.pays_dest_brut)"),
        "secteurs":      await liste(FACETTES["secteurs"]),
        "sous_secteurs": await liste(FACETTES["sous_secteurs"]),
        "activites":     await liste(FACETTES["activites"]),
        "types":         await liste(FACETTES["types"]),
    }


@router.get("/entreprises")
async def entreprises_publiques(
    recherche: str | None = None,
    secteurs: str | None = None,
    sous_secteurs: str | None = None,
    activites: str | None = None,
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
    where, params = _filtres_entreprises(recherche, secteurs, sous_secteurs, activites)

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
