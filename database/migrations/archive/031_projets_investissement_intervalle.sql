ALTER TABLE projets
    ADD COLUMN IF NOT EXISTS investissement_min NUMERIC(20,2),
    ADD COLUMN IF NOT EXISTS investissement_max NUMERIC(20,2),
    ADD COLUMN IF NOT EXISTS investissement_est_intervalle BOOLEAN DEFAULT FALSE;

-- Migrer la valeur existante vers investissement_min
UPDATE projets SET investissement_min = investissement WHERE investissement IS NOT NULL;
