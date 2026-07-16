-- =============================================================================
-- Migration 115 — Index uniques des séries IDE pour l'upsert en masse
--   Les imports passaient par un SELECT + INSERT/UPDATE par année ; ils
--   utilisent désormais INSERT … ON CONFLICT DO UPDATE, qui exige un index
--   unique sur la clé de série. Dédoublonnage préalable (on garde la ligne
--   la plus récente, id le plus grand) au cas où d'anciens imports auraient
--   laissé des doublons.
-- =============================================================================

-- ── ide_cnuced : série = (ref_pays_id, annee, direction, indicateur) ──────────
DELETE FROM ide_cnuced a
USING ide_cnuced b
WHERE a.ref_pays_id IS NOT NULL
  AND a.ref_pays_id = b.ref_pays_id
  AND a.annee = b.annee
  AND a.direction = b.direction
  AND a.indicateur = b.indicateur
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ide_cnuced_serie
  ON ide_cnuced (ref_pays_id, annee, direction, indicateur)
  WHERE ref_pays_id IS NOT NULL;

-- ── ide_cnuced_secteurs : série = (secteur_id, annee, direction, indicateur) ──
DELETE FROM ide_cnuced_secteurs a
USING ide_cnuced_secteurs b
WHERE a.secteur_id = b.secteur_id
  AND a.annee = b.annee
  AND a.direction = b.direction
  AND a.indicateur = b.indicateur
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ide_cnuced_secteurs_serie
  ON ide_cnuced_secteurs (secteur_id, annee, direction, indicateur);
