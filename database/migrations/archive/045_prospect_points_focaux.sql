-- Migration 045 : Table points focaux pour les prospects (personne morale)

CREATE TABLE IF NOT EXISTS prospect_points_focaux (
  id          SERIAL PRIMARY KEY,
  prospect_id INT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  prenom      VARCHAR(150),
  nom         VARCHAR(150) NOT NULL,
  telephones  TEXT[] DEFAULT '{}',
  mails       TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_points_focaux_prospect ON prospect_points_focaux(prospect_id);
