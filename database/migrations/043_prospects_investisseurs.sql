-- Migration 043 : Ajout des champs investisseur (type physique/morale, prenom, pays_origine, details)
-- sur la table prospects

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS type           VARCHAR(10)  DEFAULT 'physique',
  ADD COLUMN IF NOT EXISTS prenom         VARCHAR(150),
  ADD COLUMN IF NOT EXISTS pays_origine_id INT REFERENCES ref_pays(id),
  ADD COLUMN IF NOT EXISTS details        TEXT;

-- Index sur pays_origine_id
CREATE INDEX IF NOT EXISTS idx_prospects_pays_origine ON prospects(pays_origine_id);

-- Mettre 'morale' pour les prospects déjà existants (ils étaient enterprise-centric)
UPDATE prospects SET type = 'morale' WHERE type IS NULL OR type = 'physique';
