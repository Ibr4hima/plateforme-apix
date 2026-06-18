-- Migration 072 : Historique des cycles de prospection
--
-- Une entreprise « Déclinée » peut être re-contactée plus tard (ex : déclin en
-- 2026, re-contact en 2028 → installation). À chaque re-contact, la conclusion
-- courante est archivée ici puis le prospect repart à zéro (issue = NULL),
-- tout en conservant l'historique complet de ses échanges/contraintes.

CREATE TABLE IF NOT EXISTS prospect_cycles (
    id                SERIAL PRIMARY KEY,
    prospect_id       INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    cycle_num         INTEGER NOT NULL,
    issue             VARCHAR(20) NOT NULL,        -- installe | decline
    issue_commentaire TEXT,
    conclu_le         TIMESTAMPTZ,
    recontacte_le     TIMESTAMPTZ DEFAULT now(),   -- quand le cycle a été rouvert
    created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_cycles_prospect
    ON prospect_cycles (prospect_id, cycle_num);
