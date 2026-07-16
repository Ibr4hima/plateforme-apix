-- =============================================================================
-- Migration 027 — Pôles territoires d'investissement
-- =============================================================================

-- ── 1. Table poles_territoires ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poles_territoires (
    id              SERIAL PRIMARY KEY,
    pole_territoire VARCHAR(200) NOT NULL UNIQUE,
    region_ids      INTEGER[]   NOT NULL DEFAULT '{}',  -- FK vers ref_regions (tableau)
    localisation    VARCHAR(500),                        -- Libellé lisible des régions
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE poles_territoires IS 'Pôles territoriaux d''investissement du Sénégal (fixes)';
COMMENT ON COLUMN poles_territoires.region_ids IS 'IDs des régions composant ce pôle (ref_regions.id)';

-- ── 2. Insérer les 8 pôles ────────────────────────────────────────────────────
-- Récupérer les IDs de régions par nom pour les lier correctement
INSERT INTO poles_territoires (pole_territoire, localisation, region_ids) VALUES
(
    'Pôle Dakar',
    'Dakar',
    ARRAY(SELECT id FROM ref_regions WHERE nom ILIKE '%dakar%')
),
(
    'Pôle Thiès',
    'Thiès',
    ARRAY(SELECT id FROM ref_regions WHERE nom ILIKE '%thi%s%' OR nom ILIKE '%thies%')
),
(
    'Pôle Diourbel-Louga',
    'Diourbel et Louga',
    ARRAY(SELECT id FROM ref_regions WHERE nom ILIKE '%diourbel%' OR nom ILIKE '%louga%')
),
(
    'Pôle Centre',
    'Kaolack, Fatick et Kaffrine',
    ARRAY(SELECT id FROM ref_regions WHERE nom ILIKE '%kaolack%' OR nom ILIKE '%fatick%' OR nom ILIKE '%kaffrine%')
),
(
    'Pôle Nord',
    'Saint-Louis',
    ARRAY(SELECT id FROM ref_regions WHERE nom ILIKE '%saint%louis%' OR nom ILIKE '%saint-louis%')
),
(
    'Pôle Nord-Est',
    'Matam',
    ARRAY(SELECT id FROM ref_regions WHERE nom ILIKE '%matam%')
),
(
    'Pôle Sud',
    'Ziguinchor, Sédhiou et Kolda',
    ARRAY(SELECT id FROM ref_regions WHERE nom ILIKE '%ziguinchor%' OR nom ILIKE '%s%dhiou%' OR nom ILIKE '%kolda%')
),
(
    'Pôle Sud-Est',
    'Tambacounda et Kédougou',
    ARRAY(SELECT id FROM ref_regions WHERE nom ILIKE '%tambacounda%' OR nom ILIKE '%k%dougou%')
)
ON CONFLICT (pole_territoire) DO NOTHING;

-- ── 3. Ajouter pole_id dans les 3 tables de zones ─────────────────────────────
ALTER TABLE zones_zes
    ADD COLUMN IF NOT EXISTS pole_id INTEGER REFERENCES poles_territoires(id);

ALTER TABLE zones_zai
    ADD COLUMN IF NOT EXISTS pole_id INTEGER REFERENCES poles_territoires(id);

ALTER TABLE zones_zfi
    ADD COLUMN IF NOT EXISTS pole_id INTEGER REFERENCES poles_territoires(id);

COMMENT ON COLUMN zones_zes.pole_id IS 'Pôle territorial auquel appartient cette ZES';
COMMENT ON COLUMN zones_zai.pole_id IS 'Pôle territorial auquel appartient cette ZAI';
COMMENT ON COLUMN zones_zfi.pole_id IS 'Pôle territorial auquel appartient cette ZFI';
