from datetime import date as date_type, datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete as sqldel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.prospect import (
    Prospect, ProspectPointFocal, ProspectEchange, ProspectContrainte, ProspectContact,
    ProspectCycle,
)
from app.models.projet import Projet
from app.utils.dedup import collect_contacts, LABELS

router = APIRouter(prefix="/prospects", tags=["Prospects"])

def _conclu_fige(issue, conclu_le=None) -> bool:
    """Vrai dès qu'une prospection est conclue : elle est aussitôt archivée
    dans « Précédents contacts » et passe en lecture seule."""
    return issue is not None


# ── Déduplication ─────────────────────────────────────────────────────────────
async def verifier_doublons(db: AsyncSession, payload: dict, exclure_prospect_id: int | None = None) -> dict:
    """Vérifie qu'aucune coordonnée (tel/mail/site/linkedin) de la charge utile
    n'existe déjà pour un AUTRE prospect. Un seul match suffit à bloquer (409).
    Retourne le dict des contacts normalisés (à réinsérer après sauvegarde)."""
    contacts = collect_contacts(payload)
    if not contacts:
        return contacts

    conds = [
        and_(ProspectContact.type == t, ProspectContact.valeur_normalisee == v)
        for (t, v) in contacts.keys()
    ]
    stmt = select(ProspectContact).where(or_(*conds))
    if exclure_prospect_id is not None:
        stmt = stmt.where(ProspectContact.prospect_id != exclure_prospect_id)
    res = await db.execute(stmt)
    hit = res.scalars().first()
    if hit:
        pr = await db.execute(
            select(Prospect.nom, Prospect.issue).where(Prospect.id == hit.prospect_id)
        )
        row = pr.first()
        nom = "un autre prospect"
        is_archive = False
        if row:
            nom = row[0] or "un autre prospect"
            is_archive = row[1] is not None
        label = LABELS.get(hit.type, "Cette coordonnée")
        if is_archive:
            if row[1] == "installe":
                raise HTTPException(
                    409,
                    f"{label} « {hit.valeur_affichee} » appartient à « {nom} », une entreprise déjà installée au Sénégal "
                    f"(archivée dans « Précédents contacts »).",
                )
            raise HTTPException(
                409,
                f"{label} « {hit.valeur_affichee} » appartient à « {nom} », une prospection archivée dans « Précédents contacts ». "
                f"Pour re-démarcher cette entreprise, utilisez le bouton « Re-contacter » depuis cet onglet.",
            )
        raise HTTPException(
            409,
            f"{label} « {hit.valeur_affichee} » est déjà enregistré pour le prospect « {nom} ». "
            f"Un investisseur ne peut être démarché que par un seul agent à la fois.",
        )
    return contacts


async def ecrire_contacts(db: AsyncSession, prospect_id: int, contacts: dict):
    """Remplace les coordonnées normalisées d'un prospect."""
    await db.execute(sqldel(ProspectContact).where(ProspectContact.prospect_id == prospect_id))
    for c in contacts.values():
        db.add(ProspectContact(
            prospect_id       = prospect_id,
            type              = c["type"],
            valeur_normalisee = c["valeur_normalisee"],
            valeur_affichee   = c["valeur_affichee"],
            origine           = c["origine"],
        ))

LOAD_OPTS = [
    selectinload(Prospect.siege),
    selectinload(Prospect.points_focaux),
    selectinload(Prospect.echanges),
    selectinload(Prospect.contraintes),
    selectinload(Prospect.cycles),
]


async def get_projet_titre(db: AsyncSession, projet_id: int | None) -> str | None:
    if not projet_id:
        return None
    res = await db.execute(select(Projet.titre_projet).where(Projet.id == projet_id))
    return res.scalar_one_or_none()


def contrainte_to_dict(c: ProspectContrainte) -> dict:
    return {
        "id":                  c.id,
        "prospect_id":         c.prospect_id,
        "cycle_num":           c.cycle_num,
        "description":         c.description,
        "solution_preconisee": c.solution_preconisee,
        "statut":              c.statut,
        "created_at":          c.created_at.isoformat() if c.created_at else None,
        "updated_at":          c.updated_at.isoformat() if c.updated_at else None,
    }


