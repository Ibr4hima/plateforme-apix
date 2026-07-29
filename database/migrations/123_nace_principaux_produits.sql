-- Commerce extérieur du Sénégal — Note d'Analyse du Commerce Extérieur
-- (NACE, ANSD, rapport annuel). Tableaux 8 à 11 des annexes : principaux
-- produits exportés/importés en valeur (millions FCFA) et poids net
-- (tonnes). Une ligne = un produit × un sens × une année × une édition.
--
-- Chaque édition N porte les années N-4..N : les fenêtres se chevauchent
-- et une même année peut être révisée d'une édition à l'autre. On
-- conserve donc chaque édition (traçabilité provisoire/révisé) et la
-- lecture retient, pour chaque année, l'édition la plus récente.
--
-- Les libellés sont normalisés à l'extraction (fautes du PDF corrigées,
-- casse et intitulés unifiés entre tableaux valeur et poids) pour que la
-- jointure valeur ⇆ poids tienne sur le libellé. La ligne « Autres
-- produits » est conservée (utile pour les parts) ; la ligne TOTAL ne
-- l'est pas — elle sert de contrôle d'intégrité à l'import.

CREATE TABLE IF NOT EXISTS nace_principaux_produits (
    id      SERIAL PRIMARY KEY,
    produit text    NOT NULL,                                  -- libellé normalisé
    sens    text    NOT NULL CHECK (sens IN ('export','import')),
    annee   integer NOT NULL,
    valeur  numeric,                                           -- millions FCFA (T8/T10)
    poids   numeric,                                           -- tonnes (T9/T11)
    edition integer NOT NULL,                                  -- année du rapport NACE source
    UNIQUE (produit, sens, annee, edition)
);

CREATE INDEX IF NOT EXISTS idx_nace_pp_sens_annee ON nace_principaux_produits (sens, annee);
CREATE INDEX IF NOT EXISTS idx_nace_pp_edition    ON nace_principaux_produits (edition);
