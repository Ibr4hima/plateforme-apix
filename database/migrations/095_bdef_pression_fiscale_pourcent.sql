-- Migration 095 : « Taux de pression fiscale » exprimé en % (au lieu de ratio)
--
-- L'indicateur BDEF sf_pression_fisc était stocké/affiché en ratio (ex: 0.185).
-- On le passe en pourcentage : unité '%' et valeurs existantes converties (×100),
-- y compris la valeur initiale conservée pour l'audit.
--
-- Le bloc est conditionné à unite='ratio' pour être rejouable sans double
-- conversion (idempotent).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM bdef_indicateurs WHERE code = 'sf_pression_fisc' AND unite = 'ratio') THEN

    UPDATE bdef_valeurs SET
      valeur          = valeur * 100,
      valeur_initiale = valeur_initiale * 100
    WHERE indicateur_id = (SELECT id FROM bdef_indicateurs WHERE code = 'sf_pression_fisc');

    UPDATE bdef_indicateurs SET unite = '%' WHERE code = 'sf_pression_fisc';

  END IF;
END $$;
