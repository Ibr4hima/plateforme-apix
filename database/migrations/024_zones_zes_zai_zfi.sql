-- =============================================================================
-- Migration 024 — Tables zones_zes, zones_zai, zones_zfi
-- IDs préfixés : ZES-1, ZAI-1, ZFI-1 via séquences + colonnes générées
-- =============================================================================

-- ── Séquences pour les numéros auto-incrémentés ───────────────────────────────
CREATE SEQUENCE IF NOT EXISTS seq_zes START 1;
CREATE SEQUENCE IF NOT EXISTS seq_zai START 1;
CREATE SEQUENCE IF NOT EXISTS seq_zfi START 1;

-- ── Table zones_zes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones_zes (
    id                VARCHAR(20)  PRIMARY KEY,   -- ZES-1, ZES-2, …
    num               INTEGER      NOT NULL UNIQUE DEFAULT nextval('seq_zes'),
    nom_zone          VARCHAR(500) NOT NULL,

    -- Localisation
    region_id         INTEGER REFERENCES ref_regions(id),
    departement_id    INTEGER REFERENCES ref_departements(id),
    arrondissement_id INTEGER REFERENCES ref_arrondissements(id),

    -- Thématiques NAEMA
    secteur_id        INTEGER REFERENCES ref_secteurs(id),
    branche_id        INTEGER REFERENCES ref_branches(id),
    activite_id       INTEGER REFERENCES ref_activites(id),
    thematiques       TEXT,

    -- Description & docs
    description       TEXT,

    -- Métadonnées
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    is_deleted        BOOLEAN DEFAULT FALSE
);

-- ── Table zones_zai ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones_zai (
    id                VARCHAR(20)  PRIMARY KEY,
    num               INTEGER      NOT NULL UNIQUE DEFAULT nextval('seq_zai'),
    nom_zone          VARCHAR(500) NOT NULL,

    region_id         INTEGER REFERENCES ref_regions(id),
    departement_id    INTEGER REFERENCES ref_departements(id),
    arrondissement_id INTEGER REFERENCES ref_arrondissements(id),

    secteur_id        INTEGER REFERENCES ref_secteurs(id),
    branche_id        INTEGER REFERENCES ref_branches(id),
    activite_id       INTEGER REFERENCES ref_activites(id),
    thematiques       TEXT,

    description       TEXT,

    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    is_deleted        BOOLEAN DEFAULT FALSE
);

-- ── Table zones_zfi ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones_zfi (
    id                VARCHAR(20)  PRIMARY KEY,
    num               INTEGER      NOT NULL UNIQUE DEFAULT nextval('seq_zfi'),
    nom_zone          VARCHAR(500) NOT NULL,

    region_id         INTEGER REFERENCES ref_regions(id),
    departement_id    INTEGER REFERENCES ref_departements(id),
    arrondissement_id INTEGER REFERENCES ref_arrondissements(id),

    secteur_id        INTEGER REFERENCES ref_secteurs(id),
    branche_id        INTEGER REFERENCES ref_branches(id),
    activite_id       INTEGER REFERENCES ref_activites(id),
    thematiques       TEXT,

    description       TEXT,

    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    is_deleted        BOOLEAN DEFAULT FALSE
);

-- ── Fichiers PDF liés aux zones ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zone_zes_fichiers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id      VARCHAR(20) NOT NULL REFERENCES zones_zes(id) ON DELETE CASCADE,
    titre        VARCHAR(500),
    fichier_nom  VARCHAR(500),
    fichier_path TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zone_zai_fichiers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id      VARCHAR(20) NOT NULL REFERENCES zones_zai(id) ON DELETE CASCADE,
    titre        VARCHAR(500),
    fichier_nom  VARCHAR(500),
    fichier_path TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zone_zfi_fichiers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id      VARCHAR(20) NOT NULL REFERENCES zones_zfi(id) ON DELETE CASCADE,
    titre        VARCHAR(500),
    fichier_nom  VARCHAR(500),
    fichier_path TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Trigger pour générer l'ID préfixé automatiquement ─────────────────────────
CREATE OR REPLACE FUNCTION generate_zone_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL OR NEW.id = '' THEN
        IF TG_TABLE_NAME = 'zones_zes' THEN
            NEW.id := 'ZES-' || NEW.num;
        ELSIF TG_TABLE_NAME = 'zones_zai' THEN
            NEW.id := 'ZAI-' || NEW.num;
        ELSIF TG_TABLE_NAME = 'zones_zfi' THEN
            NEW.id := 'ZFI-' || NEW.num;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zes_id ON zones_zes;
CREATE TRIGGER trg_zes_id BEFORE INSERT ON zones_zes FOR EACH ROW EXECUTE FUNCTION generate_zone_id();

DROP TRIGGER IF EXISTS trg_zai_id ON zones_zai;
CREATE TRIGGER trg_zai_id BEFORE INSERT ON zones_zai FOR EACH ROW EXECUTE FUNCTION generate_zone_id();

DROP TRIGGER IF EXISTS trg_zfi_id ON zones_zfi;
CREATE TRIGGER trg_zfi_id BEFORE INSERT ON zones_zfi FOR EACH ROW EXECUTE FUNCTION generate_zone_id();

-- ── updated_at auto ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zes_updated ON zones_zes;
CREATE TRIGGER trg_zes_updated BEFORE UPDATE ON zones_zes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_zai_updated ON zones_zai;
CREATE TRIGGER trg_zai_updated BEFORE UPDATE ON zones_zai FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_zfi_updated ON zones_zfi;
CREATE TRIGGER trg_zfi_updated BEFORE UPDATE ON zones_zfi FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE zones_zes IS 'Zones Économiques Spéciales — IDs préfixés ZES-N';
COMMENT ON TABLE zones_zai IS 'Zones Aménagées à l''Investissement — IDs préfixés ZAI-N';
COMMENT ON TABLE zones_zfi IS 'Zones Franches Industrielles — IDs préfixés ZFI-N';

-- ── Tables de liaison zone ↔ entreprises installées ──────────────────────────
CREATE TABLE IF NOT EXISTS zone_zes_entreprises (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id       VARCHAR(20) NOT NULL REFERENCES zones_zes(id) ON DELETE CASCADE,
    entreprise_id UUID        NOT NULL REFERENCES entreprises_installees(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(zone_id, entreprise_id)
);

CREATE TABLE IF NOT EXISTS zone_zai_entreprises (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id       VARCHAR(20) NOT NULL REFERENCES zones_zai(id) ON DELETE CASCADE,
    entreprise_id UUID        NOT NULL REFERENCES entreprises_installees(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(zone_id, entreprise_id)
);

CREATE TABLE IF NOT EXISTS zone_zfi_entreprises (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id       VARCHAR(20) NOT NULL REFERENCES zones_zfi(id) ON DELETE CASCADE,
    entreprise_id UUID        NOT NULL REFERENCES entreprises_installees(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(zone_id, entreprise_id)
);
