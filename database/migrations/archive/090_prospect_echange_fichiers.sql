-- Migration 090 : table des fichiers PDF attachés aux échanges prospects
CREATE TABLE IF NOT EXISTS prospect_echange_fichiers (
    id          SERIAL PRIMARY KEY,
    echange_id  INTEGER NOT NULL REFERENCES prospect_echanges(id) ON DELETE CASCADE,
    titre       VARCHAR(255) NOT NULL,
    nom_fichier VARCHAR(255) NOT NULL,
    chemin      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_echange_fichiers_echange
    ON prospect_echange_fichiers(echange_id);
