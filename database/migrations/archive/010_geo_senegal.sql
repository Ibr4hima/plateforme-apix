-- Migration 010 : Découpage administratif du Sénégal

CREATE TABLE ref_regions (
    id      SERIAL PRIMARY KEY,
    code    VARCHAR(10) UNIQUE NOT NULL,
    nom     VARCHAR(100) NOT NULL,
    actif   BOOLEAN DEFAULT TRUE
);

CREATE TABLE ref_departements (
    id          SERIAL PRIMARY KEY,
    region_id   INTEGER NOT NULL REFERENCES ref_regions(id),
    code        VARCHAR(10) UNIQUE NOT NULL,
    nom         VARCHAR(100) NOT NULL,
    actif       BOOLEAN DEFAULT TRUE
);

CREATE TABLE ref_arrondissements (
    id              SERIAL PRIMARY KEY,
    departement_id  INTEGER NOT NULL REFERENCES ref_departements(id),
    code            VARCHAR(10) UNIQUE NOT NULL,
    nom             VARCHAR(100) NOT NULL,
    actif           BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_dep_region ON ref_departements(region_id);
CREATE INDEX idx_arr_dep    ON ref_arrondissements(departement_id);

-- 14 régions du Sénégal
INSERT INTO ref_regions (code, nom) VALUES
    ('DK',  'Dakar'),
    ('ZG',  'Ziguinchor'),
    ('DI',  'Diourbel'),
    ('SL',  'Saint-Louis'),
    ('TM',  'Tambacounda'),
    ('KA',  'Kaolack'),
    ('TH',  'Thiès'),
    ('LG',  'Louga'),
    ('FK',  'Fatick'),
    ('KL',  'Kolda'),
    ('MT',  'Matam'),
    ('KB',  'Kaffrine'),
    ('KD',  'Kédougou'),
    ('SD',  'Sédhiou');

SELECT * FROM ref_regions ORDER BY nom;
