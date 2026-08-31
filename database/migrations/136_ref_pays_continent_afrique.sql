-- =============================================================================
-- 136 — Compléter `ref_pays.continent` pour toute l'Afrique.
-- =============================================================================
--
-- CE QUI SE CASSAIT SANS ÇA. Depuis la migration 135, un lot de projets fDi
-- peut avoir pour périmètre une ZONE : « Dest = Africa » rend complet chacun
-- des pays africains. La route publique résout ce périmètre par
--
--     SELECT nom_fr FROM ref_pays WHERE nom_fr = ANY(...) OR continent = ANY(...)
--
-- et n'offre au choix que les pays ainsi rendus complets. Or `continent`
-- n'était renseigné que pour DIX-HUIT pays africains — ceux que la plateforme
-- suivait déjà — et NULL pour les trente-six autres. Le Bénin, le Cameroun,
-- la Tanzanie, l'Angola… seraient entrés en base avec leurs projets, sans
-- jamais apparaître dans le sélecteur de pays : des données importées,
-- comptées dans les totaux, et introuvables à l'écran. Rien ne l'aurait
-- signalé, puisque l'import, lui, réussit.
--
-- LE CRITÈRE EST LE CODE ISO 3166-1 alpha-3, pas le nom. Un nom se réécrit
-- (« Swaziland » → « Eswatini », « Cap-Vert » → « Cabo Verde ») ; le code, non.
-- La liste ci-dessous est celle des cinquante-quatre États africains membres
-- de l'ONU. Elle a été recoupée avec la colonne régionale déjà présente en
-- base — mêmes cinquante-quatre lignes des deux côtés, aucun écart dans un
-- sens ni dans l'autre.
--
-- IDEMPOTENTE : elle ne touche que les lignes dont le continent diffère, donc
-- la rejouer ne fait rien. Le déclencheur `trg_sync_on_pays` en profite pour
-- rattacher ces pays au groupement continental « Afrique », ce qui est leur
-- place ; aucun agrégat ne bouge pour autant, un membre sans donnée
-- n'apportant rien aux sommes.
-- =============================================================================

UPDATE ref_pays
   SET continent = 'Afrique'
 WHERE code_iso3 IN (
        'DZA','AGO','BEN','BWA','BFA','BDI','CPV','CMR','CAF','TCD',
        'COM','COG','COD','CIV','DJI','EGY','GNQ','ERI','SWZ','ETH',
        'GAB','GMB','GHA','GIN','GNB','KEN','LSO','LBR','LBY','MDG',
        'MWI','MLI','MRT','MUS','MAR','MOZ','NAM','NER','NGA','RWA',
        'STP','SEN','SYC','SLE','SOM','ZAF','SSD','SDN','TZA','TGO',
        'TUN','UGA','ZMB','ZWE')
   AND continent IS DISTINCT FROM 'Afrique';

-- Filet : si un jour le référentiel perdait des pays africains, mieux vaut
-- que la migration le dise que de laisser le sélecteur en oublier en silence.
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM ref_pays WHERE continent = 'Afrique';
    IF n < 54 THEN
        RAISE WARNING 'ref_pays ne compte que % pays africains sur 54 attendus — '
                      'les manquants ne seront pas proposés au filtre public.', n;
    END IF;
END $$;
