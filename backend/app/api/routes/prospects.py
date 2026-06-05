from datetime import date as date_type
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.prospect import Prospect, ProspectPointFocal, ProspectEchange
from app.models.projet import Projet

router = APIRouter(prefix="/prospects", tags=["Prospects"])

LOAD_OPTS = [
    selectinload(Prospect.pays_origine),
    selectinload(Prospect.siege),
    selectinload(Prospect.points_focaux),
    selectinload(Prospect.echanges),
]


async def get_projet_titre(db: AsyncSession, projet_id: int | None) -> str | None:
    if not projet_id:
        return None
    res = await db.execute(select(Projet.titre_projet).where(Projet.id == projet_id))
    return res.scalar_one_or_none()


def echange_to_dict(e: ProspectEchange) -> dict:
    enregistre = e.enregistre_le
    echange_dt  = e.date_echange
    retard_jours = None
    if enregistre and echange_dt:
        from datetime import datetime, timezone
        if hasattr(enregistre, "date"):
            delta = enregistre.date() - echange_dt
        else:
            delta = enregistre - echange_dt
        retard_jours = delta.days if delta.days > 0 else 0
    return {
        "id":            e.id,
        "prospect_id":   e.prospect_id,
        "date_echange":  e.date_echange.isoformat() if e.date_echange else None,
        "commentaire":   e.commentaire,
        "contact_par":   e.contact_par,
        "enregistre_le": e.enregistre_le.isoformat() if e.enregistre_le else None,
        "retard_jours":  retard_jours,
    }


def prospect_to_dict(p: Prospect, projet_titre: str | None = None) -> dict:
    echanges_sorted = sorted(p.echanges or [], key=lambda e: e.date_echange)
    return {
        "id":              p.id,
        "type":            p.type or "physique",
        "nom":             p.nom,
        "prenom":          p.prenom,
        "pays_origine_id": p.pays_origine_id,
        "pays_origine_nom":p.pays_origine.nom_fr if p.pays_origine else None,
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
    }


# ── GET /prospects ────────────────────────────────────────────────────────────
@router.get("")
async def liste_prospects(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    contactes: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import or_, exists
    base = select(Prospect).options(*LOAD_OPTS).where(Prospect.is_deleted == False)
    if q:
        base = base.where(or_(
            Prospect.nom.ilike(f"%{q}%"),
            Prospect.prenom.ilike(f"%{q}%"),
        ))
    if contactes is True:
        base = base.where(exists().where(ProspectEchange.prospect_id == Prospect.id))
    elif contactes is False:
        base = base.where(~exists().where(ProspectEchange.prospect_id == Prospect.id))
    base = base.order_by(Prospect.created_at.desc())
    count_res = await db.execute(select(func.count()).select_from(
        select(Prospect.id).where(Prospect.is_deleted == False).subquery()
    ))
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


# ── POST /prospects ───────────────────────────────────────────────────────────
@router.post("", status_code=201)
async def creer_prospect(payload: dict, db: AsyncSession = Depends(get_db)):
    if not payload.get("nom", "").strip():
        raise HTTPException(422, "Le nom est obligatoire")
    p = Prospect(
        type            = payload.get("type") or "physique",
        nom             = payload["nom"].strip(),
        prenom          = payload.get("prenom") or None,
        pays_origine_id = payload.get("pays_origine_id") or None,
        siege_id        = payload.get("siege_id") or None,
        secteur_ids     = payload.get("secteur_ids") or [],
        branche_ids     = payload.get("branche_ids") or [],
        activite_ids    = payload.get("activite_ids") or [],
        telephones      = payload.get("telephones") or [],
        mails           = payload.get("mails") or [],
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
    await db.flush()
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
    for f in ["type", "nom", "prenom", "adresse", "details",
              "objet_intentions_details", "objet_adequation_details", "objet_commentaires"]:
        if f in payload:
            setattr(p, f, payload[f] or None)
    for f in ["objet_projet", "objet_intentions_etranger", "objet_adequation_senegal", "est_publie"]:
        if f in payload:
            setattr(p, f, payload[f])
    if "telephones"      in payload: p.telephones      = payload["telephones"] or []
    if "mails"           in payload: p.mails           = payload["mails"] or []
    if "pays_origine_id" in payload: p.pays_origine_id = payload["pays_origine_id"] or None
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
        from sqlalchemy import delete as sqldel
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
    await db.flush()
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


# ── POST /prospects/:id/echanges ──────────────────────────────────────────────
@router.post("/{prospect_id}/echanges", status_code=201)
async def ajouter_echange(prospect_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    # Vérifier que le prospect existe
    p_res = await db.execute(select(Prospect).where(Prospect.id == prospect_id, Prospect.is_deleted == False))
    if not p_res.scalar_one_or_none():
        raise HTTPException(404, "Prospect introuvable")

    # Valider les champs requis
    contact_par = (payload.get("contact_par") or "").strip()
    if not contact_par:
        raise HTTPException(422, "Le nom du marketer est obligatoire")
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

    e = ProspectEchange(
        prospect_id  = prospect_id,
        date_echange = date_saisie,
        commentaire  = payload.get("commentaire") or None,
        contact_par  = contact_par,
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
