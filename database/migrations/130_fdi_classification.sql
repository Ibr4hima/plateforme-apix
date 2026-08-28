-- Classification sectorielle fDi Markets (Financial Times)
--
-- Trois nomenclatures, deux natures différentes :
--
--   fdi_secteurs        37 secteurs
--   fdi_sous_secteurs   270 sous-secteurs, rattachés à un secteur
--   fdi_activites       17 « business activities »
--
-- Les activités ne sont PAS une troisième couche de l'arbre sectoriel : elles
-- disent ce que l'entreprise vient faire dans le pays — usine, siège, centre
-- de R&D, logistique, back-office — indépendamment de son secteur. Un même
-- projet porte donc un sous-secteur ET une activité, d'où deux tables sans
-- lien entre elles.
--
-- ── Le point qui gouverne tout le schéma ─────────────────────────────────────
-- Un libellé de sous-secteur n'identifie rien à lui seul : fDi réutilise les
-- mêmes intitulés sous plusieurs secteurs. « Other » revient sous 24 secteurs
-- sur 37, « Furniture & related products » sous 3, « Wholesale Trade » sous 2.
-- La source les distingue en suffixant le secteur entre parenthèses :
-- « Other (Aerospace) », « Other (Metals) ».
--
-- D'où trois colonnes de libellé anglais, chacune avec son rôle :
--
--   libelle_en       verbatim de la source, parenthèse comprise. C'est la
--                    forme que porteront les exports de projets ; elle est
--                    unique et sert de clé d'appariement directe.
--   libelle_en_base  le même, parenthèse de désambiguïsation retirée. Sert
--                    quand un export ne porte pas la parenthèse — il faut
--                    alors le secteur pour trancher.
--   cle_appariement  libelle_en_base normalisé (minuscules, sans accent,
--                    « & » → « and », espaces réduits), pour absorber les
--                    écarts de casse et de ponctuation d'un export à l'autre.
--
-- L'unicité porte donc sur (secteur_id, cle_appariement), jamais sur la clé
-- seule : la contrainte dit exactement ce que la donnée permet.
--
-- Les codes sont fabriqués par nous (slug du libellé anglais, préfixé du
-- secteur pour les sous-secteurs) et non repris de fDi : ils restent stables
-- si le fournisseur renumérote sa nomenclature. Ils sont dérivés par
-- backend/scripts/fdi/generer_csv.py, qui refuse d'écrire en cas de collision.

CREATE TABLE IF NOT EXISTS fdi_secteurs (
    id         SERIAL PRIMARY KEY,
    code       text     NOT NULL UNIQUE,          -- slug stable, ex. coal_oil_gas
    libelle_en text     NOT NULL UNIQUE,          -- verbatim fDi
    libelle_fr text     NOT NULL,
    ordre      smallint NOT NULL                  -- ordre de la nomenclature source
);

CREATE TABLE IF NOT EXISTS fdi_sous_secteurs (
    id              SERIAL PRIMARY KEY,
    code            text     NOT NULL UNIQUE,     -- ex. aerospace__other
    secteur_id      integer  NOT NULL REFERENCES fdi_secteurs(id) ON DELETE CASCADE,
    libelle_en      text     NOT NULL UNIQUE,     -- verbatim, parenthèse comprise
    libelle_fr      text     NOT NULL,
    libelle_en_base text     NOT NULL,            -- sans la parenthèse
    cle_appariement text     NOT NULL,            -- libelle_en_base normalisé
    ordre           smallint NOT NULL,
    UNIQUE (secteur_id, cle_appariement)
);

-- Recherche par libellé lors de l'import des projets : la clé seule ne
-- discrimine pas (« other » vaut pour 24 secteurs), mais elle réduit la
-- recherche à quelques lignes avant l'arbitrage par le secteur.
CREATE INDEX IF NOT EXISTS idx_fdi_sous_secteurs_cle ON fdi_sous_secteurs (cle_appariement);
CREATE INDEX IF NOT EXISTS idx_fdi_sous_secteurs_secteur ON fdi_sous_secteurs (secteur_id);

CREATE TABLE IF NOT EXISTS fdi_activites (
    id              SERIAL PRIMARY KEY,
    code            text     NOT NULL UNIQUE,
    libelle_en      text     NOT NULL UNIQUE,
    libelle_fr      text     NOT NULL,
    cle_appariement text     NOT NULL UNIQUE,
    ordre           smallint NOT NULL
);
