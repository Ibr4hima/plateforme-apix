-- =============================================================================
-- Migration 064 — Sync complet ref_pays → ref_groupements + ide_cnuced
--
-- Couvre :
--   INSERT  → ajoute le pays aux groupements CONT_*/REG_*/NIV_* correspondants
--   UPDATE  → re-calcule les memberships si continent/region_geo/niveau_revenu change
--             met à jour ide_cnuced.pays si nom_fr change
--   DELETE  → déjà géré par ON DELETE CASCADE sur ref_pays_groupements
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_on_pays_change()
RETURNS TRIGGER AS $$
BEGIN

    -- ── INSERT : rattacher le nouveau pays à ses groupements géo/économiques ──
    IF TG_OP = 'INSERT' THEN
        INSERT INTO ref_pays_groupements (pays_id, groupement_id)
        SELECT NEW.id, g.id
        FROM ref_groupements g
        WHERE g.nom_fr IN (NEW.continent, NEW.region_geo, NEW.niveau_revenu)
          AND g.nom_fr IS NOT NULL
        ON CONFLICT DO NOTHING;

        RETURN NEW;
    END IF;

    -- ── UPDATE ────────────────────────────────────────────────────────────────
    IF TG_OP = 'UPDATE' THEN

        -- nom_fr modifié → mettre à jour ide_cnuced.pays
        IF OLD.nom_fr IS DISTINCT FROM NEW.nom_fr THEN
            UPDATE ide_cnuced SET pays = NEW.nom_fr WHERE ref_pays_id = NEW.id;
        END IF;

        -- continent modifié → changer de groupement continental
        IF OLD.continent IS DISTINCT FROM NEW.continent THEN
            DELETE FROM ref_pays_groupements rpg
            USING ref_groupements g
            WHERE rpg.pays_id = NEW.id
              AND rpg.groupement_id = g.id
              AND g.nom_fr = OLD.continent;

            INSERT INTO ref_pays_groupements (pays_id, groupement_id)
            SELECT NEW.id, g.id FROM ref_groupements g
            WHERE g.nom_fr = NEW.continent AND NEW.continent IS NOT NULL
            ON CONFLICT DO NOTHING;
        END IF;

        -- region_geo modifiée → changer de groupement régional
        IF OLD.region_geo IS DISTINCT FROM NEW.region_geo THEN
            DELETE FROM ref_pays_groupements rpg
            USING ref_groupements g
            WHERE rpg.pays_id = NEW.id
              AND rpg.groupement_id = g.id
              AND g.nom_fr = OLD.region_geo;

            INSERT INTO ref_pays_groupements (pays_id, groupement_id)
            SELECT NEW.id, g.id FROM ref_groupements g
            WHERE g.nom_fr = NEW.region_geo AND NEW.region_geo IS NOT NULL
            ON CONFLICT DO NOTHING;
        END IF;

        -- niveau_revenu modifié → changer de groupement économique
        IF OLD.niveau_revenu IS DISTINCT FROM NEW.niveau_revenu THEN
            DELETE FROM ref_pays_groupements rpg
            USING ref_groupements g
            WHERE rpg.pays_id = NEW.id
              AND rpg.groupement_id = g.id
              AND g.nom_fr = OLD.niveau_revenu;

            INSERT INTO ref_pays_groupements (pays_id, groupement_id)
            SELECT NEW.id, g.id FROM ref_groupements g
            WHERE g.nom_fr = NEW.niveau_revenu AND NEW.niveau_revenu IS NOT NULL
            ON CONFLICT DO NOTHING;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_on_pays ON ref_pays;
CREATE TRIGGER trg_sync_on_pays
    AFTER INSERT OR UPDATE ON ref_pays
    FOR EACH ROW EXECUTE FUNCTION sync_on_pays_change();
