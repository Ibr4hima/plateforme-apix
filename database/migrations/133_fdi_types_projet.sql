-- Types de projet fDi Markets
--
-- Une cinquième nomenclature, la plus courte : trois postes qui disent ce que
-- le projet FAIT à l'implantation existante.
--
--   New          une implantation entièrement nouvelle ;
--   Expansion    l'agrandissement d'un site déjà là ;
--   Co-location  une activité qui vient s'ajouter sur un site existant.
--
-- Elle est décisive pour lire correctement les chiffres : une extension et une
-- implantation nouvelle ne se valent pas du point de vue d'une agence de
-- promotion. La première prolonge un investisseur déjà présent — c'est de
-- l'après-vente, du suivi ; la seconde est une conquête. Additionner les deux
-- sans les distinguer masque exactement ce que l'APIX cherche à mesurer.
--
-- Contrairement aux quatre autres nomenclatures, elle n'a pas de classeur
-- source : les trois postes sont saisis à la main dans
-- backend/scripts/fdi/fdi_types_projet.csv, versionné comme les CSV dérivés.
-- Le générateur ne le produit donc pas, et ne le touche pas.
--
-- Mêmes règles que les autres : code stable, clé d'appariement normalisée,
-- colonne `origine` qui protège les corrections saisies dans l'administration,
-- et pas de suppression.

CREATE TABLE IF NOT EXISTS fdi_types_projet (
    id              SERIAL PRIMARY KEY,
    code            text     NOT NULL UNIQUE,
    libelle_en      text     NOT NULL UNIQUE,
    libelle_fr      text     NOT NULL,
    cle_appariement text     NOT NULL UNIQUE,
    ordre           smallint NOT NULL,
    origine         text     NOT NULL DEFAULT 'depot'
        CHECK (origine IN ('depot', 'admin')),
    modifie_le      timestamptz,
    modifie_par     text
);
