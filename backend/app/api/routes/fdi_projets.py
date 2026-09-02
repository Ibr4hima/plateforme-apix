from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.core.database import get_db
from app.services.fdi_projets import (date_brute, entier_brut, est_tronque,
                                      montant_brut, normaliser)

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
               p.origine, p.champs_verrouilles,
               p.pays_source_id, p.pays_dest_id, p.secteur_id, p.sous_secteur_id,
               p.activite_id, p.type_projet_id,
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
                "origine": r.origine, "champs_verrouilles": list(r.champs_verrouilles or []),
                # Les postes auxquels la ligne est rattachée. Le formulaire de
                # correction s'en sert pour PRÉSÉLECTIONNER, au lieu de rendre à
                # l'utilisateur un libellé tronqué qu'aucune liste ne contient.
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

            if not partagee:
                entreprise_id = actuelle.entreprise_id
                await db.execute(text(
                    "UPDATE fdi_entreprises SET nom = :n, nom_normalise = :c, statut_nom = 'complet', "
                    "  modifie_le = :d, modifie_par = :u WHERE id = :i"),
                    {"n": nom, "c": normaliser(nom), "d": datetime.now(timezone.utc),
                     "u": signataire, "i": entreprise_id})
            else:
                # L'entreprise est partagée : on en ouvre une seconde, et seuls
                # les projets de CE libellé la rejoindront, plus bas.
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
    async def q(sql: str) -> list:
        return [dict(r._mapping) for r in (await db.execute(text(sql))).fetchall()]

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
        # Un pays sans nom anglais ne serait pas rapprochable par l'analyseur :
        # on ne le propose pas plutôt que de le proposer et le refuser ensuite.
        "pays": await q(
            "SELECT id, nom_en AS en, nom_fr AS fr FROM ref_pays "
            " WHERE coalesce(nom_en, '') <> '' ORDER BY nom_fr"),
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
            champs_verrouilles = :verrous,
            modifie_le = :d, modifie_par = :u
        WHERE id = :i
    """), {**col, "statut": statut, "verrous": sorted(verrous),
           "d": datetime.now(timezone.utc), "u": signataire, "i": projet_id})
    await db.commit()
    return {"id": projet_id, "champs_verrouilles": sorted(verrous),
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
            champs_verrouilles, modifie_par)
        VALUES (:lot, :rang, 'saisie', :annee, :mois,
            :parent_brut, :parent_id, :entreprise_brut, :entreprise_id, 'resolu',
            :pays_source_brut, :pays_source_id, :pays_dest_brut, :pays_dest_id,
            :secteur_brut, :secteur_id, :sous_secteur_brut, :sous_secteur_id,
            :activite_brut, :activite_id, :type_brut, :type_projet_id,
            :capex_musd, :capex_estime, :emplois, :emplois_estime,
            '{}', :u)
        RETURNING id
    """), {**col, "lot": lot_id, "rang": rang, "u": signataire})).first()

    await db.execute(text(
        "UPDATE fdi_lots_import SET nb_lignes = (SELECT count(*) FROM fdi_projets WHERE lot_id = :i), "
        "  importe_le = now(), importe_par = :u WHERE id = :i"), {"i": lot_id, "u": signataire})
    await db.commit()
    return {"id": r.id, "lot_id": lot_id, "ligne": rang,
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
