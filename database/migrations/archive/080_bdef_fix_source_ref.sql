-- Migration 080 : BDEF — correctif source_ref trop court
--
-- En 078, l'UPDATE de act_tx_prod a échoué (« value too long for type
-- character varying(50) ») : son libellé de fraction fait 52 caractères.
-- L'instruction étant atomique, act_tx_prod s'est retrouvé SANS extraction_key
-- ni source_ref. On élargit source_ref puis on réapplique l'UPDATE manquant.

ALTER TABLE bdef_indicateurs
    ALTER COLUMN source_ref TYPE VARCHAR(200);

UPDATE bdef_indicateurs SET
    extraction_key='ratio:production n production n 1||production n 1',
    source_ref='PRODUCTION (N) - PRODUCTION (N-1) / PRODUCTION (N-1)',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='act_tx_prod';
