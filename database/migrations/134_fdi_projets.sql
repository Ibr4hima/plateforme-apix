-- Projets d'investissement annoncés — fDi Markets, onglet « Project database »
--
-- Un projet = une annonce d'investissement : telle entreprise a annoncé telle
-- opération dans tel pays, à telle date. C'est le complément prospectif de la
-- CNUCED, qui mesure ce qui est entré ; fDi recense ce qui a été décidé.
--
-- ── Trois principes qui gouvernent ce schéma ─────────────────────────────────
--
-- 1. LA VALEUR BRUTE EST TOUJOURS CONSERVÉE. Chaque colonne rattachée à un
--    référentiel garde à côté d'elle le texte exact lu dans la source. La
--    source tronque ses libellés côté serveur (« Clothing & clothing acc… ») :
--    le rattachement est donc une INTERPRÉTATION, et une interprétation doit
--    pouvoir être rejouée, contestée, corrigée. Sans le brut, une erreur de
--    résolution devient indétectable.
--
-- 2. AUCUN DÉDOUBLONNAGE AUTOMATIQUE. fDi ne publie pas d'identifiant de
--    projet exploitable. Quatre lignes peuvent partager entreprise, date,
--    sous-secteur et montant tout en décrivant quatre projets distincts — seule
--    leur description les sépare, et elle est saisie APRÈS l'import. Toute
--    fusion automatique en détruirait donc. D'où le modèle de LOT : réimporter
--    une page remplace son lot entier plutôt que de rapprocher ligne à ligne.
--
-- 3. L'ESTIMATION EST UNE PROPRIÉTÉ DE CHAQUE VALEUR, PAS DE LA LIGNE. Dans la
--    source, l'astérisque marque les montants et effectifs calculés par
--    l'algorithme du Financial Times. Un même projet peut porter un capex
--    déclaré et un nombre d'emplois estimé — c'est le cas d'ACWA Power :
--    800 M$ sans astérisque, 773 emplois avec. D'où deux drapeaux distincts.
--    Afficher une estimation comme un fait exposerait la Présidence à une
--    contradiction publique ; ces colonnes existent pour l'empêcher.

-- ── Lots d'import ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fdi_lots_import (
    id          SERIAL PRIMARY KEY,
    libelle     text NOT NULL,                    -- « Sénégal — page 1 »
    -- Le périmètre de la recherche fDi qui a produit ce lot : sans lui, on ne
    -- saurait pas ce que le lot est censé contenir, ni quand le rejouer.
    perimetre   text,                             -- « Dest = Senegal »
    source      text NOT NULL DEFAULT 'saisie'
        CHECK (source IN ('saisie', 'page_html', 'export')),
    importe_le  timestamptz NOT NULL DEFAULT now(),
    importe_par text,
    nb_lignes   integer NOT NULL DEFAULT 0
);

-- ── Entreprises ──────────────────────────────────────────────────────────────
-- Construites par les imports, jamais fournies : chaque nom rencontré crée ou
-- retrouve une ligne. Le nom peut n'être connu que tronqué au départ ; il se
-- complète depuis l'administration, et tous les projets rattachés suivent,
-- puisqu'ils portent l'identifiant et non le texte.
CREATE TABLE IF NOT EXISTS fdi_entreprises (
    id             SERIAL PRIMARY KEY,
    nom            text NOT NULL,
    -- Minuscules, sans accent, espaces réduits : deux graphies d'un même nom
    -- ne doivent pas créer deux entreprises.
    nom_normalise  text NOT NULL UNIQUE,
    -- « complet » : le nom est celui de l'entreprise. « tronque » : il vient
    -- d'un affichage coupé et attend d'être complété à la main.
    statut_nom     text NOT NULL DEFAULT 'complet'
        CHECK (statut_nom IN ('complet', 'tronque')),
    pays_id        integer REFERENCES ref_pays(id),
    created_at     timestamptz NOT NULL DEFAULT now(),
    modifie_le     timestamptz,
    modifie_par    text
);

-- ── Mémoire des arbitrages ───────────────────────────────────────────────────
-- « Banque de dévelo… » a été résolu en « Banque de développement du Mali » :
-- on s'en souvient pour le PROPOSER la fois suivante.
--
-- Cette table est une mémoire, pas une règle : le même texte tronqué peut
-- désigner deux entreprises différentes — « Banque de dévelo… » vaut aussi bien
-- pour la Banque de développement des États de l'Afrique centrale. La clé
-- primaire porte donc sur le COUPLE (alias, entreprise), et jamais sur l'alias
-- seul : plusieurs entreprises peuvent légitimement répondre au même préfixe,
-- et c'est à un humain de trancher, projet par projet.
CREATE TABLE IF NOT EXISTS fdi_entreprise_alias (
    id             SERIAL PRIMARY KEY,
    alias_brut     text NOT NULL,                 -- verbatim, « … » compris
    alias_normalise text NOT NULL,
    tronque        boolean NOT NULL DEFAULT false,
    entreprise_id  integer NOT NULL REFERENCES fdi_entreprises(id) ON DELETE CASCADE,
    -- Combien de fois cet arbitrage a été retenu : les propositions se classent
    -- par fréquence, le cas le plus courant remonte en tête.
    occurrences    integer NOT NULL DEFAULT 1,
    decide_le      timestamptz NOT NULL DEFAULT now(),
    decide_par     text,
    UNIQUE (alias_normalise, entreprise_id)
);
CREATE INDEX IF NOT EXISTS idx_fdi_alias_normalise ON fdi_entreprise_alias (alias_normalise);

