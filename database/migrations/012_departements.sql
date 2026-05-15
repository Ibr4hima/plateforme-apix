-- Migration 012 : Départements du Sénégal

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('DK-D1', 'Dakar'),
    ('DK-D2', 'Pikine'),
    ('DK-D3', 'Rufisque'),
    ('DK-D4', 'Guédiawaye'),
    ('DK-D5', 'Keur Massar')
) AS v(code, nom) ON true WHERE r.code = 'DK';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('ZG-D1', 'Bignona'),
    ('ZG-D2', 'Oussouye'),
    ('ZG-D3', 'Ziguinchor')
) AS v(code, nom) ON true WHERE r.code = 'ZG';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('DI-D1', 'Bambey'),
    ('DI-D2', 'Diourbel'),
    ('DI-D3', 'Mbacké')
) AS v(code, nom) ON true WHERE r.code = 'DI';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('SL-D1', 'Dagana'),
    ('SL-D2', 'Podor'),
    ('SL-D3', 'Saint-Louis')
) AS v(code, nom) ON true WHERE r.code = 'SL';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('TM-D1', 'Bakel'),
    ('TM-D2', 'Tambacounda'),
    ('TM-D3', 'Koumpentoum'),
    ('TM-D4', 'Goudiry')
) AS v(code, nom) ON true WHERE r.code = 'TM';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('KA-D1', 'Kaolack'),
    ('KA-D2', 'Nioro du Rip'),
    ('KA-D3', 'Guinguinéo')
) AS v(code, nom) ON true WHERE r.code = 'KA';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('TH-D1', 'Mbour'),
    ('TH-D2', 'Thiès'),
    ('TH-D3', 'Tivaouane')
) AS v(code, nom) ON true WHERE r.code = 'TH';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('LG-D1', 'Kébémer'),
    ('LG-D2', 'Linguère'),
    ('LG-D3', 'Louga')
) AS v(code, nom) ON true WHERE r.code = 'LG';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('FK-D1', 'Fatick'),
    ('FK-D2', 'Foundiougne'),
    ('FK-D3', 'Gossas')
) AS v(code, nom) ON true WHERE r.code = 'FK';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('KL-D1', 'Kolda'),
    ('KL-D2', 'Vélingara'),
    ('KL-D3', 'Médina Yoro Foulah')
) AS v(code, nom) ON true WHERE r.code = 'KL';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('MT-D1', 'Kanel'),
    ('MT-D2', 'Matam'),
    ('MT-D3', 'Ranérou')
) AS v(code, nom) ON true WHERE r.code = 'MT';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('KB-D1', 'Kaffrine'),
    ('KB-D2', 'Birkelane'),
    ('KB-D3', 'Koungheul'),
    ('KB-D4', 'Malem-Hodar')
) AS v(code, nom) ON true WHERE r.code = 'KB';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('KD-D1', 'Kédougou'),
    ('KD-D2', 'Salemata'),
    ('KD-D3', 'Saraya')
) AS v(code, nom) ON true WHERE r.code = 'KD';

INSERT INTO ref_departements (region_id, code, nom)
SELECT r.id, v.code, v.nom FROM ref_regions r
JOIN (VALUES
    ('SD-D1', 'Sédhiou'),
    ('SD-D2', 'Bounkiling'),
    ('SD-D3', 'Goudomp')
) AS v(code, nom) ON true WHERE r.code = 'SD';

-- Vérification
SELECT r.nom AS region, count(d.id) AS nb_departements
FROM ref_departements d
JOIN ref_regions r ON r.id = d.region_id
GROUP BY r.nom, r.code ORDER BY r.code;
