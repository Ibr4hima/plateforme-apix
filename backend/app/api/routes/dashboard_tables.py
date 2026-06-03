from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter(prefix="/dashboard/tables", tags=["dashboard-tables"])

def rows(r):
    keys = list(r.keys())
    return [dict(zip(keys, row)) for row in r.fetchall()]

async def safe(db, query):
    try:
        r = await db.execute(text(query))
        return rows(r)
    except Exception as e:
        print(f"Table query error: {e}")
        return []

# ── 1. Entreprises par région avec % du total ─────────────────────────────────
@router.get("/entreprises-par-region")
async def t_ent_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH total AS (
            SELECT COUNT(*) AS n FROM entreprises_installees WHERE is_deleted=FALSE
        )
        SELECT
            r.nom                                                       AS "Région",
            COUNT(e.id)                                                 AS "Nb entreprises",
            ROUND(COUNT(e.id)::numeric / NULLIF(t.n,0) * 100, 1)       AS "% du total",
            RANK() OVER (ORDER BY COUNT(e.id) DESC)                     AS "Rang"
        FROM ref_regions r
        LEFT JOIN entreprises_installees e ON e.region_id = r.id AND e.is_deleted=FALSE
        CROSS JOIN total t
        GROUP BY r.nom, t.n
        ORDER BY "Nb entreprises" DESC
    """)

# ── 2. Top départements par concentration ─────────────────────────────────────
@router.get("/top-departements")
async def t_top_dept(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH dept_counts AS (
            SELECT
                d.nom                   AS departement,
                r.nom                   AS region,
                COUNT(e.id)             AS nb_entreprises,
                SUM(COUNT(e.id)) OVER() AS total_global
            FROM ref_departements d
            JOIN ref_regions r ON r.id = d.region_id
            LEFT JOIN entreprises_installees e
                ON e.departement_id = d.id AND e.is_deleted=FALSE
            GROUP BY d.nom, r.nom
        )
        SELECT
            departement                                                         AS "Département",
            region                                                              AS "Région",
            nb_entreprises                                                      AS "Nb entreprises",
            ROUND(nb_entreprises::numeric / NULLIF(total_global,0) * 100, 2)   AS "% du total",
            RANK() OVER (ORDER BY nb_entreprises DESC)                          AS "Rang"
        FROM dept_counts
        WHERE nb_entreprises > 0
        ORDER BY nb_entreprises DESC
        LIMIT 20
    """)

# ── 3. Hiérarchie secteur → branche → activité ───────────────────────────────
@router.get("/hierarchie-sectorielle")
async def t_hierarchie(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            s.nom                           AS "Secteur",
            b.nom                           AS "Branche",
            a.nom                           AS "Activité",
            COUNT(DISTINCT e.id)            AS "Nb entreprises",
            ROUND(
                COUNT(DISTINCT e.id)::numeric /
                NULLIF(SUM(COUNT(DISTINCT e.id)) OVER (PARTITION BY s.nom), 0) * 100
            , 1)                            AS "% dans le secteur"
        FROM entreprises_installees e
        JOIN LATERAL unnest(e.secteur_ids)  sid ON TRUE
        JOIN LATERAL unnest(e.branche_ids)  bid ON TRUE
        JOIN LATERAL unnest(e.activite_ids) aid ON TRUE
        JOIN ref_secteurs  s ON s.id = sid
        JOIN ref_branches  b ON b.id = bid
        JOIN ref_activites a ON a.id = aid
        WHERE e.is_deleted=FALSE
          AND array_length(e.secteur_ids,1)  > 0
          AND array_length(e.branche_ids,1)  > 0
          AND array_length(e.activite_ids,1) > 0
        GROUP BY s.nom, b.nom, a.nom
        ORDER BY s.nom, "Nb entreprises" DESC
    """)

# ── 4. Entreprises par pays d'origine ────────────────────────────────────────
@router.get("/entreprises-par-pays")
async def t_ent_pays(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH base AS (
            SELECT
                COALESCE(p.nom_fr, 'Non renseigné')     AS pays,
                COALESCE(p.continent, 'Non renseigné')  AS continent,
                COUNT(e.id)                             AS nb_entreprises
            FROM entreprises_installees e
            LEFT JOIN ref_pays p ON p.id = e.siege_pays_id
            WHERE e.is_deleted=FALSE
            GROUP BY p.nom_fr, p.continent
        )
        SELECT
            pays                                                                AS "Pays d'origine",
            continent                                                           AS "Continent",
            nb_entreprises                                                      AS "Nb entreprises",
            ROUND(nb_entreprises::numeric / SUM(nb_entreprises) OVER() * 100, 1) AS "% du total",
            RANK() OVER (ORDER BY nb_entreprises DESC)                          AS "Rang"
        FROM base
        ORDER BY nb_entreprises DESC
    """)

# ── 5. Évolution des créations par année + cumul ──────────────────────────────
@router.get("/evolution-creations")
async def t_evolution(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH par_annee AS (
            SELECT
                EXTRACT(YEAR FROM date_creation)::int   AS annee,
                COUNT(*)                                AS nb_creations
            FROM entreprises_installees
            WHERE is_deleted=FALSE AND date_creation IS NOT NULL
              AND EXTRACT(YEAR FROM date_creation) >= 1990
            GROUP BY annee
        )
        SELECT
            annee                                                               AS "Année",
            nb_creations                                                        AS "Créations",
            SUM(nb_creations) OVER (ORDER BY annee)                             AS "Cumul",
            nb_creations - LAG(nb_creations,1,0) OVER (ORDER BY annee)          AS "Variation",
            CASE
                WHEN LAG(nb_creations) OVER (ORDER BY annee) > 0
                THEN ROUND(
                    (nb_creations - LAG(nb_creations) OVER (ORDER BY annee))::numeric
                    / LAG(nb_creations) OVER (ORDER BY annee) * 100, 1)
                ELSE NULL
            END                                                                 AS "Évolution %"
        FROM par_annee
        ORDER BY annee
    """)

# ── 6. Entreprises multi-secteurs ─────────────────────────────────────────────
@router.get("/entreprises-multi-secteurs")
async def t_multi_secteurs(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            e.nom                                       AS "Entreprise",
            COALESCE(r.nom, 'Non renseignée')           AS "Région",
            array_length(e.secteur_ids, 1)              AS "Nb secteurs",
            array_length(e.branche_ids, 1)              AS "Nb branches",
            array_length(e.activite_ids, 1)             AS "Nb activités",
            COALESCE(e.forme_juridique, 'N/A')          AS "Forme juridique",
            EXTRACT(YEAR FROM e.date_creation)::int     AS "Année création"
        FROM entreprises_installees e
        LEFT JOIN ref_regions r ON r.id = e.region_id
        WHERE e.is_deleted=FALSE
          AND array_length(e.secteur_ids, 1) > 1
        ORDER BY "Nb secteurs" DESC, "Nb branches" DESC
        LIMIT 50
    """)

# ── 7. Détail des zones ───────────────────────────────────────────────────────
@router.get("/zones-detail")
async def t_zones_detail(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            z.nom_zone                                                  AS "Zone",
            z.type_zone                                                 AS "Type",
            COALESCE(r.nom, 'Non renseignée')                           AS "Région",
            COALESCE(dept.nom, 'N/A')                                   AS "Département",
            COALESCE(pt.pole_territoire, 'Aucun')                       AS "Pôle",
            COALESCE(z.superficie::text, 'N/A')                         AS "Superficie (ha)",
            COUNT(ze.id)                                                AS "Total entreprises",
            COUNT(ze.id) FILTER (WHERE ze.statut='installee')           AS "Installées",
            COUNT(ze.id) FILTER (WHERE ze.statut='eligible')            AS "Éligibles"
        FROM zones z
        LEFT JOIN ref_regions r          ON r.id    = z.region_id
        LEFT JOIN ref_departements dept  ON dept.id = z.departement_id
        LEFT JOIN poles_territoires pt   ON pt.id   = z.pole_id
        LEFT JOIN zone_entreprises ze    ON ze.zone_id = z.id
        WHERE z.is_deleted=FALSE
        GROUP BY z.id, z.nom_zone, z.type_zone, r.nom, dept.nom, pt.pole_territoire, z.superficie
        ORDER BY z.type_zone, "Total entreprises" DESC
    """)

# ── 8. Taux d'occupation des zones ────────────────────────────────────────────
@router.get("/taux-occupation-zones")
async def t_taux_occupation(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH zone_stats AS (
            SELECT
                z.id, z.nom_zone, z.type_zone,
                COUNT(ze.id)                                            AS total,
                COUNT(ze.id) FILTER (WHERE ze.statut='installee')       AS installees,
                COUNT(ze.id) FILTER (WHERE ze.statut='eligible')        AS eligibles
            FROM zones z
            LEFT JOIN zone_entreprises ze ON ze.zone_id = z.id
            WHERE z.is_deleted=FALSE
            GROUP BY z.id, z.nom_zone, z.type_zone
        )
        SELECT
            nom_zone                                    AS "Zone",
            type_zone                                   AS "Type",
            total                                       AS "Total entreprises",
            installees                                  AS "Installées",
            eligibles                                   AS "Éligibles",
            CASE
                WHEN total > 0
                THEN ROUND(installees::numeric / total * 100, 1)
                ELSE 0
            END                                         AS "Taux occupation %",
            CASE
                WHEN total = 0          THEN 'Vide'
                WHEN installees = total THEN 'Pleine'
                WHEN installees > 0     THEN 'Partielle'
                ELSE 'En attente'
            END                                         AS "Statut"
        FROM zone_stats
        ORDER BY "Taux occupation %" DESC, total DESC
    """)

