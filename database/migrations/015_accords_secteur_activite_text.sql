-- =============================================================================
-- Migration 015 — secteur_activite : VARCHAR(100) → TEXT
-- Les thématiques (sec:/bra:/act:) peuvent dépasser 100 caractères
-- =============================================================================

ALTER TABLE accords_traites
    ALTER COLUMN secteur_activite TYPE TEXT;

COMMENT ON COLUMN accords_traites.secteur_activite IS
    'Thématiques encodées : sec:Nom, bra:Nom, act:Nom (format ThematiquesNaema)';
