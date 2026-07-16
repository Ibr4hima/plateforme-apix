-- =============================================================================
-- Migration 025 — zones_zes/zai/zfi : supprimer num, thematiques
--                 Nouveau trigger ID basé sur MAX(num)+1 recalculé
-- =============================================================================

-- ── 1. Supprimer les colonnes ─────────────────────────────────────────────────
ALTER TABLE zones_zes DROP COLUMN IF EXISTS num;
ALTER TABLE zones_zes DROP COLUMN IF EXISTS thematiques;

ALTER TABLE zones_zai DROP COLUMN IF EXISTS num;
ALTER TABLE zones_zai DROP COLUMN IF EXISTS thematiques;

ALTER TABLE zones_zfi DROP COLUMN IF EXISTS num;
ALTER TABLE zones_zfi DROP COLUMN IF EXISTS thematiques;

-- ── 2. Supprimer les séquences (plus nécessaires) ─────────────────────────────
DROP SEQUENCE IF EXISTS seq_zes CASCADE;
DROP SEQUENCE IF EXISTS seq_zai CASCADE;
DROP SEQUENCE IF EXISTS seq_zfi CASCADE;

-- ── 3. Nouveau trigger : ID basé sur MAX existant + 1 ─────────────────────────
-- Toujours ZES-1 si table vide, ZES-2 si une ligne, etc.
CREATE OR REPLACE FUNCTION generate_zone_id_dynamic()
RETURNS TRIGGER AS $$
DECLARE
    prefix     TEXT;
    table_name TEXT;
    next_num   INTEGER;
BEGIN
    table_name := TG_TABLE_NAME;

    IF table_name = 'zones_zes' THEN prefix := 'ZES';
    ELSIF table_name = 'zones_zai' THEN prefix := 'ZAI';
    ELSIF table_name = 'zones_zfi' THEN prefix := 'ZFI';
    END IF;

    -- Extraire le MAX du numéro depuis les IDs existants (ex: ZES-3 → 3)
    EXECUTE format(
        'SELECT COALESCE(MAX(CAST(SPLIT_PART(id, $1, 2) AS INTEGER)), 0) + 1 FROM %I',
        table_name
    ) USING '-' INTO next_num;

    NEW.id := prefix || '-' || next_num;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remplacer les anciens triggers
DROP TRIGGER IF EXISTS trg_zes_id ON zones_zes;
CREATE TRIGGER trg_zes_id
    BEFORE INSERT ON zones_zes
    FOR EACH ROW WHEN (NEW.id IS NULL OR NEW.id = '')
    EXECUTE FUNCTION generate_zone_id_dynamic();

DROP TRIGGER IF EXISTS trg_zai_id ON zones_zai;
CREATE TRIGGER trg_zai_id
    BEFORE INSERT ON zones_zai
    FOR EACH ROW WHEN (NEW.id IS NULL OR NEW.id = '')
    EXECUTE FUNCTION generate_zone_id_dynamic();

DROP TRIGGER IF EXISTS trg_zfi_id ON zones_zfi;
CREATE TRIGGER trg_zfi_id
    BEFORE INSERT ON zones_zfi
    FOR EACH ROW WHEN (NEW.id IS NULL OR NEW.id = '')
    EXECUTE FUNCTION generate_zone_id_dynamic();
