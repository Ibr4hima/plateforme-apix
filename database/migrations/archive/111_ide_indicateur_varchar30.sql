-- =============================================================================
-- Migration 111 — Élargir la colonne indicateur des tables IDE
--                 Les nouvelles catégories (greenfield_valeur, greenfield_nombre,
--                 ma_valeur, ma_nombre) dépassent le VARCHAR(10) historique
--                 prévu pour « flux » / « stock ».
-- =============================================================================

ALTER TABLE ide_cnuced       ALTER COLUMN indicateur TYPE VARCHAR(30);
ALTER TABLE ide_cnuced_monde ALTER COLUMN indicateur TYPE VARCHAR(30);
ALTER TABLE ide_analyses     ALTER COLUMN indicateur TYPE VARCHAR(30);
