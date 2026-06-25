-- Migration 091 : tables pour les modalités d'application du code des investissements
CREATE TABLE IF NOT EXISTS modalites_pdf (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titre        VARCHAR(500) DEFAULT 'Modalités d''application du code des investissements',
    fichier_nom  VARCHAR(500),
    fichier_path TEXT,
    version      VARCHAR(100),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modalites_chapitres (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero     INTEGER NOT NULL,
    titre      VARCHAR(500) NOT NULL,
    contenu    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modalites_sections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapitre_id UUID NOT NULL REFERENCES modalites_chapitres(id) ON DELETE CASCADE,
    numero      INTEGER NOT NULL,
    titre       VARCHAR(500) NOT NULL,
    contenu     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modalites_articles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapitre_id UUID NOT NULL REFERENCES modalites_chapitres(id) ON DELETE CASCADE,
    section_id  UUID REFERENCES modalites_sections(id) ON DELETE SET NULL,
    numero      INTEGER NOT NULL UNIQUE,
    titre       VARCHAR(500),
    contenu     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
