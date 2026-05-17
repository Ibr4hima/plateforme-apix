-- =============================================================================
-- Migration 014 — Ajout colonne `reference` dans accords_traites
-- =============================================================================

ALTER TABLE accords_traites
    ADD COLUMN IF NOT EXISTS reference VARCHAR(200);

COMMENT ON COLUMN accords_traites.reference IS
    'Référence officielle de l''accord ou du traité (ex: APIX/2024/ACC-001)';
