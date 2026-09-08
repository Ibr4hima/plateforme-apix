import unicodedata
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.database import get_db
from app.services.fdi_projets import (date_brute, entier_brut, est_tronque,
                                      montant_brut, normaliser)

# Projets fDi Markets — consultation, correction d'une ligne, arbitrage des
# entreprises.
#
# Deux tâches humaines vivent ici, et elles n'ont pas la même PORTÉE :
#
#   * CORRIGER une ligne — ses cases de relevé, ses descriptions — ne touche
#     que cette ligne. Tout passe par une seule route, PATCH /projets/{id} :
#     décrire un projet et corriger son montant sont deux gestes sur le même
#     objet, et les séparer obligeait à ouvrir deux écrans pour une ligne.
#
#   * ARBITRER une entreprise, c'est trancher une ambiguïté que la source a
#     créée en tronquant ses libellés. Par défaut la décision porte sur TOUS les
#     projets qui affichent le même texte — sinon il faudrait la répéter quatre
#     fois pour la Banque de développement.
#
#     MAIS UN TEXTE TRONQUÉ EST UN PRÉFIXE, et un préfixe peut recouvrir
#     plusieurs entreprises réellement distinctes : « Standard Chartere… »
#     désigne aussi bien « Standard Chartered Bank » que « Standard Chartered
#     Kenya Bank ». Trancher en bloc les confondrait, et le regroupement par
#     investisseur serait faux sans que rien ne le dise. L'arbitrage accepte
#     donc une SÉLECTION de projets, et l'écran donne le pays de destination,
#     qui est ce qui permet de les séparer.
router = APIRouter(prefix="/fdi", tags=["fdi"])


def _mois(r) -> str:
    return f"{r.annee}-{r.mois:02d}" if r.mois else str(r.annee)


# L'ORDRE DE fDi, EN SQL. Le tableau se lit par pays de destination, et l'ordre
# est celui de la source — qui range ses libellés sur SA propre écriture,
# tantôt anglaise (« South Africa »), tantôt française (« Côte d Ivoire »).
# Trier sur nos noms français donnerait un autre ordre et rendrait pénible tout
# rapprochement page à page avec fDi, qui est le geste quotidien ici.
#
# La règle : libellé BRUT réduit — décomposé, dépouillé de tout ce qui n'est pas
# ASCII imprimable (accents et points de suspension compris), puis minuscule.
# Elle était calculée dans le navigateur ; elle l'est maintenant en base, parce
# que trier suppose d'avoir tout sous la main, et que justement on ne veut plus
# tout envoyer. Les deux écritures ont été comparées rang par rang sur les
# 55 destinations du relevé : ordre identique, « São Tomé » avant « Senegal »
# compris — le cas qui départage les règles approchantes.
CLE_DEST = "lower(regexp_replace(normalize(coalesce({c}, ''), NFKD), '[^ -~]', '', 'g'))"


def _reduire(v: str) -> str:
    """La même réduction, côté Python : la recherche compare des textes réduits
    des deux côtés, sinon « cote d ivoire » ne trouverait jamais la Côte
    d'Ivoire."""
    return "".join(c for c in unicodedata.normalize("NFKD", v) if " " <= c <= "~").lower()


# La même lecture sert le tableau et la fiche : une seule requête à maintenir,
# donc une seule à corriger le jour où une jointure change.
REQUETE_LIGNES = """
    SELECT p.id, p.lot_id, p.ligne, p.annee, p.mois,
           p.parent_brut, p.entreprise_brut, p.statut_entreprise,
           p.pays_source_brut, p.pays_dest_brut,
           p.capex_musd, p.capex_estime, p.emplois, p.emplois_estime,
           p.description_en, p.description_fr,
           p.secteur_brut, p.sous_secteur_brut, p.activite_brut, p.type_brut,
           p.origine, p.champs_verrouilles,
           p.pays_source_id, p.pays_dest_id, p.secteur_id, p.sous_secteur_id,
           p.activite_id, p.type_projet_id,
           e.nom  AS entreprise_nom,  e.statut_nom AS entreprise_statut,
           pa.nom AS parent_nom,
           s.libelle_fr AS secteur, ss.libelle_fr AS sous_secteur,
           a.libelle_fr AS activite, t.libelle_fr AS type_projet,
           psrc.nom_fr AS pays_source, pdst.nom_fr AS pays_dest,
           l.libelle AS lot,
           CLE_DEST_ICI AS cle_dest
    FROM fdi_projets p
    {pilote}
    LEFT JOIN ref_pays psrc ON psrc.id = p.pays_source_id
    LEFT JOIN ref_pays pdst ON pdst.id = p.pays_dest_id
    LEFT JOIN fdi_entreprises  e  ON e.id  = p.entreprise_id
    LEFT JOIN fdi_entreprises  pa ON pa.id = p.parent_id
    LEFT JOIN fdi_secteurs     s  ON s.id  = p.secteur_id
    LEFT JOIN fdi_sous_secteurs ss ON ss.id = p.sous_secteur_id
    LEFT JOIN fdi_activites    a  ON a.id  = p.activite_id
    LEFT JOIN fdi_types_projet t  ON t.id  = p.type_projet_id
    JOIN fdi_lots_import       l  ON l.id  = p.lot_id
    WHERE {where}
    {ordre}
""".replace("CLE_DEST_ICI", CLE_DEST.format(c="p.pays_dest_brut"))

# CE SUR QUOI PORTE LA RECHERCHE : les huit colonnes que le tableau affiche.
# Chacune montre le libellé du référentiel, ou celui de la source quand le
# rattachement a échoué — on cherche donc exactement ce qu'on voit.
#
# Écrit ainsi, et non par jointures, pour une raison de vitesse : le filtre
# doit pouvoir s'appliquer à la SEULE table des projets, sans rien joindre, de
# façon que la coupe en pages ait lieu AVANT les jointures. Chaque référentiel
# est donc interrogé à part — ils sont petits, quelques milliers de lignes au
# plus — et l'on ne compare le libellé de la source que là où le rattachement
# manque, ce que le « IS NULL » place en tête pour couper court.
FOUILLES = (
    ("entreprise_id",   "fdi_entreprises",   "nom",         "entreprise_brut"),
    ("parent_id",       "fdi_entreprises",   "nom",         "parent_brut"),
    ("secteur_id",      "fdi_secteurs",      "libelle_fr",  "secteur_brut"),
    ("sous_secteur_id", "fdi_sous_secteurs", "libelle_fr",  "sous_secteur_brut"),
    ("activite_id",     "fdi_activites",     "libelle_fr",  "activite_brut"),
    ("pays_source_id",  "ref_pays",          "nom_fr",      "pays_source_brut"),
    ("pays_dest_id",    "ref_pays",          "nom_fr",      "pays_dest_brut"),
    ("type_projet_id",  "fdi_types_projet",  "libelle_fr",  "type_brut"),
)
# LES RÉFÉRENTIELS SONT INTERROGÉS D'ABORD, À PART, et leurs identifiants sont
# passés en tableaux. Écrite « p.entreprise_id IN (SELECT ...) », la condition
# paraît équivalente — mais Postgres n'en fait une semi-jointure, donc un accès
# par index, que si elle est au premier niveau d'un ET. Sous un OU, il la
# ramène à un « sous-plan haché » évalué en filtre, ce qui condamne la requête
# au parcours complet de la table. Avec un tableau constant, « = ANY(...) »
# reste une condition d'index, et les huit branches se réunissent en une
# combinaison de parcours d'index.
TABLES_FOUILLE = (
    ("fdi_entreprises",   "nom"),
    ("fdi_secteurs",      "libelle_fr"),
    ("fdi_sous_secteurs", "libelle_fr"),
    ("fdi_activites",     "libelle_fr"),
    ("ref_pays",          "nom_fr"),
    ("fdi_types_projet",  "libelle_fr"),
)
# « LIKE '%…%' » plutôt que « position(...) > 0 » : les deux disent la même
# chose, mais seul LIKE peut s'appuyer sur un index trigramme (migration 145).
# Sur les neuf mille sept cents entreprises, cela fait la différence entre lire
# chaque nom et n'en toucher que quelques-uns.
REQUETE_CIBLES = " UNION ALL ".join(
    f"SELECT '{table}' AS tbl, id FROM {table} "
    f" WHERE {CLE_DEST.format(c=col)} LIKE '%' || :qlike || '%'"
    for table, col in TABLES_FOUILLE
)


