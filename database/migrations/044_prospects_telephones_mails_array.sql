-- Migration 044 : Convertir telephone/mail en tableaux telephones/mails sur prospects

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS telephones TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mails      TEXT[] DEFAULT '{}';

-- Migrer les données existantes (comma-separated → array)
UPDATE prospects
SET
  telephones = CASE
    WHEN telephone IS NOT NULL AND telephone != ''
    THEN string_to_array(telephone, ', ')
    ELSE '{}'
  END,
  mails = CASE
    WHEN mail IS NOT NULL AND mail != ''
    THEN string_to_array(mail, ', ')
    ELSE '{}'
  END;

-- Supprimer les anciennes colonnes
ALTER TABLE prospects
  DROP COLUMN IF EXISTS telephone,
  DROP COLUMN IF EXISTS mail;
