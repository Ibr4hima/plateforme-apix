-- =============================================================================
-- Migration 056 — ide_cnuced_monde : données initiales depuis ref_groupements
-- =============================================================================

INSERT INTO ide_cnuced_monde (id, code, nom_fr, pays_ids)
SELECT id, code, nom_fr, pays_ids
FROM ref_groupements
ON CONFLICT (id) DO NOTHING;

-- Resynchroniser la séquence après insertion avec IDs explicites
SELECT setval('ide_cnuced_monde_id_seq', (SELECT COALESCE(MAX(id), 0) FROM ide_cnuced_monde));
