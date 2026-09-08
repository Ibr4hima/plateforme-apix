-- =============================================================================
-- 146 — Découper l'Afrique en cinq régions dans ref_pays.
-- =============================================================================
--
-- POURQUOI. Le référentiel rangeait trente-neuf des cinquante-cinq destinations
-- africaines du relevé fDi dans un seul casier, « Afrique subsaharienne », les
-- autres se partageant « Afrique du Nord » et « Afrique de l'Est ». Un filtre
-- qui propose un groupe de trente-neuf lignes n'est pas un classement, c'est
-- une liste avec un titre. La colonne region_geo sert au filtre des pays des
-- Investissements projetés, mais aussi aux groupements et aux agrégats
-- statistiques : la corriger les sert tous.
--
-- LE DÉCOUPAGE RETENU est celui de la division statistique des Nations unies
-- (M49), qui est aussi celui de la CNUCED — dont la plateforme porte déjà les
-- données et jusqu'au nom des pays (ref_pays.nom_cnuced). Prendre le même
-- découpage que la source des chiffres évite qu'un total lu ici diffère d'un
-- total lu là-bas pour la seule raison qu'on n'a pas rangé les pays pareil.
--
--   Afrique du Nord     7   Afrique centrale    9
--   Afrique de l'Ouest 17   Afrique de l'Est   21   Afrique australe   5
--
-- UN POINT QUI SURPRENDRA, et qu'il vaut mieux savoir que découvrir : le M49
-- range la Zambie, le Zimbabwe, le Malawi et le Mozambique en Afrique de
-- l'EST, non en Afrique australe, laquelle ne compte que cinq pays. C'est la
-- convention onusienne, pas une inadvertance. La Mauritanie va à l'Ouest et le
-- Soudan au Nord, pour la même raison.
--
-- L'ORDRE DES OPÉRATIONS N'EST PAS INDIFFÉRENT. Un trigger (sync_on_pays_change)
-- surveille region_geo : quand elle change, il retire le pays du groupement de
-- l'ancienne région et l'inscrit dans celui de la nouvelle — mais SEULEMENT si
-- une ligne de ref_groupements porte ce nom. Créer les groupements APRÈS les
-- mises à jour laisserait donc chaque pays sans groupement régional, en
-- silence. Ils sont donc créés d'abord.
--
-- LES PAYS SONT DÉSIGNÉS PAR LEUR CODE ISO3, jamais par leur nom ni par leur
-- continent : le nom s'écrit de plusieurs façons, et une erreur de continent
-- dans le référentiel emporterait la mise à jour avec elle. « XSL » est le code
-- privé donné au Somaliland par la migration 142.
--
-- IDEMPOTENTE : rejouable sans effet second. Un pays déjà dans sa région n'est
-- pas réécrit — la condition « IS DISTINCT FROM » évite de déclencher le
-- trigger pour rien, donc de recalculer des agrégats qui n'ont pas bougé.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── 1. Les groupements, AVANT les pays (cf. ci-dessus) ───────────────────────
-- Le code suit la convention du référentiel : nom en majuscules, sans accent,
-- tout ce qui n'est pas alphanumérique devenant « _ ».
INSERT INTO ref_groupements (code, nom_fr, description)
SELECT regexp_replace(upper(unaccent(n)), '[^A-Z0-9]+', '_', 'g'), n,
       'Regroupement géographique – Région'
FROM (VALUES ('Afrique du Nord'), ('Afrique de l''Ouest'), ('Afrique centrale'),
             ('Afrique de l''Est'), ('Afrique australe')) AS r(n)
ON CONFLICT (code) DO NOTHING;

-- ── 2. Les pays ──────────────────────────────────────────────────────────────
UPDATE ref_pays SET region_geo = 'Afrique du Nord'
 WHERE code_iso3 IN ('DZA','EGY','LBY','MAR','SDN','TUN','ESH')
   AND region_geo IS DISTINCT FROM 'Afrique du Nord';

UPDATE ref_pays SET region_geo = 'Afrique de l''Ouest'
 WHERE code_iso3 IN ('BEN','BFA','CPV','CIV','GMB','GHA','GIN','GNB','LBR','MLI',
                     'MRT','NER','NGA','SHN','SEN','SLE','TGO')
   AND region_geo IS DISTINCT FROM 'Afrique de l''Ouest';

UPDATE ref_pays SET region_geo = 'Afrique centrale'
 WHERE code_iso3 IN ('AGO','CMR','CAF','TCD','COG','COD','GNQ','GAB','STP')
   AND region_geo IS DISTINCT FROM 'Afrique centrale';

UPDATE ref_pays SET region_geo = 'Afrique de l''Est'
 WHERE code_iso3 IN ('BDI','COM','DJI','ERI','ETH','KEN','MDG','MWI','MUS','MYT',
                     'MOZ','REU','RWA','SYC','SOM','SSD','TZA','UGA','ZMB','ZWE',
                     'XSL')
   AND region_geo IS DISTINCT FROM 'Afrique de l''Est';

UPDATE ref_pays SET region_geo = 'Afrique australe'
 WHERE code_iso3 IN ('BWA','SWZ','LSO','NAM','ZAF')
   AND region_geo IS DISTINCT FROM 'Afrique australe';

-- ── 3. L'ancien casier, s'il est vide ────────────────────────────────────────
-- « Afrique subsaharienne » n'a plus de pays : le laisser afficherait un
-- groupement vide dans les écrans qui les listent. La suppression est en
-- cascade sur ref_pays_groupements, et le trigger nettoie les agrégats.
-- On ne le retire que s'il est RÉELLEMENT vide : si un pays y restait, c'est
-- que la correspondance ci-dessus l'a manqué, et l'effacer le perdrait.
DELETE FROM ref_groupements g
 WHERE g.nom_fr = 'Afrique subsaharienne'
   AND NOT EXISTS (SELECT 1 FROM ref_pays p WHERE p.region_geo = g.nom_fr);

-- ── 4. Le contrôle ───────────────────────────────────────────────────────────
-- Un pays africain qui ressortirait d'ici sans région serait invisible dans le
-- filtre — rangé sous « Autre » — et absent des agrégats régionaux. On le dit
-- fort plutôt que de le laisser passer. Un avertissement, non une erreur : le
-- référentiel peut porter des territoires que ce découpage ne nomme pas, et
-- cela ne doit pas empêcher un déploiement.
DO $$
DECLARE
    restants text;
BEGIN
    SELECT string_agg(nom_fr || ' (' || coalesce(code_iso3, 'sans ISO') || ')', ', '
                      ORDER BY nom_fr)
      INTO restants
      FROM ref_pays
     WHERE continent = 'Afrique'
       AND coalesce(region_geo, '') NOT IN ('Afrique du Nord', 'Afrique de l''Ouest',
                                            'Afrique centrale', 'Afrique de l''Est',
                                            'Afrique australe');
    IF restants IS NOT NULL THEN
        RAISE WARNING '146 — pays africains sans région après découpage : %', restants;
    END IF;
END $$;
