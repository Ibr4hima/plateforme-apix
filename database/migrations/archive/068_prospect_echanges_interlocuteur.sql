-- Migration 068 : Échanges prospects — interlocuteur côté investisseur + agent APIX

ALTER TABLE prospect_echanges
  ADD COLUMN IF NOT EXISTS interlocuteur    TEXT,          -- texte libre (nom saisi ou issu d'un point focal)
  ADD COLUMN IF NOT EXISTS point_focal_id   INTEGER REFERENCES prospect_points_focaux(id) ON DELETE SET NULL;

-- Index pour filtrer/afficher les échanges par point focal
CREATE INDEX IF NOT EXISTS idx_prospect_echanges_point_focal ON prospect_echanges(point_focal_id);
