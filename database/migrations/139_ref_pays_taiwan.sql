-- =============================================================================
-- 139 — Taïwan au référentiel pays.
-- =============================================================================
--
-- POURQUOI. Le relevé fDi « Dest = Africa », page 168, donne Taïwan comme pays
-- d'origine d'un investissement de Hon Hai Precision (Sharp) en Égypte, août
-- 2024, 30,00 M$ et * 430 emplois dans l'électroménager. Le territoire est
-- absent de ref_pays : le seed d'origine ne retient que les États reconnus par
-- l'ONU. Sans cette ligne, l'import signale « TWN absent de ref_pays » et le
-- projet entre avec son texte brut mais sans rattachement — compté dans les
-- totaux, invisible à tout filtre par pays d'origine.
--
-- CE N'EST PAS UN DOMICILE FINANCIER, contrairement aux Bermudes et aux Îles
-- Caïmans des migrations 137 et 138. Hon Hai fabrique réellement à Taïwan et
-- l'usine égyptienne est un investissement industriel véritable. La réserve
-- écrite dans ces deux migrations ne s'applique donc pas ici : cette origine
-- peut être lue au pied de la lettre.
--
-- NOMMAGE. « Taïwan » est la graphie retenue, sans qualificatif. La question
-- du statut n'a pas à être tranchée par un référentiel technique : ce champ
-- sert à rattacher une ligne de relevé à une entrée stable, et la source écrit
-- « Taiwan ». L'entrée fdi_pays.csv fait le pont entre les deux graphies, comme
-- pour tous les autres pays.
--
-- MISE EN ŒUVRE. Continent et colonne régionale sont RECOPIÉS depuis la Chine
-- — même sous-région d'Asie orientale, et recopier garantit l'alignement sur
-- le vocabulaire que porte réellement la base plutôt que sur celui qu'on
-- suppose. La recopie est un choix de nomenclature géographique, pas une
-- position sur la souveraineté. Le nom de la colonne régionale est retrouvé au
-- lieu d'être supposé : il a changé au fil des migrations et tous les
-- environnements ne sont pas au même point. Même construction qu'en 137 et 138.
-- =============================================================================

INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr, continent)
SELECT 'TW', 'TWN', 'Taïwan', b.continent
  FROM ref_pays b
 WHERE b.code_iso3 = 'CHN'
   AND NOT EXISTS (SELECT 1 FROM ref_pays WHERE code_iso3 = 'TWN');

DO $$
DECLARE colonne text;
BEGIN
    SELECT column_name INTO colonne
      FROM information_schema.columns
     WHERE table_name = 'ref_pays' AND column_name IN ('region_geo', 'region_monde')
     LIMIT 1;
    IF colonne IS NOT NULL THEN
        EXECUTE format(
            'UPDATE ref_pays c SET %1$I = b.%1$I FROM ref_pays b '
            ' WHERE c.code_iso3 = ''TWN'' AND b.code_iso3 = ''CHN'' AND c.%1$I IS NULL',
            colonne);
    END IF;
END $$;
