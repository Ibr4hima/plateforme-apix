-- Migration 006 : Activités NAEMA — Secteur primaire

-- Agriculture et activités annexes (S1-B1)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S1-B1-A1', 'Culture de céréales'),
    ('S1-B1-A2', 'Culture de tubercules et légumes à cosse secs'),
    ('S1-B1-A3', 'Culture de légumes et épices'),
    ('S1-B1-A4', 'Culture de fruits, plantes et fleurs, pépinières, plantes pour boisson'),
    ('S1-B1-A5', 'Arachide et autres oléagineux (sauf graine de coton)'),
    ('S1-B1-A6', 'Culture du coton graine'),
    ('S1-B1-A7', 'Autres produits agricoles et activités de soutien')
) AS v(code, nom) ON true WHERE b.code = 'S1-B1';

-- Élevage et chasse (S1-B2)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S1-B2-A1', 'Élevage de bovins, ovins, caprins'),
    ('S1-B2-A2', 'Élevage de volaille'),
    ('S1-B2-A3', 'Élevage d''animaux (non compris ailleurs)'),
    ('S1-B2-A4', 'Chasse et activités annexes'),
    ('S1-B2-A5', 'Activités de soutien à l''élevage')
) AS v(code, nom) ON true WHERE b.code = 'S1-B2';

-- Sylviculture, exploitation forestière et activités de soutien (S1-B3)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S1-B3-A1', 'Exploitation forestière'),
    ('S1-B3-A2', 'Cueillette et activités forestières'),
    ('S1-B3-A3', 'Services forestiers de soutien')
) AS v(code, nom) ON true WHERE b.code = 'S1-B3';

-- Pêche, aquaculture et pisciculture (S1-B4)
INSERT INTO ref_activites (branche_id, code, nom)
SELECT b.id, v.code, v.nom FROM ref_branches b
JOIN (VALUES
    ('S1-B4-A1', 'Pêche'),
    ('S1-B4-A2', 'Aquaculture et pisciculture')
) AS v(code, nom) ON true WHERE b.code = 'S1-B4';

-- Vérification
SELECT b.nom AS branche, a.code, a.nom AS activite
FROM ref_activites a
JOIN ref_branches b ON b.id = a.branche_id
JOIN ref_secteurs s ON s.id = b.secteur_id
WHERE s.code = 'S1'
ORDER BY a.code;
