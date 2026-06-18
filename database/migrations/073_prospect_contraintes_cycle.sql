-- Migration 073 : Contraintes scoped par cycle de prospection
--
-- Chaque contrainte appartient désormais au cycle de prospection pendant lequel
-- elle a été exprimée. Les contraintes des cycles passés (re-contacts) sont en
-- lecture seule. Le cycle courant porte toutes les contraintes récentes.
--
-- cycle_num = 0 pour les contraintes du premier cycle (avant tout re-contact).
-- cycle_num = N pour les contraintes du (N+1)ème cycle (après N re-contacts).

ALTER TABLE prospect_contraintes
    ADD COLUMN IF NOT EXISTS cycle_num INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_prospect_contraintes_cycle
    ON prospect_contraintes (prospect_id, cycle_num);
