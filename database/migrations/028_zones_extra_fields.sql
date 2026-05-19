-- =============================================================================
-- Migration 028 — zones_zes/zai/zfi : date_creation, decret_creation, superficie
-- =============================================================================

ALTER TABLE zones_zes
    ADD COLUMN IF NOT EXISTS date_creation    DATE,
    ADD COLUMN IF NOT EXISTS decret_creation  VARCHAR(500),
    ADD COLUMN IF NOT EXISTS superficie       NUMERIC(12,2);

ALTER TABLE zones_zai
    ADD COLUMN IF NOT EXISTS date_creation    DATE,
    ADD COLUMN IF NOT EXISTS decret_creation  VARCHAR(500),
    ADD COLUMN IF NOT EXISTS superficie       NUMERIC(12,2);

ALTER TABLE zones_zfi
    ADD COLUMN IF NOT EXISTS date_creation    DATE,
    ADD COLUMN IF NOT EXISTS decret_creation  VARCHAR(500),
    ADD COLUMN IF NOT EXISTS superficie       NUMERIC(12,2);

-- Contrainte : date_creation ne peut pas être dans le futur
ALTER TABLE zones_zes ADD CONSTRAINT chk_zes_date_creation CHECK (date_creation <= CURRENT_DATE);
ALTER TABLE zones_zai ADD CONSTRAINT chk_zai_date_creation CHECK (date_creation <= CURRENT_DATE);
ALTER TABLE zones_zfi ADD CONSTRAINT chk_zfi_date_creation CHECK (date_creation <= CURRENT_DATE);

COMMENT ON COLUMN zones_zes.date_creation   IS 'Date de création officielle de la zone';
COMMENT ON COLUMN zones_zes.decret_creation IS 'Référence du décret de création';
COMMENT ON COLUMN zones_zes.superficie      IS 'Superficie en hectares';

-- Migrer secteur_id/branche_id/activite_id vers tableaux
ALTER TABLE zones_zes
    ADD COLUMN IF NOT EXISTS secteur_ids  INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS branche_ids  INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS activite_ids INTEGER[] DEFAULT '{}';

ALTER TABLE zones_zai
    ADD COLUMN IF NOT EXISTS secteur_ids  INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS branche_ids  INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS activite_ids INTEGER[] DEFAULT '{}';

ALTER TABLE zones_zfi
    ADD COLUMN IF NOT EXISTS secteur_ids  INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS branche_ids  INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS activite_ids INTEGER[] DEFAULT '{}';

-- Migrer les données existantes (single → array)
UPDATE zones_zes SET secteur_ids = ARRAY[secteur_id] WHERE secteur_id IS NOT NULL;
UPDATE zones_zes SET branche_ids = ARRAY[branche_id] WHERE branche_id IS NOT NULL;
UPDATE zones_zes SET activite_ids = ARRAY[activite_id] WHERE activite_id IS NOT NULL;

UPDATE zones_zai SET secteur_ids = ARRAY[secteur_id] WHERE secteur_id IS NOT NULL;
UPDATE zones_zai SET branche_ids = ARRAY[branche_id] WHERE branche_id IS NOT NULL;
UPDATE zones_zai SET activite_ids = ARRAY[activite_id] WHERE activite_id IS NOT NULL;

UPDATE zones_zfi SET secteur_ids = ARRAY[secteur_id] WHERE secteur_id IS NOT NULL;
UPDATE zones_zfi SET branche_ids = ARRAY[branche_id] WHERE branche_id IS NOT NULL;
UPDATE zones_zfi SET activite_ids = ARRAY[activite_id] WHERE activite_id IS NOT NULL;

-- Supprimer les anciennes colonnes single
ALTER TABLE zones_zes DROP COLUMN IF EXISTS secteur_id, DROP COLUMN IF EXISTS branche_id, DROP COLUMN IF EXISTS activite_id;
ALTER TABLE zones_zai DROP COLUMN IF EXISTS secteur_id, DROP COLUMN IF EXISTS branche_id, DROP COLUMN IF EXISTS activite_id;
ALTER TABLE zones_zfi DROP COLUMN IF EXISTS secteur_id, DROP COLUMN IF EXISTS branche_id, DROP COLUMN IF EXISTS activite_id;
