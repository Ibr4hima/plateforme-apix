from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.database import get_db
from app.services.fdi_projets import est_tronque, normaliser

# Projets fDi Markets — consultation, arbitrage des entreprises, saisie des
# descriptions.
#
# Deux tâches humaines vivent ici, et elles n'ont pas la même nature :
#
#   * ARBITRER une entreprise, c'est trancher une ambiguïté que la source a
#     créée en tronquant ses libellés. La décision porte sur TOUS les projets
#     qui portent le même texte brut — sinon il faudrait la répéter quatre fois
#     pour la Banque de développement.
#
#   * SAISIR une description, c'est ajouter ce que la source ne donne pas dans
#     son tableau. La saisie est projet par projet, et il y en a des centaines :
#     l'écran doit être fait pour la série.
router = APIRouter(prefix="/fdi", tags=["fdi"])


def _mois(r) -> str:
    return f"{r.annee}-{r.mois:02d}" if r.mois else str(r.annee)


# ── Les projets ───────────────────────────────────────────────────────────────
@router.get("/projets")
async def lister_projets(
    lot_id: int | None = None,
    sans_description: bool = False,
    a_arbitrer: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """La liste des projets, filtrable sur ce qui reste à faire.

    Les deux filtres servent les deux écrans de travail : « sans description »
    alimente la saisie en série, « à arbitrer » l'écran des entreprises.
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

    lignes = (await db.execute(text(f"""
        SELECT p.id, p.lot_id, p.ligne, p.annee, p.mois,
               p.parent_brut, p.entreprise_brut, p.statut_entreprise,
               p.pays_source_brut, p.pays_dest_brut,
               p.capex_musd, p.capex_estime, p.emplois, p.emplois_estime,
               p.description_en, p.description_fr,
               p.secteur_brut, p.sous_secteur_brut, p.activite_brut, p.type_brut,
               e.nom  AS entreprise_nom,  e.statut_nom AS entreprise_statut,
               pa.nom AS parent_nom,
               s.libelle_fr AS secteur, ss.libelle_fr AS sous_secteur,
               a.libelle_fr AS activite, t.libelle_fr AS type_projet,
               psrc.nom_fr AS pays_source, pdst.nom_fr AS pays_dest,
               l.libelle AS lot
        FROM fdi_projets p
        LEFT JOIN ref_pays psrc ON psrc.id = p.pays_source_id
        LEFT JOIN ref_pays pdst ON pdst.id = p.pays_dest_id
        LEFT JOIN fdi_entreprises  e  ON e.id  = p.entreprise_id
        LEFT JOIN fdi_entreprises  pa ON pa.id = p.parent_id
        LEFT JOIN fdi_secteurs     s  ON s.id  = p.secteur_id
        LEFT JOIN fdi_sous_secteurs ss ON ss.id = p.sous_secteur_id
        LEFT JOIN fdi_activites    a  ON a.id  = p.activite_id
        LEFT JOIN fdi_types_projet t  ON t.id  = p.type_projet_id
        JOIN fdi_lots_import       l  ON l.id  = p.lot_id
        WHERE {' AND '.join(where)}
        ORDER BY p.annee DESC, p.mois DESC NULLS LAST, p.lot_id, p.ligne
    """), params)).fetchall()

    totaux = (await db.execute(text("""
        SELECT count(*) AS total,
               count(*) FILTER (WHERE description_en IS NULL OR description_en = '') AS sans_desc,
               count(*) FILTER (WHERE statut_entreprise <> 'resolu') AS a_arbitrer
        FROM fdi_projets
    """))).first()

    return {
        "projets": [
            {
                "id": r.id, "lot": r.lot, "lot_id": r.lot_id, "ligne": r.ligne,
                "periode": _mois(r),
                "entreprise": r.entreprise_nom or r.entreprise_brut,
                "entreprise_brut": r.entreprise_brut,
                "entreprise_tronquee": r.entreprise_statut == "tronque",
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
                "description_en": r.description_en, "description_fr": r.description_fr,
            }
            for r in lignes
        ],
        "totaux": {"total": totaux.total, "sans_description": totaux.sans_desc,
                   "a_arbitrer": totaux.a_arbitrer},
    }


class DescriptionIn(BaseModel):
    description_en: str = ""
    description_fr: str = ""


@router.patch("/projets/{projet_id}/description")
async def enregistrer_description(projet_id: int, body: DescriptionIn,
                                  db: AsyncSession = Depends(get_db),
                                  user: dict = Depends(require_admin)):
    """Les deux descriptions d'un projet. Le français reste facultatif."""
    r = (await db.execute(text(
        "UPDATE fdi_projets SET description_en = :en, description_fr = :fr, "
        "  modifie_le = :d, modifie_par = :u WHERE id = :i RETURNING id"
    ), {"en": body.description_en.strip() or None, "fr": body.description_fr.strip() or None,
        "d": datetime.now(timezone.utc), "u": str(user.get("email") or "admin"),
        "i": projet_id})).first()
    if not r:
        raise HTTPException(404, "Projet introuvable.")
    await db.commit()
    return {"id": projet_id}


# ── L'arbitrage des entreprises ───────────────────────────────────────────────
@router.get("/arbitrage")
async def arbitrage(db: AsyncSession = Depends(get_db)):
    """Les noms d'entreprises en attente, groupés par texte brut.

    Le groupement est essentiel : « Banque de dévelo… » apparaît sur quatre
    projets, et c'est une seule décision à prendre, pas quatre. L'écran en fait
    une seule ligne.

    Les candidats proposés viennent de deux sources, dans cet ordre : les
    entreprises DÉJÀ rattachées un jour à ce même texte — la mémoire des
    arbitrages — puis celles dont le nom commence par le préfixe. Aucune n'est
    appliquée d'office : un préfixe n'est pas une identité, et deux banques de
    développement peuvent parfaitement le partager.
    """
    groupes = (await db.execute(text("""
        SELECT p.entreprise_brut AS brut,
               count(*)          AS nb_projets,
               min(e.id)         AS entreprise_id,
               min(e.nom)        AS entreprise_nom,
               min(e.statut_nom) AS entreprise_statut
        FROM fdi_projets p
        LEFT JOIN fdi_entreprises e ON e.id = p.entreprise_id
        WHERE p.statut_entreprise <> 'resolu' AND p.entreprise_brut IS NOT NULL
        GROUP BY p.entreprise_brut
        ORDER BY count(*) DESC, p.entreprise_brut
    """))).fetchall()

    sortie = []
    for g in groupes:
        cle = normaliser(g.brut)
        # La mémoire : ce texte a-t-il déjà été tranché ?
        memoire = (await db.execute(text("""
            SELECT e.id, e.nom, a.occurrences
            FROM fdi_entreprise_alias a JOIN fdi_entreprises e ON e.id = a.entreprise_id
            WHERE a.alias_normalise = :c AND e.statut_nom = 'complet'
            ORDER BY a.occurrences DESC, e.nom
        """), {"c": cle})).fetchall()
        # Le préfixe : quelles entreprises connues commencent ainsi ?
        prefixe = (await db.execute(text("""
            SELECT id, nom FROM fdi_entreprises
            WHERE statut_nom = 'complet' AND nom_normalise LIKE :p
            ORDER BY nom LIMIT 8
        """), {"p": f"{cle}%"})).fetchall()

        vus, candidats = set(), []
        for r in memoire:
            vus.add(r.id)
            candidats.append({"id": r.id, "nom": r.nom, "origine": "memoire"})
        for r in prefixe:
            if r.id not in vus:
                candidats.append({"id": r.id, "nom": r.nom, "origine": "prefixe"})

        projets = (await db.execute(text("""
            SELECT p.id, p.ligne, p.annee, p.mois, p.capex_musd, p.type_brut,
                   s.libelle_fr AS secteur, l.libelle AS lot
            FROM fdi_projets p
            LEFT JOIN fdi_secteurs s ON s.id = p.secteur_id
            JOIN fdi_lots_import l ON l.id = p.lot_id
            WHERE p.entreprise_brut = :b AND p.statut_entreprise <> 'resolu'
            ORDER BY p.annee DESC, p.mois DESC NULLS LAST, p.ligne
        """), {"b": g.brut})).fetchall()

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
                 "capex_musd": float(p.capex_musd) if p.capex_musd is not None else None}
                for p in projets
            ],
        })
    return {"groupes": sortie, "total": sum(g["nb_projets"] for g in sortie)}


