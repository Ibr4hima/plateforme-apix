-- Ajouter la FK ref_pays_id à ide_cnuced pour relier à ref_pays
ALTER TABLE ide_cnuced ADD COLUMN IF NOT EXISTS ref_pays_id INT REFERENCES ref_pays(id);
CREATE INDEX IF NOT EXISTS idx_ide_cnuced_ref_pays ON ide_cnuced(ref_pays_id);

-- Tenter de relier les lignes existantes via nom_fr ou nom_cnuced
UPDATE ide_cnuced i
SET ref_pays_id = p.id
FROM ref_pays p
WHERE i.ref_pays_id IS NULL
  AND (p.nom_fr = i.pays OR p.nom_cnuced = i.pays);
