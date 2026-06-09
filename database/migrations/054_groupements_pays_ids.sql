-- =============================================================================
-- Migration 054 — ref_groupements : colonne pays_ids
--                 Array d'entiers synchronisé depuis ref_pays_groupements
-- =============================================================================

-- 1. Ajouter la colonne
ALTER TABLE ref_groupements
    ADD COLUMN IF NOT EXISTS pays_ids integer[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN ref_groupements.pays_ids IS
    'IDs des pays membres (ref ref_pays.id), maintenu automatiquement depuis ref_pays_groupements';

-- 2. Remplir les données existantes
UPDATE ref_groupements g
SET pays_ids = (
    SELECT COALESCE(array_agg(pg.pays_id ORDER BY pg.pays_id), '{}')
    FROM ref_pays_groupements pg
    WHERE pg.groupement_id = g.id
);

-- 3. Fonction trigger : synchroniser pays_ids à chaque modif de ref_pays_groupements
CREATE OR REPLACE FUNCTION sync_groupement_pays_ids()
RETURNS TRIGGER AS $$
DECLARE
    gid integer;
BEGIN
    gid := CASE WHEN TG_OP = 'DELETE' THEN OLD.groupement_id ELSE NEW.groupement_id END;

    UPDATE ref_groupements
    SET pays_ids = (
        SELECT COALESCE(array_agg(pays_id ORDER BY pays_id), '{}')
        FROM ref_pays_groupements
        WHERE groupement_id = gid
    )
    WHERE id = gid;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_pays_ids ON ref_pays_groupements;
CREATE TRIGGER trg_sync_pays_ids
    AFTER INSERT OR UPDATE OR DELETE
    ON ref_pays_groupements
    FOR EACH ROW EXECUTE FUNCTION sync_groupement_pays_ids();
