-- =============================================================================
-- APIX - Plateforme Numérique de Gestion des Investissements
-- Schéma PostgreSQL complet — v1.0
-- Auteur : DIPE / Data Analyst
-- =============================================================================
-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";         -- Cartographie
CREATE EXTENSION IF NOT EXISTS "unaccent";        -- Normalisation texte (recherche)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Recherche floue (similarité de texte)

-- =============================================================================
-- TABLES DE RÉFÉRENCE (Lookups partagés entre modules)
-- =============================================================================

-- Pays (référentiel ISO 3166)
CREATE TABLE ref_pays (
    id              SERIAL PRIMARY KEY,
    code_iso2       CHAR(2) UNIQUE NOT NULL,
    code_iso3       CHAR(3) UNIQUE NOT NULL,
    nom_fr          VARCHAR(100) NOT NULL,
    nom_en          VARCHAR(100),
    region_monde    VARCHAR(100),   -- Ex : Afrique subsaharienne, Europe occidentale
    zone_economique VARCHAR(100),   -- Ex : CEDEAO, UE, OCDE, BRICS
    actif           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Secteurs d'activité (niveau 1)
CREATE TABLE ref_secteurs (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,
    nom_fr      VARCHAR(150) NOT NULL,
    nom_en      VARCHAR(150),
    description TEXT,
    actif       BOOLEAN DEFAULT TRUE
);

-- Branches d'activité (niveau 2 — rattachées à un secteur)
CREATE TABLE ref_branches (
    id          SERIAL PRIMARY KEY,
    secteur_id  INTEGER NOT NULL REFERENCES ref_secteurs(id),
    code        VARCHAR(20) UNIQUE NOT NULL,
    nom_fr      VARCHAR(150) NOT NULL,
    nom_en      VARCHAR(150),
    actif       BOOLEAN DEFAULT TRUE
);

-- Devises
CREATE TABLE ref_devises (
    id          SERIAL PRIMARY KEY,
    code_iso    CHAR(3) UNIQUE NOT NULL,   -- Ex : USD, EUR, XOF
    nom         VARCHAR(100) NOT NULL,
    symbole     VARCHAR(10),
    actif       BOOLEAN DEFAULT TRUE
);

-- Statuts génériques (réutilisables par modules)
CREATE TABLE ref_statuts (
    id          SERIAL PRIMARY KEY,
    module      VARCHAR(50) NOT NULL,      -- Ex : 'ide', 'intention', 'prospect'
    code        VARCHAR(50) NOT NULL,
    libelle_fr  VARCHAR(100) NOT NULL,
    couleur_hex VARCHAR(7),                -- Pour affichage UI (#FF5733)
    UNIQUE(module, code)
);

-- Types de source de données
CREATE TABLE ref_sources (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(50) UNIQUE NOT NULL,
    nom         VARCHAR(150) NOT NULL,     -- Ex : FDI Markets, CNUCED, Saisie manuelle
    type        VARCHAR(30) NOT NULL       -- 'scraping', 'api', 'manuel', 'import'
        CHECK (type IN ('scraping', 'api', 'manuel', 'import')),
    url         TEXT,
    actif       BOOLEAN DEFAULT TRUE
);


-- =============================================================================
-- MODULE 1 — INVESTISSEMENTS DIRECTS ÉTRANGERS (IDE)
-- =============================================================================

CREATE TABLE ide_flux (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    pays_origine_id     INTEGER NOT NULL REFERENCES ref_pays(id),
    pays_destination_id INTEGER NOT NULL REFERENCES ref_pays(id),  -- Sénégal par défaut
    secteur_id          INTEGER REFERENCES ref_secteurs(id),
    branche_id          INTEGER REFERENCES ref_branches(id),

    -- Données financières
    montant             NUMERIC(18, 2) NOT NULL,
    devise_id           INTEGER NOT NULL REFERENCES ref_devises(id),
    montant_usd         NUMERIC(18, 2),                 -- Converti automatiquement
    annee               SMALLINT NOT NULL,
    trimestre           SMALLINT CHECK (trimestre BETWEEN 1 AND 4),

    -- Classification
    type_flux           VARCHAR(20) NOT NULL
        CHECK (type_flux IN ('entrant', 'sortant')),
    nature_investissement VARCHAR(50),                  -- Greenfield, M&A, Réinvestissement
    emplois_crees       INTEGER,
    emplois_indirects   INTEGER,

    -- Entreprise concernée (optionnel)
    nom_entreprise      VARCHAR(255),
    entreprise_id       UUID,                           -- FK vers module 4 (entreprises_installees)

    -- Traçabilité
    source_id           INTEGER REFERENCES ref_sources(id),
    source_reference    VARCHAR(255),                   -- Référence interne de la source
    statut_id           INTEGER REFERENCES ref_statuts(id),
    est_verifie         BOOLEAN DEFAULT FALSE,
    note_interne        TEXT,

    -- Métadonnées
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    is_deleted          BOOLEAN DEFAULT FALSE           -- Soft delete
);

-- Index pour les requêtes analytiques fréquentes
CREATE INDEX idx_ide_annee ON ide_flux(annee);
CREATE INDEX idx_ide_pays_origine ON ide_flux(pays_origine_id);
CREATE INDEX idx_ide_secteur ON ide_flux(secteur_id);
CREATE INDEX idx_ide_type ON ide_flux(type_flux);


-- =============================================================================
-- MODULE 2 — INTENTIONS D'INVESTISSEMENT
-- =============================================================================

CREATE TABLE intentions_investissement (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification de l'investisseur
    investisseur_nom    VARCHAR(255) NOT NULL,
    investisseur_pays_id INTEGER REFERENCES ref_pays(id),
    investisseur_type   VARCHAR(50)
        CHECK (investisseur_type IN ('entreprise', 'fonds', 'institutionnel', 'individuel', 'autre')),
    prospect_id         UUID,                           -- FK vers module 3 (prospects)

    -- Détails du projet
    titre_projet        VARCHAR(500) NOT NULL,
    description         TEXT,
    secteur_id          INTEGER REFERENCES ref_secteurs(id),
    branche_id          INTEGER REFERENCES ref_branches(id),
    zone_investissement VARCHAR(100),                   -- Région ou zone au Sénégal
    localisation_geo    GEOMETRY(Point, 4326),          -- Coordonnées GPS si connues

    -- Données financières
    montant_projete     NUMERIC(18, 2),
    devise_id           INTEGER REFERENCES ref_devises(id),
    montant_projete_usd NUMERIC(18, 2),
    horizon_court       DATE,                           -- Date cible < 1 an
    horizon_moyen       DATE,                           -- Date cible 1-3 ans
    horizon_long        DATE,                           -- Date cible > 3 ans

    -- Impact attendu
    emplois_prevus      INTEGER,
    description_impact  TEXT,

    -- Suivi APIX
    statut_id           INTEGER REFERENCES ref_statuts(id),
    agent_apix          VARCHAR(100),                   -- Responsable du suivi en interne
    date_premier_contact DATE,
    date_derniere_interaction DATE,
    prochaine_etape     TEXT,
    probabilite_realisation SMALLINT CHECK (probabilite_realisation BETWEEN 0 AND 100),

    -- Documents et contacts
    contact_nom         VARCHAR(255),
    contact_email       VARCHAR(255),
    contact_telephone   VARCHAR(50),
    contact_poste       VARCHAR(100),

    -- Traçabilité
    source_id           INTEGER REFERENCES ref_sources(id),
    note_interne        TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    is_deleted          BOOLEAN DEFAULT FALSE
);

-- Historique des interactions sur une intention
CREATE TABLE intentions_interactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intention_id    UUID NOT NULL REFERENCES intentions_investissement(id) ON DELETE CASCADE,
    date_interaction DATE NOT NULL,
    type_interaction VARCHAR(50)
        CHECK (type_interaction IN ('email', 'appel', 'reunion', 'visite', 'evenement', 'autre')),
    description     TEXT NOT NULL,
    agent_apix      VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intentions_statut ON intentions_investissement(statut_id);
CREATE INDEX idx_intentions_secteur ON intentions_investissement(secteur_id);
CREATE INDEX idx_intentions_pays ON intentions_investissement(investisseur_pays_id);


-- =============================================================================
-- MODULE 3 — PROSPECTS
-- =============================================================================

CREATE TABLE prospects (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification de l'entreprise
    nom_entreprise      VARCHAR(255) NOT NULL,
    nom_commercial      VARCHAR(255),
    pays_siege_id       INTEGER REFERENCES ref_pays(id),
    secteur_id          INTEGER REFERENCES ref_secteurs(id),
    branche_id          INTEGER REFERENCES ref_branches(id),
    site_web            TEXT,
    description         TEXT,

    -- Profil financier
    chiffre_affaires    NUMERIC(18, 2),
    devise_ca_id        INTEGER REFERENCES ref_devises(id),
    annee_ca            SMALLINT,
    taille_entreprise   VARCHAR(30)
        CHECK (taille_entreprise IN ('TPE', 'PME', 'ETI', 'GE', 'multinationale')),
    nombre_employes     INTEGER,
    classement_mondial  VARCHAR(100),                   -- Ex : Fortune 500, Forbes Global 2000

    -- Intérêt pour le Sénégal
    niveau_interet      VARCHAR(30)
        CHECK (niveau_interet IN ('froid', 'tiede', 'chaud', 'tres_chaud')),
    secteurs_interet    TEXT[],                         -- Array de codes secteurs
    zones_interet       TEXT[],                         -- Array de zones au Sénégal
    raison_interet      TEXT,

    -- Contacts principaux
    contact_principal_nom   VARCHAR(255),
    contact_principal_email VARCHAR(255),
    contact_principal_tel   VARCHAR(50),
    contact_principal_poste VARCHAR(100),

    -- Suivi APIX
    statut_id           INTEGER REFERENCES ref_statuts(id),
    agent_apix          VARCHAR(100),
    date_identification DATE,
    source_identification VARCHAR(100),                 -- Comment ce prospect a été identifié
    evenement_id        UUID,                           -- FK vers module 8

    -- Traçabilité
    source_id           INTEGER REFERENCES ref_sources(id),
    note_interne        TEXT,
    tags                TEXT[],                         -- Tags libres pour filtrage
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    is_deleted          BOOLEAN DEFAULT FALSE
);

-- Interactions avec un prospect
CREATE TABLE prospects_interactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prospect_id     UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    date_interaction DATE NOT NULL,
    type_interaction VARCHAR(50)
        CHECK (type_interaction IN ('email', 'appel', 'reunion', 'visite', 'evenement', 'autre')),
    description     TEXT NOT NULL,
    agent_apix      VARCHAR(100),
    resultat        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospects_pays ON prospects(pays_siege_id);
CREATE INDEX idx_prospects_secteur ON prospects(secteur_id);
CREATE INDEX idx_prospects_interet ON prospects(niveau_interet);


-- =============================================================================
-- MODULE 4 — ENTREPRISES INSTALLÉES AU SÉNÉGAL
-- =============================================================================

CREATE TABLE entreprises_installees (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification légale
    raison_sociale      VARCHAR(255) NOT NULL,
    nom_commercial      VARCHAR(255),
    forme_juridique     VARCHAR(50),                    -- SA, SARL, SAS, GIE, etc.
    ninea               VARCHAR(20) UNIQUE,             -- Numéro d'identification fiscal SN
    rccm                VARCHAR(50),                    -- Registre du commerce
    date_creation       DATE,
    date_formalisation  DATE,

    -- Localisation
    adresse             TEXT,
    region_id           INTEGER,                        -- FK vers table régions Sénégal
    departement         VARCHAR(100),
    commune             VARCHAR(100),
    localisation_geo    GEOMETRY(Point, 4326),
    zone_investissement_id UUID,                        -- FK vers module 5

    -- Activité
    secteur_id          INTEGER REFERENCES ref_secteurs(id),
    branche_id          INTEGER REFERENCES ref_branches(id),
    description_activite TEXT,
    produits_services   TEXT,

    -- Profil
    pays_origine_id     INTEGER REFERENCES ref_pays(id),
    est_etrangere       BOOLEAN DEFAULT FALSE,
    capital_social      NUMERIC(18, 2),
    devise_capital_id   INTEGER REFERENCES ref_devises(id),
    chiffre_affaires    NUMERIC(18, 2),
    annee_ca            SMALLINT,
    nombre_employes     INTEGER,
    employes_nationaux  INTEGER,
    employes_etrangers  INTEGER,

    -- Contacts
    contact_nom         VARCHAR(255),
    contact_email       VARCHAR(255),
    contact_telephone   VARCHAR(50),
    site_web            TEXT,

    -- Statut
    statut_id           INTEGER REFERENCES ref_statuts(id),   -- Actif, Fermé, Suspendu
    statut_agrement     VARCHAR(100),                         -- Agréé APIX, Agréé CDE, etc.

    -- Traçabilité
    source_id           INTEGER REFERENCES ref_sources(id),
    note_interne        TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    is_deleted          BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_entreprises_secteur ON entreprises_installees(secteur_id);
CREATE INDEX idx_entreprises_pays ON entreprises_installees(pays_origine_id);
CREATE INDEX idx_entreprises_region ON entreprises_installees(region_id);
CREATE INDEX idx_entreprises_geo ON entreprises_installees USING GIST(localisation_geo);


-- =============================================================================
-- MODULE 5 — ZONES D'INVESTISSEMENT
-- =============================================================================

CREATE TABLE zones_investissement (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    nom                 VARCHAR(255) NOT NULL,
    sigle               VARCHAR(50),                    -- Ex : ZES, ZAI, ZAPE
    type_zone           VARCHAR(50) NOT NULL
        CHECK (type_zone IN ('ZES', 'ZAI', 'ZAPE', 'parc_industriel', 'pole_urbain', 'autre')),
    statut              VARCHAR(50)
        CHECK (statut IN ('operationnelle', 'en_cours', 'projetee', 'suspendue')),

    -- Localisation
    region              VARCHAR(100),
    departement         VARCHAR(100),
    adresse             TEXT,
    superficie_ha       NUMERIC(10, 2),
    geom                GEOMETRY(Polygon, 4326),        -- Périmètre de la zone

    -- Gestionnaire
    organisme_gestionnaire VARCHAR(255),
    contact_gestionnaire   VARCHAR(255),
    email_gestionnaire     VARCHAR(255),
    telephone_gestionnaire VARCHAR(50),

    -- Caractéristiques
    description         TEXT,
    avantages_fiscaux   TEXT,
    infrastructures     TEXT[],                         -- ['électricité', 'eau', 'fibre optique']
    secteurs_cibles     TEXT[],
    capacite_lots       INTEGER,
    lots_disponibles    INTEGER,
    prix_lot_min        NUMERIC(18, 2),
    prix_lot_max        NUMERIC(18, 2),
    devise_prix_id      INTEGER REFERENCES ref_devises(id),

    -- Cadre légal
    texte_creation      VARCHAR(255),                   -- Décret ou loi de création
    date_creation       DATE,

    -- Traçabilité
    source_id           INTEGER REFERENCES ref_sources(id),
    note_interne        TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    is_deleted          BOOLEAN DEFAULT FALSE
);

-- Lien entre entreprises installées et zones
ALTER TABLE entreprises_installees
    ADD CONSTRAINT fk_entreprise_zone
    FOREIGN KEY (zone_investissement_id) REFERENCES zones_investissement(id);

CREATE INDEX idx_zones_geo ON zones_investissement USING GIST(geom);
CREATE INDEX idx_zones_type ON zones_investissement(type_zone);
CREATE INDEX idx_zones_statut ON zones_investissement(statut);


-- =============================================================================
-- MODULE 6 — OPPORTUNITÉS D'INVESTISSEMENT
-- =============================================================================

CREATE TABLE opportunites_investissement (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    titre               VARCHAR(500) NOT NULL,
    reference           VARCHAR(50) UNIQUE,             -- Référence interne APIX
    description         TEXT NOT NULL,
    type_opportunite    VARCHAR(50)
        CHECK (type_opportunite IN ('projet_etat', 'ppp', 'greenfield', 'acquisition', 'partenariat', 'autre')),

    -- Localisation
    region              VARCHAR(100),
    zone_investissement_id UUID REFERENCES zones_investissement(id),
    localisation_geo    GEOMETRY(Point, 4326),

    -- Secteur et marché
    secteur_id          INTEGER REFERENCES ref_secteurs(id),
    branche_id          INTEGER REFERENCES ref_branches(id),
    marche_cible        TEXT,                           -- Description du marché potentiel
    avantages_comparatifs TEXT,

    -- Données financières
    investissement_requis NUMERIC(18, 2),
    devise_id           INTEGER REFERENCES ref_devises(id),
    rentabilite_estimee VARCHAR(100),                   -- Ex : "15-20% sur 5 ans"
    retour_investissement_annees SMALLINT,

    -- Impact
    emplois_directs_attendus    INTEGER,
    emplois_indirects_attendus  INTEGER,
    impact_social               TEXT,

    -- Statut
    statut              VARCHAR(50)
        CHECK (statut IN ('disponible', 'en_negociation', 'attribuee', 'realisee', 'annulee')),
    date_limite         DATE,                           -- Deadline si applicable
    niveau_maturite     VARCHAR(30)
        CHECK (niveau_maturite IN ('idee', 'prefaisabilite', 'faisabilite', 'pret')),

    -- Cadre légal et documentation
    cadre_juridique     TEXT,
    documents_disponibles TEXT[],                       -- Liste des docs téléchargeables

    -- Traçabilité
    source_id           INTEGER REFERENCES ref_sources(id),
    note_interne        TEXT,
    est_publie          BOOLEAN DEFAULT FALSE,          -- Visible sur le site public
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    is_deleted          BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_opportunites_secteur ON opportunites_investissement(secteur_id);
CREATE INDEX idx_opportunites_statut ON opportunites_investissement(statut);
CREATE INDEX idx_opportunites_geo ON opportunites_investissement USING GIST(localisation_geo);


-- =============================================================================
-- MODULE 7 — ACCORDS ET TRAITÉS
-- =============================================================================

CREATE TABLE accords_traites (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    titre               VARCHAR(500) NOT NULL,
    titre_court         VARCHAR(100),
    reference_officielle VARCHAR(100),

    -- Classification
    type_accord         VARCHAR(50) NOT NULL
        CHECK (type_accord IN ('TBI', 'APE', 'accord_commerce', 'accord_cooperation', 'accord_double_imposition', 'autre')),
    -- TBI = Traité Bilatéral d'Investissement
    -- APE = Accord de Partenariat Économique

    -- Parties
    pays_partenaire_id  INTEGER REFERENCES ref_pays(id),
    organisation_partenaire VARCHAR(255),               -- Si avec une organisation (ex : UE, CEDEAO)
    est_bilateral       BOOLEAN DEFAULT TRUE,
    est_multilateral    BOOLEAN DEFAULT FALSE,

    -- Dates clés
    date_signature      DATE,
    date_ratification   DATE,
    date_entree_vigueur DATE,
    date_expiration     DATE,

    -- Contenu
    description         TEXT,
    domaines_couverts   TEXT[],                         -- ['investissement', 'commerce', 'fiscal']
    avantages_principaux TEXT,
    dispositions_speciales TEXT,

    -- Statut
    statut              VARCHAR(30)
        CHECK (statut IN ('en_vigueur', 'signe_non_ratifie', 'expire', 'suspendu', 'negocie')),

    -- Accès et documentation
    lien_texte_officiel TEXT,                           -- URL Journal Officiel ou traité
    document_joint      TEXT,                           -- Chemin vers fichier stocké

    -- Traçabilité
    source_id           INTEGER REFERENCES ref_sources(id),
    note_interne        TEXT,
    est_publie          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    is_deleted          BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_accords_pays ON accords_traites(pays_partenaire_id);
CREATE INDEX idx_accords_type ON accords_traites(type_accord);
CREATE INDEX idx_accords_statut ON accords_traites(statut);


-- =============================================================================
-- MODULE 8 — ÉVÉNEMENTS
-- =============================================================================

CREATE TABLE evenements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    titre               VARCHAR(500) NOT NULL,
    edition             VARCHAR(50),                    -- Ex : "5ème édition"
    type_evenement      VARCHAR(50) NOT NULL
        CHECK (type_evenement IN ('forum', 'salon', 'conference', 'mission_prospection',
                                   'roadshow', 'b2b', 'webinaire', 'visite_terrain', 'autre')),
    organisateur        VARCHAR(255),
    co_organisateurs    TEXT[],
    role_apix           VARCHAR(100),                   -- Ex : 'co-organisateur', 'participant', 'sponsor'

    -- Dates et lieu
    date_debut          DATE NOT NULL,
    date_fin            DATE,
    pays_id             INTEGER REFERENCES ref_pays(id),
    ville               VARCHAR(100),
    lieu                VARCHAR(255),
    est_virtuel         BOOLEAN DEFAULT FALSE,
    lien_virtuel        TEXT,

    -- Contenu et cible
    description         TEXT,
    thematiques         TEXT[],
    secteurs_cibles     TEXT[],
    pays_cibles         INTEGER[],                      -- Array de pays_id
    public_cible        TEXT,

    -- Résultats et capitalisation
    nombre_participants INTEGER,
    nombre_prospects_rencontres INTEGER,
    nombre_contacts_generes INTEGER,
    intentions_generees INTEGER,
    montant_intentions_usd NUMERIC(18, 2),
    rapport_disponible  BOOLEAN DEFAULT FALSE,
    lien_rapport        TEXT,
    lecons_apprises     TEXT,

    -- Statut
    statut              VARCHAR(30)
        CHECK (statut IN ('planifie', 'en_cours', 'termine', 'annule', 'reporte')),

    -- Traçabilité
    source_id           INTEGER REFERENCES ref_sources(id),
    note_interne        TEXT,
    est_publie          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    created_by          VARCHAR(100),
    is_deleted          BOOLEAN DEFAULT FALSE
);

-- Participants à un événement (prospects ou contacts rencontrés)
CREATE TABLE evenements_participants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evenement_id    UUID NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
    prospect_id     UUID REFERENCES prospects(id),
    nom             VARCHAR(255) NOT NULL,
    entreprise      VARCHAR(255),
    pays_id         INTEGER REFERENCES ref_pays(id),
    email           VARCHAR(255),
    telephone       VARCHAR(50),
    poste           VARCHAR(100),
    interet_exprime TEXT,
    suivi_requis    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evenements_date ON evenements(date_debut);
CREATE INDEX idx_evenements_type ON evenements(type_evenement);
CREATE INDEX idx_evenements_statut ON evenements(statut);


-- =============================================================================
-- MODULE TRANSVERSE — GESTION DES UTILISATEURS ET ACCÈS
-- =============================================================================

CREATE TABLE utilisateurs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    nom             VARCHAR(100) NOT NULL,
    prenom          VARCHAR(100) NOT NULL,
    organisation    VARCHAR(255),
    pays_id         INTEGER REFERENCES ref_pays(id),
    telephone       VARCHAR(50),
    role            VARCHAR(30) NOT NULL
        CHECK (role IN ('admin', 'agent_apix', 'investisseur', 'public')),
    password_hash   TEXT,
    mfa_secret      TEXT,                               -- Pour TOTP si MFA activé
    est_actif       BOOLEAN DEFAULT TRUE,
    derniere_connexion TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Profil investisseur (extension de utilisateurs)
CREATE TABLE profils_investisseurs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id  UUID UNIQUE NOT NULL REFERENCES utilisateurs(id),
    entreprise_nom  VARCHAR(255),
    secteurs_interet TEXT[],
    pays_origine_id INTEGER REFERENCES ref_pays(id),
    budget_indicatif NUMERIC(18, 2),
    devise_budget_id INTEGER REFERENCES ref_devises(id),
    description_projet TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Journal d'audit (toutes les modifications importantes)
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    table_name  VARCHAR(100) NOT NULL,
    record_id   TEXT NOT NULL,
    action      VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data    JSONB,
    new_data    JSONB,
    changed_by  VARCHAR(100),
    changed_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_record ON audit_log(record_id);
CREATE INDEX idx_audit_date ON audit_log(changed_at);


-- =============================================================================
-- TRIGGERS — Mise à jour automatique de updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur toutes les tables principales
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'ide_flux', 'intentions_investissement', 'prospects',
        'entreprises_installees', 'zones_investissement',
        'opportunites_investissement', 'accords_traites', 'evenements',
        'utilisateurs', 'profils_investisseurs'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %s
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t
        );
    END LOOP;
END;
$$;


-- =============================================================================
-- DONNÉES DE RÉFÉRENCE INITIALES
-- =============================================================================

-- Sources de données
INSERT INTO ref_sources (code, nom, type, url) VALUES
    ('MANUEL',      'Saisie manuelle APIX',         'manuel',   NULL),
    ('FDI_MARKETS', 'FDI Markets (Financial Times)', 'scraping', 'https://www.fdimarkets.com'),
    ('CNUCED',      'CNUCED / UNCTAD',               'api',      'https://unctadstat.unctad.org'),
    ('WORLD_BANK',  'Banque Mondiale',                'api',      'https://data.worldbank.org'),
    ('IMPORT_EXCEL','Import fichier Excel/CSV',       'import',   NULL),
    ('DGPPE',       'DGPPE Sénégal',                  'api',      NULL),
    ('APIX_CRM',    'CRM interne APIX',               'api',      NULL);

-- Devises principales
INSERT INTO ref_devises (code_iso, nom, symbole) VALUES
    ('XOF', 'Franc CFA UEMOA',     'FCFA'),
    ('USD', 'Dollar américain',     '$'),
    ('EUR', 'Euro',                 '€'),
    ('GBP', 'Livre sterling',       '£'),
    ('CNY', 'Yuan chinois',         '¥'),
    ('CAD', 'Dollar canadien',      'CA$'),
    ('CHF', 'Franc suisse',         'CHF'),
    ('JPY', 'Yen japonais',         '¥');

-- Statuts — Module IDE
INSERT INTO ref_statuts (module, code, libelle_fr, couleur_hex) VALUES
    ('ide', 'verifie',      'Vérifié',          '#22C55E'),
    ('ide', 'a_verifier',   'À vérifier',       '#F59E0B'),
    ('ide', 'rejete',       'Rejeté',           '#EF4444');

-- Statuts — Module Intentions
INSERT INTO ref_statuts (module, code, libelle_fr, couleur_hex) VALUES
    ('intention', 'nouvelle',       'Nouvelle',             '#3B82F6'),
    ('intention', 'en_cours',       'En cours de suivi',    '#8B5CF6'),
    ('intention', 'avancee',        'Avancée',              '#F59E0B'),
    ('intention', 'conclue',        'Conclue / Réalisée',   '#22C55E'),
    ('intention', 'abandonnee',     'Abandonnée',           '#EF4444');

-- Statuts — Module Prospects
INSERT INTO ref_statuts (module, code, libelle_fr, couleur_hex) VALUES
    ('prospect', 'identifie',       'Identifié',            '#94A3B8'),
    ('prospect', 'contacte',        'Contacté',             '#3B82F6'),
    ('prospect', 'interesse',       'Intéressé',            '#F59E0B'),
    ('prospect', 'converti',        'Converti en intention','#22C55E'),
    ('prospect', 'inactif',         'Inactif',              '#EF4444');

-- Statuts — Module Entreprises
INSERT INTO ref_statuts (module, code, libelle_fr, couleur_hex) VALUES
    ('entreprise', 'active',        'Active',               '#22C55E'),
    ('entreprise', 'inactive',      'Inactive',             '#94A3B8'),
    ('entreprise', 'fermee',        'Fermée',               '#EF4444'),
    ('entreprise', 'suspendue',     'Suspendue',            '#F59E0B');

-- Secteurs d'activité principaux (alignés SN 2050)
INSERT INTO ref_secteurs (code, nom_fr, nom_en) VALUES
    ('AGRI',    'Agriculture et Agroalimentaire',    'Agriculture & Agrifood'),
    ('MINE',    'Industries extractives',             'Extractive Industries'),
    ('ENERG',   'Énergie et Mines',                  'Energy & Mining'),
    ('INFRA',   'Infrastructures et BTP',             'Infrastructure & Construction'),
    ('TIC',     'Technologies et Numérique',          'Technology & Digital'),
    ('TOUR',    'Tourisme et Hôtellerie',             'Tourism & Hospitality'),
    ('PECHE',   'Pêche et Économie bleue',            'Fisheries & Blue Economy'),
    ('SANTE',   'Santé et Pharmacie',                 'Health & Pharma'),
    ('EDUC',    'Éducation et Formation',             'Education & Training'),
    ('FINANCE', 'Services Financiers',                'Financial Services'),
    ('LOGIST',  'Logistique et Transport',            'Logistics & Transport'),
    ('IMMOB',   'Immobilier',                         'Real Estate'),
    ('INDUST',  'Industrie manufacturière',           'Manufacturing');

-- =============================================================================
-- FIN DU SCHÉMA
-- =============================================================================
