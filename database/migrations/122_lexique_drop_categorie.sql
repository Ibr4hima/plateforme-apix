-- 122_lexique_drop_categorie.sql — les catégories du lexique ne sont plus
-- utilisées : on retire la colonne.

ALTER TABLE lexique DROP COLUMN IF EXISTS categorie;
