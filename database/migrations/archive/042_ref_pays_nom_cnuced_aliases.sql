-- Ajouter les alias UNCTAD pour les pays avec noms abrégés ou alternatifs
-- Utilise les noms exacts tels qu'ils apparaissent dans les exports CSV UNCTAD

UPDATE ref_pays SET nom_cnuced = 'Rep. dem. du Congo'
WHERE nom_fr = 'RD Congo' AND (nom_cnuced IS NULL OR nom_cnuced = '');

UPDATE ref_pays SET nom_cnuced = 'Republique-Unie de Tanzanie'
WHERE nom_fr = 'Tanzanie' AND (nom_cnuced IS NULL OR nom_cnuced = '');

-- Vérification
SELECT id, nom_fr, nom_cnuced FROM ref_pays
WHERE nom_fr IN ('RD Congo', 'Tanzanie');