# ── 9. Pôles avec zones et entreprises ───────────────────────────────────────
@router.get("/poles-detail")
async def t_poles_detail(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            pt.pole_territoire                                          AS "Pôle",
            COALESCE(r.nom, 'Non renseignée')                           AS "Région",
            COUNT(DISTINCT z.id)                                        AS "Nb zones",
            COALESCE(STRING_AGG(DISTINCT z.type_zone, ', '
                ORDER BY z.type_zone), 'Aucune')                        AS "Types de zones",
            COUNT(DISTINCT ze.entreprise_id)                            AS "Nb entreprises",
            COALESCE(SUM(DISTINCT z.superficie), 0)::float              AS "Superficie totale (ha)"
        FROM poles_territoires pt
        -- poles_territoires.region_ids est un ARRAY → on prend la 1ère région
        LEFT JOIN ref_regions r ON r.id = (pt.region_ids[1])
        LEFT JOIN zones z       ON z.pole_id = pt.id AND z.is_deleted=FALSE
        LEFT JOIN zone_entreprises ze ON ze.zone_id = z.id
        GROUP BY pt.id, pt.pole_territoire, r.nom
        ORDER BY "Nb entreprises" DESC, "Nb zones" DESC
    """)

# ── 10. Zones sans entreprises ────────────────────────────────────────────────
@router.get("/zones-vides")
async def t_zones_vides(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            z.nom_zone                                  AS "Zone",
            z.type_zone                                 AS "Type",
            COALESCE(r.nom, 'Non renseignée')           AS "Région",
            COALESCE(pt.pole_territoire, 'Aucun')       AS "Pôle",
            COALESCE(z.superficie::text, 'N/A')         AS "Superficie (ha)"
        FROM zones z
        LEFT JOIN ref_regions r        ON r.id  = z.region_id
        LEFT JOIN poles_territoires pt ON pt.id = z.pole_id
        WHERE z.is_deleted=FALSE
          AND NOT EXISTS (
              SELECT 1 FROM zone_entreprises ze WHERE ze.zone_id = z.id
          )
        ORDER BY z.type_zone, z.nom_zone
    """)

# ── 11. Vue région consolidée ─────────────────────────────────────────────────
@router.get("/vue-region")
async def t_vue_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            r.nom                                               AS "Région",
            COUNT(DISTINCT e.id)                                AS "Entreprises",
            COUNT(DISTINCT z.id)                                AS "Zones",
            COUNT(DISTINCT pt.id)                               AS "Pôles",
            COALESCE(SUM(DISTINCT z.superficie), 0)::float      AS "Superficie zones (ha)",
            RANK() OVER (ORDER BY COUNT(DISTINCT e.id) DESC)    AS "Rang attractivité"
        FROM ref_regions r
        LEFT JOIN entreprises_installees e  ON e.region_id = r.id AND e.is_deleted=FALSE
        LEFT JOIN zones z                   ON z.region_id = r.id AND z.is_deleted=FALSE
        LEFT JOIN poles_territoires pt      ON r.id = ANY(pt.region_ids)
        GROUP BY r.nom
        ORDER BY "Entreprises" DESC
    """)

# ── 12. Secteurs dominants par région ─────────────────────────────────────────
@router.get("/secteurs-par-region")
async def t_secteurs_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH sect_region AS (
            SELECT
                r.nom                   AS region,
                s.nom                   AS secteur,
                COUNT(DISTINCT e.id)    AS nb,
                RANK() OVER (
                    PARTITION BY r.nom
                    ORDER BY COUNT(DISTINCT e.id) DESC
                ) AS rang_dans_region
            FROM entreprises_installees e
            JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
            JOIN ref_secteurs s ON s.id = sid
            JOIN ref_regions r  ON r.id = e.region_id
            WHERE e.is_deleted=FALSE AND array_length(e.secteur_ids,1) > 0
            GROUP BY r.nom, s.nom
        )
        SELECT
            region              AS "Région",
            secteur             AS "Secteur dominant",
            nb                  AS "Nb entreprises",
            rang_dans_region    AS "Rang dans la région"
        FROM sect_region
        WHERE rang_dans_region <= 3
        ORDER BY region, rang_dans_region
    """)

# ── 13. Entreprises locales vs étrangères par région ─────────────────────────
@router.get("/local-vs-etranger")
async def t_local_etranger(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH sn_id AS (
            SELECT id FROM ref_pays WHERE code_iso2 = 'SN' LIMIT 1
        )
        SELECT
            COALESCE(r.nom, 'Non renseignée')                               AS "Région",
            COUNT(e.id)                                                     AS "Total",
            COUNT(e.id) FILTER (WHERE e.siege_pays_id = (SELECT id FROM sn_id))
                                                                            AS "Siège Sénégal",
            COUNT(e.id) FILTER (
                WHERE e.siege_pays_id IS NOT NULL
                  AND e.siege_pays_id != (SELECT id FROM sn_id)
            )                                                               AS "Siège étranger",
            COUNT(e.id) FILTER (WHERE e.siege_pays_id IS NULL)              AS "Pays non renseigné"
        FROM entreprises_installees e
        LEFT JOIN ref_regions r ON r.id = e.region_id
        WHERE e.is_deleted=FALSE
        GROUP BY r.nom
        ORDER BY "Total" DESC
    """)


# ── 15. Score d'attractivité par région ───────────────────────────────────────
@router.get("/score-attractivite")
async def t_attractivite(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH stats AS (
            SELECT
                r.nom,
                COUNT(DISTINCT e.id)            AS nb_ent,
                COUNT(DISTINCT z.id)            AS nb_zones,
                COUNT(DISTINCT pt.id)           AS nb_poles,
                COALESCE(SUM(DISTINCT z.superficie), 0) AS superficie
            FROM ref_regions r
            LEFT JOIN entreprises_installees e  ON e.region_id = r.id AND e.is_deleted=FALSE
            LEFT JOIN zones z                   ON z.region_id = r.id AND z.is_deleted=FALSE
            LEFT JOIN poles_territoires pt      ON r.id = ANY(pt.region_ids)
            GROUP BY r.nom
        ),
        maxs AS (
            SELECT
                NULLIF(MAX(nb_ent),0)    AS max_ent,
                NULLIF(MAX(nb_zones),0)  AS max_zones,
                NULLIF(MAX(nb_poles),0)  AS max_poles
            FROM stats
        )
        SELECT
            s.nom                               AS "Région",
            s.nb_ent                            AS "Entreprises",
            s.nb_zones                          AS "Zones",
            s.nb_poles                          AS "Pôles",
            s.superficie::float                 AS "Superficie zones (ha)",
            ROUND((
                COALESCE(s.nb_ent::numeric   / m.max_ent,   0) * 0.5 +
                COALESCE(s.nb_zones::numeric / m.max_zones, 0) * 0.3 +
                COALESCE(s.nb_poles::numeric / m.max_poles, 0) * 0.2
            ) * 100, 1)                         AS "Score attractivité /100",
            RANK() OVER (ORDER BY (
                COALESCE(s.nb_ent::numeric   / NULLIF(m.max_ent,0),   0) * 0.5 +
                COALESCE(s.nb_zones::numeric / NULLIF(m.max_zones,0), 0) * 0.3 +
                COALESCE(s.nb_poles::numeric / NULLIF(m.max_poles,0), 0) * 0.2
            ) DESC)                             AS "Rang"
        FROM stats s CROSS JOIN maxs m
        ORDER BY "Rang"
    """)

