-- Commerce extérieur du Sénégal — Note d'Analyse du Commerce Extérieur
-- (NACE, ANSD, rapport annuel). Exportations/importations par produits
-- regroupés en valeur (millions FCFA) et poids net (tonnes) — tableaux 12
-- à 15 des annexes de l'édition 2019 (numérotation variable selon les
-- éditions). Nomenclature ANSD d'une quarantaine de postes par sens, plus
-- fine que celle des « principaux produits » (table 123).
--
-- Même structure et mêmes règles que nace_principaux_produits : une ligne
-- = un produit × un sens × une année × une édition ; chaque édition N
-- porte les années N-4..N, les fenêtres se chevauchent et la lecture
-- retient, pour chaque année, l'édition la plus récente. Libellés
-- normalisés à l'extraction (le PDF les écrit en capitales), ligne
-- « Autres produits » conservée, ligne TOTAL non stockée (contrôle
-- d'intégrité à l'import).

CREATE TABLE IF NOT EXISTS nace_produits_regroupes (
    id      SERIAL PRIMARY KEY,
    produit text    NOT NULL,                                  -- libellé normalisé
    sens    text    NOT NULL CHECK (sens IN ('export','import')),
    annee   integer NOT NULL,
    valeur  numeric,                                           -- millions FCFA
    poids   numeric,                                           -- tonnes
    edition integer NOT NULL,                                  -- année du rapport NACE source
    UNIQUE (produit, sens, annee, edition)
);

CREATE INDEX IF NOT EXISTS idx_nace_pr_sens_annee ON nace_produits_regroupes (sens, annee);
CREATE INDEX IF NOT EXISTS idx_nace_pr_edition    ON nace_produits_regroupes (edition);
