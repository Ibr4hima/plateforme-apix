-- Commerce extérieur du Sénégal — Note d'Analyse du Commerce Extérieur
-- (NACE, ANSD, rapport annuel). Exportations/importations par chapitre du
-- Système Harmonisé en valeur (millions FCFA) et poids net (tonnes) —
-- tableaux 38 à 41 des annexes de l'édition 2019 (numérotation variable
-- selon les éditions). Nomenclature la plus fine des annexes : jusqu'à
-- 97 chapitres SH par sens, aux libellés longs (« PRODUITS DE LA
-- MINOTERIE;MALT;AMIDONS ET FECULES;INULINE;GLUTEN DE FROMENT »).
--
-- Même structure et mêmes règles que les autres familles NACE : une ligne
-- = un chapitre × un sens × une année × une édition ; chaque édition N
-- porte les années N-4..N, les fenêtres se chevauchent et la lecture
-- retient, pour chaque année, l'édition la plus récente. Libellés
-- normalisés à l'extraction (le PDF les écrit en capitales, avec des
-- points-virgules comme séparateurs) ; ligne TOTAL non stockée — elle
-- sert de contrôle d'intégrité à l'import. Comme pour les groupes
-- d'utilisation, les chapitres sont exhaustifs : leur somme est le total
-- du commerce extérieur, il n'y a pas de ligne « Autres ».

CREATE TABLE IF NOT EXISTS nace_chapitres (
    id       SERIAL PRIMARY KEY,
    chapitre text    NOT NULL,                                 -- libellé normalisé
    sens     text    NOT NULL CHECK (sens IN ('export','import')),
    annee    integer NOT NULL,
    valeur   numeric,                                          -- millions FCFA
    poids    numeric,                                          -- tonnes
    edition  integer NOT NULL,                                 -- année du rapport NACE source
    UNIQUE (chapitre, sens, annee, edition)
);

CREATE INDEX IF NOT EXISTS idx_nace_ch_sens_annee ON nace_chapitres (sens, annee);
CREATE INDEX IF NOT EXISTS idx_nace_ch_edition    ON nace_chapitres (edition);
