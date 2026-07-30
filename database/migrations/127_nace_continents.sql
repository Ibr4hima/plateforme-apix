-- Commerce extérieur du Sénégal — Note d'Analyse du Commerce Extérieur
-- (NACE, ANSD, rapport annuel). Exportations/importations par continent en
-- valeur (millions FCFA) et poids net (tonnes) — tableaux 26 à 29 des
-- annexes de l'édition 2019 (numérotation variable selon les éditions).
--
-- Libellés normalisés à l'extraction : le rapport écrit « CONTINENT
-- EUROPEEN », « CONTINENT AFRICAIN »… là où l'on retient « Europe »,
-- « Afrique », « Amérique », « Asie », « Océanie » et « Divers ».
--
-- Les rapports ne découpent pas toujours les continents de la même façon :
-- certaines éditions publient un « CONTINENT AUSTRALIEN ET OCEANIQUE »
-- unique, d'autres séparent l'Australie de l'Océanie. Les variantes sont
-- ramenées au même libellé canonique à l'extraction, et la lecture somme
-- les lignes qui partagent ce libellé — la série reste donc comparable
-- d'une édition à l'autre.
--
-- Même structure et mêmes règles que les autres familles NACE : une ligne
-- = un continent × un sens × une année × une édition ; chaque édition N
-- porte les années N-4..N, les fenêtres se chevauchent et la lecture
-- retient, pour chaque année, l'édition la plus récente. La ligne TOTAL
-- n'est pas stockée : comme les continents sont exhaustifs (« Divers »
-- incluse), leur somme EST le total du commerce extérieur, ce qui sert de
-- contrôle d'intégrité à l'import.

CREATE TABLE IF NOT EXISTS nace_continents (
    id        SERIAL PRIMARY KEY,
    continent text    NOT NULL,                                -- libellé normalisé
    sens      text    NOT NULL CHECK (sens IN ('export','import')),
    annee     integer NOT NULL,
    valeur    numeric,                                         -- millions FCFA
    poids     numeric,                                         -- tonnes
    edition   integer NOT NULL,                                -- année du rapport NACE source
    UNIQUE (continent, sens, annee, edition)
);

CREATE INDEX IF NOT EXISTS idx_nace_cont_sens_annee ON nace_continents (sens, annee);
CREATE INDEX IF NOT EXISTS idx_nace_cont_edition    ON nace_continents (edition);
