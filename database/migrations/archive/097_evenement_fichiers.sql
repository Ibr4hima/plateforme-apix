-- Migration 097 : documents PDF attachés aux événements
-- Même modèle que zone_fichiers / pole_fichiers.

CREATE TABLE IF NOT EXISTS evenement_fichiers (
    id           SERIAL PRIMARY KEY,
    evenement_id INTEGER NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
    nom          VARCHAR(500),
    url          TEXT,
    type_fichier VARCHAR(10) DEFAULT 'PDF',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evenement_fichiers_evenement ON evenement_fichiers (evenement_id);
