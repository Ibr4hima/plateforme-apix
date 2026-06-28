from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from app.core.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

def rows(r):
    keys = list(r.keys())
    return [dict(zip(keys, row)) for row in r.fetchall()]

async def safe(db, query, params=None):
    try:
        r = await db.execute(text(query), params or {})
        return rows(r)
    except Exception as e:
        print(f"Dashboard query error: {e}")
        return []

# ── KPIs globaux ──────────────────────────────────────────────────────────────
@router.get("/stats")
async def get_kpis(db: AsyncSession = Depends(get_db)):
    try:
        r = await db.execute(text("""
            SELECT
              (SELECT COUNT(*) FROM entreprises_installees WHERE is_deleted=FALSE),
              (SELECT COUNT(*) FROM accords_traites      WHERE is_deleted=FALSE),
              (SELECT COUNT(*) FROM accords_traites      WHERE is_deleted=FALSE AND statut='en_vigueur'),
              (SELECT COUNT(*) FROM evenements           WHERE is_deleted=FALSE),
              (SELECT COUNT(*) FROM evenements           WHERE is_deleted=FALSE AND date_debut >= CURRENT_DATE),
              (SELECT COUNT(*) FROM prospects            WHERE is_deleted=FALSE),
              (SELECT COUNT(*) FROM projets              WHERE is_deleted=FALSE),
              (SELECT COUNT(*) FROM intentions_investissement WHERE is_deleted=FALSE),
              (SELECT COALESCE(SUM(montant_projete_usd),0) FROM intentions_investissement WHERE is_deleted=FALSE),
              (SELECT COUNT(*) FROM zones                WHERE is_deleted=FALSE),
              (SELECT COUNT(*) FROM poles_territoires),
              (SELECT COUNT(*) FROM zone_entreprises),
              -- Indicateurs Global (tableau de bord)
              (SELECT COUNT(*) FROM prospects p WHERE p.is_deleted=FALSE AND p.issue IS NULL
                 AND NOT EXISTS (SELECT 1 FROM prospect_echanges e WHERE e.prospect_id = p.id)),
              (SELECT COUNT(*) FROM prospects p WHERE p.is_deleted=FALSE AND p.issue IS NULL
                 AND EXISTS (SELECT 1 FROM prospect_echanges e WHERE e.prospect_id = p.id))
        """))
        k = r.fetchone()
        return {
            "entreprises_total":  k[0],
            "accords_total":      k[1],
            "accords_vigueur":    k[2],
            "evenements_total":   k[3],
            "evenements_a_venir": k[4],
            "prospects_total":    k[5],
            "projets_total":      k[6],
            "intentions_total":   k[7],
            "intentions_usd":     float(k[8]),
            "zones_total":        k[9],
            "poles_total":        k[10],
            "zone_ent_total":     k[11],
            # Indicateurs Global du tableau de bord
            "global_installees":  k[0],
            "global_ciblees":     k[12],
            "global_contactees":  k[13],
        }
    except Exception:
        return {}

# ════════════════════════════════════════════════════════════════════════════════
# ENDPOINTS PARAMÈTRES (pour les selects cascadés de la sidebar)
# ════════════════════════════════════════════════════════════════════════════════

@router.get("/params/types-zones")
async def param_types_zones(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT DISTINCT type_zone FROM zones WHERE is_deleted=FALSE AND type_zone IS NOT NULL
        ORDER BY type_zone
    """)

@router.get("/params/zones-par-type")
async def param_zones_par_type(type_zone: str = Query(...), db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT id, nom_zone FROM zones
        WHERE is_deleted=FALSE AND type_zone = :type_zone
        ORDER BY nom_zone
    """, {"type_zone": type_zone})

@router.get("/params/secteurs")
async def param_secteurs(db: AsyncSession = Depends(get_db)):
    return await safe(db, "SELECT id, nom FROM ref_secteurs ORDER BY nom")

@router.get("/params/regions")
async def param_regions(db: AsyncSession = Depends(get_db)):
    return await safe(db, "SELECT id, nom FROM ref_regions ORDER BY nom")

