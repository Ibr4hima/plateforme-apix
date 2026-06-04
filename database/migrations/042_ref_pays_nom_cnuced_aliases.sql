-- Ajouter les alias UNCTAD pour les pays avec noms abrégés ou alternatifs
-- Ces noms apparaissent tels quels dans les exports CSV UNCTAD

UPDATE ref_pays SET nom_cnuced = 'Rep. dem. du Congo'
WHERE nom_cnuced IS NULL AND (
    nom_fr ILIKE '%Congo%' AND (nom_fr ILIKE '%démocrat%' OR nom_fr ILIKE '%democrat%')
);

UPDATE ref_pays SET nom_cnuced = 'Republique-Unie de Tanzanie'
WHERE nom_cnuced IS NULL AND nom_fr ILIKE '%Tanzanie%';

-- Vérification
SELECT id, nom_fr, nom_cnuced FROM ref_pays
WHERE nom_cnuced IN ('Rep. dem. du Congo', 'Republique-Unie de Tanzanie');
