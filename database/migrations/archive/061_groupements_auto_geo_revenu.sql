-- =============================================================================
-- Migration 061 — Créer des groupements auto depuis ref_pays
--                 (continent, région géographique, niveau de revenu)
--                 Codes = nom en MAJUSCULES (espaces → _, accents supprimés)
-- =============================================================================

-- Élargir code pour accueillir les noms longs (ex: REVENU_INTERMEDIAIRE_SUPERIEUR)
ALTER TABLE ref_groupements ALTER COLUMN code TYPE VARCHAR(50);

-- Activer unaccent pour normaliser les accents dans les codes
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Helper temporaire : nom → CODE_MAJUSCULE
CREATE OR REPLACE FUNCTION _tmp_code(val text) RETURNS text AS $$
    SELECT REGEXP_REPLACE(UPPER(unaccent(val)), '[^A-Z0-9]+', '_', 'g');
$$ LANGUAGE SQL IMMUTABLE;

-- ── 1. Groupements par continent ─────────────────────────────────────────────
INSERT INTO ref_groupements (code, nom_fr, description)
SELECT DISTINCT
    _tmp_code(continent),
    continent,
    'Regroupement géographique – Continent'
FROM ref_pays
WHERE continent IS NOT NULL AND continent != '' AND actif = true
ON CONFLICT (code) DO NOTHING;

-- ── 2. Groupements par région géographique ────────────────────────────────────
INSERT INTO ref_groupements (code, nom_fr, description)
SELECT DISTINCT
    _tmp_code(region_geo),
    region_geo,
    'Regroupement géographique – Région'
FROM ref_pays
WHERE region_geo IS NOT NULL AND region_geo != '' AND actif = true
ON CONFLICT (code) DO NOTHING;

-- ── 3. Groupements par niveau de revenu ──────────────────────────────────────
INSERT INTO ref_groupements (code, nom_fr, description)
SELECT DISTINCT
    _tmp_code(niveau_revenu),
    niveau_revenu,
    'Regroupement économique – Niveau de revenu'
FROM ref_pays
WHERE niveau_revenu IS NOT NULL AND niveau_revenu != '' AND actif = true
ON CONFLICT (code) DO NOTHING;

-- ── 4. Peupler ref_pays_groupements ──────────────────────────────────────────
-- Les triggers existants (trg_sync_pays_ids + trg_sync_icm_on_groupement)
-- mettront automatiquement à jour ref_groupements.pays_ids et ide_cnuced_monde.

-- Continents
INSERT INTO ref_pays_groupements (pays_id, groupement_id)
SELECT p.id, g.id
FROM ref_pays p
JOIN ref_groupements g ON g.code = _tmp_code(p.continent)
WHERE p.continent IS NOT NULL AND p.continent != '' AND p.actif = true
ON CONFLICT DO NOTHING;

-- Régions
INSERT INTO ref_pays_groupements (pays_id, groupement_id)
SELECT p.id, g.id
FROM ref_pays p
JOIN ref_groupements g ON g.code = _tmp_code(p.region_geo)
WHERE p.region_geo IS NOT NULL AND p.region_geo != '' AND p.actif = true
ON CONFLICT DO NOTHING;

-- Niveaux de revenu
INSERT INTO ref_pays_groupements (pays_id, groupement_id)
SELECT p.id, g.id
FROM ref_pays p
JOIN ref_groupements g ON g.code = _tmp_code(p.niveau_revenu)
WHERE p.niveau_revenu IS NOT NULL AND p.niveau_revenu != '' AND p.actif = true
ON CONFLICT DO NOTHING;

-- ── Nettoyage ─────────────────────────────────────────────────────────────────
DROP FUNCTION _tmp_code(text);

-- ── Vérification rapide ───────────────────────────────────────────────────────
SELECT code, nom_fr, array_length(pays_ids, 1) AS nb_pays
FROM ref_groupements
WHERE code ~ '^[A-Z]'
  AND code NOT IN ('G7','G20','BRICS','UE','CEDEAO','ASEAN','MERCOSUR','UA','OCDE')
ORDER BY code;
