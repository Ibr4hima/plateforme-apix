-- =============================================================================
-- Migration 086 — Normaliser zones.is_deleted
--   Les lignes insérées hors ORM peuvent avoir is_deleted = NULL, ce qui les
--   excluait des filtres « is_deleted = FALSE » (count à 0, listes vides).
--   → On fixe NULL à FALSE et on impose la valeur par défaut + NOT NULL.
-- =============================================================================

UPDATE zones
SET is_deleted = FALSE
WHERE is_deleted IS NULL;

ALTER TABLE zones
    ALTER COLUMN is_deleted SET DEFAULT FALSE,
    ALTER COLUMN is_deleted SET NOT NULL;

-- Vérification
SELECT is_deleted, COUNT(DISTINCT id) AS nb
FROM zones
GROUP BY is_deleted
ORDER BY is_deleted;
