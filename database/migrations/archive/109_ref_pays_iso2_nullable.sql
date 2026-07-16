-- 109 — Les partenaires commerciaux créés à l'import (territoires, agrégats)
-- n'ont pas toujours de code ISO2 → on autorise code_iso2 à être NULL.
ALTER TABLE ref_pays ALTER COLUMN code_iso2 DROP NOT NULL;
