-- Commerce extérieur du Sénégal — Note d'Analyse du Commerce Extérieur
-- (NACE, ANSD, rapport annuel). Exportations/importations par groupe
-- d'utilisation en valeur (millions FCFA) et poids net (tonnes) —
-- tableaux 16 à 19 des annexes de l'édition 2019 (numérotation variable
-- selon les éditions). Nomenclature courte et stable : Alimentation -
-- boissons - tabacs, Énergie et lubrifiants, Matières premières animales
-- et végétales, Matières premières minérales, Autres demi-produits,
-- Produits finis destinés à l'agriculture / à l'industrie / à la
-- consommation, Or industriel.
--
-- Même structure et mêmes règles que nace_principaux_produits et
-- nace_produits_regroupes : une ligne = un groupe × un sens × une année
-- × une édition ; chaque édition N porte les années N-4..N, les fenêtres
-- se chevauchent et la lecture retient, pour chaque année, l'édition la
-- plus récente. Libellés normalisés à l'extraction (le PDF les écrit en
-- capitales) ; ligne TOTAL non stockée — elle sert de contrôle
-- d'intégrité à l'import. Ici tous les groupes sont exhaustifs : il n'y
-- a pas de ligne « Autres », la somme des groupes EST le total.

CREATE TABLE IF NOT EXISTS nace_groupe_utilisation (
    id      SERIAL PRIMARY KEY,
    groupe  text    NOT NULL,                                  -- libellé normalisé
    sens    text    NOT NULL CHECK (sens IN ('export','import')),
    annee   integer NOT NULL,
    valeur  numeric,                                           -- millions FCFA
    poids   numeric,                                           -- tonnes
    edition integer NOT NULL,                                  -- année du rapport NACE source
    UNIQUE (groupe, sens, annee, edition)
);

CREATE INDEX IF NOT EXISTS idx_nace_gu_sens_annee ON nace_groupe_utilisation (sens, annee);
CREATE INDEX IF NOT EXISTS idx_nace_gu_edition    ON nace_groupe_utilisation (edition);
