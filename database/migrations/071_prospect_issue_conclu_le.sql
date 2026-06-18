-- Migration 071 : Horodatage de la conclusion de prospection

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS issue_conclu_le TIMESTAMPTZ;
