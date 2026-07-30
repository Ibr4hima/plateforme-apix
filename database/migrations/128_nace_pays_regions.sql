-- Commerce extérieur du Sénégal — Note d'Analyse du Commerce Extérieur
-- (NACE, ANSD, rapport annuel). Exportations/importations par pays
-- partenaire en valeur (millions FCFA) et poids net (tonnes) — tableaux 34
-- à 37 des annexes de l'édition 2019 (numérotation variable).
--
-- Ces tableaux sont hiérarchiques : ~200 pays groupés sous 13 régions
-- (« LES PAYS MEMBRES DE LA COMMUNAUTE EUROPEENE », « LES PAYS DE
-- L'AFRIQUE DE L'OUEST »…), chaque région portant son sous-total imprimé.
-- Une seule extraction alimente donc deux tables, une par granularité :
--
--   nace_regions : les 13 sous-totaux, tels qu'imprimés (autorité) ;
--   nace_pays    : le détail pays, avec sa région de rattachement.
--
-- Rattachement au référentiel : `ref_pays_id` est résolu à l'import par
-- rapprochement des libellés (le rapport écrit « REPUBLIQUE POPULAIRE DE
-- CHINE », « ETATS UNIS D'AMERIQUE »…). Les partenaires absents de
-- ref_pays — micro-territoires et entités disparues (« ILE STE HELENE »,
-- « HELGOLAND », « EX-YOUGOSLAVIE »…) — gardent ref_pays_id NULL : aucune
-- ligne n'est supprimée, et la lecture les regroupe sous « Autres pays »
-- **de leur région**. Ce périmètre par région est essentiel : la somme des
-- pays d'une région, « Autres pays » compris, reste ainsi exactement égale
-- à son sous-total imprimé.
--
-- Contrôles d'intégrité à l'import (trois niveaux) :
--   1. Σ pays d'une région   = sous-total imprimé de la région ;
--   2. Σ régions             = ligne TOTAL du tableau ;
--   3. Σ régions d'un continent = famille nace_continents (inter-familles).

CREATE TABLE IF NOT EXISTS nace_regions (
    id      SERIAL PRIMARY KEY,
    region  text    NOT NULL,                                  -- libellé normalisé
    sens    text    NOT NULL CHECK (sens IN ('export','import')),
    annee   integer NOT NULL,
    valeur  numeric,                                           -- millions FCFA
    poids   numeric,                                           -- tonnes
    edition integer NOT NULL,                                  -- année du rapport NACE source
    UNIQUE (region, sens, annee, edition)
);

CREATE TABLE IF NOT EXISTS nace_pays (
    id          SERIAL PRIMARY KEY,
    pays        text    NOT NULL,                              -- libellé normalisé du rapport
    region      text    NOT NULL,                              -- région de rattachement
    ref_pays_id integer REFERENCES ref_pays(id),               -- NULL = hors référentiel
    sens        text    NOT NULL CHECK (sens IN ('export','import')),
    annee       integer NOT NULL,
    valeur      numeric,                                       -- millions FCFA
    poids       numeric,                                       -- tonnes
    edition     integer NOT NULL,                              -- année du rapport NACE source
    UNIQUE (pays, sens, annee, edition)
);

CREATE INDEX IF NOT EXISTS idx_nace_reg_sens_annee  ON nace_regions (sens, annee);
CREATE INDEX IF NOT EXISTS idx_nace_reg_edition     ON nace_regions (edition);
CREATE INDEX IF NOT EXISTS idx_nace_pays_sens_annee ON nace_pays (sens, annee);
CREATE INDEX IF NOT EXISTS idx_nace_pays_edition    ON nace_pays (edition);
CREATE INDEX IF NOT EXISTS idx_nace_pays_region     ON nace_pays (region);
CREATE INDEX IF NOT EXISTS idx_nace_pays_ref        ON nace_pays (ref_pays_id);
