-- Migration 082 : BDEF — table des valeurs rejetées à l'import
-- Les valeurs qui déclenchent une erreur de borne (montant négatif impossible,
-- valeur démesurée) ne sont pas écrites dans bdef_valeurs à l'import.
-- Elles sont stockées ici pour correction manuelle via l'interface d'administration.

CREATE TABLE bdef_valeurs_rejetees (
    id               SERIAL PRIMARY KEY,
    import_id        INTEGER REFERENCES bdef_imports(id) ON DELETE SET NULL,
    indicateur_id    INTEGER NOT NULL REFERENCES bdef_indicateurs(id),
    indicateur_code  VARCHAR(60),
    niveau           VARCHAR(20) NOT NULL,
    macro_secteur_id INTEGER REFERENCES bdef_macro_secteurs(id),
    groupe_id        INTEGER REFERENCES bdef_groupes(id),
    secteur_id       INTEGER REFERENCES bdef_secteurs(id),
    libelle_cible    VARCHAR(500),
    annee            SMALLINT NOT NULL,
    valeur_source    NUMERIC(20,4) NOT NULL,
    raison           VARCHAR(200),
    statut           VARCHAR(20) NOT NULL DEFAULT 'en_attente',
    cree_le          TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_bdef_valeurs_rejetees_statut ON bdef_valeurs_rejetees(statut);
CREATE INDEX idx_bdef_valeurs_rejetees_import  ON bdef_valeurs_rejetees(import_id);
