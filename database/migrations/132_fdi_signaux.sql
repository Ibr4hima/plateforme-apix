-- Signaux d'investisseur fDi Markets (« Investor Signals »)
--
-- Une quatrième nomenclature, indépendante des trois autres. Là où le
-- sous-secteur dit ce que l'entreprise produit et l'activité ce qu'elle vient
-- faire dans le pays, le signal dit **où en est son intention** :
--
--   Considering Project (New or Expansion)   un projet est à l'étude, souvent
--                                            avec le pays déjà identifié ;
--   New Investment Strategy                  une intention large, sans pays ;
--   New Funding / Resources for Expansion     l'entreprise a levé de quoi
--                                            financer une expansion ;
--   New Personnel                            elle recrute pour une région ;
--   New Overseas Supplier Contracts          elle a décroché un contrat à
--                                            l'étranger.
--
-- C'est la colonne la plus prospective de fDi : elle ne décrit pas un projet
-- annoncé mais une entreprise qui pourrait en annoncer un. Pour une agence de
-- promotion, c'est la matière première du démarchage — d'où l'intérêt de la
-- porter en base dès maintenant.
--
-- Deux colonnes de définition, ce que les autres nomenclatures n'ont pas :
-- « New Personnel » ne se devine pas — il s'agit d'une nomination régionale
-- qui laisse présager une implantation. Sans la définition, un lecteur
-- interpréterait de travers un signal faible. Elles sont donc versionnées avec
-- le reste et affichées à l'écran.
--
-- Mêmes règles que les trois autres tables : code stable fabriqué par nous,
-- clé d'appariement normalisée, colonne `origine` qui protège les corrections
-- saisies dans l'administration, et pas de suppression.

CREATE TABLE IF NOT EXISTS fdi_signaux (
    id              SERIAL PRIMARY KEY,
    code            text     NOT NULL UNIQUE,
    libelle_en      text     NOT NULL UNIQUE,
    libelle_fr      text     NOT NULL,
    definition_en   text     NOT NULL DEFAULT '',
    definition_fr   text     NOT NULL DEFAULT '',
    cle_appariement text     NOT NULL UNIQUE,
    ordre           smallint NOT NULL,
    origine         text     NOT NULL DEFAULT 'depot'
        CHECK (origine IN ('depot', 'admin')),
    modifie_le      timestamptz,
    modifie_par     text
);
