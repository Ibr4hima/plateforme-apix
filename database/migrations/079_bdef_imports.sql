-- Migration 079 : BDEF — table d'import + alias/revue polymorphes
--
-- Le matching s'opère à 3 niveaux (secteur / groupe / macro-secteur), dont les
-- identifiants vivent dans 3 tables distinctes. Les tables d'alias et de revue
-- créées en 077 ne géraient que le niveau secteur ; on les généralise en
-- (niveau, cible_id) où cible_id est l'id dans la table du niveau concerné.
--
-- Ces tables venant d'être créées (077) et sans données, on les recrée
-- proprement plutôt que d'empiler des ALTER.

-- ── Traçabilité des imports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bdef_imports (
    id          SERIAL PRIMARY KEY,
    fichier     TEXT NOT NULL,                       -- nom du fichier importé
    statut      VARCHAR(20) NOT NULL DEFAULT 'en_cours',  -- en_cours|en_revue|termine|annule
    annees      JSONB,                               -- années détectées dans le fichier
    nb_valeurs  INTEGER NOT NULL DEFAULT 0,          -- valeurs écrites dans bdef_valeurs
    nb_revue    INTEGER NOT NULL DEFAULT 0,          -- secteurs partis en revue
    cree_par    TEXT,
    cree_le     TIMESTAMPTZ NOT NULL DEFAULT now(),
    termine_le  TIMESTAMPTZ
);

-- ── Alias polymorphes ─────────────────────────────────────────────────────────
DROP TABLE IF EXISTS bdef_secteur_alias CASCADE;
CREATE TABLE bdef_secteur_alias (
    id           SERIAL PRIMARY KEY,
    niveau       VARCHAR(15) NOT NULL,               -- secteur|groupe|macro_secteur
    libelle_brut TEXT NOT NULL,                      -- texte brut du fichier Excel
    cible_id     INTEGER NOT NULL,                   -- id dans la table du niveau
    cree_le      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (niveau, libelle_brut)
);

-- ── File de revue polymorphe ──────────────────────────────────────────────────
DROP TABLE IF EXISTS bdef_import_revue CASCADE;
CREATE TABLE bdef_import_revue (
    id              SERIAL PRIMARY KEY,
    import_id       INTEGER NOT NULL REFERENCES bdef_imports(id) ON DELETE CASCADE,
    niveau          VARCHAR(15) NOT NULL,            -- secteur|groupe|macro_secteur
    code_bdef       VARCHAR(10),                     -- code brut du fichier (traçabilité)
    libelle_brut    TEXT NOT NULL,                   -- texte brut du secteur
    score_fuzzy     NUMERIC(5,2),                    -- score du meilleur candidat (0-100)
    candidats       JSONB,                           -- top candidats [{cible_id, libelle, score}]
    cible_id_valide INTEGER,                         -- NULL jusqu'à validation
    statut          VARCHAR(20) NOT NULL DEFAULT 'en_attente',  -- en_attente|valide|rejete
    valide_le       TIMESTAMPTZ,
    valide_par      TEXT,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bdef_revue_import ON bdef_import_revue (import_id);
CREATE INDEX idx_bdef_revue_statut ON bdef_import_revue (statut);
CREATE INDEX idx_bdef_alias_lookup ON bdef_secteur_alias (niveau, libelle_brut);
