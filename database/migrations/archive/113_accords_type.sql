-- =============================================================================
-- Migration 113 — Type d'accord / traité
--   tbi   = Traité Bilatéral d'Investissement (valeur par défaut : tout
--           l'existant est bilatéral)
--   inter = Traité International
--   Le formulaire admin propose le choix à la création ; la page publique
--   répartit les accords entre ses onglets selon cette colonne.
-- =============================================================================

ALTER TABLE accords_traites
    ADD COLUMN IF NOT EXISTS type_accord varchar(30) NOT NULL DEFAULT 'tbi';

CREATE INDEX IF NOT EXISTS idx_accords_type ON accords_traites (type_accord);
