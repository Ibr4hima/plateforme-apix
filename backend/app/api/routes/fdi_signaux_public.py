"""Signaux d'investisseur — la lecture publique.

CE QUE CETTE VUE DIT, ET QUE « PROJETS ANNONCÉS » NE DIT PAS. Un projet annoncé
est un fait : une entreprise a déclaré qu'elle investissait. Un signal est une
INTENTION — l'entreprise étudie un site, lève des fonds, nomme un responsable
régional. C'est le stade où la prospection a encore prise, et c'est pour cela
qu'une agence de promotion le lit.

UNE MISE EN GARDE QUI DOIT SURVIVRE JUSQU'À L'ÉCRAN. Le tableau de fDi
n'affiche qu'une destination par signal et cache les autres ; le relevé porte
ce qui était visible, et le reste se complète à la main. Un décompte « signaux
citant le Sénégal » est donc un PLANCHER, jamais un total, tant que la
complétion n'est pas faite. La réponse porte ce fait — `plancher` et le nombre
de signaux restant à compléter — pour que l'écran puisse le dire au lieu de
laisser croire à une exhaustivité qu'on n'a pas.

DEUX MONTANTS QUI NE SE SOMMENT PAS. « Capex » est un investissement prévu,
« fonds levés » de l'argent déjà réuni. Ils sont rendus séparément, et rien
ici ne les additionne.

ON COMPTE DES SIGNAUX, ON NE VENTILE PAS LES MONTANTS PAR PAYS. Un signal
visant le Nigeria, le Kenya et le Ghana avec 100 M$ ne vaut ni 33 M$ par pays
ni 100 M$ par pays : les additionner donnerait 300 M$ pour trois pays. Les
montants ne sont donc rendus qu'au niveau de la SÉLECTION, jamais répartis
entre destinations.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.routes.fdi_signaux import LISTES, ORDRE_SIGNAUX, VISE_AFRIQUE

# Même préfixe public que les projets annoncés : les deux vues se lisent l'une
# après l'autre, et leurs adresses doivent se ressembler.
router = APIRouter(prefix="/fdi/public", tags=["fdi"])


def _filtres(destination: str | None, annee_min: int | None, annee_max: int | None,
             secteurs: str | None, activites: str | None, natures: str | None,
             recherche: str | None, sauf: str | None = None,
             origine: str | None = None) -> tuple[list[str], dict]:
    """Les conditions demandées, éventuellement privées d'une facette.

    AUCUNE FACETTE N'EN EXCLUT UNE AUTRE dans la colonne de filtres : ces
    conditions y sont posées en FILTER sur le compte, non en WHERE sur la liste
    — les valeurs restent donc toutes affichées, avec le nombre que le clic
    rendrait, zéro compris. Voir `perimetre_signaux`.

    La LISTE des signaux, elle, les applique toutes en WHERE : c'est le même
    jeu de conditions, employé deux fois de deux façons.

    `sauf` reste : une facette ne se compte jamais sous son propre filtre,
    sinon cocher un secteur ramènerait ce seul secteur à un compte non nul.
    """
    where, params = ["1 = 1"], {}

    # LE PAYS D'OÙ PART L'INTENTION. Il est porté par le signal lui-même, non
    # par une table de liaison : un signal a UNE origine, là où il peut viser
    # plusieurs destinations. La condition est donc directe, sans EXISTS.
    #
    # Le rapprochement se fait sur le libellé français, comme pour toutes les
    # autres facettes : c'est ce que la colonne affiche, et c'est donc ce que le
    # lien renvoie. Un signal dont le pays n'a pas été rattaché n'apparaît sous
    # aucun choix — il n'a pas de nom français à proposer.
    if origine and sauf != "origine":
        where.append("EXISTS (SELECT 1 FROM ref_pays po"
                     "         WHERE po.id = s.pays_source_id AND po.nom_fr = :origine)")
        params["origine"] = origine

    if destination and sauf != "destination":
        # UNE DESTINATION EST UN PAYS OU UNE RÉGION DU MONDE. On interroge les
        # deux : « Afrique » est un choix légitime, et le ranger comme un pays
        # ferait disparaître les intentions continentales.
        where.append("""EXISTS (
            SELECT 1 FROM fdi_signal_destinations d
              LEFT JOIN ref_pays p ON p.id = d.pays_id
              LEFT JOIN fdi_regions_monde r ON r.id = d.region_id
             WHERE d.signal_id = s.id
               AND (p.nom_fr = :dest OR r.libelle_fr = :dest))""")
        params["dest"] = destination

    if annee_min is not None:
        where.append("s.annee >= :a0")
        params["a0"] = annee_min
    if annee_max is not None:
        where.append("s.annee <= :a1")
        params["a1"] = annee_max

    # LA NATURE SE DÉSIGNE PAR SON LIBELLÉ COURT, les autres par leur libellé
    # plein. Ce n'est pas une irrégularité : « Projet à l'étude » est ce que
    # portent les pastilles des cartes, et un filtre qui nommerait autrement la
    # même chose — « Considering Project (New or Expansion) » — obligerait à
    # faire le rapprochement de tête.
    for nom, table, ref, colonne, libelle in (
            ("secteurs",  "fdi_signal_secteurs",  "fdi_secteurs",  "secteur_id",  "libelle_fr"),
            ("activites", "fdi_signal_activites", "fdi_activites", "activite_id", "libelle_fr"),
            ("natures",   "fdi_signal_natures",   "fdi_signaux",   "nature_id",   "libelle_court_fr")):
        choix = {"secteurs": secteurs, "activites": activites, "natures": natures}[nom]
        if not choix or sauf == nom:
            continue
        valeurs = [v.strip() for v in choix.split("|") if v.strip()]
        if not valeurs:
            continue
        where.append(f"""EXISTS (
            SELECT 1 FROM {table} v JOIN {ref} n ON n.id = v.{colonne}
             WHERE v.signal_id = s.id AND n.{libelle} = ANY(:{nom}))""")
        params[nom] = valeurs

    if recherche and recherche.strip() and sauf != "recherche":
        where.append("""(
            EXISTS (SELECT 1 FROM fdi_entreprises e
                     WHERE e.id IN (s.entreprise_id, s.parent_id)
                       AND lower(e.nom) LIKE '%' || lower(:q) || '%')
            OR lower(coalesce(s.description_fr, '')) LIKE '%' || lower(:q) || '%')""")
        params["q"] = recherche.strip()

    return where, params


@router.get("/signaux/perimetre")
async def perimetre_signaux(
    origine: str | None = None,
    destination: str | None = None,
    annee_min: int | None = None,
    annee_max: int | None = None,
    secteurs: str | None = None,
    activites: str | None = None,
    natures: str | None = None,
    recherche: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """De quoi remplir les filtres : uniquement ce que les données portent."""

    # LA LISTE VIENT DE TOUT LE RELEVÉ, LE COMPTE DES FACETTES. D'où le
    # « 1 = 1 » posé en WHERE et les conditions passées en FILTER : une valeur
    # dont la combinaison est vide survit au GROUP BY et s'affiche à zéro, au
    # lieu de disparaître de la colonne.
    async def compter(sql: str, sauf: str | None):
        where, params = _filtres(destination, annee_min, annee_max, secteurs,
                                 activites, natures, recherche, sauf, origine)
        return (await db.execute(
            text(sql.replace("{where}", "1 = 1")
                    .replace("{facettes}", " AND ".join(where))), params)).fetchall()

    # LES PAYS D'OÙ PARTENT LES INTENTIONS. La question précède celle du
    # secteur dans la colonne parce qu'elle précède dans la lecture : on
    # demande d'abord QUI investit, ensuite dans quoi. Un signal dont le pays
    # d'origine n'a pas été rattaché ne compte nulle part ici — il n'a pas de
    # nom français à proposer, et inventer une ligne « non rattaché » ferait un
    # choix qui ne mène à rien.
    origines = await compter("""
        SELECT p.nom_fr AS nom, count(DISTINCT s.id) FILTER (WHERE {facettes}) AS nb
          FROM fdi_signaux_investisseurs s
          JOIN ref_pays p ON p.id = s.pays_source_id
         WHERE {where}
         GROUP BY p.nom_fr
         ORDER BY count(DISTINCT s.id) FILTER (WHERE {facettes}) DESC, p.nom_fr""", "origine")

    # Les destinations proposées : pays et régions du monde dans une seule
    # liste, distingués par leur nature — ce sont deux référentiels, mais une
    # seule question pour qui lit.
    destinations = await compter("""
        SELECT nom, nature, count(DISTINCT signal_id) FILTER (WHERE garde) AS nb FROM (
            SELECT d.signal_id, coalesce(p.nom_fr, r.libelle_fr) AS nom,
                   CASE WHEN d.pays_id IS NOT NULL THEN 'pays' ELSE 'region' END AS nature,
                   ({facettes}) AS garde
            FROM fdi_signaux_investisseurs s
            JOIN fdi_signal_destinations d ON d.signal_id = s.id
            LEFT JOIN ref_pays p ON p.id = d.pays_id
            LEFT JOIN fdi_regions_monde r ON r.id = d.region_id
            WHERE {where} AND coalesce(p.nom_fr, r.libelle_fr) IS NOT NULL
        ) x GROUP BY nom, nature
        -- LES RÉGIONS D'ABORD, LES PAYS ENSUITE. Elles se retrouvaient en tête
        -- par accident — ce sont les plus gros comptes — mais l'écran sépare
        -- les deux groupes d'un filet, et un groupement qui dépend des volumes
        -- se déferait le jour où un pays passerait devant une région.
        ORDER BY (nature = 'pays'),
                 count(DISTINCT signal_id) FILTER (WHERE garde) DESC, nom""", "destination")

    async def facette(table: str, ref: str, colonne: str, sauf: str,
                      libelle: str = "libelle_fr"):
        return await compter(f"""
            SELECT n.{libelle} AS nom,
                   count(DISTINCT s.id) FILTER (WHERE {{facettes}}) AS nb
              FROM fdi_signaux_investisseurs s
              JOIN {table} v ON v.signal_id = s.id
              JOIN {ref} n ON n.id = v.{colonne}
             WHERE {{where}}
             GROUP BY n.{libelle}
             ORDER BY count(DISTINCT s.id) FILTER (WHERE {{facettes}}) DESC, n.{libelle}""", sauf)

    bornes = (await db.execute(text(
        "SELECT min(annee) AS a0, max(annee) AS a1, count(*) AS n "
        "  FROM fdi_signaux_investisseurs"))).first()

    return {
        "annees": [bornes.a0, bornes.a1],
        "total_signaux": bornes.n,
        "origines": [{"nom": r.nom, "nb": r.nb} for r in origines],
        "destinations": [{"nom": r.nom, "nature": r.nature, "nb": r.nb} for r in destinations],
        "secteurs":  [{"nom": r.nom, "nb": r.nb} for r in
                      await facette("fdi_signal_secteurs", "fdi_secteurs", "secteur_id", "secteurs")],
        "activites": [{"nom": r.nom, "nb": r.nb} for r in
                      await facette("fdi_signal_activites", "fdi_activites", "activite_id", "activites")],
        "natures":   [{"nom": r.nom, "nb": r.nb} for r in
                      await facette("fdi_signal_natures", "fdi_signaux", "nature_id",
                                    "natures", "libelle_court_fr")],
    }


@router.get("/signaux")
async def signaux_publics(
    origine: str | None = None,
    destination: str | None = None,
    annee_min: int | None = None,
    annee_max: int | None = None,
    secteurs: str | None = None,
    activites: str | None = None,
    natures: str | None = None,
    recherche: str | None = None,
    page: int = 1,
    par_page: int = 24,
    db: AsyncSession = Depends(get_db),
):
    """Les signaux retenus : compteurs, série annuelle, classements et liste."""
    where, params = _filtres(destination, annee_min, annee_max, secteurs,
                             activites, natures, recherche, None, origine)
    filtre = " AND ".join(where)
    par_page = max(1, min(par_page, 100))
    page = max(1, page)

    kpis = (await db.execute(text(f"""
        SELECT count(*) AS signaux,
               sum(s.funding_musd) AS funding_musd,
               sum(s.capex_musd)   AS capex_musd,
               count(DISTINCT s.entreprise_id) AS entreprises,
               count(DISTINCT s.pays_source_id) AS origines,
               min(s.annee) AS a0, max(s.annee) AS a1,
               -- Ce qui reste à compléter DANS LA SÉLECTION : c'est ce qui dit
               -- au lecteur à quel point le décompte est un plancher.
               count(*) FILTER (WHERE NOT {VISE_AFRIQUE}) AS a_completer
        FROM fdi_signaux_investisseurs s WHERE {filtre}"""), params)).first()

    par_annee = (await db.execute(text(f"""
        SELECT s.annee, count(*) AS nb,
               sum(s.funding_musd) AS funding_musd, sum(s.capex_musd) AS capex_musd
        FROM fdi_signaux_investisseurs s WHERE {filtre}
        GROUP BY s.annee ORDER BY s.annee"""), params)).fetchall()

    # LE CODE ISO DU PAYS SUIT LE NOM QUAND IL Y EN A UN : c'est lui qui donne
    # le drapeau, et un classement de pays sans drapeaux ne ressemble pas au
    # reste de la plateforme. Les classements qui ne portent pas sur des pays —
    # secteurs, activités, entreprises — n'ont pas la colonne, et le rendu s'en
    # passe plutôt que d'inventer un drapeau à un secteur.
    async def top(sql: str, epingle: str | None = None):
        """Un classement. Avec `epingle`, une ligne y est gardée quoi qu'il arrive.

        LE DÉCOUPAGE CHANGE DE CAMP QUAND ON ÉPINGLE. Sans épingle, le SQL
        porte son propre `LIMIT` et rien n'est à faire ici. Avec, il faut
        connaître le rang de la ligne épinglée — que le `LIMIT` aurait
        justement coupée : l'appelant écrit alors sa requête SANS limite et le
        découpage se fait ci-dessous, comme dans `_zones`. On ne le fait que
        pour un classement dont le nombre de lignes est borné par nature — les
        pays d'un continent —, jamais pour les entreprises, qui se comptent par
        milliers.

        Chaque ligne porte son rang RÉEL : une ligne venue du fond s'affiche en
        onzième position mais reste quatorzième au classement, et c'est ce
        second nombre qui a un sens.
        """
        lignes = (await db.execute(text(sql.replace("{filtre}", filtre)), params)).fetchall()
        sortie, tenu = [], False
        for i, r in enumerate(lignes):
            rang = i + 1
            est_epingle = epingle is not None and r.nom == epingle
            if epingle is not None and rang > 10 and not (est_epingle and not tenu):
                continue
            sortie.append({"nom": r.nom, "nb": r.nb, "rang": rang,
                           **({"iso": r.iso} if "iso" in r._mapping else {})})
            if est_epingle:
                tenu = True
        return sortie

    tops = {
        "origines": await top("""
            SELECT p.nom_fr AS nom, p.code_iso2 AS iso, count(*) AS nb
              FROM fdi_signaux_investisseurs s JOIN ref_pays p ON p.id = s.pays_source_id
             WHERE {filtre} GROUP BY p.nom_fr, p.code_iso2
             ORDER BY count(*) DESC, p.nom_fr LIMIT 10"""),
        # PAS DE CLASSEMENT D'ENTREPRISES À L'ÉCHELLE DU CONTINENT. Il existait,
        # et le rapport ne le montre plus : sur toute l'Afrique ses valeurs
        # tiennent en un mouchoir — dix signaux pour la première, huit pour la
        # quatrième —, un palmarès qui se retourne au premier signal relevé. La
        # requête part avec la carte : plus personne ne la lisait, et elle se
        # rejouait à chaque chargement de la vue publique comme du rapport. Le
        # bilan par zone garde le sien, calculé ailleurs (`_zones`), où la
        # comparaison a un sens.
        "secteurs": await top("""
            SELECT n.libelle_fr AS nom, count(DISTINCT s.id) AS nb
              FROM fdi_signaux_investisseurs s
              JOIN fdi_signal_secteurs v ON v.signal_id = s.id
              JOIN fdi_secteurs n ON n.id = v.secteur_id
             WHERE {filtre} GROUP BY n.libelle_fr ORDER BY count(DISTINCT s.id) DESC, n.libelle_fr LIMIT 10"""),
        # Le libellé COURT, celui des pastilles de carte et du filtre : un
        # rapport qui nommerait autrement la même chose obligerait à faire le
        # rapprochement de tête.
        "natures": await top("""
            SELECT n.libelle_court_fr AS nom, count(DISTINCT s.id) AS nb
              FROM fdi_signaux_investisseurs s
              JOIN fdi_signal_natures v ON v.signal_id = s.id
              JOIN fdi_signaux n ON n.id = v.nature_id
             WHERE {filtre} GROUP BY n.libelle_court_fr
             ORDER BY count(DISTINCT s.id) DESC, n.libelle_court_fr LIMIT 10"""),
        # DES PAYS D'AFRIQUE, ET RIEN D'AUTRE. La colonne de filtres mêle pays
        # et régions parce qu'elle sert à choisir ; ce classement-ci sert à
        # comparer, et on ne compare pas « Afrique » à « Nigeria » — la région
        # contient le pays, elle arriverait mécaniquement en tête et écraserait
        # les destinations réelles. Les pays hors du continent sont écartés pour
        # la même raison de lecture : le rapport porte sur l'Afrique.
        # SANS `LIMIT` : le découpage se fait dans `top`, qui doit connaître le
        # rang du Sénégal — que la limite aurait coupé s'il sort des dix
        # premiers. La requête reste bornée par nature : les pays d'Afrique.
        "destinations": await top("""
            SELECT p.nom_fr AS nom, p.code_iso2 AS iso, count(DISTINCT s.id) AS nb
              FROM fdi_signaux_investisseurs s
              JOIN fdi_signal_destinations d ON d.signal_id = s.id
              JOIN ref_pays p ON p.id = d.pays_id
             WHERE {filtre} AND p.continent = 'Afrique'
             GROUP BY p.nom_fr, p.code_iso2
             ORDER BY count(DISTINCT s.id) DESC, p.nom_fr""", epingle="Sénégal"),
        # « NON PRÉCISÉE » N'EST PAS UNE ACTIVITÉ, c'est l'absence d'activité :
        # la source n'a rien dit. La laisser au classement reviendrait à
        # présenter le silence comme le premier métier visé en Afrique.
        "activites": await top("""
            SELECT n.libelle_fr AS nom, count(DISTINCT s.id) AS nb
              FROM fdi_signaux_investisseurs s
              JOIN fdi_signal_activites v ON v.signal_id = s.id
              JOIN fdi_activites n ON n.id = v.activite_id
             WHERE {filtre} AND n.libelle_fr <> 'Non précisée'
             GROUP BY n.libelle_fr
             ORDER BY count(DISTINCT s.id) DESC, n.libelle_fr LIMIT 10"""),
    }

    # LES SIGNAUX LES PLUS LOURDS, sur tout le périmètre et non sur la page
    # lue. Un rapport qui classerait les trente lignes affichées donnerait le
    # plus gros de la page, pas le plus gros du relevé — et personne ne verrait
    # la différence.
    #
    # Les deux montants sont classés SÉPARÉMENT parce qu'ils ne disent pas la
    # même chose : des fonds levés mesurent ce qu'une entreprise a réuni, un
    # investissement prévu ce qu'elle annonce dépenser. Les additionner ferait
    # un total qui ne correspond à rien.
    async def plus_gros(colonne: str):
        return [{"id": r.id, "periode": f"{r.annee}-{r.mois:02d}" if r.mois else str(r.annee),
                 "entreprise": r.entreprise, "origine": r.origine,
                 "montant": float(r.montant) if r.montant is not None else None,
                 "estime": r.estime, "nature": r.nature, "destination": r.destination}
                for r in (await db.execute(text(f"""
            SELECT s.id, s.annee, s.mois,
                   coalesce(e.nom, '—') AS entreprise, po.nom_fr AS origine,
                   s.{colonne}_musd AS montant, s.{colonne}_estime AS estime,
                   (SELECT n.libelle_court_fr FROM fdi_signal_natures v
                      JOIN fdi_signaux n ON n.id = v.nature_id
                     WHERE v.signal_id = s.id ORDER BY v.rang LIMIT 1) AS nature,
                   (SELECT coalesce(p.nom_fr, r.libelle_fr) FROM fdi_signal_destinations d
                      LEFT JOIN ref_pays p ON p.id = d.pays_id
                      LEFT JOIN fdi_regions_monde r ON r.id = d.region_id
                     WHERE d.signal_id = s.id ORDER BY d.rang LIMIT 1) AS destination
              FROM fdi_signaux_investisseurs s
              LEFT JOIN fdi_entreprises e ON e.id = s.entreprise_id
              LEFT JOIN ref_pays po ON po.id = s.pays_source_id
             WHERE {filtre} AND s.{colonne}_musd IS NOT NULL
             -- L'IDENTIFIANT DÉPARTAGE LES EX ÆQUO. Deux signaux à 60 000 M$ —
             -- TotalEnergies et PetroChina — s'échangeaient leurs rangs d'un
             -- chargement à l'autre, faute de second critère : Postgres n'a
             -- aucune obligation de trancher deux lignes égales toujours de la
             -- même façon. Un rapport qu'on cite ne peut pas changer d'ordre
             -- entre le moment où on le lit et celui où on l'imprime.
             ORDER BY s.{colonne}_musd DESC, s.id LIMIT 8"""), params)).fetchall()]

    remarquables = {"funding": await plus_gros("funding"), "capex": await plus_gros("capex")}

    zones = await _zones(db, filtre, params)

    # ON COUPE AVANT DE JOINDRE, comme le tableau des projets : la sélection se
    # fait sur la seule table des signaux, et les quatre listes ne sont
    # construites que pour la page rendue.
    lignes = (await db.execute(text(f"""
        WITH choisis AS MATERIALIZED (
            SELECT s.id FROM fdi_signaux_investisseurs s
             WHERE {filtre}
             ORDER BY {ORDRE_SIGNAUX}
             LIMIT :n OFFSET :o
        )
        SELECT s.id, s.annee, s.mois,
               s.capex_musd, s.capex_estime, s.funding_musd, s.funding_estime,
               s.description_fr, s.description_en,
               e.nom AS entreprise, pa.nom AS parent,
               p.nom_fr AS origine, p.code_iso2 AS origine_iso,
               {LISTES}
        FROM fdi_signaux_investisseurs s
        JOIN choisis c ON c.id = s.id
        LEFT JOIN fdi_entreprises e  ON e.id  = s.entreprise_id
        LEFT JOIN fdi_entreprises pa ON pa.id = s.parent_id
        LEFT JOIN ref_pays p ON p.id = s.pays_source_id
        ORDER BY {ORDRE_SIGNAUX}
    """), {**params, "n": par_page, "o": (page - 1) * par_page})).fetchall()

    def _mois(r) -> str:
        return f"{r.annee}-{r.mois:02d}" if r.mois else str(r.annee)

    return {
        "kpis": {
            "signaux": kpis.signaux,
            "funding_musd": float(kpis.funding_musd) if kpis.funding_musd is not None else None,
            "capex_musd": float(kpis.capex_musd) if kpis.capex_musd is not None else None,
            "entreprises": kpis.entreprises,
            "origines": kpis.origines,
            "annees": [kpis.a0, kpis.a1],
            # LE DÉCOMPTE EST UN PLANCHER, et l'écran doit pouvoir le dire.
            # Ces deux champs sont là pour ça : le nombre de signaux dont la
            # destination africaine n'a pas encore été complétée, et le fait
            # qu'il en reste.
            "a_completer": kpis.a_completer,
            "plancher": kpis.a_completer > 0,
        },
        "par_annee": [{"annee": r.annee, "nb": r.nb,
                       "funding_musd": float(r.funding_musd) if r.funding_musd is not None else None,
                       "capex_musd": float(r.capex_musd) if r.capex_musd is not None else None}
                      for r in par_annee],
        "tops": tops,
        "zones": zones,
        "remarquables": remarquables,
        "page": page,
        "pages": max(1, -(-kpis.signaux // par_page)),
        "signaux": [{
            "id": r.id, "periode": _mois(r),
            "entreprise": r.entreprise, "parent": r.parent,
            "origine": r.origine, "origine_iso": r.origine_iso,
            "capex_musd": float(r.capex_musd) if r.capex_musd is not None else None,
            "capex_estime": r.capex_estime,
            "funding_musd": float(r.funding_musd) if r.funding_musd is not None else None,
            "funding_estime": r.funding_estime,
            "description_fr": r.description_fr, "description_en": r.description_en,
            "destinations": r.destinations, "secteurs": r.secteurs,
            "activites": r.activites, "natures": r.natures,
        } for r in lignes],
    }


# ── Les trois lectures de l'Afrique de l'Ouest ────────────────────────────────
# POURQUOI TROIS ZONES ET NON UNE. « Afrique de l'Ouest » est une géographie,
# la CEDEAO une union politique et commerciale, l'UEMOA une union monétaire.
# Elles ne se recouvrent pas, et la différence est justement ce qu'un décideur
# cherche à lire : un signal qui vise la Mauritanie est ouest-africain sans être
# CEDEAO ; un signal qui vise le Ghana est CEDEAO sans être UEMOA. Les donner
# côte à côte, sous une bascule, laisse la comparaison se faire.
#
# LA COMPOSITION N'EST PAS ÉCRITE ICI. Elle vient de ref_groupements /
# ref_pays_groupements, le référentiel que l'administration tient déjà — le
# même qu'emploie la lecture du commerce extérieur. Une adhésion corrigée
# là-bas se répercute donc sur ce rapport sans toucher au code, et le jour où
# le retrait du Burkina Faso, du Mali et du Niger de la CEDEAO sera acté au
# référentiel, le rapport le suivra de lui-même.
#
# UN GROUPEMENT ABSENT NE FAIT PAS ÉCHOUER LA PAGE : il rend trois listes
# vides, et l'écran n'affiche pas sa bascule.
ZONES_OUEST = ["AFRIQUE_DE_L_OUEST", "CEDEAO", "UEMOA"]

# L'APPARTENANCE SE LIT SUR LES DESTINATIONS, PAS SUR L'ORIGINE. La question
# posée est « où l'argent veut aller », non « d'où il part » : un signal compte
# dans une zone dès qu'il vise au moins un de ses pays. Les destinations
# régionales — « Afrique », « Afrique de l'Ouest » — n'y entrent pas : elles ne
# désignent aucun État, et les faire entrer dans les trois zones à la fois
# gonflerait les trois du même montant sans rien distinguer.
#
# DISTINCT est indispensable : un signal visant le Sénégal ET la Côte d'Ivoire
# appartient une seule fois à l'UEMOA, sans quoi il pèserait double dans le
# classement des secteurs.
_APPARTENANCE = """
    WITH choisis AS MATERIALIZED (
        SELECT s.id FROM fdi_signaux_investisseurs s WHERE {filtre}
    ),
    zones AS (
        SELECT g.code, g.pays_ids FROM ref_groupements g WHERE g.code = ANY(:zones)
    ),
    appart AS (
        SELECT DISTINCT z.code AS zone, c.id AS signal_id, d.pays_id
          FROM choisis c
          JOIN fdi_signal_destinations d ON d.signal_id = c.id
          JOIN zones z ON d.pays_id = ANY(z.pays_ids)
    )
