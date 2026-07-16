-- =============================================================================
-- Migration 066 — Corriger le remplissage de ide_cnuced_monde.categorie
--                 Détection via nom_fr ↔ ref_pays (continent / region_geo / niveau_revenu)
-- =============================================================================

-- Recalculer categorie en comparant nom_fr aux valeurs réelles de ref_pays
UPDATE ide_cnuced_monde icm
SET categorie = CASE
    -- Continent : nom_fr existe dans ref_pays.continent
    WHEN icm.nom_fr IN (
        SELECT DISTINCT continent FROM ref_pays WHERE continent IS NOT NULL
    ) THEN 'continent'

    -- Niveau de revenu : nom_fr existe dans ref_pays.niveau_revenu
    WHEN icm.nom_fr IN (
        SELECT DISTINCT niveau_revenu FROM ref_pays WHERE niveau_revenu IS NOT NULL
    ) THEN 'revenu'

    -- Région géographique : nom_fr existe dans ref_pays.region_geo
    -- → categorie = nom du continent parent
    WHEN icm.nom_fr IN (
        SELECT DISTINCT region_geo FROM ref_pays WHERE region_geo IS NOT NULL
    ) THEN (
        SELECT DISTINCT p.continent
        FROM ref_pays p
        WHERE p.region_geo = icm.nom_fr AND p.continent IS NOT NULL
        LIMIT 1
    )

    -- Tout le reste : groupements manuels (G7, UE, BRICS, UA…)
    ELSE 'groupe'
END;

-- Mettre à jour le trigger avec la même logique
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
        -- Déterminer la catégorie via nom_fr ↔ ref_pays
        IF NEW.nom_fr IN (SELECT DISTINCT continent FROM ref_pays WHERE continent IS NOT NULL) THEN
            v_categorie := 'continent';
        ELSIF NEW.nom_fr IN (SELECT DISTINCT niveau_revenu FROM ref_pays WHERE niveau_revenu IS NOT NULL) THEN
            v_categorie := 'revenu';
        ELSIF NEW.nom_fr IN (SELECT DISTINCT region_geo FROM ref_pays WHERE region_geo IS NOT NULL) THEN
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
            NEW.code, NEW.nom_fr, v_categorie,
            c.annee, c.indicateur, c.direction,
            AVG(c.valeur), SUM(c.valeur), MIN(c.valeur), MAX(c.valeur),
            VAR_POP(c.valeur), STDDEV_POP(c.valeur)
        FROM ide_cnuced c
        WHERE c.ref_pays_id = ANY(NEW.pays_ids)
          AND c.valeur IS NOT NULL
        GROUP BY c.annee, c.indicateur, c.direction
        ORDER BY c.annee, c.indicateur, c.direction;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vérification
SELECT categorie, COUNT(DISTINCT code) AS nb_groupements
FROM ide_cnuced_monde
GROUP BY categorie
ORDER BY categorie;
