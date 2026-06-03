from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel
from app.core.database import get_db

router = APIRouter(prefix="/classifications", tags=["classifications"])

# ─── CITI : lecture hiérarchique ─────────────────────────────────────────────

@router.get("/citi/sections")
async def get_citi_sections(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "SELECT id, code, libelle, ordre FROM citi_sections ORDER BY ordre, code"
    ))
    return [{"id":r[0],"code":r[1],"libelle":r[2],"ordre":r[3]} for r in res.fetchall()]

@router.get("/citi/sections/{section_id}/divisions")
async def get_citi_divisions(section_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "SELECT id, code, libelle FROM citi_divisions WHERE section_id=:sid ORDER BY code"
    ), {"sid": section_id})
    return [{"id":r[0],"code":r[1],"libelle":r[2]} for r in res.fetchall()]

@router.get("/citi/divisions/{division_id}/groupes")
async def get_citi_groupes(division_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text(
        "SELECT id, code, libelle FROM citi_groupes WHERE division_id=:did ORDER BY code"
    ), {"did": division_id})
    return [{"id":r[0],"code":r[1],"libelle":r[2]} for r in res.fetchall()]

@router.get("/citi/groupes/{groupe_id}/classes")
async def get_citi_classes(groupe_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("""
        SELECT cl.id, cl.code, cl.libelle,
               COUNT(cn.id) as nb_correspondances
        FROM citi_classes cl
        LEFT JOIN citi_naema_correspondances cn ON cn.citi_classe_id = cl.id
        WHERE cl.groupe_id = :gid
        GROUP BY cl.id, cl.code, cl.libelle
        ORDER BY cl.code
    """), {"gid": groupe_id})
    return [{"id":r[0],"code":r[1],"libelle":r[2],"nb_correspondances":r[3]}
            for r in res.fetchall()]

@router.get("/citi/classes/{classe_id}/correspondances")
async def get_correspondances_citi(classe_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("""
        SELECT cn.id, cn.note,
               a.id as act_id, a.nom as act_nom,
               b.id as br_id, b.nom as br_nom,
               s.id as sec_id, s.nom as sec_nom
        FROM citi_naema_correspondances cn
        JOIN ref_activites a ON a.id = cn.naema_activite_id
        JOIN ref_branches  b ON b.id = a.branche_id
        JOIN ref_secteurs  s ON s.id = b.secteur_id
        WHERE cn.citi_classe_id = :cid
        ORDER BY s.nom, b.nom, a.nom
    """), {"cid": classe_id})
    return [{"id":r[0],"note":r[1],
             "activite":{"id":r[2],"nom":r[3]},
             "branche":{"id":r[4],"nom":r[5]},
             "secteur":{"id":r[6],"nom":r[7]}}
            for r in res.fetchall()]

# ─── Correspondances CITI ↔ NAEMA ─────────────────────────────────────────────

class LierIn(BaseModel):
    naema_activite_ids: List[int]
    note: Optional[str] = None

@router.put("/citi/classes/{classe_id}/correspondances")
async def set_correspondances_citi(classe_id: int, body: LierIn, db: AsyncSession = Depends(get_db)):
    """Remplace toutes les correspondances d'une classe CITI"""
    await db.execute(text(
        "DELETE FROM citi_naema_correspondances WHERE citi_classe_id=:cid"
    ), {"cid": classe_id})
    for act_id in body.naema_activite_ids:
        await db.execute(text("""
            INSERT INTO citi_naema_correspondances (citi_classe_id, naema_activite_id, note)
            VALUES (:cid, :aid, :note)
            ON CONFLICT DO NOTHING
        """), {"cid": classe_id, "aid": act_id, "note": body.note})
    await db.commit()
    return await get_correspondances_citi(classe_id, db)

