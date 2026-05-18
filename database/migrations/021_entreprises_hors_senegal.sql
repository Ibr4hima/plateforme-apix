-- =============================================================================
-- Migration 021 — Table entreprises_hors_senegal + liaison avec prospects
-- =============================================================================

CREATE TABLE IF NOT EXISTS entreprises_hors_senegal (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identité
    nom               VARCHAR(255) NOT NULL,
    forme_juridique   VARCHAR(100),
    date_creation     DATE,
    statut            VARCHAR(20)  DEFAULT 'actif',

    -- Siège social (pays étranger)
    siege_pays_id     INTEGER REFERENCES ref_pays(id),

    -- Contact
    adresse           TEXT,
    telephone         VARCHAR(50),
    mail              VARCHAR(255),
    siteweb           TEXT,

    -- Classification NAEMA
    secteur_id        INTEGER REFERENCES ref_secteurs(id),
    branche_id        INTEGER REFERENCES ref_branches(id),
    activite_id       INTEGER REFERENCES ref_activites(id),

    -- Publication
    est_publie        BOOLEAN DEFAULT TRUE,

    -- Métadonnées
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    created_by        VARCHAR(100),
    is_deleted        BOOLEAN DEFAULT FALSE
);

-- FK depuis prospects vers entreprises_hors_senegal
ALTER TABLE prospects
    ADD COLUMN IF NOT EXISTS entreprise_hors_senegal_id UUID REFERENCES entreprises_hors_senegal(id) ON DELETE SET NULL;

COMMENT ON TABLE entreprises_hors_senegal IS
    'Entreprises étrangères ciblées comme prospects (non installées au Sénégal)';

COMMENT ON COLUMN prospects.entreprise_hors_senegal_id IS
    'FK vers entreprises_hors_senegal — rempli si type_prospect = hors_senegal';
