-- =============================================================================
-- Migration 065 — Ajouter colonne categorie à ide_cnuced_monde
--
-- Valeurs :
--   'continent'           → groupements CONT_* (Afrique, Europe…)
--   '<nom du continent>'  → groupements REG_* (ex : 'Afrique' pour Afrique occidentale)
--   'groupe'              → groupements manuels (G7, UE, BRICS, UA, CEDEAO…)
--   'revenu'              → groupements NIV_* (Revenu élevé, Revenu faible…)
-- =============================================================================

-- 1. Ajouter la colonne
ALTER TABLE ide_cnuced_monde ADD COLUMN IF NOT EXISTS categorie VARCHAR(100);

-- 2. Peupler les lignes existantes
UPDATE ide_cnuced_monde icm
SET categorie = CASE
    WHEN icm.code LIKE 'CONT_%' THEN 'continent'
    WHEN icm.code LIKE 'NIV_%'  THEN 'revenu'
    WHEN icm.code LIKE 'REG_%'  THEN (
        SELECT DISTINCT p.continent
        FROM ref_pays p
        WHERE p.region_geo = icm.nom_fr
          AND p.continent IS NOT NULL
        LIMIT 1
    )
    ELSE 'groupe'
END;

-- 3. Mettre à jour le trigger pour auto-remplir categorie à chaque insert
CREATE OR REPLACE FUNCTION sync_icm_on_groupement()
RETURNS TRIGGER AS $$
DECLARE
    v_categorie VARCHAR(100);
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM ide_cnuced_monde WHERE code = OLD.code;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        DELETE FROM ide_cnuced_monde WHERE code = OLD.code;
    END IF;

    IF array_length(NEW.pays_ids, 1) > 0 THEN
        -- Déterminer la catégorie du groupement
        IF NEW.code LIKE 'CONT_%' THEN
            v_categorie := 'continent';
        ELSIF NEW.code LIKE 'NIV_%' THEN
            v_categorie := 'revenu';
        ELSIF NEW.code LIKE 'REG_%' THEN
            SELECT DISTINCT p.continent INTO v_categorie
            FROM ref_pays p
            WHERE p.region_geo = NEW.nom_fr AND p.continent IS NOT NULL
            LIMIT 1;
        ELSE
            v_categorie := 'groupe';
        END IF;

        INSERT INTO ide_cnuced_monde
            (code, nom_fr, categorie, annee, indicateur, direction,
             moyenne, somme, min, max, variance, ecart_type)
        SELECT
            NEW.code,
            NEW.nom_fr,
            v_categorie,
            c.annee,
            c.indicateur,
            c.direction,
            AVG(c.valeur),
            SUM(c.valeur),
            MIN(c.valeur),
            MAX(c.valeur),
            VAR_POP(c.valeur),
            STDDEV_POP(c.valeur)
        FROM ide_cnuced c
        WHERE c.ref_pays_id = ANY(NEW.pays_ids)
          AND c.valeur IS NOT NULL
        GROUP BY c.annee, c.indicateur, c.direction
        ORDER BY c.annee, c.indicateur, c.direction;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Vérification
SELECT categorie, COUNT(DISTINCT code) AS nb_groupements
FROM ide_cnuced_monde
GROUP BY categorie
ORDER BY categorie;
