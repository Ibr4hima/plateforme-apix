"""Signaux d'investisseur — consultation et complétion depuis l'administration.

CE QUE CET ÉCRAN SERT, et qui n'existe pas côté projets : la COMPLÉTION. Le
tableau de fDi n'affiche qu'une destination, un secteur, une activité et une
nature par signal, et cache les autres. Le relevé porte ce qui est visible ;
c'est ici qu'on ajoute le reste, valeur par valeur.

Toute valeur ajoutée ici porte l'origine « saisie », et le réimport du relevé
ne réécrit que les siennes. C'est la condition sans laquelle la méthode ne
tiendrait pas : une mise à jour du relevé effacerait des heures de travail.

CE QUE CET ÉCRAN NE PRÉTEND PAS : l'exhaustivité. Un décompte « signaux citant
le Sénégal » est un PLANCHER tant que la complétion n'est pas faite, et les
écrans doivent le dire plutôt que de laisser croire à un total.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.database import get_db

# « signaux-investisseurs » et non « signaux » : /fdi/signaux appartient déjà à
# la NOMENCLATURE des types de signal, qui se gère dans l'écran des
# classifications. Les méthodes HTTP suffiraient à les départager, mais deux
# ressources différentes sous un même chemin finissent toujours par tromper
# quelqu'un. Le nom repris est celui que fDi donne à cette base.
router = APIRouter(prefix="/fdi", tags=["fdi"])

# Les quatre familles multiples : leur table, la colonne qui porte le
# rattachement, et le référentiel où le choisir. Tout passe par ce tableau —
# une famille de plus se déclare ici et nulle part ailleurs.
FAMILLES = {
    "destination": {"table": "fdi_signal_destinations", "colonnes": ("pays_id", "region_id")},
    "secteur":     {"table": "fdi_signal_secteurs",     "colonnes": ("secteur_id",)},
    "activite":    {"table": "fdi_signal_activites",    "colonnes": ("activite_id",)},
    "nature":      {"table": "fdi_signal_natures",      "colonnes": ("nature_id",)},
}

# Ce qui fait qu'un signal « vise l'Afrique » : un pays du continent, ou la
# région du monde « Africa » de fDi. Écrit une seule fois, employé par le
# filtre de complétion et par le drapeau de chaque ligne, pour que les deux ne
# puissent pas diverger.
VISE_AFRIQUE = """
    EXISTS (SELECT 1 FROM fdi_signal_destinations d
              LEFT JOIN ref_pays p ON p.id = d.pays_id
              LEFT JOIN fdi_regions_monde r ON r.id = d.region_id
             WHERE d.signal_id = s.id
               AND (p.continent = 'Afrique' OR r.libelle_en = 'Africa'))
"""

# Les libellés affichés d'une famille, dans l'ordre de la source puis des
# ajouts. Le français du référentiel, le brut de la source en secours : un
# libellé non rattaché s'affiche tel que fDi l'écrit, ce qui rend la lacune
# visible plutôt que muette.
LISTES = """
    (SELECT coalesce(json_agg(json_build_object(
                'id', d.id, 'rang', d.rang, 'brut', d.brut, 'origine', d.origine,
                'libelle', coalesce(p.nom_fr, r.libelle_fr, d.brut),
                'nature', CASE WHEN d.pays_id IS NOT NULL THEN 'pays'
                               WHEN d.region_id IS NOT NULL THEN 'region' END,
                'resolu', (d.pays_id IS NOT NULL OR d.region_id IS NOT NULL))
             ORDER BY d.rang), '[]'::json)
       FROM fdi_signal_destinations d
       LEFT JOIN ref_pays p ON p.id = d.pays_id
       LEFT JOIN fdi_regions_monde r ON r.id = d.region_id
      WHERE d.signal_id = s.id) AS destinations,
    (SELECT coalesce(json_agg(json_build_object(
                'id', v.id, 'rang', v.rang, 'brut', v.brut, 'origine', v.origine,
                'libelle', coalesce(n.libelle_fr, v.brut),
                'resolu', v.secteur_id IS NOT NULL) ORDER BY v.rang), '[]'::json)
       FROM fdi_signal_secteurs v LEFT JOIN fdi_secteurs n ON n.id = v.secteur_id
      WHERE v.signal_id = s.id) AS secteurs,
    (SELECT coalesce(json_agg(json_build_object(
                'id', v.id, 'rang', v.rang, 'brut', v.brut, 'origine', v.origine,
                'libelle', coalesce(n.libelle_fr, v.brut),
                'resolu', v.activite_id IS NOT NULL) ORDER BY v.rang), '[]'::json)
       FROM fdi_signal_activites v LEFT JOIN fdi_activites n ON n.id = v.activite_id
      WHERE v.signal_id = s.id) AS activites,
    (SELECT coalesce(json_agg(json_build_object(
                'id', v.id, 'rang', v.rang, 'brut', v.brut, 'origine', v.origine,
                'libelle', coalesce(n.libelle_fr, v.brut),
                'resolu', v.nature_id IS NOT NULL) ORDER BY v.rang), '[]'::json)
       FROM fdi_signal_natures v LEFT JOIN fdi_signaux n ON n.id = v.nature_id
      WHERE v.signal_id = s.id) AS natures
