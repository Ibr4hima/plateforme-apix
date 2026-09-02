-- =============================================================================
-- 140 — Corriger une ligne fDi, et en ajouter une, sans qu'un réimport l'efface.
-- =============================================================================
--
-- POURQUOI. Jusqu'ici un projet fDi ne pouvait pas être corrigé. L'arbitrage
-- d'une entreprise, une fois rendu, ne se reprenait pas ; une erreur de saisie
-- sur un montant ou un pays restait ; et rien ne permettait d'enregistrer un
-- projet paru après la fin du relevé sans reprendre toute la page en capture.
--
-- Le vrai obstacle n'était pas l'absence de formulaire : c'est que importer_lot
-- RÉÉCRIT chaque colonne factuelle depuis le CSV et SUPPRIME les rangs qui le
-- dépassent. Une correction saisie en administration aurait donc disparu au
-- prochain import du lot, et un projet ajouté aurait été supprimé — sans un
-- mot. Ajouter l'écran sans traiter cela aurait déplacé le problème d'un cran
-- et l'aurait rendu invisible.
--
-- DEUX COLONNES, ET LA RÈGLE QUI VA AVEC.
--
--   champs_verrouilles : les colonnes qu'un humain a corrigées. Le réimport
--     laisse celles-là tranquilles et réécrit tout le reste. Un verrou par
--     colonne, et non par ligne, parce qu'une ligne dont on a corrigé le seul
--     pays doit continuer de recevoir les corrections que fDi apporte au
--     montant ou au secteur : figer la ligne entière ferait perdre la source.
--
--     Le verrou ne vaut que si la ligne décrit TOUJOURS le même projet. Si la
--     source republie la page avec d'autres lignes, le rang pointe sur autre
--     chose et tout repart du CSV : mieux vaut perdre une correction que la
--     coller sur un projet qui n'est plus le sien. C'est déjà la règle retenue
--     pour les descriptions, et elle vaut ici pour la même raison.
--
--   origine : « import » ou « saisie ». Un projet saisi n'a pas de rang chez
--     fDi ; aucune ligne de CSV ne viendra jamais en face de lui, et la purge
--     des rangs excédentaires doit donc l'épargner.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS. Elle ne réécrit aucun CSV. Les fichiers
-- restent la source de vérité du relevé ; la base porte, à côté, ce qu'un
-- humain a établi que la source disait faux ou ne disait pas. Les deux se
-- distinguent — colonne origine, colonne champs_verrouilles — au lieu de se
-- mélanger dans un tableau où plus personne ne saurait qui a écrit quoi.
-- =============================================================================

ALTER TABLE fdi_projets
    ADD COLUMN IF NOT EXISTS champs_verrouilles text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'import';

-- Une valeur inattendue dans origine ferait échapper des lignes à la purge sans
-- que rien ne le dise ; la contrainte le refuse à l'écriture.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fdi_projets_origine_ck') THEN
        ALTER TABLE fdi_projets
            ADD CONSTRAINT fdi_projets_origine_ck CHECK (origine IN ('import', 'saisie'));
    END IF;
END $$;

-- La purge des rangs excédentaires filtre désormais sur origine ; l'index rend
-- ce filtre gratuit et sert aussi à compter les saisies dans l'écran d'admin.
CREATE INDEX IF NOT EXISTS fdi_projets_origine_idx ON fdi_projets (origine)
    WHERE origine = 'saisie';

COMMENT ON COLUMN fdi_projets.champs_verrouilles IS
    'Colonnes corrigées à la main : un réimport du lot ne les réécrit pas, tant que la ligne décrit le même projet.';
COMMENT ON COLUMN fdi_projets.origine IS
    'import = ligne venue d''un CSV du relevé ; saisie = projet ajouté à la main, jamais purgé par un réimport.';