def _pour_like(v: str) -> str:
    """Le texte réduit, échappé pour LIKE. Sans quoi un « % » tapé par
    l'utilisateur ramènerait tout, et un « _ » vaudrait n'importe quelle
    lettre — une recherche qui ment est pire qu'une recherche lente."""
    return v.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# Rattaché : le libellé du référentiel correspond. Chaque branche se ramène à
# « cette colonne vaut l'un de ces identifiants », ce qu'un index sait faire.
_RATTACHES = " OR ".join(
    f"p.{cle} = ANY(:ids_{table})" for cle, table, col, brut in FOUILLES
)
# Non rattaché : c'est alors le libellé de la SOURCE qui s'affiche, donc lui
# qu'il faut fouiller. Aucune de ces comparaisons n'est indexable — il faut
# lire le texte de chaque ligne pour le savoir.
_BRUTS = " OR ".join(
    f"(p.{cle} IS NULL AND position(:q in {CLE_DEST.format(c='p.' + brut)}) > 0)"
    for cle, table, col, brut in FOUILLES
)
# LA GARDE QUI CHANGE TOUT. Les huit comparaisons de texte sont enfermées
# derrière un « au moins un rattachement manque », qui reproduit mot pour mot
# le prédicat d'un index partiel (migration 145). Postgres n'a donc plus besoin
# de parcourir la table pour les évaluer : il va chercher dans cet index les
# rares lignes concernées — aujourd'hui aucune, le relevé étant entièrement
# rattaché — et peut réunir le tout en une combinaison de parcours d'index.
#
# Sans cette garde, une seule branche non indexable suffisait à condamner toute
# la recherche au parcours complet de la table : seize mille huit cent
# soixante-cinq lignes lues et jetées pour en trouver sept.
GARDE = " OR ".join(f"p.{cle} IS NULL" for cle, *_ in FOUILLES)
FOUILLE = f"({_RATTACHES}) OR (({GARDE}) AND ({_BRUTS}))"


def _ligne_table(r) -> dict:
    """CE QUE LE TABLEAU AFFICHE, ET RIEN DE PLUS.

    La liste partait entière — seize mille huit cents lignes — et elle partait
    avec tout ce que la fiche de correction consomme : les onze cases brutes,
    les identifiants de rattachement, les verrous, les deux descriptions.
    Dix-huit méga-octets par chargement, pour un écran qui en montre quinze
    lignes. Elle ne part plus que par pages, et ne porte plus que les neuf
    colonnes affichées.
    """
    return {
        "id": r.id,
        "periode": _mois(r),
        "entreprise": r.entreprise_nom or r.entreprise_brut,
        # Le libellé de la source est nécessaire au tableau : il montre l'écart
        # entre le nom arbitré et ce que fDi a écrit.
        "entreprise_brut": r.entreprise_brut,
        "parent": r.parent_nom or r.parent_brut,
        "statut_entreprise": r.statut_entreprise,
        # Le nom français du référentiel, avec le libellé anglais de la
        # source en secours : un pays non rapproché s'affiche tel que
        # fDi l'écrit, ce qui rend la lacune visible plutôt que muette.
        "source": r.pays_source or r.pays_source_brut,
        "destination": r.pays_dest or r.pays_dest_brut,
        "source_resolue": r.pays_source is not None,
        "destination_resolue": r.pays_dest is not None,
        # Le libellé brut reste disponible quand la résolution a échoué :
        # l'écran affiche alors ce que la source disait, jamais un vide.
        "secteur": r.secteur or r.secteur_brut,
        "sous_secteur": r.sous_secteur or r.sous_secteur_brut,
        "activite": r.activite or r.activite_brut,
        "type_projet": r.type_projet or r.type_brut,
        "capex_musd": float(r.capex_musd) if r.capex_musd is not None else None,
        "capex_estime": r.capex_estime,
        "emplois": r.emplois, "emplois_estime": r.emplois_estime,
        # Le texte de la description ne monte pas ; savoir qu'elle existe suffit
        # à tenir le compteur à jour après un enregistrement.
        "a_description": bool((r.description_en or "").strip()),
    }


def _ligne_fiche(r) -> dict:
    """Le tableau, plus ce que la FICHE DE CORRECTION est seule à consommer."""
    return {
        **_ligne_table(r),
        "description_en": r.description_en, "description_fr": r.description_fr,
        "champs_verrouilles": list(r.champs_verrouilles or []),
        # Les postes auxquels la ligne est rattachée. Le formulaire s'en sert
        # pour PRÉSÉLECTIONNER, au lieu de rendre à l'utilisateur un libellé
        # tronqué qu'aucune liste ne contient.
        "ids": {
            "source": r.pays_source_id, "dest": r.pays_dest_id,
            "secteur": r.secteur_id, "sous_secteur": r.sous_secteur_id,
            "activite": r.activite_id, "type": r.type_projet_id,
        },
        "brut": {
            "date": date_brute(r.annee, r.mois), "parent": r.parent_brut,
            "entreprise": r.entreprise_brut, "source": r.pays_source_brut,
            "dest": r.pays_dest_brut, "secteur": r.secteur_brut,
            "sous_secteur": r.sous_secteur_brut, "activite": r.activite_brut,
            "type": r.type_brut,
            "capex": montant_brut(r.capex_musd, r.capex_estime),
            "emplois": entier_brut(r.emplois, r.emplois_estime),
        },
    }


async def _lire_ligne(db: AsyncSession, projet_id: int) -> dict:
    """Une ligne, entière. Sert la fiche à l'ouverture et le retour du PATCH."""
    r = (await db.execute(text(REQUETE_LIGNES.format(where="p.id = :i", pilote="", ordre="")),
                          {"i": projet_id})).first()
    if not r:
        raise HTTPException(404, "Projet introuvable.")
    return _ligne_fiche(r)