def cycle_to_dict(c: ProspectCycle) -> dict:
    return {
        "id":                c.id,
        "prospect_id":       c.prospect_id,
        "cycle_num":         c.cycle_num,
        "issue":             c.issue,
        "issue_commentaire": c.issue_commentaire,
        "conclu_le":         c.conclu_le.isoformat() if c.conclu_le else None,
        "recontacte_le":     c.recontacte_le.isoformat() if c.recontacte_le else None,
    }


def echange_to_dict(e: ProspectEchange) -> dict:
    enregistre = e.enregistre_le
    echange_dt  = e.date_echange
    retard_jours = None
    if enregistre and echange_dt:
        if hasattr(enregistre, "date"):
            delta = enregistre.date() - echange_dt
        else:
            delta = enregistre - echange_dt
        retard_jours = delta.days if delta.days > 0 else 0
    return {
        "id":              e.id,
        "prospect_id":     e.prospect_id,
        "date_echange":    e.date_echange.isoformat() if e.date_echange else None,
        "commentaire":     e.commentaire,
        "contact_par":     e.contact_par,
        "interlocuteur":   e.interlocuteur,
        "canal":           e.canal,
        "canal_contact":   e.canal_contact,
        "point_focal_id":  e.point_focal_id,
        "enregistre_le":   e.enregistre_le.isoformat() if e.enregistre_le else None,
        "retard_jours":    retard_jours,
    }


def prospect_to_dict(p: Prospect, projet_titre: str | None = None) -> dict:
    echanges_sorted = sorted(p.echanges or [], key=lambda e: e.date_echange)
    return {
        "id":              p.id,
        "type":            "morale",
        "nom":             p.nom,
        "siege_id":        p.siege_id,
        "siege_nom":       p.siege.nom_fr if p.siege else None,
        "secteur_ids":     p.secteur_ids or [],
        "branche_ids":     p.branche_ids or [],
        "activite_ids":    p.activite_ids or [],
        "points_focaux": [
            {"id": pf.id, "prenom": pf.prenom, "nom": pf.nom,
             "telephones": pf.telephones or [], "mails": pf.mails or []}
            for pf in (p.points_focaux or [])
        ],
        "telephones":      p.telephones or [],
        "mails":           p.mails or [],
        "siteweb":         p.siteweb,
        "linkedin":        p.linkedin,
        "issue":           p.issue,
        "issue_commentaire": p.issue_commentaire,
        "issue_conclu_le": p.issue_conclu_le.isoformat() if p.issue_conclu_le else None,
        "adresse":         p.adresse,
        "details":         p.details,
        "est_publie":      p.est_publie,
        "created_at":      p.created_at.isoformat() if p.created_at else None,
        # objet du ciblage
        "objet_projet":              p.objet_projet or False,
        "objet_projet_id":           p.objet_projet_id,
        "objet_projet_titre":        projet_titre,
        "objet_intentions_etranger":      p.objet_intentions_etranger or False,
        "objet_intentions_secteur_ids":   p.objet_intentions_secteur_ids or [],
        "objet_intentions_branche_ids":   p.objet_intentions_branche_ids or [],
        "objet_intentions_activite_ids":  p.objet_intentions_activite_ids or [],
        "objet_intentions_details":       p.objet_intentions_details,
        "objet_adequation_senegal":       p.objet_adequation_senegal or False,
        "objet_adequation_secteur_ids":   p.objet_adequation_secteur_ids or [],
        "objet_adequation_branche_ids":   p.objet_adequation_branche_ids or [],
        "objet_adequation_activite_ids":  p.objet_adequation_activite_ids or [],
        "objet_adequation_details":       p.objet_adequation_details,
        "objet_commentaires":             p.objet_commentaires,
        # échanges
        "nb_echanges":         len(echanges_sorted),
        "date_premier_echange": echanges_sorted[0].date_echange.isoformat() if echanges_sorted else None,
        "date_dernier_echange": echanges_sorted[-1].date_echange.isoformat() if echanges_sorted else None,
        "dernier_contact_par":  echanges_sorted[-1].contact_par if echanges_sorted else None,
        "echanges": [echange_to_dict(e) for e in echanges_sorted],
        "contraintes": [contrainte_to_dict(c) for c in (p.contraintes or [])],
        # cycles de prospection passés (re-contacts)
        "cycles": [cycle_to_dict(c) for c in sorted(p.cycles or [], key=lambda c: c.cycle_num)],
    }


