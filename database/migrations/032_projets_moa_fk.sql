-- Ajouter moa_id FK dans projets → projet_moa
ALTER TABLE projets ADD COLUMN IF NOT EXISTS moa_id UUID REFERENCES projet_moa(id) ON DELETE SET NULL;

-- Contrainte investissement_max > investissement_min
ALTER TABLE projets DROP CONSTRAINT IF EXISTS chk_investissement_intervalle;
ALTER TABLE projets ADD CONSTRAINT chk_investissement_intervalle
    CHECK (
        investissement_min IS NULL OR investissement_max IS NULL OR
        investissement_max > investissement_min
    );
