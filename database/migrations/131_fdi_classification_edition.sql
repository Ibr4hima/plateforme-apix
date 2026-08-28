-- Classification fDi Markets : édition depuis l'administration
--
-- La nomenclature n'est pas figée. fDi ajoute des postes, en renomme, en
-- retire. L'écran d'administration doit donc pouvoir créer et corriger — mais
-- les CSV du dépôt sont réimportés à chaque déploiement, et écraseraient toute
-- correction saisie. D'où cette colonne, qui tranche la question de l'autorité
-- ligne par ligne plutôt que table par table :
--
--   origine = 'depot'  la ligne vient des CSV et les suit. Une correction
--                      apportée aux fichiers se propage au prochain
--                      déploiement, comme aujourd'hui.
--   origine = 'admin'  la ligne a été créée ou corrigée à l'écran. L'import
--                      ne la touche plus : la décision humaine l'emporte sur
--                      le fichier, et l'écart est signalé dans le rapport
--                      d'import plutôt que résolu en silence.
--
-- Ce que cette colonne NE fait pas : elle ne renomme rien en cascade. C'est
-- inutile — un projet portera l'identifiant du secteur, jamais son libellé.
-- Renommer, c'est un UPDATE sur une ligne ; tous les projets rattachés, même
-- ceux de 2010, affichent le nouveau nom parce qu'ils pointent sur la ligne et
-- non sur le texte. Le `code`, lui, ne change JAMAIS après création : c'est
-- l'identité stable de la ligne, ce à quoi les imports de projets s'apparient.

ALTER TABLE fdi_secteurs
    ADD COLUMN IF NOT EXISTS origine     text NOT NULL DEFAULT 'depot'
        CHECK (origine IN ('depot', 'admin')),
    ADD COLUMN IF NOT EXISTS modifie_le  timestamptz,
    ADD COLUMN IF NOT EXISTS modifie_par text;

ALTER TABLE fdi_sous_secteurs
    ADD COLUMN IF NOT EXISTS origine     text NOT NULL DEFAULT 'depot'
        CHECK (origine IN ('depot', 'admin')),
    ADD COLUMN IF NOT EXISTS modifie_le  timestamptz,
    ADD COLUMN IF NOT EXISTS modifie_par text;

ALTER TABLE fdi_activites
    ADD COLUMN IF NOT EXISTS origine     text NOT NULL DEFAULT 'depot'
        CHECK (origine IN ('depot', 'admin')),
    ADD COLUMN IF NOT EXISTS modifie_le  timestamptz,
    ADD COLUMN IF NOT EXISTS modifie_par text;

-- La contrainte d'unicité de `cle_appariement` dans son secteur existe déjà
-- (migration 130) : elle protège aussi les ajouts faits à l'écran, qui
-- passeront par les mêmes garde-fous que l'import.
