-- Migration 008 : Activités NAEMA — Secteur tertiaire

-- Commerce (S3-B1)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B1-A1', 'Commerce et réparation d''automobiles et de motocycles'),
    ('S3-B1-A2', 'Commerce de gros'),
    ('S3-B1-A3', 'Commerce de détail')
) AS v(code, nom) ON true WHERE b.code = 'S3-B1';

-- Transports (S3-B2)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B2-A1', 'Transports ferroviaires'),
    ('S3-B2-A2', 'Transports routiers'),
    ('S3-B2-A3', 'Transports par eau'),
    ('S3-B2-A4', 'Transports aériens'),
    ('S3-B2-A5', 'Entreposage et activités des auxiliaires de transport'),
    ('S3-B2-A6', 'Activités de poste et de courrier')
) AS v(code, nom) ON true WHERE b.code = 'S3-B2';

-- Hébergement et restauration (S3-B3)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B3-A1', 'Hôtel et hébergement'),
    ('S3-B3-A2', 'Restauration et débits de boisson')
) AS v(code, nom) ON true WHERE b.code = 'S3-B3';

-- Information et communication (S3-B4)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B4-A1', 'Édition'),
    ('S3-B4-A2', 'Production audio et vidéo : télévision, cinéma et son'),
    ('S3-B4-A3', 'Programmation télévisuelle ; radiodiffusion'),
    ('S3-B4-A4', 'Télécommunications'),
    ('S3-B4-A5', 'Activités informatiques : conseil, programmation'),
    ('S3-B4-A6', 'Activités de fourniture d''information')
) AS v(code, nom) ON true WHERE b.code = 'S3-B4';

-- Activités financières et d'assurances (S3-B5)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B5-A1', 'Activités financières'),
    ('S3-B5-A2', 'Assurances'),
    ('S3-B5-A3', 'Activités des auxiliaires financiers et d''assurance')
) AS v(code, nom) ON true WHERE b.code = 'S3-B5';

-- Activités immobilières (S3-B6)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B6-A1', 'Activités immobilières')
) AS v(code, nom) ON true WHERE b.code = 'S3-B6';

-- Activités spécialisées, scientifiques et techniques (S3-B7)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B7-A1', 'Recherche-développement et prospection minière pour compte propre'),
    ('S3-B7-A2', 'Activités vétérinaires'),
    ('S3-B7-A3', 'Autres activités spécialisées, scientifiques et techniques')
) AS v(code, nom) ON true WHERE b.code = 'S3-B7';

-- Activités de services de soutien et de bureau (S3-B8)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B8-A1', 'Location et location-bail'),
    ('S3-B8-A2', 'Activités des agences de réservation et voyagistes'),
    ('S3-B8-A3', 'Activités d''enquêtes et de sécurité'),
    ('S3-B8-A4', 'Autres activités de soutien aux entreprises ; activités de bureau')
) AS v(code, nom) ON true WHERE b.code = 'S3-B8';

-- Administration publique et enseignement (S3-B9)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B9-A1', 'Activités d''administration publique')
) AS v(code, nom) ON true WHERE b.code = 'S3-B9';

INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B9-A2', 'Enseignement')
) AS v(code, nom) ON true WHERE b.code = 'S3-B9';

-- Activités pour la santé humaine et l'action sociale (S3-B10)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B10-A1', 'Activités pour la santé humaine'),
    ('S3-B10-A2', 'Action sociale')
) AS v(code, nom) ON true WHERE b.code = 'S3-B10';

-- Activités artistiques, culturelles, sportives et récréatives (S3-B11)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B11-A1', 'Activités artistiques, culturelles, sportives et récréatives')
) AS v(code, nom) ON true WHERE b.code = 'S3-B11';

-- Activités domestiques (S3-B12)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B12-A1', 'Activités domestiques')
) AS v(code, nom) ON true WHERE b.code = 'S3-B12';

-- Autres activités (S3-B13)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S3-B13-A1', 'Autres activités (non comprises ailleurs)')
) AS v(code, nom) ON true WHERE b.code = 'S3-B13';

-- Vérification globale
SELECT s.nom AS secteur, count(a.id) AS nb_activites
FROM ref_activites a
JOIN ref_branches b ON b.id = a.branche_id
JOIN ref_secteurs s ON s.id = b.secteur_id
GROUP BY s.nom, s.code
ORDER BY s.code;