# ════════════════════════════════════════════════════════════════════════════════
# ENDPOINTS VISUALISATIONS
# ════════════════════════════════════════════════════════════════════════════════

@router.get("/viz/entreprises-par-secteur")
async def viz_ent_secteur(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT s.nom as label, COUNT(DISTINCT e.id) as valeur
        FROM entreprises_installees e
        JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        JOIN ref_secteurs s ON s.id = sid
        WHERE e.is_deleted=FALSE AND array_length(e.secteur_ids,1) > 0
        GROUP BY s.nom ORDER BY valeur DESC
    """)

@router.get("/viz/entreprises-en-zone-par-secteur")
async def viz_ent_zone_secteur(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT s.nom as label, COUNT(DISTINCT ze.entreprise_id) as valeur
        FROM zone_entreprises ze
        JOIN entreprises_installees e ON e.id = ze.entreprise_id AND e.is_deleted=FALSE
        JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        JOIN ref_secteurs s ON s.id = sid
        GROUP BY s.nom ORDER BY valeur DESC
    """)

@router.get("/viz/entreprises-par-branche")
async def viz_ent_branche(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT b.nom as label, COUNT(DISTINCT e.id) as valeur
        FROM entreprises_installees e
        JOIN LATERAL unnest(e.branche_ids) bid ON TRUE
        JOIN ref_branches b ON b.id = bid
        WHERE e.is_deleted=FALSE AND array_length(e.branche_ids,1) > 0
        GROUP BY b.nom ORDER BY valeur DESC LIMIT 20
    """)

@router.get("/viz/branches-par-secteur")
async def viz_branches_secteur(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT s.nom as secteur, b.nom as branche, COUNT(DISTINCT e.id) as valeur
        FROM entreprises_installees e
        JOIN LATERAL unnest(e.branche_ids) bid ON TRUE
        JOIN ref_branches b ON b.id = bid
        JOIN ref_secteurs s ON s.id = b.secteur_id
        WHERE e.is_deleted=FALSE AND array_length(e.branche_ids,1) > 0
        GROUP BY s.nom, b.nom ORDER BY s.nom, valeur DESC
    """)

@router.get("/viz/entreprises-par-activite")
async def viz_ent_activite(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT a.nom as label, COUNT(DISTINCT e.id) as valeur
        FROM entreprises_installees e
        JOIN LATERAL unnest(e.activite_ids) aid ON TRUE
        JOIN ref_activites a ON a.id = aid
        WHERE e.is_deleted=FALSE AND array_length(e.activite_ids,1) > 0
        GROUP BY a.nom ORDER BY valeur DESC LIMIT 20
    """)

@router.get("/viz/entreprises-par-region")
async def viz_ent_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT r.nom as label, COUNT(e.id) as valeur
        FROM entreprises_installees e
        JOIN ref_regions r ON r.id = e.region_id
        WHERE e.is_deleted=FALSE AND e.region_id IS NOT NULL
        GROUP BY r.nom ORDER BY valeur DESC
    """)

@router.get("/viz/region-stats")
async def viz_region_stats(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT r.nom as region,
               COUNT(DISTINCT e.id) as total,
               COUNT(CASE WHEN s.code = 'S1' THEN 1 END) as primaire,
               COUNT(CASE WHEN s.code = 'S2' THEN 1 END) as secondaire,
               COUNT(CASE WHEN s.code = 'S3' THEN 1 END) as tertiaire
        FROM ref_regions r
        LEFT JOIN entreprises_installees e ON e.region_id = r.id AND e.is_deleted=FALSE
        LEFT JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        LEFT JOIN ref_secteurs s ON s.id = sid
        WHERE r.id IS NOT NULL
        GROUP BY r.nom
        HAVING COUNT(DISTINCT e.id) > 0
        ORDER BY r.nom
    """)

@router.get("/viz/entreprises-par-departement")
async def viz_ent_dept(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT d.nom as label, COUNT(e.id) as valeur
        FROM entreprises_installees e
        JOIN ref_departements d ON d.id = e.departement_id
        WHERE e.is_deleted=FALSE AND e.departement_id IS NOT NULL
        GROUP BY d.nom ORDER BY valeur DESC LIMIT 20
    """)