# ── 16. Concentration sectorielle (HHI) ───────────────────────────────────────
@router.get("/concentration-sectorielle")
async def t_concentration(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH sect_region AS (
            SELECT
                r.nom AS region,
                s.nom AS secteur,
                COUNT(DISTINCT e.id) AS nb
            FROM entreprises_installees e
            JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
            JOIN ref_secteurs s ON s.id = sid
            JOIN ref_regions r  ON r.id = e.region_id
            WHERE e.is_deleted=FALSE AND array_length(e.secteur_ids,1) > 0
            GROUP BY r.nom, s.nom
        ),
        totaux AS (
            SELECT region, SUM(nb) AS total, COUNT(DISTINCT secteur) AS nb_secteurs
            FROM sect_region GROUP BY region
        ),
        herfindahl AS (
            SELECT
                sr.region,
                t.total,
                t.nb_secteurs,
                ROUND(SUM((sr.nb::numeric / NULLIF(t.total,0))^2), 4) AS indice_hhi
            FROM sect_region sr
            JOIN totaux t ON t.region = sr.region
            GROUP BY sr.region, t.total, t.nb_secteurs
        )
        SELECT
            region              AS "Région",
            total               AS "Total entreprises",
            nb_secteurs         AS "Nb secteurs actifs",
            indice_hhi          AS "Indice HHI",
            CASE
                WHEN indice_hhi > 0.25 THEN 'Très concentrée'
                WHEN indice_hhi > 0.15 THEN 'Concentrée'
                WHEN indice_hhi > 0.10 THEN 'Modérée'
                ELSE 'Diversifiée'
            END                 AS "Niveau de concentration"
        FROM herfindahl
        ORDER BY indice_hhi DESC
    """)

# ── 17. Entreprises par période de création ───────────────────────────────────
@router.get("/avant-apres-pivot")
async def t_pivot(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH pivot AS (
            SELECT
                r.nom AS region,
                COUNT(e.id) FILTER (
                    WHERE EXTRACT(YEAR FROM e.date_creation) < 2010
                )   AS avant_2010,
                COUNT(e.id) FILTER (
                    WHERE EXTRACT(YEAR FROM e.date_creation) BETWEEN 2010 AND 2019
                )   AS de_2010_a_2019,
                COUNT(e.id) FILTER (
                    WHERE EXTRACT(YEAR FROM e.date_creation) >= 2020
                )   AS depuis_2020,
                COUNT(e.id) FILTER (
                    WHERE e.date_creation IS NULL
                )   AS date_inconnue
            FROM entreprises_installees e
            LEFT JOIN ref_regions r ON r.id = e.region_id
            WHERE e.is_deleted=FALSE
            GROUP BY r.nom
        )
        SELECT
            COALESCE(region, 'Non renseignée')  AS "Région",
            avant_2010                          AS "Avant 2010",
            de_2010_a_2019                      AS "2010 – 2019",
            depuis_2020                         AS "Depuis 2020",
            date_inconnue                       AS "Date inconnue",
            (avant_2010 + de_2010_a_2019 + depuis_2020 + date_inconnue) AS "Total"
        FROM pivot
        ORDER BY "Total" DESC
    """)

# ── 18. Densité des zones ─────────────────────────────────────────────────────
@router.get("/densite-zones")
async def t_densite(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH densite AS (
            SELECT
                z.nom_zone,
                z.type_zone,
                COALESCE(r.nom, 'N/A')          AS region,
                COALESCE(z.superficie, 0)        AS superficie,
                COUNT(ze.id)                     AS nb_entreprises,
                CASE
                    WHEN COALESCE(z.superficie,0) > 0
                    THEN ROUND(COUNT(ze.id)::numeric / z.superficie * 100, 4)
                    ELSE NULL
                END AS densite_pour_100ha
            FROM zones z
            LEFT JOIN ref_regions r ON r.id = z.region_id
            LEFT JOIN zone_entreprises ze ON ze.zone_id = z.id
            WHERE z.is_deleted=FALSE
            GROUP BY z.id, z.nom_zone, z.type_zone, r.nom, z.superficie
        )
        SELECT
            nom_zone                                                    AS "Zone",
            type_zone                                                   AS "Type",
            region                                                      AS "Région",
            superficie                                                  AS "Superficie (ha)",
            nb_entreprises                                              AS "Nb entreprises",
            COALESCE(densite_pour_100ha::text, 'N/A')                   AS "Densité (ent./100ha)",
            RANK() OVER (ORDER BY nb_entreprises DESC)                  AS "Rang densité"
        FROM densite
        ORDER BY nb_entreprises DESC
    """)

# ── 19. Pôles sans zones associées ───────────────────────────────────────────
@router.get("/poles-sans-zones")
async def t_poles_vides(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            pt.pole_territoire                  AS "Pôle",
            COALESCE(r.nom, 'Non renseignée')   AS "Région"
        FROM poles_territoires pt
        LEFT JOIN ref_regions r ON r.id = (pt.region_ids[1])
        WHERE NOT EXISTS (
            SELECT 1 FROM zones z
            WHERE z.pole_id = pt.id AND z.is_deleted=FALSE
        )
        ORDER BY r.nom, pt.pole_territoire
    """)

# ══════════════════════════════════════════════════════════════════════════════
# NOUVELLES REQUÊTES ANALYTIQUES
# ══════════════════════════════════════════════════════════════════════════════

# ── 20. Entreprises par arrondissement (top 20) ───────────────────────────────
@router.get("/entreprises-par-arrondissement")
async def t_ent_arrondissement(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH total AS (SELECT COUNT(*) AS n FROM entreprises_installees WHERE is_deleted=FALSE)
        SELECT
            a.nom                                                           AS "Arrondissement",
            d.nom                                                           AS "Département",
            r.nom                                                           AS "Région",
            COUNT(e.id)                                                     AS "Nb entreprises",
            ROUND(COUNT(e.id)::numeric / NULLIF(t.n,0) * 100, 2)           AS "% du total",
            RANK() OVER (ORDER BY COUNT(e.id) DESC)                         AS "Rang"
        FROM ref_arrondissements a
        JOIN ref_departements d  ON d.id = a.departement_id
        JOIN ref_regions r       ON r.id = d.region_id
        LEFT JOIN entreprises_installees e ON e.arrondissement_id = a.id AND e.is_deleted=FALSE
        CROSS JOIN total t
        GROUP BY a.nom, d.nom, r.nom, t.n
        HAVING COUNT(e.id) > 0
        ORDER BY "Nb entreprises" DESC
        LIMIT 20
    """)


# ── 22. Ancienneté des entreprises par région ─────────────────────────────────
@router.get("/anciennete-entreprises")
async def t_anciennete(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH ages AS (
            SELECT
                e.id,
                r.nom AS region,
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.date_creation))::int AS age_annees
            FROM entreprises_installees e
            LEFT JOIN ref_regions r ON r.id = e.region_id
            WHERE e.is_deleted=FALSE AND e.date_creation IS NOT NULL
        )
        SELECT
            COALESCE(region, 'Non renseignée')                  AS "Région",
            COUNT(*)                                            AS "Nb entreprises",
            ROUND(AVG(age_annees), 1)                           AS "Âge moyen (ans)",
            MIN(age_annees)                                     AS "Plus récente (ans)",
            MAX(age_annees)                                     AS "Plus ancienne (ans)",
            COUNT(*) FILTER (WHERE age_annees <= 5)             AS "≤ 5 ans",
            COUNT(*) FILTER (WHERE age_annees BETWEEN 6 AND 10) AS "6–10 ans",
            COUNT(*) FILTER (WHERE age_annees BETWEEN 11 AND 20)AS "11–20 ans",
            COUNT(*) FILTER (WHERE age_annees > 20)             AS "> 20 ans"
        FROM ages
        GROUP BY region
        ORDER BY "Âge moyen (ans)" DESC
    """)

# ── 23. Projets par région, secteur et statut ─────────────────────────────────
@router.get("/projets-detail")
async def t_projets(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            p.titre_projet                                          AS "Projet",
            COALESCE(r.nom, 'Non renseignée')                       AS "Région",
            COALESCE(d.nom, 'N/A')                                  AS "Département",
            COALESCE(pt.pole_territoire, 'Aucun')                   AS "Pôle",
            s.nom                                                   AS "Secteur principal",
            COALESCE(dev.code_iso, 'XOF')                           AS "Devise",
            CASE
                WHEN p.investissement_est_intervalle = TRUE
                THEN p.investissement_min::text || ' – ' || p.investissement_max::text
                ELSE COALESCE(p.investissement::text, 'N/A')
            END                                                     AS "Investissement",
            COALESCE(p.porteur_projet, 'N/A')                       AS "Porteur",
            EXTRACT(YEAR FROM p.date_attribution)::int              AS "Année attribution",
            EXTRACT(YEAR FROM p.date_fin_prevue)::int               AS "Année fin prévue",
            CASE
                WHEN p.date_fin_prevue < CURRENT_DATE THEN 'Terminé'
                WHEN p.date_attribution IS NULL        THEN 'Non démarré'
                ELSE 'En cours'
            END                                                     AS "Statut"
        FROM projets p
        LEFT JOIN ref_regions r       ON r.id = p.region_id
        LEFT JOIN ref_departements d  ON d.id = p.departement_id
        LEFT JOIN poles_territoires pt ON pt.id = p.pole_id
        LEFT JOIN ref_devises dev     ON dev.id = p.devise_id
        LEFT JOIN LATERAL (
            SELECT s2.nom FROM unnest(p.secteur_ids) sid
            JOIN ref_secteurs s2 ON s2.id = sid LIMIT 1
        ) s ON TRUE
        WHERE p.is_deleted=FALSE
        ORDER BY p.date_attribution DESC NULLS LAST
    """)


# ── 25. Pays les plus représentés dans chaque région ──────────────────────────
@router.get("/pays-par-region")
async def t_pays_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH pays_region AS (
            SELECT
                r.nom                   AS region,
                p.nom_fr                AS pays,
                p.continent             AS continent,
                COUNT(e.id)             AS nb,
                RANK() OVER (
                    PARTITION BY r.nom
                    ORDER BY COUNT(e.id) DESC
                ) AS rang
            FROM entreprises_installees e
            JOIN ref_regions r ON r.id = e.region_id
            JOIN ref_pays p    ON p.id = e.siege_pays_id
            WHERE e.is_deleted=FALSE AND e.siege_pays_id IS NOT NULL
            GROUP BY r.nom, p.nom_fr, p.continent
        )
        SELECT
            region      AS "Région",
            pays        AS "Pays dominant",
            continent   AS "Continent",
            nb          AS "Nb entreprises",
            rang        AS "Rang dans la région"
        FROM pays_region
        WHERE rang <= 3
        ORDER BY region, rang
    """)


