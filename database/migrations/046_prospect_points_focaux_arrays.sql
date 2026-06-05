-- Migration 046 : Convertir telephone/mail en tableaux dans prospect_points_focaux

ALTER TABLE prospect_points_focaux
  ADD COLUMN IF NOT EXISTS telephones TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mails TEXT[] DEFAULT '{}';

UPDATE prospect_points_focaux SET
  telephones = CASE WHEN telephone IS NOT NULL AND telephone != '' THEN ARRAY[telephone] ELSE '{}' END,
  mails      = CASE WHEN mail IS NOT NULL AND mail != '' THEN ARRAY[mail] ELSE '{}' END;

ALTER TABLE prospect_points_focaux
  DROP COLUMN IF EXISTS telephone,
  DROP COLUMN IF EXISTS mail;
