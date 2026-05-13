-- Migration 002 : Refonte table événements
-- Drop et recréation propre

DROP TABLE IF EXISTS evenements_participants CASCADE;
DROP TABLE IF EXISTS evenements CASCADE;

CREATE TABLE evenements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    nom_event           VARCHAR(500) NOT NULL,
    edition             VARCHAR(50),
    type_evenement      VARCHAR(50) NOT NULL
        CHECK (type_evenement IN ('salon', 'forum', 'conference', 'mission_prospection',
                                   'roadshow', 'b2b', 'webinaire', 'visite_terrain', 'autre')),
    organisateur        VARCHAR(255),
    role_apix           VARCHAR(50)
        CHECK (role_apix IN ('organisateur', 'co_organisateur', 'participant', 'sponsor', 'invite')),
    description         TEXT,
    lien_site_officiel  TEXT,

    -- Dates
    date_debut          DATE NOT NULL,
    date_fin            DATE NOT NULL,

    -- Récurrence
    est_recurrent       BOOLEAN DEFAULT FALSE,
    frequence           VARCHAR(30)
        CHECK (frequence IN ('hebdomadaire', 'mensuel', 'trimestriel',
                              'semestriel', 'annuel', 'biennal')),
    date_prochaine_edition DATE,

    -- Lieu
    pays_id             INTEGER REFERENCES ref_pays(id),
    pays_nom            VARCHAR(100),
    ville               VARCHAR(100),
    lieu_nom            VARCHAR(255),
    est_virtuel         BOOLEAN DEFAULT FALSE,
    lien_virtuel        TEXT,

    -- Contenu
    thematiques         TEXT,   -- Branches/secteurs ciblés, séparés par virgules
    pays_invites        TEXT,   -- Pays invités, séparés par virgules
    entreprises_invitees TEXT,  -- Entreprises invitées, séparés par virgules

    -- Résultats (remplis après l'événement)
    nombre_participants         INTEGER,
    nombre_prospects_rencontres INTEGER,
    montant_intentions_usd      NUMERIC(18, 2),
    rapport_disponible          BOOLEAN DEFAULT FALSE,
    lien_rapport                TEXT,

    -- Statut
    statut              VARCHAR(30) DEFAULT 'planifie'
        CHECK (statut IN ('planifie', 'en_cours', 'termine', 'annule', 'reporte')),

    -- Visibilité
    est_publie          BOOLEAN DEFAULT TRUE,

    -- Traçabilité
    note_interne        TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    is_deleted          BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_evenements_date      ON evenements(date_debut);
CREATE INDEX idx_evenements_type      ON evenements(type_evenement);
CREATE INDEX idx_evenements_statut    ON evenements(statut);
CREATE INDEX idx_evenements_publie    ON evenements(est_publie);
CREATE INDEX idx_evenements_pays      ON evenements(pays_id);

-- Trigger updated_at
CREATE TRIGGER trg_evenements_updated_at
    BEFORE UPDATE ON evenements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
