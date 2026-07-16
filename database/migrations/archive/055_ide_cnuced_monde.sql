-- =============================================================================
-- Migration 055 — ide_cnuced_monde
--                 Entités "Monde" pour l'agrégation IDE (groupes personnalisés)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ide_cnuced_monde (
    id       SERIAL PRIMARY KEY,
    code     VARCHAR(20)  NOT NULL UNIQUE,
    nom_fr   VARCHAR(200) NOT NULL,
    pays_ids integer[]    NOT NULL DEFAULT '{}'
);

COMMENT ON TABLE  ide_cnuced_monde          IS 'Entités agrégées pour l''onglet Monde IDE (ex: UEMOA, G7, Monde)';
COMMENT ON COLUMN ide_cnuced_monde.code     IS 'Code court unique (ex: UEMOA, G7, MONDE)';
COMMENT ON COLUMN ide_cnuced_monde.nom_fr   IS 'Nom complet en français';
COMMENT ON COLUMN ide_cnuced_monde.pays_ids IS 'IDs des pays membres (référence ref_pays.id)';
