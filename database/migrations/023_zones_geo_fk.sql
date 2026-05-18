-- Migration 023 — zones_investissement : ajout colonnes localisation FK
ALTER TABLE zones_investissement
    ADD COLUMN IF NOT EXISTS region_id          INTEGER REFERENCES ref_regions(id),
    ADD COLUMN IF NOT EXISTS departement_id     INTEGER REFERENCES ref_departements(id),
    ADD COLUMN IF NOT EXISTS arrondissement_id  INTEGER REFERENCES ref_arrondissements(id);
