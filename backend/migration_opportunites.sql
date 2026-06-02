-- ============================================================
-- Migration : tables opportunites
-- ============================================================

-- 1. Potentialités par zone
CREATE TABLE IF NOT EXISTS potentialites (
    id                  SERIAL PRIMARY KEY,
    titre               VARCHAR(500) NOT NULL,

    -- Niveau géographique (un seul renseigné)
    pole_id             INTEGER REFERENCES poles_territoires(id),
    region_id           INTEGER REFERENCES ref_regions(id),
    departement_id      INTEGER REFERENCES ref_departements(id),
    arrondissement_id   INTEGER REFERENCES ref_arrondissements(id),

    -- Ciblage NAEMA
    secteur_ids         INTEGER[] DEFAULT '{}',
    branche_ids         INTEGER[] DEFAULT '{}',
    activite_ids        INTEGER[] DEFAULT '{}',

    -- Contenu structuré
    ressources_naturelles TEXT,
    infrastructure        TEXT,
    demographie           TEXT,
    atouts_economiques    TEXT,
    contraintes           TEXT,
    autres                TEXT,

    est_publie  BOOLEAN DEFAULT TRUE,
    is_deleted  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Avantages et incitations
CREATE TABLE IF NOT EXISTS avantages_incitations (
    id            SERIAL PRIMARY KEY,
    titre         VARCHAR(500) NOT NULL,

    -- Ciblage NAEMA
    secteur_ids   INTEGER[] DEFAULT '{}',
    branche_ids   INTEGER[] DEFAULT '{}',
    activite_ids  INTEGER[] DEFAULT '{}',

    -- Type : fiscal | douanier | foncier | financier | administratif | autre
    type_avantage VARCHAR(50) NOT NULL,

    description   TEXT,
    valeur        VARCHAR(200),   -- Ex: "50% d'exonération", "15 ans"
    base_legale   VARCHAR(500),   -- Référence loi/décret
    conditions    TEXT,

    est_publie  BOOLEAN DEFAULT TRUE,
    is_deleted  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_potentialites_pole       ON potentialites(pole_id)         WHERE pole_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_potentialites_region     ON potentialites(region_id)       WHERE region_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_potentialites_dept       ON potentialites(departement_id)  WHERE departement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_avantages_type           ON avantages_incitations(type_avantage);

SELECT 'Migration opportunites OK' AS status;