# ── 27. Diversité des investisseurs par zone ──────────────────────────────────
@router.get("/diversite-investisseurs-zones")
async def t_diversite_zones(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            z.nom_zone                                          AS "Zone",
            z.type_zone                                         AS "Type",
            COUNT(DISTINCT ze.entreprise_id)                    AS "Total entreprises",
            COUNT(DISTINCT p.nom_fr)                            AS "Nb pays représentés",
            COUNT(DISTINCT p.continent)                         AS "Nb continents",
            STRING_AGG(DISTINCT p.continent, ', '
                ORDER BY p.continent)                           AS "Continents",
            COUNT(DISTINCT s.nom)                               AS "Nb secteurs",
            STRING_AGG(DISTINCT s.nom, ', '
                ORDER BY s.nom)                                 AS "Secteurs présents"
        FROM zones z
        LEFT JOIN zone_entreprises ze   ON ze.zone_id = z.id
        LEFT JOIN entreprises_installees e ON e.id = ze.entreprise_id AND e.is_deleted=FALSE
        LEFT JOIN ref_pays p            ON p.id = e.siege_pays_id
        LEFT JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        LEFT JOIN ref_secteurs s        ON s.id = sid
        WHERE z.is_deleted=FALSE
        GROUP BY z.id, z.nom_zone, z.type_zone
        ORDER BY "Total entreprises" DESC
    """)

# ── 28. Matrice région × type de zone ─────────────────────────────────────────
@router.get("/matrice-region-zone")
async def t_matrice_region_zone(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            r.nom                                               AS "Région",
            COUNT(z.id) FILTER (WHERE z.type_zone='ZES')       AS "ZES",
            COUNT(z.id) FILTER (WHERE z.type_zone='ZAI')       AS "ZAI",
            COUNT(z.id) FILTER (WHERE z.type_zone='ZFI')       AS "ZFI",
            COUNT(z.id) FILTER (WHERE z.type_zone NOT IN ('ZES','ZAI','ZFI') AND z.type_zone IS NOT NULL) AS "Autres",
            COUNT(z.id)                                         AS "Total zones",
            COALESCE(SUM(z.superficie), 0)::float               AS "Superficie totale (ha)",
            COUNT(DISTINCT ze.entreprise_id)                    AS "Total entreprises"
        FROM ref_regions r
        LEFT JOIN zones z             ON z.region_id = r.id AND z.is_deleted=FALSE
        LEFT JOIN zone_entreprises ze ON ze.zone_id = z.id
        GROUP BY r.nom
        HAVING COUNT(z.id) > 0
        ORDER BY "Total zones" DESC
    """)

# ── 29. Entreprises par continent d'origine ───────────────────────────────────
@router.get("/entreprises-par-continent")
async def t_ent_continent(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH base AS (
            SELECT
                COALESCE(p.continent, 'Non renseigné')  AS continent,
                COALESCE(p.region_geo, 'N/A')           AS region_geo,
                COUNT(e.id)                             AS nb
            FROM entreprises_installees e
            LEFT JOIN ref_pays p ON p.id = e.siege_pays_id
            WHERE e.is_deleted=FALSE
            GROUP BY p.continent, p.region_geo
        )
        SELECT
            continent                                               AS "Continent",
            region_geo                                              AS "Région géographique",
            nb                                                      AS "Nb entreprises",
            ROUND(nb::numeric / SUM(nb) OVER() * 100, 1)           AS "% du total",
            RANK() OVER (ORDER BY nb DESC)                          AS "Rang"
        FROM base
        ORDER BY nb DESC
    """)

# ── 30. Corrélation secteur × pays d'origine (top paires) ────────────────────
@router.get("/secteur-x-pays-origine")
async def t_secteur_pays(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            s.nom                                       AS "Secteur",
            COALESCE(p.nom_fr, 'Non renseigné')         AS "Pays d'origine",
            COALESCE(p.continent, 'N/A')                AS "Continent",
            COUNT(DISTINCT e.id)                        AS "Nb entreprises",
            RANK() OVER (
                PARTITION BY s.nom
                ORDER BY COUNT(DISTINCT e.id) DESC
            )                                           AS "Rang dans le secteur"
        FROM entreprises_installees e
        JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        JOIN ref_secteurs s ON s.id = sid
        LEFT JOIN ref_pays p ON p.id = e.siege_pays_id
        WHERE e.is_deleted=FALSE AND array_length(e.secteur_ids,1) > 0
        GROUP BY s.nom, p.nom_fr, p.continent
        HAVING COUNT(DISTINCT e.id) >= 1
        ORDER BY s.nom, "Nb entreprises" DESC
    """)


# ── 31. Entreprises dans chaque zone d'investissement (détail complet) ────────
@router.get("/entreprises-par-zone-detail")
async def t_ent_zone_detail(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            z.nom_zone                                          AS "Zone",
            z.type_zone                                         AS "Type",
            COALESCE(r.nom, 'N/A')                              AS "Région",
            ze.statut                                           AS "Statut",
            e.nom                                               AS "Entreprise",
            COALESCE(e.forme_juridique, 'N/A')                  AS "Forme juridique",
            COALESCE(pay.nom_fr, 'N/A')                         AS "Pays origine",
            EXTRACT(YEAR FROM e.date_creation)::int             AS "Année création",
            s.nom                                               AS "Secteur principal"
        FROM zone_entreprises ze
        JOIN zones z ON z.id = ze.zone_id AND z.is_deleted=FALSE
        JOIN entreprises_installees e ON e.id = ze.entreprise_id AND e.is_deleted=FALSE
        LEFT JOIN ref_regions r  ON r.id = z.region_id
        LEFT JOIN ref_pays pay   ON pay.id = e.siege_pays_id
        LEFT JOIN LATERAL (
            SELECT s2.nom FROM unnest(e.secteur_ids) sid
            JOIN ref_secteurs s2 ON s2.id = sid LIMIT 1
        ) s ON TRUE
        ORDER BY z.type_zone, z.nom_zone, ze.statut, e.nom
    """)

# ── 32. Classement zones par nb entreprises avec rang ─────────────────────────
@router.get("/classement-zones-entreprises")
async def t_classement_zones(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            z.nom_zone                                              AS "Zone",
            z.type_zone                                             AS "Type",
            COALESCE(r.nom, 'N/A')                                  AS "Région",
            COUNT(ze.id)                                            AS "Total entreprises",
            COUNT(ze.id) FILTER (WHERE ze.statut='installee')       AS "Installées",
            COUNT(ze.id) FILTER (WHERE ze.statut='eligible')        AS "Éligibles",
            ROUND(COUNT(ze.id)::numeric /
                NULLIF(SUM(COUNT(ze.id)) OVER(), 0) * 100, 1)      AS "% du total",
            RANK() OVER (ORDER BY COUNT(ze.id) DESC)                AS "Rang général",
            RANK() OVER (PARTITION BY z.type_zone
                ORDER BY COUNT(ze.id) DESC)                         AS "Rang dans le type"
        FROM zones z
        LEFT JOIN ref_regions r       ON r.id = z.region_id
        LEFT JOIN zone_entreprises ze ON ze.zone_id = z.id
        WHERE z.is_deleted=FALSE
        GROUP BY z.id, z.nom_zone, z.type_zone, r.nom
        ORDER BY "Total entreprises" DESC
    """)