@router.delete("/citi/classes/{classe_id}/correspondances/{corr_id}")
async def delete_correspondance_citi(classe_id: int, corr_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(text(
        "DELETE FROM citi_naema_correspondances WHERE id=:id AND citi_classe_id=:cid"
    ), {"id": corr_id, "cid": classe_id})
    await db.commit()
    return {"ok": True}

# ─── Sens inverse : depuis une activité NAEMA ─────────────────────────────────

@router.get("/naema/activites/{activite_id}/citi")
async def get_citi_for_naema(activite_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("""
        SELECT cn.id, cn.note,
               cl.id as cls_id, cl.code as cls_code, cl.libelle as cls_libelle,
               g.code as grp_code, g.libelle as grp_libelle,
               d.code as div_code, d.libelle as div_libelle,
               s.code as sec_code, s.libelle as sec_libelle
        FROM citi_naema_correspondances cn
        JOIN citi_classes   cl ON cl.id = cn.citi_classe_id
        JOIN citi_groupes   g  ON g.id  = cl.groupe_id
        JOIN citi_divisions d  ON d.id  = g.division_id
        JOIN citi_sections  s  ON s.id  = d.section_id
        WHERE cn.naema_activite_id = :aid
        ORDER BY cl.code
    """), {"aid": activite_id})
    return [{"id":r[0],"note":r[1],
             "classe":{"id":r[2],"code":r[3],"libelle":r[4]},
             "groupe":{"code":r[5],"libelle":r[6]},
             "division":{"code":r[7],"libelle":r[8]},
             "section":{"code":r[9],"libelle":r[10]}}
            for r in res.fetchall()]

# ─── Statistiques ────────────────────────────────────────────────────────────

@router.get("/citi/stats")
async def get_citi_stats(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT
          (SELECT COUNT(*) FROM citi_sections) as sections,
          (SELECT COUNT(*) FROM citi_divisions) as divisions,
          (SELECT COUNT(*) FROM citi_groupes) as groupes,
          (SELECT COUNT(*) FROM citi_classes) as classes,
          (SELECT COUNT(DISTINCT citi_classe_id) FROM citi_naema_correspondances) as classes_liees,
          (SELECT COUNT(*) FROM citi_naema_correspondances) as total_liens
    """))
    row = r.fetchone()
    return {"sections":row[0],"divisions":row[1],"groupes":row[2],
            "classes":row[3],"classes_liees":row[4],"total_liens":row[5]}

# ─── Route plate : toutes les classes avec leur lettre de section ─────────────
@router.get("/citi/toutes-classes")
async def get_toutes_classes(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("""
        SELECT cl.id, cl.code, cl.libelle, s.code as section_code,
               COUNT(cn.id) as nb_correspondances
        FROM citi_classes cl
        JOIN citi_groupes   g  ON g.id  = cl.groupe_id
        JOIN citi_divisions d  ON d.id  = g.division_id
        JOIN citi_sections  s  ON s.id  = d.section_id
        LEFT JOIN citi_naema_correspondances cn ON cn.citi_classe_id = cl.id
        GROUP BY cl.id, cl.code, cl.libelle, s.code, s.ordre
        ORDER BY s.ordre, cl.code
    """))
    return [{"id":r[0],"code":r[1],"libelle":r[2],"section_code":r[3],"nb_correspondances":r[4]}
            for r in res.fetchall()]

@router.get("/citi/toutes-divisions")
async def get_toutes_divisions(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("SELECT id, section_id, code, libelle FROM citi_divisions ORDER BY code"))
    return [{"id":r[0],"section_id":r[1],"code":r[2],"libelle":r[3]} for r in res.fetchall()]

@router.get("/citi/tous-groupes")
async def get_tous_groupes(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("SELECT id, division_id, code, libelle FROM citi_groupes ORDER BY code"))
    return [{"id":r[0],"division_id":r[1],"code":r[2],"libelle":r[3]} for r in res.fetchall()]

# ══════════════════════════════════════════════════════════════════════════════
# NACE : routes identiques à CITI
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/nace/toutes-classes")
async def get_toutes_classes_nace(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("""
        SELECT cl.id, cl.code, cl.libelle, s.code as section_code,
               COUNT(cn.id) as nb_correspondances
        FROM nace_classes cl
        JOIN nace_groupes   g  ON g.id  = cl.groupe_id
        JOIN nace_divisions d  ON d.id  = g.division_id
        JOIN nace_sections  s  ON s.id  = d.section_id
        LEFT JOIN nace_naema_correspondances cn ON cn.nace_classe_id = cl.id
        GROUP BY cl.id, cl.code, cl.libelle, s.code, s.ordre
        ORDER BY s.ordre, cl.code
    """))
    return [{"id":r[0],"code":r[1],"libelle":r[2],"section_code":r[3],"nb_correspondances":r[4]}
            for r in res.fetchall()]

@router.get("/nace/classes/{classe_id}/correspondances")
async def get_correspondances_nace(classe_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("""
        SELECT cn.id, cn.note,
               a.id as act_id, a.nom as act_nom,
               b.id as br_id, b.nom as br_nom,
               s.id as sec_id, s.nom as sec_nom
        FROM nace_naema_correspondances cn
        JOIN ref_activites a ON a.id = cn.naema_activite_id
        JOIN ref_branches  b ON b.id = a.branche_id
        JOIN ref_secteurs  s ON s.id = b.secteur_id
        WHERE cn.nace_classe_id = :cid
        ORDER BY s.nom, b.nom, a.nom
    """), {"cid": classe_id})
    return [{"id":r[0],"note":r[1],
             "activite":{"id":r[2],"nom":r[3]},
             "branche":{"id":r[4],"nom":r[5]},
             "secteur":{"id":r[6],"nom":r[7]}}
            for r in res.fetchall()]

@router.put("/nace/classes/{classe_id}/correspondances")
async def set_correspondances_nace(classe_id: int, body: LierIn, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM nace_naema_correspondances WHERE nace_classe_id=:cid"), {"cid": classe_id})
    for act_id in body.naema_activite_ids:
        await db.execute(text("""
            INSERT INTO nace_naema_correspondances (nace_classe_id, naema_activite_id, note)
            VALUES (:cid, :aid, :note) ON CONFLICT DO NOTHING
        """), {"cid": classe_id, "aid": act_id, "note": body.note})
    await db.commit()
    return await get_correspondances_nace(classe_id, db)

@router.delete("/nace/classes/{classe_id}/correspondances/{corr_id}")
async def delete_correspondance_nace(classe_id: int, corr_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(text(
        "DELETE FROM nace_naema_correspondances WHERE id=:id AND nace_classe_id=:cid"
    ), {"id": corr_id, "cid": classe_id})
    await db.commit()
    return {"ok": True}

@router.get("/nace/stats")
async def get_nace_stats(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT
          (SELECT COUNT(*) FROM nace_sections) as sections,
          (SELECT COUNT(*) FROM nace_divisions) as divisions,
          (SELECT COUNT(*) FROM nace_groupes) as groupes,
          (SELECT COUNT(*) FROM nace_classes) as classes,
          (SELECT COUNT(DISTINCT nace_classe_id) FROM nace_naema_correspondances) as classes_liees,
          (SELECT COUNT(*) FROM nace_naema_correspondances) as total_liens
    """))
    row = r.fetchone()
    return {"sections":row[0],"divisions":row[1],"groupes":row[2],
            "classes":row[3],"classes_liees":row[4],"total_liens":row[5]}
