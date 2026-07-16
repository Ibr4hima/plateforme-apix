-- Migration 050 : Remplacement prospect_contacts par prospect_echanges
-- Fil chronologique immuable des échanges avec les investisseurs

DROP TABLE IF EXISTS prospect_contacts_historique CASCADE;
DROP TABLE IF EXISTS prospect_contacts CASCADE;

CREATE TABLE prospect_echanges (
  id            SERIAL PRIMARY KEY,
  prospect_id   INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  date_echange  DATE NOT NULL,
  commentaire   TEXT,
  contact_par   VARCHAR(255) NOT NULL,
  enregistre_le TIMESTAMPTZ DEFAULT NOW()
  -- Pas de is_deleted : les entrées sont immuables
);

CREATE INDEX idx_prospect_echanges_prospect ON prospect_echanges(prospect_id);
CREATE INDEX idx_prospect_echanges_date ON prospect_echanges(prospect_id, date_echange);
