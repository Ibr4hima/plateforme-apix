import os, shutil, uuid as uuid_lib
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID

from app.core.database import get_db
from app.models.zone import ZoneInvestissement, ZoneEntreprise, ZoneFichier
from app.models.entreprise import EntrepriseIntallee

router = APIRouter(prefix="/zones", tags=["Zones"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/zones")
os.makedirs(UPLOAD_DIR, exist_ok=True)

LOAD_OPTS = [
    selectinload(ZoneInvestissement.entreprises).selectinload(ZoneEntreprise.entreprise),
    selectinload(ZoneInvestissement.fichiers),
]


def zone_to_dict(z: ZoneInvestissement) -> dict:
    return {
        "id":           str(z.id),
        "denomination": z.denomination,
        "type_zone":    z.type_zone,
        "description":  z.description,
        "thematiques":  z.thematiques,
        "est_publie":   z.est_publie,
        "created_at":   z.created_at.isoformat() if z.created_at else None,
        "entreprises": [
            {
                "id":           str(ze.id),
                "entreprise_id":str(ze.entreprise_id),
                "date_installation": ze.date_installation.isoformat() if ze.date_installation else None,
                "entreprise": {
                    "id":               str(ze.entreprise.id),
                    "nom":              ze.entreprise.nom,
                    "forme_juridique":  ze.entreprise.forme_juridique,
                    "telephone":        ze.entreprise.telephone,
                    "mail":             ze.entreprise.mail,
                    "adresse":          ze.entreprise.adresse,
                    "secteur":          {"id": ze.entreprise.secteur_id, "nom": ze.entreprise.secteur.nom} if ze.entreprise.secteur else None,
                    "branche":          {"id": ze.entreprise.branche_id, "nom": ze.entreprise.branche.nom} if ze.entreprise.branche else None,
                    "activite":         {"id": ze.entreprise.activite_id, "nom": ze.entreprise.activite.nom} if ze.entreprise.activite else None,
                    "region_nom":       ze.entreprise.region_obj.nom if ze.entreprise.region_obj else None,
                    "departement_nom":  ze.entreprise.departement_obj.nom if ze.entreprise.departement_obj else None,
                    "siege_pays_nom":   ze.entreprise.siege_pays_obj.nom_fr if ze.entreprise.siege_pays_obj else None,
                } if ze.entreprise else None,
            }
            for ze in (z.entreprises or [])
        ],
        "fichiers": [
            {"id": str(f.id), "titre": f.titre, "fichier_nom": f.fichier_nom}
            for f in (z.fichiers or [])
        ],
    }


# ── GET /zones ─────────────────────────────────────────────────────────────────
@router.get("")
async def liste_zones(
    type_zone: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    filters = [ZoneInvestissement.is_deleted == False]
    if type_zone:
        filters.append(ZoneInvestissement.type_zone == type_zone)
    result = await db.execute(
        select(ZoneInvestissement).options(*LOAD_OPTS)
        .where(and_(*filters))
        .order_by(ZoneInvestissement.denomination)
    )
    return [zone_to_dict(z) for z in result.scalars().all()]


# ── POST /zones ────────────────────────────────────────────────────────────────
@router.post("", status_code=201)
async def creer_zone(
    denomination: str           = Form(...),
    type_zone:    str           = Form(...),
    description:  Optional[str] = Form(None),
    thematiques:  Optional[str] = Form(None),
    est_publie:   bool          = Form(True),
    db:           AsyncSession  = Depends(get_db),
):
    z = ZoneInvestissement(
        denomination=denomination, type_zone=type_zone,
        description=description, thematiques=thematiques,
        est_publie=est_publie,
    )
    db.add(z)
    await db.flush()
    result = await db.execute(select(ZoneInvestissement).options(*LOAD_OPTS).where(ZoneInvestissement.id == z.id))
    return zone_to_dict(result.scalar_one())


# ── PATCH /zones/:id ───────────────────────────────────────────────────────────
@router.patch("/{zone_id}")
async def modifier_zone(
    zone_id:      UUID,
    denomination: Optional[str] = Form(None),
    type_zone:    Optional[str] = Form(None),
    description:  Optional[str] = Form(None),
    thematiques:  Optional[str] = Form(None),
    est_publie:   Optional[bool]= Form(None),
    db:           AsyncSession  = Depends(get_db),
):
    result = await db.execute(select(ZoneInvestissement).where(ZoneInvestissement.id == zone_id, ZoneInvestissement.is_deleted == False))
    z = result.scalar_one_or_none()
    if not z: raise HTTPException(404, "Zone introuvable")
    if denomination is not None: z.denomination = denomination
    if type_zone    is not None: z.type_zone    = type_zone
    if description  is not None: z.description  = description
    if thematiques  is not None: z.thematiques  = thematiques
    if est_publie   is not None: z.est_publie   = est_publie
    await db.flush()
    result = await db.execute(select(ZoneInvestissement).options(*LOAD_OPTS).where(ZoneInvestissement.id == zone_id))
    return zone_to_dict(result.scalar_one())


# ── DELETE /zones/:id ──────────────────────────────────────────────────────────
@router.delete("/{zone_id}", status_code=204)
async def supprimer_zone(zone_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZoneInvestissement).where(ZoneInvestissement.id == zone_id))
    z = result.scalar_one_or_none()
    if not z: raise HTTPException(404, "Zone introuvable")
    z.is_deleted = True
    await db.flush()


# ── POST /zones/:id/entreprises ────────────────────────────────────────────────
@router.post("/{zone_id}/entreprises", status_code=201)
async def ajouter_entreprise(
    zone_id:      UUID,
    entreprise_id:UUID,
    date_installation: Optional[str] = None,
    db:           AsyncSession = Depends(get_db),
):
    from datetime import date as date_type
    ze = ZoneEntreprise(
        zone_id=zone_id,
        entreprise_id=entreprise_id,
        date_installation=date_type.fromisoformat(date_installation) if date_installation else None,
    )
    db.add(ze)
    await db.flush()
    return {"id": str(ze.id)}


# ── DELETE /zones/:id/entreprises/:ze_id ──────────────────────────────────────
@router.delete("/{zone_id}/entreprises/{ze_id}", status_code=204)
async def retirer_entreprise(zone_id: UUID, ze_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZoneEntreprise).where(ZoneEntreprise.id == ze_id, ZoneEntreprise.zone_id == zone_id))
    ze = result.scalar_one_or_none()
    if not ze: raise HTTPException(404, "Association introuvable")
    await db.delete(ze)
    await db.flush()


# ── POST /zones/:id/fichiers ───────────────────────────────────────────────────
@router.post("/{zone_id}/fichiers", status_code=201)
async def ajouter_fichier(
    zone_id: UUID,
    titre:   str        = Form(""),
    fichier: UploadFile = File(...),
    db:      AsyncSession = Depends(get_db),
):
    ext = os.path.splitext(fichier.filename)[1].lower()
    if ext != ".pdf": raise HTTPException(422, "PDF uniquement")
    unique_name = f"{uuid_lib.uuid4()}{ext}"
    dest = os.path.join(UPLOAD_DIR, unique_name)
    with open(dest, "wb") as f:
        shutil.copyfileobj(fichier.file, f)
    zf = ZoneFichier(zone_id=zone_id, titre=titre or fichier.filename, fichier_nom=fichier.filename, fichier_path=dest)
    db.add(zf)
    await db.flush()
    return {"id": str(zf.id), "titre": zf.titre, "fichier_nom": zf.fichier_nom}


# ── DELETE /zones/:id/fichiers/:fid ───────────────────────────────────────────
@router.delete("/{zone_id}/fichiers/{fichier_id}", status_code=204)
async def supprimer_fichier(zone_id: UUID, fichier_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ZoneFichier).where(ZoneFichier.id == fichier_id, ZoneFichier.zone_id == zone_id))
    zf = result.scalar_one_or_none()
    if not zf: raise HTTPException(404, "Fichier introuvable")
    if zf.fichier_path and os.path.exists(zf.fichier_path):
        os.remove(zf.fichier_path)
    await db.delete(zf)
    await db.flush()


# ── GET /zones/:id/fichiers/:fid/download ─────────────────────────────────────
@router.get("/{zone_id}/fichiers/{fichier_id}/download")
async def telecharger_fichier(zone_id: UUID, fichier_id: UUID, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import FileResponse
    result = await db.execute(select(ZoneFichier).where(ZoneFichier.id == fichier_id, ZoneFichier.zone_id == zone_id))
    zf = result.scalar_one_or_none()
    if not zf or not zf.fichier_path: raise HTTPException(404, "Fichier introuvable")
    return FileResponse(zf.fichier_path, filename=zf.fichier_nom, media_type="application/pdf")