-- ── Projets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fdi_projets (
    id      SERIAL PRIMARY KEY,
    lot_id  integer NOT NULL REFERENCES fdi_lots_import(id) ON DELETE CASCADE,
    -- Rang dans la source. C'est la seule identité stable d'une ligne tant que
    -- sa description n'est pas saisie : quatre lignes jumelles se distinguent
    -- par leur position, faute de mieux.
    ligne   smallint NOT NULL,

    -- La source ne donne que le mois : « Jun 2026 ». Pas de jour, donc pas de
    -- date au sens SQL — deux colonnes plutôt qu'une date fictive au 1er du
    -- mois, qui laisserait croire à une précision qui n'existe pas.
    annee   smallint NOT NULL,
    mois    smallint CHECK (mois BETWEEN 1 AND 12),

    -- Entreprises : le brut d'abord, le rattachement ensuite.
    parent_brut       text,
    parent_id         integer REFERENCES fdi_entreprises(id),
    entreprise_brut   text,
    entreprise_id     integer REFERENCES fdi_entreprises(id),
    -- « resolu » : un humain a tranché. « propose » : hypothèse non confirmée.
    -- « en_attente » : rien encore. L'écran peut ainsi dire honnêtement combien
    -- de projets restent à arbitrer, au lieu de laisser croire que tout est net.
    statut_entreprise text NOT NULL DEFAULT 'en_attente'
        CHECK (statut_entreprise IN ('resolu', 'propose', 'en_attente')),

    -- Pays : mêmes règles. ref_pays ne porte pas de nom anglais fiable, le
    -- rattachement se fera donc par correspondance explicite, jamais deviné.
    pays_source_brut  text,
    pays_source_id    integer REFERENCES ref_pays(id),
    pays_dest_brut    text,
    pays_dest_id      integer REFERENCES ref_pays(id),

    -- Nomenclatures : brut conservé, identifiant nul tant que la résolution
    -- n'est pas certaine (deux sous-secteurs de Transportation & Warehousing
    -- restent indiscernables sous 28 caractères).
    secteur_brut       text,
    secteur_id         integer REFERENCES fdi_secteurs(id),
    sous_secteur_brut  text,
    sous_secteur_id    integer REFERENCES fdi_sous_secteurs(id),
    activite_brut      text,
    activite_id        integer REFERENCES fdi_activites(id),
    type_brut          text,
    type_projet_id     integer REFERENCES fdi_types_projet(id),

    -- Millions de dollars, comme la source. Le drapeau est nul quand la valeur
    -- l'est : « estimé » ne veut rien dire sans montant.
    capex_musd     numeric(14, 2),
    capex_estime   boolean,
    emplois        integer,
    emplois_estime boolean,

    -- Saisies à la main depuis l'administration. Le français est facultatif :
    -- traduire 235 descriptions avant d'afficher le moindre écran retarderait
    -- tout, alors que l'anglais suffit à analyser.
    description_en text,
    description_fr text,

    created_at  timestamptz NOT NULL DEFAULT now(),
    modifie_le  timestamptz,
    modifie_par text,
    UNIQUE (lot_id, ligne)
);

CREATE INDEX IF NOT EXISTS idx_fdi_projets_annee       ON fdi_projets (annee, mois);
CREATE INDEX IF NOT EXISTS idx_fdi_projets_dest        ON fdi_projets (pays_dest_id);
CREATE INDEX IF NOT EXISTS idx_fdi_projets_secteur     ON fdi_projets (secteur_id);
CREATE INDEX IF NOT EXISTS idx_fdi_projets_entreprise  ON fdi_projets (entreprise_id);
-- Les écrans d'arbitrage et de saisie interrogent d'abord ce qui reste à faire.
CREATE INDEX IF NOT EXISTS idx_fdi_projets_a_arbitrer  ON fdi_projets (statut_entreprise)
    WHERE statut_entreprise <> 'resolu';
CREATE INDEX IF NOT EXISTS idx_fdi_projets_sans_desc   ON fdi_projets (id)
    WHERE description_en IS NULL;
