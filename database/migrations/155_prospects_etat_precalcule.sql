-- =============================================================================
-- Migration 155 — Ce que le statut d'un prospect demande, précalculé
--
-- POURQUOI. La page Prospects montre sur chaque carte un statut (En cours,
-- En attente, Inactif, À recontacter…) qui dépend de son dernier échange —
-- dans le cycle courant s'il y a eu un re-contact. La route des cartes le
-- recalculait à chaque page en agrégeant tous les échanges et tous les cycles
-- (120 000 échanges sur le banc de mesure) : 50 à 80 ms par page de cartes,
-- et autant pour les compteurs des onglets — plus d'un tiers du temps serveur
-- d'une page vue (perf/RESULTATS-2026-11-07-cache.md).
--
-- CE QUE FAIT 155. Quatre colonnes sur prospects, tenues à jour par la base
-- elle-même à chaque écriture d'un échange ou d'un cycle (déclencheurs) :
--   · a_des_echanges : au moins un échange — l'onglet « en contact » ;
--   · dernier_echange : la date du dernier échange ;
--   · debut_cycle : la date du dernier re-contact, s'il y en a eu un ;
--   · dernier_echange_cycle : le dernier échange depuis ce re-contact (le
--     dernier échange tout court sans re-contact).
-- Le statut dépend aussi de la date du jour : il reste calculé à la lecture,
-- mais sur ces colonnes, sans parcourir les échanges. Les déclencheurs
-- travaillent par instruction : un import de mille échanges recalcule une
-- fois chaque prospect concerné. Deux index servent la page : ses cartes
-- dans leur ordre, ses compteurs lus dans l'index seul.
-- =============================================================================

ALTER TABLE prospects
    ADD COLUMN IF NOT EXISTS a_des_echanges        boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS dernier_echange       date,
    ADD COLUMN IF NOT EXISTS debut_cycle           date,
    ADD COLUMN IF NOT EXISTS dernier_echange_cycle date;

-- Les cartes, dans l'ordre de la page (les plus récentes d'abord) : une page
-- se lit sans trier toute la table — 0,5 ms au lieu de 29 sur le banc, où la
-- table des prospects pèse 37 Mo
CREATE INDEX IF NOT EXISTS idx_prospects_cartes
    ON prospects (created_at DESC NULLS LAST, id DESC) WHERE is_deleted = false;
-- Les compteurs des onglets et des statuts, les pays et secteurs des filtres :
-- lus dans l'index seul, sans ouvrir les fiches (1 à 2 ms au lieu de 25)
CREATE INDEX IF NOT EXISTS idx_prospects_onglets
    ON prospects (issue, a_des_echanges)
    INCLUDE (debut_cycle, dernier_echange_cycle, siege_id, secteur_ids) WHERE is_deleted = false;

-- Le recalcul, pour une liste de prospects. Il n'écrit que ce qui change.
-- D'abord le verrou des prospects concernés : deux agents qui écrivent au même
-- moment sur un même prospect se succèdent, et le second, qui recalcule après
-- la validation du premier, voit son échange (chaque requête de la fonction
-- lit l'état validé à son début). Sans lui, chacun calculait sans l'échange de
-- l'autre, et le dernier à écrire pouvait effacer une date plus récente. Le
-- verrou n'empêche pas d'ajouter des échanges en parallèle (NO KEY UPDATE).
CREATE OR REPLACE FUNCTION prospects_recalculer_etat(ids integer[]) RETURNS void
LANGUAGE sql AS $$
    SELECT 1 FROM prospects WHERE id = ANY(ids) ORDER BY id FOR NO KEY UPDATE;
    UPDATE prospects p
       SET a_des_echanges        = s.a_des_echanges,
           dernier_echange       = s.dernier,
           debut_cycle           = s.debut,
           dernier_echange_cycle = s.dernier_cycle
      FROM (
        SELECT i.id,
               e.dernier IS NOT NULL AS a_des_echanges,   -- date_echange n'est jamais vide
               e.dernier,
               c.debut,
               CASE WHEN c.debut IS NULL THEN e.dernier
                    ELSE (SELECT max(x.date_echange) FROM prospect_echanges x
                           WHERE x.prospect_id = i.id AND x.date_echange >= c.debut)
               END AS dernier_cycle
          FROM (SELECT DISTINCT unnest(ids) AS id) i
          LEFT JOIN LATERAL (SELECT max(date_echange) AS dernier
                               FROM prospect_echanges WHERE prospect_id = i.id) e ON true
          LEFT JOIN LATERAL (SELECT max(recontacte_le)::date AS debut
                               FROM prospect_cycles WHERE prospect_id = i.id) c ON true
      ) s
     WHERE p.id = s.id
       AND (p.a_des_echanges, p.dernier_echange, p.debut_cycle, p.dernier_echange_cycle)
           IS DISTINCT FROM (s.a_des_echanges, s.dernier, s.debut, s.dernier_cycle);
$$;

-- Les déclencheurs : les prospects touchés par l'instruction (lignes
-- ajoutées, modifiées — avant et après — ou supprimées), recalculés une fois
CREATE OR REPLACE FUNCTION prospects_etat_lignes_ajoutees() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM prospects_recalculer_etat(ARRAY(SELECT DISTINCT prospect_id FROM nouvelles));
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION prospects_etat_lignes_modifiees() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM prospects_recalculer_etat(ARRAY(SELECT prospect_id FROM anciennes
                                            UNION SELECT prospect_id FROM nouvelles));
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION prospects_etat_lignes_supprimees() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM prospects_recalculer_etat(ARRAY(SELECT DISTINCT prospect_id FROM anciennes));
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION prospects_etat_tout() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM prospects_recalculer_etat(ARRAY(SELECT id FROM prospects));
    RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['prospect_echanges', 'prospect_cycles'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %1$s_etat_ajout ON %1$s', t);
        EXECUTE format('DROP TRIGGER IF EXISTS %1$s_etat_modif ON %1$s', t);
        EXECUTE format('DROP TRIGGER IF EXISTS %1$s_etat_suppr ON %1$s', t);
        EXECUTE format('DROP TRIGGER IF EXISTS %1$s_etat_vidage ON %1$s', t);
        EXECUTE format('CREATE TRIGGER %1$s_etat_ajout AFTER INSERT ON %1$s
                          REFERENCING NEW TABLE AS nouvelles
                          FOR EACH STATEMENT EXECUTE FUNCTION prospects_etat_lignes_ajoutees()', t);
        EXECUTE format('CREATE TRIGGER %1$s_etat_modif AFTER UPDATE ON %1$s
                          REFERENCING OLD TABLE AS anciennes NEW TABLE AS nouvelles
                          FOR EACH STATEMENT EXECUTE FUNCTION prospects_etat_lignes_modifiees()', t);
        EXECUTE format('CREATE TRIGGER %1$s_etat_suppr AFTER DELETE ON %1$s
                          REFERENCING OLD TABLE AS anciennes
                          FOR EACH STATEMENT EXECUTE FUNCTION prospects_etat_lignes_supprimees()', t);
        EXECUTE format('CREATE TRIGGER %1$s_etat_vidage AFTER TRUNCATE ON %1$s
                          FOR EACH STATEMENT EXECUTE FUNCTION prospects_etat_tout()', t);
    END LOOP;
END $$;

-- Les prospects existants
SELECT prospects_recalculer_etat(ARRAY(SELECT id FROM prospects));
