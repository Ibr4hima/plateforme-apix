-- =============================================================================
-- 137 — Les Bermudes au référentiel pays.
-- =============================================================================
--
-- POURQUOI. Le relevé fDi « Dest = Africa », page 23, donne les Bermudes comme
-- pays d'origine d'un projet pétrolier en Algérie (Gulf Keystone, juin 2008,
-- 299,70 M$). Le territoire est absent de ref_pays : le seed d'origine ne
-- retient que des États souverains. Sans cette ligne, l'import signale « BMU
-- absent de ref_pays », le projet entre en base avec son texte brut mais sans
-- rattachement — compté dans les totaux, invisible à tout filtre par pays.
--
-- Ce n'est pas une exception : c'est le troisième territoire non souverain que
-- la donnée réelle réclame, après Hong Kong et Macao (migration 129). Les
-- Bermudes sont un domicile financier fréquent — beaucoup de sociétés
-- pétrolières et d'assurance y sont immatriculées — et fDi enregistre le pays
-- du siège, pas celui des actionnaires. Le cas se reproduira.
--
-- MISE EN ŒUVRE. continent et la colonne régionale sont RECOPIÉS depuis le
-- Canada plutôt qu'écrits en dur, pour deux raisons. D'abord le classement :
-- la nomenclature M49 des Nations unies range les Bermudes en Amérique
-- septentrionale, pas dans les Caraïbes. Ensuite la robustesse : le vocabulaire
-- de ces colonnes a changé au fil des migrations, et recopier garantit
-- l'alignement sur ce que porte réellement la base — même raisonnement qu'en
-- 129 pour Hong Kong. Le nom de la colonne régionale est lui-même retrouvé au
-- lieu d'être supposé.
--
-- niveau_revenu et origine restent à leur valeur par défaut. Surtout PAS
-- origine = 'transaction' : cette valeur sert de file d'attente de curation
-- des partenaires créés automatiquement à l'import, et les Bermudes n'ont rien
-- à y faire.
-- =============================================================================

INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr, continent)
SELECT 'BM', 'BMU', 'Bermudes', c.continent
  FROM ref_pays c
 WHERE c.code_iso3 = 'CAN'
   AND NOT EXISTS (SELECT 1 FROM ref_pays WHERE code_iso3 = 'BMU');

-- La colonne régionale s'appelle « region_geo » depuis la refonte du
-- référentiel ; elle s'appelait « region_monde » dans le seed d'origine, que
-- certains environnements de travail portent encore. On agit sur celle qui
-- existe, et sur aucune si aucune n'existe.
DO $$
DECLARE colonne text;
BEGIN
    SELECT column_name INTO colonne
      FROM information_schema.columns
     WHERE table_name = 'ref_pays' AND column_name IN ('region_geo', 'region_monde')
     LIMIT 1;
    IF colonne IS NOT NULL THEN
        EXECUTE format(
            'UPDATE ref_pays b SET %1$I = c.%1$I FROM ref_pays c '
            ' WHERE b.code_iso3 = ''BMU'' AND c.code_iso3 = ''CAN'' AND b.%1$I IS NULL',
            colonne);
    END IF;
END $$;