# ── 33. Classement régions × entreprises × zones × pôles (détail rang) ────────
@router.get("/classement-regions-complet")
async def t_classement_regions(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH stats AS (
            SELECT
                r.nom                               AS region,
                COUNT(DISTINCT e.id)                AS nb_ent,
                COUNT(DISTINCT z.id)                AS nb_zones,
                COUNT(DISTINCT pt.id)               AS nb_poles,
                COUNT(DISTINCT d.id)                AS nb_depts,
                COUNT(DISTINCT a.id)                AS nb_arr
            FROM ref_regions r
            LEFT JOIN entreprises_installees e ON e.region_id = r.id AND e.is_deleted=FALSE
            LEFT JOIN zones z                  ON z.region_id = r.id AND z.is_deleted=FALSE
            LEFT JOIN poles_territoires pt     ON r.id = ANY(pt.region_ids)
            LEFT JOIN ref_departements d       ON d.region_id = r.id
            LEFT JOIN ref_arrondissements a    ON a.departement_id = d.id
            GROUP BY r.nom
        )
        SELECT
            region                                                  AS "Région",
            nb_ent                                                  AS "Entreprises",
            nb_zones                                                AS "Zones invest.",
            nb_poles                                                AS "Pôles territ.",
            nb_depts                                                AS "Départements",
            nb_arr                                                  AS "Arrondissements",
            RANK() OVER (ORDER BY nb_ent DESC)                      AS "Rang entreprises",
            RANK() OVER (ORDER BY nb_zones DESC)                    AS "Rang zones",
            RANK() OVER (ORDER BY nb_poles DESC)                    AS "Rang pôles",
            ROUND(nb_ent::numeric / NULLIF(nb_depts,0), 1)          AS "Ent./département"
        FROM stats
        ORDER BY "Rang entreprises"
    """)

# ── 34. Entreprises par département avec rang dans la région ──────────────────
@router.get("/classement-departements-complet")
async def t_classement_depts(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH dept_stats AS (
            SELECT
                d.nom                           AS departement,
                r.nom                           AS region,
                COUNT(DISTINCT e.id)            AS nb_ent,
                COUNT(DISTINCT arr.id)          AS nb_arr
            FROM ref_departements d
            JOIN ref_regions r ON r.id = d.region_id
            LEFT JOIN entreprises_installees e ON e.departement_id = d.id AND e.is_deleted=FALSE
            LEFT JOIN ref_arrondissements arr ON arr.departement_id = d.id
            GROUP BY d.nom, r.nom
        )
        SELECT
            departement                                                     AS "Département",
            region                                                          AS "Région",
            nb_ent                                                          AS "Nb entreprises",
            nb_arr                                                          AS "Nb arrondissements",
            ROUND(nb_ent::numeric / NULLIF(nb_arr,0), 1)                   AS "Ent./arrondissement",
            RANK() OVER (ORDER BY nb_ent DESC)                              AS "Rang national",
            RANK() OVER (PARTITION BY region ORDER BY nb_ent DESC)          AS "Rang régional",
            ROUND(nb_ent::numeric /
                NULLIF(SUM(nb_ent) OVER (PARTITION BY region), 0) * 100, 1) AS "% dans la région"
        FROM dept_stats
        ORDER BY nb_ent DESC
    """)

# ── 35. Entreprises par arrondissement avec rang département + région ──────────
@router.get("/classement-arrondissements-complet")
async def t_classement_arr(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH arr_stats AS (
            SELECT
                a.nom                           AS arrondissement,
                d.nom                           AS departement,
                r.nom                           AS region,
                COUNT(e.id)                     AS nb_ent
            FROM ref_arrondissements a
            JOIN ref_departements d ON d.id = a.departement_id
            JOIN ref_regions r      ON r.id = d.region_id
            LEFT JOIN entreprises_installees e ON e.arrondissement_id = a.id AND e.is_deleted=FALSE
            GROUP BY a.nom, d.nom, r.nom
        )
        SELECT
            arrondissement                                                      AS "Arrondissement",
            departement                                                         AS "Département",
            region                                                              AS "Région",
            nb_ent                                                              AS "Nb entreprises",
            RANK() OVER (ORDER BY nb_ent DESC)                                  AS "Rang national",
            RANK() OVER (PARTITION BY departement ORDER BY nb_ent DESC)         AS "Rang dép.",
            RANK() OVER (PARTITION BY region ORDER BY nb_ent DESC)              AS "Rang région",
            ROUND(nb_ent::numeric /
                NULLIF(SUM(nb_ent) OVER (PARTITION BY departement), 0) * 100, 1) AS "% dans le dép."
        FROM arr_stats
        WHERE nb_ent > 0
        ORDER BY nb_ent DESC
    """)

# ── 36. Secteurs où on investit le plus (par nb entreprises) ──────────────────
@router.get("/secteurs-investissement-classement")
async def t_secteurs_invest(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH sect AS (
            SELECT
                s.nom                           AS secteur,
                s.code                          AS code,
                COUNT(DISTINCT e.id)            AS nb_ent,
                COUNT(DISTINCT b.id)            AS nb_branches,
                COUNT(DISTINCT a.id)            AS nb_activites
            FROM ref_secteurs s
            LEFT JOIN ref_branches b  ON b.secteur_id = s.id
            LEFT JOIN ref_activites a ON a.branche_id = b.id
            LEFT JOIN LATERAL unnest(
                (SELECT secteur_ids FROM entreprises_installees
                 WHERE id=id AND is_deleted=FALSE LIMIT 1)
            ) sid ON TRUE
            LEFT JOIN entreprises_installees e ON s.id = ANY(e.secteur_ids) AND e.is_deleted=FALSE
            GROUP BY s.nom, s.code
        )
        SELECT
            code                                                    AS "Code",
            secteur                                                 AS "Secteur",
            nb_ent                                                  AS "Nb entreprises",
            nb_branches                                             AS "Nb branches",
            nb_activites                                            AS "Nb activités",
            ROUND(nb_ent::numeric /
                NULLIF(SUM(nb_ent) OVER(), 0) * 100, 1)            AS "% du total",
            RANK() OVER (ORDER BY nb_ent DESC)                      AS "Rang"
        FROM sect
        ORDER BY nb_ent DESC
    """)

# ── 37. Branches les plus actives (toutes branches) ───────────────────────────
@router.get("/branches-classement")
async def t_branches(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            s.nom                                                   AS "Secteur",
            b.code                                                  AS "Code branche",
            b.nom                                                   AS "Branche",
            COUNT(DISTINCT e.id)                                    AS "Nb entreprises",
            ROUND(COUNT(DISTINCT e.id)::numeric /
                NULLIF(SUM(COUNT(DISTINCT e.id)) OVER(), 0) * 100, 2) AS "% du total",
            RANK() OVER (ORDER BY COUNT(DISTINCT e.id) DESC)        AS "Rang national",
            RANK() OVER (PARTITION BY s.nom
                ORDER BY COUNT(DISTINCT e.id) DESC)                 AS "Rang dans secteur"
        FROM ref_branches b
        JOIN ref_secteurs s ON s.id = b.secteur_id
        LEFT JOIN entreprises_installees e
            ON b.id = ANY(e.branche_ids) AND e.is_deleted=FALSE
        GROUP BY s.nom, b.code, b.nom
        HAVING COUNT(DISTINCT e.id) > 0
        ORDER BY "Nb entreprises" DESC
    """)

# ── 38. Activités les plus représentées (classement national) ─────────────────
@router.get("/activites-classement-national")
async def t_activites_national(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            s.nom                                                   AS "Secteur",
            b.nom                                                   AS "Branche",
            a.code                                                  AS "Code activité",
            a.nom                                                   AS "Activité",
            COUNT(DISTINCT e.id)                                    AS "Nb entreprises",
            ROUND(COUNT(DISTINCT e.id)::numeric /
                NULLIF(SUM(COUNT(DISTINCT e.id)) OVER(), 0) * 100, 2) AS "% du total",
            RANK() OVER (ORDER BY COUNT(DISTINCT e.id) DESC)        AS "Rang national",
            RANK() OVER (PARTITION BY s.nom
                ORDER BY COUNT(DISTINCT e.id) DESC)                 AS "Rang dans secteur"
        FROM ref_activites a
        JOIN ref_branches b  ON b.id = a.branche_id
        JOIN ref_secteurs s  ON s.id = b.secteur_id
        LEFT JOIN entreprises_installees e
            ON a.id = ANY(e.activite_ids) AND e.is_deleted=FALSE
        GROUP BY s.nom, b.nom, a.code, a.nom
        HAVING COUNT(DISTINCT e.id) > 0
        ORDER BY "Nb entreprises" DESC
    """)

