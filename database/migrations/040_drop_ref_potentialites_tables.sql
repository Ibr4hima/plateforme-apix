-- =============================================================================
-- Migration 040 — Suppression des tables ref_potentialites_avantages et ref_potentialites_categories
-- =============================================================================

DROP TABLE IF EXISTS ref_potentialites_avantages CASCADE;
DROP TABLE IF EXISTS ref_potentialites_categories CASCADE;
