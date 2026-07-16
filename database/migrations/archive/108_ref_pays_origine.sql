-- 108 — Marque les entités du référentiel créées automatiquement à l'import des
-- transactions (territoires/agrégats absents de la liste des pays : Western
-- Sahara, Tokelau, « Areas, nes »…). Permet de ne perdre aucune donnée de
-- commerce tout en distinguant ces partenaires des pays macro.
ALTER TABLE ref_pays ADD COLUMN IF NOT EXISTS origine TEXT;
