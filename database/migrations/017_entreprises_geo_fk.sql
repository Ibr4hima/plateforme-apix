-- =============================================================================
-- Migration 017 — entreprises_installees : region/departement/commune → FK IDs
-- =============================================================================

-- 1. Ajouter les nouvelles colonnes FK
ALTER TABLE entreprises_installees
    ADD COLUMN IF NOT EXISTS region_id          INTEGER REFERENCES ref_regions(id),
    ADD COLUMN IF NOT EXISTS departement_id     INTEGER REFERENCES ref_departements(id),
    ADD COLUMN IF NOT EXISTS arrondissement_id  INTEGER REFERENCES ref_arrondissements(id);

-- 2. Migrer les données existantes (noms → IDs)
UPDATE entreprises_installees e
SET region_id = r.id
FROM ref_regions r
WHERE LOWER(TRIM(e.region)) = LOWER(TRIM(r.nom))
  AND e.region IS NOT NULL AND e.region != '';

UPDATE entreprises_installees e
SET departement_id = d.id
FROM ref_departements d
WHERE LOWER(TRIM(e.departement)) = LOWER(TRIM(d.nom))
  AND e.departement IS NOT NULL AND e.departement != '';

UPDATE entreprises_installees e
SET arrondissement_id = a.id
FROM ref_arrondissements a
WHERE LOWER(TRIM(e.commune)) = LOWER(TRIM(a.nom))
  AND e.commune IS NOT NULL AND e.commune != '';

-- 3. Supprimer les anciennes colonnes texte
ALTER TABLE entreprises_installees
    DROP COLUMN IF EXISTS region,
    DROP COLUMN IF EXISTS departement,
    DROP COLUMN IF EXISTS commune,
    DROP COLUMN IF EXISTS arrondissement;

-- 4. Commentaires
COMMENT ON COLUMN entreprises_installees.region_id         IS 'FK vers ref_regions';
COMMENT ON COLUMN entreprises_installees.departement_id    IS 'FK vers ref_departements';
COMMENT ON COLUMN entreprises_installees.arrondissement_id IS 'FK vers ref_arrondissements';
