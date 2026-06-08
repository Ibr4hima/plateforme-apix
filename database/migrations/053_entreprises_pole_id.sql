-- =============================================================================
-- Migration 053 — entreprises_installees : colonne pole_id
--                 Auto-assignée depuis region_id via poles_territoires.region_ids
-- =============================================================================

-- 1. Ajouter la colonne
ALTER TABLE entreprises_installees
    ADD COLUMN IF NOT EXISTS pole_id INTEGER REFERENCES poles_territoires(id);

COMMENT ON COLUMN entreprises_installees.pole_id IS
    'Pôle territorial déduit automatiquement du region_id (via poles_territoires.region_ids)';

-- 2. Remplir les lignes existantes
UPDATE entreprises_installees e
SET    pole_id = p.id
FROM   poles_territoires p
WHERE  e.region_id = ANY(p.region_ids)
  AND  e.pole_id IS NULL;

-- 3. Fonction trigger : maintenir pole_id en cohérence avec region_id
CREATE OR REPLACE FUNCTION assign_pole_from_region()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.region_id IS NULL THEN
        NEW.pole_id := NULL;
    ELSE
        SELECT id INTO NEW.pole_id
        FROM   poles_territoires
        WHERE  NEW.region_id = ANY(region_ids)
        LIMIT  1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_pole ON entreprises_installees;
CREATE TRIGGER trg_assign_pole
    BEFORE INSERT OR UPDATE OF region_id
    ON entreprises_installees
    FOR EACH ROW EXECUTE FUNCTION assign_pole_from_region();
