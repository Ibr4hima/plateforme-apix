-- Migration 003 : Refonte table accords_traites

DROP TABLE IF EXISTS accords_traites CASCADE;

CREATE TABLE accords_traites (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    titre                   VARCHAR(500) NOT NULL,
    reference               VARCHAR(100),
    type_accord             VARCHAR(100),

    -- Parties
    pays_signataires        TEXT,
    organisation_partenaire VARCHAR(255),

    -- Dates
    date_signature          DATE,
    date_ratification       DATE,
    date_entree_vigueur     DATE,
    date_expiration         DATE,

    -- Secteur / Branche
    secteur_activite        VARCHAR(100),
    branche_activite        TEXT,

    -- Contenu
    commentaires            TEXT,
    domaines_couverts       TEXT,
    avantages_principaux    TEXT,

    -- Statut
    statut                  VARCHAR(50) DEFAULT 'en_vigueur'
        CHECK (statut IN ('en_vigueur', 'signe_non_ratifie', 'expire', 'suspendu', 'negocie')),

    -- Fichier PDF
    fichier_nom             VARCHAR(255),
    fichier_path            TEXT,
    lien_texte_officiel     TEXT,

    -- Visibilité
    est_publie              BOOLEAN DEFAULT TRUE,
    note_interne            TEXT,

    -- Traçabilité
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    created_by              VARCHAR(100),
    is_deleted              BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_accords_statut   ON accords_traites(statut);
CREATE INDEX idx_accords_type     ON accords_traites(type_accord);
CREATE INDEX idx_accords_date     ON accords_traites(date_signature);
CREATE INDEX idx_accords_publie   ON accords_traites(est_publie);

CREATE TRIGGER trg_accords_updated_at
    BEFORE UPDATE ON accords_traites
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
