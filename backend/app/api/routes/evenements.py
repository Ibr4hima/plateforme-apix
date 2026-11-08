import os, shutil, uuid as uuid_lib
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, extract, text as sql_text
from typing import Optional, List
from datetime import date as date_type

from app.core.database import get_db
from app.core.cache import en_cache
from app.core.auth import require_admin
from app.models.evenement import Evenement
from app.models.shared import RefPays as RefPaysEvenement
from app.schemas.evenement import (
    EvenementCreate, EvenementUpdate,
    EvenementResponse, EvenementListResponse
)
from app.core.uploads import lire_pdf
from app.core.fichier_partiel import FichierPartiel

router = APIRouter(prefix="/evenements", tags=["Événements"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/evenements")
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def enrich_evenement(e: Evenement, db: AsyncSession) -> EvenementResponse:
    from sqlalchemy import text
    resp = EvenementResponse.model_validate(e)
    # Noms plats (compatibilité)
    if e.secteur_ids:
        r = await db.execute(text("SELECT nom FROM ref_secteurs WHERE id = ANY(:ids)"), {"ids": e.secteur_ids})
        resp.secteur_noms = [row[0] for row in r.fetchall()]
    if e.branche_ids:
        r = await db.execute(text("SELECT nom FROM ref_branches WHERE id = ANY(:ids)"), {"ids": e.branche_ids})
        resp.branche_noms = [row[0] for row in r.fetchall()]
    if e.activite_ids:
        r = await db.execute(text("SELECT nom FROM ref_activites WHERE id = ANY(:ids)"), {"ids": e.activite_ids})
        resp.activite_noms = [row[0] for row in r.fetchall()]
    # Pays invités
    if e.pays_invites_ids:
        r = await db.execute(text("SELECT nom_fr FROM ref_pays WHERE id = ANY(:ids)"), {"ids": e.pays_invites_ids})
        resp.pays_invites_noms = ", ".join(row[0] for row in r.fetchall())
    # Hiérarchie structurée pour l'affichage en arborescence
    if e.secteur_ids or e.branche_ids or e.activite_ids:
        r = await db.execute(text("""
            SELECT
                s.id   AS sec_id,   s.nom AS sec_nom,
                b.id   AS bra_id,   b.nom AS bra_nom,
                a.id   AS act_id,   a.nom AS act_nom
            FROM ref_secteurs s
            LEFT JOIN ref_branches b  ON b.secteur_id = s.id  AND b.id  = ANY(:bra_ids)
            LEFT JOIN ref_activites a ON a.branche_id = b.id  AND a.id  = ANY(:act_ids)
            WHERE s.id = ANY(:sec_ids)
              AND (b.id IS NULL OR b.id = ANY(:bra_ids))
            ORDER BY s.nom, b.nom, a.nom
        """), {
            "sec_ids": e.secteur_ids or [],
            "bra_ids": e.branche_ids or [],
            "act_ids": e.activite_ids or [],
        })
        rows = r.fetchall()
        # Construire la hiérarchie {sec_nom: {bra_nom: [act_nom]}}
        tree: dict = {}
        for row in rows:
            sec = row[1]; bra = row[3]; act = row[5]
            if sec not in tree:
                tree[sec] = {}
            if bra and bra not in tree[sec]:
                tree[sec][bra] = []
            if bra and act and act not in tree[sec][bra]:
                tree[sec][bra].append(act)
        resp.thematiques_tree = tree  # type: ignore
    # Fichiers PDF attachés (to_regclass évite un 500 avant la migration 097)
    resp.fichiers = []
    has_fich = (await db.execute(sql_text("SELECT to_regclass('public.evenement_fichiers')"))).scalar()
    if has_fich:
        r = await db.execute(sql_text(
            "SELECT id, nom FROM evenement_fichiers WHERE evenement_id = :id ORDER BY created_at"
        ), {"id": e.id})
        resp.fichiers = [{"id": row[0], "titre": row[1]} for row in r.fetchall()]
    return resp


def get_statut_calcule(e: Evenement) -> str:
    today = date_type.today()
    if e.date_debut > today:   return "a_venir"
    if e.date_debut <= today <= e.date_fin: return "en_cours"
    return "termine"


# ── GET /evenements/admin — tous les événements (publiés ET non publiés) ──────
@router.get("/admin", response_model=EvenementListResponse)
async def liste_evenements_admin(
    page:     int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    db:       AsyncSession = Depends(get_db),
):
    filters = [Evenement.is_deleted == False]
    total_q = await db.execute(select(func.count()).select_from(Evenement).where(and_(*filters)))
    total   = total_q.scalar()
    result  = await db.execute(
        select(Evenement).where(and_(*filters))
        .order_by(Evenement.date_debut.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    evenements = result.scalars().all()
    return EvenementListResponse(
        total=total, page=page, per_page=per_page,
        data=[await enrich_evenement(e, db) for e in evenements]
    )


# ── GET /evenements/cartes — l'agenda en une requête légère ───────────────────
# La page Événements chargeait la liste complète cent par cent, et chaque
# événement y coûtait jusqu'à sept requêtes (noms des thématiques, pays invités,
# arborescence, fichiers) : à 3 000 événements, 34 requêtes HTTP, environ
# 21 000 requêtes SQL et 4,3 Mo (perf/RESULTATS-2026-11-07.md). Un agenda reste
# un catalogue de taille modeste, et sa frise chronologique le parcourt en
# entier : il arrive donc en une seule réponse, avec les seuls champs des
# cartes, de la frise et des filtres, en une requête SQL. La fiche complète se
# demande à l'ouverture (GET /evenements/{id}).
_CARTE_EVENEMENT = """
    SELECT e.id, e.nom_event, e.edition, e.organisateur, e.role_apix, e.ville, rp.nom_fr AS pays_hote_nom,
           e.date_debut, e.date_fin, e.prochain_jour, e.prochain_mois, e.prochain_annee, e.est_recurrent,
           e.secteur_ids, e.branche_ids, e.activite_ids, e.est_publie
      FROM evenements e
      LEFT JOIN ref_pays rp ON rp.id = e.pays_hote_id"""


def _carte_evenement(r) -> dict:
    iso = lambda v: v.isoformat() if v else None  # noqa: E731
    return {
        "id": r["id"], "nom_event": r["nom_event"], "edition": r["edition"], "organisateur": r["organisateur"],
        "role_apix": r["role_apix"],
        "ville": r["ville"], "pays_hote_nom": r["pays_hote_nom"], "date_debut": iso(r["date_debut"]),
        "date_fin": iso(r["date_fin"]), "prochain_jour": r["prochain_jour"], "prochain_mois": r["prochain_mois"],
        "prochain_annee": r["prochain_annee"], "est_recurrent": r["est_recurrent"],
        "secteur_ids": r["secteur_ids"] or [], "branche_ids": r["branche_ids"] or [],
        "activite_ids": r["activite_ids"] or [], "est_publie": r["est_publie"],
    }


@router.get("/cartes")
@en_cache("evenements")
async def cartes_evenements(admin: bool = Query(False), db: AsyncSession = Depends(get_db)):
    """Tous les événements (publiés, ou tous pour l'administration), dans
    l'ordre de l'agenda : par date de début, les rendez-vous sans date fixée à
    la fin."""
    from sqlalchemy import text
    rows = (await db.execute(text(f"""{_CARTE_EVENEMENT}
         WHERE CAST(:admin AS boolean) OR (e.is_deleted = false AND e.est_publie)
         ORDER BY e.date_debut ASC NULLS LAST, e.id"""), {"admin": admin})).mappings().all()
    return [_carte_evenement(r) for r in rows]


@router.get("/prochain")
@en_cache("evenements", selon_le_jour=True)
async def prochain_evenement(db: AsyncSession = Depends(get_db)):
    """L'événement de l'accueil, avec la règle de la carte (ProchainEvenement) :
    un événement en cours passe devant ; sinon le plus proche à venir — date
    fixée, ou prochaine occurrence annoncée d'un rendez-vous récurrent.
    L'accueil chargeait jusqu'ici l'agenda entier pour en afficher un seul."""
    from sqlalchemy import text
    # La date d'un rendez-vous récurrent : son jour au-delà de la fin du mois
    # déborde sur le suivant, comme une Date JavaScript (31 juin → 1er juillet)
    quand = ("COALESCE(e.date_debut, CASE WHEN e.prochain_annee IS NOT NULL THEN "
             "make_date(e.prochain_annee, COALESCE(e.prochain_mois, 1), 1) + (COALESCE(e.prochain_jour, 1) - 1) END)")
    publies = "e.is_deleted = false AND e.est_publie"
    en_cours = (await db.execute(text(f"""{_CARTE_EVENEMENT}
         WHERE {publies} AND e.date_debut <= CURRENT_DATE AND COALESCE(e.date_fin, e.date_debut) >= CURRENT_DATE
         ORDER BY e.date_debut, e.id LIMIT 1"""))).mappings().first()
    if en_cours:
        return {"evenement": _carte_evenement(en_cours), "en_cours": True}
    a_venir = (await db.execute(text(f"""{_CARTE_EVENEMENT}
         WHERE {publies} AND {quand} > CURRENT_DATE
         ORDER BY {quand}, e.id LIMIT 1"""))).mappings().first()
    return {"evenement": _carte_evenement(a_venir) if a_venir else None, "en_cours": False}


# ── GET /evenements/agenda — la page Événements, une page de cartes à la fois ─
# L'agenda arrivait entier (1 Mo pour les 2 700 événements du banc,
# perf/RESULTATS-2026-11-07-cache.md), filtré et trié par la page elle-même.
# Il arrive désormais par pages de cartes, avec ses règles appliquées ici :
#   · statut « à venir » : début après aujourd'hui, ou rendez-vous sans date
#     fixée (sa prochaine occurrence est à venir) ; « en cours », « terminé » :
#     selon les dates de début et de fin, les rendez-vous sans date exclus ;
#   · ordre « agenda » (liste) : par date de début, sans date à la fin ;
#     ordre « frise » : du plus récent au plus ancien, une date annoncée de
#     rendez-vous récurrent comptant comme sa date, sans aucune date à la fin ;
#   · le prochain événement, celui du filtre (mis en avant dans la vue) et
#     celui de l'agence (le bandeau) : la date future la plus proche.
# La date d'un rendez-vous récurrent : son mois et son jour au-delà de la fin
# débordent sur la suite, comme une Date JavaScript (31 juin → 1er juillet).
_QUAND = ("COALESCE(e.date_debut, CASE WHEN e.prochain_annee > 0 THEN "
          "(make_date(e.prochain_annee, 1, 1) + make_interval(months => COALESCE(e.prochain_mois, 1) - 1, "
          "days => COALESCE(e.prochain_jour, 1) - 1))::date END)")
_STATUTS_AGENDA = {
    "a_venir":  "(e.date_debut IS NULL OR e.date_debut > CURRENT_DATE)",
    "en_cours": "(e.date_debut <= CURRENT_DATE AND COALESCE(e.date_fin, e.date_debut) >= CURRENT_DATE)",
    "termine":  "(e.date_debut IS NOT NULL AND COALESCE(e.date_fin, e.date_debut) < CURRENT_DATE)",
}
_ORDRES_AGENDA = {
    "agenda": "e.date_debut ASC NULLS LAST, e.id",
    "frise":  f"{_QUAND} DESC NULLS LAST, e.date_debut IS NULL, e.id",
}


def _liste_ids(valeur: Optional[str]) -> list[int]:
    return [int(x) for x in (valeur or "").split(",") if x.strip().isdigit()]


def _motif(texte: str) -> str:
    """Un texte cherché tel quel : % et _ n'y sont pas des jokers."""
    return "%" + texte.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


@router.get("/agenda")
@en_cache("evenements", selon_le_jour=True)
async def agenda(
    ordre: str = Query("agenda", pattern="^(agenda|frise)$"),
    q: Optional[str] = Query(None),
    statut: Optional[str] = Query(None, pattern="^(a_venir|en_cours|termine)$"),
    pays: List[str] = Query(default=[], description="noms des pays hôtes, un par paramètre"),
    secteurs: Optional[str] = Query(None),
    branches: Optional[str] = Query(None),
    activites: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    par_page: int = Query(60, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text
    conds = ["e.is_deleted = false", "e.est_publie"]
    params: dict = {}
    if q and q.strip():
        conds.append("(e.nom_event ILIKE :q OR e.organisateur ILIKE :q OR e.ville ILIKE :q OR rp.nom_fr ILIKE :q)")
        params["q"] = _motif(q.strip())
    if statut:
        conds.append(_STATUTS_AGENDA[statut])
    if pays:
        conds.append("COALESCE(rp.nom_fr, '') = ANY(:pays)")
        params["pays"] = pays
    for nom, valeur, colonne in (("secteurs", secteurs, "secteur_ids"), ("branches", branches, "branche_ids"),
                                 ("activites", activites, "activite_ids")):
        if ids := _liste_ids(valeur):
            conds.append(f"e.{colonne} && CAST(:{nom} AS integer[])")
            params[nom] = ids
    where = " AND ".join(conds)
    total = (await db.execute(text(f"""SELECT count(*) FROM evenements e
         LEFT JOIN ref_pays rp ON rp.id = e.pays_hote_id WHERE {where}"""), params)).scalar_one()
    lignes = (await db.execute(text(f"""{_CARTE_EVENEMENT}
         WHERE {where} ORDER BY {_ORDRES_AGENDA[ordre]}
         LIMIT :n OFFSET :o"""), {**params, "n": par_page, "o": (page - 1) * par_page})).mappings().all()
    reponse = {
        "data": [_carte_evenement(r) for r in lignes],
        "total": total, "page": page, "par_page": par_page, "pages": max(1, -(-total // par_page)),
    }
    if page == 1:
        # Le prochain événement : du filtre, puis de l'agence
        prochain = f"{_QUAND} > CURRENT_DATE ORDER BY {_QUAND}, e.date_debut IS NULL, e.id LIMIT 1"
        reponse["prochain_id"] = (await db.execute(text(f"""SELECT e.id FROM evenements e
             LEFT JOIN ref_pays rp ON rp.id = e.pays_hote_id WHERE {where} AND {prochain}"""), params)).scalar()
        agence = (await db.execute(text(f"""SELECT e.id, e.nom_event, e.date_debut FROM evenements e
             WHERE e.is_deleted = false AND e.est_publie AND {prochain}"""))).mappings().first()
        reponse["prochain"] = {"id": agence["id"], "nom_event": agence["nom_event"],
                               "date_debut": agence["date_debut"].isoformat() if agence["date_debut"] else None} \
            if agence else None
    return reponse


# ── GET /evenements/admin/cartes — l'administration, soixante cartes à la fois ─
# La page d'administration recevait tous les événements (1,2 Mo pour les 3 000
# du banc) et les triait, les filtrait elle-même. Elle les reçoit désormais par
# pages, avec sa règle :
#   · tous les événements, publiés ou non ;
#   · recherche sur le nom, l'organisateur, la ville, le pays hôte, le rôle de
#     l'APIX ;
#   · ordre de travail : en cours, puis à venir (et les rendez-vous récurrents
#     sans date fixée), sans date, enfin terminés ; dans chaque groupe par date
#     (de la plus proche ; les terminés du plus récent au plus ancien), puis
#     par nom dans l'ordre alphabétique français (localeCompare « fr », que la
#     collation ICU fr reproduit), puis dans l'ordre de l'agenda ;
#   · le prochain événement (date future la plus proche), sur la première page.
_RANG_ADMIN = """CASE WHEN e.date_debut IS NOT NULL THEN
         CASE WHEN e.date_debut > CURRENT_DATE THEN 1
              WHEN COALESCE(e.date_fin, e.date_debut) < CURRENT_DATE THEN 3
              ELSE 0 END
       WHEN COALESCE(e.prochain_annee, 0) <> 0 OR COALESCE(e.prochain_mois, 0) <> 0 THEN 1
       ELSE 2 END"""
# La date d'une carte (dateDebutDe) ; sans date, 0 (le 1er janvier 1970)
_DATE_ADMIN = f"COALESCE({_QUAND}, DATE '1970-01-01')"
_collation_fr: Optional[str] = None


async def _collation_noms(db: AsyncSession) -> str:
    """La collation ICU française si la base l'a (Postgres compilé avec ICU),
    sinon celle de la base."""
    global _collation_fr
    if _collation_fr is None:
        from sqlalchemy import text
        existe = (await db.execute(text("SELECT 1 FROM pg_collation WHERE collname = 'fr-x-icu'"))).scalar()
        _collation_fr = ' COLLATE "fr-x-icu"' if existe else ""
    return _collation_fr


@router.get("/admin/cartes")
async def cartes_evenements_admin(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    par_page: int = Query(60, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    from sqlalchemy import text
    conds, params = ["true"], {}
    if q and q.strip():
        conds.append("(e.nom_event ILIKE :q OR e.organisateur ILIKE :q OR e.ville ILIKE :q"
                     " OR rp.nom_fr ILIKE :q OR e.role_apix ILIKE :q)")
        params["q"] = _motif(q.strip())
    where = " AND ".join(conds)
    collation = await _collation_noms(db)
    ordre = (f"{_RANG_ADMIN}, CASE WHEN ({_RANG_ADMIN}) = 3 THEN NULL ELSE {_DATE_ADMIN} END ASC, "
             f"CASE WHEN ({_RANG_ADMIN}) = 3 THEN {_DATE_ADMIN} END DESC, "
             f"COALESCE(e.nom_event, ''){collation}, e.date_debut ASC NULLS LAST, e.id")
    total = (await db.execute(text(f"""SELECT count(*) FROM evenements e
         LEFT JOIN ref_pays rp ON rp.id = e.pays_hote_id WHERE {where}"""), params)).scalar_one()
    total_general = (await db.execute(text("SELECT count(*) FROM evenements"))).scalar_one()
    lignes = (await db.execute(text(f"""{_CARTE_EVENEMENT}
         WHERE {where} ORDER BY {ordre}
         LIMIT :n OFFSET :o"""), {**params, "n": par_page, "o": (page - 1) * par_page})).mappings().all()
    reponse = {
        "data": [_carte_evenement(r) for r in lignes],
        "total": total, "total_general": total_general,
        "page": page, "par_page": par_page, "pages": max(1, -(-total // par_page)),
    }
    if page == 1:
        # Le prochain événement, parmi tous (la règle de la page d'avant)
        reponse["prochain_id"] = (await db.execute(text(f"""SELECT e.id FROM evenements e
             WHERE {_QUAND} > CURRENT_DATE ORDER BY {_QUAND}, e.date_debut IS NULL, e.id LIMIT 1"""))).scalar()
    return reponse


# ── GET /evenements ────────────────────────────────────────────────────────────
@router.get("", response_model=EvenementListResponse)
async def liste_evenements(
    page:           int           = Query(1, ge=1),
    per_page:       int           = Query(12, ge=1, le=100),
    statut_calcule: Optional[str] = None,
    pays_nom:       List[str]     = Query(default=[]),
    annee:          Optional[int] = None,
    secteur:        List[str]     = Query(default=[]),
    branche:        List[str]     = Query(default=[]),
    activite:       List[str]     = Query(default=[]),
    admin:          bool          = Query(False),  # si True → pas de filtre est_publie
    db:             AsyncSession  = Depends(get_db),
):
    today = date_type.today()
    filters = []
    if not admin:
        filters.append(Evenement.est_publie == True)


    # Pays hôte — OR intra
    if pays_nom:
        filters.append(Evenement.pays_hote_id.in_(
            select(RefPaysEvenement.id).where(or_(*[RefPaysEvenement.nom_fr == p for p in pays_nom]))
        ))

    if annee:
        filters.append(extract("year", Evenement.date_debut) == annee)

    # Thématiques — OR intra-groupe, ET inter-groupes
    if secteur:
        filters.append(or_(*[Evenement.thematiques_naema.ilike(f"%sec:{s}%") for s in secteur]))
    if branche:
        filters.append(or_(*[Evenement.thematiques_naema.ilike(f"%bra:{b}%") for b in branche]))
    if activite:
        filters.append(or_(*[Evenement.thematiques_naema.ilike(f"%act:{a}%") for a in activite]))

    if statut_calcule == "a_venir":
        filters.append(Evenement.date_debut > today)
    elif statut_calcule == "en_cours":
        filters.append(and_(Evenement.date_debut <= today, Evenement.date_fin >= today))
    elif statut_calcule == "termine":
        filters.append(Evenement.date_fin < today)

    total_q = await db.execute(select(func.count()).select_from(Evenement).where(and_(*filters)))
    total   = total_q.scalar()

    result  = await db.execute(
        select(Evenement).where(and_(*filters))
        .order_by(Evenement.date_debut.asc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    evenements = result.scalars().all()
    return EvenementListResponse(
        total=total, page=page, per_page=per_page,
        data=[await enrich_evenement(e, db) for e in evenements]
    )


# ── GET /evenements/stats ──────────────────────────────────────────────────────
@router.get("/stats")
async def stats_evenements(db: AsyncSession = Depends(get_db)):
    today = date_type.today()
    base  = and_(Evenement.est_publie == True)
    total    = (await db.execute(select(func.count()).select_from(Evenement).where(base))).scalar()
    a_venir  = (await db.execute(select(func.count()).select_from(Evenement).where(and_(base, Evenement.date_debut > today)))).scalar()
    en_cours = (await db.execute(select(func.count()).select_from(Evenement).where(and_(base, Evenement.date_debut <= today, Evenement.date_fin >= today)))).scalar()
    termine  = (await db.execute(select(func.count()).select_from(Evenement).where(and_(base, Evenement.date_fin < today)))).scalar()
    return {"total": total, "a_venir": a_venir, "en_cours": en_cours, "termine": termine}


# ── GET /evenements/pays-hotes ─────────────────────────────────────────────────
@router.get("/pays-hotes")
@en_cache("evenements")
async def pays_hotes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RefPaysEvenement.nom_fr, RefPaysEvenement.code_iso2)
        .join(Evenement, Evenement.pays_hote_id == RefPaysEvenement.id)
        .where(Evenement.est_publie == True)
        .distinct()
        .order_by(RefPaysEvenement.nom_fr)
    )
    return [r.nom_fr for r in result.all()]


# ── GET /evenements/:id ────────────────────────────────────────────────────────
@router.get("/{evenement_id}", response_model=EvenementResponse)
async def detail_evenement(evenement_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evenement).where(Evenement.id == evenement_id))
    e = result.scalar_one_or_none()
    if not e: raise HTTPException(status_code=404, detail="Événement introuvable")
    return await enrich_evenement(e, db)


# ── POST /evenements ───────────────────────────────────────────────────────────
@router.post("", response_model=EvenementResponse, status_code=201)
async def creer_evenement(payload: EvenementCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from datetime import date as date_type
    data = payload.model_dump(exclude_none=True)
    # Validation : date_debut >= aujourd'hui
    if "date_debut" in data and data["date_debut"] < date_type.today():
        raise HTTPException(422, "La date de début ne peut pas être dans le passé")
    data.pop("statut", None)  # sécurité
    e = Evenement(**data)
    db.add(e)
    await db.flush()
    await db.refresh(e)
    return await enrich_evenement(e, db)


# ── PATCH /evenements/:id ──────────────────────────────────────────────────────
@router.patch("/{evenement_id}", response_model=EvenementResponse)
async def modifier_evenement(evenement_id: int, payload: EvenementUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    result = await db.execute(select(Evenement).where(Evenement.id == evenement_id))
    e = result.scalar_one_or_none()
    if not e: raise HTTPException(status_code=404, detail="Événement introuvable")
    updates = payload.model_dump(exclude_unset=True)
    updates.pop("statut", None)
    # Ne pas écraser les dates existantes avec null si l'événement en avait déjà
    for f in ["date_debut", "date_fin"]:
        if f in updates and updates[f] is None and getattr(e, f) is not None:
            updates.pop(f)
    for k, v in updates.items():
        setattr(e, k, v)
    await db.flush()
    await db.refresh(e)
    return await enrich_evenement(e, db)


# ── DELETE /evenements/:id ─────────────────────────────────────────────────────
@router.delete("/{evenement_id}", status_code=204)
async def supprimer_evenement(evenement_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    result = await db.execute(select(Evenement).where(Evenement.id == evenement_id))
    e = result.scalar_one_or_none()
    if not e: raise HTTPException(status_code=404, detail="Événement introuvable")
    await db.delete(e)
    await db.flush()


# ── Fichiers PDF des événements ────────────────────────────────────────────────

@router.post("/{evenement_id}/fichiers", status_code=201)
async def ajouter_fichier_evenement(
    evenement_id: int,
    titre:   str        = Form(""),
    fichier: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    contenu = await lire_pdf(fichier)
    unique_name = f"{uuid_lib.uuid4()}.pdf"
    dest = os.path.join(UPLOAD_DIR, unique_name)
    with open(dest, "wb") as f:
        f.write(contenu)
    res = await db.execute(sql_text("""
        INSERT INTO evenement_fichiers (evenement_id, nom, url, type_fichier)
        VALUES (:eid, :nom, :url, 'PDF')
        RETURNING id
    """), {"eid": evenement_id, "nom": titre or fichier.filename, "url": dest})
    fid = res.fetchone()[0]
    await db.flush()
    return {"id": fid, "titre": titre or fichier.filename}


@router.delete("/{evenement_id}/fichiers/{fichier_id}", status_code=204)
async def supprimer_fichier_evenement(evenement_id: int, fichier_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    res = await db.execute(sql_text(
        "SELECT url FROM evenement_fichiers WHERE id = :id AND evenement_id = :eid"
    ), {"id": fichier_id, "eid": evenement_id})
    f = res.fetchone()
    if not f: raise HTTPException(404, "Fichier introuvable")
    if f[0] and os.path.exists(f[0]):
        os.remove(f[0])
    await db.execute(sql_text("DELETE FROM evenement_fichiers WHERE id = :id"), {"id": fichier_id})
    await db.flush()


@router.get("/{evenement_id}/fichiers/{fichier_id}/download")
async def telecharger_fichier_evenement(evenement_id: int, fichier_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(sql_text(
        "SELECT nom, url FROM evenement_fichiers WHERE id = :id AND evenement_id = :eid"
    ), {"id": fichier_id, "eid": evenement_id})
    f = res.fetchone()
    if not f or not f[1]: raise HTTPException(404, "Fichier introuvable")
    # Fallback machine-indépendant si le chemin absolu enregistré n'existe plus
    path = f[1]
    if not os.path.exists(path):
        path = os.path.join(UPLOAD_DIR, os.path.basename(f[1]))
    if not os.path.exists(path):
        raise HTTPException(404, "Fichier introuvable sur le serveur")
    nom = f[0] or "document.pdf"
    return FichierPartiel(path, filename=nom if nom.lower().endswith(".pdf") else f"{nom}.pdf", media_type="application/pdf")
