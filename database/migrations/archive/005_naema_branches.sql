-- Migration 005 : Branches NAEMA

-- Mise à jour des secteurs
UPDATE ref_secteurs SET code='S1', nom='Secteur primaire'    WHERE id=1;
UPDATE ref_secteurs SET code='S2', nom='Secteur secondaire'  WHERE id=2;
UPDATE ref_secteurs SET code='S3', nom='Secteur tertiaire'   WHERE id=3;

-- Nettoyage
DELETE FROM ref_branches;

-- ── Secteur primaire (S1) ─────────────────────────────────────────────────────
INSERT INTO ref_branches (secteur_id, code, nom) VALUES
    (1, 'S1-B1', 'Agriculture et activités annexes'),
    (1, 'S1-B2', 'Élevage et chasse'),
    (1, 'S1-B3', 'Sylviculture, exploitation forestière et activités de soutien'),
    (1, 'S1-B4', 'Pêche, aquaculture et pisciculture');

-- ── Secteur secondaire (S2) ───────────────────────────────────────────────────
INSERT INTO ref_branches (secteur_id, code, nom) VALUES
    (2, 'S2-B1', 'Activités extractives'),
    (2, 'S2-B2', 'Fabrication de produits agro-alimentaires'),
    (2, 'S2-B3', 'Raffinage du pétrole et cokéfaction'),
    (2, 'S2-B4', 'Fabrication de produits chimiques de base'),
    (2, 'S2-B5', 'Fabrication de ciment et autres matériaux de construction'),
    (2, 'S2-B6', 'Fabrication d''autres produits manufacturiers'),
    (2, 'S2-B7', 'Production et distribution d''électricité, de gaz et de supports énergétiques'),
    (2, 'S2-B8', 'Production et distribution d''eau, assainissement et traitement des déchets'),
    (2, 'S2-B9', 'Construction');

-- ── Secteur tertiaire (S3) ────────────────────────────────────────────────────
INSERT INTO ref_branches (secteur_id, code, nom) VALUES
    (3, 'S3-B1',  'Commerce'),
    (3, 'S3-B2',  'Transports'),
    (3, 'S3-B3',  'Hébergement et restauration'),
    (3, 'S3-B4',  'Information et communication'),
    (3, 'S3-B5',  'Activités financières et d''assurances'),
    (3, 'S3-B6',  'Activités immobilières'),
    (3, 'S3-B7',  'Activités spécialisées, scientifiques et techniques'),
    (3, 'S3-B8',  'Activités de services de soutien et de bureau'),
    (3, 'S3-B9',  'Administration publique et enseignement'),
    (3, 'S3-B10', 'Activités pour la santé humaine et l''action sociale'),
    (3, 'S3-B11', 'Activités artistiques, culturelles, sportives et récréatives'),
    (3, 'S3-B12', 'Activités domestiques'),
    (3, 'S3-B13', 'Autres activités (non comprises ailleurs)');

-- Vérification
SELECT s.nom AS secteur, b.code, b.nom AS branche
FROM ref_branches b
JOIN ref_secteurs s ON s.id = b.secteur_id
ORDER BY b.code;
