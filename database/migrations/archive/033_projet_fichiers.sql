CREATE TABLE IF NOT EXISTS projet_fichiers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id    UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    titre        VARCHAR(500),
    fichier_nom  VARCHAR(500),
    fichier_path TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE projet_fichiers IS 'Fichiers PDF attachés aux projets';
