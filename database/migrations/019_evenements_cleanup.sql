-- =============================================================================
-- Migration 019 — Table evenements : nettoyage colonnes + pays_hote_id FK
-- =============================================================================

-- 1. Supprimer les lignes soft-deleted qui traînent
DELETE FROM evenements WHERE is_deleted = TRUE;

-- 2. Ajouter pays_hote_id FK
ALTER TABLE evenements
    ADD COLUMN IF NOT EXISTS pays_hote_id INTEGER REFERENCES ref_pays(id);

-- 3. Migrer les données existantes (pays_nom → pays_hote_id)
UPDATE evenements e
SET pays_hote_id = p.id
FROM ref_pays p
WHERE LOWER(TRIM(e.pays_nom)) = LOWER(TRIM(p.nom_fr))
  AND e.pays_nom IS NOT NULL AND e.pays_nom != '';

-- 4. Supprimer les colonnes inutiles
ALTER TABLE evenements
    DROP COLUMN IF EXISTS lien_site_officiel,
    DROP COLUMN IF EXISTS est_recurrent,
    DROP COLUMN IF EXISTS frequence,
    DROP COLUMN IF EXISTS date_prochaine_edition,
    DROP COLUMN IF EXISTS pays_id,
    DROP COLUMN IF EXISTS lieu_nom,
    DROP COLUMN IF EXISTS thematiques,
    DROP COLUMN IF EXISTS nombre_participants,
    DROP COLUMN IF EXISTS nombre_prospects_rencontres,
    DROP COLUMN IF EXISTS montant_intentions_usd,
    DROP COLUMN IF EXISTS rapport_disponible,
    DROP COLUMN IF EXISTS lien_rapport,
    DROP COLUMN IF EXISTS note_interne,
    DROP COLUMN IF EXISTS pays_nom;

COMMENT ON COLUMN evenements.pays_hote_id IS 'FK vers ref_pays — pays hôte de l''événement';
