-- =============================================================================
-- Migration 116 — BASELINE du schéma (2026-07-16 18:24)
--
-- Instantané pg_dump --schema-only de la base réelle. Les migrations
-- historiques 001–115 sont archivées dans migrations/archive/ : une base
-- vierge joue CE fichier puis les migrations 117+. Les bases existantes
-- sont déjà à ce niveau — ne pas rejouer ce fichier dessus.
-- =============================================================================
--
-- PostgreSQL database dump
--

-- Dumped from database version 15.4 (Debian 15.4-1.pgdg110+1)
-- Dumped by pg_dump version 15.4 (Debian 15.4-1.pgdg110+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: assign_pole_from_region(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_pole_from_region() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.region_id IS NULL THEN
        NEW.pole_id := NULL;
    ELSE
        SELECT id INTO NEW.pole_id
        FROM   poles_territoires
        WHERE  NEW.region_id = ANY(region_ids)
        LIMIT  1;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: auto_reset_seq(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_reset_seq() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  seq_name TEXT;
  cnt      BIGINT;
BEGIN
  seq_name := pg_get_serial_sequence(TG_TABLE_NAME, 'id');
  IF seq_name IS NOT NULL THEN
    EXECUTE format('SELECT COUNT(*) FROM %I', TG_TABLE_NAME) INTO cnt;
    IF cnt = 0 THEN
      EXECUTE 'ALTER SEQUENCE ' || seq_name || ' RESTART WITH 1';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;


--
-- Name: fermer_phase_precedente(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fermer_phase_precedente() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE projet_phases
    SET date_fin = NEW.date_debut
    WHERE projet_id = NEW.projet_id
      AND date_fin IS NULL
      AND id != NEW.id;
    -- Calculer l'ordre auto
    SELECT COALESCE(MAX(ordre), 0) + 1 INTO NEW.ordre
    FROM projet_phases WHERE projet_id = NEW.projet_id AND id != NEW.id;
    RETURN NEW;
END;
$$;


--
-- Name: generate_zone_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_zone_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.id IS NULL OR NEW.id = '' THEN
        IF TG_TABLE_NAME = 'zones_zes' THEN
            NEW.id := 'ZES-' || NEW.num;
        ELSIF TG_TABLE_NAME = 'zones_zai' THEN
            NEW.id := 'ZAI-' || NEW.num;
        ELSIF TG_TABLE_NAME = 'zones_zfi' THEN
            NEW.id := 'ZFI-' || NEW.num;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_zone_id_dynamic(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_zone_id_dynamic() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    prefix     TEXT;
    table_name TEXT;
    next_num   INTEGER;
BEGIN
    table_name := TG_TABLE_NAME;

    IF table_name = 'zones_zes' THEN prefix := 'ZES';
    ELSIF table_name = 'zones_zai' THEN prefix := 'ZAI';
    ELSIF table_name = 'zones_zfi' THEN prefix := 'ZFI';
    END IF;

    -- Extraire le MAX du numéro depuis les IDs existants (ex: ZES-3 → 3)
    EXECUTE format(
        'SELECT COALESCE(MAX(CAST(SPLIT_PART(id, $1, 2) AS INTEGER)), 0) + 1 FROM %I',
        table_name
    ) USING '-' INTO next_num;

    NEW.id := prefix || '-' || next_num;
    RETURN NEW;
END;
$_$;


--
-- Name: reset_seq_if_empty(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_seq_if_empty() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE seq_name TEXT; tbl_name TEXT;
BEGIN
    tbl_name := TG_TABLE_NAME;
    seq_name := tbl_name || '_id_seq';
    EXECUTE format('SELECT setval(%L, 1, false) WHERE NOT EXISTS (SELECT 1 FROM %I)', seq_name, tbl_name);
    RETURN OLD;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: sync_entreprise_zone(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_entreprise_zone() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefix TEXT;
    new_prefix TEXT;
    old_zone   TEXT;
    new_zone   TEXT;
BEGIN
    old_zone := OLD.zone_investissement;
    new_zone := NEW.zone_investissement;

    -- Rien à faire si zone inchangée
    IF old_zone IS NOT DISTINCT FROM new_zone THEN
        RETURN NEW;
    END IF;

    -- Supprimer l'ancienne liaison si elle existait
    IF old_zone IS NOT NULL THEN
        old_prefix := SPLIT_PART(old_zone, '-', 1);
        IF old_prefix = 'ZES' THEN
            DELETE FROM zone_zes_entreprises WHERE entreprise_id = NEW.id AND zone_id = old_zone;
        ELSIF old_prefix = 'ZAI' THEN
            DELETE FROM zone_zai_entreprises WHERE entreprise_id = NEW.id AND zone_id = old_zone;
        ELSIF old_prefix = 'ZFI' THEN
            DELETE FROM zone_zfi_entreprises WHERE entreprise_id = NEW.id AND zone_id = old_zone;
        END IF;
    END IF;

    -- Créer la nouvelle liaison si une zone est définie
    IF new_zone IS NOT NULL THEN
        new_prefix := SPLIT_PART(new_zone, '-', 1);
        IF new_prefix = 'ZES' THEN
            INSERT INTO zone_zes_entreprises (zone_id, entreprise_id)
            VALUES (new_zone, NEW.id)
            ON CONFLICT (zone_id, entreprise_id) DO NOTHING;
        ELSIF new_prefix = 'ZAI' THEN
            INSERT INTO zone_zai_entreprises (zone_id, entreprise_id)
            VALUES (new_zone, NEW.id)
            ON CONFLICT (zone_id, entreprise_id) DO NOTHING;
        ELSIF new_prefix = 'ZFI' THEN
            INSERT INTO zone_zfi_entreprises (zone_id, entreprise_id)
            VALUES (new_zone, NEW.id)
            ON CONFLICT (zone_id, entreprise_id) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: sync_groupement_pays_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_groupement_pays_ids() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    gid integer;
BEGIN
    gid := CASE WHEN TG_OP = 'DELETE' THEN OLD.groupement_id ELSE NEW.groupement_id END;

    UPDATE ref_groupements
    SET pays_ids = (
        SELECT COALESCE(array_agg(pays_id ORDER BY pays_id), '{}')
        FROM ref_pays_groupements
        WHERE groupement_id = gid
    )
    WHERE id = gid;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;


--
-- Name: sync_icm_on_groupement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_icm_on_groupement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_categorie VARCHAR(100);
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM ide_cnuced_monde WHERE code = OLD.code;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        DELETE FROM ide_cnuced_monde WHERE code = OLD.code;
    END IF;

    IF array_length(NEW.pays_ids, 1) > 0 THEN
        -- Déterminer la catégorie via nom_fr ↔ ref_pays
        IF NEW.nom_fr IN (SELECT DISTINCT continent FROM ref_pays WHERE continent IS NOT NULL) THEN
            v_categorie := 'continent';
        ELSIF NEW.nom_fr IN (SELECT DISTINCT niveau_revenu FROM ref_pays WHERE niveau_revenu IS NOT NULL) THEN
            v_categorie := 'revenu';
        ELSIF NEW.nom_fr IN (SELECT DISTINCT region_geo FROM ref_pays WHERE region_geo IS NOT NULL) THEN
            SELECT DISTINCT p.continent INTO v_categorie
            FROM ref_pays p
            WHERE p.region_geo = NEW.nom_fr AND p.continent IS NOT NULL
            LIMIT 1;
        ELSE
            v_categorie := 'groupe';
        END IF;

        INSERT INTO ide_cnuced_monde
            (code, nom_fr, categorie, annee, indicateur, direction,
             moyenne, somme, min, max, variance, ecart_type)
        SELECT
            NEW.code, NEW.nom_fr, v_categorie,
            c.annee, c.indicateur, c.direction,
            AVG(c.valeur), SUM(c.valeur), MIN(c.valeur), MAX(c.valeur),
            VAR_POP(c.valeur), STDDEV_POP(c.valeur)
        FROM ide_cnuced c
        WHERE c.ref_pays_id = ANY(NEW.pays_ids)
          AND c.valeur IS NOT NULL
        GROUP BY c.annee, c.indicateur, c.direction
        ORDER BY c.annee, c.indicateur, c.direction;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: sync_on_pays_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_on_pays_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

    -- ── INSERT : rattacher le nouveau pays à ses groupements géo/économiques ──
    IF TG_OP = 'INSERT' THEN
        INSERT INTO ref_pays_groupements (pays_id, groupement_id)
        SELECT NEW.id, g.id
        FROM ref_groupements g
        WHERE g.nom_fr IN (NEW.continent, NEW.region_geo, NEW.niveau_revenu)
          AND g.nom_fr IS NOT NULL
        ON CONFLICT DO NOTHING;

        RETURN NEW;
    END IF;

    -- ── UPDATE ────────────────────────────────────────────────────────────────
    IF TG_OP = 'UPDATE' THEN

        -- nom_fr modifié → mettre à jour ide_cnuced.pays
        IF OLD.nom_fr IS DISTINCT FROM NEW.nom_fr THEN
            UPDATE ide_cnuced SET pays = NEW.nom_fr WHERE ref_pays_id = NEW.id;
        END IF;

        -- continent modifié → changer de groupement continental
        IF OLD.continent IS DISTINCT FROM NEW.continent THEN
            DELETE FROM ref_pays_groupements rpg
            USING ref_groupements g
            WHERE rpg.pays_id = NEW.id
              AND rpg.groupement_id = g.id
              AND g.nom_fr = OLD.continent;

            INSERT INTO ref_pays_groupements (pays_id, groupement_id)
            SELECT NEW.id, g.id FROM ref_groupements g
            WHERE g.nom_fr = NEW.continent AND NEW.continent IS NOT NULL
            ON CONFLICT DO NOTHING;
        END IF;

        -- region_geo modifiée → changer de groupement régional
        IF OLD.region_geo IS DISTINCT FROM NEW.region_geo THEN
            DELETE FROM ref_pays_groupements rpg
            USING ref_groupements g
            WHERE rpg.pays_id = NEW.id
              AND rpg.groupement_id = g.id
              AND g.nom_fr = OLD.region_geo;

            INSERT INTO ref_pays_groupements (pays_id, groupement_id)
            SELECT NEW.id, g.id FROM ref_groupements g
            WHERE g.nom_fr = NEW.region_geo AND NEW.region_geo IS NOT NULL
            ON CONFLICT DO NOTHING;
        END IF;

        -- niveau_revenu modifié → changer de groupement économique
        IF OLD.niveau_revenu IS DISTINCT FROM NEW.niveau_revenu THEN
            DELETE FROM ref_pays_groupements rpg
            USING ref_groupements g
            WHERE rpg.pays_id = NEW.id
              AND rpg.groupement_id = g.id
              AND g.nom_fr = OLD.niveau_revenu;

            INSERT INTO ref_pays_groupements (pays_id, groupement_id)
            SELECT NEW.id, g.id FROM ref_groupements g
            WHERE g.nom_fr = NEW.niveau_revenu AND NEW.niveau_revenu IS NOT NULL
            ON CONFLICT DO NOTHING;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: update_projets_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_projets_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accord_fichiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accord_fichiers (
    titre character varying(255) NOT NULL,
    nom_fichier character varying(255) NOT NULL,
    chemin text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    id integer NOT NULL,
    accord_id integer NOT NULL
);


--
-- Name: accord_fichiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accord_fichiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accord_fichiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accord_fichiers_id_seq OWNED BY public.accord_fichiers.id;


--
-- Name: accords_traites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accords_traites (
    titre character varying(500) NOT NULL,
    parties_signataires text,
    date_signature date,
    date_entree_vigueur date,
    date_expiration date,
    commentaires text,
    statut character varying(50) DEFAULT 'en_vigueur'::character varying,
    fichier_nom character varying(255),
    fichier_path text,
    est_publie boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(100),
    is_deleted boolean DEFAULT false,
    reference character varying(200),
    secteur_ids integer[] DEFAULT '{}'::integer[],
    branche_ids integer[] DEFAULT '{}'::integer[],
    activite_ids integer[] DEFAULT '{}'::integer[],
    id integer NOT NULL,
    parties_pays_ids integer[] DEFAULT '{}'::integer[],
    type_accord character varying(30) DEFAULT 'tbi'::character varying NOT NULL,
    CONSTRAINT accords_traites_statut_check CHECK (((statut)::text = ANY ((ARRAY['en_vigueur'::character varying, 'signe_non_ratifie'::character varying, 'expire'::character varying, 'suspendu'::character varying, 'negocie'::character varying])::text[])))
);


--
-- Name: accords_traites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accords_traites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accords_traites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accords_traites_id_seq OWNED BY public.accords_traites.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    table_name character varying(100) NOT NULL,
    record_id text NOT NULL,
    action character varying(10) NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by character varying(100),
    changed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_log_action_check CHECK (((action)::text = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::text[])))
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: auth_throttle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_throttle (
    cle text NOT NULL,
    echecs integer DEFAULT 0 NOT NULL,
    dernier_echec timestamp with time zone,
    verrouille_jusqua timestamp with time zone
);


--
-- Name: avantages_incitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avantages_incitations (
    id integer NOT NULL,
    secteur_id integer,
    branche_id integer,
    activite_id integer NOT NULL,
    avantages text NOT NULL,
    est_publie boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: avantages_incitations_fichiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avantages_incitations_fichiers (
    id integer NOT NULL,
    avantage_id integer NOT NULL,
    fichier_nom character varying(500) NOT NULL,
    titre character varying(500),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: avantages_incitations_fichiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.avantages_incitations_fichiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: avantages_incitations_fichiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.avantages_incitations_fichiers_id_seq OWNED BY public.avantages_incitations_fichiers.id;


--
-- Name: avantages_incitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.avantages_incitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: avantages_incitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.avantages_incitations_id_seq OWNED BY public.avantages_incitations.id;


--
-- Name: avantages_incitations_selections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avantages_incitations_selections (
    id integer NOT NULL,
    avantage_id integer NOT NULL,
    type_id integer NOT NULL,
    commentaire text
);


--
-- Name: avantages_incitations_selections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.avantages_incitations_selections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: avantages_incitations_selections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.avantages_incitations_selections_id_seq OWNED BY public.avantages_incitations_selections.id;


--
-- Name: bdef_groupes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bdef_groupes (
    id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle character varying(200) NOT NULL,
    macro_secteur_id integer NOT NULL,
    ordre smallint,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bdef_groupes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bdef_groupes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bdef_groupes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bdef_groupes_id_seq OWNED BY public.bdef_groupes.id;


--
-- Name: bdef_import_revue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bdef_import_revue (
    id integer NOT NULL,
    import_id integer NOT NULL,
    niveau character varying(15) NOT NULL,
    code_bdef character varying(10),
    libelle_brut text NOT NULL,
    score_fuzzy numeric(5,2),
    candidats jsonb,
    cible_id_valide integer,
    statut character varying(20) DEFAULT 'en_attente'::character varying NOT NULL,
    valide_le timestamp with time zone,
    valide_par text,
    cree_le timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bdef_import_revue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bdef_import_revue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bdef_import_revue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bdef_import_revue_id_seq OWNED BY public.bdef_import_revue.id;


--
-- Name: bdef_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bdef_imports (
    id integer NOT NULL,
    fichier text NOT NULL,
    statut character varying(20) DEFAULT 'en_cours'::character varying NOT NULL,
    annees jsonb,
    nb_valeurs integer DEFAULT 0 NOT NULL,
    nb_revue integer DEFAULT 0 NOT NULL,
    cree_par text,
    cree_le timestamp with time zone DEFAULT now() NOT NULL,
    termine_le timestamp with time zone
);


--
-- Name: bdef_imports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bdef_imports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bdef_imports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bdef_imports_id_seq OWNED BY public.bdef_imports.id;


--
-- Name: bdef_indicateur_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bdef_indicateur_categories (
    id integer NOT NULL,
    code character varying(40) NOT NULL,
    libelle character varying(100) NOT NULL,
    ordre smallint
);


--
-- Name: bdef_indicateur_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bdef_indicateur_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bdef_indicateur_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bdef_indicateur_categories_id_seq OWNED BY public.bdef_indicateur_categories.id;


--
-- Name: bdef_indicateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bdef_indicateurs (
    id integer NOT NULL,
    code character varying(60),
    libelle character varying(300) NOT NULL,
    unite character varying(20) NOT NULL,
    categorie_id integer NOT NULL,
    ordre smallint,
    created_at timestamp with time zone DEFAULT now(),
    mode character varying(20) DEFAULT 'lu'::character varying,
    source_tableau character varying(150),
    source_ref character varying(200),
    formule text,
    formule_vars jsonb,
    extraction_key character varying(200)
);


--
-- Name: bdef_indicateurs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bdef_indicateurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bdef_indicateurs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bdef_indicateurs_id_seq OWNED BY public.bdef_indicateurs.id;


--
-- Name: bdef_macro_secteurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bdef_macro_secteurs (
    id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle character varying(200) NOT NULL,
    ordre smallint,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bdef_macro_secteurs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bdef_macro_secteurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bdef_macro_secteurs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bdef_macro_secteurs_id_seq OWNED BY public.bdef_macro_secteurs.id;


--
-- Name: bdef_secteur_alias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bdef_secteur_alias (
    id integer NOT NULL,
    niveau character varying(15) NOT NULL,
    libelle_brut text NOT NULL,
    cible_id integer NOT NULL,
    cree_le timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bdef_secteur_alias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bdef_secteur_alias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bdef_secteur_alias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bdef_secteur_alias_id_seq OWNED BY public.bdef_secteur_alias.id;


--
-- Name: bdef_secteurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bdef_secteurs (
    id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle character varying(500) NOT NULL,
    groupe_id integer NOT NULL,
    ordre smallint,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bdef_secteurs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bdef_secteurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bdef_secteurs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bdef_secteurs_id_seq OWNED BY public.bdef_secteurs.id;


--
-- Name: bdef_valeurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bdef_valeurs (
    id integer NOT NULL,
    indicateur_id integer NOT NULL,
    niveau character varying(15) NOT NULL,
    macro_secteur_id integer,
    groupe_id integer,
    secteur_id integer,
    annee smallint NOT NULL,
    valeur numeric(20,4),
    created_at timestamp with time zone DEFAULT now(),
    valeur_initiale numeric(20,4),
    CONSTRAINT bdef_valeurs_niveau_chk CHECK (((((niveau)::text = 'global'::text) AND (macro_secteur_id IS NULL) AND (groupe_id IS NULL) AND (secteur_id IS NULL)) OR (((niveau)::text = 'macro_secteur'::text) AND (macro_secteur_id IS NOT NULL) AND (groupe_id IS NULL) AND (secteur_id IS NULL)) OR (((niveau)::text = 'groupe'::text) AND (macro_secteur_id IS NULL) AND (groupe_id IS NOT NULL) AND (secteur_id IS NULL)) OR (((niveau)::text = 'secteur'::text) AND (macro_secteur_id IS NULL) AND (groupe_id IS NULL) AND (secteur_id IS NOT NULL))))
);


--
-- Name: bdef_valeurs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bdef_valeurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bdef_valeurs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bdef_valeurs_id_seq OWNED BY public.bdef_valeurs.id;


--
-- Name: bdef_valeurs_rejetees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bdef_valeurs_rejetees (
    id integer NOT NULL,
    import_id integer,
    indicateur_id integer NOT NULL,
    indicateur_code character varying(60),
    niveau character varying(20) NOT NULL,
    macro_secteur_id integer,
    groupe_id integer,
    secteur_id integer,
    libelle_cible character varying(500),
    annee smallint NOT NULL,
    valeur_source numeric(20,4) NOT NULL,
    raison character varying(200),
    statut character varying(20) DEFAULT 'en_attente'::character varying NOT NULL,
    cree_le timestamp with time zone DEFAULT now()
);


--
-- Name: bdef_valeurs_rejetees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bdef_valeurs_rejetees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bdef_valeurs_rejetees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bdef_valeurs_rejetees_id_seq OWNED BY public.bdef_valeurs_rejetees.id;


--
-- Name: citi_classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citi_classes (
    id integer NOT NULL,
    groupe_id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle text NOT NULL
);


--
-- Name: citi_classes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.citi_classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: citi_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.citi_classes_id_seq OWNED BY public.citi_classes.id;


--
-- Name: citi_divisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citi_divisions (
    id integer NOT NULL,
    section_id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle text NOT NULL
);


--
-- Name: citi_divisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.citi_divisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: citi_divisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.citi_divisions_id_seq OWNED BY public.citi_divisions.id;


--
-- Name: citi_groupes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citi_groupes (
    id integer NOT NULL,
    division_id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle text NOT NULL
);


--
-- Name: citi_groupes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.citi_groupes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: citi_groupes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.citi_groupes_id_seq OWNED BY public.citi_groupes.id;


--
-- Name: citi_naema_correspondances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citi_naema_correspondances (
    id integer NOT NULL,
    citi_classe_id integer NOT NULL,
    naema_activite_id integer NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: citi_naema_correspondances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.citi_naema_correspondances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: citi_naema_correspondances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.citi_naema_correspondances_id_seq OWNED BY public.citi_naema_correspondances.id;


--
-- Name: citi_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citi_sections (
    id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle text NOT NULL,
    ordre integer DEFAULT 0
);


--
-- Name: citi_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.citi_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: citi_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.citi_sections_id_seq OWNED BY public.citi_sections.id;


--
-- Name: code_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.code_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chapitre_id uuid NOT NULL,
    section_id uuid,
    numero integer NOT NULL,
    titre character varying(500),
    contenu text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: code_chapitres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.code_chapitres (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero integer NOT NULL,
    titre character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contenu text
);


--
-- Name: code_investissement_pdf; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.code_investissement_pdf (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre character varying(500) DEFAULT 'Code des investissements du Sénégal'::character varying NOT NULL,
    fichier_nom character varying(500),
    fichier_path text,
    version character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: code_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.code_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chapitre_id uuid NOT NULL,
    numero integer NOT NULL,
    titre character varying(500) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contenu text
);


--
-- Name: entreprises_hors_senegal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entreprises_hors_senegal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(255) NOT NULL,
    forme_juridique character varying(100),
    date_creation date,
    statut character varying(20) DEFAULT 'actif'::character varying,
    siege_pays_id integer,
    adresse text,
    telephone character varying(50),
    mail character varying(255),
    siteweb text,
    secteur_id integer,
    branche_id integer,
    activite_id integer,
    est_publie boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(100),
    is_deleted boolean DEFAULT false
);


--
-- Name: entreprises_installees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entreprises_installees (
    nom character varying(255) NOT NULL,
    forme_juridique character varying(100),
    date_creation date,
    pays character varying(100) DEFAULT 'Sénégal'::character varying,
    adresse text,
    telephone character varying(50),
    mail character varying(255),
    siteweb text,
    est_publie boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(100),
    is_deleted boolean DEFAULT false,
    region_id integer,
    departement_id integer,
    arrondissement_id integer,
    siege_pays_id integer,
    secteur_ids integer[] DEFAULT '{}'::integer[],
    branche_ids integer[] DEFAULT '{}'::integer[],
    activite_ids integer[] DEFAULT '{}'::integer[],
    id integer NOT NULL,
    pole_id integer
);


--
-- Name: entreprises_installees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entreprises_installees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entreprises_installees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entreprises_installees_id_seq OWNED BY public.entreprises_installees.id;


--
-- Name: entreprises_points_focaux; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entreprises_points_focaux (
    nom character varying(255) NOT NULL,
    prenom character varying(255),
    poste character varying(150),
    telephone character varying(50),
    mail character varying(255),
    est_principal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    civilite character varying(20) DEFAULT 'Monsieur'::character varying,
    id integer NOT NULL,
    entreprise_id integer DEFAULT 0 NOT NULL
);


--
-- Name: entreprises_points_focaux_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entreprises_points_focaux_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entreprises_points_focaux_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entreprises_points_focaux_id_seq OWNED BY public.entreprises_points_focaux.id;


--
-- Name: evenement_fichiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evenement_fichiers (
    id integer NOT NULL,
    evenement_id integer NOT NULL,
    nom character varying(500),
    url text,
    type_fichier character varying(10) DEFAULT 'PDF'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: evenement_fichiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evenement_fichiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evenement_fichiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evenement_fichiers_id_seq OWNED BY public.evenement_fichiers.id;


--
-- Name: evenements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evenements (
    nom_event character varying(500) NOT NULL,
    edition integer,
    organisateur character varying(255),
    role_apix character varying(50),
    description text,
    date_debut date,
    date_fin date,
    ville character varying(100),
    entreprises_invitees text,
    est_publie boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    pays_hote_id integer,
    est_recurrent boolean DEFAULT false,
    frequence_type character varying(20),
    frequence_valeur integer,
    secteur_ids integer[] DEFAULT '{}'::integer[],
    branche_ids integer[] DEFAULT '{}'::integer[],
    activite_ids integer[] DEFAULT '{}'::integer[],
    pays_invites_ids integer[] DEFAULT '{}'::integer[],
    prochain_jour smallint,
    prochain_mois smallint,
    prochain_annee smallint,
    duree_jours smallint,
    id integer NOT NULL,
    CONSTRAINT chk_evenements_edition_positive CHECK (((edition IS NULL) OR (edition > 0))),
    CONSTRAINT chk_frequence_valeur CHECK (((frequence_valeur IS NULL) OR (frequence_valeur > 0))),
    CONSTRAINT chk_prochain_jour CHECK (((prochain_jour IS NULL) OR ((prochain_jour >= 1) AND (prochain_jour <= 31)))),
    CONSTRAINT chk_prochain_mois CHECK (((prochain_mois IS NULL) OR ((prochain_mois >= 1) AND (prochain_mois <= 12)))),
    CONSTRAINT evenements_duree_jours_check CHECK ((duree_jours > 0)),
    CONSTRAINT evenements_role_apix_check CHECK (((role_apix)::text = ANY ((ARRAY['Organisateur'::character varying, 'Co-organisateur'::character varying, 'Participant'::character varying, 'Partenaire'::character varying, 'Sponsor'::character varying, 'Invité'::character varying])::text[])))
);


--
-- Name: evenements_new_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evenements_new_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evenements_new_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evenements_new_id_seq OWNED BY public.evenements.id;


--
-- Name: ide_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ide_analyses (
    id integer NOT NULL,
    source character varying(20) DEFAULT 'cnuced'::character varying NOT NULL,
    titre character varying(300) NOT NULL,
    commentaire text NOT NULL,
    direction character varying(10),
    indicateur character varying(30),
    annee_debut smallint,
    annee_fin smallint,
    est_publie boolean DEFAULT false,
    ordre integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ide_analyses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ide_analyses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ide_analyses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ide_analyses_id_seq OWNED BY public.ide_analyses.id;


--
-- Name: ide_cnuced; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ide_cnuced (
    id integer NOT NULL,
    pays character varying(100) NOT NULL,
    annee smallint NOT NULL,
    direction character varying(10) NOT NULL,
    indicateur character varying(30) NOT NULL,
    valeur numeric(14,2),
    source character varying(50) DEFAULT 'CNUCED'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    ref_pays_id integer
);


--
-- Name: ide_cnuced_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ide_cnuced_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ide_cnuced_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ide_cnuced_id_seq OWNED BY public.ide_cnuced.id;


--
-- Name: ide_cnuced_monde; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ide_cnuced_monde (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    nom_fr character varying(200) NOT NULL,
    annee smallint NOT NULL,
    indicateur character varying(30) NOT NULL,
    direction character varying(10) NOT NULL,
    moyenne numeric(16,4),
    min numeric(16,4),
    max numeric(16,4),
    variance numeric(22,4),
    ecart_type numeric(16,4),
    somme numeric(20,4),
    categorie character varying(100)
);


--
-- Name: ide_cnuced_monde_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ide_cnuced_monde_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ide_cnuced_monde_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ide_cnuced_monde_id_seq OWNED BY public.ide_cnuced_monde.id;


--
-- Name: ide_cnuced_secteurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ide_cnuced_secteurs (
    id integer NOT NULL,
    secteur_id integer NOT NULL,
    annee smallint NOT NULL,
    direction character varying(10) NOT NULL,
    indicateur character varying(30) NOT NULL,
    valeur numeric(16,2),
    source character varying(20) DEFAULT 'CNUCED'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ide_cnuced_secteurs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ide_cnuced_secteurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ide_cnuced_secteurs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ide_cnuced_secteurs_id_seq OWNED BY public.ide_cnuced_secteurs.id;


--
-- Name: ide_flux; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ide_flux (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pays_origine_id integer NOT NULL,
    pays_destination_id integer NOT NULL,
    secteur_id integer,
    branche_id integer,
    montant numeric(18,2) NOT NULL,
    devise_id integer NOT NULL,
    montant_usd numeric(18,2),
    annee smallint NOT NULL,
    trimestre smallint,
    type_flux character varying(20) NOT NULL,
    nature_investissement character varying(50),
    emplois_crees integer,
    emplois_indirects integer,
    nom_entreprise character varying(255),
    entreprise_id uuid,
    source_id integer,
    source_reference character varying(255),
    statut_id integer,
    est_verifie boolean DEFAULT false,
    note_interne text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(100),
    is_deleted boolean DEFAULT false,
    CONSTRAINT ide_flux_trimestre_check CHECK (((trimestre >= 1) AND (trimestre <= 4))),
    CONSTRAINT ide_flux_type_flux_check CHECK (((type_flux)::text = ANY ((ARRAY['entrant'::character varying, 'sortant'::character varying])::text[])))
);


--
-- Name: ide_kpis_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ide_kpis_config (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    label character varying(200) NOT NULL,
    description text,
    est_actif boolean DEFAULT false,
    ordre smallint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ide_kpis_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ide_kpis_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ide_kpis_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ide_kpis_config_id_seq OWNED BY public.ide_kpis_config.id;


--
-- Name: ide_pays_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ide_pays_config (
    id integer NOT NULL,
    code_iso3 character varying(3) NOT NULL,
    code_iso2 character varying(2) NOT NULL,
    nom_fr character varying(100) NOT NULL,
    nom_cnuced character varying(100) NOT NULL,
    zone character varying(50),
    est_actif boolean DEFAULT true,
    date_ajout timestamp with time zone DEFAULT now()
);


--
-- Name: ide_pays_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ide_pays_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ide_pays_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ide_pays_config_id_seq OWNED BY public.ide_pays_config.id;


--
-- Name: ide_secteurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ide_secteurs (
    id integer NOT NULL,
    nom_en text NOT NULL,
    nom_fr text NOT NULL,
    parent_id integer,
    ordre integer DEFAULT 0 NOT NULL
);


--
-- Name: intentions_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intentions_interactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    intention_id uuid NOT NULL,
    date_interaction date NOT NULL,
    type_interaction character varying(50),
    description text NOT NULL,
    agent_apix character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT intentions_interactions_type_interaction_check CHECK (((type_interaction)::text = ANY ((ARRAY['email'::character varying, 'appel'::character varying, 'reunion'::character varying, 'visite'::character varying, 'evenement'::character varying, 'autre'::character varying])::text[])))
);


--
-- Name: intentions_investissement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intentions_investissement (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    investisseur_nom character varying(255) NOT NULL,
    investisseur_pays_id integer,
    investisseur_type character varying(50),
    prospect_id uuid,
    titre_projet character varying(500) NOT NULL,
    description text,
    secteur_id integer,
    branche_id integer,
    zone_investissement character varying(100),
    localisation_geo public.geometry(Point,4326),
    montant_projete numeric(18,2),
    devise_id integer,
    montant_projete_usd numeric(18,2),
    horizon_court date,
    horizon_moyen date,
    horizon_long date,
    emplois_prevus integer,
    description_impact text,
    statut_id integer,
    agent_apix character varying(100),
    date_premier_contact date,
    date_derniere_interaction date,
    prochaine_etape text,
    probabilite_realisation smallint,
    contact_nom character varying(255),
    contact_email character varying(255),
    contact_telephone character varying(50),
    contact_poste character varying(100),
    source_id integer,
    note_interne text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(100),
    is_deleted boolean DEFAULT false,
    CONSTRAINT intentions_investissement_investisseur_type_check CHECK (((investisseur_type)::text = ANY ((ARRAY['entreprise'::character varying, 'fonds'::character varying, 'institutionnel'::character varying, 'individuel'::character varying, 'autre'::character varying])::text[]))),
    CONSTRAINT intentions_investissement_probabilite_realisation_check CHECK (((probabilite_realisation >= 0) AND (probabilite_realisation <= 100)))
);


--
-- Name: modalites_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modalites_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chapitre_id uuid NOT NULL,
    section_id uuid,
    numero integer NOT NULL,
    titre character varying(500),
    contenu text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: modalites_chapitres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modalites_chapitres (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero integer NOT NULL,
    titre character varying(500) NOT NULL,
    contenu text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: modalites_pdf; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modalites_pdf (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre character varying(500) DEFAULT 'Modalités d''application du code des investissements'::character varying,
    fichier_nom character varying(500),
    fichier_path text,
    version character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: modalites_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modalites_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chapitre_id uuid NOT NULL,
    numero integer NOT NULL,
    titre character varying(500) NOT NULL,
    contenu text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nace_classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nace_classes (
    id integer NOT NULL,
    groupe_id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle text NOT NULL
);


--
-- Name: nace_classes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nace_classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nace_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nace_classes_id_seq OWNED BY public.nace_classes.id;


--
-- Name: nace_divisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nace_divisions (
    id integer NOT NULL,
    section_id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle text NOT NULL
);


--
-- Name: nace_divisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nace_divisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nace_divisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nace_divisions_id_seq OWNED BY public.nace_divisions.id;


--
-- Name: nace_groupes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nace_groupes (
    id integer NOT NULL,
    division_id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle text NOT NULL
);


--
-- Name: nace_groupes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nace_groupes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nace_groupes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nace_groupes_id_seq OWNED BY public.nace_groupes.id;


--
-- Name: nace_naema_correspondances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nace_naema_correspondances (
    id integer NOT NULL,
    nace_classe_id integer NOT NULL,
    naema_activite_id integer NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: nace_naema_correspondances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nace_naema_correspondances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nace_naema_correspondances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nace_naema_correspondances_id_seq OWNED BY public.nace_naema_correspondances.id;


--
-- Name: nace_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nace_sections (
    id integer NOT NULL,
    code character varying(10) NOT NULL,
    libelle text NOT NULL,
    ordre integer DEFAULT 0
);


--
-- Name: nace_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nace_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nace_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nace_sections_id_seq OWNED BY public.nace_sections.id;


--
-- Name: opportunites_investissement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunites_investissement (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    titre character varying(500) NOT NULL,
    reference character varying(50),
    description text NOT NULL,
    type_opportunite character varying(50),
    region character varying(100),
    zone_investissement_id uuid,
    localisation_geo public.geometry(Point,4326),
    secteur_id integer,
    branche_id integer,
    marche_cible text,
    avantages_comparatifs text,
    investissement_requis numeric(18,2),
    devise_id integer,
    rentabilite_estimee character varying(100),
    retour_investissement_annees smallint,
    emplois_directs_attendus integer,
    emplois_indirects_attendus integer,
    impact_social text,
    statut character varying(50),
    date_limite date,
    niveau_maturite character varying(30),
    cadre_juridique text,
    documents_disponibles text[],
    source_id integer,
    note_interne text,
    est_publie boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(100),
    is_deleted boolean DEFAULT false,
    CONSTRAINT opportunites_investissement_niveau_maturite_check CHECK (((niveau_maturite)::text = ANY ((ARRAY['idee'::character varying, 'prefaisabilite'::character varying, 'faisabilite'::character varying, 'pret'::character varying])::text[]))),
    CONSTRAINT opportunites_investissement_statut_check CHECK (((statut)::text = ANY ((ARRAY['disponible'::character varying, 'en_negociation'::character varying, 'attribuee'::character varying, 'realisee'::character varying, 'annulee'::character varying])::text[]))),
    CONSTRAINT opportunites_investissement_type_opportunite_check CHECK (((type_opportunite)::text = ANY ((ARRAY['projet_etat'::character varying, 'ppp'::character varying, 'greenfield'::character varying, 'acquisition'::character varying, 'partenariat'::character varying, 'autre'::character varying])::text[])))
);


--
-- Name: pole_fichiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pole_fichiers (
    id integer NOT NULL,
    pole_id integer NOT NULL,
    nom character varying(500),
    url text,
    type_fichier character varying(10) DEFAULT 'PDF'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pole_fichiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pole_fichiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pole_fichiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pole_fichiers_id_seq OWNED BY public.pole_fichiers.id;


--
-- Name: poles_territoires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poles_territoires (
    id integer NOT NULL,
    pole_territoire character varying(200) NOT NULL,
    region_ids integer[] DEFAULT '{}'::integer[] NOT NULL,
    localisation character varying(500),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    entreprise_ids integer[] DEFAULT '{}'::integer[]
);


--
-- Name: poles_territoires_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.poles_territoires_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: poles_territoires_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.poles_territoires_id_seq OWNED BY public.poles_territoires.id;


--
-- Name: porteurs_projets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.porteurs_projets_id_seq
    START WITH 2
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: porteurs_projets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.porteurs_projets (
    nom character varying(500),
    ordre integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    id integer DEFAULT nextval('public.porteurs_projets_id_seq'::regclass) NOT NULL,
    projet_id integer,
    telephones text[] DEFAULT '{}'::text[],
    mails text[] DEFAULT '{}'::text[]
);


--
-- Name: potentialites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.potentialites (
    id integer NOT NULL,
    titre character varying(500) NOT NULL,
    pole_id integer,
    region_id integer,
    departement_id integer,
    arrondissement_id integer,
    secteur_ids integer[] DEFAULT '{}'::integer[],
    branche_ids integer[] DEFAULT '{}'::integer[],
    activite_ids integer[] DEFAULT '{}'::integer[],
    est_publie boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text
);


--
-- Name: potentialites_fichiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.potentialites_fichiers (
    id integer NOT NULL,
    potentialite_id integer NOT NULL,
    fichier_nom character varying(500) NOT NULL,
    titre character varying(500),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: potentialites_fichiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.potentialites_fichiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: potentialites_fichiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.potentialites_fichiers_id_seq OWNED BY public.potentialites_fichiers.id;


--
-- Name: potentialites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.potentialites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: potentialites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.potentialites_id_seq OWNED BY public.potentialites.id;


--
-- Name: profils_investisseurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profils_investisseurs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    utilisateur_id uuid NOT NULL,
    entreprise_nom character varying(255),
    secteurs_interet text[],
    pays_origine_id integer,
    budget_indicatif numeric(18,2),
    devise_budget_id integer,
    description_projet text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: projet_fichiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projet_fichiers (
    titre character varying(500),
    fichier_nom character varying(500),
    fichier_path text,
    created_at timestamp with time zone DEFAULT now(),
    id integer NOT NULL,
    projet_id integer
);


--
-- Name: projet_fichiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projet_fichiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projet_fichiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projet_fichiers_id_seq OWNED BY public.projet_fichiers.id;


--
-- Name: projet_moa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projet_moa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projet_moa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projet_moa_id_seq OWNED BY public.porteurs_projets.id;


--
-- Name: projet_phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projet_phases (
    id integer NOT NULL,
    projet_id integer NOT NULL,
    ordre integer DEFAULT 0 NOT NULL,
    titre character varying(300) NOT NULL,
    date_debut date NOT NULL,
    date_fin date,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: projet_phases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projet_phases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projet_phases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projet_phases_id_seq OWNED BY public.projet_phases.id;


--
-- Name: projets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projets (
    titre_projet character varying(500) NOT NULL,
    region_id integer,
    departement_id integer,
    arrondissement_id integer,
    zone_investissement character varying(20),
    pole_id integer,
    secteur_ids integer[] DEFAULT '{}'::integer[],
    branche_ids integer[] DEFAULT '{}'::integer[],
    activite_ids integer[] DEFAULT '{}'::integer[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    description text,
    investissement numeric(20,2),
    devise_id integer,
    investissement_min numeric(20,2),
    investissement_max numeric(20,2),
    investissement_est_intervalle boolean DEFAULT false,
    est_publie boolean DEFAULT true,
    id integer NOT NULL,
    porteur_projet_id integer,
    date_debut date,
    points_focaux_ids integer[] DEFAULT '{}'::integer[],
    CONSTRAINT chk_investissement_intervalle CHECK (((investissement_min IS NULL) OR (investissement_max IS NULL) OR (investissement_max > investissement_min)))
);


--
-- Name: projets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projets_id_seq OWNED BY public.projets.id;


--
-- Name: projets_points_focaux; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projets_points_focaux (
    id integer NOT NULL,
    projet_id integer NOT NULL,
    civilite character varying(20),
    nom character varying(255),
    prenom character varying(255),
    telephones text[] DEFAULT '{}'::text[],
    mails text[] DEFAULT '{}'::text[],
    ordre integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: projets_points_focaux_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projets_points_focaux_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projets_points_focaux_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projets_points_focaux_id_seq OWNED BY public.projets_points_focaux.id;


--
-- Name: prospect_contact_historique; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_contact_historique (
    id integer NOT NULL,
    contact_id integer,
    etat character varying(50) NOT NULL,
    commentaire text,
    date_changement timestamp with time zone DEFAULT now()
);


--
-- Name: prospect_contact_historique_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prospect_contact_historique_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prospect_contact_historique_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prospect_contact_historique_id_seq OWNED BY public.prospect_contact_historique.id;


--
-- Name: prospect_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_contacts (
    id integer NOT NULL,
    prospect_id integer NOT NULL,
    type character varying(20) NOT NULL,
    valeur_normalisee text NOT NULL,
    valeur_affichee text NOT NULL,
    origine character varying(20) DEFAULT 'entreprise'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: prospect_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prospect_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prospect_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prospect_contacts_id_seq OWNED BY public.prospect_contacts.id;


--
-- Name: prospect_contraintes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_contraintes (
    id integer NOT NULL,
    prospect_id integer NOT NULL,
    description text NOT NULL,
    solution_preconisee text,
    statut character varying(20) DEFAULT 'en_cours'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cycle_num integer DEFAULT 0 NOT NULL
);


--
-- Name: prospect_contraintes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prospect_contraintes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prospect_contraintes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prospect_contraintes_id_seq OWNED BY public.prospect_contraintes.id;


--
-- Name: prospect_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_cycles (
    id integer NOT NULL,
    prospect_id integer NOT NULL,
    cycle_num integer NOT NULL,
    issue character varying(20) NOT NULL,
    issue_commentaire text,
    conclu_le timestamp with time zone,
    recontacte_le timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: prospect_cycles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prospect_cycles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prospect_cycles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prospect_cycles_id_seq OWNED BY public.prospect_cycles.id;


--
-- Name: prospect_echange_fichiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_echange_fichiers (
    id integer NOT NULL,
    echange_id integer NOT NULL,
    titre character varying(255) NOT NULL,
    nom_fichier character varying(255) NOT NULL,
    chemin text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    categorie character varying(20) DEFAULT 'autre'::character varying NOT NULL
);


--
-- Name: prospect_echange_fichiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prospect_echange_fichiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prospect_echange_fichiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prospect_echange_fichiers_id_seq OWNED BY public.prospect_echange_fichiers.id;


--
-- Name: prospect_echanges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_echanges (
    id integer NOT NULL,
    prospect_id integer NOT NULL,
    date_echange date NOT NULL,
    commentaire text,
    contact_par character varying(255) DEFAULT NULL::character varying,
    enregistre_le timestamp with time zone DEFAULT now(),
    interlocuteur text,
    point_focal_id integer,
    canal character varying(50),
    canal_contact character varying(255)
);


--
-- Name: prospect_echanges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prospect_echanges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prospect_echanges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prospect_echanges_id_seq OWNED BY public.prospect_echanges.id;


--
-- Name: prospect_points_focaux; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_points_focaux (
    id integer NOT NULL,
    prospect_id integer NOT NULL,
    prenom character varying(150),
    nom character varying(150) NOT NULL,
    telephones text[] DEFAULT '{}'::text[],
    mails text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    est_principal boolean DEFAULT false
);


--
-- Name: prospect_points_focaux_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prospect_points_focaux_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prospect_points_focaux_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prospect_points_focaux_id_seq OWNED BY public.prospect_points_focaux.id;


--
-- Name: prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospects (
    id integer NOT NULL,
    type character varying(10) DEFAULT 'morale'::character varying,
    nom character varying(255) NOT NULL,
    siege_id integer,
    adresse text,
    telephones text[] DEFAULT '{}'::text[],
    mails text[] DEFAULT '{}'::text[],
    siteweb text,
    secteur_ids integer[] DEFAULT '{}'::integer[],
    branche_ids integer[] DEFAULT '{}'::integer[],
    activite_ids integer[] DEFAULT '{}'::integer[],
    point_entree text,
    details text,
    est_publie boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    objet_projet boolean DEFAULT false,
    objet_projet_id integer,
    objet_intentions_etranger boolean DEFAULT false,
    objet_intentions_details text,
    objet_adequation_senegal boolean DEFAULT false,
    objet_adequation_details text,
    objet_commentaires text,
    objet_intentions_secteur_ids integer[] DEFAULT '{}'::integer[],
    objet_intentions_branche_ids integer[] DEFAULT '{}'::integer[],
    objet_intentions_activite_ids integer[] DEFAULT '{}'::integer[],
    objet_adequation_secteur_ids integer[] DEFAULT '{}'::integer[],
    objet_adequation_branche_ids integer[] DEFAULT '{}'::integer[],
    objet_adequation_activite_ids integer[] DEFAULT '{}'::integer[],
    linkedin text,
    agent_id integer,
    issue character varying(20),
    issue_commentaire text,
    issue_conclu_le timestamp with time zone
);


--
-- Name: prospects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prospects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prospects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prospects_id_seq OWNED BY public.prospects.id;


--
-- Name: prospects_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospects_interactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prospect_id uuid NOT NULL,
    date_interaction date NOT NULL,
    type_interaction character varying(50),
    description text NOT NULL,
    agent_apix character varying(100),
    resultat text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT prospects_interactions_type_interaction_check CHECK (((type_interaction)::text = ANY ((ARRAY['email'::character varying, 'appel'::character varying, 'reunion'::character varying, 'visite'::character varying, 'evenement'::character varying, 'autre'::character varying])::text[])))
);


--
-- Name: ref_activites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_activites (
    id integer NOT NULL,
    branche_id integer NOT NULL,
    code character varying(20) NOT NULL,
    nom character varying(255) NOT NULL,
    actif boolean DEFAULT true
);


--
-- Name: ref_activites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_activites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_activites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_activites_id_seq OWNED BY public.ref_activites.id;


--
-- Name: ref_arrondissements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_arrondissements (
    id integer NOT NULL,
    departement_id integer NOT NULL,
    nom character varying(100) NOT NULL,
    actif boolean DEFAULT true
);


--
-- Name: ref_arrondissements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_arrondissements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_arrondissements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_arrondissements_id_seq OWNED BY public.ref_arrondissements.id;


--
-- Name: ref_avantages_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_avantages_types (
    id integer NOT NULL,
    libelle character varying(200) NOT NULL,
    ordre integer DEFAULT 0,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ref_avantages_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_avantages_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_avantages_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_avantages_types_id_seq OWNED BY public.ref_avantages_types.id;


--
-- Name: ref_branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_branches (
    id integer NOT NULL,
    secteur_id integer NOT NULL,
    code character varying(20) NOT NULL,
    nom character varying(150) NOT NULL,
    actif boolean DEFAULT true
);


--
-- Name: ref_branches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_branches_id_seq OWNED BY public.ref_branches.id;


--
-- Name: ref_classification_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_classification_items (
    id integer NOT NULL,
    classification_id integer NOT NULL,
    code character varying(20) NOT NULL,
    libelle_fr character varying(500) NOT NULL,
    libelle_en character varying(500) NOT NULL,
    niveau smallint NOT NULL,
    parent_id integer
);


--
-- Name: ref_classification_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_classification_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_classification_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_classification_items_id_seq OWNED BY public.ref_classification_items.id;


--
-- Name: ref_classifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_classifications (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    nom_fr character varying(200) NOT NULL,
    nom_en character varying(200) NOT NULL,
    version character varying(20),
    zone_geo character varying(100)
);


--
-- Name: ref_classifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_classifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_classifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_classifications_id_seq OWNED BY public.ref_classifications.id;


--
-- Name: ref_correspondances_naema; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_correspondances_naema (
    id integer NOT NULL,
    naema_type character varying(20) NOT NULL,
    naema_id integer NOT NULL,
    classification_item_id integer NOT NULL,
    note text
);


--
-- Name: ref_correspondances_naema_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_correspondances_naema_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_correspondances_naema_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_correspondances_naema_id_seq OWNED BY public.ref_correspondances_naema.id;


--
-- Name: ref_departements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_departements (
    id integer NOT NULL,
    region_id integer NOT NULL,
    nom character varying(100) NOT NULL,
    actif boolean DEFAULT true
);


--
-- Name: ref_departements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_departements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_departements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_departements_id_seq OWNED BY public.ref_departements.id;


--
-- Name: ref_devises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_devises (
    id integer NOT NULL,
    code_iso character(3) NOT NULL,
    nom character varying(100) NOT NULL,
    symbole character varying(10),
    actif boolean DEFAULT true,
    code character varying(10)
);


--
-- Name: ref_devises_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_devises_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_devises_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_devises_id_seq OWNED BY public.ref_devises.id;


--
-- Name: ref_groupements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_groupements (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    nom_fr character varying(200) NOT NULL,
    nom_en character varying(200),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    pays_ids integer[] DEFAULT '{}'::integer[] NOT NULL
);


--
-- Name: ref_groupements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_groupements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_groupements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_groupements_id_seq OWNED BY public.ref_groupements.id;


--
-- Name: ref_pays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_pays (
    id integer NOT NULL,
    code_iso2 character(2),
    code_iso3 character(3),
    nom_fr character varying(100) NOT NULL,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    continent character varying(50),
    region_geo character varying(100),
    niveau_revenu character varying(50),
    est_industrialise boolean DEFAULT false,
    est_emergent boolean DEFAULT false,
    nom_cnuced character varying(100),
    origine text
);


--
-- Name: ref_pays_groupements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_pays_groupements (
    pays_id integer NOT NULL,
    groupement_id integer NOT NULL
);


--
-- Name: ref_pays_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_pays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_pays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_pays_id_seq OWNED BY public.ref_pays.id;


--
-- Name: ref_regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_regions (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    actif boolean DEFAULT true,
    superficie integer
);


--
-- Name: ref_regions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_regions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_regions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_regions_id_seq OWNED BY public.ref_regions.id;


--
-- Name: ref_secteurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_secteurs (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    nom character varying(150) NOT NULL,
    description text,
    actif boolean DEFAULT true
);


--
-- Name: ref_secteurs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_secteurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_secteurs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_secteurs_id_seq OWNED BY public.ref_secteurs.id;


--
-- Name: ref_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_sources (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    nom character varying(150) NOT NULL,
    type character varying(30) NOT NULL,
    url text,
    actif boolean DEFAULT true,
    CONSTRAINT ref_sources_type_check CHECK (((type)::text = ANY ((ARRAY['scraping'::character varying, 'api'::character varying, 'manuel'::character varying, 'import'::character varying])::text[])))
);


--
-- Name: ref_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_sources_id_seq OWNED BY public.ref_sources.id;


--
-- Name: ref_statuts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_statuts (
    id integer NOT NULL,
    module character varying(50) NOT NULL,
    code character varying(50) NOT NULL,
    libelle_fr character varying(100) NOT NULL,
    couleur_hex character varying(7)
);


--
-- Name: ref_statuts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ref_statuts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_statuts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ref_statuts_id_seq OWNED BY public.ref_statuts.id;


--
-- Name: stat_indicateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stat_indicateurs (
    code text NOT NULL,
    libelle text NOT NULL,
    unite text,
    categorie text,
    ordre integer DEFAULT 0 NOT NULL,
    derive boolean DEFAULT false NOT NULL
);


--
-- Name: stat_pays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stat_pays (
    pays_id integer NOT NULL,
    annee smallint NOT NULL,
    indicateur text NOT NULL,
    valeur double precision
);


--
-- Name: stat_ressources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stat_ressources (
    nom_en text NOT NULL,
    libelle text
);


--
-- Name: stat_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stat_transactions (
    id bigint NOT NULL,
    annee smallint NOT NULL,
    exportateur_id integer NOT NULL,
    importateur_id integer NOT NULL,
    ressource text,
    valeur double precision
);


--
-- Name: stat_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stat_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stat_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stat_transactions_id_seq OWNED BY public.stat_transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    hashed_password text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role text DEFAULT 'restreint'::text NOT NULL,
    modules text[] DEFAULT '{}'::text[] NOT NULL,
    prenom text,
    nom text
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: utilisateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utilisateurs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    nom character varying(100) NOT NULL,
    prenom character varying(100) NOT NULL,
    organisation character varying(255),
    pays_id integer,
    telephone character varying(50),
    role character varying(30) NOT NULL,
    password_hash text,
    mfa_secret text,
    est_actif boolean DEFAULT true,
    derniere_connexion timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT utilisateurs_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'agent_apix'::character varying, 'investisseur'::character varying, 'public'::character varying])::text[])))
);


--
-- Name: zone_entreprises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zone_entreprises (
    id integer NOT NULL,
    zone_id character varying(20) NOT NULL,
    entreprise_id integer NOT NULL,
    statut character varying(20) DEFAULT 'installee'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT zone_entreprises_statut_check CHECK (((statut)::text = ANY ((ARRAY['eligible'::character varying, 'installee'::character varying])::text[])))
);


--
-- Name: zone_entreprises_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zone_entreprises_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zone_entreprises_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zone_entreprises_id_seq OWNED BY public.zone_entreprises.id;


--
-- Name: zone_fichiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zone_fichiers (
    id integer NOT NULL,
    zone_id character varying(20) NOT NULL,
    nom character varying(255) NOT NULL,
    url text NOT NULL,
    type_fichier character varying(50),
    taille_ko integer,
    created_at timestamp with time zone DEFAULT now(),
    created_by character varying(100)
);


--
-- Name: zone_fichiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zone_fichiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zone_fichiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zone_fichiers_id_seq OWNED BY public.zone_fichiers.id;


--
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id character varying(20) NOT NULL,
    type_zone character varying(3) NOT NULL,
    nom_zone character varying(255) NOT NULL,
    pole_id integer,
    region_id integer,
    departement_id integer,
    arrondissement_id integer,
    description text,
    date_creation date,
    decret_creation character varying(255),
    superficie numeric,
    secteur_ids integer[] DEFAULT '{}'::integer[],
    branche_ids integer[] DEFAULT '{}'::integer[],
    activite_ids integer[] DEFAULT '{}'::integer[],
    entreprise_ids integer[] DEFAULT '{}'::integer[],
    est_publie boolean DEFAULT true,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT zones_type_zone_check CHECK (((type_zone)::text = ANY ((ARRAY['ZES'::character varying, 'ZAI'::character varying, 'ZFI'::character varying])::text[])))
);


--
-- Name: accord_fichiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accord_fichiers ALTER COLUMN id SET DEFAULT nextval('public.accord_fichiers_id_seq'::regclass);


--
-- Name: accords_traites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accords_traites ALTER COLUMN id SET DEFAULT nextval('public.accords_traites_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: avantages_incitations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avantages_incitations ALTER COLUMN id SET DEFAULT nextval('public.avantages_incitations_id_seq'::regclass);


--
-- Name: avantages_incitations_fichiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avantages_incitations_fichiers ALTER COLUMN id SET DEFAULT nextval('public.avantages_incitations_fichiers_id_seq'::regclass);


--
-- Name: avantages_incitations_selections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avantages_incitations_selections ALTER COLUMN id SET DEFAULT nextval('public.avantages_incitations_selections_id_seq'::regclass);


--
-- Name: bdef_groupes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_groupes ALTER COLUMN id SET DEFAULT nextval('public.bdef_groupes_id_seq'::regclass);


--
-- Name: bdef_import_revue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_import_revue ALTER COLUMN id SET DEFAULT nextval('public.bdef_import_revue_id_seq'::regclass);


--
-- Name: bdef_imports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_imports ALTER COLUMN id SET DEFAULT nextval('public.bdef_imports_id_seq'::regclass);


--
-- Name: bdef_indicateur_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_indicateur_categories ALTER COLUMN id SET DEFAULT nextval('public.bdef_indicateur_categories_id_seq'::regclass);


--
-- Name: bdef_indicateurs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_indicateurs ALTER COLUMN id SET DEFAULT nextval('public.bdef_indicateurs_id_seq'::regclass);


--
-- Name: bdef_macro_secteurs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_macro_secteurs ALTER COLUMN id SET DEFAULT nextval('public.bdef_macro_secteurs_id_seq'::regclass);


--
-- Name: bdef_secteur_alias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_secteur_alias ALTER COLUMN id SET DEFAULT nextval('public.bdef_secteur_alias_id_seq'::regclass);


--
-- Name: bdef_secteurs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_secteurs ALTER COLUMN id SET DEFAULT nextval('public.bdef_secteurs_id_seq'::regclass);


--
-- Name: bdef_valeurs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs ALTER COLUMN id SET DEFAULT nextval('public.bdef_valeurs_id_seq'::regclass);


--
-- Name: bdef_valeurs_rejetees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs_rejetees ALTER COLUMN id SET DEFAULT nextval('public.bdef_valeurs_rejetees_id_seq'::regclass);


--
-- Name: citi_classes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_classes ALTER COLUMN id SET DEFAULT nextval('public.citi_classes_id_seq'::regclass);


--
-- Name: citi_divisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_divisions ALTER COLUMN id SET DEFAULT nextval('public.citi_divisions_id_seq'::regclass);


--
-- Name: citi_groupes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_groupes ALTER COLUMN id SET DEFAULT nextval('public.citi_groupes_id_seq'::regclass);


--
-- Name: citi_naema_correspondances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_naema_correspondances ALTER COLUMN id SET DEFAULT nextval('public.citi_naema_correspondances_id_seq'::regclass);


--
-- Name: citi_sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_sections ALTER COLUMN id SET DEFAULT nextval('public.citi_sections_id_seq'::regclass);


--
-- Name: entreprises_installees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_installees ALTER COLUMN id SET DEFAULT nextval('public.entreprises_installees_id_seq'::regclass);


--
-- Name: entreprises_points_focaux id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_points_focaux ALTER COLUMN id SET DEFAULT nextval('public.entreprises_points_focaux_id_seq'::regclass);


--
-- Name: evenement_fichiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evenement_fichiers ALTER COLUMN id SET DEFAULT nextval('public.evenement_fichiers_id_seq'::regclass);


--
-- Name: evenements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evenements ALTER COLUMN id SET DEFAULT nextval('public.evenements_new_id_seq'::regclass);


--
-- Name: ide_analyses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_analyses ALTER COLUMN id SET DEFAULT nextval('public.ide_analyses_id_seq'::regclass);


--
-- Name: ide_cnuced id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_cnuced ALTER COLUMN id SET DEFAULT nextval('public.ide_cnuced_id_seq'::regclass);


--
-- Name: ide_cnuced_monde id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_cnuced_monde ALTER COLUMN id SET DEFAULT nextval('public.ide_cnuced_monde_id_seq'::regclass);


--
-- Name: ide_cnuced_secteurs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_cnuced_secteurs ALTER COLUMN id SET DEFAULT nextval('public.ide_cnuced_secteurs_id_seq'::regclass);


--
-- Name: ide_kpis_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_kpis_config ALTER COLUMN id SET DEFAULT nextval('public.ide_kpis_config_id_seq'::regclass);


--
-- Name: ide_pays_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_pays_config ALTER COLUMN id SET DEFAULT nextval('public.ide_pays_config_id_seq'::regclass);


--
-- Name: nace_classes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_classes ALTER COLUMN id SET DEFAULT nextval('public.nace_classes_id_seq'::regclass);


--
-- Name: nace_divisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_divisions ALTER COLUMN id SET DEFAULT nextval('public.nace_divisions_id_seq'::regclass);


--
-- Name: nace_groupes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_groupes ALTER COLUMN id SET DEFAULT nextval('public.nace_groupes_id_seq'::regclass);


--
-- Name: nace_naema_correspondances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_naema_correspondances ALTER COLUMN id SET DEFAULT nextval('public.nace_naema_correspondances_id_seq'::regclass);


--
-- Name: nace_sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_sections ALTER COLUMN id SET DEFAULT nextval('public.nace_sections_id_seq'::regclass);


--
-- Name: pole_fichiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pole_fichiers ALTER COLUMN id SET DEFAULT nextval('public.pole_fichiers_id_seq'::regclass);


--
-- Name: poles_territoires id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poles_territoires ALTER COLUMN id SET DEFAULT nextval('public.poles_territoires_id_seq'::regclass);


--
-- Name: potentialites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potentialites ALTER COLUMN id SET DEFAULT nextval('public.potentialites_id_seq'::regclass);


--
-- Name: potentialites_fichiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potentialites_fichiers ALTER COLUMN id SET DEFAULT nextval('public.potentialites_fichiers_id_seq'::regclass);


--
-- Name: projet_fichiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projet_fichiers ALTER COLUMN id SET DEFAULT nextval('public.projet_fichiers_id_seq'::regclass);


--
-- Name: projet_phases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projet_phases ALTER COLUMN id SET DEFAULT nextval('public.projet_phases_id_seq'::regclass);


--
-- Name: projets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets ALTER COLUMN id SET DEFAULT nextval('public.projets_id_seq'::regclass);


--
-- Name: projets_points_focaux id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets_points_focaux ALTER COLUMN id SET DEFAULT nextval('public.projets_points_focaux_id_seq'::regclass);


--
-- Name: prospect_contact_historique id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_contact_historique ALTER COLUMN id SET DEFAULT nextval('public.prospect_contact_historique_id_seq'::regclass);


--
-- Name: prospect_contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_contacts ALTER COLUMN id SET DEFAULT nextval('public.prospect_contacts_id_seq'::regclass);


--
-- Name: prospect_contraintes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_contraintes ALTER COLUMN id SET DEFAULT nextval('public.prospect_contraintes_id_seq'::regclass);


--
-- Name: prospect_cycles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_cycles ALTER COLUMN id SET DEFAULT nextval('public.prospect_cycles_id_seq'::regclass);


--
-- Name: prospect_echange_fichiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_echange_fichiers ALTER COLUMN id SET DEFAULT nextval('public.prospect_echange_fichiers_id_seq'::regclass);


--
-- Name: prospect_echanges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_echanges ALTER COLUMN id SET DEFAULT nextval('public.prospect_echanges_id_seq'::regclass);


--
-- Name: prospect_points_focaux id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_points_focaux ALTER COLUMN id SET DEFAULT nextval('public.prospect_points_focaux_id_seq'::regclass);


--
-- Name: prospects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects ALTER COLUMN id SET DEFAULT nextval('public.prospects_id_seq'::regclass);


--
-- Name: ref_activites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_activites ALTER COLUMN id SET DEFAULT nextval('public.ref_activites_id_seq'::regclass);


--
-- Name: ref_arrondissements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_arrondissements ALTER COLUMN id SET DEFAULT nextval('public.ref_arrondissements_id_seq'::regclass);


--
-- Name: ref_avantages_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_avantages_types ALTER COLUMN id SET DEFAULT nextval('public.ref_avantages_types_id_seq'::regclass);


--
-- Name: ref_branches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_branches ALTER COLUMN id SET DEFAULT nextval('public.ref_branches_id_seq'::regclass);


--
-- Name: ref_classification_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_classification_items ALTER COLUMN id SET DEFAULT nextval('public.ref_classification_items_id_seq'::regclass);


--
-- Name: ref_classifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_classifications ALTER COLUMN id SET DEFAULT nextval('public.ref_classifications_id_seq'::regclass);


--
-- Name: ref_correspondances_naema id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_correspondances_naema ALTER COLUMN id SET DEFAULT nextval('public.ref_correspondances_naema_id_seq'::regclass);


--
-- Name: ref_departements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_departements ALTER COLUMN id SET DEFAULT nextval('public.ref_departements_id_seq'::regclass);


--
-- Name: ref_devises id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_devises ALTER COLUMN id SET DEFAULT nextval('public.ref_devises_id_seq'::regclass);


--
-- Name: ref_groupements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_groupements ALTER COLUMN id SET DEFAULT nextval('public.ref_groupements_id_seq'::regclass);


--
-- Name: ref_pays id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_pays ALTER COLUMN id SET DEFAULT nextval('public.ref_pays_id_seq'::regclass);


--
-- Name: ref_regions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_regions ALTER COLUMN id SET DEFAULT nextval('public.ref_regions_id_seq'::regclass);


--
-- Name: ref_secteurs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_secteurs ALTER COLUMN id SET DEFAULT nextval('public.ref_secteurs_id_seq'::regclass);


--
-- Name: ref_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_sources ALTER COLUMN id SET DEFAULT nextval('public.ref_sources_id_seq'::regclass);


--
-- Name: ref_statuts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_statuts ALTER COLUMN id SET DEFAULT nextval('public.ref_statuts_id_seq'::regclass);


--
-- Name: stat_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stat_transactions ALTER COLUMN id SET DEFAULT nextval('public.stat_transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: zone_entreprises id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_entreprises ALTER COLUMN id SET DEFAULT nextval('public.zone_entreprises_id_seq'::regclass);


--
-- Name: zone_fichiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_fichiers ALTER COLUMN id SET DEFAULT nextval('public.zone_fichiers_id_seq'::regclass);


--
-- Name: accord_fichiers accord_fichiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accord_fichiers
    ADD CONSTRAINT accord_fichiers_pkey PRIMARY KEY (id);


--
-- Name: accords_traites accords_traites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accords_traites
    ADD CONSTRAINT accords_traites_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: auth_throttle auth_throttle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_throttle
    ADD CONSTRAINT auth_throttle_pkey PRIMARY KEY (cle);


--
-- Name: avantages_incitations_fichiers avantages_incitations_fichiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avantages_incitations_fichiers
    ADD CONSTRAINT avantages_incitations_fichiers_pkey PRIMARY KEY (id);


--
-- Name: avantages_incitations avantages_incitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avantages_incitations
    ADD CONSTRAINT avantages_incitations_pkey PRIMARY KEY (id);


--
-- Name: avantages_incitations_selections avantages_incitations_selections_avantage_id_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avantages_incitations_selections
    ADD CONSTRAINT avantages_incitations_selections_avantage_id_type_id_key UNIQUE (avantage_id, type_id);


--
-- Name: avantages_incitations_selections avantages_incitations_selections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avantages_incitations_selections
    ADD CONSTRAINT avantages_incitations_selections_pkey PRIMARY KEY (id);


--
-- Name: bdef_groupes bdef_groupes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_groupes
    ADD CONSTRAINT bdef_groupes_code_key UNIQUE (code);


--
-- Name: bdef_groupes bdef_groupes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_groupes
    ADD CONSTRAINT bdef_groupes_pkey PRIMARY KEY (id);


--
-- Name: bdef_import_revue bdef_import_revue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_import_revue
    ADD CONSTRAINT bdef_import_revue_pkey PRIMARY KEY (id);


--
-- Name: bdef_imports bdef_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_imports
    ADD CONSTRAINT bdef_imports_pkey PRIMARY KEY (id);


--
-- Name: bdef_indicateur_categories bdef_indicateur_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_indicateur_categories
    ADD CONSTRAINT bdef_indicateur_categories_code_key UNIQUE (code);


--
-- Name: bdef_indicateur_categories bdef_indicateur_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_indicateur_categories
    ADD CONSTRAINT bdef_indicateur_categories_pkey PRIMARY KEY (id);


--
-- Name: bdef_indicateurs bdef_indicateurs_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_indicateurs
    ADD CONSTRAINT bdef_indicateurs_code_key UNIQUE (code);


--
-- Name: bdef_indicateurs bdef_indicateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_indicateurs
    ADD CONSTRAINT bdef_indicateurs_pkey PRIMARY KEY (id);


--
-- Name: bdef_macro_secteurs bdef_macro_secteurs_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_macro_secteurs
    ADD CONSTRAINT bdef_macro_secteurs_code_key UNIQUE (code);


--
-- Name: bdef_macro_secteurs bdef_macro_secteurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_macro_secteurs
    ADD CONSTRAINT bdef_macro_secteurs_pkey PRIMARY KEY (id);


--
-- Name: bdef_secteur_alias bdef_secteur_alias_niveau_libelle_brut_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_secteur_alias
    ADD CONSTRAINT bdef_secteur_alias_niveau_libelle_brut_key UNIQUE (niveau, libelle_brut);


--
-- Name: bdef_secteur_alias bdef_secteur_alias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_secteur_alias
    ADD CONSTRAINT bdef_secteur_alias_pkey PRIMARY KEY (id);


--
-- Name: bdef_secteurs bdef_secteurs_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_secteurs
    ADD CONSTRAINT bdef_secteurs_code_key UNIQUE (code);


--
-- Name: bdef_secteurs bdef_secteurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_secteurs
    ADD CONSTRAINT bdef_secteurs_pkey PRIMARY KEY (id);


--
-- Name: bdef_valeurs bdef_valeurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs
    ADD CONSTRAINT bdef_valeurs_pkey PRIMARY KEY (id);


--
-- Name: bdef_valeurs_rejetees bdef_valeurs_rejetees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs_rejetees
    ADD CONSTRAINT bdef_valeurs_rejetees_pkey PRIMARY KEY (id);


--
-- Name: citi_classes citi_classes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_classes
    ADD CONSTRAINT citi_classes_code_key UNIQUE (code);


--
-- Name: citi_classes citi_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_classes
    ADD CONSTRAINT citi_classes_pkey PRIMARY KEY (id);


--
-- Name: citi_divisions citi_divisions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_divisions
    ADD CONSTRAINT citi_divisions_code_key UNIQUE (code);


--
-- Name: citi_divisions citi_divisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_divisions
    ADD CONSTRAINT citi_divisions_pkey PRIMARY KEY (id);


--
-- Name: citi_groupes citi_groupes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_groupes
    ADD CONSTRAINT citi_groupes_code_key UNIQUE (code);


--
-- Name: citi_groupes citi_groupes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_groupes
    ADD CONSTRAINT citi_groupes_pkey PRIMARY KEY (id);


--
-- Name: citi_naema_correspondances citi_naema_correspondances_citi_classe_id_naema_activite_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_naema_correspondances
    ADD CONSTRAINT citi_naema_correspondances_citi_classe_id_naema_activite_id_key UNIQUE (citi_classe_id, naema_activite_id);


--
-- Name: citi_naema_correspondances citi_naema_correspondances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_naema_correspondances
    ADD CONSTRAINT citi_naema_correspondances_pkey PRIMARY KEY (id);


--
-- Name: citi_sections citi_sections_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_sections
    ADD CONSTRAINT citi_sections_code_key UNIQUE (code);


--
-- Name: citi_sections citi_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_sections
    ADD CONSTRAINT citi_sections_pkey PRIMARY KEY (id);


--
-- Name: code_articles code_articles_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_articles
    ADD CONSTRAINT code_articles_numero_key UNIQUE (numero);


--
-- Name: code_articles code_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_articles
    ADD CONSTRAINT code_articles_pkey PRIMARY KEY (id);


--
-- Name: code_chapitres code_chapitres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_chapitres
    ADD CONSTRAINT code_chapitres_pkey PRIMARY KEY (id);


--
-- Name: code_investissement_pdf code_investissement_pdf_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_investissement_pdf
    ADD CONSTRAINT code_investissement_pdf_pkey PRIMARY KEY (id);


--
-- Name: code_sections code_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_sections
    ADD CONSTRAINT code_sections_pkey PRIMARY KEY (id);


--
-- Name: entreprises_hors_senegal entreprises_hors_senegal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_hors_senegal
    ADD CONSTRAINT entreprises_hors_senegal_pkey PRIMARY KEY (id);


--
-- Name: entreprises_installees entreprises_installees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_installees
    ADD CONSTRAINT entreprises_installees_pkey PRIMARY KEY (id);


--
-- Name: evenement_fichiers evenement_fichiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evenement_fichiers
    ADD CONSTRAINT evenement_fichiers_pkey PRIMARY KEY (id);


--
-- Name: evenements evenements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evenements
    ADD CONSTRAINT evenements_pkey PRIMARY KEY (id);


--
-- Name: ide_analyses ide_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_analyses
    ADD CONSTRAINT ide_analyses_pkey PRIMARY KEY (id);


--
-- Name: ide_cnuced_monde ide_cnuced_monde_code_annee_indicateur_direction_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_cnuced_monde
    ADD CONSTRAINT ide_cnuced_monde_code_annee_indicateur_direction_key UNIQUE (code, annee, indicateur, direction);


--
-- Name: ide_cnuced_monde ide_cnuced_monde_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_cnuced_monde
    ADD CONSTRAINT ide_cnuced_monde_pkey PRIMARY KEY (id);


--
-- Name: ide_cnuced ide_cnuced_pays_annee_direction_indicateur_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_cnuced
    ADD CONSTRAINT ide_cnuced_pays_annee_direction_indicateur_key UNIQUE (pays, annee, direction, indicateur);


--
-- Name: ide_cnuced ide_cnuced_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_cnuced
    ADD CONSTRAINT ide_cnuced_pkey PRIMARY KEY (id);


--
-- Name: ide_cnuced_secteurs ide_cnuced_secteurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_cnuced_secteurs
    ADD CONSTRAINT ide_cnuced_secteurs_pkey PRIMARY KEY (id);


--
-- Name: ide_flux ide_flux_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_flux
    ADD CONSTRAINT ide_flux_pkey PRIMARY KEY (id);


--
-- Name: ide_kpis_config ide_kpis_config_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_kpis_config
    ADD CONSTRAINT ide_kpis_config_code_key UNIQUE (code);


--
-- Name: ide_kpis_config ide_kpis_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_kpis_config
    ADD CONSTRAINT ide_kpis_config_pkey PRIMARY KEY (id);


--
-- Name: ide_pays_config ide_pays_config_code_iso2_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_pays_config
    ADD CONSTRAINT ide_pays_config_code_iso2_key UNIQUE (code_iso2);


--
-- Name: ide_pays_config ide_pays_config_code_iso3_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_pays_config
    ADD CONSTRAINT ide_pays_config_code_iso3_key UNIQUE (code_iso3);


--
-- Name: ide_pays_config ide_pays_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_pays_config
    ADD CONSTRAINT ide_pays_config_pkey PRIMARY KEY (id);


--
-- Name: ide_secteurs ide_secteurs_nom_en_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_secteurs
    ADD CONSTRAINT ide_secteurs_nom_en_key UNIQUE (nom_en);


--
-- Name: ide_secteurs ide_secteurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_secteurs
    ADD CONSTRAINT ide_secteurs_pkey PRIMARY KEY (id);


--
-- Name: intentions_interactions intentions_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intentions_interactions
    ADD CONSTRAINT intentions_interactions_pkey PRIMARY KEY (id);


--
-- Name: intentions_investissement intentions_investissement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intentions_investissement
    ADD CONSTRAINT intentions_investissement_pkey PRIMARY KEY (id);


--
-- Name: modalites_articles modalites_articles_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modalites_articles
    ADD CONSTRAINT modalites_articles_numero_key UNIQUE (numero);


--
-- Name: modalites_articles modalites_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modalites_articles
    ADD CONSTRAINT modalites_articles_pkey PRIMARY KEY (id);


--
-- Name: modalites_chapitres modalites_chapitres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modalites_chapitres
    ADD CONSTRAINT modalites_chapitres_pkey PRIMARY KEY (id);


--
-- Name: modalites_pdf modalites_pdf_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modalites_pdf
    ADD CONSTRAINT modalites_pdf_pkey PRIMARY KEY (id);


--
-- Name: modalites_sections modalites_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modalites_sections
    ADD CONSTRAINT modalites_sections_pkey PRIMARY KEY (id);


--
-- Name: nace_classes nace_classes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_classes
    ADD CONSTRAINT nace_classes_code_key UNIQUE (code);


--
-- Name: nace_classes nace_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_classes
    ADD CONSTRAINT nace_classes_pkey PRIMARY KEY (id);


--
-- Name: nace_divisions nace_divisions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_divisions
    ADD CONSTRAINT nace_divisions_code_key UNIQUE (code);


--
-- Name: nace_divisions nace_divisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_divisions
    ADD CONSTRAINT nace_divisions_pkey PRIMARY KEY (id);


--
-- Name: nace_groupes nace_groupes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_groupes
    ADD CONSTRAINT nace_groupes_code_key UNIQUE (code);


--
-- Name: nace_groupes nace_groupes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_groupes
    ADD CONSTRAINT nace_groupes_pkey PRIMARY KEY (id);


--
-- Name: nace_naema_correspondances nace_naema_correspondances_nace_classe_id_naema_activite_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_naema_correspondances
    ADD CONSTRAINT nace_naema_correspondances_nace_classe_id_naema_activite_id_key UNIQUE (nace_classe_id, naema_activite_id);


--
-- Name: nace_naema_correspondances nace_naema_correspondances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_naema_correspondances
    ADD CONSTRAINT nace_naema_correspondances_pkey PRIMARY KEY (id);


--
-- Name: nace_sections nace_sections_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_sections
    ADD CONSTRAINT nace_sections_code_key UNIQUE (code);


--
-- Name: nace_sections nace_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_sections
    ADD CONSTRAINT nace_sections_pkey PRIMARY KEY (id);


--
-- Name: opportunites_investissement opportunites_investissement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunites_investissement
    ADD CONSTRAINT opportunites_investissement_pkey PRIMARY KEY (id);


--
-- Name: opportunites_investissement opportunites_investissement_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunites_investissement
    ADD CONSTRAINT opportunites_investissement_reference_key UNIQUE (reference);


--
-- Name: pole_fichiers pole_fichiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pole_fichiers
    ADD CONSTRAINT pole_fichiers_pkey PRIMARY KEY (id);


--
-- Name: poles_territoires poles_territoires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poles_territoires
    ADD CONSTRAINT poles_territoires_pkey PRIMARY KEY (id);


--
-- Name: poles_territoires poles_territoires_pole_territoire_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poles_territoires
    ADD CONSTRAINT poles_territoires_pole_territoire_key UNIQUE (pole_territoire);


--
-- Name: potentialites_fichiers potentialites_fichiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potentialites_fichiers
    ADD CONSTRAINT potentialites_fichiers_pkey PRIMARY KEY (id);


--
-- Name: potentialites potentialites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potentialites
    ADD CONSTRAINT potentialites_pkey PRIMARY KEY (id);


--
-- Name: profils_investisseurs profils_investisseurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils_investisseurs
    ADD CONSTRAINT profils_investisseurs_pkey PRIMARY KEY (id);


--
-- Name: profils_investisseurs profils_investisseurs_utilisateur_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils_investisseurs
    ADD CONSTRAINT profils_investisseurs_utilisateur_id_key UNIQUE (utilisateur_id);


--
-- Name: projet_fichiers projet_fichiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projet_fichiers
    ADD CONSTRAINT projet_fichiers_pkey PRIMARY KEY (id);


--
-- Name: porteurs_projets projet_moa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.porteurs_projets
    ADD CONSTRAINT projet_moa_pkey PRIMARY KEY (id);


--
-- Name: projet_phases projet_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projet_phases
    ADD CONSTRAINT projet_phases_pkey PRIMARY KEY (id);


--
-- Name: projets projets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets
    ADD CONSTRAINT projets_pkey PRIMARY KEY (id);


--
-- Name: projets_points_focaux projets_points_focaux_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets_points_focaux
    ADD CONSTRAINT projets_points_focaux_pkey PRIMARY KEY (id);


--
-- Name: prospect_contact_historique prospect_contact_historique_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_contact_historique
    ADD CONSTRAINT prospect_contact_historique_pkey PRIMARY KEY (id);


--
-- Name: prospect_contacts prospect_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_contacts
    ADD CONSTRAINT prospect_contacts_pkey PRIMARY KEY (id);


--
-- Name: prospect_contraintes prospect_contraintes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_contraintes
    ADD CONSTRAINT prospect_contraintes_pkey PRIMARY KEY (id);


--
-- Name: prospect_cycles prospect_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_cycles
    ADD CONSTRAINT prospect_cycles_pkey PRIMARY KEY (id);


--
-- Name: prospect_echange_fichiers prospect_echange_fichiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_echange_fichiers
    ADD CONSTRAINT prospect_echange_fichiers_pkey PRIMARY KEY (id);


--
-- Name: prospect_echanges prospect_echanges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_echanges
    ADD CONSTRAINT prospect_echanges_pkey PRIMARY KEY (id);


--
-- Name: prospect_points_focaux prospect_points_focaux_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_points_focaux
    ADD CONSTRAINT prospect_points_focaux_pkey PRIMARY KEY (id);


--
-- Name: prospects_interactions prospects_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects_interactions
    ADD CONSTRAINT prospects_interactions_pkey PRIMARY KEY (id);


--
-- Name: prospects prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_pkey PRIMARY KEY (id);


--
-- Name: ref_activites ref_activites_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_activites
    ADD CONSTRAINT ref_activites_code_key UNIQUE (code);


--
-- Name: ref_activites ref_activites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_activites
    ADD CONSTRAINT ref_activites_pkey PRIMARY KEY (id);


--
-- Name: ref_arrondissements ref_arrondissements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_arrondissements
    ADD CONSTRAINT ref_arrondissements_pkey PRIMARY KEY (id);


--
-- Name: ref_avantages_types ref_avantages_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_avantages_types
    ADD CONSTRAINT ref_avantages_types_pkey PRIMARY KEY (id);


--
-- Name: ref_branches ref_branches_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_branches
    ADD CONSTRAINT ref_branches_code_key UNIQUE (code);


--
-- Name: ref_branches ref_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_branches
    ADD CONSTRAINT ref_branches_pkey PRIMARY KEY (id);


--
-- Name: ref_classification_items ref_classification_items_classification_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_classification_items
    ADD CONSTRAINT ref_classification_items_classification_id_code_key UNIQUE (classification_id, code);


--
-- Name: ref_classification_items ref_classification_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_classification_items
    ADD CONSTRAINT ref_classification_items_pkey PRIMARY KEY (id);


--
-- Name: ref_classifications ref_classifications_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_classifications
    ADD CONSTRAINT ref_classifications_code_key UNIQUE (code);


--
-- Name: ref_classifications ref_classifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_classifications
    ADD CONSTRAINT ref_classifications_pkey PRIMARY KEY (id);


--
-- Name: ref_correspondances_naema ref_correspondances_naema_naema_type_naema_id_classificatio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_correspondances_naema
    ADD CONSTRAINT ref_correspondances_naema_naema_type_naema_id_classificatio_key UNIQUE (naema_type, naema_id, classification_item_id);


--
-- Name: ref_correspondances_naema ref_correspondances_naema_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_correspondances_naema
    ADD CONSTRAINT ref_correspondances_naema_pkey PRIMARY KEY (id);


--
-- Name: ref_departements ref_departements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_departements
    ADD CONSTRAINT ref_departements_pkey PRIMARY KEY (id);


--
-- Name: ref_devises ref_devises_code_iso_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_devises
    ADD CONSTRAINT ref_devises_code_iso_key UNIQUE (code_iso);


--
-- Name: ref_devises ref_devises_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_devises
    ADD CONSTRAINT ref_devises_code_key UNIQUE (code);


--
-- Name: ref_devises ref_devises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_devises
    ADD CONSTRAINT ref_devises_pkey PRIMARY KEY (id);


--
-- Name: ref_groupements ref_groupements_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_groupements
    ADD CONSTRAINT ref_groupements_code_key UNIQUE (code);


--
-- Name: ref_groupements ref_groupements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_groupements
    ADD CONSTRAINT ref_groupements_pkey PRIMARY KEY (id);


--
-- Name: ref_pays ref_pays_code_iso2_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_pays
    ADD CONSTRAINT ref_pays_code_iso2_key UNIQUE (code_iso2);


--
-- Name: ref_pays ref_pays_code_iso3_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_pays
    ADD CONSTRAINT ref_pays_code_iso3_key UNIQUE (code_iso3);


--
-- Name: ref_pays_groupements ref_pays_groupements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_pays_groupements
    ADD CONSTRAINT ref_pays_groupements_pkey PRIMARY KEY (pays_id, groupement_id);


--
-- Name: ref_pays ref_pays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_pays
    ADD CONSTRAINT ref_pays_pkey PRIMARY KEY (id);


--
-- Name: ref_regions ref_regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_regions
    ADD CONSTRAINT ref_regions_pkey PRIMARY KEY (id);


--
-- Name: ref_secteurs ref_secteurs_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_secteurs
    ADD CONSTRAINT ref_secteurs_code_key UNIQUE (code);


--
-- Name: ref_secteurs ref_secteurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_secteurs
    ADD CONSTRAINT ref_secteurs_pkey PRIMARY KEY (id);


--
-- Name: ref_sources ref_sources_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_sources
    ADD CONSTRAINT ref_sources_code_key UNIQUE (code);


--
-- Name: ref_sources ref_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_sources
    ADD CONSTRAINT ref_sources_pkey PRIMARY KEY (id);


--
-- Name: ref_statuts ref_statuts_module_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_statuts
    ADD CONSTRAINT ref_statuts_module_code_key UNIQUE (module, code);


--
-- Name: ref_statuts ref_statuts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_statuts
    ADD CONSTRAINT ref_statuts_pkey PRIMARY KEY (id);


--
-- Name: stat_indicateurs stat_indicateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stat_indicateurs
    ADD CONSTRAINT stat_indicateurs_pkey PRIMARY KEY (code);


--
-- Name: stat_pays stat_pays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stat_pays
    ADD CONSTRAINT stat_pays_pkey PRIMARY KEY (pays_id, annee, indicateur);


--
-- Name: stat_ressources stat_ressources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stat_ressources
    ADD CONSTRAINT stat_ressources_pkey PRIMARY KEY (nom_en);


--
-- Name: stat_transactions stat_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stat_transactions
    ADD CONSTRAINT stat_transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: utilisateurs utilisateurs_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_email_key UNIQUE (email);


--
-- Name: utilisateurs utilisateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_pkey PRIMARY KEY (id);


--
-- Name: zone_entreprises zone_entreprises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_entreprises
    ADD CONSTRAINT zone_entreprises_pkey PRIMARY KEY (id);


--
-- Name: zone_entreprises zone_entreprises_zone_id_entreprise_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_entreprises
    ADD CONSTRAINT zone_entreprises_zone_id_entreprise_id_key UNIQUE (zone_id, entreprise_id);


--
-- Name: zone_fichiers zone_fichiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_fichiers
    ADD CONSTRAINT zone_fichiers_pkey PRIMARY KEY (id);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: idx_accords_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accords_date ON public.accords_traites USING btree (date_signature);


--
-- Name: idx_accords_publie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accords_publie ON public.accords_traites USING btree (est_publie);


--
-- Name: idx_accords_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accords_statut ON public.accords_traites USING btree (statut);


--
-- Name: idx_accords_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accords_type ON public.accords_traites USING btree (type_accord);


--
-- Name: idx_activites_branche; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activites_branche ON public.ref_activites USING btree (branche_id);


--
-- Name: idx_arr_dep; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_arr_dep ON public.ref_arrondissements USING btree (departement_id);


--
-- Name: idx_audit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_date ON public.audit_log USING btree (changed_at);


--
-- Name: idx_audit_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_record ON public.audit_log USING btree (record_id);


--
-- Name: idx_audit_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_table ON public.audit_log USING btree (table_name);


--
-- Name: idx_avantages_activite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_avantages_activite ON public.avantages_incitations USING btree (activite_id);


--
-- Name: idx_bdef_alias_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bdef_alias_lookup ON public.bdef_secteur_alias USING btree (niveau, libelle_brut);


--
-- Name: idx_bdef_groupes_macro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bdef_groupes_macro ON public.bdef_groupes USING btree (macro_secteur_id);


--
-- Name: idx_bdef_indicateurs_cat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bdef_indicateurs_cat ON public.bdef_indicateurs USING btree (categorie_id);


--
-- Name: idx_bdef_revue_import; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bdef_revue_import ON public.bdef_import_revue USING btree (import_id);


--
-- Name: idx_bdef_revue_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bdef_revue_statut ON public.bdef_import_revue USING btree (statut);


--
-- Name: idx_bdef_secteurs_groupe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bdef_secteurs_groupe ON public.bdef_secteurs USING btree (groupe_id);


--
-- Name: idx_bdef_valeurs_indic_annee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bdef_valeurs_indic_annee ON public.bdef_valeurs USING btree (indicateur_id, annee);


--
-- Name: idx_bdef_valeurs_rejetees_import; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bdef_valeurs_rejetees_import ON public.bdef_valeurs_rejetees USING btree (import_id);


--
-- Name: idx_bdef_valeurs_rejetees_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bdef_valeurs_rejetees_statut ON public.bdef_valeurs_rejetees USING btree (statut);


--
-- Name: idx_bdef_valeurs_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bdef_valeurs_uniq ON public.bdef_valeurs USING btree (indicateur_id, niveau, COALESCE(macro_secteur_id, 0), COALESCE(groupe_id, 0), COALESCE(secteur_id, 0), annee);


--
-- Name: idx_branches_secteur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_branches_secteur ON public.ref_branches USING btree (secteur_id);


--
-- Name: idx_citi_naema_citi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citi_naema_citi ON public.citi_naema_correspondances USING btree (citi_classe_id);


--
-- Name: idx_citi_naema_naema; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citi_naema_naema ON public.citi_naema_correspondances USING btree (naema_activite_id);


--
-- Name: idx_code_articles_chapitre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_code_articles_chapitre ON public.code_articles USING btree (chapitre_id);


--
-- Name: idx_code_articles_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_code_articles_fts ON public.code_articles USING gin (to_tsvector('french'::regconfig, (((COALESCE(titre, ''::character varying))::text || ' '::text) || contenu)));


--
-- Name: idx_code_articles_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_code_articles_numero ON public.code_articles USING btree (numero);


--
-- Name: idx_code_articles_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_code_articles_section ON public.code_articles USING btree (section_id);


--
-- Name: idx_code_sections_chapitre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_code_sections_chapitre ON public.code_sections USING btree (chapitre_id);


--
-- Name: idx_corresp_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_corresp_item ON public.ref_correspondances_naema USING btree (classification_item_id);


--
-- Name: idx_corresp_naema; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_corresp_naema ON public.ref_correspondances_naema USING btree (naema_type, naema_id);


--
-- Name: idx_dep_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dep_region ON public.ref_departements USING btree (region_id);


--
-- Name: idx_entreprises_pays; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entreprises_pays ON public.entreprises_installees USING btree (pays);


--
-- Name: idx_evenement_fichiers_evenement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evenement_fichiers_evenement ON public.evenement_fichiers USING btree (evenement_id);


--
-- Name: idx_evenements_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evenements_date ON public.evenements USING btree (date_debut);


--
-- Name: idx_evenements_publie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evenements_publie ON public.evenements USING btree (est_publie);


--
-- Name: idx_icm_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icm_code ON public.ide_cnuced_monde USING btree (code);


--
-- Name: idx_icm_code_annee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icm_code_annee ON public.ide_cnuced_monde USING btree (code, annee);


--
-- Name: idx_ics_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ics_lookup ON public.ide_cnuced_secteurs USING btree (secteur_id, indicateur, direction, annee);


--
-- Name: idx_ide_annee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ide_annee ON public.ide_flux USING btree (annee);


--
-- Name: idx_ide_cnuced_ref_pays; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ide_cnuced_ref_pays ON public.ide_cnuced USING btree (ref_pays_id);


--
-- Name: idx_ide_dir_ind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ide_dir_ind ON public.ide_cnuced USING btree (direction, indicateur);


--
-- Name: idx_ide_pays; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ide_pays ON public.ide_cnuced USING btree (pays);


--
-- Name: idx_ide_pays_origine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ide_pays_origine ON public.ide_flux USING btree (pays_origine_id);


--
-- Name: idx_ide_secteur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ide_secteur ON public.ide_flux USING btree (secteur_id);


--
-- Name: idx_ide_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ide_type ON public.ide_flux USING btree (type_flux);


--
-- Name: idx_intentions_pays; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intentions_pays ON public.intentions_investissement USING btree (investisseur_pays_id);


--
-- Name: idx_intentions_secteur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intentions_secteur ON public.intentions_investissement USING btree (secteur_id);


--
-- Name: idx_intentions_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intentions_statut ON public.intentions_investissement USING btree (statut_id);


--
-- Name: idx_items_classif; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_classif ON public.ref_classification_items USING btree (classification_id, niveau);


--
-- Name: idx_nace_naema_nace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nace_naema_nace ON public.nace_naema_correspondances USING btree (nace_classe_id);


--
-- Name: idx_nace_naema_naema; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nace_naema_naema ON public.nace_naema_correspondances USING btree (naema_activite_id);


--
-- Name: idx_opportunites_geo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunites_geo ON public.opportunites_investissement USING gist (localisation_geo);


--
-- Name: idx_opportunites_secteur; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunites_secteur ON public.opportunites_investissement USING btree (secteur_id);


--
-- Name: idx_opportunites_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opportunites_statut ON public.opportunites_investissement USING btree (statut);


--
-- Name: idx_pays_grp_grp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pays_grp_grp ON public.ref_pays_groupements USING btree (groupement_id);


--
-- Name: idx_pays_grp_pays; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pays_grp_pays ON public.ref_pays_groupements USING btree (pays_id);


--
-- Name: idx_pole_fichiers_pole; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pole_fichiers_pole ON public.pole_fichiers USING btree (pole_id);


--
-- Name: idx_potentialites_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_potentialites_dept ON public.potentialites USING btree (departement_id) WHERE (departement_id IS NOT NULL);


--
-- Name: idx_potentialites_pole; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_potentialites_pole ON public.potentialites USING btree (pole_id) WHERE (pole_id IS NOT NULL);


--
-- Name: idx_potentialites_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_potentialites_region ON public.potentialites USING btree (region_id) WHERE (region_id IS NOT NULL);


--
-- Name: idx_projets_points_focaux_projet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projets_points_focaux_projet_id ON public.projets_points_focaux USING btree (projet_id);


--
-- Name: idx_prospect_contacts_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_contacts_prospect ON public.prospect_contacts USING btree (prospect_id);


--
-- Name: idx_prospect_contraintes_cycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_contraintes_cycle ON public.prospect_contraintes USING btree (prospect_id, cycle_num);


--
-- Name: idx_prospect_contraintes_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_contraintes_prospect ON public.prospect_contraintes USING btree (prospect_id);


--
-- Name: idx_prospect_cycles_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_cycles_prospect ON public.prospect_cycles USING btree (prospect_id, cycle_num);


--
-- Name: idx_prospect_echange_fichiers_echange; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_echange_fichiers_echange ON public.prospect_echange_fichiers USING btree (echange_id);


--
-- Name: idx_prospect_echanges_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_echanges_date ON public.prospect_echanges USING btree (prospect_id, date_echange);


--
-- Name: idx_prospect_echanges_point_focal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_echanges_point_focal ON public.prospect_echanges USING btree (point_focal_id);


--
-- Name: idx_prospect_echanges_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_echanges_prospect ON public.prospect_echanges USING btree (prospect_id);


--
-- Name: idx_prospect_points_focaux_pid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_points_focaux_pid ON public.prospect_points_focaux USING btree (prospect_id);


--
-- Name: idx_prospects_nom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_nom ON public.prospects USING btree (nom);


--
-- Name: idx_stat_pays_ind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stat_pays_ind ON public.stat_pays USING btree (indicateur);


--
-- Name: idx_tx_annee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tx_annee ON public.stat_transactions USING btree (annee);


--
-- Name: idx_tx_exp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tx_exp ON public.stat_transactions USING btree (exportateur_id, annee);


--
-- Name: idx_tx_imp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tx_imp ON public.stat_transactions USING btree (importateur_id, annee);


--
-- Name: idx_tx_res; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tx_res ON public.stat_transactions USING btree (ressource);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (lower(email));


--
-- Name: idx_zone_entreprises_ent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zone_entreprises_ent ON public.zone_entreprises USING btree (entreprise_id);


--
-- Name: idx_zone_entreprises_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zone_entreprises_zone ON public.zone_entreprises USING btree (zone_id);


--
-- Name: idx_zone_fichiers_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zone_fichiers_zone_id ON public.zone_fichiers USING btree (zone_id);


--
-- Name: uniq_prospect_contacts_type_val; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_prospect_contacts_type_val ON public.prospect_contacts USING btree (type, valeur_normalisee);


--
-- Name: uq_ide_cnuced_secteurs_serie; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ide_cnuced_secteurs_serie ON public.ide_cnuced_secteurs USING btree (secteur_id, annee, direction, indicateur);


--
-- Name: uq_ide_cnuced_serie; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ide_cnuced_serie ON public.ide_cnuced USING btree (ref_pays_id, annee, direction, indicateur) WHERE (ref_pays_id IS NOT NULL);


--
-- Name: accords_traites trg_accords_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_accords_updated_at BEFORE UPDATE ON public.accords_traites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: entreprises_installees trg_assign_pole; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_pole BEFORE INSERT OR UPDATE OF region_id ON public.entreprises_installees FOR EACH ROW EXECUTE FUNCTION public.assign_pole_from_region();


--
-- Name: entreprises_installees trg_entreprises_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_entreprises_updated_at BEFORE UPDATE ON public.entreprises_installees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: evenements trg_evenements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_evenements_updated_at BEFORE UPDATE ON public.evenements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projet_phases trg_fermer_phase; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fermer_phase BEFORE INSERT ON public.projet_phases FOR EACH ROW EXECUTE FUNCTION public.fermer_phase_precedente();


--
-- Name: ide_flux trg_ide_flux_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ide_flux_updated_at BEFORE UPDATE ON public.ide_flux FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: intentions_investissement trg_intentions_investissement_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_intentions_investissement_updated_at BEFORE UPDATE ON public.intentions_investissement FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: opportunites_investissement trg_opportunites_investissement_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_opportunites_investissement_updated_at BEFORE UPDATE ON public.opportunites_investissement FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profils_investisseurs trg_profils_investisseurs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profils_investisseurs_updated_at BEFORE UPDATE ON public.profils_investisseurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projets trg_projets_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_projets_updated BEFORE UPDATE ON public.projets FOR EACH ROW EXECUTE FUNCTION public.update_projets_updated_at();


--
-- Name: accords_traites trg_reset_seq_accords; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reset_seq_accords AFTER DELETE ON public.accords_traites FOR EACH STATEMENT EXECUTE FUNCTION public.auto_reset_seq();


--
-- Name: entreprises_installees trg_reset_seq_entreprises; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reset_seq_entreprises AFTER DELETE ON public.entreprises_installees FOR EACH STATEMENT EXECUTE FUNCTION public.auto_reset_seq();


--
-- Name: evenements trg_reset_seq_evenements; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reset_seq_evenements AFTER DELETE ON public.evenements FOR EACH STATEMENT EXECUTE FUNCTION public.auto_reset_seq();


--
-- Name: projet_phases trg_reset_seq_phases; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reset_seq_phases AFTER DELETE ON public.projet_phases FOR EACH STATEMENT EXECUTE FUNCTION public.reset_seq_if_empty();


--
-- Name: projets trg_reset_seq_projets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reset_seq_projets AFTER DELETE ON public.projets FOR EACH STATEMENT EXECUTE FUNCTION public.reset_seq_if_empty();


--
-- Name: ref_groupements trg_sync_icm_on_groupement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_icm_on_groupement AFTER INSERT OR DELETE OR UPDATE ON public.ref_groupements FOR EACH ROW EXECUTE FUNCTION public.sync_icm_on_groupement();


--
-- Name: ref_pays trg_sync_on_pays; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_on_pays AFTER INSERT OR UPDATE ON public.ref_pays FOR EACH ROW EXECUTE FUNCTION public.sync_on_pays_change();


--
-- Name: ref_pays_groupements trg_sync_pays_ids; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_pays_ids AFTER INSERT OR DELETE OR UPDATE ON public.ref_pays_groupements FOR EACH ROW EXECUTE FUNCTION public.sync_groupement_pays_ids();


--
-- Name: utilisateurs trg_utilisateurs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_utilisateurs_updated_at BEFORE UPDATE ON public.utilisateurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: accord_fichiers accord_fichiers_accord_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accord_fichiers
    ADD CONSTRAINT accord_fichiers_accord_id_fkey FOREIGN KEY (accord_id) REFERENCES public.accords_traites(id) ON DELETE CASCADE;


--
-- Name: avantages_incitations_fichiers avantages_incitations_fichiers_avantage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avantages_incitations_fichiers
    ADD CONSTRAINT avantages_incitations_fichiers_avantage_id_fkey FOREIGN KEY (avantage_id) REFERENCES public.avantages_incitations(id) ON DELETE CASCADE;


--
-- Name: avantages_incitations_selections avantages_incitations_selections_avantage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avantages_incitations_selections
    ADD CONSTRAINT avantages_incitations_selections_avantage_id_fkey FOREIGN KEY (avantage_id) REFERENCES public.avantages_incitations(id) ON DELETE CASCADE;


--
-- Name: avantages_incitations_selections avantages_incitations_selections_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avantages_incitations_selections
    ADD CONSTRAINT avantages_incitations_selections_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.ref_avantages_types(id) ON DELETE CASCADE;


--
-- Name: bdef_groupes bdef_groupes_macro_secteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_groupes
    ADD CONSTRAINT bdef_groupes_macro_secteur_id_fkey FOREIGN KEY (macro_secteur_id) REFERENCES public.bdef_macro_secteurs(id) ON DELETE CASCADE;


--
-- Name: bdef_import_revue bdef_import_revue_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_import_revue
    ADD CONSTRAINT bdef_import_revue_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.bdef_imports(id) ON DELETE CASCADE;


--
-- Name: bdef_indicateurs bdef_indicateurs_categorie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_indicateurs
    ADD CONSTRAINT bdef_indicateurs_categorie_id_fkey FOREIGN KEY (categorie_id) REFERENCES public.bdef_indicateur_categories(id) ON DELETE RESTRICT;


--
-- Name: bdef_secteurs bdef_secteurs_groupe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_secteurs
    ADD CONSTRAINT bdef_secteurs_groupe_id_fkey FOREIGN KEY (groupe_id) REFERENCES public.bdef_groupes(id) ON DELETE CASCADE;


--
-- Name: bdef_valeurs bdef_valeurs_groupe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs
    ADD CONSTRAINT bdef_valeurs_groupe_id_fkey FOREIGN KEY (groupe_id) REFERENCES public.bdef_groupes(id) ON DELETE CASCADE;


--
-- Name: bdef_valeurs bdef_valeurs_indicateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs
    ADD CONSTRAINT bdef_valeurs_indicateur_id_fkey FOREIGN KEY (indicateur_id) REFERENCES public.bdef_indicateurs(id) ON DELETE CASCADE;


--
-- Name: bdef_valeurs bdef_valeurs_macro_secteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs
    ADD CONSTRAINT bdef_valeurs_macro_secteur_id_fkey FOREIGN KEY (macro_secteur_id) REFERENCES public.bdef_macro_secteurs(id) ON DELETE CASCADE;


--
-- Name: bdef_valeurs_rejetees bdef_valeurs_rejetees_groupe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs_rejetees
    ADD CONSTRAINT bdef_valeurs_rejetees_groupe_id_fkey FOREIGN KEY (groupe_id) REFERENCES public.bdef_groupes(id);


--
-- Name: bdef_valeurs_rejetees bdef_valeurs_rejetees_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs_rejetees
    ADD CONSTRAINT bdef_valeurs_rejetees_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.bdef_imports(id) ON DELETE SET NULL;


--
-- Name: bdef_valeurs_rejetees bdef_valeurs_rejetees_indicateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs_rejetees
    ADD CONSTRAINT bdef_valeurs_rejetees_indicateur_id_fkey FOREIGN KEY (indicateur_id) REFERENCES public.bdef_indicateurs(id);


--
-- Name: bdef_valeurs_rejetees bdef_valeurs_rejetees_macro_secteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs_rejetees
    ADD CONSTRAINT bdef_valeurs_rejetees_macro_secteur_id_fkey FOREIGN KEY (macro_secteur_id) REFERENCES public.bdef_macro_secteurs(id);


--
-- Name: bdef_valeurs_rejetees bdef_valeurs_rejetees_secteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs_rejetees
    ADD CONSTRAINT bdef_valeurs_rejetees_secteur_id_fkey FOREIGN KEY (secteur_id) REFERENCES public.bdef_secteurs(id);


--
-- Name: bdef_valeurs bdef_valeurs_secteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bdef_valeurs
    ADD CONSTRAINT bdef_valeurs_secteur_id_fkey FOREIGN KEY (secteur_id) REFERENCES public.bdef_secteurs(id) ON DELETE CASCADE;


--
-- Name: citi_classes citi_classes_groupe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_classes
    ADD CONSTRAINT citi_classes_groupe_id_fkey FOREIGN KEY (groupe_id) REFERENCES public.citi_groupes(id) ON DELETE CASCADE;


--
-- Name: citi_divisions citi_divisions_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_divisions
    ADD CONSTRAINT citi_divisions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.citi_sections(id) ON DELETE CASCADE;


--
-- Name: citi_groupes citi_groupes_division_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_groupes
    ADD CONSTRAINT citi_groupes_division_id_fkey FOREIGN KEY (division_id) REFERENCES public.citi_divisions(id) ON DELETE CASCADE;


--
-- Name: citi_naema_correspondances citi_naema_correspondances_citi_classe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_naema_correspondances
    ADD CONSTRAINT citi_naema_correspondances_citi_classe_id_fkey FOREIGN KEY (citi_classe_id) REFERENCES public.citi_classes(id) ON DELETE CASCADE;


--
-- Name: citi_naema_correspondances citi_naema_correspondances_naema_activite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citi_naema_correspondances
    ADD CONSTRAINT citi_naema_correspondances_naema_activite_id_fkey FOREIGN KEY (naema_activite_id) REFERENCES public.ref_activites(id) ON DELETE CASCADE;


--
-- Name: code_articles code_articles_chapitre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_articles
    ADD CONSTRAINT code_articles_chapitre_id_fkey FOREIGN KEY (chapitre_id) REFERENCES public.code_chapitres(id) ON DELETE CASCADE;


--
-- Name: code_articles code_articles_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_articles
    ADD CONSTRAINT code_articles_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.code_sections(id) ON DELETE SET NULL;


--
-- Name: code_sections code_sections_chapitre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_sections
    ADD CONSTRAINT code_sections_chapitre_id_fkey FOREIGN KEY (chapitre_id) REFERENCES public.code_chapitres(id) ON DELETE CASCADE;


--
-- Name: entreprises_hors_senegal entreprises_hors_senegal_activite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_hors_senegal
    ADD CONSTRAINT entreprises_hors_senegal_activite_id_fkey FOREIGN KEY (activite_id) REFERENCES public.ref_activites(id);


--
-- Name: entreprises_hors_senegal entreprises_hors_senegal_branche_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_hors_senegal
    ADD CONSTRAINT entreprises_hors_senegal_branche_id_fkey FOREIGN KEY (branche_id) REFERENCES public.ref_branches(id);


--
-- Name: entreprises_hors_senegal entreprises_hors_senegal_secteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_hors_senegal
    ADD CONSTRAINT entreprises_hors_senegal_secteur_id_fkey FOREIGN KEY (secteur_id) REFERENCES public.ref_secteurs(id);


--
-- Name: entreprises_hors_senegal entreprises_hors_senegal_siege_pays_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_hors_senegal
    ADD CONSTRAINT entreprises_hors_senegal_siege_pays_id_fkey FOREIGN KEY (siege_pays_id) REFERENCES public.ref_pays(id);


--
-- Name: entreprises_installees entreprises_installees_arrondissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_installees
    ADD CONSTRAINT entreprises_installees_arrondissement_id_fkey FOREIGN KEY (arrondissement_id) REFERENCES public.ref_arrondissements(id);


--
-- Name: entreprises_installees entreprises_installees_departement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_installees
    ADD CONSTRAINT entreprises_installees_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES public.ref_departements(id);


--
-- Name: entreprises_installees entreprises_installees_pole_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_installees
    ADD CONSTRAINT entreprises_installees_pole_id_fkey FOREIGN KEY (pole_id) REFERENCES public.poles_territoires(id);


--
-- Name: entreprises_installees entreprises_installees_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_installees
    ADD CONSTRAINT entreprises_installees_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.ref_regions(id);


--
-- Name: entreprises_installees entreprises_installees_siege_pays_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_installees
    ADD CONSTRAINT entreprises_installees_siege_pays_id_fkey FOREIGN KEY (siege_pays_id) REFERENCES public.ref_pays(id);


--
-- Name: entreprises_points_focaux entreprises_points_focaux_entreprise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entreprises_points_focaux
    ADD CONSTRAINT entreprises_points_focaux_entreprise_id_fkey FOREIGN KEY (entreprise_id) REFERENCES public.entreprises_installees(id) ON DELETE CASCADE;


--
-- Name: evenement_fichiers evenement_fichiers_evenement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evenement_fichiers
    ADD CONSTRAINT evenement_fichiers_evenement_id_fkey FOREIGN KEY (evenement_id) REFERENCES public.evenements(id) ON DELETE CASCADE;


--
-- Name: evenements evenements_pays_hote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evenements
    ADD CONSTRAINT evenements_pays_hote_id_fkey FOREIGN KEY (pays_hote_id) REFERENCES public.ref_pays(id);


--
-- Name: ide_cnuced ide_cnuced_ref_pays_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_cnuced
    ADD CONSTRAINT ide_cnuced_ref_pays_id_fkey FOREIGN KEY (ref_pays_id) REFERENCES public.ref_pays(id);


--
-- Name: ide_cnuced_secteurs ide_cnuced_secteurs_secteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_cnuced_secteurs
    ADD CONSTRAINT ide_cnuced_secteurs_secteur_id_fkey FOREIGN KEY (secteur_id) REFERENCES public.ide_secteurs(id) ON DELETE CASCADE;


--
-- Name: ide_flux ide_flux_devise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_flux
    ADD CONSTRAINT ide_flux_devise_id_fkey FOREIGN KEY (devise_id) REFERENCES public.ref_devises(id);


--
-- Name: ide_flux ide_flux_pays_destination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_flux
    ADD CONSTRAINT ide_flux_pays_destination_id_fkey FOREIGN KEY (pays_destination_id) REFERENCES public.ref_pays(id);


--
-- Name: ide_flux ide_flux_pays_origine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_flux
    ADD CONSTRAINT ide_flux_pays_origine_id_fkey FOREIGN KEY (pays_origine_id) REFERENCES public.ref_pays(id);


--
-- Name: ide_flux ide_flux_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_flux
    ADD CONSTRAINT ide_flux_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.ref_sources(id);


--
-- Name: ide_flux ide_flux_statut_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_flux
    ADD CONSTRAINT ide_flux_statut_id_fkey FOREIGN KEY (statut_id) REFERENCES public.ref_statuts(id);


--
-- Name: ide_secteurs ide_secteurs_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ide_secteurs
    ADD CONSTRAINT ide_secteurs_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.ide_secteurs(id) ON DELETE CASCADE;


--
-- Name: intentions_interactions intentions_interactions_intention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intentions_interactions
    ADD CONSTRAINT intentions_interactions_intention_id_fkey FOREIGN KEY (intention_id) REFERENCES public.intentions_investissement(id) ON DELETE CASCADE;


--
-- Name: intentions_investissement intentions_investissement_devise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intentions_investissement
    ADD CONSTRAINT intentions_investissement_devise_id_fkey FOREIGN KEY (devise_id) REFERENCES public.ref_devises(id);


--
-- Name: intentions_investissement intentions_investissement_investisseur_pays_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intentions_investissement
    ADD CONSTRAINT intentions_investissement_investisseur_pays_id_fkey FOREIGN KEY (investisseur_pays_id) REFERENCES public.ref_pays(id);


--
-- Name: intentions_investissement intentions_investissement_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intentions_investissement
    ADD CONSTRAINT intentions_investissement_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.ref_sources(id);


--
-- Name: intentions_investissement intentions_investissement_statut_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intentions_investissement
    ADD CONSTRAINT intentions_investissement_statut_id_fkey FOREIGN KEY (statut_id) REFERENCES public.ref_statuts(id);


--
-- Name: modalites_articles modalites_articles_chapitre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modalites_articles
    ADD CONSTRAINT modalites_articles_chapitre_id_fkey FOREIGN KEY (chapitre_id) REFERENCES public.modalites_chapitres(id) ON DELETE CASCADE;


--
-- Name: modalites_articles modalites_articles_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modalites_articles
    ADD CONSTRAINT modalites_articles_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.modalites_sections(id) ON DELETE SET NULL;


--
-- Name: modalites_sections modalites_sections_chapitre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modalites_sections
    ADD CONSTRAINT modalites_sections_chapitre_id_fkey FOREIGN KEY (chapitre_id) REFERENCES public.modalites_chapitres(id) ON DELETE CASCADE;


--
-- Name: nace_classes nace_classes_groupe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_classes
    ADD CONSTRAINT nace_classes_groupe_id_fkey FOREIGN KEY (groupe_id) REFERENCES public.nace_groupes(id) ON DELETE CASCADE;


--
-- Name: nace_divisions nace_divisions_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_divisions
    ADD CONSTRAINT nace_divisions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.nace_sections(id) ON DELETE CASCADE;


--
-- Name: nace_groupes nace_groupes_division_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_groupes
    ADD CONSTRAINT nace_groupes_division_id_fkey FOREIGN KEY (division_id) REFERENCES public.nace_divisions(id) ON DELETE CASCADE;


--
-- Name: nace_naema_correspondances nace_naema_correspondances_nace_classe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_naema_correspondances
    ADD CONSTRAINT nace_naema_correspondances_nace_classe_id_fkey FOREIGN KEY (nace_classe_id) REFERENCES public.nace_classes(id) ON DELETE CASCADE;


--
-- Name: nace_naema_correspondances nace_naema_correspondances_naema_activite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nace_naema_correspondances
    ADD CONSTRAINT nace_naema_correspondances_naema_activite_id_fkey FOREIGN KEY (naema_activite_id) REFERENCES public.ref_activites(id) ON DELETE CASCADE;


--
-- Name: opportunites_investissement opportunites_investissement_devise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunites_investissement
    ADD CONSTRAINT opportunites_investissement_devise_id_fkey FOREIGN KEY (devise_id) REFERENCES public.ref_devises(id);


--
-- Name: opportunites_investissement opportunites_investissement_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunites_investissement
    ADD CONSTRAINT opportunites_investissement_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.ref_sources(id);


--
-- Name: pole_fichiers pole_fichiers_pole_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pole_fichiers
    ADD CONSTRAINT pole_fichiers_pole_id_fkey FOREIGN KEY (pole_id) REFERENCES public.poles_territoires(id) ON DELETE CASCADE;


--
-- Name: potentialites potentialites_arrondissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potentialites
    ADD CONSTRAINT potentialites_arrondissement_id_fkey FOREIGN KEY (arrondissement_id) REFERENCES public.ref_arrondissements(id);


--
-- Name: potentialites potentialites_departement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potentialites
    ADD CONSTRAINT potentialites_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES public.ref_departements(id);


--
-- Name: potentialites_fichiers potentialites_fichiers_potentialite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potentialites_fichiers
    ADD CONSTRAINT potentialites_fichiers_potentialite_id_fkey FOREIGN KEY (potentialite_id) REFERENCES public.potentialites(id) ON DELETE CASCADE;


--
-- Name: potentialites potentialites_pole_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potentialites
    ADD CONSTRAINT potentialites_pole_id_fkey FOREIGN KEY (pole_id) REFERENCES public.poles_territoires(id);


--
-- Name: potentialites potentialites_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.potentialites
    ADD CONSTRAINT potentialites_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.ref_regions(id);


--
-- Name: profils_investisseurs profils_investisseurs_devise_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils_investisseurs
    ADD CONSTRAINT profils_investisseurs_devise_budget_id_fkey FOREIGN KEY (devise_budget_id) REFERENCES public.ref_devises(id);


--
-- Name: profils_investisseurs profils_investisseurs_pays_origine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils_investisseurs
    ADD CONSTRAINT profils_investisseurs_pays_origine_id_fkey FOREIGN KEY (pays_origine_id) REFERENCES public.ref_pays(id);


--
-- Name: profils_investisseurs profils_investisseurs_utilisateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils_investisseurs
    ADD CONSTRAINT profils_investisseurs_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: projet_fichiers projet_fichiers_projet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projet_fichiers
    ADD CONSTRAINT projet_fichiers_projet_id_fkey FOREIGN KEY (projet_id) REFERENCES public.projets(id) ON DELETE CASCADE;


--
-- Name: porteurs_projets projet_moa_projet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.porteurs_projets
    ADD CONSTRAINT projet_moa_projet_id_fkey FOREIGN KEY (projet_id) REFERENCES public.projets(id) ON DELETE CASCADE;


--
-- Name: projet_phases projet_phases_projet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projet_phases
    ADD CONSTRAINT projet_phases_projet_id_fkey FOREIGN KEY (projet_id) REFERENCES public.projets(id) ON DELETE CASCADE;


--
-- Name: projets projets_arrondissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets
    ADD CONSTRAINT projets_arrondissement_id_fkey FOREIGN KEY (arrondissement_id) REFERENCES public.ref_arrondissements(id);


--
-- Name: projets projets_departement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets
    ADD CONSTRAINT projets_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES public.ref_departements(id);


--
-- Name: projets projets_devise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets
    ADD CONSTRAINT projets_devise_id_fkey FOREIGN KEY (devise_id) REFERENCES public.ref_devises(id);


--
-- Name: projets_points_focaux projets_points_focaux_projet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets_points_focaux
    ADD CONSTRAINT projets_points_focaux_projet_id_fkey FOREIGN KEY (projet_id) REFERENCES public.projets(id) ON DELETE CASCADE;


--
-- Name: projets projets_pole_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets
    ADD CONSTRAINT projets_pole_id_fkey FOREIGN KEY (pole_id) REFERENCES public.poles_territoires(id);


--
-- Name: projets projets_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projets
    ADD CONSTRAINT projets_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.ref_regions(id);


--
-- Name: prospect_contacts prospect_contacts_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_contacts
    ADD CONSTRAINT prospect_contacts_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;


--
-- Name: prospect_contraintes prospect_contraintes_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_contraintes
    ADD CONSTRAINT prospect_contraintes_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;


--
-- Name: prospect_cycles prospect_cycles_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_cycles
    ADD CONSTRAINT prospect_cycles_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;


--
-- Name: prospect_echange_fichiers prospect_echange_fichiers_echange_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_echange_fichiers
    ADD CONSTRAINT prospect_echange_fichiers_echange_id_fkey FOREIGN KEY (echange_id) REFERENCES public.prospect_echanges(id) ON DELETE CASCADE;


--
-- Name: prospect_echanges prospect_echanges_point_focal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_echanges
    ADD CONSTRAINT prospect_echanges_point_focal_id_fkey FOREIGN KEY (point_focal_id) REFERENCES public.prospect_points_focaux(id) ON DELETE SET NULL;


--
-- Name: prospect_echanges prospect_echanges_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_echanges
    ADD CONSTRAINT prospect_echanges_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;


--
-- Name: prospect_points_focaux prospect_points_focaux_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_points_focaux
    ADD CONSTRAINT prospect_points_focaux_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;


--
-- Name: prospects prospects_objet_projet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_objet_projet_id_fkey FOREIGN KEY (objet_projet_id) REFERENCES public.projets(id) ON DELETE SET NULL;


--
-- Name: prospects prospects_siege_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_siege_id_fkey FOREIGN KEY (siege_id) REFERENCES public.ref_pays(id);


--
-- Name: ref_activites ref_activites_branche_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_activites
    ADD CONSTRAINT ref_activites_branche_id_fkey FOREIGN KEY (branche_id) REFERENCES public.ref_branches(id);


--
-- Name: ref_arrondissements ref_arrondissements_departement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_arrondissements
    ADD CONSTRAINT ref_arrondissements_departement_id_fkey FOREIGN KEY (departement_id) REFERENCES public.ref_departements(id) ON DELETE CASCADE;


--
-- Name: ref_branches ref_branches_secteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_branches
    ADD CONSTRAINT ref_branches_secteur_id_fkey FOREIGN KEY (secteur_id) REFERENCES public.ref_secteurs(id);


--
-- Name: ref_classification_items ref_classification_items_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_classification_items
    ADD CONSTRAINT ref_classification_items_classification_id_fkey FOREIGN KEY (classification_id) REFERENCES public.ref_classifications(id) ON DELETE CASCADE;


--
-- Name: ref_classification_items ref_classification_items_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_classification_items
    ADD CONSTRAINT ref_classification_items_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.ref_classification_items(id);


--
-- Name: ref_correspondances_naema ref_correspondances_naema_classification_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_correspondances_naema
    ADD CONSTRAINT ref_correspondances_naema_classification_item_id_fkey FOREIGN KEY (classification_item_id) REFERENCES public.ref_classification_items(id) ON DELETE CASCADE;


--
-- Name: ref_departements ref_departements_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_departements
    ADD CONSTRAINT ref_departements_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.ref_regions(id) ON DELETE CASCADE;


--
-- Name: ref_pays_groupements ref_pays_groupements_groupement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_pays_groupements
    ADD CONSTRAINT ref_pays_groupements_groupement_id_fkey FOREIGN KEY (groupement_id) REFERENCES public.ref_groupements(id) ON DELETE CASCADE;


--
-- Name: ref_pays_groupements ref_pays_groupements_pays_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_pays_groupements
    ADD CONSTRAINT ref_pays_groupements_pays_id_fkey FOREIGN KEY (pays_id) REFERENCES public.ref_pays(id) ON DELETE CASCADE;


--
-- Name: stat_pays stat_pays_pays_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stat_pays
    ADD CONSTRAINT stat_pays_pays_id_fkey FOREIGN KEY (pays_id) REFERENCES public.ref_pays(id) ON DELETE CASCADE;


--
-- Name: stat_transactions stat_transactions_exportateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stat_transactions
    ADD CONSTRAINT stat_transactions_exportateur_id_fkey FOREIGN KEY (exportateur_id) REFERENCES public.ref_pays(id) ON DELETE CASCADE;


--
-- Name: stat_transactions stat_transactions_importateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stat_transactions
    ADD CONSTRAINT stat_transactions_importateur_id_fkey FOREIGN KEY (importateur_id) REFERENCES public.ref_pays(id) ON DELETE CASCADE;


--
-- Name: utilisateurs utilisateurs_pays_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_pays_id_fkey FOREIGN KEY (pays_id) REFERENCES public.ref_pays(id);


--
-- Name: zone_entreprises zone_entreprises_entreprise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_entreprises
    ADD CONSTRAINT zone_entreprises_entreprise_id_fkey FOREIGN KEY (entreprise_id) REFERENCES public.entreprises_installees(id) ON DELETE CASCADE;


--
-- Name: zone_entreprises zone_entreprises_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_entreprises
    ADD CONSTRAINT zone_entreprises_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- Name: zone_fichiers zone_fichiers_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zone_fichiers
    ADD CONSTRAINT zone_fichiers_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- Name: zones zones_pole_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pole_id_fkey FOREIGN KEY (pole_id) REFERENCES public.poles_territoires(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

