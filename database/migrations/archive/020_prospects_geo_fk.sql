-- =============================================================================
-- Migration 020 — prospects : region/departement/arrondissement/siege_pays → FK
-- =============================================================================

-- 1. Ajouter les colonnes FK
ALTER TABLE prospects
    ADD COLUMN IF NOT EXISTS region_id          INTEGER REFERENCES ref_regions(id),
    ADD COLUMN IF NOT EXISTS departement_id     INTEGER REFERENCES ref_departements(id),
    ADD COLUMN IF NOT EXISTS arrondissement_id  INTEGER REFERENCES ref_arrondissements(id),
    ADD COLUMN IF NOT EXISTS siege_pays_id      INTEGER REFERENCES ref_pays(id);

-- 2. Migrer les données existantes
UPDATE prospects p SET region_id = r.id
FROM ref_regions r WHERE LOWER(TRIM(p.region)) = LOWER(TRIM(r.nom)) AND p.region IS NOT NULL;

UPDATE prospects p SET departement_id = d.id
FROM ref_departements d WHERE LOWER(TRIM(p.departement)) = LOWER(TRIM(d.nom)) AND p.departement IS NOT NULL;

UPDATE prospects p SET arrondissement_id = a.id
FROM ref_arrondissements a WHERE LOWER(TRIM(p.arrondissement)) = LOWER(TRIM(a.nom)) AND p.arrondissement IS NOT NULL;

UPDATE prospects p SET siege_pays_id = pays.id
FROM ref_pays pays WHERE LOWER(TRIM(p.siege_pays)) = LOWER(TRIM(pays.nom_fr)) AND p.siege_pays IS NOT NULL;

-- 3. Supprimer les anciennes colonnes texte
ALTER TABLE prospects
    DROP COLUMN IF EXISTS region,
    DROP COLUMN IF EXISTS departement,
    DROP COLUMN IF EXISTS arrondissement,
    DROP COLUMN IF EXISTS siege_pays,
    DROP COLUMN IF EXISTS note_interne;
