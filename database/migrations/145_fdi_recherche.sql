-- =============================================================================
-- 145 — Rendre la recherche du tableau des projets indexable.
-- =============================================================================
--
-- POURQUOI. Chercher « chery » parcourait les seize mille huit cent
-- soixante-douze lignes du relevé pour en retenir sept, et recommençait pour
-- les compter : quatre-vingt-quinze millisecondes. Le tri et la pagination sont
-- désormais servis par un index (migration 144) ; la recherche restait le seul
-- endroit où Postgres lisait encore toute la table.
--
-- CE QUE LA RECHERCHE FAIT, et pourquoi c'était difficile à indexer. Elle porte
-- sur les huit colonnes affichées, dont chacune montre soit le libellé du
-- RÉFÉRENTIEL, soit celui de la SOURCE quand le rattachement a échoué. Deux
-- natures de condition, donc, réunies par des OU — et il suffit d'une seule
-- branche non indexable pour condamner toute la requête au parcours complet.
--
-- TROIS FAMILLES D'INDEX, une par obstacle levé.
--
-- 1. LES CLEFS ÉTRANGÈRES QUI MANQUAIENT. Le code interroge d'abord les
--    référentiels, puis demande « ces projets pointent-ils vers l'un de ces
--    identifiants ? ». Sans index sur la colonne, la question se paie d'un
--    parcours. Trois l'avaient déjà (entreprise, secteur, destination) ; les
--    cinq autres les rejoignent. Elles servent aussi à tout regroupement par
--    société mère, par activité ou par pays d'origine.
--
-- 2. LES LIGNES DONT UN RATTACHEMENT MANQUE. C'est là, et là seulement, que le
--    libellé de la source s'affiche, donc qu'il faut le lire. Le code enferme
--    ces huit comparaisons de texte derrière une garde — « au moins un
--    rattachement manque » — qui reproduit MOT POUR MOT le prédicat de l'index
--    partiel ci-dessous. Postgres reconnaît alors qu'il peut n'aller chercher
--    que ces lignes-là. Aujourd'hui il n'y en a aucune, le relevé étant
--    entièrement rattaché : l'index est vide, et la branche ne coûte rien.
--    Elle doit pourtant rester juste, car un import futur peut échouer à
--    rattacher une ligne, et c'est précisément celle qu'on voudra retrouver.
--
--    Le prédicat de cet index doit rester identique à la constante GARDE de
--    app/api/routes/fdi_projets.py. S'ils divergent, Postgres ne reconnaîtra
--    plus l'implication, l'index cessera d'être employé, et la recherche
--    retombera au parcours complet sans que rien ne le signale.
--
-- 3. LE NOM DES ENTREPRISES, EN TRIGRAMMES. Une fois le reste indexé, le temps
--    s'était entièrement déplacé sur la recherche des entreprises : neuf mille
--    sept cents noms lus un à un, dix-huit millisecondes. L'index GIN trigramme
--    ramène cela à deux. Il porte le nom RÉDUIT — décomposé, dépouillé de tout
--    ce qui n'est pas ASCII imprimable, minuscule — parce que c'est sur cette
--    forme que la comparaison est faite : chercher « cote » doit trouver
--    « Côte », et « egypte » trouver « Égypte ».
--
--    Les cinq autres référentiels ne sont pas indexés : quelques dizaines de
--    lignes chacun, un index y coûterait plus qu'il ne rapporte.
--
-- RÉSULTAT MESURÉ : recherche 95 ms → 21 ms, dont 0,4 ms pour la sélection des
-- lignes elle-même, désormais servie par une combinaison de parcours d'index.
-- =============================================================================

-- pg_trgm est déjà installée par le socle (116) ; on ne présume pas de l'ordre.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Les clefs étrangères sans index.
CREATE INDEX IF NOT EXISTS idx_fdi_projets_parent       ON fdi_projets (parent_id);
CREATE INDEX IF NOT EXISTS idx_fdi_projets_sous_secteur ON fdi_projets (sous_secteur_id);
CREATE INDEX IF NOT EXISTS idx_fdi_projets_activite     ON fdi_projets (activite_id);
CREATE INDEX IF NOT EXISTS idx_fdi_projets_source       ON fdi_projets (pays_source_id);
CREATE INDEX IF NOT EXISTS idx_fdi_projets_type         ON fdi_projets (type_projet_id);

-- 2. Les lignes dont au moins un rattachement manque.
CREATE INDEX IF NOT EXISTS idx_fdi_projets_non_rattache ON fdi_projets (id)
    WHERE entreprise_id IS NULL
       OR parent_id IS NULL
       OR secteur_id IS NULL
       OR sous_secteur_id IS NULL
       OR activite_id IS NULL
       OR pays_source_id IS NULL
       OR pays_dest_id IS NULL
       OR type_projet_id IS NULL;

COMMENT ON INDEX idx_fdi_projets_non_rattache IS
    'Les lignes où un libellé de la source s''affiche faute de rattachement. Prédicat à garder identique à la constante GARDE du code : c''est lui qui rend la recherche indexable.';

-- 3. Le nom des entreprises, sous sa forme réduite, en trigrammes.
CREATE INDEX IF NOT EXISTS idx_fdi_entreprises_recherche ON fdi_entreprises
    USING gin ((lower(regexp_replace(normalize(coalesce(nom, ''), NFKD), '[^ -~]', '', 'g'))) gin_trgm_ops);

COMMENT ON INDEX idx_fdi_entreprises_recherche IS
    'Recherche par fragment sur le nom réduit (sans accent ni casse). Doit rester aligné sur la constante CLE_DEST du code.';
