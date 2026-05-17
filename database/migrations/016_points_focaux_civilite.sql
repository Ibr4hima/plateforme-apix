-- =============================================================================
-- Migration 016 — Ajout colonne `civilite` dans points_focaux_entreprise
-- =============================================================================

ALTER TABLE entreprises_points_focaux
    ADD COLUMN IF NOT EXISTS civilite VARCHAR(20) DEFAULT 'Monsieur';

COMMENT ON COLUMN entreprises_points_focaux.civilite IS
    'Civilité du point focal : Monsieur ou Madame';
