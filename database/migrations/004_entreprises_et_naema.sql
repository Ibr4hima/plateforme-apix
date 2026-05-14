-- Migration 004 : Tables NAEMA + Entreprises installées + Points focaux

-- ── 1. Refonte tables NAEMA ──────────────────────────────────────────────────

DROP TABLE IF EXISTS ref_activites  CASCADE;
DROP TABLE IF EXISTS ref_branches   CASCADE;
DROP TABLE IF EXISTS ref_secteurs   CASCADE;

-- Secteurs (Primaire, Secondaire, Tertiaire)
CREATE TABLE ref_secteurs (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,
    nom         VARCHAR(150) NOT NULL,
    description TEXT,
    actif       BOOLEAN DEFAULT TRUE
);

-- Branches (liées à un secteur)
CREATE TABLE ref_branches (
    id          SERIAL PRIMARY KEY,
    secteur_id  INTEGER NOT NULL REFERENCES ref_secteurs(id),
    code        VARCHAR(20) UNIQUE NOT NULL,
    nom         VARCHAR(150) NOT NULL,
    actif       BOOLEAN DEFAULT TRUE
);

-- Activités (liées à une branche)
CREATE TABLE ref_activites (
    id          SERIAL PRIMARY KEY,
    branche_id  INTEGER NOT NULL REFERENCES ref_branches(id),
    code        VARCHAR(20) UNIQUE NOT NULL,
    nom         VARCHAR(255) NOT NULL,
    actif       BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_branches_secteur  ON ref_branches(secteur_id);
CREATE INDEX idx_activites_branche ON ref_activites(branche_id);

-- ── 2. Entreprises installées ─────────────────────────────────────────────────

DROP TABLE IF EXISTS entreprises_points_focaux CASCADE;
DROP TABLE IF EXISTS entreprises_installees    CASCADE;

CREATE TABLE entreprises_installees (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    nom                 VARCHAR(255) NOT NULL,
    forme_juridique     VARCHAR(100),
    date_creation       DATE,

    -- Localisation
    pays                VARCHAR(100) DEFAULT 'Sénégal',
    region              VARCHAR(100),
    departement         VARCHAR(100),
    commune             VARCHAR(100),
    adresse             TEXT,

    -- Contact
    telephone           VARCHAR(50),
    mail                VARCHAR(255),
    siteweb             TEXT,

    -- Classification NAEMA
    secteur_id          INTEGER REFERENCES ref_secteurs(id),
    branche_id          INTEGER REFERENCES ref_branches(id),
    activite_id         INTEGER REFERENCES ref_activites(id),

    -- Statut
    statut              VARCHAR(20) DEFAULT 'actif'
        CHECK (statut IN ('actif', 'inactif')),

    -- Visibilité
    est_publie          BOOLEAN DEFAULT TRUE,
    note_interne        TEXT,

    -- Traçabilité
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    is_deleted          BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_entreprises_secteur    ON entreprises_installees(secteur_id);
CREATE INDEX idx_entreprises_branche    ON entreprises_installees(branche_id);
CREATE INDEX idx_entreprises_activite   ON entreprises_installees(activite_id);
CREATE INDEX idx_entreprises_region     ON entreprises_installees(region);
CREATE INDEX idx_entreprises_statut     ON entreprises_installees(statut);
CREATE INDEX idx_entreprises_pays       ON entreprises_installees(pays);

CREATE TRIGGER trg_entreprises_updated_at
    BEFORE UPDATE ON entreprises_installees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. Points focaux (table liée) ────────────────────────────────────────────

CREATE TABLE entreprises_points_focaux (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entreprise_id   UUID NOT NULL REFERENCES entreprises_installees(id) ON DELETE CASCADE,

    nom             VARCHAR(255) NOT NULL,
    prenom          VARCHAR(255),
    poste           VARCHAR(150),
    telephone       VARCHAR(50),
    mail            VARCHAR(255),
    est_principal   BOOLEAN DEFAULT FALSE,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_focaux_entreprise ON entreprises_points_focaux(entreprise_id);

-- ── 4. Données initiales NAEMA (3 secteurs) ───────────────────────────────────

INSERT INTO ref_secteurs (code, nom) VALUES
    ('S1', 'Secteur primaire'),
    ('S2', 'Secteur secondaire'),
    ('S3', 'Secteur tertiaire');

