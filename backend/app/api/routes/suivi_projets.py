from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.suivi_projet import ProjetPhase
from app.models.projet import Projet

router = APIRouter(prefix="/suivi-projets", tags=["Suivi Projets"])


def phase_to_dict(p: ProjetPhase) -> dict:
    return {
        "id":         p.id,
        "projet_id":  p.projet_id,
        "ordre":      p.ordre,
        "titre":      p.titre,
        "date_debut": p.date_debut.isoformat() if p.date_debut else None,
        "date_fin":   p.date_fin.isoformat()   if p.date_fin   else None,
        "note":       p.note,
    }


def calc_statut(projet: Projet, phases: list) -> dict:
    """Calcule le statut temporel du projet."""
    today = date_type.today()
    date_attr = projet.date_attribution
    date_fin  = projet.date_fin_prevue

    if not date_attr:
        statut = "non_demarre"
        jours_restants = None
        jours_ecoules  = None
        est_en_retard  = False
    else:
        jours_ecoules = (today - date_attr).days
        if date_fin:
            jours_restants = (date_fin - today).days
            est_en_retard  = today > date_fin and not (phases and phases[-1].titre.lower().find("livrai") >= 0)
        else:
            jours_restants = None
            est_en_retard  = False

        # Statut basé sur les phases
        if not phases:
            statut = "attribue"  # attribué mais pas encore démarré
        else:
            derniere = phases[-1]
            if derniere.date_fin:
                statut = "livre" if date_fin and today >= date_fin else "en_cours"
            else:
                statut = "en_retard" if est_en_retard else "en_cours"

    return {
        "statut":         statut,
        "est_en_retard":  est_en_retard,
        "jours_restants": jours_restants,
        "jours_ecoules":  jours_ecoules,
        "date_attribution": date_attr.isoformat() if date_attr else None,
        "date_fin_prevue":  date_fin.isoformat()  if date_fin  else None,
    }


# ── GET /suivi-projets/:projet_id ─────────────────────────────────────────────
@router.get("/{projet_id}")
async def get_suivi(projet_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Projet).where(Projet.id == projet_id, Projet.is_deleted == False))
    projet = res.scalar_one_or_none()
    if not projet: raise HTTPException(404, "Projet introuvable")

    res = await db.execute(
        select(ProjetPhase)
        .where(ProjetPhase.projet_id == projet_id)
        .order_by(ProjetPhase.ordre)
    )
    phases = list(res.scalars().all())
    temporel = calc_statut(projet, phases)

    return {
        "projet_id": projet_id,
        "phases":    [phase_to_dict(p) for p in phases],
        **temporel,
    }


# ── POST /suivi-projets/:projet_id/phases ─────────────────────────────────────
@router.post("/{projet_id}/phases", status_code=201)
async def ajouter_phase(projet_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from datetime import date as date_type

    if not payload.get("titre", "").strip():
        raise HTTPException(422, "Le titre est obligatoire")
    if not payload.get("date_debut"):
        raise HTTPException(422, "La date de début est obligatoire")

    date_debut = date_type.fromisoformat(payload["date_debut"])

    # Vérifier le projet
    res = await db.execute(select(Projet).where(Projet.id == projet_id))
    projet = res.scalar_one_or_none()
    if not projet: raise HTTPException(404, "Projet introuvable")

    # Contrainte 1 : date >= date_attribution
    if projet.date_attribution and date_debut < projet.date_attribution:
        raise HTTPException(422, f"La date de début doit être ≥ à la date d'attribution ({projet.date_attribution.isoformat()})")

    # Contrainte 2 : date > date_début de la dernière phase
    res = await db.execute(select(ProjetPhase).where(ProjetPhase.projet_id == projet_id).order_by(ProjetPhase.ordre))
    phases = list(res.scalars().all())
    if phases:
        derniere = phases[-1]
        if date_debut <= derniere.date_debut:
            raise HTTPException(422, f"La date de début doit être strictement après celle de la phase précédente ({derniere.date_debut.isoformat()})")

    p = ProjetPhase(
        projet_id  = projet_id,
        titre      = payload["titre"].strip(),
        date_debut = date_debut,
        note       = payload.get("note") or None,
    )
    db.add(p)
    await db.flush()
    await db.refresh(p)
    return phase_to_dict(p)


# ── PATCH /suivi-projets/phases/:phase_id ────────────────────────────────────
# Le coordinateur NE PEUT modifier que la note — titre et dates sont verrouillés
@router.patch("/phases/{phase_id}")
async def modifier_phase(phase_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ProjetPhase).where(ProjetPhase.id == phase_id))
    p   = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Phase introuvable")
    # Seule la note est modifiable
    if "note" in payload: p.note = payload["note"] or None
    await db.flush()
    return phase_to_dict(p)


# ── DELETE /suivi-projets/phases/:phase_id — interdit ────────────────────────
@router.delete("/phases/{phase_id}", status_code=204)
async def supprimer_phase(phase_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ProjetPhase).where(ProjetPhase.id == phase_id))
    p   = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Phase introuvable")
    # Seule la dernière phase peut être supprimée (si erreur de saisie)
    res2 = await db.execute(select(ProjetPhase).where(ProjetPhase.projet_id == p.projet_id).order_by(ProjetPhase.ordre.desc()).limit(1))
    derniere = res2.scalar_one_or_none()
    if not derniere or derniere.id != phase_id:
        raise HTTPException(403, "Seule la dernière phase peut être supprimée")
    await db.delete(p)
    await db.flush()
