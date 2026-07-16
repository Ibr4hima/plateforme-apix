-- =============================================================================
-- Migration 085 — Persister le statut « expire » des accords
--   Le statut n'était calculé qu'à la volée dans l'API (get_statut_calcule),
--   la colonne accords_traites.statut restait figée à sa valeur de création.
--   Cela créait des incohérences pour toute requête directe en base.
--   → On aligne la colonne sur la réalité : tout accord dont la date
--     d'expiration est passée passe au statut « expire ».
--   La maintenance continue est assurée par un job quotidien côté application
--   (cf. _scheduled_expire_accords dans backend/app/main.py).
-- =============================================================================

UPDATE accords_traites
SET statut     = 'expire',
    updated_at = NOW()
WHERE date_expiration IS NOT NULL
  AND date_expiration < CURRENT_DATE
  AND statut IS DISTINCT FROM 'expire';

-- Vérification
SELECT statut, COUNT(*) AS nb
FROM accords_traites
GROUP BY statut
ORDER BY statut;