"""


def _abrege(code: str, nom: str) -> str:
    """Le nom court d'une zone : le sigle quand il y en a un.

    POURQUOI PAS SIMPLEMENT `nom_fr`. Le référentiel porte le nom déployé —
    « Communauté économique des États de l'Afrique de l'Ouest » — qui est juste,
    mais qui ne tient pas dans une bascule et qu'aucun décideur n'écrit : on dit
    CEDEAO. Le nom complet reste rendu à côté, pour que le sigle soit lisible
    par qui ne le connaît pas.

    LA RÈGLE PLUTÔT QU'UNE TABLE DE CORRESPONDANCE : un code d'un seul tenant,
    tout en majuscules, EST le sigle de la zone — c'est ainsi que le référentiel
    est tenu (CEDEAO, UEMOA, UE, OCDE). Un code découpé par des soulignés est un
    identifiant technique — AFRIQUE_DE_L_OUEST — et n'a rien à faire à l'écran :
    c'est alors le nom français qui s'affiche. Une zone ajoutée demain suit la
    règle sans qu'on touche à ce fichier.
    """
    return code if "_" not in code and code.isupper() and code.isalpha() else nom


async def _zones(db: AsyncSession, filtre: str, params: dict) -> dict:
    """Secteurs, pays visés et entreprises, pour chacune des trois zones."""

    async def classement(corps: str, epingle: str | None = None) -> dict:
        """Les dix premiers de chaque zone — et, si on le demande, un onzième.

        CHAQUE LIGNE PORTE SON RANG, et non sa position dans la liste renvoyée.
        Les deux coïncidaient tant qu'on ne renvoyait que le haut du
        classement ; dès qu'on y ajoute une ligne venue du fond, le rang doit
        voyager avec elle, sinon un pays quatorzième s'afficherait onzième.

        `epingle` NOMME LA LIGNE QU'ON GARDE QUOI QU'IL ARRIVE. Un rapport lu
        depuis Dakar doit dire où se situe le Sénégal, y compris — surtout —
        quand il n'est pas dans les dix premiers : « absent du haut du
        classement » et « quatorzième sur seize » ne s'équivalent pas, et seul
        le second est une information. La ligne épinglée n'est ajoutée que
        lorsqu'elle manque au haut du classement ; quand elle y figure déjà,
        rien n'est dupliqué.
        """
        sql = (_APPARTENANCE.replace("{filtre}", filtre) + corps)
        rangs: dict = {c: [] for c in ZONES_OUEST}
        vus: dict = {c: 0 for c in ZONES_OUEST}      # le rang atteint dans la zone
        tenus: dict = {c: False for c in ZONES_OUEST}  # l'épinglé est-il déjà pris ?
        for r in (await db.execute(text(sql), {**params, "zones": ZONES_OUEST})).fetchall():
            vus[r.zone] += 1
            rang = vus[r.zone]
            est_epingle = epingle is not None and r.nom == epingle
            # Dix par zone. Le découpage se fait ici plutôt qu'en SQL : une
            # fenêtre numérotée par zone coûterait un tri de plus pour un
            # volume que la liste des zones borne déjà.
            if rang <= 10 or (est_epingle and not tenus[r.zone]):
                rangs[r.zone].append({"nom": r.nom, "nb": r.nb, "rang": rang,
                                      **({"iso": r.iso} if "iso" in r._mapping else {})})
                if est_epingle:
                    tenus[r.zone] = True
        return rangs

    secteurs = await classement("""
        SELECT a.zone, n.libelle_fr AS nom, count(DISTINCT a.signal_id) AS nb
          FROM appart a
          JOIN fdi_signal_secteurs v ON v.signal_id = a.signal_id
          JOIN fdi_secteurs n ON n.id = v.secteur_id
         GROUP BY a.zone, n.libelle_fr
         ORDER BY a.zone, count(DISTINCT a.signal_id) DESC, n.libelle_fr""")

    # LES PAYS VISÉS DE LA ZONE, ET EUX SEULS. `appart` ne porte déjà que les
    # pays membres : un signal visant à la fois le Sénégal et le Kenya compte
    # pour le Sénégal dans l'UEMOA, et le Kenya n'y apparaît pas — ce qu'on
    # demande, c'est la destination DANS la zone, pas le reste du signal.
    destinations = await classement("""
        SELECT a.zone, p.nom_fr AS nom, p.code_iso2 AS iso,
               count(DISTINCT a.signal_id) AS nb
          FROM appart a JOIN ref_pays p ON p.id = a.pays_id
         GROUP BY a.zone, p.nom_fr, p.code_iso2
         ORDER BY a.zone, count(DISTINCT a.signal_id) DESC, p.nom_fr""", epingle="Sénégal")

    entreprises = await classement("""
        SELECT a.zone, e.nom AS nom, count(DISTINCT a.signal_id) AS nb
          FROM appart a
          JOIN fdi_signaux_investisseurs s ON s.id = a.signal_id
          JOIN fdi_entreprises e ON e.id = s.entreprise_id
         GROUP BY a.zone, e.nom
         ORDER BY a.zone, count(DISTINCT a.signal_id) DESC, e.nom""")

    # LE NOMBRE DE SIGNAUX DE LA ZONE, séparément : c'est lui qui donne son
    # poids à un classement. « Premier secteur avec 40 signaux » ne se lit pas
    # de la même façon selon que la zone en porte 60 ou 600.
    totaux = {r.zone: {"signaux": r.signaux, "entreprises": r.entreprises}
              for r in (await db.execute(text(
                  _APPARTENANCE.replace("{filtre}", filtre) + """
        SELECT a.zone, count(DISTINCT a.signal_id) AS signaux,
               count(DISTINCT s.entreprise_id) AS entreprises
          FROM appart a JOIN fdi_signaux_investisseurs s ON s.id = a.signal_id
         GROUP BY a.zone"""), {**params, "zones": ZONES_OUEST})).fetchall()}

    noms = {r.code: r.nom_fr for r in (await db.execute(text(
        "SELECT code, nom_fr FROM ref_groupements WHERE code = ANY(:zones)"),
        {"zones": ZONES_OUEST})).fetchall()}

    return [{
        "code": c,
        "nom": noms.get(c, c),
        "court": _abrege(c, noms.get(c, c)),
        "signaux": totaux.get(c, {}).get("signaux", 0),
        "entreprises": totaux.get(c, {}).get("entreprises", 0),
        "secteurs": secteurs[c],
        "destinations": destinations[c],
        "entreprises_top": entreprises[c],
    } for c in ZONES_OUEST if c in noms]
