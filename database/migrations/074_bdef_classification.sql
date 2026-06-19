-- Migration 074 : BDEF — Banque de Données Économiques et Financières
--
-- Modélise la classification sectorielle de la BDEF (source ANSD) utilisée par
-- l'onglet « Investissements nationaux ». Hiérarchie à 3 niveaux :
--   4 macro-secteurs  →  9 groupes  →  35 secteurs d'activité
--
-- Les indicateurs (FCFA, ratio, %, jours) sont regroupés en 6 catégories et
-- mesurés par année (1999→2024) à 4 niveaux de lecture :
--   global (englobe les macro-secteurs) · macro-secteur · groupe · secteur.
--
-- Cette migration crée le schéma complet + amorce la hiérarchie sectorielle et
-- les 6 catégories d'indicateurs. Les indicateurs eux-mêmes et leurs valeurs
-- annuelles seront chargés par des migrations ultérieures.

-- ── Hiérarchie sectorielle ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bdef_macro_secteurs (
    id         SERIAL PRIMARY KEY,
    code       VARCHAR(10)  NOT NULL UNIQUE,
    libelle    VARCHAR(200) NOT NULL,
    ordre      SMALLINT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bdef_groupes (
    id               SERIAL PRIMARY KEY,
    code             VARCHAR(10)  NOT NULL UNIQUE,
    libelle          VARCHAR(200) NOT NULL,
    macro_secteur_id INTEGER NOT NULL REFERENCES bdef_macro_secteurs(id) ON DELETE CASCADE,
    ordre            SMALLINT,
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bdef_groupes_macro ON bdef_groupes (macro_secteur_id);

CREATE TABLE IF NOT EXISTS bdef_secteurs (
    id         SERIAL PRIMARY KEY,
    code       VARCHAR(10)  NOT NULL UNIQUE,
    libelle    VARCHAR(500) NOT NULL,
    groupe_id  INTEGER NOT NULL REFERENCES bdef_groupes(id) ON DELETE CASCADE,
    ordre      SMALLINT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bdef_secteurs_groupe ON bdef_secteurs (groupe_id);

-- ── Indicateurs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bdef_indicateur_categories (
    id      SERIAL PRIMARY KEY,
    code    VARCHAR(40)  NOT NULL UNIQUE,
    libelle VARCHAR(100) NOT NULL,
    ordre   SMALLINT
);

CREATE TABLE IF NOT EXISTS bdef_indicateurs (
    id           SERIAL PRIMARY KEY,
    code         VARCHAR(60)  UNIQUE,
    libelle      VARCHAR(300) NOT NULL,
    unite        VARCHAR(20)  NOT NULL,   -- FCFA | ratio | % | jours
    categorie_id INTEGER NOT NULL REFERENCES bdef_indicateur_categories(id) ON DELETE RESTRICT,
    ordre        SMALLINT,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bdef_indicateurs_cat ON bdef_indicateurs (categorie_id);

-- ── Valeurs annuelles (polymorphe : 4 niveaux de lecture) ─────────────────────
CREATE TABLE IF NOT EXISTS bdef_valeurs (
    id               SERIAL PRIMARY KEY,
    indicateur_id    INTEGER NOT NULL REFERENCES bdef_indicateurs(id) ON DELETE CASCADE,
    niveau           VARCHAR(15) NOT NULL,   -- global | macro_secteur | groupe | secteur
    macro_secteur_id INTEGER REFERENCES bdef_macro_secteurs(id) ON DELETE CASCADE,
    groupe_id        INTEGER REFERENCES bdef_groupes(id) ON DELETE CASCADE,
    secteur_id       INTEGER REFERENCES bdef_secteurs(id) ON DELETE CASCADE,
    annee            SMALLINT NOT NULL,
    valeur           NUMERIC(20,4),
    created_at       TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT bdef_valeurs_niveau_chk CHECK (
        (niveau = 'global'        AND macro_secteur_id IS NULL     AND groupe_id IS NULL     AND secteur_id IS NULL) OR
        (niveau = 'macro_secteur' AND macro_secteur_id IS NOT NULL AND groupe_id IS NULL     AND secteur_id IS NULL) OR
        (niveau = 'groupe'        AND macro_secteur_id IS NULL     AND groupe_id IS NOT NULL AND secteur_id IS NULL) OR
        (niveau = 'secteur'       AND macro_secteur_id IS NULL     AND groupe_id IS NULL     AND secteur_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bdef_valeurs_uniq ON bdef_valeurs (
    indicateur_id, niveau,
    COALESCE(macro_secteur_id, 0), COALESCE(groupe_id, 0), COALESCE(secteur_id, 0),
    annee
);
CREATE INDEX IF NOT EXISTS idx_bdef_valeurs_indic_annee ON bdef_valeurs (indicateur_id, annee);

-- ── Seed : 6 catégories d'indicateurs ─────────────────────────────────────────
INSERT INTO bdef_indicateur_categories (code, libelle, ordre) VALUES
  ('activites',             'Activités',              1),
  ('efficacite',            'Efficacité',             2),
  ('investissement',        'Investissement',         3),
  ('liquidite',             'Liquidité',              4),
  ('rentabilite',           'Rentabilité',            5),
  ('structure_financiere',  'Structure financière',   6)
ON CONFLICT (code) DO NOTHING;

-- ── Seed : hiérarchie sectorielle (source ANSD) ───────────────────────────────
-- Macro-secteurs
INSERT INTO bdef_macro_secteurs (code, libelle) VALUES
  ('201', 'Industries'),
  ('202', 'BTP'),
  ('203', 'Commerce'),
  ('204', 'Services')
ON CONFLICT (code) DO NOTHING;

-- Groupes
INSERT INTO bdef_groupes (code, libelle, macro_secteur_id) VALUES
  ('101', 'Industries alimentaires', (SELECT id FROM bdef_macro_secteurs WHERE code='201')),
  ('102', 'Industries textiles', (SELECT id FROM bdef_macro_secteurs WHERE code='201')),
  ('103', 'Autres industries', (SELECT id FROM bdef_macro_secteurs WHERE code='201')),
  ('104', 'Bâtiments, Travaux Publics', (SELECT id FROM bdef_macro_secteurs WHERE code='202')),
  ('105', 'Commerce', (SELECT id FROM bdef_macro_secteurs WHERE code='203')),
  ('106', 'Transport, télécommunications', (SELECT id FROM bdef_macro_secteurs WHERE code='204')),
  ('107', 'Hôtels, bars et restaurants', (SELECT id FROM bdef_macro_secteurs WHERE code='204')),
  ('108', 'Services fournis aux entreprises', (SELECT id FROM bdef_macro_secteurs WHERE code='204')),
  ('109', 'Services personnels et divers', (SELECT id FROM bdef_macro_secteurs WHERE code='204'))
ON CONFLICT (code) DO NOTHING;

-- Secteurs d'activité
INSERT INTO bdef_secteurs (code, libelle, groupe_id) VALUES
  ('001', 'Agriculture, élevage et chasse', (SELECT id FROM bdef_groupes WHERE code='101')),
  ('002', 'Pêche et aquaculture', (SELECT id FROM bdef_groupes WHERE code='101')),
  ('003', 'Production de viande et de poissons', (SELECT id FROM bdef_groupes WHERE code='101')),
  ('004', 'Travail des grains et fabrication de produits amylacés', (SELECT id FROM bdef_groupes WHERE code='101')),
  ('005', 'Industries des oléagineux', (SELECT id FROM bdef_groupes WHERE code='101')),
  ('006', 'Boulangerie, pâtisserie et pâtes alimentaires', (SELECT id FROM bdef_groupes WHERE code='101')),
  ('007', 'Industries laitières', (SELECT id FROM bdef_groupes WHERE code='101')),
  ('008', 'Transformation des fruits et légumes et fabrication d''autres produits alimentaires', (SELECT id FROM bdef_groupes WHERE code='101')),
  ('009', 'Industries des boissons', (SELECT id FROM bdef_groupes WHERE code='101')),
  ('010', 'Industries textiles et habillement', (SELECT id FROM bdef_groupes WHERE code='102')),
  ('011', 'Industries du cuir et de la chaussure', (SELECT id FROM bdef_groupes WHERE code='102')),
  ('012', 'Industries extractives', (SELECT id FROM bdef_groupes WHERE code='103')),
  ('013', 'Industries du bois', (SELECT id FROM bdef_groupes WHERE code='103')),
  ('014', 'Industries du papier et cartons, de l''édition et de l''imprimerie', (SELECT id FROM bdef_groupes WHERE code='103')),
  ('015', 'Industries chimiques', (SELECT id FROM bdef_groupes WHERE code='103')),
  ('016', 'Industries du caoutchouc et des matières plastiques', (SELECT id FROM bdef_groupes WHERE code='103')),
  ('017', 'Fabrication d''autres produits minéraux non métalliques et de matériaux de construction', (SELECT id FROM bdef_groupes WHERE code='103')),
  ('018', 'Métallurgie et travail des métaux', (SELECT id FROM bdef_groupes WHERE code='103')),
  ('019', 'Autres industries mécaniques', (SELECT id FROM bdef_groupes WHERE code='103')),
  ('020', 'Industries diverses', (SELECT id FROM bdef_groupes WHERE code='103')),
  ('021', 'Énergie', (SELECT id FROM bdef_groupes WHERE code='103')),
  ('022', 'Préparation de sites et construction d''ouvrages de bâtiment et de génie civil', (SELECT id FROM bdef_groupes WHERE code='104')),
  ('023', 'Travaux d''installation et de finition', (SELECT id FROM bdef_groupes WHERE code='104')),
  ('024', 'Commerce de véhicules, d''accessoires et de carburant', (SELECT id FROM bdef_groupes WHERE code='105')),
  ('025', 'Autres commerces', (SELECT id FROM bdef_groupes WHERE code='105')),
  ('026', 'Transport et communication', (SELECT id FROM bdef_groupes WHERE code='106')),
  ('027', 'Postes, télécommunications', (SELECT id FROM bdef_groupes WHERE code='106')),
  ('028', 'Hôtels, restaurants', (SELECT id FROM bdef_groupes WHERE code='107')),
  ('029', 'Activités financières', (SELECT id FROM bdef_groupes WHERE code='108')),
  ('030', 'Activités immobilières', (SELECT id FROM bdef_groupes WHERE code='108')),
  ('031', 'Services aux entreprises', (SELECT id FROM bdef_groupes WHERE code='108')),
  ('032', 'Éducation', (SELECT id FROM bdef_groupes WHERE code='109')),
  ('033', 'Santé et action sociale', (SELECT id FROM bdef_groupes WHERE code='109')),
  ('034', 'Services collectifs, sociaux et personnels', (SELECT id FROM bdef_groupes WHERE code='109')),
  ('035', 'Réparations', (SELECT id FROM bdef_groupes WHERE code='109'))
ON CONFLICT (code) DO NOTHING;
