-- Migration 069 : Issue de la relation prospect
-- Conclusion de la prospection, renseignée lors d'un échange (hors premier contact) :
--   NULL       -> relation toujours en cours
--   'installe' -> l'investisseur a décidé de s'installer au Sénégal
--   'decline'  -> l'investisseur a écarté la possibilité (à l'heure actuelle)

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS issue VARCHAR(20);
