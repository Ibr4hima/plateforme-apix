-- =============================================================================
-- Migration 112 — Référentiel des secteurs / branches CNUCED + données
--                 sectorielles IDE (Annex tables 09-12, 15, 18)
--                 Résolution à l'import sur nom_en (fichiers en anglais),
--                 affichage sur nom_fr (libellés officiels).
-- =============================================================================

CREATE TABLE IF NOT EXISTS ide_secteurs (
    id        integer PRIMARY KEY,
    nom_en    text NOT NULL UNIQUE,
    nom_fr    text NOT NULL,
    parent_id integer REFERENCES ide_secteurs(id) ON DELETE CASCADE,  -- NULL = secteur, sinon branche
    ordre     integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ide_cnuced_secteurs (
    id         serial PRIMARY KEY,
    secteur_id integer NOT NULL REFERENCES ide_secteurs(id) ON DELETE CASCADE,
    annee      smallint NOT NULL,
    direction  varchar(10) NOT NULL,   -- entrant (ventes) / sortant (achats) / total (greenfield sectoriel)
    indicateur varchar(30) NOT NULL,   -- ma_valeur / ma_nombre / greenfield_valeur / greenfield_nombre
    valeur     numeric(16,2),
    source     varchar(20) NOT NULL DEFAULT 'CNUCED',
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ics_lookup ON ide_cnuced_secteurs (secteur_id, indicateur, direction, annee);

-- ── Secteurs (niveaux 1) ──────────────────────────────────────────────────────
INSERT INTO ide_secteurs (id, nom_en, nom_fr, parent_id, ordre) VALUES
  (1, 'Primary',       'Secteur primaire',            NULL, 1),
  (2, 'Manufacturing', 'Industries manufacturières',  NULL, 2),
  (3, 'Services',      'Services',                    NULL, 3)
ON CONFLICT (id) DO NOTHING;

-- ── Branches (niveaux 2) ──────────────────────────────────────────────────────
INSERT INTO ide_secteurs (id, nom_en, nom_fr, parent_id, ordre) VALUES
  -- Secteur primaire
  (10, 'Agriculture, forestry and fishing', 'Agriculture, sylviculture et pêche', 1, 1),
  (11, 'Extractive industries',             'Industries extractives',             1, 2),
  -- Industries manufacturières
  (20, 'Food, beverages and tobacco',        'Industries alimentaires, des boissons et du tabac',            2, 1),
  (21, 'Textiles, clothing and leather',     'Industries textiles, de l''habillement et du cuir',            2, 2),
  (22, 'Wood products',                      'Industrie du bois et des produits en bois',                    2, 3),
  (23, 'Paper and paper products',           'Industrie du papier et des produits en papier',                2, 4),
  (24, 'Printing',                           'Imprimerie et reproduction d''enregistrements',                2, 5),
  (25, 'Coke and refined petroleum',         'Cokéfaction et raffinage',                                     2, 6),
  (26, 'Chemicals',                          'Industrie chimique',                                           2, 7),
  (27, 'Pharmaceuticals',                    'Industrie pharmaceutique',                                     2, 8),
  (28, 'Rubber and plastics products',       'Industrie du caoutchouc et des matières plastiques',           2, 9),
  (29, 'Other non-metallic mineral products','Fabrication d''autres produits minéraux non métalliques',      2, 10),
  (30, 'Basic metal and metal products',     'Métallurgie et fabrication de produits métalliques',           2, 11),
  (31, 'Electronics and electrical equipment','Fabrication de produits électroniques et d''équipements électriques', 2, 12),
  (32, 'Machinery and equipment',            'Fabrication de machines et équipements',                       2, 13),
  (33, 'Automotive',                         'Industrie automobile',                                         2, 14),
  (34, 'Furniture',                          'Fabrication de meubles',                                       2, 15),
  (35, 'Other manufacturing',                'Autres industries manufacturières',                            2, 16),
  -- Services
  (50, 'Energy and gas supply',                 'Production et distribution d''électricité, de gaz et de vapeur',                       3, 1),
  (51, 'Water and waste management services',   'Production et distribution d''eau ; assainissement, gestion des déchets et dépollution', 3, 2),
  (52, 'Construction',                          'Construction',                                             3, 3),
  (53, 'Trade',                                 'Commerce',                                                 3, 4),
  (54, 'Transportation and storage',            'Transports et entreposage',                                3, 5),
  (55, 'Hospitality',                           'Hébergement et restauration',                              3, 6),
  (56, 'Information and communication',         'Information et communication',                             3, 7),
  (57, 'Finance and insurance',                 'Activités financières et d''assurance',                    3, 8),
  (58, 'Real estate',                           'Activités immobilières',                                   3, 9),
  (59, 'Professional services',                 'Activités spécialisées, scientifiques et techniques',      3, 10),
  (60, 'Administrative and support services',   'Activités de services administratifs et de soutien',       3, 11),
  (61, 'Education',                             'Enseignement',                                             3, 12),
  (62, 'Health services',                       'Santé humaine et action sociale',                          3, 13),
  (63, 'Entertainment',                         'Arts, spectacles et activités récréatives',                3, 14),
  (64, 'Other services',                        'Autres activités de services',                             3, 15),
  -- Branches présentes uniquement dans les tables M&A (granularité différente)
  (65, 'Utilities',                             'Services collectifs (électricité, gaz et eau)',            3, 16),
  (66, 'Public administration and defence',     'Administration publique et défense',                       3, 17)
ON CONFLICT (id) DO NOTHING;
