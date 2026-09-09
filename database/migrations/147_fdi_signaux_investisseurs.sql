-- =============================================================================
-- 147 — Le relevé des signaux d'investisseur (« Investor signals »).
-- =============================================================================
--
-- CE QUE C'EST, et en quoi cela diffère des projets annoncés. Un projet
-- annoncé est un fait : une entreprise, un pays, un montant. Un signal est une
-- INTENTION — l'entreprise étudie, lève des fonds, nomme un responsable
-- régional. Pour une agence de promotion, c'est la matière première du
-- démarchage : on n'attend pas qu'un projet soit annoncé pour aller voir.
--
-- LA DIFFÉRENCE QUI COMMANDE TOUT LE SCHÉMA : un signal peut viser PLUSIEURS
-- destinations, relever de PLUSIEURS secteurs, de PLUSIEURS activités et de
-- PLUSIEURS natures à la fois. Un projet annoncé n'a jamais qu'un pays et
-- qu'un secteur ; un signal, non. D'où quatre tables de liaison là où les
-- projets se contentent de colonnes.
--
-- ET LA DESTINATION N'EST PAS TOUJOURS UN PAYS. fDi la définit comme
-- « world-region/country » : un signal peut viser « Africa » ou « Middle East »
-- sans nommer aucun pays. Ces régions du monde sont un découpage PROPRE À fDi,
-- qui ne recoupe pas le nôtre — « Asia-Pacific » enjambe deux de nos
-- continents, « Middle East » chevauche l'Asie et l'Afrique, et leur
-- « North America » n'est pas l'Amérique du Nord géographique. Les faire
-- entrer dans ref_groupements fausserait tous nos agrégats géographiques. On
-- en fait donc une nomenclature fDi de plus, à côté des secteurs, sous-secteurs,
-- activités et natures de signal.
--
-- CE QUE LA BASE NE POURRA JAMAIS AFFIRMER ICI, et qu'il faut écrire noir sur
-- blanc : l'exhaustivité de ces quatre colonnes. Le tableau de fDi n'affiche
-- qu'une valeur par case et cache les autres derrière un bouton, sans même
-- signaler de façon fiable qu'il en cache. Le relevé porte donc ce qui est
-- visible, et les valeurs manquantes s'ajoutent à la main depuis
-- l'administration. Un décompte « signaux citant le Sénégal » est un PLANCHER,
-- jamais un total — les écrans doivent le dire.
--
-- D'où la colonne `origine` sur chaque table de liaison : « import » pour ce
-- qui vient du relevé, « saisie » pour ce qu'un humain a ajouté. Le réimport ne
-- réécrit que les siennes. Sans cette distinction, la première mise à jour du
-- relevé effacerait des heures de complétion manuelle, en silence.
-- =============================================================================

-- ── Les lots portent désormais leur base ─────────────────────────────────────
-- fdi_lots_import servait aux seuls projets. Deux relevés vont y cohabiter, et
-- rien ne les distinguait : un lot de signaux aurait été lu comme un lot de
-- projets par les requêtes qui établissent les périmètres complets, faisant
-- croire à une couverture qui n'existe pas.
ALTER TABLE fdi_lots_import
    ADD COLUMN IF NOT EXISTS base text NOT NULL DEFAULT 'projets'
        CHECK (base IN ('projets', 'signaux'));

COMMENT ON COLUMN fdi_lots_import.base IS
    'Quel relevé ce lot alimente. Les requêtes de périmètre doivent filtrer dessus : les deux bases ne se mélangent pas.';

