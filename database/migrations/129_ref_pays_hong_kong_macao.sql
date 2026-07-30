-- =============================================================================
-- Migration 129 — Hong Kong et Macao au référentiel pays
--
-- Ces deux régions administratives spéciales chinoises sont des partenaires
-- commerciaux à part entière du Sénégal, mais absentes du seed d'origine qui
-- ne retient que des États souverains. Elles finissaient donc regroupées
-- sous « Autres pays » dans la famille NACE pays/régions.
--
-- Le poids commercial justifie l'ajout. Sur les 6 214 Md FCFA d'échanges de
-- 2019, « Autres pays » captait 147 Md, dont 126 Md pour le pseudo-partenaire
-- « Divers »/« NCA » (provisions de bord, or monétaire, non dénommé ailleurs
-- — qui n'est pas un pays et a donc sa place là). Restaient 21,5 Md de
-- commerce de pays réels rendu anonyme, dont 19,5 Md pour Hong Kong et Macao
-- à eux seuls. Après cette migration, ce résidu tombe à 2,0 Md, soit 0,03 %
-- des échanges. Pour situer : Hong Kong pèse 128 fois l'Estonie, nommée.
--
-- Deux choix de mise en œuvre :
--
--   continent / region_geo sont RECOPIÉS depuis la ligne de la Chine plutôt
--   qu'écrits en dur : le vocabulaire de ces colonnes a changé au fil des
--   migrations (« Asie de l'Est » dans le seed, « Asie orientale » en 114) et
--   recopier garantit l'alignement sur ce que porte réellement la base.
--   niveau_revenu reste NULL : celui de la Chine serait faux pour Hong Kong,
--   et les groupements par revenu filtrent sur IS NOT NULL, donc un NULL les
--   exclut proprement au lieu de les classer à tort.
--
--   origine reste NULL, comme pour Taïwan (migration 114) et les pays du
--   seed. Surtout, PAS 'transaction' : cette valeur sert de file d'attente de
--   curation des partenaires créés automatiquement à l'import (cf.
--   GET /statistiques/... qui liste ref_pays WHERE origine = 'transaction').
--   Hong Kong et Macao sont des ajouts délibérés, pas des lignes à arbitrer.
--
-- Idempotente : chaque insertion est ignorée si le code ISO3 existe déjà.
--
-- Après application, relancer POST /nace/importer pour que ref_pays_id soit
-- résolu sur les libellés « HONG-KONG » et « MACAO » — leur retrait du volet
-- hors_referentiel de scripts/nace/alias_pays_nace.json laisse désormais le
-- rapprochement automatique les atteindre.
-- =============================================================================

INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr, continent, region_geo, actif)
SELECT 'HK', 'HKG', 'Hong Kong', continent, region_geo, TRUE
FROM ref_pays WHERE code_iso3 = 'CHN'
  AND NOT EXISTS (SELECT 1 FROM ref_pays WHERE code_iso3 = 'HKG');

INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr, continent, region_geo, actif)
SELECT 'MO', 'MAC', 'Macao', continent, region_geo, TRUE
FROM ref_pays WHERE code_iso3 = 'CHN'
  AND NOT EXISTS (SELECT 1 FROM ref_pays WHERE code_iso3 = 'MAC');
