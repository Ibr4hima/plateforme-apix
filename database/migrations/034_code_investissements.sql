-- =============================================================================
-- Migration 034 — Code des investissements du Sénégal
-- =============================================================================

-- PDF du décret officiel
CREATE TABLE IF NOT EXISTS code_investissement_pdf (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titre        VARCHAR(500) NOT NULL DEFAULT 'Code des investissements du Sénégal',
    fichier_nom  VARCHAR(500),
    fichier_path TEXT,
    version      VARCHAR(100),   -- ex: "Loi n° 2004-06 du 06 février 2004"
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Chapitres (numéro en chiffres romains, ex: I, II, III, "premier")
CREATE TABLE IF NOT EXISTS code_chapitres (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero       INTEGER NOT NULL,          -- pour le tri
    titre        VARCHAR(500) NOT NULL,     -- ex: "Protection de l'investisseur"
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Sections (optionnelles, rattachées à un chapitre)
CREATE TABLE IF NOT EXISTS code_sections (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapitre_id  UUID NOT NULL REFERENCES code_chapitres(id) ON DELETE CASCADE,
    numero       INTEGER NOT NULL,
    titre        VARCHAR(500) NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Articles (rattachés soit à un chapitre, soit à une section)
CREATE TABLE IF NOT EXISTS code_articles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapitre_id  UUID NOT NULL REFERENCES code_chapitres(id) ON DELETE CASCADE,
    section_id   UUID REFERENCES code_sections(id) ON DELETE SET NULL,  -- null = directement sous le chapitre
    numero       INTEGER NOT NULL UNIQUE,   -- s'incrémente globalement
    titre        VARCHAR(500),             -- ex: "Égalité de traitement"
    contenu      TEXT NOT NULL DEFAULT '',  -- texte de l'article (avec markdown léger)
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour navigation et recherche
CREATE INDEX IF NOT EXISTS idx_code_articles_numero     ON code_articles(numero);
CREATE INDEX IF NOT EXISTS idx_code_articles_chapitre   ON code_articles(chapitre_id);
CREATE INDEX IF NOT EXISTS idx_code_articles_section    ON code_articles(section_id);
CREATE INDEX IF NOT EXISTS idx_code_sections_chapitre   ON code_sections(chapitre_id);
-- Recherche full-text
CREATE INDEX IF NOT EXISTS idx_code_articles_fts ON code_articles
    USING gin(to_tsvector('french', coalesce(titre,'') || ' ' || contenu));

COMMENT ON TABLE code_chapitres IS 'Chapitres du code des investissements (numérotation romaine)';
COMMENT ON TABLE code_sections  IS 'Sections optionnelles au sein d''un chapitre';
COMMENT ON TABLE code_articles  IS 'Articles du code — numérotation globale continue';
