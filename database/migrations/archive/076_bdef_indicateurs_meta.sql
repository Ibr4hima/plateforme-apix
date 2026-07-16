-- Migration 076 : BDEF — Métadonnées import des indicateurs
--
-- Chaque indicateur sait maintenant :
--   mode          → 'lu' | 'calcule' | 'lu_ou_calcule'
--   source_tableau → quel tableau Excel lire (Tableau A/B/C/E…)
--   source_ref     → référence/libellé exact de la colonne dans ce tableau
--   formule        → expression de calcul (NULL si mode='lu')
--   formule_vars   → noms des variables nécessaires au calcul (JSONB tableau)
--
-- Pour mode='lu_ou_calcule' : on lit en priorité ; si la cellule est vide ou
-- nulle, on calcule à partir des variables listées dans formule_vars.

ALTER TABLE bdef_indicateurs
    ADD COLUMN IF NOT EXISTS mode           VARCHAR(20) DEFAULT 'lu',
    ADD COLUMN IF NOT EXISTS source_tableau VARCHAR(150),
    ADD COLUMN IF NOT EXISTS source_ref     VARCHAR(50),
    ADD COLUMN IF NOT EXISTS formule        TEXT,
    ADD COLUMN IF NOT EXISTS formule_vars   JSONB;

-- ── Activité ──────────────────────────────────────────────────────────────────
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau B – Compte de résultat : Produits', source_ref='TI'
WHERE code='act_ca';

UPDATE bdef_indicateurs SET
    mode='calcule',
    formule='(CA_T - CA_T1) / CA_T1',
    formule_vars='["act_ca"]'
WHERE code='act_tx_ca';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau E – Autres indicateurs', source_ref='Production'
WHERE code='act_production';

UPDATE bdef_indicateurs SET
    mode='lu_ou_calcule',
    source_tableau='Tableau C – Ratios de gestion et de structure financière',
    source_ref='Taux de croissance de la production',
    formule='(Production_T - Production_T1) / Production_T1',
    formule_vars='["act_production"]'
WHERE code='act_tx_prod';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau B – Compte de résultat : Produits', source_ref='TN'
WHERE code='act_va';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière', source_ref='Taux de valeur ajoutée'
WHERE code='act_tx_va';

-- ── Rentabilité ───────────────────────────────────────────────────────────────
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau B – Compte de résultat : Produits', source_ref='TQ'
WHERE code='rent_ebe';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau B – Compte de résultat : Produits', source_ref='TX'
WHERE code='rent_rex';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière (suite)', source_ref='Rentabilité économique'
WHERE code='rent_eco';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière', source_ref='Rentabilité financière'
WHERE code='rent_fin';

-- ── Structure financière ──────────────────────────────────────────────────────
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière (suite)', source_ref='Taux de pression fiscale'
WHERE code='sf_pression_fisc';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière (suite)', source_ref='Autonomie financière'
WHERE code='sf_autonomie';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière', source_ref='Ratio de solvabilité'
WHERE code='sf_solvabilite';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière', source_ref='Poids des dettes financières'
WHERE code='sf_dettes_fin';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière', source_ref='Capacité de remboursement'
WHERE code='sf_cap_rembours';

-- ── Liquidité ─────────────────────────────────────────────────────────────────
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière (suite)', source_ref='Ratio du fonds de roulement'
WHERE code='liq_fdr';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière (suite)', source_ref='Besoin en fonds de roulement'
WHERE code='liq_bfr';

-- ── Efficacité ────────────────────────────────────────────────────────────────
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière', source_ref='Productivité du travail'
WHERE code='eff_prod_travail';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière', source_ref='Productivité du capital'
WHERE code='eff_prod_capital';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau C – Ratios de gestion et de structure financière (suite)', source_ref='Taux de vétusté'
WHERE code='eff_vetuste';

UPDATE bdef_indicateurs SET
    mode='calcule',
    formule='(Stocks_MP / Achats_HT) * 360',
    formule_vars='["_raw_stocks_mp", "_raw_achats_ht"]'
WHERE code='eff_stock_mp';

UPDATE bdef_indicateurs SET
    mode='calcule',
    formule='(Stocks_March / Achats_HT) * 360',
    formule_vars='["_raw_stocks_march", "_raw_achats_ht"]'
WHERE code='eff_stock_march';

UPDATE bdef_indicateurs SET
    mode='calcule',
    formule='(Stocks_PF / CA_HT) * 360',
    formule_vars='["_raw_stocks_pf", "_raw_ca_ht"]'
WHERE code='eff_stock_pf';

-- ── Investissement ────────────────────────────────────────────────────────────
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau A – Bilan : Actif', source_ref='AZ'
WHERE code='inv_actif_immo';

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='Tableau B – Compte de résultat : Charges', source_ref='RS'
WHERE code='inv_amortiss';

UPDATE bdef_indicateurs SET
    mode='calcule',
    formule='(CAF / Investissements) * 100',
    formule_vars='["_raw_caf", "inv_actif_immo"]'
WHERE code='inv_tx_autofin';

-- ── Variables brutes nécessaires aux calculs (non affichées, stockage temporaire)
-- Ces lignes de la table seront utilisées par l'import pour porter les valeurs
-- intermédiaires (Achats HT, CAF, stocks…) qui alimentent les formules.
-- On les préfixe "_raw_" pour les distinguer des indicateurs publiés.
-- Elles auront ordre=999 pour ne pas apparaître dans l'UI.

INSERT INTO bdef_indicateurs (code, libelle, unite, categorie_id, ordre) VALUES
  ('_raw_achats_ht',    'Achats HT (usage calcul uniquement)',            'FCFA', (SELECT id FROM bdef_indicateur_categories WHERE code='efficacite'),   999),
  ('_raw_stocks_mp',    'Stocks matières premières (usage calcul)',        'FCFA', (SELECT id FROM bdef_indicateur_categories WHERE code='efficacite'),   999),
  ('_raw_stocks_march', 'Stocks marchandises (usage calcul)',              'FCFA', (SELECT id FROM bdef_indicateur_categories WHERE code='efficacite'),   999),
  ('_raw_stocks_pf',    'Stocks produits finis (usage calcul)',            'FCFA', (SELECT id FROM bdef_indicateur_categories WHERE code='efficacite'),   999),
  ('_raw_ca_ht',        'CA HT (usage calcul)',                           'FCFA', (SELECT id FROM bdef_indicateur_categories WHERE code='activites'),     999),
  ('_raw_caf',          'Capacité d''autofinancement globale (usage calcul)','FCFA',(SELECT id FROM bdef_indicateur_categories WHERE code='investissement'),999)
ON CONFLICT (code) DO NOTHING;

UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='À confirmer selon structure Excel réelle', source_ref='Achats HT'
WHERE code='_raw_achats_ht';
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='À confirmer selon structure Excel réelle', source_ref='Stocks matières premières'
WHERE code='_raw_stocks_mp';
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='À confirmer selon structure Excel réelle', source_ref='Stocks marchandises'
WHERE code='_raw_stocks_march';
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='À confirmer selon structure Excel réelle', source_ref='Stocks produits finis'
WHERE code='_raw_stocks_pf';
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='À confirmer selon structure Excel réelle', source_ref='CA HT'
WHERE code='_raw_ca_ht';
UPDATE bdef_indicateurs SET
    mode='lu', source_tableau='À confirmer selon structure Excel réelle', source_ref='CAF'
WHERE code='_raw_caf';
