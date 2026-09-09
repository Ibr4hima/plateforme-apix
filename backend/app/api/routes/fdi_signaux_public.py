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
from app.api.routes.fdi_signaux import LISTES, VISE_AFRIQUE

# Même préfixe public que les projets annoncés : les deux vues se lisent l'une
# après l'autre, et leurs adresses doivent se ressembler.
router = APIRouter(prefix="/fdi/public", tags=["fdi"])


def _filtres(destination: str | None, annee_min: int | None, annee_max: int | None,
             secteurs: str | None, activites: str | None, natures: str | None,
             recherche: str | None, sauf: str | None = None) -> tuple[list[str], dict]:
    """Les conditions demandées, éventuellement privées d'une facette.

    Chaque facette est comptée sous les filtres des AUTRES, jamais sous le
    sien : cocher un secteur doit restreindre les activités proposées, pas la
    liste des secteurs — sinon on ne pourrait plus en cocher un second.
    """
    where, params = ["1 = 1"], {}

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

    for nom, table, ref, colonne in (
            ("secteurs",  "fdi_signal_secteurs",  "fdi_secteurs",     "secteur_id"),
            ("activites", "fdi_signal_activites", "fdi_activites",    "activite_id"),
            ("natures",   "fdi_signal_natures",   "fdi_signaux",      "nature_id")):
        choix = {"secteurs": secteurs, "activites": activites, "natures": natures}[nom]
        if not choix or sauf == nom:
            continue
        valeurs = [v.strip() for v in choix.split("|") if v.strip()]
        if not valeurs:
            continue
        where.append(f"""EXISTS (
            SELECT 1 FROM {table} v JOIN {ref} n ON n.id = v.{colonne}
             WHERE v.signal_id = s.id AND n.libelle_fr = ANY(:{nom}))""")
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

    async def compter(sql: str, sauf: str | None):
        where, params = _filtres(destination, annee_min, annee_max, secteurs,
                                 activites, natures, recherche, sauf)
        return (await db.execute(text(sql.replace("{where}", " AND ".join(where))),
                                 params)).fetchall()

    # Les destinations proposées : pays et régions du monde dans une seule
    # liste, distingués par leur nature — ce sont deux référentiels, mais une
    # seule question pour qui lit.
    destinations = await compter("""
        SELECT nom, nature, count(DISTINCT signal_id) AS nb FROM (
            SELECT d.signal_id, coalesce(p.nom_fr, r.libelle_fr) AS nom,
                   CASE WHEN d.pays_id IS NOT NULL THEN 'pays' ELSE 'region' END AS nature
            FROM fdi_signaux_investisseurs s
            JOIN fdi_signal_destinations d ON d.signal_id = s.id
            LEFT JOIN ref_pays p ON p.id = d.pays_id
            LEFT JOIN fdi_regions_monde r ON r.id = d.region_id
            WHERE {where} AND coalesce(p.nom_fr, r.libelle_fr) IS NOT NULL
        ) x GROUP BY nom, nature ORDER BY count(DISTINCT signal_id) DESC, nom""", "destination")

    async def facette(table: str, ref: str, colonne: str, sauf: str):
        return await compter(f"""
            SELECT n.libelle_fr AS nom, count(DISTINCT s.id) AS nb
              FROM fdi_signaux_investisseurs s
              JOIN {table} v ON v.signal_id = s.id
              JOIN {ref} n ON n.id = v.{colonne}
             WHERE {{where}}
             GROUP BY n.libelle_fr ORDER BY count(DISTINCT s.id) DESC, n.libelle_fr""", sauf)

    bornes = (await db.execute(text(
        "SELECT min(annee) AS a0, max(annee) AS a1, count(*) AS n "
        "  FROM fdi_signaux_investisseurs"))).first()

    return {
        "annees": [bornes.a0, bornes.a1],
        "total_signaux": bornes.n,
        "destinations": [{"nom": r.nom, "nature": r.nature, "nb": r.nb} for r in destinations],
        "secteurs":  [{"nom": r.nom, "nb": r.nb} for r in
                      await facette("fdi_signal_secteurs", "fdi_secteurs", "secteur_id", "secteurs")],
        "activites": [{"nom": r.nom, "nb": r.nb} for r in
                      await facette("fdi_signal_activites", "fdi_activites", "activite_id", "activites")],
        "natures":   [{"nom": r.nom, "nb": r.nb} for r in
                      await facette("fdi_signal_natures", "fdi_signaux", "nature_id", "natures")],
    }


@router.get("/signaux")
async def signaux_publics(
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
                             activites, natures, recherche)
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

    async def top(sql: str):
        return [{"nom": r.nom, "nb": r.nb} for r in
                (await db.execute(text(sql.replace("{filtre}", filtre)), params)).fetchall()]

    tops = {
        "origines": await top("""
            SELECT p.nom_fr AS nom, count(*) AS nb
              FROM fdi_signaux_investisseurs s JOIN ref_pays p ON p.id = s.pays_source_id
             WHERE {filtre} GROUP BY p.nom_fr ORDER BY count(*) DESC, p.nom_fr LIMIT 10"""),
        "entreprises": await top("""
            SELECT e.nom AS nom, count(*) AS nb
              FROM fdi_signaux_investisseurs s JOIN fdi_entreprises e ON e.id = s.entreprise_id
             WHERE {filtre} GROUP BY e.nom ORDER BY count(*) DESC, e.nom LIMIT 10"""),
        "secteurs": await top("""
            SELECT n.libelle_fr AS nom, count(DISTINCT s.id) AS nb
              FROM fdi_signaux_investisseurs s
              JOIN fdi_signal_secteurs v ON v.signal_id = s.id
              JOIN fdi_secteurs n ON n.id = v.secteur_id
             WHERE {filtre} GROUP BY n.libelle_fr ORDER BY count(DISTINCT s.id) DESC, n.libelle_fr LIMIT 10"""),
        "natures": await top("""
            SELECT n.libelle_fr AS nom, count(DISTINCT s.id) AS nb
              FROM fdi_signaux_investisseurs s
              JOIN fdi_signal_natures v ON v.signal_id = s.id
              JOIN fdi_signaux n ON n.id = v.nature_id
             WHERE {filtre} GROUP BY n.libelle_fr ORDER BY count(DISTINCT s.id) DESC, n.libelle_fr LIMIT 10"""),
    }

    # ON COUPE AVANT DE JOINDRE, comme le tableau des projets : la sélection se
    # fait sur la seule table des signaux, et les quatre listes ne sont
    # construites que pour la page rendue.
    lignes = (await db.execute(text(f"""
        WITH choisis AS MATERIALIZED (
            SELECT s.id FROM fdi_signaux_investisseurs s
             WHERE {filtre}
             ORDER BY s.annee DESC, s.mois DESC NULLS LAST, s.id
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
        ORDER BY s.annee DESC, s.mois DESC NULLS LAST, s.id
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
