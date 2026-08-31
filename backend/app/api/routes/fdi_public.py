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
from fastapi import APIRouter, Depends
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
    "secteurs":  "COALESCE(s.libelle_fr, p.secteur_brut)",
    "activites": "COALESCE(a.libelle_fr, p.activite_brut)",
    "types":     "COALESCE(t.libelle_fr, p.type_brut)",
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


def _filtres(observe: str, pays, annee_min, annee_max, secteurs, activites, types,
             recherche, sauf: str | None = None) -> tuple[list[str], dict]:
    """Les conditions du périmètre demandé, éventuellement privées d'une facette.

    `sauf` sert au filtrage EN CASCADE : pour compter les options d'une
    facette, on applique tous les filtres SAUF le sien. Sans cela, cocher
    « Communications » réduirait la liste des secteurs à « Communications »
    seul, et l'on ne pourrait plus en ajouter un deuxième.
    """
    where, params = ["1 = 1"], {}
    if pays:
        where.append(f"COALESCE(ro.nom_fr, p.{observe}_brut) = :pays")
        params["pays"] = pays
    if annee_min is not None:
        where.append("p.annee >= :a0"); params["a0"] = annee_min
    if annee_max is not None:
        where.append("p.annee <= :a1"); params["a1"] = annee_max
    for cle, brut in (("secteurs", secteurs), ("activites", activites), ("types", types)):
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
                                 secteurs, activites, types, recherche, sauf)
        return (await db.execute(text(f"""
            SELECT {expr} AS nom, count(*) AS nb
            {joint} WHERE {' AND '.join(where)} AND {expr} IS NOT NULL
            GROUP BY 1 ORDER BY count(*) DESC, 1"""), params)).fetchall()

    lignes_pays = await compter(f"COALESCE(ro.nom_fr, p.{observe}_brut)", "pays")
    lignes_sec = await compter(FACETTES["secteurs"], "secteurs")
    lignes_act = await compter(FACETTES["activites"], "activites")
    lignes_typ = await compter(FACETTES["types"], "types")

    # Les bornes de la période restent celles du jeu complet : un curseur dont
    # les extrémités bougent à chaque clic devient impossible à manœuvrer.
    bornes = (await db.execute(text(
        "SELECT min(annee) AS a0, max(annee) AS a1, count(*) AS n FROM fdi_projets"))).first()

    return {
        "sens": sens if sens in COTE else "destination",
        "annees": [bornes.a0, bornes.a1],
        "total_projets": bornes.n,
        "pays": [{"nom": r.nom, "nb": r.nb} for r in lignes_pays],
        "secteurs": [{"nom": r.nom, "nb": r.nb} for r in lignes_sec],
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
                             secteurs, activites, types, recherche)

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
