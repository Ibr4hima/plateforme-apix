-- Migration 096 : documents PDF attachés aux pôles territoriaux
-- Même modèle que zone_fichiers (un ou plusieurs PDF par pôle).

CREATE TABLE IF NOT EXISTS pole_fichiers (
    id           SERIAL PRIMARY KEY,
    pole_id      INTEGER NOT NULL REFERENCES poles_territoires(id) ON DELETE CASCADE,
    nom          VARCHAR(500),
    url          TEXT,
    type_fichier VARCHAR(10) DEFAULT 'PDF',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pole_fichiers_pole ON pole_fichiers (pole_id);
