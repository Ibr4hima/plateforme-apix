-- =============================================================================
-- 142 — Donner leur nom anglais aux cinq pays entrés sans.
-- =============================================================================
--
-- POURQUOI MAINTENANT. Le formulaire de saisie d'un projet fDi ne demande plus
-- de retaper un pays : il propose ref_pays et l'on choisit. Ce qu'il envoie au
-- serveur, c'est le nom ANGLAIS — celui que l'analyseur de l'import sait
-- rapprocher, puisque c'est la langue de la source. Un pays sans nom anglais ne
-- serait donc pas proposable, ou pire, proposé et refusé à l'enregistrement.
--
-- Les cinq concernés sont les derniers entrés — Hong Kong et Macao, puis les
-- domiciles financiers des migrations 137 et 138, puis Taïwan (139). Ils sont
-- arrivés par le relevé, qui n'avait besoin que du code ISO et du nom français
-- d'affichage ; la colonne nom_en est restée vide faute d'emploi. Elle en a un.
--
-- Les graphies retenues sont celles de fdi_pays.csv, donc celles que fDi écrit.
-- Macao en porte deux chez la source (« Macao » et « Macau ») ; le référentiel
-- n'en garde qu'une, la correspondance continuant d'accepter les deux.
-- =============================================================================

UPDATE ref_pays SET nom_en = 'Hong Kong'      WHERE code_iso3 = 'HKG' AND coalesce(nom_en, '') = '';
UPDATE ref_pays SET nom_en = 'Macao'          WHERE code_iso3 = 'MAC' AND coalesce(nom_en, '') = '';
UPDATE ref_pays SET nom_en = 'Bermuda'        WHERE code_iso3 = 'BMU' AND coalesce(nom_en, '') = '';
UPDATE ref_pays SET nom_en = 'Cayman Islands' WHERE code_iso3 = 'CYM' AND coalesce(nom_en, '') = '';
UPDATE ref_pays SET nom_en = 'Taiwan'         WHERE code_iso3 = 'TWN' AND coalesce(nom_en, '') = '';
