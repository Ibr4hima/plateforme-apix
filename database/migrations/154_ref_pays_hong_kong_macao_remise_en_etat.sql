-- =============================================================================
-- Migration 154 — Hong Kong et Macao : remise en état des lignes existantes
--
-- CE QUI NE VA PAS. La migration 129 devait faire entrer Hong Kong et Macao
-- au référentiel. En production, elle a tourné au déploiement du 30/07/2026
-- mais n'a rien inséré : le journal porte « INSERT 0 0 » pour les deux.
-- Depuis, l'import NACE signale à chaque déploiement « 2 libellé(s) pays non
-- arbitré(s) : HONG-KONG, MACAO », et leurs échanges finissent dans « Autres
-- pays » de leur région — pour Hong Kong, 22,9 Md FCFA d'importations en 2025.
--
-- POURQUOI. 129 n'insère que si AUCUNE ligne ne porte déjà le code ISO3 (HKG,
-- MAC). En production, une ligne existait donc pour chacun. L'origine la plus
-- probable est l'import des transactions resourcetrade (archives 107 à 110,
-- statistiques.py) : il crée tout partenaire inconnu INACTIF, origine
-- 'transaction', sous son nom anglais. Or le rapprochement NACE ne lit que
-- les pays actifs (actif IS NOT FALSE). La ligne existante a donc fait écran
-- à 129 sans être utilisable, et rien ne l'a dit. Taïwan (139) a aussi donné
-- « INSERT 0 0 », mais pour une bonne raison : la migration 114 l'avait déjà
-- inscrit, actif et nommé en français.
--
-- CE QUE FAIT 154, pour HKG puis MAC :
--   · ligne absente → insérée comme en 129 ;
--   · ligne présente → amenée à ce que 129 voulait : active, nom français
--     (« Hong Kong », « Macao »), code ISO2 s'il est libre, continent et
--     région de la Chine s'ils manquent. L'origine 'transaction' est levée :
--     c'est un ajout délibéré au référentiel, plus une ligne de la file de
--     curation des transactions.
-- La ligne est modifiée EN PLACE : son identifiant, et donc tout ce qui s'y
-- rattache (transactions, projets fDi), ne change pas. L'ancien nom passe dans
-- nom_cnuced s'il est libre, comme le fait l'écran de curation des
-- partenaires : un import futur de transactions, en anglais, retrouve la
-- ligne par ce nom comme par son code. niveau_revenu n'est pas touché (cf.
-- 129 : celui de la Chine serait faux pour Hong Kong).
--
-- ELLE DIT CE QU'ELLE TROUVE ET CE QU'ELLE FAIT (NOTICE, lisible dans le
-- journal de déploiement) : l'état réel de la production, qu'on ne peut pas
-- interroger d'ici, y sera écrit.
--
-- Référentiel vide (base neuve, schéma seul) : ne fait rien. Rejouée : ne
-- change plus rien.
--
-- L'import NACE suit les migrations, dans deploy.sh comme dans maj_local.sh :
-- au même passage, HONG-KONG et MACAO se rattachent.
-- =============================================================================

DO $$
DECLARE
    continent_chine text;
    region_chine    text;
    cible           record;
    p               record;
    iso2_libre      text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ref_pays) THEN
        RAISE NOTICE '154 · référentiel pays vide : rien à faire';
        RETURN;
    END IF;

    SELECT continent, region_geo INTO continent_chine, region_chine
      FROM ref_pays WHERE code_iso3 = 'CHN';

    FOR cible IN
        SELECT * FROM (VALUES ('HK', 'HKG', 'Hong Kong'),
                              ('MO', 'MAC', 'Macao')) AS v (iso2, iso3, nom)
    LOOP
        -- Le code ISO2 est unique : il n'est posé que s'il est libre.
        iso2_libre := CASE WHEN EXISTS (SELECT 1 FROM ref_pays WHERE code_iso2 = cible.iso2)
                           THEN NULL ELSE cible.iso2 END;

        SELECT * INTO p FROM ref_pays WHERE code_iso3 = cible.iso3;
        IF NOT FOUND THEN
            INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr, continent, region_geo, actif)
            VALUES (iso2_libre, cible.iso3, cible.nom,
                    COALESCE(continent_chine, 'Asie'), region_chine, TRUE);
            RAISE NOTICE '154 · % : absent du référentiel, ajouté', cible.nom;
            CONTINUE;
        END IF;

        RAISE NOTICE '154 · % : ligne % trouvée — nom « % », actif %, origine %, iso2 %, continent %, région %',
            cible.nom, p.id, p.nom_fr, p.actif, p.origine, p.code_iso2, p.continent, p.region_geo;

        UPDATE ref_pays
           SET actif      = TRUE,
               nom_cnuced = CASE WHEN nom_cnuced IS NULL AND nom_fr <> cible.nom
                                 THEN nom_fr ELSE nom_cnuced END,
               nom_fr     = cible.nom,
               code_iso2  = COALESCE(code_iso2, iso2_libre),
               continent  = COALESCE(continent, continent_chine, 'Asie'),
               region_geo = COALESCE(region_geo, region_chine),
               origine    = CASE WHEN origine = 'transaction' THEN NULL ELSE origine END
         WHERE id = p.id
           AND (actif IS NOT TRUE
                OR nom_fr <> cible.nom
                OR origine = 'transaction'
                OR (code_iso2 IS NULL AND iso2_libre IS NOT NULL)
                OR continent IS NULL
                OR (region_geo IS NULL AND region_chine IS NOT NULL));
        IF FOUND THEN
            RAISE NOTICE '154 · % : remis en état — actif, nommé « % »', cible.nom, cible.nom;
        ELSE
            RAISE NOTICE '154 · % : déjà conforme, rien à changer', cible.nom;
        END IF;
    END LOOP;
END $$;
