-- =============================================================================
-- Migration 060 — Sync complet ref_groupements ↔ ide_cnuced_monde
--                 Remplace le trigger DELETE-only de la migration 059
-- =============================================================================

-- Supprimer l'ancien trigger DELETE-only (migration 059)
DROP TRIGGER IF EXISTS trg_delete_icm_on_groupement ON ref_groupements;
DROP FUNCTION IF EXISTS sync_delete_icm_on_groupement();

-- Fonction unique INSERT / UPDATE / DELETE
CREATE OR REPLACE FUNCTION sync_icm_on_groupement()
RETURNS TRIGGER AS $$
BEGIN
    -- Suppression : retirer toutes les lignes du groupement
    IF TG_OP = 'DELETE' THEN
        DELETE FROM ide_cnuced_monde WHERE code = OLD.code;
        RETURN OLD;
    END IF;

    -- Mise à jour : supprimer les anciennes lignes (gère aussi le renommage de code)
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM ide_cnuced_monde WHERE code = OLD.code;
    END IF;

    -- INSERT ou UPDATE : recalculer les stats si pays_ids non vide
    IF array_length(NEW.pays_ids, 1) > 0 THEN
        INSERT INTO ide_cnuced_monde
            (code, nom_fr, annee, indicateur, direction, moyenne, somme, min, max, variance, ecart_type)
        SELECT
            NEW.code,
            NEW.nom_fr,
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

DROP TRIGGER IF EXISTS trg_sync_icm_on_groupement ON ref_groupements;
CREATE TRIGGER trg_sync_icm_on_groupement
    AFTER INSERT OR UPDATE OR DELETE ON ref_groupements
    FOR EACH ROW EXECUTE FUNCTION sync_icm_on_groupement();