@router.get("/viz/entreprises-dept-par-region")
async def viz_ent_dept_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT r.nom as region, d.nom as departement, COUNT(e.id) as valeur
        FROM entreprises_installees e
        JOIN ref_departements d ON d.id = e.departement_id
        JOIN ref_regions r ON r.id = e.region_id
        WHERE e.is_deleted=FALSE AND e.departement_id IS NOT NULL AND e.region_id IS NOT NULL
        GROUP BY r.nom, d.nom ORDER BY r.nom, valeur DESC
    """)

@router.get("/viz/entreprises-par-forme")
async def viz_ent_forme(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT COALESCE(NULLIF(TRIM(forme_juridique),''),'Non renseignée') as label,
               COUNT(*) as valeur
        FROM entreprises_installees WHERE is_deleted=FALSE
        GROUP BY label ORDER BY valeur DESC
    """)

@router.get("/viz/entreprises-par-annee")
async def viz_ent_annee(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT EXTRACT(YEAR FROM date_creation)::int as label, COUNT(*) as valeur
        FROM entreprises_installees
        WHERE is_deleted=FALSE AND date_creation IS NOT NULL
          AND EXTRACT(YEAR FROM date_creation) >= 1990
        GROUP BY label ORDER BY label
    """)

@router.get("/viz/entreprises-par-pays")
async def viz_ent_pays(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT p.nom_fr as label, COUNT(e.id) as valeur
        FROM entreprises_installees e
        JOIN ref_pays p ON p.id = e.siege_pays_id
        WHERE e.is_deleted=FALSE AND e.siege_pays_id IS NOT NULL
        GROUP BY p.nom_fr ORDER BY valeur DESC LIMIT 20
    """)

@router.get("/viz/entreprises-dans-zone")
async def viz_ent_dans_zone(
    zone_id: Optional[int] = Query(None),
    type_zone: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    if zone_id:
        return await safe(db, """
            SELECT z.nom_zone as label, COUNT(ze.id) as valeur
            FROM zones z
            LEFT JOIN zone_entreprises ze ON ze.zone_id = z.id
            WHERE z.id = :zone_id AND z.is_deleted=FALSE
            GROUP BY z.nom_zone
        """, {"zone_id": zone_id})
    elif type_zone:
        return await safe(db, """
            SELECT z.nom_zone as label, COUNT(ze.id) as valeur
            FROM zones z
            LEFT JOIN zone_entreprises ze ON ze.zone_id = z.id
            WHERE z.type_zone = :type_zone AND z.is_deleted=FALSE
            GROUP BY z.nom_zone ORDER BY valeur DESC
        """, {"type_zone": type_zone})
    else:
        return await safe(db, """
            SELECT z.nom_zone as label, COUNT(ze.id) as valeur
            FROM zones z LEFT JOIN zone_entreprises ze ON ze.zone_id = z.id
            WHERE z.is_deleted=FALSE
            GROUP BY z.nom_zone ORDER BY valeur DESC
        """)

@router.get("/viz/entreprises-dans-secteur")
async def viz_ent_dans_secteur(secteur_id: Optional[int] = Query(None), db: AsyncSession = Depends(get_db)):
    if secteur_id:
        return await safe(db, """
            SELECT COALESCE(NULLIF(TRIM(e.nom_entreprise),''),'Sans nom') as label, 1 as valeur
            FROM entreprises_installees e
            WHERE e.is_deleted=FALSE AND :secteur_id = ANY(e.secteur_ids)
            ORDER BY e.nom_entreprise LIMIT 50
        """, {"secteur_id": secteur_id})
    return []

# ── Zones ─────────────────────────────────────────────────────────────────────
@router.get("/viz/zones-par-type")
async def viz_zones_type(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT type_zone as label, COUNT(*) as valeur
        FROM zones WHERE is_deleted=FALSE
        GROUP BY type_zone ORDER BY valeur DESC
    """)

@router.get("/viz/zones-superficie")
async def viz_zones_superficie(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT type_zone as label, COALESCE(SUM(superficie),0)::float as valeur
        FROM zones WHERE is_deleted=FALSE
        GROUP BY type_zone ORDER BY valeur DESC
    """)

@router.get("/viz/zones-par-region")
async def viz_zones_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT r.nom as label, COUNT(z.id) as valeur
        FROM zones z JOIN ref_regions r ON r.id = z.region_id
        WHERE z.is_deleted=FALSE AND z.region_id IS NOT NULL
        GROUP BY r.nom ORDER BY valeur DESC
    """)

@router.get("/viz/zones-statut-entreprises")
async def viz_zones_statut(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT COALESCE(ze.statut,'inconnu') as label, COUNT(*) as valeur
        FROM zone_entreprises ze
        JOIN zones z ON z.id = ze.zone_id AND z.is_deleted=FALSE
        GROUP BY ze.statut ORDER BY valeur DESC
    """)