# ── GET /prospects ────────────────────────────────────────────────────────────
@router.get("")
async def liste_prospects(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    contactes: Optional[bool] = Query(None),
    conclu: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import or_, exists
    base = select(Prospect).options(*LOAD_OPTS).where(Prospect.is_deleted == False)
    if q:
        base = base.where(Prospect.nom.ilike(f"%{q}%"))
    if contactes is True:
        base = base.where(exists().where(ProspectEchange.prospect_id == Prospect.id))
    elif contactes is False:
        base = base.where(~exists().where(ProspectEchange.prospect_id == Prospect.id))
    if conclu is True:   # archivés : prospections conclues
        base = base.where(Prospect.issue.isnot(None))
    elif conclu is False:  # actifs : prospections non conclues
        base = base.where(Prospect.issue.is_(None))
    base = base.order_by(Prospect.created_at.desc())
    count_res = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_res.scalar_one()
    res = await db.execute(base.offset((page - 1) * per_page).limit(per_page))
    prospects = res.scalars().all()
    projet_ids = list({p.objet_projet_id for p in prospects if p.objet_projet_id})
    titres: dict = {}
    if projet_ids:
        r = await db.execute(select(Projet.id, Projet.titre_projet).where(Projet.id.in_(projet_ids)))
        titres = {row[0]: row[1] for row in r.fetchall()}
    return {"data": [prospect_to_dict(p, titres.get(p.objet_projet_id)) for p in prospects],
            "total": total, "page": page, "per_page": per_page}


# ── GET /prospects/:id ────────────────────────────────────────────────────────
@router.get("/{prospect_id}")
async def lire_prospect(prospect_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Prospect).options(*LOAD_OPTS)
        .where(Prospect.id == prospect_id, Prospect.is_deleted == False)
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Prospect introuvable")
    titre = await get_projet_titre(db, p.objet_projet_id)
    return prospect_to_dict(p, titre)


# ── POST /prospects ───────────────────────────────────────────────────────────
@router.post("", status_code=201)
async def creer_prospect(payload: dict, db: AsyncSession = Depends(get_db)):
    if not payload.get("nom", "").strip():
        raise HTTPException(422, "Le nom est obligatoire")
    # Champs contact obligatoires
    if not [t for t in (payload.get("telephones") or []) if t]:
        raise HTTPException(422, "Au moins un numéro de téléphone est obligatoire")
    if not [m for m in (payload.get("mails") or []) if m]:
        raise HTTPException(422, "Au moins un email est obligatoire")
    if not (payload.get("siteweb") or "").strip():
        raise HTTPException(422, "Le site web est obligatoire pour une personne morale")
    for pf in payload.get("points_focaux") or []:
        if not (pf.get("nom") or "").strip():
            continue
        if not [t for t in (pf.get("telephones") or []) if t]:
            raise HTTPException(422, f"Point focal « {pf['nom']} » : au moins un téléphone est obligatoire")
        if not [m for m in (pf.get("mails") or []) if m]:
            raise HTTPException(422, f"Point focal « {pf['nom']} » : au moins un email est obligatoire")
    # Déduplication : bloque si une coordonnée existe déjà
    contacts = await verifier_doublons(db, payload)
    p = Prospect(
        type            = "morale",
        nom             = payload["nom"].strip(),
        siege_id        = payload.get("siege_id") or None,
        secteur_ids     = payload.get("secteur_ids") or [],
        branche_ids     = payload.get("branche_ids") or [],
        activite_ids    = payload.get("activite_ids") or [],
        telephones      = payload.get("telephones") or [],
        mails           = payload.get("mails") or [],
        siteweb         = payload.get("siteweb") or None,
        linkedin        = payload.get("linkedin") or None,
        adresse         = payload.get("adresse") or None,
        details         = payload.get("details") or None,
        objet_projet              = payload.get("objet_projet") or False,
        objet_projet_id           = payload.get("objet_projet_id") or None,
        objet_intentions_etranger     = payload.get("objet_intentions_etranger") or False,
        objet_intentions_secteur_ids  = payload.get("objet_intentions_secteur_ids") or [],
        objet_intentions_branche_ids  = payload.get("objet_intentions_branche_ids") or [],
        objet_intentions_activite_ids = payload.get("objet_intentions_activite_ids") or [],
        objet_intentions_details      = payload.get("objet_intentions_details") or None,
        objet_adequation_senegal      = payload.get("objet_adequation_senegal") or False,
        objet_adequation_secteur_ids  = payload.get("objet_adequation_secteur_ids") or [],
        objet_adequation_branche_ids  = payload.get("objet_adequation_branche_ids") or [],
        objet_adequation_activite_ids = payload.get("objet_adequation_activite_ids") or [],
        objet_adequation_details      = payload.get("objet_adequation_details") or None,
        objet_commentaires            = payload.get("objet_commentaires") or None,
    )
    db.add(p)
    await db.flush()
    for pf_data in payload.get("points_focaux") or []:
        if not (pf_data.get("nom") or "").strip():
            continue
        db.add(ProspectPointFocal(
            prospect_id = p.id,
            prenom      = pf_data.get("prenom") or None,
            nom         = pf_data["nom"].strip(),
            telephones  = pf_data.get("telephones") or [],
            mails       = pf_data.get("mails") or [],
        ))
    await ecrire_contacts(db, p.id, contacts)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Une coordonnée de ce prospect vient d'être enregistrée pour un autre prospect.")
    res = await db.execute(select(Prospect).options(*LOAD_OPTS).where(Prospect.id == p.id))
    p2 = res.scalar_one()
    titre = await get_projet_titre(db, p2.objet_projet_id)
    return prospect_to_dict(p2, titre)


# ── PATCH /prospects/:id ──────────────────────────────────────────────────────
@router.patch("/{prospect_id}")
async def modifier_prospect(prospect_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Prospect).options(*LOAD_OPTS).where(Prospect.id == prospect_id, Prospect.is_deleted == False))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Prospect introuvable")
    if _conclu_fige(p.issue, p.issue_conclu_le):
        raise HTTPException(403, "La prospection est archivée : les informations du prospect ne peuvent plus être modifiées.")

    # État effectif après mise à jour (payload si fourni, sinon valeurs actuelles)
    eff_tels  = payload["telephones"] if "telephones" in payload else (p.telephones or [])
    eff_mails = payload["mails"]      if "mails"      in payload else (p.mails or [])
    eff_site  = payload["siteweb"]    if "siteweb"    in payload else p.siteweb
    eff_pf    = payload["points_focaux"] if "points_focaux" in payload else [
        {"nom": pf.nom, "telephones": pf.telephones or [], "mails": pf.mails or []}
        for pf in (p.points_focaux or [])
    ]

    # Validation champs obligatoires sur l'état final
    if not [t for t in eff_tels if t]:
        raise HTTPException(422, "Au moins un numéro de téléphone est obligatoire")
    if not [m for m in eff_mails if m]:
        raise HTTPException(422, "Au moins un email est obligatoire")
    if not (eff_site or "").strip():
        raise HTTPException(422, "Le site web est obligatoire pour une personne morale")
    for pf in eff_pf:
        if not (pf.get("nom") or "").strip():
            continue
        if not [t for t in (pf.get("telephones") or []) if t]:
            raise HTTPException(422, f"Point focal « {pf['nom']} » : au moins un téléphone est obligatoire")
        if not [m for m in (pf.get("mails") or []) if m]:
            raise HTTPException(422, f"Point focal « {pf['nom']} » : au moins un email est obligatoire")

    # Déduplication : bloque si une coordonnée existe déjà pour un autre prospect
    eff = {
        "telephones": eff_tels, "mails": eff_mails,
        "siteweb":    eff_site,
        "linkedin":   payload["linkedin"] if "linkedin" in payload else p.linkedin,
        "points_focaux": eff_pf,
    }
    contacts = await verifier_doublons(db, eff, exclure_prospect_id=prospect_id)

    for f in ["nom", "adresse", "details", "siteweb", "linkedin",
              "objet_intentions_details", "objet_adequation_details", "objet_commentaires"]:
        if f in payload:
            setattr(p, f, payload[f] or None)
    for f in ["objet_projet", "objet_intentions_etranger", "objet_adequation_senegal", "est_publie"]:
        if f in payload:
            setattr(p, f, payload[f])
    if "telephones"      in payload: p.telephones      = payload["telephones"] or []
    if "mails"           in payload: p.mails           = payload["mails"] or []
    if "siege_id"        in payload: p.siege_id        = payload["siege_id"] or None
    if "objet_projet_id" in payload: p.objet_projet_id = payload["objet_projet_id"] or None
    if "secteur_ids"     in payload: p.secteur_ids     = payload["secteur_ids"] or []
    if "branche_ids"     in payload: p.branche_ids     = payload["branche_ids"] or []
    if "activite_ids"    in payload: p.activite_ids    = payload["activite_ids"] or []
    for f in ["objet_intentions_secteur_ids", "objet_intentions_branche_ids", "objet_intentions_activite_ids",
              "objet_adequation_secteur_ids", "objet_adequation_branche_ids", "objet_adequation_activite_ids"]:
        if f in payload:
            setattr(p, f, payload[f] or [])
    if "points_focaux" in payload:
        await db.execute(sqldel(ProspectPointFocal).where(ProspectPointFocal.prospect_id == prospect_id))
        for pf_data in payload["points_focaux"] or []:
            if not (pf_data.get("nom") or "").strip():
                continue
            db.add(ProspectPointFocal(
                prospect_id = prospect_id,
                prenom      = pf_data.get("prenom") or None,
                nom         = pf_data["nom"].strip(),
                telephones  = pf_data.get("telephones") or [],
                mails       = pf_data.get("mails") or [],
            ))
    await ecrire_contacts(db, prospect_id, contacts)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Une coordonnée de ce prospect vient d'être enregistrée pour un autre prospect.")
    res = await db.execute(select(Prospect).options(*LOAD_OPTS).where(Prospect.id == prospect_id))
    p2 = res.scalar_one()
    titre = await get_projet_titre(db, p2.objet_projet_id)
    return prospect_to_dict(p2, titre)