"""


def _ligne(r) -> dict:
    return {
        "id": r.id,
        "periode": f"{r.annee}-{r.mois:02d}" if r.mois else str(r.annee),
        "entreprise": r.entreprise_nom or r.entreprise_brut,
        "entreprise_brut": r.entreprise_brut,
        "parent": r.parent_nom or r.parent_brut,
        "statut_entreprise": r.statut_entreprise,
        "source": r.pays_source or r.pays_source_brut,
        "source_resolue": r.pays_source is not None,
        "capex_musd": float(r.capex_musd) if r.capex_musd is not None else None,
        "capex_estime": r.capex_estime,
        "funding_musd": float(r.funding_musd) if r.funding_musd is not None else None,
        "funding_estime": r.funding_estime,
        "destinations": r.destinations, "secteurs": r.secteurs,
        "activites": r.activites, "natures": r.natures,
        # Le signal vise-t-il l'Afrique d'après ce qu'on en sait ? « Non » ne
        # veut pas dire qu'il ne la vise pas — seulement que le tableau ne le
        # montrait pas et que personne ne l'a encore complété.
        "vise_afrique": r.vise_afrique,
        "lot": r.lot,
    }


@router.get("/signaux-investisseurs/referentiels")
async def referentiels_signaux(db: AsyncSession = Depends(get_db)):
    """Ce dans quoi on choisit une valeur à ajouter.

    Les pays ET les régions du monde de fDi vivent dans la même liste de
    destinations, distingués par leur nature : ce sont deux référentiels, mais
    un seul geste pour qui complète.
    """
    async def q(sql):
        return [dict(r._mapping) for r in (await db.execute(text(sql))).fetchall()]

    pays = await q("SELECT id, nom_fr AS libelle FROM ref_pays WHERE actif ORDER BY nom_fr")
    regions = await q("SELECT id, libelle_fr AS libelle FROM fdi_regions_monde ORDER BY ordre")
    return {
        "destinations": ([{**r, "nature": "region"} for r in regions]
                         + [{**p, "nature": "pays"} for p in pays]),
        "secteurs":  await q("SELECT id, libelle_fr AS libelle FROM fdi_secteurs ORDER BY ordre"),
        "activites": await q("SELECT id, libelle_fr AS libelle FROM fdi_activites ORDER BY ordre"),
        "natures":   await q("SELECT id, libelle_fr AS libelle FROM fdi_signaux ORDER BY ordre"),
    }


@router.get("/signaux-investisseurs")
async def lister_signaux(
    q: str = "",
    page: int = 1,
    par_page: int = 15,
    a_completer: bool = False,
    a_arbitrer: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Une page de signaux, avec leurs quatre listes.

    Même règle que le tableau des projets : ON COUPE AVANT DE JOINDRE. La
    sélection et le découpage se font sur la seule table des signaux, et les
    listes ne sont construites que pour les quinze lignes retenues.
    """
    where = ["1 = 1"]
    params: dict = {}
    if a_completer:
        where.append(f"NOT {VISE_AFRIQUE}")
    if a_arbitrer:
        where.append("s.statut_entreprise <> 'resolu'")
    if q.strip():
        # Recherche sur ce que le tableau montre en propre. Les valeurs
        # multiples ne sont pas fouillées ici : elles le seront le jour où le
        # relevé sera complété, et prétendre les chercher aujourd'hui donnerait
        # des résultats qui dépendent de l'avancement de la saisie.
        where.append("""(
            EXISTS (SELECT 1 FROM fdi_entreprises e2 WHERE e2.id IN (s.entreprise_id, s.parent_id)
                      AND lower(e2.nom) LIKE '%' || lower(:q) || '%')
            OR lower(coalesce(s.entreprise_brut, '')) LIKE '%' || lower(:q) || '%'
            OR lower(coalesce(s.parent_brut, ''))     LIKE '%' || lower(:q) || '%')""")
        params["q"] = q.strip()

    par_page = max(1, min(par_page, 200))
    page = max(1, page)
    params |= {"n": par_page, "o": (page - 1) * par_page}
    filtre = " AND ".join(where)

    lignes = (await db.execute(text(f"""
        WITH choisis AS MATERIALIZED (
            SELECT s.id FROM fdi_signaux_investisseurs s
             WHERE {filtre}
             ORDER BY s.annee DESC, s.mois DESC NULLS LAST, s.lot_id, s.ligne
             LIMIT :n OFFSET :o
        )
        SELECT s.id, s.annee, s.mois, s.entreprise_brut, s.parent_brut,
               s.statut_entreprise, s.pays_source_brut,
               s.capex_musd, s.capex_estime, s.funding_musd, s.funding_estime,
               e.nom AS entreprise_nom, pa.nom AS parent_nom,
               ps.nom_fr AS pays_source, l.libelle AS lot,
               {VISE_AFRIQUE} AS vise_afrique,
               {LISTES}
        FROM fdi_signaux_investisseurs s
        JOIN choisis c ON c.id = s.id
        LEFT JOIN fdi_entreprises e  ON e.id  = s.entreprise_id
        LEFT JOIN fdi_entreprises pa ON pa.id = s.parent_id
        LEFT JOIN ref_pays ps ON ps.id = s.pays_source_id
        JOIN fdi_lots_import l ON l.id = s.lot_id
        ORDER BY s.annee DESC, s.mois DESC NULLS LAST, s.lot_id, s.ligne
    """), params)).fetchall()

    retenues = (await db.execute(text(
        f"SELECT count(*) FROM fdi_signaux_investisseurs s WHERE {filtre}"), params)).scalar_one()

    totaux = (await db.execute(text(f"""
        SELECT count(*) AS total,
               count(*) FILTER (WHERE NOT {VISE_AFRIQUE}) AS a_completer,
               count(*) FILTER (WHERE s.statut_entreprise <> 'resolu') AS a_arbitrer
        FROM fdi_signaux_investisseurs s"""))).first()

    return {
        "signaux": [_ligne(r) for r in lignes],
        "page": page,
        "pages": max(1, -(-retenues // par_page)),
        "retenues": retenues,
        "totaux": {"total": totaux.total, "a_completer": totaux.a_completer,
                   "a_arbitrer": totaux.a_arbitrer},
    }


class ValeurIn(BaseModel):
    """Une valeur à ajouter. Pour une destination, l'un des deux identifiants —
    un pays OU une région du monde, jamais les deux."""
    famille: str
    pays_id: int | None = None
    region_id: int | None = None
    poste_id: int | None = None


@router.post("/signaux-investisseurs/{signal_id}/valeurs", status_code=201)
async def ajouter_valeur(signal_id: int, body: ValeurIn,
                         db: AsyncSession = Depends(get_db),
                         user: dict = Depends(require_admin)):
    """Ajoute une valeur que le tableau de fDi ne montrait pas.

    Elle prend le rang suivant et porte l'origine « saisie » : le réimport du
    relevé la laissera en place.
    """
    famille = FAMILLES.get(body.famille)
    if not famille:
        raise HTTPException(400, "Famille inconnue.")
    if not (await db.execute(text(
        "SELECT 1 FROM fdi_signaux_investisseurs WHERE id = :i"), {"i": signal_id})).first():
        raise HTTPException(404, "Signal introuvable.")

    if body.famille == "destination":
        if (body.pays_id is None) == (body.region_id is None):
            raise HTTPException(400, "Une destination est un pays OU une région du monde.")
        colonnes, valeurs = ("pays_id", "region_id"), {"pays_id": body.pays_id,
                                                       "region_id": body.region_id}
    else:
        if body.poste_id is None:
            raise HTTPException(400, "Aucun poste choisi.")
        colonnes, valeurs = famille["colonnes"], {famille["colonnes"][0]: body.poste_id}

    table = famille["table"]
    # Deux fois la même valeur ne veut rien dire de plus qu'une fois, et la
    # laisser entrer fausserait tout décompte fondé sur ces listes.
    conditions = " AND ".join(f"{c} IS NOT DISTINCT FROM :{c}" for c in colonnes)
    if (await db.execute(text(
        f"SELECT 1 FROM {table} WHERE signal_id = :s AND {conditions}"),
        {"s": signal_id, **valeurs})).first():
        raise HTTPException(409, "Cette valeur est déjà portée par ce signal.")

    rang = (await db.execute(text(
        f"SELECT coalesce(max(rang), 0) + 1 FROM {table} WHERE signal_id = :s"),
        {"s": signal_id})).scalar_one()
    champs = ", ".join(colonnes)
    marques = ", ".join(f":{c}" for c in colonnes)
    valeur_id = (await db.execute(text(
        f"INSERT INTO {table} (signal_id, rang, brut, {champs}, origine) "
        f"VALUES (:s, :rang, NULL, {marques}, 'saisie') RETURNING id"),
        {"s": signal_id, "rang": rang, **valeurs})).scalar_one()
    await db.execute(text(
        "UPDATE fdi_signaux_investisseurs SET modifie_le = :d, modifie_par = :u WHERE id = :i"),
        {"d": datetime.now(timezone.utc), "u": str(user.get("email") or "admin"), "i": signal_id})
    await db.commit()
    return {"id": valeur_id, "rang": rang}


@router.delete("/signaux-investisseurs/{signal_id}/valeurs/{famille}/{valeur_id}")
async def retirer_valeur(signal_id: int, famille: str, valeur_id: int,
                         db: AsyncSession = Depends(get_db),
                         user: dict = Depends(require_admin)):
    """Retire une valeur AJOUTÉE À LA MAIN.

    Une valeur du relevé ne se retire pas ici : elle dit ce que la source
    affichait, et l'effacer ferait mentir le relevé. Si elle est fautive, c'est
    le fichier de relevé qu'il faut corriger, puis réimporter.
    """
    f = FAMILLES.get(famille)
    if not f:
        raise HTTPException(400, "Famille inconnue.")
    r = (await db.execute(text(
        f"DELETE FROM {f['table']} WHERE id = :v AND signal_id = :s AND origine = 'saisie' "
        f"RETURNING id"), {"v": valeur_id, "s": signal_id})).first()
    if not r:
        raise HTTPException(
            404, "Valeur introuvable, ou issue du relevé — celle-là se corrige dans le fichier.")
    await db.execute(text(
        "UPDATE fdi_signaux_investisseurs SET modifie_le = :d, modifie_par = :u WHERE id = :i"),
        {"d": datetime.now(timezone.utc), "u": str(user.get("email") or "admin"), "i": signal_id})
    await db.commit()
    return {"retire": valeur_id}
