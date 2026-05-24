from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.prospect import Prospect, ProspectContact, ProspectContactHistorique
from app.models.entreprise import RefSecteur, RefBranche, RefActivite
from app.models.shared import RefPays

router = APIRouter(prefix="/prospects", tags=["Prospects"])

LOAD_OPTS = [
    selectinload(Prospect.siege),
    selectinload(Prospect.contacts).selectinload(ProspectContact.historique),
]


# ── Enrichissement ────────────────────────────────────────────────────────────
async def enrich(prospects: list, db: AsyncSession) -> list:
    s_ids  = {sid for p in prospects for sid in (p.secteur_ids or [])}
    b_ids  = {bid for p in prospects for bid in (p.branche_ids or [])}
    a_ids  = {aid for p in prospects for aid in (p.activite_ids or [])}
    noms: dict = {}
    if s_ids:
        res = await db.execute(select(RefSecteur).where(RefSecteur.id.in_(s_ids)))
        for s in res.scalars(): noms[f"s_{s.id}"] = s.nom
    if b_ids:
        res = await db.execute(select(RefBranche).where(RefBranche.id.in_(b_ids)))
        for b in res.scalars(): noms[f"b_{b.id}"] = b.nom
    if a_ids:
        res = await db.execute(select(RefActivite).where(RefActivite.id.in_(a_ids)))
        for a in res.scalars(): noms[f"a_{a.id}"] = a.nom
    return [prospect_to_dict(p, noms) for p in prospects]


def prospect_to_dict(p: Prospect, noms: dict = {}) -> dict:
    return {
        "id":           p.id,
        "nom":          p.nom,
        "siege_id":     p.siege_id,
        "siege_nom":    p.siege.nom_fr if p.siege else None,
        "adresse":      p.adresse,
        "telephone":    p.telephone,
        "mail":         p.mail,
        "siteweb":      p.siteweb,
        "secteur_ids":  p.secteur_ids or [],
        "branche_ids":  p.branche_ids or [],
        "activite_ids": p.activite_ids or [],
        "secteur_noms": [noms[f"s_{i}"] for i in (p.secteur_ids or []) if f"s_{i}" in noms],
        "branche_noms": [noms[f"b_{i}"] for i in (p.branche_ids or []) if f"b_{i}" in noms],
        "activite_noms":[noms[f"a_{i}"] for i in (p.activite_ids or []) if f"a_{i}" in noms],
        "point_entree": p.point_entree,
        "est_publie":   p.est_publie,
        "created_at":   p.created_at.isoformat() if p.created_at else None,
        "contacts": [
            {
                "id":                   c.id,
                "projet_nom":           c.projet_nom,
                "projet_description":   c.projet_description,
                "date_premier_contact": c.date_premier_contact.isoformat() if c.date_premier_contact else None,
                "etat_avancement":      c.etat_avancement,
                "commentaires":         c.commentaires,
                "contraintes":          c.contraintes,
            }
            for c in (p.contacts or []) if not c.is_deleted
        ],
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
    base = select(Prospect).options(*LOAD_OPTS).where(Prospect.is_deleted == False)
    if q:
        base = base.where(Prospect.nom.ilike(f"%{q}%"))
    if contactes is True:
        from sqlalchemy import exists
        base = base.where(exists().where(
            ProspectContact.prospect_id == Prospect.id,
            ProspectContact.is_deleted == False
        ))
    elif contactes is False:
        from sqlalchemy import exists
        base = base.where(~exists().where(
            ProspectContact.prospect_id == Prospect.id,
            ProspectContact.is_deleted == False
        ))
    base = base.order_by(Prospect.created_at.desc())
    count_res = await db.execute(select(Prospect.id).where(Prospect.is_deleted == False))
    total = len(count_res.fetchall())
    res = await db.execute(base.offset((page-1)*per_page).limit(per_page))
    return {"data": await enrich(list(res.scalars().all()), db), "total": total, "page": page, "per_page": per_page}


# ── POST /prospects ───────────────────────────────────────────────────────────
@router.post("", status_code=201)
async def creer_prospect(payload: dict, db: AsyncSession = Depends(get_db)):
    if not payload.get("nom", "").strip():
        raise HTTPException(422, "La dénomination sociale est obligatoire")
    p = Prospect(
        nom          = payload["nom"].strip(),
        siege_id     = payload.get("siege_id") or None,
        adresse      = payload.get("adresse") or None,
        telephone    = payload.get("telephone") or None,
        mail         = payload.get("mail") or None,
        siteweb      = payload.get("siteweb") or None,
        secteur_ids  = payload.get("secteur_ids") or [],
        branche_ids  = payload.get("branche_ids") or [],
        activite_ids = payload.get("activite_ids") or [],
        point_entree = payload.get("point_entree") or None,
    )
    db.add(p)
    await db.flush()
    await db.refresh(p)
    res = await db.execute(select(Prospect).options(*LOAD_OPTS).where(Prospect.id == p.id))
    return (await enrich([res.scalar_one()], db))[0]


# ── PATCH /prospects/:id ──────────────────────────────────────────────────────
@router.patch("/{prospect_id}")
async def modifier_prospect(prospect_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Prospect).options(*LOAD_OPTS).where(Prospect.id == prospect_id, Prospect.is_deleted == False))
    p   = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Prospect introuvable")
    for f in ["nom","adresse","telephone","mail","siteweb","point_entree"]:
        if f in payload: setattr(p, f, payload[f] or None)
    for f in ["siege_id"]:
        if f in payload: setattr(p, f, payload[f] or None)
    for f in ["secteur_ids","branche_ids","activite_ids"]:
        if f in payload: setattr(p, f, payload[f] or [])
    if "est_publie" in payload: p.est_publie = payload["est_publie"]
    await db.flush()
    res = await db.execute(select(Prospect).options(*LOAD_OPTS).where(Prospect.id == prospect_id))
    return (await enrich([res.scalar_one()], db))[0]


