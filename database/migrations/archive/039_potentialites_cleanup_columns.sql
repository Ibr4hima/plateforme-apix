-- =============================================================================
-- Migration 039 — Suppression des colonnes legacy inutilisées de potentialites
-- =============================================================================

ALTER TABLE potentialites
    DROP COLUMN IF EXISTS avantage_ids,
    DROP COLUMN IF EXISTS ressources_naturelles,
    DROP COLUMN IF EXISTS infrastructure,
    DROP COLUMN IF EXISTS demographie,
    DROP COLUMN IF EXISTS atouts_economiques,
    DROP COLUMN IF EXISTS contraintes,
    DROP COLUMN IF EXISTS autres;
