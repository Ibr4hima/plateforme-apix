-- 105 — Statistiques : données transactionnelles bilatérales (BACI/OEC, HS6).
-- Les libellés produits (par code HS) et unités sont dans des tables de
-- référence : éditer un libellé une fois le répercute partout.

CREATE TABLE IF NOT EXISTS stat_produits (
    hs_code  TEXT PRIMARY KEY,
    libelle  TEXT,            -- libellé affiché (éditable, FR), défaut = nom anglais
    nom_en   TEXT
);

CREATE TABLE IF NOT EXISTS stat_unites (
    code     TEXT PRIMARY KEY,  -- unit_name anglais (clé)
    libelle  TEXT,              -- libellé affiché (éditable, FR)
    abbr     TEXT
);

CREATE TABLE IF NOT EXISTS stat_transactions (
    id             BIGSERIAL PRIMARY KEY,
    annee          SMALLINT NOT NULL,
    exportateur_id INTEGER NOT NULL REFERENCES ref_pays(id) ON DELETE CASCADE,
    importateur_id INTEGER NOT NULL REFERENCES ref_pays(id) ON DELETE CASCADE,
    hs_code        TEXT NOT NULL,
    valeur         DOUBLE PRECISION,
    quantite       DOUBLE PRECISION,
    unite          TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_annee   ON stat_transactions(annee);
CREATE INDEX IF NOT EXISTS idx_tx_exp     ON stat_transactions(exportateur_id, annee);
CREATE INDEX IF NOT EXISTS idx_tx_imp     ON stat_transactions(importateur_id, annee);
CREATE INDEX IF NOT EXISTS idx_tx_hs      ON stat_transactions(hs_code);