# ── 39. Répartition activités × région ───────────────────────────────────────
@router.get("/activites-par-region")
async def t_activites_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH act_reg AS (
            SELECT
                r.nom                       AS region,
                a.nom                       AS activite,
                s.nom                       AS secteur,
                COUNT(DISTINCT e.id)        AS nb,
                RANK() OVER (
                    PARTITION BY r.nom
                    ORDER BY COUNT(DISTINCT e.id) DESC
                ) AS rang
            FROM entreprises_installees e
            JOIN LATERAL unnest(e.activite_ids) aid ON TRUE
            JOIN ref_activites a ON a.id = aid
            JOIN ref_branches b  ON b.id = a.branche_id
            JOIN ref_secteurs s  ON s.id = b.secteur_id
            JOIN ref_regions r   ON r.id = e.region_id
            WHERE e.is_deleted=FALSE AND array_length(e.activite_ids,1) > 0
            GROUP BY r.nom, a.nom, s.nom
        )
        SELECT
            region      AS "Région",
            secteur     AS "Secteur",
            activite    AS "Activité",
            nb          AS "Nb entreprises",
            rang        AS "Rang dans la région"
        FROM act_reg
        WHERE rang <= 5
        ORDER BY region, rang
    """)

# ── 40. Répartition activités × département ───────────────────────────────────
@router.get("/activites-par-departement")
async def t_activites_dept(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH act_dept AS (
            SELECT
                d.nom                       AS departement,
                r.nom                       AS region,
                a.nom                       AS activite,
                COUNT(DISTINCT e.id)        AS nb,
                RANK() OVER (
                    PARTITION BY d.nom
                    ORDER BY COUNT(DISTINCT e.id) DESC
                ) AS rang
            FROM entreprises_installees e
            JOIN LATERAL unnest(e.activite_ids) aid ON TRUE
            JOIN ref_activites a    ON a.id = aid
            JOIN ref_departements d ON d.id = e.departement_id
            JOIN ref_regions r      ON r.id = d.region_id
            WHERE e.is_deleted=FALSE
              AND e.departement_id IS NOT NULL
              AND array_length(e.activite_ids,1) > 0
            GROUP BY d.nom, r.nom, a.nom
        )
        SELECT
            departement AS "Département",
            region      AS "Région",
            activite    AS "Activité",
            nb          AS "Nb entreprises",
            rang        AS "Rang dans le dép."
        FROM act_dept
        WHERE rang <= 5
        ORDER BY departement, rang
    """)

# ── 41. Répartition activités × arrondissement ────────────────────────────────
@router.get("/activites-par-arrondissement")
async def t_activites_arr(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH act_arr AS (
            SELECT
                ar.nom                      AS arrondissement,
                d.nom                       AS departement,
                r.nom                       AS region,
                a.nom                       AS activite,
                COUNT(DISTINCT e.id)        AS nb,
                RANK() OVER (
                    PARTITION BY ar.nom
                    ORDER BY COUNT(DISTINCT e.id) DESC
                ) AS rang
            FROM entreprises_installees e
            JOIN LATERAL unnest(e.activite_ids) aid ON TRUE
            JOIN ref_activites a         ON a.id = aid
            JOIN ref_arrondissements ar  ON ar.id = e.arrondissement_id
            JOIN ref_departements d      ON d.id = ar.departement_id
            JOIN ref_regions r           ON r.id = d.region_id
            WHERE e.is_deleted=FALSE
              AND e.arrondissement_id IS NOT NULL
              AND array_length(e.activite_ids,1) > 0
            GROUP BY ar.nom, d.nom, r.nom, a.nom
        )
        SELECT
            arrondissement  AS "Arrondissement",
            departement     AS "Département",
            region          AS "Région",
            activite        AS "Activité",
            nb              AS "Nb entreprises",
            rang            AS "Rang"
        FROM act_arr
        WHERE rang <= 5
        ORDER BY arrondissement, rang
    """)

# ── 42. Top 5 activités dans chaque pôle territorial ─────────────────────────
@router.get("/activites-par-pole")
async def t_activites_pole(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH act_pole AS (
            SELECT
                pt.pole_territoire          AS pole,
                r.nom                       AS region,
                a.nom                       AS activite,
                s.nom                       AS secteur,
                b.nom                       AS branche,
                COUNT(DISTINCT e.id)        AS nb,
                RANK() OVER (
                    PARTITION BY pt.pole_territoire
                    ORDER BY COUNT(DISTINCT e.id) DESC
                ) AS rang
            FROM poles_territoires pt
            LEFT JOIN ref_regions r ON r.id = (pt.region_ids[1])
            JOIN zones z ON z.pole_id = pt.id AND z.is_deleted=FALSE
            JOIN zone_entreprises ze ON ze.zone_id = z.id
            JOIN entreprises_installees e ON e.id = ze.entreprise_id AND e.is_deleted=FALSE
            JOIN LATERAL unnest(e.activite_ids) aid ON TRUE
            JOIN ref_activites a ON a.id = aid
            JOIN ref_branches b  ON b.id = a.branche_id
            JOIN ref_secteurs s  ON s.id = b.secteur_id
            WHERE array_length(e.activite_ids,1) > 0
            GROUP BY pt.pole_territoire, r.nom, a.nom, s.nom, b.nom
        )
        SELECT
            pole        AS "Pôle territorial",
            region      AS "Région",
            secteur     AS "Secteur",
            branche     AS "Branche",
            activite    AS "Activité",
            nb          AS "Nb entreprises",
            rang        AS "Rang dans le pôle"
        FROM act_pole
        WHERE rang <= 5
        ORDER BY pole, rang
    """)


# ── 44. Emplacements des entreprises étrangères ───────────────────────────────
@router.get("/entreprises-etrangeres-localisation")
async def t_etrangeres_loc(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH sn AS (SELECT id FROM ref_pays WHERE code_iso2='SN' LIMIT 1)
        SELECT
            e.nom                                               AS "Entreprise",
            p.nom_fr                                            AS "Pays d'origine",
            p.continent                                         AS "Continent",
            COALESCE(r.nom, 'N/A')                              AS "Région",
            COALESCE(d.nom, 'N/A')                              AS "Département",
            COALESCE(arr.nom, 'N/A')                            AS "Arrondissement",
            COALESCE(e.forme_juridique, 'N/A')                  AS "Forme juridique",
            EXTRACT(YEAR FROM e.date_creation)::int             AS "Année création",
            s.nom                                               AS "Secteur principal"
        FROM entreprises_installees e
        JOIN ref_pays p ON p.id = e.siege_pays_id
        CROSS JOIN sn
        LEFT JOIN ref_regions r         ON r.id = e.region_id
        LEFT JOIN ref_departements d    ON d.id = e.departement_id
        LEFT JOIN ref_arrondissements arr ON arr.id = e.arrondissement_id
        LEFT JOIN LATERAL (
            SELECT s2.nom FROM unnest(e.secteur_ids) sid
            JOIN ref_secteurs s2 ON s2.id = sid LIMIT 1
        ) s ON TRUE
        WHERE e.is_deleted=FALSE
          AND e.siege_pays_id IS NOT NULL
          AND e.siege_pays_id != sn.id
        ORDER BY p.continent, p.nom_fr, r.nom
    """)

# ── 45. Activités des entreprises étrangères ──────────────────────────────────
@router.get("/activites-entreprises-etrangeres")
async def t_activites_etrangeres(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH sn AS (SELECT id FROM ref_pays WHERE code_iso2='SN' LIMIT 1)
        SELECT
            a.nom                                               AS "Activité",
            b.nom                                               AS "Branche",
            s.nom                                               AS "Secteur",
            COUNT(DISTINCT e.id)                                AS "Nb entreprises étrangères",
            COUNT(DISTINCT p.nom_fr)                            AS "Nb pays représentés",
            STRING_AGG(DISTINCT p.continent, ', '
                ORDER BY p.continent)                           AS "Continents",
            RANK() OVER (ORDER BY COUNT(DISTINCT e.id) DESC)    AS "Rang"
        FROM entreprises_installees e
        JOIN ref_pays p ON p.id = e.siege_pays_id
        CROSS JOIN sn
        JOIN LATERAL unnest(e.activite_ids) aid ON TRUE
        JOIN ref_activites a ON a.id = aid
        JOIN ref_branches b  ON b.id = a.branche_id
        JOIN ref_secteurs s  ON s.id = b.secteur_id
        WHERE e.is_deleted=FALSE
          AND e.siege_pays_id IS NOT NULL
          AND e.siege_pays_id != sn.id
          AND array_length(e.activite_ids,1) > 0
        GROUP BY a.nom, b.nom, s.nom
        ORDER BY "Nb entreprises étrangères" DESC
    """)

