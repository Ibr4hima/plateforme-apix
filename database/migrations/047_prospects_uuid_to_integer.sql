-- Migration 047 : Convertir les PKs UUID → SERIAL INTEGER dans les tables prospects
-- Les données existantes sont perdues (acceptable en dev)

DROP TABLE IF EXISTS prospect_contacts_historique CASCADE;
DROP TABLE IF EXISTS prospect_contacts CASCADE;
DROP TABLE IF EXISTS prospect_points_focaux CASCADE;
DROP TABLE IF EXISTS prospects CASCADE;

CREATE TABLE prospects (
    id               SERIAL PRIMARY KEY,
    type             VARCHAR(10) DEFAULT 'physique',
    nom              VARCHAR(255) NOT NULL,
    prenom           VARCHAR(150),
    pays_origine_id  INTEGER REFERENCES ref_pays(id),
    siege_id         INTEGER REFERENCES ref_pays(id),
    adresse          TEXT,
    telephones       TEXT[] DEFAULT '{}',
    mails            TEXT[] DEFAULT '{}',
    siteweb          TEXT,
    secteur_ids      INTEGER[] DEFAULT '{}',
    branche_ids      INTEGER[] DEFAULT '{}',
    activite_ids     INTEGER[] DEFAULT '{}',
    point_entree     TEXT,
    details          TEXT,
    est_publie       BOOLEAN DEFAULT TRUE,
    is_deleted       BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prospect_points_focaux (
    id          SERIAL PRIMARY KEY,
    prospect_id INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    prenom      VARCHAR(150),
    nom         VARCHAR(150) NOT NULL,
    telephones  TEXT[] DEFAULT '{}',
    mails       TEXT[] DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prospect_contacts (
    id                   SERIAL PRIMARY KEY,
    prospect_id          INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    projet_nom           VARCHAR(255) NOT NULL,
    projet_description   TEXT,
    date_premier_contact DATE NOT NULL,
    etat_avancement      VARCHAR(50) DEFAULT 'en_cours',
    commentaires         TEXT,
    contraintes          TEXT,
    is_deleted           BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prospect_contacts_historique (
    id              SERIAL PRIMARY KEY,
    contact_id      INTEGER NOT NULL REFERENCES prospect_contacts(id) ON DELETE CASCADE,
    etat            VARCHAR(50) NOT NULL,
    commentaire     TEXT,
    date_changement TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospects_nom              ON prospects(nom);
CREATE INDEX IF NOT EXISTS idx_prospect_points_focaux_pid ON prospect_points_focaux(prospect_id);
CREATE INDEX IF NOT EXISTS idx_contacts_prospect          ON prospect_contacts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_historique_contact         ON prospect_contacts_historique(contact_id);