# ── Les projets ───────────────────────────────────────────────────────────────
@router.get("/projets")
async def lister_projets(
    lot_id: int | None = None,
    sans_description: bool = False,
    a_arbitrer: bool = False,
    q: str = "",
    page: int = 1,
    par_page: int = 15,
    db: AsyncSession = Depends(get_db),
):
    """UNE PAGE de projets — tri, recherche et découpage faits en base.

    Les trois étaient faits dans le navigateur, ce qui obligeait à lui envoyer
    les seize mille huit cents lignes pour en afficher quinze. C'était le
    dernier gros temps d'attente de cet écran, et le seul qui grandissait avec
    le relevé.

    Les filtres servent les écrans de travail : « sans description » alimente
    la saisie, « à arbitrer » l'écran des entreprises.
    """
    where = ["1 = 1"]
    params: dict = {}
    if lot_id is not None:
        where.append("p.lot_id = :lot")
        params["lot"] = lot_id
    if sans_description:
        where.append("(p.description_en IS NULL OR p.description_en = '')")
    if a_arbitrer:
        where.append("p.statut_entreprise <> 'resolu'")
    reduit = _reduire(q.strip())
    if reduit:
        cibles: dict[str, list[int]] = {table: [] for table, _ in TABLES_FOUILLE}
        for r in (await db.execute(text(REQUETE_CIBLES),
                                   {"qlike": _pour_like(reduit)})).fetchall():
            cibles[r.tbl].append(r.id)
        params.update({f"ids_{table}": ids for table, ids in cibles.items()})
        # « position » plutôt que LIKE : pas de caractère à échapper, donc pas
        # de « % » tapé par l'utilisateur qui se mettrait à tout ramener.
        where.append(f"({FOUILLE})")
        params["q"] = reduit

    par_page = max(1, min(par_page, 200))
    page = max(1, page)
    params["n"] = par_page
    params["o"] = (page - 1) * par_page

    # SURTOUT PAS de « count(*) OVER () » ici. La fenêtre paraît économique —
    # le décompte voyage avec la page, une requête au lieu de deux — mais elle
    # est calculée AVANT le LIMIT : Postgres doit alors lire et joindre les
    # seize mille huit cents lignes pour n'en rendre que quinze, ce qui annule
    # exactement le bénéfice de la pagination. Sans elle, le plan devient un
    # parcours de l'index d'ordre arrêté à la quinzième ligne.
    #
    # ON COUPE AVANT DE JOINDRE. La sélection, le tri et le découpage se font
    # sur la seule table des projets — l'index d'ordre les rend en s'arrêtant à
    # la quinzième ligne — et les huit jointures ne sont ensuite faites que sur
    # ces quinze-là. Joindre d'abord et couper ensuite obligeait Postgres à
    # construire les seize mille huit cents lignes complètes pour en jeter
    # 16 857 : cent cinquante millisecondes de travail perdu par page tournée.
    ordre = (f"{CLE_DEST.format(c='p.pays_dest_brut')}, p.annee DESC, "
             "p.mois DESC NULLS LAST, p.lot_id, p.ligne")
    # « MATERIALIZED » et une jointure, PAS un « IN ». Écrit
    # « WHERE p.id IN (SELECT id FROM choisis) », Postgres ne pousse pas le
    # filtre : il construit les seize mille huit cents lignes jointes puis n'en
    # garde que quinze par demi-jointure de hachage. En faisant de « choisis »
    # la table PILOTE, les quinze identifiants mènent la danse et chaque
    # jointure se fait sur une clef primaire, quinze fois.
    lignes = (await db.execute(text(f"""
        WITH choisis AS MATERIALIZED (
            SELECT p.id FROM fdi_projets p
             WHERE {" AND ".join(where)}
             ORDER BY {ordre}
             LIMIT :n OFFSET :o
        )
        {REQUETE_LIGNES.format(
            pilote="JOIN choisis c ON c.id = p.id",
            where="1 = 1",
            ordre=f"ORDER BY {ordre}")}
    """), params)).fetchall()

    totaux = (await db.execute(text("""
        SELECT count(*) AS total,
               count(*) FILTER (WHERE description_en IS NULL OR description_en = '') AS sans_desc,
               count(*) FILTER (WHERE statut_entreprise <> 'resolu') AS a_arbitrer
        FROM fdi_projets
    """))).first()

    # Sans filtre, le nombre de lignes retenues EST le total : on ne compte pas
    # deux fois la même chose. C'est le cas ordinaire — l'écran s'ouvre ainsi.
    if len(where) == 1:
        retenues = totaux.total
    else:
        retenues = (await db.execute(text(
            f"SELECT count(*) FROM fdi_projets p WHERE {' AND '.join(where)}"
        ), params)).scalar_one()
    return {
        "projets": [_ligne_table(r) for r in lignes],
        "page": page,
        "pages": max(1, -(-retenues // par_page)),
        "retenues": retenues,
        "totaux": {"total": totaux.total, "sans_description": totaux.sans_desc,
                   "a_arbitrer": totaux.a_arbitrer},
    }


@router.get("/projets/{projet_id}")
async def lire_projet(projet_id: int, db: AsyncSession = Depends(get_db)):
    """Une ligne entière, demandée à l'ouverture de la fiche de correction."""
    return await _lire_ligne(db, projet_id)


# ── L'arbitrage des entreprises ───────────────────────────────────────────────
@router.get("/arbitrage")
async def arbitrage(page: int = 1, par_page: int = 20,
                    db: AsyncSession = Depends(get_db)):
    """UNE PAGE de noms d'entreprises en attente, groupés par texte brut.

    Le groupement est essentiel : « Banque de dévelo… » apparaît sur quatre
    projets, et c'est une seule décision à prendre, pas quatre. L'écran en fait
    une seule ligne.

    Les candidats proposés viennent de deux sources, dans cet ordre : les
    entreprises DÉJÀ rattachées un jour à ce même texte — la mémoire des
    arbitrages — puis celles dont le nom commence par le préfixe. Aucune n'est
    appliquée d'office : un préfixe n'est pas une identité, et deux banques de
    développement peuvent parfaitement le partager.

    LA PAGINATION N'EST PAS UN CONFORT ICI. Deux mille huit cents libellés
    restent à trancher, portant six mille projets : les envoyer tous faisait un
    méga-octet et trois dixièmes de seconde pour un écran qui en montre vingt —
    et l'on ne tranche jamais que celui qu'on lit.
    """
    par_page = max(1, min(par_page, 100))
    page = max(1, page)
    groupes = (await db.execute(text("""
        WITH g AS (
            SELECT p.entreprise_brut AS brut, count(*) AS nb_projets
            FROM fdi_projets p
            WHERE p.statut_entreprise <> 'resolu' AND p.entreprise_brut IS NOT NULL
            GROUP BY p.entreprise_brut
        )
        SELECT g.brut, g.nb_projets,
               count(*) OVER () AS libelles,
               sum(g.nb_projets) OVER () AS projets,
               min(e.id)         AS entreprise_id,
               min(e.nom)        AS entreprise_nom,
               min(e.statut_nom) AS entreprise_statut
        FROM g
        LEFT JOIN fdi_projets p2 ON p2.entreprise_brut = g.brut
                                AND p2.statut_entreprise <> 'resolu'
        LEFT JOIN fdi_entreprises e ON e.id = p2.entreprise_id
        GROUP BY g.brut, g.nb_projets
        ORDER BY g.nb_projets DESC, g.brut
        LIMIT :n OFFSET :o
    """), {"n": par_page, "o": (page - 1) * par_page})).fetchall()
    if not groupes:
        return {"groupes": [], "total": 0, "page": page, "pages": 1, "libelles": 0}
    libelles, total = groupes[0].libelles, int(groupes[0].projets or 0)

    # TROIS REQUÊTES AU TOTAL, PAS TROIS PAR GROUPE. La première version en
    # lançait trois par libellé : sur les six mille lignes restant à arbitrer,
    # cela faisait près de six mille allers-retours et seize secondes d'attente
    # — après CHAQUE décision, puisque l'écran se rechargeait. Le travail
    # d'arbitrage en devenait décourageant, ce qui est le pire défaut d'un
    # outil qu'il faut employer six mille fois.
    #
    # Et elles ne portent que sur les libellés DE LA PAGE : candidats et
    # projets ne sont cherchés que pour ce qui est à l'écran.
    cles = {g.brut: normaliser(g.brut) for g in groupes}
    liste_cles = sorted(set(cles.values()))
    liste_bruts = [g.brut for g in groupes]

    # La mémoire : ce texte a-t-il déjà été tranché ?
    memoire: dict[str, list] = {}
    for r in (await db.execute(text("""
        SELECT a.alias_normalise AS cle, e.id, e.nom
        FROM fdi_entreprise_alias a JOIN fdi_entreprises e ON e.id = a.entreprise_id
        WHERE a.alias_normalise = ANY(:cles) AND e.statut_nom = 'complet'
        ORDER BY a.occurrences DESC, e.nom
    """), {"cles": liste_cles})).fetchall():
        memoire.setdefault(r.cle, []).append(r)

    # Le préfixe : quelles entreprises connues commencent ainsi ? La borne
    # « >= clé ET < clé‖caractère maximal » n'est là que pour laisser l'index
    # sur nom_normalise travailler ; c'est « starts_with » qui décide, car un
    # classement alphabétique n'est pas exactement un test de préfixe.
    prefixes: dict[str, list] = {}
    for r in (await db.execute(text("""
        SELECT c.cle, e.id, e.nom
        FROM unnest(CAST(:cles AS text[])) AS c(cle)
        JOIN LATERAL (
            SELECT id, nom FROM fdi_entreprises
             WHERE statut_nom = 'complet'
               AND nom_normalise >= c.cle
               AND nom_normalise <  c.cle || chr(1114111)
               AND starts_with(nom_normalise, c.cle)
             ORDER BY nom LIMIT 8
        ) e ON true
    """), {"cles": liste_cles})).fetchall():
        prefixes.setdefault(r.cle, []).append(r)

    # Les projets des libellés de la page, d'un coup, regroupés ici.
    par_brut: dict[str, list] = {}
    for r in (await db.execute(text("""
        SELECT p.entreprise_brut AS brut, p.id, p.ligne, p.annee, p.mois,
               p.capex_musd, p.type_brut,
               s.libelle_fr AS secteur, l.libelle AS lot,
               coalesce(d.nom_fr, p.pays_dest_brut)   AS destination,
               coalesce(o.nom_fr, p.pays_source_brut) AS origine
        FROM fdi_projets p
        LEFT JOIN fdi_secteurs s ON s.id = p.secteur_id
        LEFT JOIN ref_pays d ON d.id = p.pays_dest_id
        LEFT JOIN ref_pays o ON o.id = p.pays_source_id
        JOIN fdi_lots_import l ON l.id = p.lot_id
        WHERE p.statut_entreprise <> 'resolu' AND p.entreprise_brut = ANY(:bruts)
        ORDER BY p.annee DESC, p.mois DESC NULLS LAST, p.ligne
    """), {"bruts": liste_bruts})).fetchall():
        par_brut.setdefault(r.brut, []).append(r)

    sortie = []
    for g in groupes:
        cle = cles[g.brut]
        vus, candidats = set(), []
        for r in memoire.get(cle, []):
            vus.add(r.id)
            candidats.append({"id": r.id, "nom": r.nom, "origine": "memoire"})
        for r in prefixes.get(cle, []):
            if r.id not in vus:
                candidats.append({"id": r.id, "nom": r.nom, "origine": "prefixe"})

        sortie.append({
            "brut": g.brut,
            "tronque": est_tronque(g.brut),
            "nb_projets": g.nb_projets,
            "entreprise_id": g.entreprise_id,
            "entreprise_nom": g.entreprise_nom,
            "candidats": candidats,
            "projets": [
                {"id": p.id, "ligne": p.ligne, "periode": _mois(p), "lot": p.lot,
                 "secteur": p.secteur, "type": p.type_brut,
                 # LE PAYS EST LE DISCRIMINANT. « Standard Chartere… » recouvre
                 # « Standard Chartered Bank » et « Standard Chartered Kenya
                 # Bank » : sans la destination sous les yeux, on ne peut pas
                 # les séparer, et l'écran pousse alors à tout confondre.
                 "destination": p.destination, "origine": p.origine,
                 "capex_musd": float(p.capex_musd) if p.capex_musd is not None else None}
                for p in par_brut.get(g.brut, [])
            ],
        })
    # « total » reste le nombre de PROJETS à arbitrer, tous libellés confondus :
    # c'est ce que l'écran annonce, et il ne doit pas rétrécir parce qu'on
    # tourne une page.
    return {"groupes": sortie, "total": total, "libelles": libelles,
            "page": page, "pages": max(1, -(-libelles // par_page))}


class ArbitrageIn(BaseModel):
    brut: str
    # « nommer » : compléter le nom de l'entreprise déjà rattachée.
    # « rattacher » : pointer vers une autre entreprise, déjà connue.
    mode: str
    nom: str | None = None
    entreprise_id: int | None = None
    # Les projets visés. Vide = tous ceux qui portent ce texte, ce qui reste le
    # cas courant : une même banque revient vingt fois sous le même libellé.
    # Renseigné = une PARTIE seulement, parce que le texte tronqué recouvre
    # plusieurs entreprises distinctes.
    projets: list[int] | None = None


@router.post("/arbitrage")
async def trancher(body: ArbitrageIn, db: AsyncSession = Depends(get_db),
                   user: dict = Depends(require_admin)):
    """Applique une décision à tous les projets portant le même texte brut.

    La décision est aussi mémorisée dans la table des alias : la prochaine fois
    que ce texte tronqué se présentera, il sera proposé en premier — mais
    toujours proposé, jamais appliqué d'office.
    """
    signataire = str(user.get("email") or "admin")
    brut = " ".join(body.brut.split())
    cle = normaliser(brut)

    # Combien de projets porteront ENCORE ce texte sans être tranchés, une fois
    # cette décision passée. Zéro veut dire « ce libellé ne désigne qu'elle ».
    # Ce compte se fait AVANT tout le reste, parce qu'il décide de la nature
    # même de la décision : une décision partielle ne peut pas renommer.
    if body.projets:
        restants = (await db.execute(text(
            "SELECT count(*) FROM fdi_projets "
            " WHERE entreprise_brut = :b AND statut_entreprise <> 'resolu' "
            "   AND NOT (id = ANY(:ids))"), {"b": brut, "ids": body.projets})).scalar_one()
    else:
        restants = 0

    if body.mode == "nommer":
        nom = " ".join((body.nom or "").split())
        if not nom:
            raise HTTPException(400, "Le nom complet est obligatoire.")
        if est_tronque(nom):
            raise HTTPException(400, "Ce nom est lui-même tronqué : saisir le nom complet.")
        cible = (await db.execute(text(
            "SELECT id FROM fdi_entreprises WHERE nom_normalise = :c"), {"c": normaliser(nom)})).first()
        if cible:
            entreprise_id = cible.id
        else:
            actuelle = (await db.execute(text(
                "SELECT entreprise_id FROM fdi_projets WHERE entreprise_brut = :b "
                "AND entreprise_id IS NOT NULL LIMIT 1"), {"b": brut})).first()
            if not actuelle:
                raise HTTPException(404, "Aucun projet ne porte ce libellé.")

            # Renommer l'entreprise déjà rattachée épargne de recoller les
            # projets — mais ce n'est légitime que si ce libellé est le SEUL à
            # la porter. Le rapprochement par préfixe range sous une même
            # entreprise le libellé complet et ses formes tronquées : « Atti…
            # Bank » et « Atti… Bank … » partagent un rang. Renommer alors ce
            # rang en « Attijariwafa Bank Egypt » emporterait les projets du
            # libellé complet, qui eux ne parlent pas d'Égypte, et l'écran
            # afficherait un nom que la source n'a jamais écrit en face d'eux.
            partagee = (await db.execute(text(
                "SELECT 1 FROM fdi_projets "
                " WHERE (entreprise_id = :i AND entreprise_brut IS DISTINCT FROM :b) "
                "    OR (parent_id = :i     AND parent_brut     IS DISTINCT FROM :b) "
                " UNION ALL "
                "SELECT 1 FROM fdi_entreprise_alias "
                " WHERE entreprise_id = :i AND alias_normalise <> :c "
                " LIMIT 1"),
                {"i": actuelle.entreprise_id, "b": brut, "c": cle})).first()

            # Une décision PARTIELLE ne renomme jamais, même quand ce libellé
            # est le seul à porter l'entreprise : les projets laissés de côté
            # la portent encore, et les renommer emporterait précisément ceux
            # que l'on cherche à distinguer. « Standard Chartere… » recouvre
            # « Standard Chartered Bank » et « Standard Chartered Kenya Bank » :
            # nommer d'abord les six lignes kényanes, puis les trente et une
            # autres, ne doit pas aboutir à une seule entreprise renommée deux
            # fois — mais à deux entreprises distinctes.
            if not partagee and restants == 0:
                entreprise_id = actuelle.entreprise_id
                await db.execute(text(
                    "UPDATE fdi_entreprises SET nom = :n, nom_normalise = :c, statut_nom = 'complet', "
                    "  modifie_le = :d, modifie_par = :u WHERE id = :i"),
                    {"n": nom, "c": normaliser(nom), "d": datetime.now(timezone.utc),
                     "u": signataire, "i": entreprise_id})
            else:
                # Entreprise partagée, ou décision partielle : on en ouvre une
                # seconde, et seuls les projets VISÉS la rejoindront, plus bas.
                entreprise_id = (await db.execute(text(
                    "INSERT INTO fdi_entreprises (nom, nom_normalise, statut_nom, modifie_le, modifie_par) "
                    "VALUES (:n, :c, 'complet', :d, :u) RETURNING id"),
                    {"n": nom, "c": normaliser(nom), "d": datetime.now(timezone.utc),
                     "u": signataire})).scalar_one()
    elif body.mode == "rattacher":
        if not body.entreprise_id:
            raise HTTPException(400, "Aucune entreprise choisie.")
        entreprise_id = body.entreprise_id
    else:
        raise HTTPException(400, "Mode inconnu.")

    # Les projets visés. Sans sélection, tous ceux qui portent ce texte.
    vises = "AND p.id = ANY(:ids)" if body.projets else ""
    params = {"e": entreprise_id, "d": datetime.now(timezone.utc), "u": signataire, "b": brut}
    if body.projets:
        params["ids"] = body.projets

    touches = (await db.execute(text(
        "UPDATE fdi_projets p SET entreprise_id = :e, statut_entreprise = 'resolu', "
        "  modifie_le = :d, modifie_par = :u "
        f"WHERE p.entreprise_brut = :b AND p.statut_entreprise <> 'resolu' {vises} "
        "RETURNING p.id"), params)).fetchall()

    # Le libellé a-t-il fini par désigner plusieurs entreprises ? La question ne
    # se règle qu'APRÈS l'écriture : la dernière décision d'un partage a beau
    # ne rien laisser derrière elle (restants = 0), le texte reste partagé par
    # les lignes tranchées avant elle. Sans ce second garde-fou, c'est la
    # dernière décision qui poserait l'alias — et rattacherait au prochain
    # import les lignes que l'on vient justement de séparer.
    eclate = (await db.execute(text(
        "SELECT count(DISTINCT entreprise_id) FROM fdi_projets "
        " WHERE entreprise_brut = :b AND entreprise_id IS NOT NULL"), {"b": brut})).scalar_one() > 1

    # LA MÉMOIRE N'EST POSÉE QUE SI LA DÉCISION COUVRE TOUT LE TEXTE. Un alias
    # dit « ce libellé désigne cette entreprise » : l'écrire alors qu'il en
    # désigne deux ferait rattacher d'office, au prochain import, des lignes que
    # l'on vient justement de distinguer à la main. Quand le texte est partagé,
    # on préfère que la question soit reposée.
    if restants == 0 and not eclate:
        await db.execute(text(
            "INSERT INTO fdi_entreprise_alias (alias_brut, alias_normalise, tronque, entreprise_id, decide_par) "
            "VALUES (:b, :c, :t, :e, :u) ON CONFLICT (alias_normalise, entreprise_id) DO UPDATE "
            "SET occurrences = fdi_entreprise_alias.occurrences + 1, decide_par = EXCLUDED.decide_par"),
            {"b": brut, "c": cle, "t": est_tronque(brut), "e": entreprise_id, "u": signataire})

        # La société mère porte le même nom dans la plupart des lignes : on la
        # rattache aussi, sans quoi l'arbitrage serait à refaire côté parent.
        # Réservé au cas non partagé, pour la même raison que l'alias.
        await db.execute(text(
            "UPDATE fdi_projets SET parent_id = :e WHERE parent_brut = :b AND parent_id IS DISTINCT FROM :e"),
            {"e": entreprise_id, "b": brut})
    elif touches:
        # Texte partagé : la mère n'est reprise que sur les LIGNES TRANCHÉES,
        # et seulement là où elle porte ce même texte. Ailleurs, ce libellé
        # désigne peut-être l'autre entreprise : on n'en décide pas ici.
        await db.execute(text(
            "UPDATE fdi_projets SET parent_id = :e "
            " WHERE parent_brut = :b AND parent_id IS DISTINCT FROM :e AND id = ANY(:ids)"),
            {"e": entreprise_id, "b": brut, "ids": [r.id for r in touches]})

    await db.commit()
    return {"entreprise_id": entreprise_id, "projets_rattaches": len(touches),
            "restants": restants}


class ReinitialiserIn(BaseModel):
    """Quel arbitrage défaire. Sans libellé, tous."""
    brut: str | None = None


@router.post("/arbitrage/reinitialiser")
async def reinitialiser_arbitrage(body: ReinitialiserIn, db: AsyncSession = Depends(get_db),
                                  user: dict = Depends(require_admin)):
    """Défait des arbitrages d'entreprise pour les reprendre.

    POURQUOI CELA DOIT EXISTER. La première version de cet écran tranchait par
    TEXTE : une décision valait pour tous les projets qui l'affichaient. Sur un
    libellé tronqué qui recouvre deux entreprises — « Standard Chartere… » pour
    « Standard Chartered Bank » et « Standard Chartered Kenya Bank » — elle les
    confondait, sans que rien ne le signale ensuite. Des décisions ont donc été
    prises de bonne foi sur une méthode fautive ; il faut pouvoir les reprendre.

    CE QUE LA REMISE À ZÉRO DÉFAIT, et rien de plus :

      · les projets repassent « à arbitrer », rattachés à l'entreprise portant
        leur texte brut — l'état exact où l'import les avait laissés ;
      · les alias décidés PAR UN HUMAIN sont effacés, sans quoi le prochain
        import rattacherait d'office ce qu'on vient de détacher. Ceux posés par
        l'import restent : ils enregistrent un rapprochement automatique, qui
        n'est pas une décision.

    CE QU'ELLE NE TOUCHE PAS : les entreprises créées au passage. Elles
    demeurent, et c'est voulu — leurs noms restent proposés comme candidats, ce
    qui est précisément ce dont on a besoin pour refaire le travail plus vite.
    Les descriptions, les corrections de ligne et leurs verrous ne bougent pas
    davantage : ils ne relèvent pas de l'arbitrage.
    """
    signataire = str(user.get("email") or "admin")
    ou, params = "", {"u": signataire, "d": datetime.now(timezone.utc)}
    if body.brut:
        ou = "AND p.entreprise_brut = :b"
        params["b"] = " ".join(body.brut.split())

    # Chaque projet retrouve l'entreprise qui porte SON texte brut. Elle existe
    # déjà dans la quasi-totalité des cas — l'import la crée — mais un arbitrage
    # « nommer » a pu la renommer ; on la recrée alors.
    # SEULS LES LIBELLÉS TRONQUÉS sont concernés. Un nom complet n'est jamais
    # passé par l'arbitrage : l'import le tient pour résolu d'emblée, puisqu'il
    # n'y a rien à trancher. Le renvoyer ici jetterait des milliers de lignes
    # justes dans une file d'attente qui ne les concerne pas.
    bruts = [r.b for r in (await db.execute(text(
        f"SELECT DISTINCT p.entreprise_brut AS b FROM fdi_projets p "
        f" WHERE p.entreprise_brut IS NOT NULL AND p.statut_entreprise = 'resolu' {ou}"),
        params)).fetchall() if est_tronque(r.b)]

    for brut in bruts:
        cle = normaliser(brut)
        r = (await db.execute(text(
            "SELECT id FROM fdi_entreprises WHERE nom_normalise = :c"), {"c": cle})).first()
        if not r:
            r = (await db.execute(text(
                "INSERT INTO fdi_entreprises (nom, nom_normalise, statut_nom, modifie_par) "
                "VALUES (:n, :c, :s, :u) RETURNING id"),
                {"n": brut, "c": cle, "s": "tronque", "u": signataire})).first()
        await db.execute(text(
            "UPDATE fdi_projets SET entreprise_id = :e, "
            "  statut_entreprise = :s, modifie_le = :d, modifie_par = :u "
            " WHERE entreprise_brut = :b AND statut_entreprise = 'resolu'"),
            {"e": r.id, "s": "propose", "b": brut, "d": params["d"], "u": signataire})
        # La mère aussi. Trancher rattachait la société mère portant le même
        # texte ; laisser ce rattachement en place, c'est laisser debout la
        # moitié de la décision que l'on vient de défaire — et le nom fautif
        # continuerait de s'afficher en colonne « Société mère ».
        await db.execute(text(
            "UPDATE fdi_projets SET parent_id = :e "
            " WHERE parent_brut = :b AND parent_id IS DISTINCT FROM :e"),
            {"e": r.id, "b": brut})
        await db.execute(text(
            "DELETE FROM fdi_entreprise_alias "
            " WHERE alias_normalise = :c AND decide_par IS DISTINCT FROM 'import'"), {"c": cle})

    n = (await db.execute(text(
        "SELECT count(*) FROM fdi_projets WHERE statut_entreprise <> 'resolu'"))).scalar_one()
    await db.commit()
    return {"libelles_repris": len(bruts), "a_arbitrer": n}


@router.get("/entreprises")
async def lister_entreprises(recherche: str = "", db: AsyncSession = Depends(get_db)):
    """Les entreprises connues, pour le choix « rattacher à une autre »."""
    params: dict = {}
    where = "WHERE statut_nom = 'complet'"
    if recherche.strip():
        where += " AND nom_normalise LIKE :q"
        params["q"] = f"%{normaliser(recherche)}%"
    lignes = (await db.execute(text(f"""
        SELECT e.id, e.nom, e.statut_nom,
               (SELECT count(*) FROM fdi_projets p WHERE p.entreprise_id = e.id) AS nb_projets
        FROM fdi_entreprises e {where} ORDER BY e.nom LIMIT 40
    """), params)).fetchall()
    return [{"id": r.id, "nom": r.nom, "nb_projets": r.nb_projets} for r in lignes]


@router.get("/referentiels")
async def referentiels(db: AsyncSession = Depends(get_db)):
    """Les nomenclatures, pour que la saisie CHOISISSE au lieu de retaper.

    Chaque poste porte ses deux libellés. L'anglais est celui que l'on lit chez
    fDi, et donc celui qu'on cherche des yeux en recopiant une capture ; le
    français est celui que la plateforme affichera. Les donner ensemble évite
    d'avoir à traduire de tête dans un sens à la saisie et dans l'autre à la
    relecture — et c'est l'anglais qui repart au serveur, où l'analyseur de
    l'import le rapproche comme n'importe quelle ligne du relevé.

    Les sous-secteurs portent leur secteur : l'écran n'a plus qu'à ne proposer
    que ceux du secteur choisi, au lieu des 273 de la nomenclature entière.

    Tout tient en cinq cents lignes ; on les envoie d'un coup plutôt que de
    faire une requête par frappe.
    """
    from app.services.fdi_projets import libelles_pays_en

    async def q(sql: str) -> list:
        return [dict(r._mapping) for r in (await db.execute(text(sql))).fetchall()]

    # ref_pays ne porte pas de nom anglais, et n'a pas à en porter : la graphie
    # de la source vit dans fdi_pays.csv, à côté de son motif. On rapproche donc
    # ici par le code ISO. Un pays que la correspondance ignore n'est pas
    # proposé — le proposer reviendrait à le faire refuser à l'enregistrement.
    en = libelles_pays_en()
    pays = [{"id": p["id"], "fr": p["fr"], "en": en[p["code"]]}
            for p in await q("SELECT id, nom_fr AS fr, code_iso3 AS code FROM ref_pays "
                             " WHERE code_iso3 IS NOT NULL ORDER BY nom_fr")
            if p["code"] in en]

    return {
        "types": await q(
            "SELECT id, libelle_en AS en, libelle_fr AS fr FROM fdi_types_projet ORDER BY ordre"),
        "secteurs": await q(
            "SELECT id, libelle_en AS en, libelle_fr AS fr FROM fdi_secteurs ORDER BY libelle_en"),
        "sous_secteurs": await q(
            "SELECT id, secteur_id, libelle_en AS en, libelle_fr AS fr "
            "FROM fdi_sous_secteurs ORDER BY libelle_en"),
        "activites": await q(
            "SELECT id, libelle_en AS en, libelle_fr AS fr FROM fdi_activites ORDER BY libelle_en"),
        "pays": pays,
    }


# ── Corriger une ligne, en ajouter une ────────────────────────────────────────
# Ces deux gestes passent par le MÊME analyseur que l'import — resoudre_ligne.
# On saisit donc des cases de relevé (« Mar 2014 », « * $9.60m »), pas des
# colonnes de base : une seule écriture de la donnée, une seule interprétation
# des astérisques, des troncatures et des échelles.
class LigneIn(BaseModel):
    date: str = ""
    parent: str = ""
    entreprise: str = ""
    source: str = ""
    dest: str = ""
    secteur: str = ""
    sous_secteur: str = ""
    activite: str = ""
    type: str = ""
    capex: str = ""
    emplois: str = ""
    # Les descriptions ne sont PAS des cases de relevé : la source ne les donne
    # pas dans son tableau, elles s'écrivent à la main. Elles voyagent avec la
    # ligne pour qu'un seul enregistrement suffise, mais ne passent jamais par
    # l'analyseur — il n'y a rien à y interpréter.
    description_en: str = ""
    description_fr: str = ""


def _texte(v: str) -> str | None:
    """Une description vide vaut « pas de description », pas « description vide ».
    C'est sur ce NULL que se comptent les lignes qui restent à décrire."""
    return (v or "").strip() or None


def _brutes(body: LigneIn) -> dict:
    """Les cases telles qu'elles sont saisies, espaces normalisés. Une case vide
    devient None : « pas renseigné » et « chaîne vide » ne doivent pas cohabiter
    dans une colonne où l'on comptera ensuite les manques."""
    def net(v: str) -> str | None:
        v = " ".join((v or "").split())
        return v or None
    return {c: net(getattr(body, c)) for c in
            ("date", "parent", "entreprise", "source", "dest", "secteur",
             "sous_secteur", "activite", "type", "capex", "emplois")}


async def _preparer(db: AsyncSession, body: LigneIn, utilisateur: str) -> tuple[dict, dict, list]:
    """Analyse une saisie et rend (cases brutes, colonnes, manques)."""
    from app.services.fdi_projets import (LigneInvalide, _referentiels,
                                          lire_pays_csv, resoudre_ligne)
    brutes = _brutes(body)
    if not brutes["date"]:
        raise HTTPException(400, "La période est obligatoire : sans date, le projet ne peut être ni "
                                 "classé dans le temps ni comparé aux autres.")
    try:
        col, manques = await resoudre_ligne(
            db, {**brutes, "ligne": None}, await _referentiels(db), lire_pays_csv(), utilisateur)
    except LigneInvalide as e:
        # Un montant ou une date illisible est refusé au lieu d'être deviné :
        # la même règle qu'à l'import, et pour la même raison.
        raise HTTPException(400, str(e)) from e
    return brutes, col, manques


def _avertissements(manques: list) -> list[str]:
    """Ce qui n'a pas pu être rattaché. La ligne est enregistrée quand même —
    c'est déjà ce que fait l'import — mais on le DIT, sinon la valeur brute
    resterait dans la table sans que personne ne sache qu'elle n'a rien touché."""
    return [f"{champ} « {brut} » → {verdict}" for _, champ, brut, verdict in manques]


@router.patch("/projets/{projet_id}")
async def corriger_projet(projet_id: int, body: LigneIn,
                          db: AsyncSession = Depends(get_db),
                          user: dict = Depends(require_admin)):
    """Corrige une ligne, et fait en sorte que la correction survive au réimport.

    Les colonnes effectivement changées sont ajoutées à champs_verrouilles : le
    prochain import du lot réécrira tout le reste depuis le CSV mais laissera
    celles-là. Sans ce marquage, la correction disparaîtrait au premier import
    suivant, sans un mot — ce qui serait pire que de ne pas pouvoir corriger.

    Les verrous déjà posés sont conservés même si la valeur revient à celle du
    CSV : c'est une décision humaine, elle ne se retire pas parce que les deux
    valeurs coïncident aujourd'hui.
    """
    from app.services.fdi_projets import CHAMPS_MODIFIABLES

    avant = (await db.execute(text(
        "SELECT * FROM fdi_projets WHERE id = :i"), {"i": projet_id})).first()
    if not avant:
        raise HTTPException(404, "Projet introuvable.")

    signataire = str(user.get("email") or "admin")
    _, col, manques = await _preparer(db, body, signataire)

    def _pareil(a, b) -> bool:
        """Comparaison en nombres pour les montants : la base rend un
        Decimal(« 9.60 ») là où l'analyseur donne 9.6, et les déclarer
        différents poserait un verrou que personne n'a demandé."""
        if isinstance(a, (int, float)) or isinstance(b, (int, float)):
            try:
                return a is not None and b is not None and round(float(a), 2) == round(float(b), 2)
            except (TypeError, ValueError):
                return a == b
        return a == b

    verrous = set(avant.champs_verrouilles or [])
    for c in CHAMPS_MODIFIABLES:
        if not _pareil(getattr(avant, c), col[c]):
            verrous.add(c)

    # L'entreprise corrigée à la main est tenue pour arbitrée : c'est le geste
    # même que l'écran d'arbitrage produit, et le refaire passer par « à
    # arbitrer » obligerait à trancher deux fois la même chose.
    statut = "resolu" if "entreprise_brut" in verrous else col["statut_entreprise"]

    await db.execute(text("""
        UPDATE fdi_projets SET
            annee = :annee, mois = :mois,
            parent_brut = :parent_brut, parent_id = :parent_id,
            entreprise_brut = :entreprise_brut, entreprise_id = :entreprise_id,
            statut_entreprise = :statut,
            pays_source_brut = :pays_source_brut, pays_source_id = :pays_source_id,
            pays_dest_brut = :pays_dest_brut, pays_dest_id = :pays_dest_id,
            secteur_brut = :secteur_brut, secteur_id = :secteur_id,
            sous_secteur_brut = :sous_secteur_brut, sous_secteur_id = :sous_secteur_id,
            activite_brut = :activite_brut, activite_id = :activite_id,
            type_brut = :type_brut, type_projet_id = :type_projet_id,
            capex_musd = :capex_musd, capex_estime = :capex_estime,
            emplois = :emplois, emplois_estime = :emplois_estime,
            description_en = :den, description_fr = :dfr,
            champs_verrouilles = :verrous,
            modifie_le = :d, modifie_par = :u
        WHERE id = :i
    """), {**col, "statut": statut, "verrous": sorted(verrous),
           # Pas de verrou sur les descriptions : elles n'en ont pas besoin.
           # Le réimport les préserve déjà tant que la ligne décrit le même
           # projet (cf. empreinte), et aucune colonne du CSV ne peut les
           # écraser puisque la source ne les fournit pas.
           "den": _texte(body.description_en), "dfr": _texte(body.description_fr),
           "d": datetime.now(timezone.utc), "u": signataire, "i": projet_id})
    await db.commit()
    # LA LIGNE CORRIGÉE REPART AVEC LA RÉPONSE. L'écran la remplace sur place
    # au lieu de recharger les seize mille huit cents autres : c'est ce
    # rechargement, et lui seul, qui rendait la saisie d'une description
    # interminable.
    return {"ligne": await _lire_ligne(db, projet_id),
            "champs_verrouilles": sorted(verrous),
            "avertissements": _avertissements(manques)}


# Le lot où atterrissent les projets saisis. Il n'a PAS de périmètre : un
# périmètre est une promesse d'exhaustivité — « tout ce que ce pays a reçu » —
# et ajouter un projet à la main n'en fait aucune. Le projet compte partout
# ailleurs ; il ne rend simplement aucun pays « complet » à lui seul.
LOT_SAISIE = "Saisie manuelle"


@router.post("/projets", status_code=201)
async def ajouter_projet(body: LigneIn, db: AsyncSession = Depends(get_db),
                         user: dict = Depends(require_admin)):
    """Ajoute un projet que le relevé ne contient pas.

    Il va dans un lot à part, marqué « saisie » : la purge des rangs excédentaires
    d'un réimport ne peut donc jamais l'atteindre. Un projet saisi n'a pas de
    rang chez fDi — aucune ligne de CSV ne viendra en face de lui.
    """
    signataire = str(user.get("email") or "admin")
    _, col, manques = await _preparer(db, body, signataire)

    lot = (await db.execute(text(
        "SELECT id FROM fdi_lots_import WHERE libelle = :l"), {"l": LOT_SAISIE})).first()
    if lot:
        lot_id = lot.id
    else:
        lot_id = (await db.execute(text(
            "INSERT INTO fdi_lots_import (libelle, perimetre, sens, source, importe_par, nb_lignes) "
            "VALUES (:l, NULL, 'destination', 'saisie', :u, 0) RETURNING id"),
            {"l": LOT_SAISIE, "u": signataire})).first().id

    rang = ((await db.execute(text(
        "SELECT coalesce(max(ligne), 0) + 1 AS n FROM fdi_projets WHERE lot_id = :i"),
        {"i": lot_id})).first()).n

    r = (await db.execute(text("""
        INSERT INTO fdi_projets (lot_id, ligne, origine, annee, mois,
            parent_brut, parent_id, entreprise_brut, entreprise_id, statut_entreprise,
            pays_source_brut, pays_source_id, pays_dest_brut, pays_dest_id,
            secteur_brut, secteur_id, sous_secteur_brut, sous_secteur_id,
            activite_brut, activite_id, type_brut, type_projet_id,
            capex_musd, capex_estime, emplois, emplois_estime,
            description_en, description_fr,
            champs_verrouilles, modifie_par)
        VALUES (:lot, :rang, 'saisie', :annee, :mois,
            :parent_brut, :parent_id, :entreprise_brut, :entreprise_id, 'resolu',
            :pays_source_brut, :pays_source_id, :pays_dest_brut, :pays_dest_id,
            :secteur_brut, :secteur_id, :sous_secteur_brut, :sous_secteur_id,
            :activite_brut, :activite_id, :type_brut, :type_projet_id,
            :capex_musd, :capex_estime, :emplois, :emplois_estime,
            :den, :dfr,
            '{}', :u)
        RETURNING id
    """), {**col, "lot": lot_id, "rang": rang, "u": signataire,
           "den": _texte(body.description_en), "dfr": _texte(body.description_fr)})).first()

    await db.execute(text(
        "UPDATE fdi_lots_import SET nb_lignes = (SELECT count(*) FROM fdi_projets WHERE lot_id = :i), "
        "  importe_le = now(), importe_par = :u WHERE id = :i"), {"i": lot_id, "u": signataire})
    await db.commit()
    # Comme pour la correction : la ligne repart avec la réponse, et l'écran
    # l'insère sans recharger la base entière.
    return {"ligne": await _lire_ligne(db, r.id), "lot_id": lot_id, "ligne_rang": rang,
            "avertissements": _avertissements(manques)}


@router.delete("/projets/{projet_id}")
async def retirer_projet(projet_id: int, db: AsyncSession = Depends(get_db),
                         user: dict = Depends(require_admin)):
    """Retire un projet SAISI. Une ligne venue d'un CSV n'est pas supprimable
    ici : elle reviendrait au prochain import, et laisser croire le contraire
    serait pire que de refuser. C'est le CSV qu'il faut corriger."""
    r = (await db.execute(text(
        "DELETE FROM fdi_projets WHERE id = :i AND origine = 'saisie' RETURNING lot_id"),
        {"i": projet_id})).first()
    if not r:
        existe = (await db.execute(text(
            "SELECT origine FROM fdi_projets WHERE id = :i"), {"i": projet_id})).first()
        if existe:
            raise HTTPException(409, "Ce projet vient du relevé : il reviendrait au prochain "
                                     "import. Corrigez le fichier de relevé.")
        raise HTTPException(404, "Projet introuvable.")
    await db.execute(text(
        "UPDATE fdi_lots_import SET nb_lignes = (SELECT count(*) FROM fdi_projets WHERE lot_id = :i) "
        "WHERE id = :i"), {"i": r.lot_id})
    await db.commit()
    return {"id": projet_id}
