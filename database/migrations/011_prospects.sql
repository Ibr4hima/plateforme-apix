-- Migration 011 : Module Prospects

-- Table principale : entreprises ciblées
CREATE TABLE prospects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Identification
    nom                 VARCHAR(255) NOT NULL,
    forme_juridique     VARCHAR(100),
    date_creation_ent   DATE,
    -- Siège social
    siege_pays          VARCHAR(100),
    -- Localisation Sénégal (si implantation prévue)
    pays                VARCHAR(100) DEFAULT 'Sénégal',
    region              VARCHAR(100),
    departement         VARCHAR(100),
    arrondissement      VARCHAR(100),
    adresse             TEXT,
    -- Contact
    telephone           VARCHAR(30),
    mail                VARCHAR(255),
    siteweb             VARCHAR(255),
    -- Classification NAEMA
    secteur_id          INTEGER REFERENCES ref_secteurs(id),
    branche_id          INTEGER REFERENCES ref_branches(id),
    activite_id         INTEGER REFERENCES ref_activites(id),
    -- Point d'entrée
    point_entree        TEXT,
    -- Metadata
    est_publie          BOOLEAN DEFAULT TRUE,
    note_interne        TEXT,
    is_deleted          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Points focaux des prospects
CREATE TABLE prospect_points_focaux (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id     UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    nom             VARCHAR(100) NOT NULL,
    prenom          VARCHAR(100),
    poste           VARCHAR(100),
    telephone       VARCHAR(30),
    mail            VARCHAR(255),
    est_principal   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts (chaque prise de contact avec un prospect)
CREATE TABLE prospect_contacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id         UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    -- Projet concerné
    projet_nom          VARCHAR(255) NOT NULL,
    projet_description  TEXT,
    -- Premier contact
    date_premier_contact DATE NOT NULL,
    -- État actuel
    etat_avancement     VARCHAR(50) NOT NULL DEFAULT 'en_cours',
    -- Détails
    commentaires        TEXT,
    contraintes         TEXT,
    -- Metadata
    is_deleted          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Historique des changements d'état pour chaque contact
CREATE TABLE prospect_contacts_historique (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      UUID NOT NULL REFERENCES prospect_contacts(id) ON DELETE CASCADE,
    etat            VARCHAR(50) NOT NULL,
    commentaire     TEXT,
    date_changement TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_prospects_nom         ON prospects(nom);
CREATE INDEX idx_prospects_secteur     ON prospects(secteur_id);
CREATE INDEX idx_contacts_prospect     ON prospect_contacts(prospect_id);
CREATE INDEX idx_historique_contact    ON prospect_contacts_historique(contact_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospects_updated_at
    BEFORE UPDATE ON prospects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contacts_updated_at
    BEFORE UPDATE ON prospect_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Vérification
SELECT 'prospects' AS table_name, count(*) FROM prospects
UNION ALL
SELECT 'prospect_contacts', count(*) FROM prospect_contacts
UNION ALL
SELECT 'prospect_contacts_historique', count(*) FROM prospect_contacts_historique;