-- ── Les régions du monde de fDi ──────────────────────────────────────────────
-- Sept postes, versionnés dans le dépôt comme les quatre autres nomenclatures
-- (fdi_regions_monde.csv). Même forme : code stable, libellés, clé
-- d'appariement normalisée, et `origine` qui protège une correction saisie.
CREATE TABLE IF NOT EXISTS fdi_regions_monde (
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

COMMENT ON TABLE fdi_regions_monde IS
    'Les régions du monde telles que fDi les découpe. Découpage propre à la source : ne pas confondre avec ref_pays.continent ni ref_pays.region_geo, qu''il ne recoupe pas.';

-- ── Le relevé ────────────────────────────────────────────────────────────────
-- Ne portent ici que les colonnes RÉELLEMENT uniques dans la source : la date,
-- l'entreprise, sa maison mère, le marché source et les deux montants.
CREATE TABLE IF NOT EXISTS fdi_signaux_investisseurs (
    id            SERIAL PRIMARY KEY,
    lot_id        integer  NOT NULL REFERENCES fdi_lots_import(id) ON DELETE CASCADE,
    ligne         smallint NOT NULL,
    annee         smallint NOT NULL,
    mois          smallint,

    -- Mêmes colonnes brutes que les projets, et pour la même raison : le
    -- libellé de la source est conservé même quand le rapprochement réussit,
    -- de sorte qu'une correction de référentiel puisse être rejouée.
    parent_brut       text,
    parent_id         integer REFERENCES fdi_entreprises(id),
    entreprise_brut   text,
    entreprise_id     integer REFERENCES fdi_entreprises(id),
    statut_entreprise text NOT NULL DEFAULT 'en_attente'
        CHECK (statut_entreprise IN ('en_attente', 'propose', 'resolu')),
    pays_source_brut  text,
    pays_source_id    integer REFERENCES ref_pays(id),

    -- DEUX MONTANTS QUI NE SE SOMMENT PAS. « Capital investment » est un
    -- investissement prévu ; « Funding raised » est de l'argent déjà levé.
    -- Les additionner n'aurait aucun sens, et une colonne unique « montant »
    -- aurait fini par les confondre. L'estimation se marque champ par champ,
    -- comme aux projets : « * » dans la source.
    capex_musd     numeric(14,2),
    capex_estime   boolean,
    funding_musd   numeric(14,2),
    funding_estime boolean,

    champs_verrouilles text[] NOT NULL DEFAULT '{}',
    origine     text NOT NULL DEFAULT 'import'
        CHECK (origine IN ('import', 'saisie')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    modifie_le  timestamptz,
    modifie_par text,

    UNIQUE (lot_id, ligne)
);

CREATE INDEX IF NOT EXISTS idx_fdi_sig_lot        ON fdi_signaux_investisseurs (lot_id);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_annee      ON fdi_signaux_investisseurs (annee, mois);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_entreprise ON fdi_signaux_investisseurs (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_source     ON fdi_signaux_investisseurs (pays_source_id);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_a_arbitrer ON fdi_signaux_investisseurs (statut_entreprise)
    WHERE statut_entreprise <> 'resolu';

-- ── Les quatre valeurs multiples ─────────────────────────────────────────────
-- Toutes bâties sur le même moule, et il vaut d'être expliqué une fois :
--
--   `rang`    l'ordre de la source, puis celui des ajouts. Le relevé est
--             verbatim jusque dans l'ordre des valeurs.
--   `brut`    le libellé tel qu'écrit — tronqué compris. C'est lui qui retrouve
--             le poste par préfixe, et lui qu'on réexamine si l'appariement a
--             échoué.
--   `origine` « import » ou « saisie ». Le réimport n'efface que « import » :
--             ce qu'un humain a ajouté lui survit.

CREATE TABLE IF NOT EXISTS fdi_signal_destinations (
    id        SERIAL PRIMARY KEY,
    signal_id integer  NOT NULL REFERENCES fdi_signaux_investisseurs(id) ON DELETE CASCADE,
    rang      smallint NOT NULL,
    brut      text,
    -- L'UN OU L'AUTRE, JAMAIS LES DEUX : une destination est un pays ou une
    -- région du monde. Les deux nuls signifie « pas encore rapproché », état
    -- normal tant qu'un libellé tronqué n'a pas été tranché.
    pays_id   integer REFERENCES ref_pays(id),
    region_id integer REFERENCES fdi_regions_monde(id),
    origine   text NOT NULL DEFAULT 'import' CHECK (origine IN ('import', 'saisie')),
    CONSTRAINT dest_pays_ou_region CHECK (pays_id IS NULL OR region_id IS NULL),
    UNIQUE (signal_id, rang)
);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_dest_signal ON fdi_signal_destinations (signal_id);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_dest_pays   ON fdi_signal_destinations (pays_id);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_dest_region ON fdi_signal_destinations (region_id);

CREATE TABLE IF NOT EXISTS fdi_signal_secteurs (
    id         SERIAL PRIMARY KEY,
    signal_id  integer  NOT NULL REFERENCES fdi_signaux_investisseurs(id) ON DELETE CASCADE,
    rang       smallint NOT NULL,
    brut       text,
    secteur_id integer REFERENCES fdi_secteurs(id),
    origine    text NOT NULL DEFAULT 'import' CHECK (origine IN ('import', 'saisie')),
    UNIQUE (signal_id, rang)
);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_sect_signal  ON fdi_signal_secteurs (signal_id);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_sect_secteur ON fdi_signal_secteurs (secteur_id);

CREATE TABLE IF NOT EXISTS fdi_signal_activites (
    id          SERIAL PRIMARY KEY,
    signal_id   integer  NOT NULL REFERENCES fdi_signaux_investisseurs(id) ON DELETE CASCADE,
    rang        smallint NOT NULL,
    brut        text,
    activite_id integer REFERENCES fdi_activites(id),
    origine     text NOT NULL DEFAULT 'import' CHECK (origine IN ('import', 'saisie')),
    UNIQUE (signal_id, rang)
);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_act_signal   ON fdi_signal_activites (signal_id);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_act_activite ON fdi_signal_activites (activite_id);

-- La NATURE du signal — « Considering Project », « New Personnel »… — pointe
-- vers fdi_signaux, qui est la nomenclature et non le relevé. Les deux noms se
-- ressemblent ; c'est pourquoi le relevé s'appelle fdi_signaux_investisseurs,
-- du nom que fDi donne lui-même à cette base.
CREATE TABLE IF NOT EXISTS fdi_signal_natures (
    id        SERIAL PRIMARY KEY,
    signal_id integer  NOT NULL REFERENCES fdi_signaux_investisseurs(id) ON DELETE CASCADE,
    rang      smallint NOT NULL,
    brut      text,
    nature_id integer REFERENCES fdi_signaux(id),
    origine   text NOT NULL DEFAULT 'import' CHECK (origine IN ('import', 'saisie')),
    UNIQUE (signal_id, rang)
);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_nat_signal ON fdi_signal_natures (signal_id);
CREATE INDEX IF NOT EXISTS idx_fdi_sig_nat_nature ON fdi_signal_natures (nature_id);
