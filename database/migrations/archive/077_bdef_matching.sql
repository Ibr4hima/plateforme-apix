-- Table des alias (mémoire persistante des matchings confirmés)
CREATE TABLE bdef_secteur_alias (
    id         SERIAL PRIMARY KEY,
    libelle_brut TEXT NOT NULL,        -- texte brut tel qu'il apparaît dans le fichier Excel
    secteur_id INTEGER NOT NULL REFERENCES bdef_secteurs(id) ON DELETE CASCADE,
    cree_le    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(libelle_brut)
);

-- Table de revue (file d'attente pour les matchings incertains)
-- Une ligne BDEF non matchée avec certitude atterrit ici.
-- Quand un humain valide → on écrit la valeur et on crée l'alias.
CREATE TABLE bdef_import_revue (
    id             SERIAL PRIMARY KEY,
    import_id      INTEGER NOT NULL,       -- référence à un futur bdef_imports.id
    libelle_brut   TEXT NOT NULL,          -- texte brut du secteur dans le fichier
    score_fuzzy    NUMERIC(5,2),           -- score du meilleur candidat (0-100)
    candidats      JSONB,                  -- top 5 candidats [{secteur_id, libelle, score}]
    secteur_id_valide INTEGER REFERENCES bdef_secteurs(id),  -- NULL jusqu'à validation
    valide_le      TIMESTAMPTZ,
    valide_par     TEXT,
    statut         VARCHAR(20) NOT NULL DEFAULT 'en_attente',  -- en_attente | valide | rejete
    cree_le        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON bdef_import_revue(import_id);
CREATE INDEX ON bdef_import_revue(statut);
