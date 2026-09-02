-- =============================================================================
-- 142 — Le Somaliland au référentiel pays, sous un code hors ISO.
-- =============================================================================
--
-- POURQUOI. Le relevé fDi « Dest = Africa », page 383, donne le Somaliland
-- comme pays d'origine d'un investissement d'Amanah Insurance au Kenya, juillet
-- 2023, * 10,80 M$ et * 78 emplois dans l'assurance. Le territoire est absent
-- de ref_pays et de la correspondance : l'import signalait « Somaliland → hors
-- correspondance », et le projet entrait avec son texte brut mais sans
-- rattachement — compté dans les totaux, invisible à tout filtre par origine.
--
-- CE QUE L'APIX A TRANCHÉ. Une entrée PROPRE, et non un rattachement à la
-- Somalie. Les deux se défendaient : la Somalie est la lecture du droit
-- international, l'entrée propre est la lecture de la source. L'APIX a retenu
-- la seconde, et le référentiel s'y tient sans commenter.
--
-- Ce choix a une conséquence qu'il vaut mieux écrire que découvrir : les
-- montants venus du Somaliland ne s'agrègent PAS à ceux de la Somalie. Une
-- restitution qui parlerait de « la Somalie » devra donc dire laquelle des deux
-- lignes elle additionne — ou les additionner explicitement.
--
-- LE CODE. Le Somaliland n'a pas de code ISO 3166 : aucun ne lui est assigné,
-- et ce n'est pas au référentiel d'en inventer un qui aurait l'air officiel.
-- Mais toute la chaîne de rapprochement fDi passe par code_iso3 — c'est lui qui
-- fait le pont entre le libellé anglais de la source et l'entrée en base — et
-- une entrée sans code serait invisible au rapprochement, donc inutile.
--
-- On emploie donc « XSL », pris dans la plage XAA–XZZ que la norme ISO 3166-1
-- RÉSERVE aux usages privés, précisément pour les cas comme celui-ci. Le X
-- initial est le signal : ce n'est pas un code assigné, c'est le nôtre. Aucun
-- pays ne le portera jamais, et personne ne peut le confondre avec une
-- reconnaissance.
--
-- code_iso2 reste NUL, faute d'équivalent honnête sur deux lettres : le
-- composant d'affichage rend alors un globe plutôt qu'un drapeau inventé.
--
-- MISE EN ŒUVRE. Continent et colonne régionale sont RECOPIÉS depuis la
-- Somalie — même sous-région, et recopier garantit l'alignement sur le
-- vocabulaire que porte réellement la base plutôt que sur celui qu'on suppose.
-- La recopie est un choix de nomenclature géographique, pas une position sur la
-- souveraineté. Le nom de la colonne régionale est retrouvé au lieu d'être
-- supposé : il a changé au fil des migrations et tous les environnements ne
-- sont pas au même point. Même construction qu'en 137, 138 et 139.
-- =============================================================================

INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr, continent)
SELECT NULL, 'XSL', 'Somaliland', b.continent
  FROM ref_pays b
 WHERE b.code_iso3 = 'SOM'
   AND NOT EXISTS (SELECT 1 FROM ref_pays WHERE code_iso3 = 'XSL');

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
            ' WHERE c.code_iso3 = ''XSL'' AND b.code_iso3 = ''SOM'' AND c.%1$I IS NULL',
            colonne);
    END IF;
END $$;
