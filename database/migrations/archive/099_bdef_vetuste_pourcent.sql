-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 099 — Taux de vétusté exprimé en pourcentage
--                 (unité 'ratio' → '%', valeurs existantes × 100)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE bdef_indicateurs SET unite = '%' WHERE code = 'eff_vetuste' AND unite <> '%';

UPDATE bdef_valeurs
SET valeur = valeur * 100
WHERE indicateur_id = (SELECT id FROM bdef_indicateurs WHERE code = 'eff_vetuste')
  AND valeur IS NOT NULL
  AND ABS(valeur) <= 2;  -- garde-fou : ne convertit que les valeurs encore en ratio
