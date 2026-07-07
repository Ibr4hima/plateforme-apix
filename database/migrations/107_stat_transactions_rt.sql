-- 107 — Données transactionnelles (resourcetrade.earth) : commerce bilatéral
-- par ressource. Colonnes du fichier : Exporter ISO3, Importer ISO3, Resource,
-- Year, Value (1000USD). Valeur stockée en USD (×1000 à l'import).
-- Les libellés de ressources sont éditables (une modif se répercute partout).

CREATE TABLE IF NOT EXISTS stat_ressources (
    nom_en   TEXT PRIMARY KEY,
    libelle  TEXT
);

CREATE TABLE IF NOT EXISTS stat_transactions (
    id             BIGSERIAL PRIMARY KEY,
    annee          SMALLINT NOT NULL,
    exportateur_id INTEGER NOT NULL REFERENCES ref_pays(id) ON DELETE CASCADE,
    importateur_id INTEGER NOT NULL REFERENCES ref_pays(id) ON DELETE CASCADE,
    ressource      TEXT,
    valeur         DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS idx_tx_annee ON stat_transactions(annee);
CREATE INDEX IF NOT EXISTS idx_tx_exp   ON stat_transactions(exportateur_id, annee);
CREATE INDEX IF NOT EXISTS idx_tx_imp   ON stat_transactions(importateur_id, annee);
CREATE INDEX IF NOT EXISTS idx_tx_res   ON stat_transactions(ressource);
