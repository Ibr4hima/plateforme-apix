-- Migration 051 : contact_par nullable + table contraintes investisseur

-- contact_par devient optionnel (sera rempli automatiquement avec l'auth)
ALTER TABLE prospect_echanges ALTER COLUMN contact_par DROP NOT NULL;
ALTER TABLE prospect_echanges ALTER COLUMN contact_par SET DEFAULT NULL;

-- Contraintes exprimées par l'investisseur
CREATE TABLE prospect_contraintes (
  id                  SERIAL PRIMARY KEY,
  prospect_id         INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  solution_preconisee TEXT,
  statut              VARCHAR(20) DEFAULT 'en_cours',  -- en_cours | resolue | obsolete
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospect_contraintes_prospect ON prospect_contraintes(prospect_id);
