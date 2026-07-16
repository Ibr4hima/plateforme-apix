-- =============================================================================
-- Migration 062 — Corriger le peuplement des groupements région_geo et niveau_revenu
--                 Utilise nom_fr (plus fiable que la régénération du code)
-- =============================================================================

-- Peupler ref_pays_groupements pour les régions géographiques
INSERT INTO ref_pays_groupements (pays_id, groupement_id)
SELECT p.id, g.id
FROM ref_pays p
JOIN ref_groupements g ON g.nom_fr = p.region_geo
WHERE p.region_geo IS NOT NULL AND p.region_geo != '' AND p.actif = true
ON CONFLICT DO NOTHING;

-- Peupler ref_pays_groupements pour les niveaux de revenu
INSERT INTO ref_pays_groupements (pays_id, groupement_id)
SELECT p.id, g.id
FROM ref_pays p
JOIN ref_groupements g ON g.nom_fr = p.niveau_revenu
WHERE p.niveau_revenu IS NOT NULL AND p.niveau_revenu != '' AND p.actif = true
ON CONFLICT DO NOTHING;

-- Vérification
SELECT g.code, g.nom_fr, array_length(g.pays_ids, 1) AS nb_pays
FROM ref_groupements g
WHERE g.code ~ '^(REG_|NIV_)'
ORDER BY g.code;
