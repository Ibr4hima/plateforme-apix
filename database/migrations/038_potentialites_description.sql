-- =============================================================================
-- Migration 038 — Ajout colonne description à la table potentialites
-- =============================================================================

ALTER TABLE potentialites
    ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN potentialites.description IS 'Description riche (HTML) de la potentialité territoriale';
