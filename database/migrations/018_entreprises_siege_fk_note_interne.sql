-- =============================================================================
-- Migration 018 — entreprises_installees :
--   • siege_pays VARCHAR → siege_pays_id FK ref_pays
--   • Suppression note_interne
-- =============================================================================

-- 1. Ajouter siege_pays_id
ALTER TABLE entreprises_installees
    ADD COLUMN IF NOT EXISTS siege_pays_id INTEGER REFERENCES ref_pays(id);

-- 2. Migrer les données existantes (nom → ID)
UPDATE entreprises_installees e
SET siege_pays_id = p.id
FROM ref_pays p
WHERE LOWER(TRIM(e.siege_pays)) = LOWER(TRIM(p.nom_fr))
  AND e.siege_pays IS NOT NULL AND e.siege_pays != '';

-- 3. Supprimer l'ancienne colonne texte
ALTER TABLE entreprises_installees
    DROP COLUMN IF EXISTS siege_pays;

-- 4. Supprimer note_interne
ALTER TABLE entreprises_installees
    DROP COLUMN IF EXISTS note_interne;

-- 5. Commentaires
COMMENT ON COLUMN entreprises_installees.siege_pays_id IS 'FK vers ref_pays — pays du siège social';
