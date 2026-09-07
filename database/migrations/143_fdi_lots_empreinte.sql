-- =============================================================================
-- 143 — Ne réimporter que les pages qui ont changé.
-- =============================================================================
--
-- POURQUOI. Chaque mise à jour rejouait les 1 112 pages du relevé, une par une,
-- même quand aucune n'avait bougé. Sur seize mille huit cents lignes, cela fait
-- une minute d'attente et mille cent lignes de journal à chaque déploiement —
-- au point que plus personne ne les lit. Un journal qu'on ne lit plus est un
-- journal qui ne signale plus rien : c'est ainsi que quatre sous-secteurs non
-- rattachés ont pu passer inaperçus plusieurs versements de suite.
--
-- CE QUE LA COLONNE PORTE. L'empreinte de ce qui a servi à écrire le lot :
-- le contenu du fichier CSV, ET celui de tout ce qui en gouverne
-- l'interprétation — nomenclatures, correspondance des pays, variantes de
-- graphie, fusions d'entreprises, arbitrages de troncature, et le code de
-- l'analyseur lui-même.
--
-- Le second terme est le plus important, et c'est celui qu'on oublie : une page
-- inchangée doit être RÉÉCRITE si la nomenclature a bougé, sinon la correction
-- apportée au référentiel ne redescendrait jamais jusqu'aux lignes. En incluant
-- l'analyseur, une correction du code de lecture rejoue tout de même.
--
-- CE QUE CELA NE CHANGE PAS. Un lot ignoré garde exactement ce qu'il avait :
-- ses descriptions, ses arbitrages d'entreprise, ses colonnes verrouillées.
-- C'est déjà ce que le réimport préservait ; on épargne seulement le travail.
--
-- Et la porte de sortie reste ouverte : `importer_projets.py --tout` ignore les
-- empreintes et réécrit tout. À employer quand on doute, ce qui arrive.
-- =============================================================================

ALTER TABLE fdi_lots_import
    ADD COLUMN IF NOT EXISTS empreinte text;

COMMENT ON COLUMN fdi_lots_import.empreinte IS
    'Empreinte du CSV et de tout ce qui gouverne son interprétation. Un lot dont l''empreinte n''a pas changé n''est pas réécrit.';
