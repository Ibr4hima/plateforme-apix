-- =============================================================================
-- Migration 088 — Canal de contact des échanges prospect
--   Ajoute le canal utilisé lors d'un échange (Mail, Appel, WhatsApp, …) et
--   la coordonnée associée (adresse e-mail, numéro de téléphone, lien, …).
-- =============================================================================

ALTER TABLE prospect_echanges
    ADD COLUMN IF NOT EXISTS canal         VARCHAR(50)  NULL,
    ADD COLUMN IF NOT EXISTS canal_contact VARCHAR(255) NULL;

-- Vérification
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'prospect_echanges'
  AND column_name IN ('canal', 'canal_contact')
ORDER BY column_name;
