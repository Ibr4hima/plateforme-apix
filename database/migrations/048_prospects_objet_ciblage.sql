-- Migration 048 : Champs "objet du ciblage" pour les prospects investisseurs

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS objet_projet               BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS objet_projet_id            INTEGER REFERENCES projets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS objet_intentions_etranger  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS objet_intentions_details   TEXT,
  ADD COLUMN IF NOT EXISTS objet_adequation_senegal   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS objet_adequation_details   TEXT,
  ADD COLUMN IF NOT EXISTS objet_secteur_prioritaire  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS objet_secteur_details      TEXT,
  ADD COLUMN IF NOT EXISTS objet_commentaires         TEXT;
