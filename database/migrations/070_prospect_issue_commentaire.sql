-- Migration 070 : Commentaire de conclusion de la prospection

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS issue_commentaire TEXT;
