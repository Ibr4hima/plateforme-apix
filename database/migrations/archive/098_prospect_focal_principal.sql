-- 098 : point focal principal sur les prospects.
-- Le premier point focal ajouté est marqué « Principal » par défaut.

ALTER TABLE prospect_points_focaux
    ADD COLUMN IF NOT EXISTS est_principal BOOLEAN DEFAULT FALSE;

-- Rétro-remplissage : le plus ancien point focal de chaque prospect devient principal.
UPDATE prospect_points_focaux pf
SET est_principal = TRUE
WHERE pf.id = (
    SELECT MIN(pf2.id) FROM prospect_points_focaux pf2
    WHERE pf2.prospect_id = pf.prospect_id
)
AND NOT EXISTS (
    SELECT 1 FROM prospect_points_focaux pf3
    WHERE pf3.prospect_id = pf.prospect_id AND pf3.est_principal = TRUE
);
