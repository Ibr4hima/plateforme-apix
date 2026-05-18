-- =============================================================================
-- Migration 026 — entreprises_installees : colonne zone_investissement
--                 Synchro automatique avec zone_zes/zai/zfi_entreprises
-- =============================================================================

-- 1. Ajouter la colonne zone_investissement
ALTER TABLE entreprises_installees
    ADD COLUMN IF NOT EXISTS zone_investissement VARCHAR(20);

-- Contrainte de format : ZES-N, ZAI-N, ZFI-N
ALTER TABLE entreprises_installees
    ADD CONSTRAINT chk_zone_format
    CHECK (
        zone_investissement IS NULL OR
        zone_investissement ~ '^(ZES|ZAI|ZFI)-[0-9]+$'
    );

COMMENT ON COLUMN entreprises_installees.zone_investissement IS
    'ID de la zone d''investissement (ex: ZES-1, ZAI-3) — référence polymorphe vers zones_zes/zai/zfi';

-- 2. Trigger de synchro : quand on met à jour zone_investissement sur une entreprise,
--    mettre à jour automatiquement les tables de liaison zone_zes/zai/zfi_entreprises

CREATE OR REPLACE FUNCTION sync_entreprise_zone()
RETURNS TRIGGER AS $$
DECLARE
    old_prefix TEXT;
    new_prefix TEXT;
    old_zone   TEXT;
    new_zone   TEXT;
BEGIN
    old_zone := OLD.zone_investissement;
    new_zone := NEW.zone_investissement;

    -- Rien à faire si zone inchangée
    IF old_zone IS NOT DISTINCT FROM new_zone THEN
        RETURN NEW;
    END IF;

    -- Supprimer l'ancienne liaison si elle existait
    IF old_zone IS NOT NULL THEN
        old_prefix := SPLIT_PART(old_zone, '-', 1);
        IF old_prefix = 'ZES' THEN
            DELETE FROM zone_zes_entreprises WHERE entreprise_id = NEW.id AND zone_id = old_zone;
        ELSIF old_prefix = 'ZAI' THEN
            DELETE FROM zone_zai_entreprises WHERE entreprise_id = NEW.id AND zone_id = old_zone;
        ELSIF old_prefix = 'ZFI' THEN
            DELETE FROM zone_zfi_entreprises WHERE entreprise_id = NEW.id AND zone_id = old_zone;
        END IF;
    END IF;

    -- Créer la nouvelle liaison si une zone est définie
    IF new_zone IS NOT NULL THEN
        new_prefix := SPLIT_PART(new_zone, '-', 1);
        IF new_prefix = 'ZES' THEN
            INSERT INTO zone_zes_entreprises (zone_id, entreprise_id)
            VALUES (new_zone, NEW.id)
            ON CONFLICT (zone_id, entreprise_id) DO NOTHING;
        ELSIF new_prefix = 'ZAI' THEN
            INSERT INTO zone_zai_entreprises (zone_id, entreprise_id)
            VALUES (new_zone, NEW.id)
            ON CONFLICT (zone_id, entreprise_id) DO NOTHING;
        ELSIF new_prefix = 'ZFI' THEN
            INSERT INTO zone_zfi_entreprises (zone_id, entreprise_id)
            VALUES (new_zone, NEW.id)
            ON CONFLICT (zone_id, entreprise_id) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_entreprise_zone ON entreprises_installees;
CREATE TRIGGER trg_sync_entreprise_zone
    AFTER UPDATE OF zone_investissement ON entreprises_installees
    FOR EACH ROW EXECUTE FUNCTION sync_entreprise_zone();

-- 3. Trigger inverse : quand on ajoute une entreprise dans zone_zes/zai/zfi_entreprises,
--    mettre à jour automatiquement zone_investissement dans entreprises_installees

CREATE OR REPLACE FUNCTION sync_zone_entreprise_insert()
RETURNS TRIGGER AS $$
DECLARE
    zone_prefix TEXT;
BEGIN
    zone_prefix := SPLIT_PART(NEW.zone_id, '-', 1);
    UPDATE entreprises_installees
    SET zone_investissement = NEW.zone_id
    WHERE id = NEW.entreprise_id
      AND (zone_investissement IS NULL OR zone_investissement != NEW.zone_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zes_ent_insert ON zone_zes_entreprises;
CREATE TRIGGER trg_zes_ent_insert
    AFTER INSERT ON zone_zes_entreprises
    FOR EACH ROW EXECUTE FUNCTION sync_zone_entreprise_insert();

DROP TRIGGER IF EXISTS trg_zai_ent_insert ON zone_zai_entreprises;
CREATE TRIGGER trg_zai_ent_insert
    AFTER INSERT ON zone_zai_entreprises
    FOR EACH ROW EXECUTE FUNCTION sync_zone_entreprise_insert();

DROP TRIGGER IF EXISTS trg_zfi_ent_insert ON zone_zfi_entreprises;
CREATE TRIGGER trg_zfi_ent_insert
    AFTER INSERT ON zone_zfi_entreprises
    FOR EACH ROW EXECUTE FUNCTION sync_zone_entreprise_insert();

-- 4. Trigger inverse : quand on supprime une liaison, vider zone_investissement
CREATE OR REPLACE FUNCTION sync_zone_entreprise_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE entreprises_installees
    SET zone_investissement = NULL
    WHERE id = OLD.entreprise_id
      AND zone_investissement = OLD.zone_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zes_ent_delete ON zone_zes_entreprises;
CREATE TRIGGER trg_zes_ent_delete
    AFTER DELETE ON zone_zes_entreprises
    FOR EACH ROW EXECUTE FUNCTION sync_zone_entreprise_delete();

DROP TRIGGER IF EXISTS trg_zai_ent_delete ON zone_zai_entreprises;
CREATE TRIGGER trg_zai_ent_delete
    AFTER DELETE ON zone_zai_entreprises
    FOR EACH ROW EXECUTE FUNCTION sync_zone_entreprise_delete();

DROP TRIGGER IF EXISTS trg_zfi_ent_delete ON zone_zfi_entreprises;
CREATE TRIGGER trg_zfi_ent_delete
    AFTER DELETE ON zone_zfi_entreprises
    FOR EACH ROW EXECUTE FUNCTION sync_zone_entreprise_delete();
