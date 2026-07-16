-- =============================================================================
-- Migration 022 — Zones d'investissement
-- =============================================================================

CREATE TABLE IF NOT EXISTS zones_investissement (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identité
    denomination      VARCHAR(500) NOT NULL,
    type_zone         VARCHAR(10)  NOT NULL CHECK (type_zone IN ('ZES', 'ZAI', 'ZFI')),
    description       TEXT,

    -- Thématiques (sec:/bra:/act: format ThematiquesNaema)
    thematiques       TEXT,

    -- Publication
    est_publie        BOOLEAN DEFAULT TRUE,

    -- Métadonnées
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    created_by        VARCHAR(100),
    is_deleted        BOOLEAN DEFAULT FALSE
);

-- Entreprises installées dans une zone (relation N-N)
CREATE TABLE IF NOT EXISTS zone_entreprises (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id         UUID    NOT NULL REFERENCES zones_investissement(id) ON DELETE CASCADE,
    entreprise_id   UUID    NOT NULL REFERENCES entreprises_installees(id) ON DELETE CASCADE,
    date_installation DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(zone_id, entreprise_id)
);

-- Fichiers PDF attachés à une zone
CREATE TABLE IF NOT EXISTS zone_fichiers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id     UUID        NOT NULL REFERENCES zones_investissement(id) ON DELETE CASCADE,
    titre       VARCHAR(500),
    fichier_nom VARCHAR(500),
    fichier_path TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE zones_investissement IS 'ZES, ZAI, ZFI — zones d''investissement au Sénégal';
COMMENT ON TABLE zone_entreprises    IS 'Entreprises installées dans une zone d''investissement';
COMMENT ON TABLE zone_fichiers       IS 'Documents PDF attachés à une zone';