# ── DELETE /prospects/:id ─────────────────────────────────────────────────────
@router.delete("/{prospect_id}", status_code=204)
async def supprimer_prospect(prospect_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    p   = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Prospect introuvable")
    await db.delete(p)
    await db.flush()


# ── GET /prospects/:id/contacts ───────────────────────────────────────────────
@router.get("/{prospect_id}/contacts")
async def liste_contacts(prospect_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(ProspectContact)
        .options(selectinload(ProspectContact.historique))
        .where(ProspectContact.prospect_id == prospect_id, ProspectContact.is_deleted == False)
        .order_by(ProspectContact.created_at.desc())
    )
    return [contact_to_dict(c) for c in res.scalars().all()]


def contact_to_dict(c: ProspectContact) -> dict:
    return {
        "id":                   c.id,
        "prospect_id":          c.prospect_id,
        "projet_nom":           c.projet_nom,
        "projet_description":   c.projet_description,
        "date_premier_contact": c.date_premier_contact.isoformat() if c.date_premier_contact else None,
        "etat_avancement":      c.etat_avancement,
        "commentaires":         c.commentaires,
        "contraintes":          c.contraintes,
        "historique": [
            {"id": h.id, "etat": h.etat, "commentaire": h.commentaire, "date": h.date_changement.isoformat() if h.date_changement else None}
            for h in (c.historique or [])
        ],
    }


# ── POST /prospects/:id/contacts ──────────────────────────────────────────────
@router.post("/{prospect_id}/contacts", status_code=201)
async def ajouter_contact(prospect_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from datetime import date
    c = ProspectContact(
        prospect_id          = prospect_id,
        projet_nom           = payload.get("projet_nom", "").strip() or "Contact",
        projet_description   = payload.get("projet_description") or None,
        date_premier_contact = payload.get("date_premier_contact") or date.today().isoformat(),
        etat_avancement      = payload.get("etat_avancement", "en_cours"),
        commentaires         = payload.get("commentaires") or None,
        contraintes          = payload.get("contraintes") or None,
    )
    db.add(c)
    await db.flush()
    # Enregistrer l'état initial dans l'historique
    h = ProspectContactHistorique(contact_id=c.id, etat=c.etat_avancement, commentaire="Création")
    db.add(h)
    await db.flush()
    await db.refresh(c)
    res = await db.execute(select(ProspectContact).options(selectinload(ProspectContact.historique)).where(ProspectContact.id == c.id))
    return contact_to_dict(res.scalar_one())


# ── PATCH /prospects/contacts/:id ────────────────────────────────────────────
@router.patch("/contacts/{contact_id}")
async def modifier_contact(contact_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ProspectContact).options(selectinload(ProspectContact.historique)).where(ProspectContact.id == contact_id))
    c   = res.scalar_one_or_none()
    if not c: raise HTTPException(404, "Contact introuvable")
    ancien_etat = c.etat_avancement
    for f in ["projet_nom","projet_description","commentaires","contraintes"]:
        if f in payload: setattr(c, f, payload[f] or None)
    if "date_premier_contact" in payload: c.date_premier_contact = payload["date_premier_contact"]
    if "etat_avancement" in payload and payload["etat_avancement"] != ancien_etat:
        c.etat_avancement = payload["etat_avancement"]
        h = ProspectContactHistorique(contact_id=c.id, etat=c.etat_avancement, commentaire=payload.get("commentaire_historique") or None)
        db.add(h)
    await db.flush()
    res = await db.execute(select(ProspectContact).options(selectinload(ProspectContact.historique)).where(ProspectContact.id == contact_id))
    return contact_to_dict(res.scalar_one())


# ── DELETE /prospects/contacts/:id ───────────────────────────────────────────
@router.delete("/contacts/{contact_id}", status_code=204)
async def supprimer_contact(contact_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ProspectContact).where(ProspectContact.id == contact_id))
    c   = res.scalar_one_or_none()
    if not c: raise HTTPException(404, "Contact introuvable")
    await db.delete(c)
    await db.flush()