# ── 46. Secteurs des entreprises étrangères par continent ─────────────────────
@router.get("/secteurs-etrangers-par-continent")
async def t_secteurs_etrangers(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH sn AS (SELECT id FROM ref_pays WHERE code_iso2='SN' LIMIT 1)
        SELECT
            p.continent                                         AS "Continent",
            s.nom                                               AS "Secteur",
            COUNT(DISTINCT e.id)                                AS "Nb entreprises",
            COUNT(DISTINCT p.nom_fr)                            AS "Nb pays",
            RANK() OVER (
                PARTITION BY p.continent
                ORDER BY COUNT(DISTINCT e.id) DESC
            )                                                   AS "Rang dans continent"
        FROM entreprises_installees e
        JOIN ref_pays p ON p.id = e.siege_pays_id
        CROSS JOIN sn
        JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        JOIN ref_secteurs s ON s.id = sid
        WHERE e.is_deleted=FALSE
          AND e.siege_pays_id IS NOT NULL
          AND e.siege_pays_id != sn.id
          AND array_length(e.secteur_ids,1) > 0
        GROUP BY p.continent, s.nom
        ORDER BY p.continent, "Nb entreprises" DESC
    """)

# ── 47. Nouvelles tendances : activités des entreprises créées récemment ───────
@router.get("/tendances-recentes")
async def t_tendances(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH recentes AS (
            SELECT e.id, e.date_creation,
                   EXTRACT(YEAR FROM e.date_creation)::int AS annee
            FROM entreprises_installees e
            WHERE e.is_deleted=FALSE
              AND e.date_creation >= CURRENT_DATE - INTERVAL '5 years'
        ),
        toutes AS (
            SELECT e.id FROM entreprises_installees e WHERE e.is_deleted=FALSE
        )
        SELECT
            a.nom                                               AS "Activité",
            b.nom                                               AS "Branche",
            s.nom                                               AS "Secteur",
            COUNT(DISTINCT r.id)                                AS "Nb nouvelles ent. (5 ans)",
            COUNT(DISTINCT t.id)                                AS "Nb total ent.",
            ROUND(COUNT(DISTINCT r.id)::numeric /
                NULLIF(COUNT(DISTINCT t.id), 0) * 100, 1)      AS "% nouvelles / total",
            RANK() OVER (ORDER BY COUNT(DISTINCT r.id) DESC)    AS "Rang tendance"
        FROM ref_activites a
        JOIN ref_branches b ON b.id = a.branche_id
        JOIN ref_secteurs s ON s.id = b.secteur_id
        LEFT JOIN entreprises_installees e_all
            ON a.id = ANY(e_all.activite_ids) AND e_all.is_deleted=FALSE
        LEFT JOIN recentes r ON r.id = e_all.id
        LEFT JOIN toutes t   ON t.id = e_all.id
        GROUP BY a.nom, b.nom, s.nom
        HAVING COUNT(DISTINCT r.id) > 0
        ORDER BY "Nb nouvelles ent. (5 ans)" DESC
        LIMIT 30
    """)

# ── 48. Évolution annuelle par secteur (tendance temporelle) ──────────────────
@router.get("/evolution-par-secteur")
async def t_evolution_secteur(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            EXTRACT(YEAR FROM e.date_creation)::int             AS "Année",
            s.nom                                               AS "Secteur",
            COUNT(DISTINCT e.id)                                AS "Nouvelles entreprises",
            SUM(COUNT(DISTINCT e.id)) OVER (
                PARTITION BY s.nom
                ORDER BY EXTRACT(YEAR FROM e.date_creation)
            )                                                   AS "Cumul secteur",
            RANK() OVER (
                PARTITION BY EXTRACT(YEAR FROM e.date_creation)
                ORDER BY COUNT(DISTINCT e.id) DESC
            )                                                   AS "Rang cette année"
        FROM entreprises_installees e
        JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        JOIN ref_secteurs s ON s.id = sid
        WHERE e.is_deleted=FALSE
          AND e.date_creation IS NOT NULL
          AND EXTRACT(YEAR FROM e.date_creation) >= 2010
          AND array_length(e.secteur_ids,1) > 0
        GROUP BY EXTRACT(YEAR FROM e.date_creation), s.nom
        ORDER BY "Année" DESC, "Nouvelles entreprises" DESC
    """)

# ── 49. Activités émergentes : croissance forte ces 3 dernières années ─────────
@router.get("/activites-emergentes")
async def t_emergentes(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH periode AS (
            SELECT
                a.nom                       AS activite,
                s.nom                       AS secteur,
                b.nom                       AS branche,
                COUNT(DISTINCT e.id) FILTER (
                    WHERE e.date_creation >= CURRENT_DATE - INTERVAL '3 years'
                )                           AS nb_recentes,
                COUNT(DISTINCT e.id) FILTER (
                    WHERE e.date_creation >= CURRENT_DATE - INTERVAL '6 years'
                    AND e.date_creation < CURRENT_DATE - INTERVAL '3 years'
                )                           AS nb_precedentes,
                COUNT(DISTINCT e.id)        AS nb_total
            FROM ref_activites a
            JOIN ref_branches b ON b.id = a.branche_id
            JOIN ref_secteurs s ON s.id = b.secteur_id
            LEFT JOIN entreprises_installees e
                ON a.id = ANY(e.activite_ids) AND e.is_deleted=FALSE
            GROUP BY a.nom, b.nom, s.nom
        )
        SELECT
            activite                                            AS "Activité",
            branche                                             AS "Branche",
            secteur                                             AS "Secteur",
            nb_recentes                                         AS "3 dernières années",
            nb_precedentes                                      AS "3 années précédentes",
            nb_total                                            AS "Total",
            CASE
                WHEN nb_precedentes = 0 AND nb_recentes > 0 THEN '🆕 Nouvelle'
                WHEN nb_precedentes > 0
                THEN ROUND((nb_recentes - nb_precedentes)::numeric
                    / nb_precedentes * 100, 0)::text || '%'
                ELSE '—'
            END                                                 AS "Croissance",
            RANK() OVER (ORDER BY nb_recentes DESC)             AS "Rang émergence"
        FROM periode
        WHERE nb_recentes > 0
        ORDER BY nb_recentes DESC
        LIMIT 30
    """)

# ── 50. Répartition géographique des entreprises étrangères par pays ──────────
@router.get("/etrangeres-par-pays-region")
async def t_etrangeres_pays_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH sn AS (SELECT id FROM ref_pays WHERE code_iso2='SN' LIMIT 1)
        SELECT
            p.nom_fr                                            AS "Pays d'origine",
            p.continent                                         AS "Continent",
            COALESCE(r.nom, 'Non renseignée')                   AS "Région d'implantation",
            COUNT(e.id)                                         AS "Nb entreprises",
            RANK() OVER (
                PARTITION BY p.nom_fr
                ORDER BY COUNT(e.id) DESC
            )                                                   AS "Région préférée"
        FROM entreprises_installees e
        JOIN ref_pays p ON p.id = e.siege_pays_id
        CROSS JOIN sn
        LEFT JOIN ref_regions r ON r.id = e.region_id
        WHERE e.is_deleted=FALSE
          AND e.siege_pays_id IS NOT NULL
          AND e.siege_pays_id != sn.id
        GROUP BY p.nom_fr, p.continent, r.nom
        ORDER BY "Nb entreprises" DESC
    """)


# ── 52. Activités par zone d'investissement (détail complet) ──────────────────
@router.get("/activites-par-zone")
async def t_activites_zone_detail(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            z.nom_zone                                          AS "Zone",
            z.type_zone                                         AS "Type",
            s.nom                                               AS "Secteur",
            b.nom                                               AS "Branche",
            a.nom                                               AS "Activité",
            COUNT(DISTINCT ze.entreprise_id)                    AS "Nb entreprises",
            RANK() OVER (
                PARTITION BY z.nom_zone
                ORDER BY COUNT(DISTINCT ze.entreprise_id) DESC
            )                                                   AS "Rang dans la zone"
        FROM zones z
        JOIN zone_entreprises ze   ON ze.zone_id = z.id
        JOIN entreprises_installees e ON e.id = ze.entreprise_id AND e.is_deleted=FALSE
        JOIN LATERAL unnest(e.activite_ids) aid ON TRUE
        JOIN ref_activites a ON a.id = aid
        JOIN ref_branches b  ON b.id = a.branche_id
        JOIN ref_secteurs s  ON s.id = b.secteur_id
        WHERE z.is_deleted=FALSE AND array_length(e.activite_ids,1) > 0
        GROUP BY z.nom_zone, z.type_zone, s.nom, b.nom, a.nom
        ORDER BY z.nom_zone, "Nb entreprises" DESC
    """)