# ── DELETE /prospects/:id ─────────────────────────────────────────────────────
@router.delete("/{prospect_id}", status_code=204)
async def supprimer_prospect(prospect_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Prospect introuvable")
    await db.delete(p)
    await db.flush()


# ── PATCH /prospects/:id/conclusion ──────────────────────────────────────────
@router.patch("/{prospect_id}/conclusion")
async def conclure_prospect(prospect_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    """Met à jour l'issue de la relation (installe / decline / null) et son commentaire."""
    res = await db.execute(select(Prospect).where(Prospect.id == prospect_id, Prospect.is_deleted == False))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Prospect introuvable")
    if _conclu_fige(p.issue, p.issue_conclu_le):
        raise HTTPException(403, "La prospection est archivée et ne peut plus être modifiée.")
    issue = (payload.get("issue") or "").strip() or None
    if issue not in (None, "installe", "decline"):
        raise HTTPException(422, "Issue invalide (attendu : installe | decline | null)")
    commentaire = (payload.get("issue_commentaire") or "").strip() or None
    if issue is not None and not commentaire:
        raise HTTPException(422, "Un commentaire est obligatoire pour conclure la prospection")
    p.issue              = issue
    p.issue_commentaire  = commentaire if issue else None
    p.issue_conclu_le    = datetime.now(timezone.utc) if issue else None
    await db.flush()
    return {"issue": p.issue, "issue_commentaire": p.issue_commentaire,
            "issue_conclu_le": p.issue_conclu_le.isoformat() if p.issue_conclu_le else None}


# ── POST /prospects/:id/rouvrir ───────────────────────────────────────────────
@router.post("/{prospect_id}/rouvrir")
async def rouvrir_prospect(prospect_id: int, db: AsyncSession = Depends(get_db)):
    """Remet à zéro la conclusion sans archiver de cycle — correction d'erreur.
    À utiliser pour annuler un 'Installé' ou 'Décliné' saisi par mégarde."""
    res = await db.execute(
        select(Prospect).options(*LOAD_OPTS)
        .where(Prospect.id == prospect_id, Prospect.is_deleted == False)
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Prospect introuvable")
    if p.issue is None:
        raise HTTPException(409, "Cette prospection n'est pas archivée.")
    p.issue             = None
    p.issue_commentaire = None
    p.issue_conclu_le   = None
    await db.flush()
    res = await db.execute(select(Prospect).options(*LOAD_OPTS).where(Prospect.id == prospect_id))
    p2 = res.scalar_one()
    titre = await get_projet_titre(db, p2.objet_projet_id)
    return prospect_to_dict(p2, titre)


# ── POST /prospects/:id/recontact ─────────────────────────────────────────────
@router.post("/{prospect_id}/recontact")
async def recontacter_prospect(prospect_id: int, db: AsyncSession = Depends(get_db)):
    """Re-ouvre une prospection « Déclinée » archivée : la conclusion courante
    est versée dans l'historique des cycles, puis le prospect repart à zéro
    (issue = NULL) et réapparaît dans les onglets actifs. Tout l'historique des
    échanges et contraintes est conservé."""
    res = await db.execute(
        select(Prospect).options(*LOAD_OPTS)
        .where(Prospect.id == prospect_id, Prospect.is_deleted == False)
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Prospect introuvable")
    if p.issue is None:
        raise HTTPException(409, "Cette prospection n'est pas archivée : rien à re-contacter.")
    if p.issue != "decline":
        raise HTTPException(409, "Seule une prospection « Déclinée » peut être re-contactée.")

    # Numéro du prochain cycle (1 + le plus haut cycle déjà archivé)
    next_num = 1 + max([c.cycle_num for c in (p.cycles or [])], default=0)

    db.add(ProspectCycle(
        prospect_id       = p.id,
        cycle_num         = next_num,
        issue             = p.issue,
        issue_commentaire = p.issue_commentaire,
        conclu_le         = p.issue_conclu_le,
    ))

    # Remise à zéro : le prospect redevient actif
    p.issue             = None
    p.issue_commentaire = None
    p.issue_conclu_le   = None

    await db.flush()
    res = await db.execute(select(Prospect).options(*LOAD_OPTS).where(Prospect.id == prospect_id))
    p2 = res.scalar_one()
    titre = await get_projet_titre(db, p2.objet_projet_id)
    return prospect_to_dict(p2, titre)


# ── POST /prospects/:id/echanges ──────────────────────────────────────────────
@router.post("/{prospect_id}/echanges", status_code=201)
async def ajouter_echange(prospect_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    # Vérifier que le prospect existe
    p_res = await db.execute(select(Prospect).where(Prospect.id == prospect_id, Prospect.is_deleted == False))
    prospect = p_res.scalar_one_or_none()
    if not prospect:
        raise HTTPException(404, "Prospect introuvable")
    if _conclu_fige(prospect.issue, prospect.issue_conclu_le):
        raise HTTPException(409, "La prospection est archivée : impossible d'ajouter un nouvel échange.")

    # Valider les champs requis
    contact_par = (payload.get("contact_par") or "").strip() or None
    if not payload.get("date_echange"):
        raise HTTPException(422, "La date de l'échange est obligatoire")

    # Parser la date saisie
    try:
        date_saisie = date_type.fromisoformat(payload["date_echange"])
    except ValueError:
        raise HTTPException(422, "Format de date invalide (attendu : YYYY-MM-DD)")

    today = date_type.today()

    # Règle 1 : pas dans le futur (côté serveur, pas navigateur)
    if date_saisie > today:
        raise HTTPException(422, f"La date ne peut pas être dans le futur (aujourd'hui : {today.isoformat()})")

    # Récupérer le dernier échange pour ce prospect
    last_res = await db.execute(
        select(func.max(ProspectEchange.date_echange))
        .where(ProspectEchange.prospect_id == prospect_id)
    )
    last_date = last_res.scalar_one_or_none()

    # Règle 2 : strictement supérieur au dernier échange
    if last_date and date_saisie <= last_date:
        raise HTTPException(422,
            f"La date doit être postérieure au dernier échange ({last_date.isoformat()})")

    # Interlocuteur côté investisseur : texte libre ou issu d'un point focal
    interlocuteur  = (payload.get("interlocuteur") or "").strip() or None
    point_focal_id = payload.get("point_focal_id") or None
    canal          = (payload.get("canal") or "").strip() or None
    canal_contact  = (payload.get("canal_contact") or "").strip() or None

    e = ProspectEchange(
        prospect_id    = prospect_id,
        date_echange   = date_saisie,
        commentaire    = payload.get("commentaire") or None,
        contact_par    = contact_par,
        interlocuteur  = interlocuteur,
        canal          = canal,
        canal_contact  = canal_contact,
        point_focal_id = point_focal_id,
    )
    db.add(e)
    await db.flush()
    await db.refresh(e)
    return echange_to_dict(e)


# ── GET /prospects/:id/echanges ───────────────────────────────────────────────
@router.get("/{prospect_id}/echanges")
async def liste_echanges(prospect_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(ProspectEchange)
        .where(ProspectEchange.prospect_id == prospect_id)
        .order_by(ProspectEchange.date_echange)
    )
    return [echange_to_dict(e) for e in res.scalars().all()]


# ── PATCH /prospects/echanges/:id ── (fenêtre de 24h après enregistrement)
@router.patch("/echanges/{echange_id}")
async def modifier_echange(echange_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timezone, timedelta
    res = await db.execute(select(ProspectEchange).where(ProspectEchange.id == echange_id))
    e = res.scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Échange introuvable")

    # Verrou conclusion : prospection archivée (>24h) → échange figé
    prospect = (await db.execute(select(Prospect).where(Prospect.id == e.prospect_id))).scalar_one_or_none()
    if prospect is not None and _conclu_fige(prospect.issue, prospect.issue_conclu_le):
        raise HTTPException(403, "La prospection est archivée : cet échange ne peut plus être modifié.")

    # Fenêtre d'édition : 24h après l'enregistrement, ensuite immuable
    enr = e.enregistre_le
    if enr is not None:
        if enr.tzinfo is None:
            enr = enr.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - enr > timedelta(hours=24):
            raise HTTPException(403, "Cet échange n'est plus modifiable (délai de 24h dépassé).")

    # Verrou chronologique : si un échange ultérieur existe, l'échange est figé
    next_count = (await db.execute(
        select(func.count(ProspectEchange.id)).where(
            ProspectEchange.prospect_id == e.prospect_id,
            ProspectEchange.enregistre_le > e.enregistre_le,
        )
    )).scalar()
    if next_count > 0:
        raise HTTPException(403, "Cet échange ne peut plus être modifié : un échange ultérieur a déjà été enregistré.")

    # Mise à jour de la date avec contraintes chronologiques
    if "date_echange" in payload and payload["date_echange"]:
        try:
            new_date = date_type.fromisoformat(payload["date_echange"])
        except ValueError:
            raise HTTPException(422, "Format de date invalide (attendu : YYYY-MM-DD)")
        today = date_type.today()
        if new_date > today:
            raise HTTPException(422, f"La date ne peut pas être dans le futur (aujourd'hui : {today.isoformat()})")
        # Voisins par ordre de création (enregistre_le)
        prev_date = (await db.execute(
            select(func.max(ProspectEchange.date_echange)).where(
                ProspectEchange.prospect_id == e.prospect_id,
                ProspectEchange.enregistre_le < e.enregistre_le,
            )
        )).scalar_one_or_none()
        next_date = (await db.execute(
            select(func.min(ProspectEchange.date_echange)).where(
                ProspectEchange.prospect_id == e.prospect_id,
                ProspectEchange.enregistre_le > e.enregistre_le,
            )
        )).scalar_one_or_none()
        if prev_date and new_date <= prev_date:
            raise HTTPException(422, f"La date doit être postérieure à l'échange précédent ({prev_date.isoformat()})")
        if next_date and new_date >= next_date:
            raise HTTPException(422, f"La date doit être antérieure à l'échange suivant ({next_date.isoformat()})")
        e.date_echange = new_date

    if "commentaire" in payload:
        e.commentaire = payload["commentaire"] or None
    if "interlocuteur" in payload:
        e.interlocuteur = (payload["interlocuteur"] or "").strip() or None
    if "point_focal_id" in payload:
        e.point_focal_id = payload["point_focal_id"] or None
    if "contact_par" in payload:
        e.contact_par = (payload["contact_par"] or "").strip() or None
    if "canal" in payload:
        e.canal = (payload["canal"] or "").strip() or None
    if "canal_contact" in payload:
        e.canal_contact = (payload["canal_contact"] or "").strip() or None

    await db.flush()
    await db.refresh(e)
    return echange_to_dict(e)


# ── DELETE /prospects/echanges/:id ── (désactiver quand auth en prod)
@router.delete("/echanges/{echange_id}", status_code=204)
async def supprimer_echange(echange_id: int, db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timezone, timedelta
    res = await db.execute(select(ProspectEchange).where(ProspectEchange.id == echange_id))
    e = res.scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Échange introuvable")

    # Verrou conclusion : prospection archivée (>24h) → échange figé
    prospect = (await db.execute(select(Prospect).where(Prospect.id == e.prospect_id))).scalar_one_or_none()
    if prospect is not None and _conclu_fige(prospect.issue, prospect.issue_conclu_le):
        raise HTTPException(403, "La prospection est archivée : cet échange ne peut plus être supprimé.")

    # Fenêtre de suppression : 24h après l'enregistrement
    enr = e.enregistre_le
    if enr is not None:
        if enr.tzinfo is None:
            enr = enr.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - enr > timedelta(hours=24):
            raise HTTPException(403, "Cet échange n'est plus supprimable (délai de 24h dépassé).")

    # Verrou chronologique : si un échange ultérieur existe, l'échange est figé
    next_count = (await db.execute(
        select(func.count(ProspectEchange.id)).where(
            ProspectEchange.prospect_id == e.prospect_id,
            ProspectEchange.enregistre_le > e.enregistre_le,
        )
    )).scalar()
    if next_count > 0:
        raise HTTPException(403, "Cet échange ne peut plus être supprimé : un échange ultérieur a déjà été enregistré.")

    await db.delete(e)
    await db.flush()


# ── POST /prospects/:id/contraintes ──────────────────────────────────────────
@router.post("/{prospect_id}/contraintes", status_code=201)
async def ajouter_contrainte(prospect_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    p_res = await db.execute(
        select(Prospect).options(selectinload(Prospect.cycles))
        .where(Prospect.id == prospect_id, Prospect.is_deleted == False)
    )
    prospect = p_res.scalar_one_or_none()
    if not prospect:
        raise HTTPException(404, "Prospect introuvable")
    if _conclu_fige(prospect.issue, prospect.issue_conclu_le):
        raise HTTPException(409, "La prospection est archivée : impossible d'ajouter une contrainte.")
    description = (payload.get("description") or "").strip()
    if not description:
        raise HTTPException(422, "La description est obligatoire")
    current_cycle_num = len(prospect.cycles or [])
    c = ProspectContrainte(
        prospect_id         = prospect_id,
        cycle_num           = current_cycle_num,
        description         = description,
        solution_preconisee = payload.get("solution_preconisee") or None,
    )
    db.add(c)
    await db.flush()
    await db.refresh(c)
    return contrainte_to_dict(c)


# ── PATCH /prospects/contraintes/:id ─────────────────────────────────────────
@router.patch("/contraintes/{contrainte_id}")
async def modifier_contrainte(contrainte_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import update as sqlupdate
    from datetime import datetime, timezone
    res = await db.execute(select(ProspectContrainte).where(ProspectContrainte.id == contrainte_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contrainte introuvable")
    prospect = (await db.execute(
        select(Prospect).options(selectinload(Prospect.cycles))
        .where(Prospect.id == c.prospect_id)
    )).scalar_one_or_none()
    if prospect is not None and _conclu_fige(prospect.issue, prospect.issue_conclu_le):
        raise HTTPException(403, "La prospection est archivée : cette contrainte ne peut plus être modifiée.")
    if prospect is not None:
        current_cycle_num = len(prospect.cycles or [])
        if c.cycle_num != current_cycle_num:
            raise HTTPException(403, "Cette contrainte appartient à un cycle terminé et ne peut plus être modifiée.")
    if "description" in payload:
        desc = (payload["description"] or "").strip()
        if not desc:
            raise HTTPException(422, "La description est obligatoire")
        c.description = desc
    if "solution_preconisee" in payload:
        c.solution_preconisee = payload["solution_preconisee"] or None
    c.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(c)
    return contrainte_to_dict(c)


# ── DELETE /prospects/contraintes/:id ────────────────────────────────────────
@router.delete("/contraintes/{contrainte_id}", status_code=204)
async def supprimer_contrainte(contrainte_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ProspectContrainte).where(ProspectContrainte.id == contrainte_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contrainte introuvable")
    prospect = (await db.execute(
        select(Prospect).options(selectinload(Prospect.cycles))
        .where(Prospect.id == c.prospect_id)
    )).scalar_one_or_none()
    if prospect is not None and _conclu_fige(prospect.issue, prospect.issue_conclu_le):
        raise HTTPException(403, "La prospection est archivée : cette contrainte ne peut plus être supprimée.")
    if prospect is not None:
        current_cycle_num = len(prospect.cycles or [])
        if c.cycle_num != current_cycle_num:
            raise HTTPException(403, "Cette contrainte appartient à un cycle terminé et ne peut plus être supprimée.")
    await db.delete(c)
    await db.flush()
