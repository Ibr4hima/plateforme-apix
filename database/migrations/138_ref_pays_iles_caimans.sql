-- =============================================================================
-- 138 — Les Îles Caïmans au référentiel pays.
-- =============================================================================
--
-- POURQUOI. Le relevé fDi « Dest = Africa », page 105, donne les Îles Caïmans
-- comme pays d'origine d'un investissement financier en Côte d'Ivoire
-- (Invictus Capital, février 2026). Le territoire est absent de ref_pays : le
-- seed d'origine ne retient que des États souverains. Sans cette ligne,
-- l'import signale « CYM absent de ref_pays » et le projet entre avec son
-- texte brut mais sans rattachement — compté dans les totaux, invisible à
-- tout filtre par pays.
--
-- QUATRIÈME DOMICILE FINANCIER DU RELEVÉ, après les Bermudes (migration 137),
-- les Bahamas et le Vanuatu. Le motif se répète assez pour qu'il faille le
-- dire une fois pour toutes : fDi enregistre le pays d'IMMATRICULATION du
-- véhicule d'investissement, pas celui de l'actionnaire. Un classement des
-- origines qui prendrait ces lignes au pied de la lettre ferait des Caïmans
-- un investisseur en Afrique, ce qu'elles ne sont pas au sens économique.
-- Elles entrent quand même : la ligne existe chez la source, et la taire
-- serait pire que la présenter avec sa réserve.
--
-- MISE EN ŒUVRE. Continent et colonne régionale sont RECOPIÉS depuis les
-- Bahamas — même sous-région caraïbe, et recopier garantit l'alignement sur
-- le vocabulaire que porte réellement la base plutôt que sur celui qu'on
-- suppose. Le nom de la colonne régionale est retrouvé au lieu d'être
-- supposé : il a changé au fil des migrations et tous les environnements ne
-- sont pas au même point. Même construction qu'en 137, pour la même raison.
-- =============================================================================

INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr, continent)
SELECT 'KY', 'CYM', 'Îles Caïmans', b.continent
  FROM ref_pays b
 WHERE b.code_iso3 = 'BHS'
   AND NOT EXISTS (SELECT 1 FROM ref_pays WHERE code_iso3 = 'CYM');

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
            ' WHERE c.code_iso3 = ''CYM'' AND b.code_iso3 = ''BHS'' AND c.%1$I IS NULL',
            colonne);
    END IF;
END $$;
