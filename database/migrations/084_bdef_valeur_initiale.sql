-- Migration 084 : BDEF — valeur initiale (issue de l'import) pour révision
--
-- Permet de modifier manuellement une valeur dans l'admin tout en conservant
-- la valeur d'origine (celle au moment de l'import). L'utilisateur peut ainsi
-- toujours revenir à la valeur initiale, quel que soit le nombre de modifications.

ALTER TABLE bdef_valeurs ADD COLUMN IF NOT EXISTS valeur_initiale NUMERIC(20,4);

-- Backfill : pour les valeurs déjà présentes, l'initiale = la valeur actuelle.
UPDATE bdef_valeurs SET valeur_initiale = valeur WHERE valeur_initiale IS NULL;
