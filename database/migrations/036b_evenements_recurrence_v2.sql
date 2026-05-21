
-- Remplacer date_prochaine (DATE) par 3 champs séparés
ALTER TABLE evenements
    DROP COLUMN IF EXISTS date_prochaine,
    ADD COLUMN IF NOT EXISTS prochain_jour    SMALLINT CHECK (prochain_jour BETWEEN 1 AND 31),
    ADD COLUMN IF NOT EXISTS prochain_mois    SMALLINT CHECK (prochain_mois BETWEEN 1 AND 12),
    ADD COLUMN IF NOT EXISTS prochain_annee   SMALLINT CHECK (prochain_annee >= 2024),
    ADD COLUMN IF NOT EXISTS duree_jours      SMALLINT CHECK (duree_jours > 0);
