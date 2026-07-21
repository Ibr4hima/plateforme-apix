-- Commerce extérieur du Sénégal — Bulletin Mensuel des Statistiques du
-- Commerce Extérieur (ANSD). Données brutes uniquement : valeurs (FCFA)
-- et poids nets (kg) mensuels par rubrique ; tous les dérivés (cumuls,
-- variations, valeurs unitaires, parts, balance) sont calculés à la volée
-- selon les règles ANSD. Les mois sont révisables : chaque bulletin
-- réimporté écrase les mois qu'il couvre (upsert) en gardant la trace
-- du bulletin réviseur.

CREATE TABLE IF NOT EXISTS bmce_bulletins (
    id            SERIAL PRIMARY KEY,
    periode       date NOT NULL UNIQUE,          -- mois du bulletin (1er jour du mois)
    fichier_nom   text,
    importe_le    timestamptz NOT NULL DEFAULT now(),
    mois_couverts date[] NOT NULL,               -- les 4 mois portés par le bulletin
    nb_valeurs    integer NOT NULL DEFAULT 0,
    nb_revisions  integer NOT NULL DEFAULT 0,    -- valeurs de mois antérieurs modifiées
    rapport       text                            -- vérifications + incohérences ANSD notées
);

-- Nomenclatures extensibles, alimentées par l'import (jamais codées en dur)
CREATE TABLE IF NOT EXISTS bmce_rubriques (
    id        SERIAL PRIMARY KEY,
    categorie text NOT NULL CHECK (categorie IN
              ('ensemble','groupe_utilisation','produit_regroupe','chapitre','pays')),
    sens      text NOT NULL CHECK (sens IN ('export','import')),
    libelle   text NOT NULL,
    ordre     integer NOT NULL DEFAULT 0,        -- ordre d'apparition dans le bulletin
    UNIQUE (categorie, sens, libelle)
);

CREATE TABLE IF NOT EXISTS bmce_flux (
    id          SERIAL PRIMARY KEY,
    rubrique_id integer NOT NULL REFERENCES bmce_rubriques(id) ON DELETE CASCADE,
    periode     date NOT NULL,                   -- 1er jour du mois
    valeur_fcfa numeric,                         -- normalisée en FCFA (NULL = absence de flux)
    poids_kg    numeric,                         -- normalisé en kg (NULL pour les pays)
    bulletin_id integer NOT NULL REFERENCES bmce_bulletins(id),
    UNIQUE (rubrique_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_bmce_flux_periode ON bmce_flux (periode);
CREATE INDEX IF NOT EXISTS idx_bmce_rubriques_cat ON bmce_rubriques (categorie, sens);
