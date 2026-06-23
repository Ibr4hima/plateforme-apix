from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core.database import get_db
from app.core.auth import require_admin
from app.models.classification import RefClassification, RefClassificationItem, RefCorrespondanceNaema
from app.models.entreprise import RefSecteur, RefBranche, RefActivite

router = APIRouter(prefix="/classifications", tags=["Classifications"])


def item_to_dict(item: RefClassificationItem, with_children: bool = False) -> dict:
    d = {
        "id":     item.id,
        "code":   item.code,
        "libelle_fr": item.libelle_fr,
        "libelle_en": item.libelle_en,
        "niveau": item.niveau,
        "parent_id": item.parent_id,
        "classification_id": item.classification_id,
    }
    return d


# ── GET /classifications ──────────────────────────────────────────────────────
@router.get("")
async def liste_classifications(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RefClassification).order_by(RefClassification.code))
    return [
        {"id": c.id, "code": c.code, "nom_fr": c.nom_fr, "nom_en": c.nom_en,
         "version": c.version, "zone_geo": c.zone_geo}
        for c in res.scalars().all()
    ]


# ── GET /classifications/:code/items — recherche dans une classification ───────
@router.get("/{classif_code}/items")
async def items_classification(
    classif_code: str,
    q:      Optional[str] = Query(None),
    niveau: Optional[int] = Query(None),
    parent: Optional[str] = Query(None),  # code du parent
    db: AsyncSession = Depends(get_db),
):
    # Récupérer la classification
    res = await db.execute(select(RefClassification).where(
        RefClassification.code == classif_code.upper()
    ))
    classif = res.scalar_one_or_none()
    if not classif:
        return []

    query = select(RefClassificationItem).where(
        RefClassificationItem.classification_id == classif.id
    )
    if niveau:
        query = query.where(RefClassificationItem.niveau == niveau)
    if q:
        query = query.where(or_(
            RefClassificationItem.libelle_fr.ilike(f"%{q}%"),
            RefClassificationItem.libelle_en.ilike(f"%{q}%"),
            RefClassificationItem.code.ilike(f"%{q}%"),
        ))
    if parent:
        res_parent = await db.execute(select(RefClassificationItem).where(
            RefClassificationItem.code == parent,
            RefClassificationItem.classification_id == classif.id
        ))
        parent_item = res_parent.scalar_one_or_none()
        if parent_item:
            query = query.where(RefClassificationItem.parent_id == parent_item.id)

    query = query.order_by(RefClassificationItem.niveau, RefClassificationItem.code)
    res = await db.execute(query)
    return [item_to_dict(i) for i in res.scalars().all()]


# ── GET /classifications/:code/items/:item_code/naema ─────────────────────────
# Donne les équivalents NAEMA d'un code CITI
@router.get("/{classif_code}/items/{item_code}/naema")
async def naema_depuis_citi(
    classif_code: str,
    item_code:    str,
    db: AsyncSession = Depends(get_db),
):
    # Trouver l'item
    res = await db.execute(
        select(RefClassificationItem)
        .join(RefClassification, RefClassificationItem.classification_id == RefClassification.id)
        .where(
            RefClassification.code == classif_code.upper(),
            RefClassificationItem.code == item_code,
        )
    )
    item = res.scalar_one_or_none()
    if not item:
        return {"secteurs": [], "branches": [], "activites": []}

    # Chercher aussi les parents et enfants pour élargir la correspondance
    item_ids = {item.id}

    # Ajouter les enfants directs
    res_children = await db.execute(
        select(RefClassificationItem).where(RefClassificationItem.parent_id == item.id)
    )
    for child in res_children.scalars().all():
        item_ids.add(child.id)

    # Ajouter le parent
    if item.parent_id:
        item_ids.add(item.parent_id)

    # Trouver toutes les correspondances NAEMA
    res_corresp = await db.execute(
        select(RefCorrespondanceNaema).where(
            RefCorrespondanceNaema.classification_item_id.in_(item_ids)
        )
    )
    correspondances = res_corresp.scalars().all()

    secteur_ids  = list({c.naema_id for c in correspondances if c.naema_type == "secteur"})
    branche_ids  = list({c.naema_id for c in correspondances if c.naema_type == "branche"})
    activite_ids = list({c.naema_id for c in correspondances if c.naema_type == "activite"})

    secteurs = branche_noms = activites = []
    if secteur_ids:
        res = await db.execute(select(RefSecteur).where(RefSecteur.id.in_(secteur_ids)))
        secteurs = [{"id": s.id, "nom": s.nom} for s in res.scalars().all()]
    if branche_ids:
        res = await db.execute(select(RefBranche).where(RefBranche.id.in_(branche_ids)))
        branche_noms = [{"id": b.id, "nom": b.nom, "secteur_id": b.secteur_id} for b in res.scalars().all()]
    if activite_ids:
        res = await db.execute(select(RefActivite).where(RefActivite.id.in_(activite_ids)))
        activites = [{"id": a.id, "nom": a.nom, "branche_id": a.branche_id} for a in res.scalars().all()]

    return {
        "citi_item": item_to_dict(item),
        "secteurs":  secteurs,
        "branches":  branche_noms,
        "activites": activites,
    }


# ── GET /classifications/correspondances ─────────────────────────────────────
@router.get("/correspondances")
async def liste_correspondances(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RefCorrespondanceNaema))
    return [
        {"id": c.id, "naema_type": c.naema_type, "naema_id": c.naema_id,
         "classification_item_id": c.classification_item_id, "note": c.note}
        for c in res.scalars().all()
    ]


# ── POST /classifications/correspondances ─────────────────────────────────────
@router.post("/correspondances", status_code=201)
async def ajouter_correspondance(payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from app.models.classification import RefCorrespondanceNaema as CN
    c = CN(
        naema_type             = payload["naema_type"],
        naema_id               = payload["naema_id"],
        classification_item_id = payload["classification_item_id"],
        note                   = payload.get("note"),
    )
    db.add(c)
    await db.flush()
    return {"id": c.id, "naema_type": c.naema_type, "naema_id": c.naema_id,
            "classification_item_id": c.classification_item_id}


# ── DELETE /classifications/correspondances/:id ───────────────────────────────
@router.delete("/correspondances/{corresp_id}", status_code=204)
async def supprimer_correspondance(corresp_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    from fastapi import HTTPException
    res = await db.execute(select(RefCorrespondanceNaema).where(RefCorrespondanceNaema.id == corresp_id))
    c   = res.scalar_one_or_none()
    if not c: raise HTTPException(404, "Correspondance introuvable")
    await db.delete(c)
    await db.flush()

# Inverse : donne les équivalents CITI d'un élément NAEMA
@router.get("/naema/{naema_type}/{naema_id}/citi")
async def citi_depuis_naema(
    naema_type: str,
    naema_id:   int,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(RefCorrespondanceNaema, RefClassificationItem)
        .join(RefClassificationItem,
              RefCorrespondanceNaema.classification_item_id == RefClassificationItem.id)
        .where(
            RefCorrespondanceNaema.naema_type == naema_type,
            RefCorrespondanceNaema.naema_id   == naema_id,
        )
    )
    rows = res.all()
    return [item_to_dict(item) for _, item in rows]
