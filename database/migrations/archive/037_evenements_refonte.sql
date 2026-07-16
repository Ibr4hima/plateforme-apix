-- 1. Supprimer physiquement les événements soft-deleted
DELETE FROM evenements WHERE is_deleted = TRUE;

-- 2. Supprimer les colonnes inutiles
ALTER TABLE evenements
    DROP COLUMN IF EXISTS statut,
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS thematiques_naema,
    DROP COLUMN IF EXISTS pays_invites;

-- 3. Ajouter colonnes NAEMA arrays
ALTER TABLE evenements
    ADD COLUMN IF NOT EXISTS secteur_ids  INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS branche_ids  INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS activite_ids INTEGER[] DEFAULT '{}';

-- 4. Ajouter colonne pays_invites_ids (FK vers ref_pays)
ALTER TABLE evenements
    ADD COLUMN IF NOT EXISTS pays_invites_ids INTEGER[] DEFAULT '{}';

-- 5. Contrainte : date_debut >= date du jour (seulement à la création via l'appli)
-- On n'ajoute pas de contrainte CHECK car elle bloquerait les events déjà passés
-- La validation se fait côté application

COMMENT ON COLUMN evenements.secteur_ids    IS 'IDs des secteurs NAEMA';
COMMENT ON COLUMN evenements.branche_ids    IS 'IDs des branches NAEMA';
COMMENT ON COLUMN evenements.activite_ids   IS 'IDs des activités NAEMA';
COMMENT ON COLUMN evenements.pays_invites_ids IS 'IDs des pays invités (ref_pays)';
