from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.models.shared import RefPays, RefGroupement, RefPaysGroupement

router = APIRouter(prefix="/ref-pays", tags=["Référentiel Pays"])

CONTINENTS = ["Afrique","Amérique","Asie","Europe","Océanie"]
NIVEAUX    = ["Revenu élevé","Revenu intermédiaire supérieur","Revenu intermédiaire inférieur","Revenu faible","Non classifié"]


def pays_to_dict(p: RefPays) -> dict:
    return {"id":p.id,"code_iso2":p.code_iso2,"code_iso3":p.code_iso3,"nom_fr":p.nom_fr,
            "continent":p.continent,"region_geo":p.region_geo,"niveau_revenu":p.niveau_revenu,
            "est_industrialise":p.est_industrialise,"est_emergent":p.est_emergent,
            "nom_cnuced":p.nom_cnuced,"actif":p.actif}

def grp_to_dict(g: RefGroupement, nb_pays: int = 0) -> dict:
    return {"id":g.id,"code":g.code,"nom_fr":g.nom_fr,"nom_en":g.nom_en,
            "description":g.description,"nb_pays":nb_pays}


# ── Routes fixes AVANT les routes avec paramètres ─────────────────────────────

@router.get("/meta")
async def meta(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RefPays.region_geo).where(RefPays.region_geo != None).distinct().order_by(RefPays.region_geo))
    regions = [r[0] for r in res.fetchall()]
    return {"continents":CONTINENTS,"niveaux_revenu":NIVEAUX,"regions_geo":regions}


@router.get("/groupements/liste")
async def liste_groupements(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(RefGroupement, func.count(RefPaysGroupement.pays_id).label("nb"))
        .outerjoin(RefPaysGroupement, RefPaysGroupement.groupement_id == RefGroupement.id)
        .group_by(RefGroupement.id).order_by(RefGroupement.code)
    )
    return [grp_to_dict(g, nb) for g, nb in res.all()]


@router.get("/groupements/{grp_id}/membres")
async def membres_groupement(grp_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(RefPays).join(RefPaysGroupement, RefPaysGroupement.pays_id == RefPays.id)
        .where(RefPaysGroupement.groupement_id == grp_id).order_by(RefPays.nom_fr)
    )
    return [pays_to_dict(p) for p in res.scalars().all()]


@router.post("/groupements", status_code=201)
async def creer_groupement(payload: dict, db: AsyncSession = Depends(get_db)):
    if not payload.get("code") or not payload.get("nom_fr"):
        raise HTTPException(422, "code et nom_fr obligatoires")
    res = await db.execute(select(RefGroupement).where(RefGroupement.code == payload["code"].upper()))
    if res.scalar_one_or_none():
        raise HTTPException(409, f"Le code '{payload['code']}' existe déjà")
    g = RefGroupement(code=payload["code"].upper(), nom_fr=payload["nom_fr"],
                      nom_en=payload.get("nom_en") or None, description=payload.get("description") or None)
    db.add(g); await db.flush()
    return grp_to_dict(g, 0)


@router.patch("/groupements/{grp_id}")
async def modifier_groupement(grp_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RefGroupement).where(RefGroupement.id == grp_id))
    g   = res.scalar_one_or_none()
    if not g: raise HTTPException(404, "Groupement introuvable")
    for f in ["nom_fr","nom_en","description","code"]:
        if f in payload: setattr(g, f, payload[f] or None)
    await db.flush()
    return grp_to_dict(g)


@router.delete("/groupements/{grp_id}")
async def supprimer_groupement(grp_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RefGroupement).where(RefGroupement.id == grp_id))
    g   = res.scalar_one_or_none()
    if not g: raise HTTPException(404, "Groupement introuvable")
    await db.delete(g); await db.flush()
    return {"deleted": True}


@router.post("/groupements/{grp_id}/membres")
async def ajouter_membre(grp_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    pays_id = payload.get("pays_id")
    if not pays_id: raise HTTPException(422, "pays_id obligatoire")
    lien = RefPaysGroupement(pays_id=pays_id, groupement_id=grp_id)
    db.add(lien)
    try: await db.flush()
    except Exception: raise HTTPException(409, "Ce pays est déjà membre de ce groupement")
    return {"pays_id": pays_id, "groupement_id": grp_id}


@router.delete("/groupements/{grp_id}/membres/{pays_id}")
async def retirer_membre(grp_id: int, pays_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RefPaysGroupement).where(
        RefPaysGroupement.groupement_id == grp_id, RefPaysGroupement.pays_id == pays_id))
    lien = res.scalar_one_or_none()
    if not lien: raise HTTPException(404, "Ce pays n'est pas membre de ce groupement")
    await db.delete(lien); await db.flush()
    return {"deleted": True}


