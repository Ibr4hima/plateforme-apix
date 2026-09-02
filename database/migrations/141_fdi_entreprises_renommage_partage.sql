-- =============================================================================
-- 141 — Défaire les renommages d'entreprise qui ont emporté d'autres projets.
-- =============================================================================
--
-- LE SYMPTÔME. L'écran affichait « Attijariwafa Bank Egypt » en face d'un projet
-- de 2006 en Algérie, alors que fDi y écrit « Attijariwafa Bank », tout court.
--
-- LA CAUSE. L'import range sous une même entreprise un libellé complet et ses
-- formes tronquées : « Attijariwafa Bank » et « Attijariwafa Bank … » ne font
-- qu'un rang, puisque le second est un préfixe du premier. C'est voulu — sans
-- cela chaque troncature ouvrirait une entreprise fantôme. Mais l'arbitrage
-- « nommer » RENOMMAIT ce rang partagé : trancher que la forme tronquée désigne
-- la filiale égyptienne rebaptisait du même geste les projets marocains,
-- camerounais et sénégalais du libellé complet, qui ne parlent pas d'Égypte.
--
-- Le code de l'arbitrage est corrigé en amont : il n'ouvre plus qu'une seconde
-- entreprise dès que le rang est partagé. Reste à défaire ce qui l'a été.
--
-- CE QUE LA RÉPARATION RETIENT COMME ANOMALIE. Un projet dont le libellé brut
--   1. n'est PAS tronqué — donc la source a écrit le nom en entier, il n'y a
--      rien à arbitrer et l'entreprise devrait porter ce nom-là ;
--   2. porte un nom différent de celui de son entreprise ;
--   3. n'a JAMAIS été touché par un humain — la ligne porte encore la seule
--      signature de l'import ;
--   4. dont l'entreprise a justement été RENOMMÉE par un humain.
--
-- Les points 3 et 4 sont ce qui distingue la casse du travail légitime, et il
-- faut les deux. Qu'un humain rattache « Barclays Bank » à « Absa Group » est
-- un arbitrage, pas une erreur : l'arbitrage signe les lignes qu'il déplace, et
-- le point 3 les épargne. Les lignes emportées par un renommage, elles, n'ont
-- jamais été signées : le renommage ne les a pas touchées, il a déplacé le nom
-- sous elles. C'est très exactement ce que la migration cherche.
--
-- Le point 4 protège l'autre travail légitime, celui-là non signé : les fusions
-- de graphies de fdi_entreprises_alias.csv. Quand l'APIX établit que le bureau
-- d'études que fDi écrit tantôt « G Environment » tantôt « G Environnement » est
-- le même, l'import range les deux sous le nom retenu — et l'écart entre le
-- libellé brut et le nom de l'entreprise est alors VOULU. Un premier jet de
-- cette migration, qui n'avait pas le point 4, défaisait cette fusion : les
-- alias de fusion étant posés par l'import, ils ne se distinguent pas d'un
-- rapprochement automatique par leur signature. Ce qui les distingue, c'est
-- que l'entreprise, elle, n'a pas été renommée à la main.
--
-- CE QU'ELLE FAIT. Elle rend à ces projets une entreprise portant leur propre
-- libellé, en la créant si elle n'existe pas encore. Elle ne touche ni au
-- relevé, ni aux arbitrages, ni à l'entreprise renommée, qui reste celle de la
-- forme tronquée — la décision humaine sur celle-ci était juste.
--
-- Elle est idempotente : relancée, elle ne trouve plus rien à réparer.
-- =============================================================================

-- Le tout en une transaction : la réparation vaut en bloc, et la table
-- temporaire ci-dessous ne survit pas au COMMIT.
BEGIN;

-- La forme normalisée, telle que la calcule le code Python (normaliser) : sans
-- accent, sans ponctuation, « & » écrit « and ». Elle est refaite ici plutôt
-- qu'empruntée à l'extension unaccent, dont l'installation demande des droits
-- que la migration n'a pas à réclamer. La coupe des marques de troncature est
-- omise : cette migration ne travaille que sur des libellés non tronqués.
CREATE FUNCTION pg_temp.normaliser(v text) RETURNS text AS $$
    SELECT btrim(regexp_replace(
        regexp_replace(
            translate(replace(lower(coalesce(v, '')), '&', ' and '),
                      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ',
                      'aaaaaaceeeeiiiinooooouuuuyyoa'),
            '[^a-z0-9]+', ' ', 'g'),
        '\s+', ' ', 'g'));
$$ LANGUAGE sql IMMUTABLE;

-- Les libellés à rendre à eux-mêmes.
CREATE TEMPORARY TABLE _a_rendre ON COMMIT DROP AS
SELECT DISTINCT p.entreprise_brut AS brut
  FROM fdi_projets p
  JOIN fdi_entreprises e ON e.id = p.entreprise_id
 WHERE p.entreprise_brut IS NOT NULL
   -- 1. la source a écrit le nom en entier (pas de marque de troncature)
   AND p.entreprise_brut !~ '(…|\.\.\.)\s*$'
   -- 2. l'entreprise porte un autre nom
   AND lower(regexp_replace(p.entreprise_brut, '\s+', ' ', 'g')) IS DISTINCT FROM lower(e.nom)
   AND pg_temp.normaliser(p.entreprise_brut) IS DISTINCT FROM e.nom_normalise
   -- 3. AUCUN humain n'a touché ce projet-ci : son rattachement vient de
   --    l'import, et de lui seul. C'est la trace que l'arbitrage a laissée
   --    sur la LIGNE, et non sur l'alias, qui sert de témoin — la table des
   --    alias ne peut pas servir ici, sa clé portant sur la forme normalisée,
   --    qui efface précisément la marque de troncature : « Attijariwafa Bank »
   --    et « Attijariwafa Bank … » y partagent un rang, et la signature de
   --    l'arbitrage rendu sur le second se pose donc aussi sur le premier.
   AND (p.modifie_par IS NULL OR p.modifie_par = 'import')
   -- 4. l'entreprise a bien été renommée à la main : c'est ce geste-là, et lui
   --    seul, que la migration défait. L'import ne signe que « import ».
   AND e.modifie_par IS NOT NULL
   AND e.modifie_par <> 'import';

-- L'entreprise que chacun aurait dû avoir. ON CONFLICT couvre le cas où elle
-- existe déjà : deux libellés ne peuvent pas se disputer un nom normalisé.
INSERT INTO fdi_entreprises (nom, nom_normalise, statut_nom)
SELECT r.brut, pg_temp.normaliser(r.brut), 'complet'
  FROM _a_rendre r
ON CONFLICT (nom_normalise) DO NOTHING;

UPDATE fdi_projets p
   SET entreprise_id = e.id,
       modifie_le    = now(),
       modifie_par   = 'migration 141'
  FROM _a_rendre r
  JOIN fdi_entreprises e ON e.nom_normalise = pg_temp.normaliser(r.brut)
 WHERE p.entreprise_brut = r.brut
   AND p.entreprise_id IS DISTINCT FROM e.id;

-- La société mère suit le même raisonnement, et le même libellé.
UPDATE fdi_projets p
   SET parent_id = e.id
  FROM _a_rendre r
  JOIN fdi_entreprises e ON e.nom_normalise = pg_temp.normaliser(r.brut)
 WHERE p.parent_brut = r.brut
   AND p.parent_id IS DISTINCT FROM e.id
   AND (p.modifie_par IS NULL OR p.modifie_par IN ('import', 'migration 141'));

COMMIT;
