-- =============================================================================
-- Migration 013 — Champ `edition` des événements : VARCHAR → INTEGER
-- Objectif : garantir que l'édition ne peut être qu'un entier strictement positif
-- =============================================================================

-- 1. Nettoyer les valeurs existantes non-convertibles (on garde NULL si invalide)
UPDATE evenements
SET edition = NULL
WHERE edition IS NOT NULL
  AND edition !~ '^\s*[0-9]+\s*$';

-- 2. Convertir le type de colonne VARCHAR → INTEGER
ALTER TABLE evenements
    ALTER COLUMN edition TYPE INTEGER
    USING (NULLIF(TRIM(edition), '')::INTEGER);

-- 3. Ajouter la contrainte : si renseignée, edition doit être > 0
ALTER TABLE evenements
    ADD CONSTRAINT chk_evenements_edition_positive
    CHECK (edition IS NULL OR edition > 0);

-- 4. Commentaire de documentation
COMMENT ON COLUMN evenements.edition IS
    'Numéro d''édition de l''événement (entier > 0). Ex : 5 pour "5ème édition".';
