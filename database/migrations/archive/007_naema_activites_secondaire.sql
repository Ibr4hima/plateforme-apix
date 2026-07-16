-- Migration 007 : Activités NAEMA — Secteur secondaire

-- Activités extractives (S2-B1)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S2-B1-A1', 'Extraction de phosphates naturels'),
    ('S2-B1-A2', 'Extraction de minerais métalliques'),
    ('S2-B1-A3', 'Extraction d''hydrocarbures'),
    ('S2-B1-A4', 'Autres extractions'),
    ('S2-B1-A5', 'Activités de soutien aux industries extractives')
) AS v(code, nom) ON true WHERE b.code = 'S2-B1';

-- Fabrication de produits agro-alimentaires (S2-B2)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S2-B2-A1',  'Abattage, transformation et conservation des viandes'),
    ('S2-B2-A2',  'Transformation et conservation des poissons, crustacés et mollusques'),
    ('S2-B2-A3',  'Fabrication de corps gras alimentaires'),
    ('S2-B2-A4',  'Travail des grains'),
    ('S2-B2-A5',  'Fabrication d''aliments pour animaux'),
    ('S2-B2-A6',  'Fabrication de pain et de pâtisseries'),
    ('S2-B2-A7',  'Fabrication de produits alimentaires à base de céréales n.c.a.'),
    ('S2-B2-A8',  'Conserves de fruits et légumes'),
    ('S2-B2-A9',  'Fabrication de produits laitiers et de glaces alimentaires'),
    ('S2-B2-A10', 'Fabrication de sucre, chocolaterie et confiserie'),
    ('S2-B2-A11', 'Fabrication d''autres produits alimentaires'),
    ('S2-B2-A12', 'Fabrication de boissons'),
    ('S2-B2-A13', 'Fabrication de produits à base de tabac')
) AS v(code, nom) ON true WHERE b.code = 'S2-B2';

-- Raffinage du pétrole et cokéfaction (S2-B3)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S2-B3-A1', 'Raffinage pétrolier et cokéfaction')
) AS v(code, nom) ON true WHERE b.code = 'S2-B3';

-- Fabrication de produits chimiques de base (S2-B4)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S2-B4-A1', 'Fabrication de produits chimiques de base')
) AS v(code, nom) ON true WHERE b.code = 'S2-B4';

-- Fabrication de ciment et autres matériaux de construction (S2-B5)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S2-B5-A1', 'Fabrication de ciment et autres matériaux de construction')
) AS v(code, nom) ON true WHERE b.code = 'S2-B5';

-- Fabrication d'autres produits manufacturiers (S2-B6)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S2-B6-A1',  'Égrenage du coton'),
    ('S2-B6-A2',  'Filature, tissage et ennoblissement textile'),
    ('S2-B6-A3',  'Fabrication d''articles d''habillement'),
    ('S2-B6-A4',  'Travail du cuir, fabrication d''articles de voyage et de chaussures'),
    ('S2-B6-A5',  'Sciage et rabotage du bois'),
    ('S2-B6-A6',  'Fabrication de papier, cartons et articles en papier ou carton'),
    ('S2-B6-A7',  'Imprimerie et activités annexes'),
    ('S2-B6-A8',  'Reproduction d''enregistrements'),
    ('S2-B6-A9',  'Fabrication de produits pharmaceutiques'),
    ('S2-B6-A10', 'Fabrication de savons, détergents et produits d''entretien'),
    ('S2-B6-A11', 'Fabrication d''autres produits chimiques'),
    ('S2-B6-A12', 'Travail du caoutchouc et du plastique'),
    ('S2-B6-A13', 'Production de métallurgie et de fonderie ; fabrication d''ouvrages en métaux'),
    ('S2-B6-A14', 'Fabrication de produits électroniques et informatiques'),
    ('S2-B6-A15', 'Fabrication d''équipements électriques'),
    ('S2-B6-A16', 'Fabrication de machines et matériels divers à usage général'),
    ('S2-B6-A17', 'Fabrication de machines et matériels divers à usage spécifique'),
    ('S2-B6-A18', 'Construction de véhicules automobiles et composants'),
    ('S2-B6-A19', 'Fabrication d''autres matériels de transport'),
    ('S2-B6-A20', 'Fabrication de meubles et matelas'),
    ('S2-B6-A21', 'Autres industries manufacturières'),
    ('S2-B6-A22', 'Installation et réparation de machines et d''équipements')
) AS v(code, nom) ON true WHERE b.code = 'S2-B6';

-- Production et distribution d'électricité, de gaz et de supports énergétiques (S2-B7)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S2-B7-A1', 'Production et distribution d''électricité, de gaz et de supports énergétiques')
) AS v(code, nom) ON true WHERE b.code = 'S2-B7';

-- Production et distribution d'eau, assainissement et traitement des déchets (S2-B8)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S2-B8-A1', 'Captage, traitement et distribution d''eau'),
    ('S2-B8-A2', 'Collecte et traitement des eaux usées ; récupération des déchets')
) AS v(code, nom) ON true WHERE b.code = 'S2-B8';

-- Construction (S2-B9)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S2-B9-A1', 'Construction de bâtiments et travaux de construction'),
    ('S2-B9-A2', 'Génie civil'),
    ('S2-B9-A3', 'Activités spécialisées de construction')
) AS v(code, nom) ON true WHERE b.code = 'S2-B9';

-- Vérification
SELECT b.nom AS branche, count(a.id) AS nb_activites
FROM ref_branches b
LEFT JOIN ref_activites a ON a.branche_id = b.id
JOIN ref_secteurs s ON s.id = b.secteur_id
WHERE s.code = 'S2'
GROUP BY b.nom, b.code
ORDER BY b.code;
