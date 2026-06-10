-- =============================================================================
-- Migration 058 — ide_cnuced_monde : ajout colonne somme
-- =============================================================================

-- 1. Ajouter la colonne somme après moyenne
ALTER TABLE ide_cnuced_monde
    ADD COLUMN IF NOT EXISTS somme NUMERIC(20,4);

-- 2. Recalculer toutes les lignes existantes
UPDATE ide_cnuced_monde t
SET somme = sub.somme
FROM (
    SELECT
        g.code,
        c.annee,
        c.indicateur,
        c.direction,
        SUM(c.valeur) AS somme
    FROM ref_groupements g
    JOIN ide_cnuced c
        ON  c.ref_pays_id = ANY(g.pays_ids)
        AND c.valeur IS NOT NULL
    GROUP BY g.code, c.annee, c.indicateur, c.direction
) sub
WHERE t.code       = sub.code
  AND t.annee      = sub.annee
  AND t.indicateur = sub.indicateur
  AND t.direction  = sub.direction;
