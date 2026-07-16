-- =============================================================================
-- Migration 117 — Nettoyage des tables mortes
--
-- Dix tables présentes en base mais que plus aucune ligne de code (backend,
-- frontend, SQL brut) ne lit ni n'écrit — vérifié par audit croisé
-- migrations ↔ modèles ORM ↔ routes le 16/07/2026 :
--   · utilisateurs + profils_investisseurs : remplacées par users (arch. 089)
--   · opportunites_investissement          : le module utilise potentialites /
--                                            avantages_incitations / projets
--   · prospects_interactions,
--     intentions_interactions              : remplacées par prospect_echanges
--   · ide_flux                             : remplacée par ide_cnuced
--   · ref_sources, ref_statuts             : référentiels jamais consommés
--   · audit_log                            : créée, jamais branchée
--   · entreprises_hors_senegal             : jamais consommée
--
-- Le volume de chaque table est journalisé (RAISE NOTICE) avant suppression,
-- pour laisser une trace dans la sortie psql.
-- =============================================================================

DO $$
DECLARE
    t TEXT;
    n BIGINT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'utilisateurs', 'profils_investisseurs', 'opportunites_investissement',
        'prospects_interactions', 'intentions_interactions', 'ide_flux',
        'ref_sources', 'ref_statuts', 'audit_log', 'entreprises_hors_senegal'
    ] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('SELECT COUNT(*) FROM %I', t) INTO n;
            RAISE NOTICE 'Suppression de % (% ligne(s))', t, n;
        END IF;
    END LOOP;
END $$;

-- profils_investisseurs référence utilisateurs : ordre enfants → parents,
-- CASCADE par sécurité pour les contraintes résiduelles.
DROP TABLE IF EXISTS profils_investisseurs        CASCADE;
DROP TABLE IF EXISTS utilisateurs                 CASCADE;
DROP TABLE IF EXISTS opportunites_investissement  CASCADE;
DROP TABLE IF EXISTS prospects_interactions       CASCADE;
DROP TABLE IF EXISTS intentions_interactions      CASCADE;
DROP TABLE IF EXISTS ide_flux                     CASCADE;
DROP TABLE IF EXISTS ref_sources                  CASCADE;
DROP TABLE IF EXISTS ref_statuts                  CASCADE;
DROP TABLE IF EXISTS audit_log                    CASCADE;
DROP TABLE IF EXISTS entreprises_hors_senegal     CASCADE;
