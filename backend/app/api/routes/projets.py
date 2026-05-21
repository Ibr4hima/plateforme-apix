import os, shutil, uuid as uuid_lib
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.projet import Projet, ProjetCoordinateur, ProjetMoa, ProjetFichier, RefDevise
from app.models.entreprise import RefRegion, RefDepartement, RefArrondissement, RefSecteur, RefBranche, RefActivite
from app.models.zone_types import PoleTerritoire

router = APIRouter(prefix="/projets", tags=["Projets"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/projets")
os.makedirs(UPLOAD_DIR, exist_ok=True)

LOAD_OPTS = [
    selectinload(Projet.coordinateurs),
    selectinload(Projet.moa_list),
    selectinload(Projet.devise),
    selectinload(Projet.fichiers),
]


# ── GET /projets/devises ──────────────────────────────────────────────────────
@router.get("/devises")
async def liste_devises(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("""
        SELECT id, code_iso, nom, symbole FROM ref_devises
        WHERE code_iso IN ('XOF','USD','EUR') AND actif = true
        ORDER BY CASE code_iso WHEN 'XOF' THEN 1 WHEN 'USD' THEN 2 WHEN 'EUR' THEN 3 END
    """))
    return [{"id": r[0], "code": r[1], "symbole": r[3], "nom": r[2]} for r in res.fetchall()]


# ── Enrichissement ────────────────────────────────────────────────────────────
async def enrich(projets: list, db: AsyncSession) -> list:
    r_ids  = {p.region_id for p in projets if p.region_id}
    d_ids  = {p.departement_id for p in projets if p.departement_id}
    a_ids  = {p.arrondissement_id for p in projets if p.arrondissement_id}
    pl_ids = {p.pole_id for p in projets if p.pole_id}
    s_ids  = {sid for p in projets for sid in (p.secteur_ids or [])}
    b_ids  = {bid for p in projets for bid in (p.branche_ids or [])}
    ac_ids = {aid for p in projets for aid in (p.activite_ids or [])}
    noms: dict = {}
    if r_ids:
        res = await db.execute(select(RefRegion).where(RefRegion.id.in_(r_ids)))
        for r in res.scalars(): noms[f"r_{r.id}"] = r.nom
    if d_ids:
        res = await db.execute(select(RefDepartement).where(RefDepartement.id.in_(d_ids)))
        for d in res.scalars(): noms[f"d_{d.id}"] = d.nom
    if a_ids:
        res = await db.execute(select(RefArrondissement).where(RefArrondissement.id.in_(a_ids)))
        for a in res.scalars(): noms[f"a_{a.id}"] = a.nom
    if pl_ids:
        res = await db.execute(select(PoleTerritoire).where(PoleTerritoire.id.in_(pl_ids)))
        for p in res.scalars(): noms[f"p_{p.id}"] = p.pole_territoire
    if s_ids:
        res = await db.execute(select(RefSecteur).where(RefSecteur.id.in_(s_ids)))
        for s in res.scalars(): noms[f"s_{s.id}"] = s.nom
    if b_ids:
        res = await db.execute(select(RefBranche).where(RefBranche.id.in_(b_ids)))
        for b in res.scalars(): noms[f"b_{b.id}"] = b.nom
    if ac_ids:
        res = await db.execute(select(RefActivite).where(RefActivite.id.in_(ac_ids)))
        for a in res.scalars(): noms[f"ac_{a.id}"] = a.nom
    # Résoudre les noms de zones
    zone_ids = [p.zone_investissement for p in projets if p.zone_investissement]
    zone_noms: dict = {}
    for zid in zone_ids:
        prefix = zid[:3]
        tbl = {"ZES":"zones_zes","ZAI":"zones_zai","ZFI":"zones_zfi"}.get(prefix)
        if tbl:
            r = await db.execute(text(f"SELECT nom_zone FROM {tbl} WHERE id=:id"), {"id": zid})
            row = r.fetchone()
            if row: zone_noms[zid] = row[0]
    return [projet_to_dict(p, noms, zone_noms) for p in projets]


def projet_to_dict(p: Projet, noms: dict = {}, zone_noms: dict = {}) -> dict:
    return {
        "id":               str(p.id),
        "titre_projet":     p.titre_projet,
        "description":      p.description,
        "region_id":        p.region_id,
        "departement_id":   p.departement_id,
        "arrondissement_id":p.arrondissement_id,
        "zone_investissement": p.zone_investissement,
        "zone_nom":         zone_noms.get(p.zone_investissement) if p.zone_investissement else None,
        "pole_id":          p.pole_id,
        "secteur_ids":      p.secteur_ids or [],
        "branche_ids":      p.branche_ids or [],
        "activite_ids":     p.activite_ids or [],
        "investissement":             str(p.investissement) if p.investissement else None,
        "investissement_min":         str(p.investissement_min) if p.investissement_min else None,
        "investissement_max":         str(p.investissement_max) if p.investissement_max else None,
        "investissement_est_intervalle": p.investissement_est_intervalle or False,
        "devise_id":        p.devise_id,
        "devise_code":      p.devise.code_iso if p.devise else None,
        "devise_symbole":   p.devise.symbole  if p.devise else None,
        "porteur_projet":   p.porteur_projet,
        "moa_id":           str(p.moa_id) if p.moa_id else None,
        "est_publie":       p.est_publie if p.est_publie is not None else True,
        "region_nom":       noms.get(f"r_{p.region_id}"),
        "departement_nom":  noms.get(f"d_{p.departement_id}"),
        "arrondissement_nom":noms.get(f"a_{p.arrondissement_id}"),
        "pole_nom":         noms.get(f"p_{p.pole_id}"),
        "secteur_noms":     [noms[f"s_{sid}"] for sid in (p.secteur_ids or []) if f"s_{sid}" in noms],
        "branche_noms":     [noms[f"b_{bid}"] for bid in (p.branche_ids or []) if f"b_{bid}" in noms],
        "activite_noms":    [noms[f"ac_{aid}"] for aid in (p.activite_ids or []) if f"ac_{aid}" in noms],
        "created_at":       p.created_at.isoformat() if p.created_at else None,
        "moa_list": [
            {"id":str(m.id),"nom":m.nom,"telephone":m.telephone,"mail":m.mail}
            for m in (p.moa_list or [])
        ],
        "coordinateurs": [
            {"id":str(c.id),"civilite":c.civilite,"nom":c.nom,"prenom":c.prenom,
             "telephone":c.telephone,"mail":c.mail,"ordre":c.ordre}
            for c in (p.coordinateurs or [])
        ],
        "fichiers": [
            {"id":str(f.id),"titre":f.titre,"fichier_nom":f.fichier_nom}
            for f in (p.fichiers or [])
        ],
    }


async def apply_relations(p: Projet, payload: dict, db: AsyncSession):
    import uuid as _uuid
    if "moa_list" in payload:
        # 1. Vider moa_id d'abord (contrainte FK circulaire)
        await db.execute(text("UPDATE projets SET moa_id = NULL WHERE id = :pid"), {"pid": str(p.id)})
        await db.flush()
        # 2. Supprimer anciens MOA
        await db.execute(text("DELETE FROM projet_moa WHERE projet_id = :pid"), {"pid": str(p.id)})
        await db.flush()
        # 3. Créer nouveau MOA si des données sont présentes
        new_moa = payload["moa_list"]
        if new_moa and any(new_moa[0].get(k) for k in ["nom", "telephone", "mail"]):
            m_data = new_moa[0]
            res = await db.execute(text("""
                INSERT INTO projet_moa (id, projet_id, nom, telephone, mail, ordre)
                VALUES (gen_random_uuid(), :pid, :nom, :tel, :mail, 0) RETURNING id
            """), {
                "pid":  str(p.id),
                "nom":  m_data.get("nom") or None,
                "tel":  m_data.get("telephone") or None,
                "mail": m_data.get("mail") or None,
            })
            new_id = res.fetchone()[0]
            # 4. Mettre à jour moa_id via SQL direct pour contourner la limitation SQLAlchemy
            await db.execute(text("UPDATE projets SET moa_id = :mid WHERE id = :pid"), {"mid": str(new_id), "pid": str(p.id)})
        await db.flush()

    if "coordinateurs" in payload:
        await db.execute(text("DELETE FROM projet_coordinateurs WHERE projet_id = :pid"), {"pid": str(p.id)})
        await db.flush()
        for i, c in enumerate(payload["coordinateurs"]):
            await db.execute(text("""
                INSERT INTO projet_coordinateurs (projet_id, civilite, nom, prenom, telephone, mail, ordre)
                VALUES (:pid, :civ, :nom, :pre, :tel, :mail, :ord)
            """), {
                "pid": str(p.id), "civ": c.get("civilite") or None,
                "nom": c.get("nom") or None, "pre": c.get("prenom") or None,
                "tel": c.get("telephone") or None, "mail": c.get("mail") or None,
                "ord": i,
            })
        await db.flush()


# ── GET /projets ──────────────────────────────────────────────────────────────
@router.get("")
async def liste_projets(
    q:        Optional[str] = Query(None),
    page:     int           = Query(1, ge=1),
    per_page: int           = Query(20, ge=1, le=100),
    admin:    bool          = Query(False),
    db:       AsyncSession  = Depends(get_db),
):
    base = select(Projet).where(Projet.is_deleted == False)
    if not admin: base = base.where(Projet.est_publie == True)
    if q: base = base.where(Projet.titre_projet.ilike(f"%{q}%"))
    cnt   = await db.execute(base.with_only_columns(Projet.id))
    total = len(cnt.fetchall())
    stmt  = base.options(*LOAD_OPTS).order_by(Projet.created_at.desc()).offset((page-1)*per_page).limit(per_page)
    res   = await db.execute(stmt)
    return {"data": await enrich(list(res.scalars().all()), db),
            "total": total, "page": page, "per_page": per_page,
            "total_pages": max(1, -(-total // per_page))}


# ── POST /projets ─────────────────────────────────────────────────────────────
@router.post("", status_code=201)
async def creer_projet(payload: dict, db: AsyncSession = Depends(get_db)):
    if not (payload.get("titre_projet") or "").strip():
        raise HTTPException(422, "L'intitulé du projet est obligatoire")
    from decimal import Decimal
    def to_decimal(v): return Decimal(str(v)) if v else None

    investissement      = payload.get("investissement")
    inv_min             = payload.get("investissement_min")
    inv_max             = payload.get("investissement_max")
    if inv_min and inv_max and float(inv_max) <= float(inv_min):
        raise HTTPException(422, "Le montant maximum doit être strictement supérieur au montant minimum")
    p = Projet(
        titre_projet        = payload["titre_projet"].strip(),
        description         = payload.get("description") or None,
        region_id           = payload.get("region_id") or None,
        departement_id      = payload.get("departement_id") or None,
        arrondissement_id   = payload.get("arrondissement_id") or None,
        zone_investissement = payload.get("zone_investissement") or None,
        pole_id             = payload.get("pole_id") or None,
        secteur_ids         = payload.get("secteur_ids") or [],
        branche_ids         = payload.get("branche_ids") or [],
        activite_ids        = payload.get("activite_ids") or [],
        investissement      = to_decimal(investissement),
        investissement_min  = to_decimal(inv_min),
        investissement_max  = to_decimal(inv_max),
        investissement_est_intervalle = payload.get("investissement_est_intervalle") or False,
        devise_id           = payload.get("devise_id") or None,
        porteur_projet      = payload.get("porteur_projet") or None,
    )
    db.add(p)
    await db.flush()
    await apply_relations(p, payload, db)
    await db.refresh(p)  # Récupérer moa_id mis à jour
    res = await db.execute(select(Projet).options(*LOAD_OPTS).where(Projet.id == p.id))
    return (await enrich([res.scalar_one()], db))[0]


# ── PATCH /projets/:id ────────────────────────────────────────────────────────
@router.patch("/{projet_id}")
async def modifier_projet(projet_id: UUID, payload: dict, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Projet).options(*LOAD_OPTS).where(Projet.id == projet_id, Projet.is_deleted == False))
    p   = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Projet introuvable")
    inv_min = payload.get("investissement_min") or p.investissement_min
    inv_max = payload.get("investissement_max") or p.investissement_max
    if inv_min and inv_max and float(inv_max) <= float(inv_min):
        raise HTTPException(422, "Le montant maximum doit être strictement supérieur au montant minimum")
    for f in ["titre_projet","description","zone_investissement","porteur_projet"]:
        if f in payload: setattr(p, f, payload[f] or None)
    for f in ["region_id","departement_id","arrondissement_id","pole_id","devise_id"]:
        if f in payload: setattr(p, f, payload[f] or None)
    for f in ["secteur_ids","branche_ids","activite_ids"]:
        if f in payload: setattr(p, f, payload[f] or [])
    if "investissement" in payload:
        from decimal import Decimal
        p.investissement = Decimal(str(payload["investissement"])) if payload["investissement"] else None
    if "investissement_min" in payload:
        p.investissement_min = Decimal(str(payload["investissement_min"])) if payload["investissement_min"] else None
    if "investissement_max" in payload:
        p.investissement_max = Decimal(str(payload["investissement_max"])) if payload["investissement_max"] else None
    if "investissement_est_intervalle" in payload: p.investissement_est_intervalle = payload["investissement_est_intervalle"] or False
    await apply_relations(p, payload, db)
    await db.flush()
    await db.refresh(p)  # Récupérer moa_id mis à jour
    res = await db.execute(select(Projet).options(*LOAD_OPTS).where(Projet.id == projet_id))
    return (await enrich([res.scalar_one()], db))[0]


# ── POST /projets/:id/fichiers ────────────────────────────────────────────────
import os, shutil, uuid as uuid_lib
from fastapi import UploadFile, File, Form as FForm

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/projets")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/{projet_id}/fichiers", status_code=201)
async def ajouter_fichier(
    projet_id: UUID,
    titre:     str        = FForm(""),
    fichier:   UploadFile = File(...),
    db:        AsyncSession = Depends(get_db),
):
    ext = os.path.splitext(fichier.filename)[1].lower()
    if ext != ".pdf": raise HTTPException(422, "PDF uniquement")
    unique_name = f"{uuid_lib.uuid4()}{ext}"
    dest = os.path.join(UPLOAD_DIR, unique_name)
    with open(dest, "wb") as f:
        shutil.copyfileobj(fichier.file, f)
    pf = ProjetFichier(projet_id=projet_id, titre=titre or fichier.filename, fichier_nom=fichier.filename, fichier_path=dest)
    db.add(pf)
    await db.flush()
    return {"id": str(pf.id), "titre": pf.titre, "fichier_nom": pf.fichier_nom}


@router.delete("/{projet_id}/fichiers/{fichier_id}", status_code=204)
async def supprimer_fichier(projet_id: UUID, fichier_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ProjetFichier).where(ProjetFichier.id == fichier_id, ProjetFichier.projet_id == projet_id))
    pf  = res.scalar_one_or_none()
    if not pf: raise HTTPException(404, "Fichier introuvable")
    if pf.fichier_path and os.path.exists(pf.fichier_path):
        os.remove(pf.fichier_path)
    await db.delete(pf)
    await db.flush()


@router.get("/{projet_id}/fichiers/{fichier_id}/download")
async def telecharger_fichier(projet_id: UUID, fichier_id: UUID, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import FileResponse
    res = await db.execute(select(ProjetFichier).where(ProjetFichier.id == fichier_id, ProjetFichier.projet_id == projet_id))
    pf  = res.scalar_one_or_none()
    if not pf or not pf.fichier_path: raise HTTPException(404, "Fichier introuvable")
    return FileResponse(pf.fichier_path, filename=pf.fichier_nom, media_type="application/pdf")


# ── DELETE /projets/:id ───────────────────────────────────────────────────────
@router.delete("/{projet_id}", status_code=204)
async def supprimer_projet(projet_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Projet).where(Projet.id == projet_id))
    p   = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Projet introuvable")
    p.is_deleted = True
    await db.flush()


# ── POST /projets/:id/fichiers ────────────────────────────────────────────────
@router.post("/{projet_id}/fichiers", status_code=201)
async def ajouter_fichier(
    projet_id: UUID,
    titre:     str        = Form(""),
    fichier:   UploadFile = File(...),
    db:        AsyncSession = Depends(get_db),
):
    if not fichier.filename.lower().endswith(".pdf"):
        raise HTTPException(422, "PDF uniquement")
    unique_name = f"{uuid_lib.uuid4()}.pdf"
    dest = os.path.join(UPLOAD_DIR, unique_name)
    with open(dest, "wb") as f:
        shutil.copyfileobj(fichier.file, f)
    pf = ProjetFichier(projet_id=projet_id, titre=titre or fichier.filename,
                       fichier_nom=fichier.filename, fichier_path=dest)
    db.add(pf)
    await db.flush()
    return {"id": str(pf.id), "titre": pf.titre, "fichier_nom": pf.fichier_nom}


# ── DELETE /projets/:id/fichiers/:fid ─────────────────────────────────────────
@router.delete("/{projet_id}/fichiers/{fichier_id}", status_code=204)
async def supprimer_fichier(projet_id: UUID, fichier_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ProjetFichier).where(ProjetFichier.id == fichier_id, ProjetFichier.projet_id == projet_id))
    pf  = res.scalar_one_or_none()
    if not pf: raise HTTPException(404, "Fichier introuvable")
    if pf.fichier_path and os.path.exists(pf.fichier_path): os.remove(pf.fichier_path)
    await db.delete(pf)
    await db.flush()


# ── GET /projets/:id/fichiers/:fid/download ───────────────────────────────────
@router.get("/{projet_id}/fichiers/{fichier_id}/download")
async def telecharger_fichier(projet_id: UUID, fichier_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ProjetFichier).where(ProjetFichier.id == fichier_id, ProjetFichier.projet_id == projet_id))
    pf  = res.scalar_one_or_none()
    if not pf or not pf.fichier_path: raise HTTPException(404, "Fichier introuvable")
    return FileResponse(pf.fichier_path, filename=pf.fichier_nom, media_type="application/pdf")
