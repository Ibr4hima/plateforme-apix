-- Supprimer type_evenement, est_virtuel, lien_virtuel de la table evenements
ALTER TABLE evenements
    DROP COLUMN IF EXISTS type_evenement,
    DROP COLUMN IF EXISTS est_virtuel,
    DROP COLUMN IF EXISTS lien_virtuel;
