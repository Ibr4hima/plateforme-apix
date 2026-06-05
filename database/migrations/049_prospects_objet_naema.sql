-- Migration 049 : NAEMA par objet de ciblage, suppression secteur_prioritaire

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS objet_intentions_secteur_ids  INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS objet_intentions_branche_ids  INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS objet_intentions_activite_ids INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS objet_adequation_secteur_ids  INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS objet_adequation_branche_ids  INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS objet_adequation_activite_ids INTEGER[] DEFAULT '{}';

ALTER TABLE prospects
  DROP COLUMN IF EXISTS objet_secteur_prioritaire,
  DROP COLUMN IF EXISTS objet_secteur_details;
