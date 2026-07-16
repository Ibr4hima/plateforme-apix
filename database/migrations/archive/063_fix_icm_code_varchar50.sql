-- =============================================================================
-- Migration 063 — Élargir ide_cnuced_monde.code à VARCHAR(50)
--                 (même correction que ref_groupements.code en migration 061)
-- =============================================================================

ALTER TABLE ide_cnuced_monde ALTER COLUMN code TYPE VARCHAR(50);

-- Re-peupler ref_pays_groupements pour les régions et niveaux de revenu
-- (les inserts de la migration 062 ont été annulés par l'erreur)

INSERT INTO ref_pays_groupements (pays_id, groupement_id)
SELECT p.id, g.id
FROM ref_pays p
JOIN ref_groupements g ON g.nom_fr = p.region_geo
WHERE p.region_geo IS NOT NULL AND p.region_geo != '' AND p.actif = true
ON CONFLICT DO NOTHING;

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
