-- =============================================================================
-- Migration 059 — Sync suppression ref_groupements → ide_cnuced_monde
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_delete_icm_on_groupement()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM ide_cnuced_monde WHERE code = OLD.code;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delete_icm_on_groupement ON ref_groupements;
CREATE TRIGGER trg_delete_icm_on_groupement
    AFTER DELETE ON ref_groupements
    FOR EACH ROW EXECUTE FUNCTION sync_delete_icm_on_groupement();

-- Nettoyer les orphelins déjà présents
DELETE FROM ide_cnuced_monde
WHERE code NOT IN (SELECT code FROM ref_groupements);
