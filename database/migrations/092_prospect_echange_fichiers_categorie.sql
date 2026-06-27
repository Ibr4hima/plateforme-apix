-- Migration 092 : distinguer le compte rendu des autres documents d'un échange
ALTER TABLE prospect_echange_fichiers
    ADD COLUMN IF NOT EXISTS categorie VARCHAR(20) NOT NULL DEFAULT 'autre';