@router.get("/viz/poles-par-region")
async def viz_poles_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT COALESCE(r.nom,'Non renseignée') as label, COUNT(pt.id) as valeur
        FROM poles_territoires pt
        LEFT JOIN ref_regions r ON r.id = pt.region_id
        GROUP BY r.nom ORDER BY valeur DESC
    """)

@router.get("/viz/detail-zone")
async def viz_detail_zone(zone_id: Optional[int] = Query(None), db: AsyncSession = Depends(get_db)):
    if not zone_id:
        return []
    return await safe(db, """
        SELECT s.nom as label, COUNT(DISTINCT e.id) as valeur
        FROM zone_entreprises ze
        JOIN entreprises_installees e ON e.id = ze.entreprise_id AND e.is_deleted=FALSE
        JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        JOIN ref_secteurs s ON s.id = sid
        WHERE ze.zone_id = :zone_id
        GROUP BY s.nom ORDER BY valeur DESC
    """, {"zone_id": zone_id})

# ── Croisements ───────────────────────────────────────────────────────────────
@router.get("/viz/crois-entreprises-par-zone")
async def viz_crois_ent_zone(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT z.nom_zone as label, COUNT(ze.id) as valeur
        FROM zones z LEFT JOIN zone_entreprises ze ON ze.zone_id = z.id
        WHERE z.is_deleted=FALSE
        GROUP BY z.nom_zone ORDER BY valeur DESC
    """)

@router.get("/viz/crois-region")
async def viz_crois_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT r.nom as label,
               COUNT(DISTINCT e.id) as valeur,
               COUNT(DISTINCT z.id) as zones,
               COUNT(DISTINCT pt.id) as poles
        FROM ref_regions r
        LEFT JOIN entreprises_installees e ON e.region_id = r.id AND e.is_deleted=FALSE
        LEFT JOIN zones z ON z.region_id = r.id AND z.is_deleted=FALSE
        LEFT JOIN poles_territoires pt ON pt.region_id = r.id
        GROUP BY r.nom
        HAVING COUNT(DISTINCT e.id) > 0 OR COUNT(DISTINCT z.id) > 0 OR COUNT(DISTINCT pt.id) > 0
        ORDER BY valeur DESC
    """)

@router.get("/viz/crois-secteur-zone")
async def viz_crois_secteur_zone(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT s.nom as label, z.type_zone as groupe, COUNT(DISTINCT ze.entreprise_id) as valeur
        FROM zone_entreprises ze
        JOIN zones z ON z.id = ze.zone_id AND z.is_deleted=FALSE
        JOIN entreprises_installees e ON e.id = ze.entreprise_id AND e.is_deleted=FALSE
        JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        JOIN ref_secteurs s ON s.id = sid
        GROUP BY s.nom, z.type_zone ORDER BY valeur DESC
    """)
