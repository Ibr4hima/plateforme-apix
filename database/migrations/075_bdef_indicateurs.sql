-- Migration 075 : BDEF — Seed des 26 indicateurs
--
-- Mêmes indicateurs pour tous les niveaux de lecture
-- (global · macro-secteur · groupe · secteur d'activité).
-- Unités : FCFA | % | ratio | jours

INSERT INTO bdef_indicateurs (code, libelle, unite, categorie_id, ordre) VALUES

  -- ── Activité (6) ──────────────────────────────────────────────────────────
  ('act_ca',          'Chiffre d''affaires',                  'FCFA',  (SELECT id FROM bdef_indicateur_categories WHERE code='activites'),    1),
  ('act_tx_ca',       'Taux de croissance du CA',             '%',     (SELECT id FROM bdef_indicateur_categories WHERE code='activites'),    2),
  ('act_production',  'Production',                           'FCFA',  (SELECT id FROM bdef_indicateur_categories WHERE code='activites'),    3),
  ('act_tx_prod',     'Taux de croissance de la production',  '%',     (SELECT id FROM bdef_indicateur_categories WHERE code='activites'),    4),
  ('act_va',          'Valeur ajoutée',                       'FCFA',  (SELECT id FROM bdef_indicateur_categories WHERE code='activites'),    5),
  ('act_tx_va',       'Taux de valeur ajoutée',               'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='activites'),    6),

  -- ── Rentabilité (4) ───────────────────────────────────────────────────────
  ('rent_ebe',        'Excédent brut d''exploitation',        'FCFA',  (SELECT id FROM bdef_indicateur_categories WHERE code='rentabilite'),  1),
  ('rent_rex',        'Résultat d''exploitation',             'FCFA',  (SELECT id FROM bdef_indicateur_categories WHERE code='rentabilite'),  2),
  ('rent_eco',        'Rentabilité économique',               'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='rentabilite'),  3),
  ('rent_fin',        'Rentabilité financière',               'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='rentabilite'),  4),

  -- ── Structure financière (5) ──────────────────────────────────────────────
  ('sf_pression_fisc','Taux de pression fiscale',             'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='structure_financiere'), 1),
  ('sf_autonomie',    'Autonomie financière',                 'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='structure_financiere'), 2),
  ('sf_solvabilite',  'Ratio de solvabilité',                 'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='structure_financiere'), 3),
  ('sf_dettes_fin',   'Poids des dettes financières',         'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='structure_financiere'), 4),
  ('sf_cap_rembours', 'Capacité de remboursement',            'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='structure_financiere'), 5),

  -- ── Liquidité (2) ─────────────────────────────────────────────────────────
  ('liq_fdr',         'Fonds de roulement',                   'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='liquidite'),   1),
  ('liq_bfr',         'Besoin en fonds de roulement',         'FCFA',  (SELECT id FROM bdef_indicateur_categories WHERE code='liquidite'),   2),

  -- ── Efficacité (6) ────────────────────────────────────────────────────────
  ('eff_prod_travail','Productivité du travail',               'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='efficacite'),  1),
  ('eff_prod_capital','Productivité du capital',               'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='efficacite'),  2),
  ('eff_vetuste',     'Taux de vétusté',                      'ratio', (SELECT id FROM bdef_indicateur_categories WHERE code='efficacite'),  3),
  ('eff_stock_mp',    'Délai rotation stocks matières premières','jours',(SELECT id FROM bdef_indicateur_categories WHERE code='efficacite'),  4),
  ('eff_stock_march', 'Délai rotation stocks marchandises',   'jours', (SELECT id FROM bdef_indicateur_categories WHERE code='efficacite'),  5),
  ('eff_stock_pf',    'Délai rotation stocks produits finis', 'jours', (SELECT id FROM bdef_indicateur_categories WHERE code='efficacite'),  6),

  -- ── Investissement (3) ────────────────────────────────────────────────────
  ('inv_actif_immo',  'Total actif immobilisé',               'FCFA',  (SELECT id FROM bdef_indicateur_categories WHERE code='investissement'), 1),
  ('inv_amortiss',    'Amortissements',                       'FCFA',  (SELECT id FROM bdef_indicateur_categories WHERE code='investissement'), 2),
  ('inv_tx_autofin',  'Taux d''autofinancement',              '%',     (SELECT id FROM bdef_indicateur_categories WHERE code='investissement'), 3)

ON CONFLICT (code) DO NOTHING;