# ── Routes avec paramètre :id APRÈS les routes fixes ─────────────────────────

@router.get("")
async def liste_pays(q: Optional[str]=Query(None), continent: Optional[str]=Query(None),
                     region_geo: Optional[str]=Query(None), db: AsyncSession=Depends(get_db)):
    qry = select(RefPays)
    if q:          qry = qry.where(RefPays.nom_fr.ilike(f"%{q}%") | RefPays.code_iso3.ilike(f"%{q}%"))
    if continent:  qry = qry.where(RefPays.continent == continent)
    if region_geo: qry = qry.where(RefPays.region_geo == region_geo)
    res = await db.execute(qry.order_by(RefPays.nom_fr))
    return [pays_to_dict(p) for p in res.scalars().all()]


@router.post("", status_code=201)
async def creer_pays(payload: dict, db: AsyncSession = Depends(get_db)):
    if not payload.get("nom_fr") or not payload.get("code_iso3"):
        raise HTTPException(422, "nom_fr et code_iso3 obligatoires")
    res = await db.execute(select(RefPays).where(RefPays.code_iso3 == payload["code_iso3"].upper()))
    if res.scalar_one_or_none():
        raise HTTPException(409, f"Le code ISO3 '{payload['code_iso3']}' existe déjà")
    p = RefPays(
        code_iso2=payload.get("code_iso2","").upper() or None, code_iso3=payload["code_iso3"].upper(),
        nom_fr=payload["nom_fr"], continent=payload.get("continent") or None,
        region_geo=payload.get("region_geo") or None, niveau_revenu=payload.get("niveau_revenu") or None,
        est_industrialise=payload.get("est_industrialise",False), est_emergent=payload.get("est_emergent",False),
        nom_cnuced=payload.get("nom_cnuced") or None, actif=payload.get("actif",True),
    )
    db.add(p); await db.flush()
    return pays_to_dict(p)


@router.get("/{pays_id}/groupements")
async def groupements_du_pays(pays_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(RefGroupement).join(RefPaysGroupement, RefPaysGroupement.groupement_id == RefGroupement.id)
        .where(RefPaysGroupement.pays_id == pays_id).order_by(RefGroupement.code)
    )
    return [{"id":g.id,"code":g.code,"nom_fr":g.nom_fr} for g in res.scalars().all()]


@router.patch("/{pays_id}")
async def modifier_pays(pays_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RefPays).where(RefPays.id == pays_id))
    p   = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Pays introuvable")
    for f in ["nom_fr","code_iso2","code_iso3","continent","region_geo","niveau_revenu","nom_cnuced"]:
        if f in payload: setattr(p, f, payload[f] or None)
    for f in ["est_industrialise","est_emergent","actif"]:
        if f in payload: setattr(p, f, payload[f])
    await db.flush()
    return pays_to_dict(p)


@router.delete("/{pays_id}")
async def supprimer_pays(pays_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RefPays).where(RefPays.id == pays_id))
    p   = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Pays introuvable")
    # Vérifier usages sans risquer de casser la transaction
    usages = []
    tables = [("entreprises","siege_social_pays_id"),("accords","pays_id")]
    for table, col in tables:
        try:
            r = await db.execute(text(f"SELECT COUNT(*) FROM {table} WHERE {col} = :id"), {"id": pays_id})
            n = r.scalar()
            if n: usages.append(f"{n} enregistrement(s) dans '{table}'")
        except Exception:
            await db.rollback()
            # Recharger le pays après rollback
            res2 = await db.execute(select(RefPays).where(RefPays.id == pays_id))
            p = res2.scalar_one_or_none()
            if not p: raise HTTPException(404, "Pays introuvable")
    if usages:
        raise HTTPException(409, f"Impossible de supprimer — utilisé dans : {', '.join(usages)}")
    await db.delete(p)
    await db.flush()
    return {"deleted": True}
