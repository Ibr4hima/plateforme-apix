ALTER TABLE evenements
    ADD COLUMN IF NOT EXISTS est_recurrent       BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS frequence_type      VARCHAR(20),  -- 'mois' ou 'ans'
    ADD COLUMN IF NOT EXISTS frequence_valeur    INTEGER,      -- ex: 4
    ADD COLUMN IF NOT EXISTS date_prochaine      DATE;

ALTER TABLE evenements
    ADD CONSTRAINT chk_frequence_valeur CHECK (frequence_valeur IS NULL OR frequence_valeur > 0);
