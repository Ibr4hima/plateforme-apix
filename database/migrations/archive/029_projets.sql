-- =============================================================================
-- Migration 029 — Table projets
-- =============================================================================

CREATE TABLE IF NOT EXISTS projets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Intitulé
    titre_projet     VARCHAR(500) NOT NULL,

    -- Zone d'implantation
    region_id         INTEGER REFERENCES ref_regions(id),
    departement_id    INTEGER REFERENCES ref_departements(id),
    arrondissement_id INTEGER REFERENCES ref_arrondissements(id),
    zone_investissement VARCHAR(20),   -- ex: ZES-1, ZAI-3
    pole_id           INTEGER REFERENCES poles_territoires(id),

    -- Thématiques NAEMA (multi)
    secteur_ids       INTEGER[] DEFAULT '{}',
    branche_ids       INTEGER[] DEFAULT '{}',
    activite_ids      INTEGER[] DEFAULT '{}',

    -- Maître d'ouvrage
    moa               VARCHAR(500),
    tel_moa           VARCHAR(50),
    mail_moa          VARCHAR(255),

    -- Métadonnées
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    is_deleted        BOOLEAN DEFAULT FALSE
);

-- Coordinateurs (relation 1-N car possibilité d'en ajouter plusieurs)
CREATE TABLE IF NOT EXISTS projet_coordinateurs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id   UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    civilite    VARCHAR(20),
    nom         VARCHAR(200),
    prenom      VARCHAR(200),
    telephone   VARCHAR(50),
    mail        VARCHAR(255),
    ordre       INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at auto
CREATE OR REPLACE FUNCTION update_projets_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projets_updated ON projets;
CREATE TRIGGER trg_projets_updated
    BEFORE UPDATE ON projets
    FOR EACH ROW EXECUTE FUNCTION update_projets_updated_at();

COMMENT ON TABLE projets IS 'Projets d''investissement APIX';
COMMENT ON TABLE projet_coordinateurs IS 'Coordinateurs rattachés à un projet';
