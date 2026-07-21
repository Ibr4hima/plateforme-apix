-- Rattachement des rubriques « pays » du BMSCE au référentiel ref_pays.
-- Toutes les rangées du bulletin restent importées telles quelles (les
-- regroupements ANSD — « LES PAYS DE L'AFRIQUE DE L'OUEST », etc. — servent
-- aux vérifications de cumuls des imports suivants) ; mais seules les
-- rubriques rattachées à un pays du référentiel sont exposées publiquement,
-- sous le nom canonique de ref_pays. Le rattachement unifie aussi les
-- graphies divergentes d'un même pays entre bulletins.
ALTER TABLE bmce_rubriques
    ADD COLUMN IF NOT EXISTS pays_id integer REFERENCES ref_pays(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bmce_rubriques_pays ON bmce_rubriques(pays_id)
    WHERE pays_id IS NOT NULL;
