-- 110 — Certains partenaires commerciaux (agrégats « … nes ») n'ont pas de code
-- ISO3 → on autorise code_iso3 à être NULL (l'index unique tolère plusieurs NULL).
ALTER TABLE ref_pays ALTER COLUMN code_iso3 DROP NOT NULL;