# ── 53. Entreprises créées par décennie et par région ─────────────────────────
@router.get("/creations-par-decennie")
async def t_decennie(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            COALESCE(r.nom, 'Non renseignée')                   AS "Région",
            COUNT(e.id) FILTER (
                WHERE EXTRACT(YEAR FROM e.date_creation) < 1990
            )                                                   AS "Avant 1990",
            COUNT(e.id) FILTER (
                WHERE EXTRACT(YEAR FROM e.date_creation)
                      BETWEEN 1990 AND 1999
            )                                                   AS "1990–1999",
            COUNT(e.id) FILTER (
                WHERE EXTRACT(YEAR FROM e.date_creation)
                      BETWEEN 2000 AND 2009
            )                                                   AS "2000–2009",
            COUNT(e.id) FILTER (
                WHERE EXTRACT(YEAR FROM e.date_creation)
                      BETWEEN 2010 AND 2019
            )                                                   AS "2010–2019",
            COUNT(e.id) FILTER (
                WHERE EXTRACT(YEAR FROM e.date_creation) >= 2020
            )                                                   AS "2020+",
            COUNT(e.id) FILTER (WHERE e.date_creation IS NULL)  AS "Date inconnue",
            COUNT(e.id)                                         AS "Total"
        FROM entreprises_installees e
        LEFT JOIN ref_regions r ON r.id = e.region_id
        WHERE e.is_deleted=FALSE
        GROUP BY r.nom
        ORDER BY "Total" DESC
    """)

# ── 54. Densité d'activité économique par département ─────────────────────────
@router.get("/densite-economique-departements")
async def t_densite_dept(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            d.nom                                               AS "Département",
            r.nom                                               AS "Région",
            COUNT(DISTINCT e.id)                                AS "Nb entreprises",
            COUNT(DISTINCT s.id)                                AS "Nb secteurs actifs",
            COUNT(DISTINCT b.id)                                AS "Nb branches actives",
            COUNT(DISTINCT a.id)                                AS "Nb activités",
            COUNT(DISTINCT pay.id) FILTER (
                WHERE pay.code_iso2 != 'SN'
            )                                                   AS "Nb pays étrangers",
            RANK() OVER (ORDER BY COUNT(DISTINCT e.id) DESC)    AS "Rang national",
            RANK() OVER (
                PARTITION BY r.nom
                ORDER BY COUNT(DISTINCT e.id) DESC
            )                                                   AS "Rang régional"
        FROM ref_departements d
        JOIN ref_regions r ON r.id = d.region_id
        LEFT JOIN entreprises_installees e  ON e.departement_id = d.id AND e.is_deleted=FALSE
        LEFT JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        LEFT JOIN ref_secteurs s ON s.id = sid
        LEFT JOIN LATERAL unnest(e.branche_ids) bid ON TRUE
        LEFT JOIN ref_branches b ON b.id = bid
        LEFT JOIN LATERAL unnest(e.activite_ids) aid ON TRUE
        LEFT JOIN ref_activites a ON a.id = aid
        LEFT JOIN ref_pays pay ON pay.id = e.siege_pays_id
        GROUP BY d.nom, r.nom
        HAVING COUNT(DISTINCT e.id) > 0
        ORDER BY "Nb entreprises" DESC
    """)

# ── 55. Vue complète pôle → zones → entreprises → activités ──────────────────
@router.get("/vue-pole-zone-activite")
async def t_vue_pole_zone(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        SELECT
            pt.pole_territoire                                  AS "Pôle",
            z.nom_zone                                          AS "Zone",
            z.type_zone                                         AS "Type zone",
            COUNT(DISTINCT ze.entreprise_id)                    AS "Nb entreprises",
            COUNT(DISTINCT s.id)                                AS "Nb secteurs",
            COUNT(DISTINCT a.id)                                AS "Nb activités",
            COUNT(DISTINCT pay.id) FILTER (
                WHERE pay.code_iso2 != 'SN'
            )                                                   AS "Investisseurs étrangers",
            STRING_AGG(DISTINCT s.nom, ' · '
                ORDER BY s.nom)                                 AS "Secteurs présents"
        FROM poles_territoires pt
        JOIN zones z             ON z.pole_id = pt.id AND z.is_deleted=FALSE
        LEFT JOIN zone_entreprises ze ON ze.zone_id = z.id
        LEFT JOIN entreprises_installees e ON e.id = ze.entreprise_id AND e.is_deleted=FALSE
        LEFT JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
        LEFT JOIN ref_secteurs s ON s.id = sid
        LEFT JOIN LATERAL unnest(e.activite_ids) aid ON TRUE
        LEFT JOIN ref_activites a ON a.id = aid
        LEFT JOIN ref_pays pay    ON pay.id = e.siege_pays_id
        GROUP BY pt.pole_territoire, z.nom_zone, z.type_zone
        ORDER BY pt.pole_territoire, "Nb entreprises" DESC
    """)

# ── 56. Branches par région (top 5 par région) ────────────────────────────────
@router.get("/branches-par-region")
async def t_branches_region(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH br_reg AS (
            SELECT
                r.nom                       AS region,
                s.nom                       AS secteur,
                b.nom                       AS branche,
                COUNT(DISTINCT e.id)        AS nb,
                RANK() OVER (
                    PARTITION BY r.nom
                    ORDER BY COUNT(DISTINCT e.id) DESC
                ) AS rang
            FROM entreprises_installees e
            JOIN LATERAL unnest(e.branche_ids) bid ON TRUE
            JOIN ref_branches b  ON b.id = bid
            JOIN ref_secteurs s  ON s.id = b.secteur_id
            JOIN ref_regions r   ON r.id = e.region_id
            WHERE e.is_deleted=FALSE AND array_length(e.branche_ids,1) > 0
            GROUP BY r.nom, s.nom, b.nom
        )
        SELECT
            region      AS "Région",
            secteur     AS "Secteur",
            branche     AS "Branche",
            nb          AS "Nb entreprises",
            rang        AS "Rang dans la région"
        FROM br_reg
        WHERE rang <= 5
        ORDER BY region, rang
    """)

# ── 57. Nouvelles entreprises étrangères ces 5 ans par pays ───────────────────
@router.get("/etrangeres-recentes-par-pays")
async def t_etrangeres_recentes(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH sn AS (SELECT id FROM ref_pays WHERE code_iso2='SN' LIMIT 1)
        SELECT
            p.nom_fr                                            AS "Pays d'origine",
            p.continent                                         AS "Continent",
            COUNT(e.id)                                         AS "Total entreprises",
            COUNT(e.id) FILTER (
                WHERE e.date_creation >= CURRENT_DATE - INTERVAL '5 years'
            )                                                   AS "5 dernières années",
            COUNT(e.id) FILTER (
                WHERE e.date_creation >= CURRENT_DATE - INTERVAL '2 years'
            )                                                   AS "2 dernières années",
            ROUND(
                COUNT(e.id) FILTER (
                    WHERE e.date_creation >= CURRENT_DATE - INTERVAL '5 years'
                )::numeric / NULLIF(COUNT(e.id), 0) * 100
            , 1)                                                AS "% récentes",
            RANK() OVER (ORDER BY COUNT(e.id) FILTER (
                WHERE e.date_creation >= CURRENT_DATE - INTERVAL '5 years'
            ) DESC)                                             AS "Rang dynamisme récent"
        FROM entreprises_installees e
        JOIN ref_pays p ON p.id = e.siege_pays_id
        CROSS JOIN sn
        WHERE e.is_deleted=FALSE
          AND e.siege_pays_id IS NOT NULL
          AND e.siege_pays_id != sn.id
        GROUP BY p.nom_fr, p.continent
        ORDER BY "5 dernières années" DESC
    """)

# ── 58. Indice de diversification par zone d'investissement ───────────────────
@router.get("/diversification-zones")
async def t_diversification_zones(db: AsyncSession = Depends(get_db)):
    return await safe(db, """
        WITH zone_sect AS (
            SELECT
                z.nom_zone, z.type_zone,
                s.nom AS secteur,
                COUNT(DISTINCT ze.entreprise_id) AS nb
            FROM zones z
            JOIN zone_entreprises ze ON ze.zone_id = z.id
            JOIN entreprises_installees e ON e.id = ze.entreprise_id AND e.is_deleted=FALSE
            JOIN LATERAL unnest(e.secteur_ids) sid ON TRUE
            JOIN ref_secteurs s ON s.id = sid
            WHERE z.is_deleted=FALSE
            GROUP BY z.nom_zone, z.type_zone, s.nom
        ),
        totaux AS (
            SELECT nom_zone, SUM(nb) AS total FROM zone_sect GROUP BY nom_zone
        ),
        hhi AS (
            SELECT
                zs.nom_zone, zs.type_zone,
                t.total,
                COUNT(DISTINCT zs.secteur) AS nb_secteurs,
                ROUND(SUM((zs.nb::numeric / NULLIF(t.total,0))^2), 4) AS indice_hhi
            FROM zone_sect zs JOIN totaux t ON t.nom_zone = zs.nom_zone
            GROUP BY zs.nom_zone, zs.type_zone, t.total
        )
        SELECT
            nom_zone            AS "Zone",
            type_zone           AS "Type",
            total               AS "Nb entreprises",
            nb_secteurs         AS "Nb secteurs",
            indice_hhi          AS "Indice HHI",
            CASE
                WHEN indice_hhi > 0.5  THEN 'Très spécialisée'
                WHEN indice_hhi > 0.25 THEN 'Spécialisée'
                WHEN indice_hhi > 0.15 THEN 'Modérée'
                ELSE 'Diversifiée'
            END                 AS "Profil"
        FROM hhi
        ORDER BY indice_hhi DESC
    """)
