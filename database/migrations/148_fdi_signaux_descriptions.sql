-- =============================================================================
-- 148 — Une description sur chaque signal d'investisseur.
-- =============================================================================
--
-- POURQUOI. Un signal se lit mal sans ses mots. « New Personnel · Kenya ·
-- Software » ne dit pas ce qui s'est passé — une nomination régionale ? un
-- bureau ouvert ? — et c'est justement ce qu'une agence de promotion a besoin
-- de savoir pour décider d'aller voir. Les projets annoncés portent déjà leurs
-- deux descriptions ; les signaux les réclament pour la même raison.
--
-- DEUX LANGUES, comme pour les projets : l'anglais est celui de la source, le
-- français celui de la restitution. Garder les deux permet de retrouver la
-- phrase d'origine quand la traduction fait douter.
--
-- PAS DE VERROU SUR CES COLONNES, et ce n'est pas un oubli. La source ne
-- fournit aucune description : rien, dans le relevé, ne peut donc les écraser.
-- Le réimport les préserve déjà tant que la ligne décrit le même signal, comme
-- il le fait des descriptions de projet.
-- =============================================================================

ALTER TABLE fdi_signaux_investisseurs
    ADD COLUMN IF NOT EXISTS description_en text,
    ADD COLUMN IF NOT EXISTS description_fr text;

COMMENT ON COLUMN fdi_signaux_investisseurs.description_fr IS
    'Description saisie à la main. La source n''en fournit pas : aucun réimport ne peut l''écraser.';

-- Ce qui reste à décrire. Le compteur de l'administration s'appuie dessus, et
-- il sera lu à chaque page tournée sur quatre mille cinq cents signaux.
CREATE INDEX IF NOT EXISTS idx_fdi_sig_sans_desc
    ON fdi_signaux_investisseurs (id)
    WHERE description_fr IS NULL OR description_fr = '';