class ArbitrageIn(BaseModel):
    brut: str
    # « nommer » : compléter le nom de l'entreprise déjà rattachée.
    # « rattacher » : pointer vers une autre entreprise, déjà connue.
    mode: str
    nom: str | None = None
    entreprise_id: int | None = None


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
            # On renomme l'entreprise créée à l'import plutôt que d'en créer une
            # seconde : les projets déjà rattachés suivent sans rien à recoller.
            actuelle = (await db.execute(text(
                "SELECT entreprise_id FROM fdi_projets WHERE entreprise_brut = :b "
                "AND entreprise_id IS NOT NULL LIMIT 1"), {"b": brut})).first()
            if not actuelle:
                raise HTTPException(404, "Aucun projet ne porte ce libellé.")
            entreprise_id = actuelle.entreprise_id
            await db.execute(text(
                "UPDATE fdi_entreprises SET nom = :n, nom_normalise = :c, statut_nom = 'complet', "
                "  modifie_le = :d, modifie_par = :u WHERE id = :i"),
                {"n": nom, "c": normaliser(nom), "d": datetime.now(timezone.utc),
                 "u": signataire, "i": entreprise_id})
    elif body.mode == "rattacher":
        if not body.entreprise_id:
            raise HTTPException(400, "Aucune entreprise choisie.")
        entreprise_id = body.entreprise_id
    else:
        raise HTTPException(400, "Mode inconnu.")

    # La mémoire de l'arbitrage : le compteur ne bouge que sur décision humaine.
    await db.execute(text(
        "INSERT INTO fdi_entreprise_alias (alias_brut, alias_normalise, tronque, entreprise_id, decide_par) "
        "VALUES (:b, :c, :t, :e, :u) ON CONFLICT (alias_normalise, entreprise_id) DO UPDATE "
        "SET occurrences = fdi_entreprise_alias.occurrences + 1, decide_par = EXCLUDED.decide_par"),
        {"b": brut, "c": cle, "t": est_tronque(brut), "e": entreprise_id, "u": signataire})

    touches = (await db.execute(text(
        "UPDATE fdi_projets SET entreprise_id = :e, statut_entreprise = 'resolu', "
        "  modifie_le = :d, modifie_par = :u "
        "WHERE entreprise_brut = :b AND statut_entreprise <> 'resolu' RETURNING id"),
        {"e": entreprise_id, "d": datetime.now(timezone.utc), "u": signataire, "b": brut})).fetchall()
    # La société mère porte le même nom dans la plupart des lignes : on la
    # rattache aussi, sans quoi l'arbitrage serait à refaire côté parent.
    await db.execute(text(
        "UPDATE fdi_projets SET parent_id = :e WHERE parent_brut = :b AND parent_id IS DISTINCT FROM :e"),
        {"e": entreprise_id, "b": brut})

    await db.commit()
    return {"entreprise_id": entreprise_id, "projets_rattaches": len(touches)}


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
