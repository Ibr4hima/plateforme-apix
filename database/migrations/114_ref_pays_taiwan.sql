-- =============================================================================
-- Migration 114 — Ajout de Taïwan au référentiel pays
--   Absent du seed d'origine ; requis pour les accords (TBI Sénégal — Taïwan).
--   Idempotent : l'insertion est ignorée si le code ISO3 existe déjà.
-- =============================================================================

INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr, continent, region_geo, actif)
SELECT 'TW', 'TWN', 'Taïwan', 'Asie', 'Asie orientale', TRUE
WHERE NOT EXISTS (SELECT 1 FROM ref_pays WHERE code_iso3 = 'TWN');
