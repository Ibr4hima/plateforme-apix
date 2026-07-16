-- Migration 087 — Supprimer les champs propres à « Personne physique »
-- Tous les prospects sont désormais des personnes morales.

-- Mettre à jour les prospects existants de type physique
UPDATE prospects
SET type   = 'morale',
    prenom = NULL,
    pays_origine_id = NULL
WHERE type IS NULL OR type = 'physique';

ALTER TABLE prospects
    DROP COLUMN IF EXISTS prenom,
    DROP COLUMN IF EXISTS pays_origine_id,
    ALTER COLUMN type SET DEFAULT 'morale';
