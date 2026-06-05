-- Migration 052 : Suppression de la colonne 'code' inutile sur les 3 tables geo

ALTER TABLE ref_regions        DROP COLUMN IF EXISTS code;
ALTER TABLE ref_departements   DROP COLUMN IF EXISTS code;
ALTER TABLE ref_arrondissements DROP COLUMN IF EXISTS code;
