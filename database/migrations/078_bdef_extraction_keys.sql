-- Migration 078 : BDEF — clé d'extraction machine-readable par indicateur
--
-- Ajoute la colonne extraction_key : c'est la clé produite par le parseur
-- bdef_excel.py (format 'ref:XX' | 'lib:...' | 'ratio:<num>||<den>').
-- La couche de mapping l'utilise pour retrouver la valeur dans les blocs
-- extraits, sans dépendre de libellés humains ni de numéros de colonnes.
--
-- Contrainte de longueur : certains ratio-clés dépassent 50 chars
-- (ex. 'ratio:total amortissements et provisions||total actif immobilise brut'
--  = 69 chars). La colonne source_ref existante (50 chars) est donc trop
-- courte pour les clés machine ; on ajoute extraction_key (200 chars) et on
-- conserve source_ref pour le libellé humain.

ALTER TABLE bdef_indicateurs
    ADD COLUMN IF NOT EXISTS extraction_key VARCHAR(200);

-- ── Comptes B – PRODUITS ──────────────────────────────────────────────────────
UPDATE bdef_indicateurs SET extraction_key='ref:TI', source_ref='TI',
    source_tableau='EDITIONS COMPTES — B PRODUITS'
WHERE code='act_ca';

UPDATE bdef_indicateurs SET extraction_key='ref:TN', source_ref='TN',
    source_tableau='EDITIONS COMPTES — B PRODUITS'
WHERE code='act_va';

UPDATE bdef_indicateurs SET extraction_key='ref:TQ', source_ref='TQ',
    source_tableau='EDITIONS COMPTES — B PRODUITS'
WHERE code='rent_ebe';

UPDATE bdef_indicateurs SET extraction_key='ref:TX', source_ref='TX',
    source_tableau='EDITIONS COMPTES — B PRODUITS'
WHERE code='rent_rex';

-- ── Comptes A – ACTIF ─────────────────────────────────────────────────────────
UPDATE bdef_indicateurs SET extraction_key='ref:AZ', source_ref='AZ',
    source_tableau='EDITIONS COMPTES — A ACTIF'
WHERE code='inv_actif_immo';

-- ── Comptes B – CHARGES ───────────────────────────────────────────────────────
UPDATE bdef_indicateurs SET extraction_key='ref:RS', source_ref='RS',
    source_tableau='EDITIONS COMPTES — B CHARGES'
WHERE code='inv_amortiss';

-- ── RATIOS E – Autres indicateurs ─────────────────────────────────────────────
UPDATE bdef_indicateurs SET
    extraction_key='lib:production',
    source_ref='Production',
    source_tableau='EDITIONS RATIOS — E Autres indicateurs'
WHERE code='act_production';

-- ── RATIOS D – CAF / Trésorerie ───────────────────────────────────────────────
UPDATE bdef_indicateurs SET
    extraction_key='lib:capacite d autofinancement global cafg',
    source_ref='Capacité d''autofinancement globale (CAFG)',
    source_tableau='EDITIONS RATIOS — D CAF et trésorerie'
WHERE code='_raw_caf';

-- ── RATIOS C – fractions ──────────────────────────────────────────────────────
UPDATE bdef_indicateurs SET
    extraction_key='ratio:production n production n 1||production n 1',
    source_ref='PRODUCTION (N) - PRODUCTION (N-1) / PRODUCTION (N-1)',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='act_tx_prod';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:valeur ajoutee||production',
    source_ref='VALEUR AJOUTEE / PRODUCTION',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='act_tx_va';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:resultat d exploitation||actif immobilise bfr',
    source_ref='RESULTAT D''EXPLOITATION / (ACTIF IMMOBILISE + BFR)',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='rent_eco';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:resultat net||capitaux propres',
    source_ref='RESULTAT NET / CAPITAUX PROPRES',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='rent_fin';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:impots et taxes||valeur ajoutee',
    source_ref='IMPOTS ET TAXES / VALEUR AJOUTEE',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='sf_pression_fisc';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:capitaux propres||emprunts',
    source_ref='CAPITAUX PROPRES / EMPRUNTS',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='sf_autonomie';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:capitaux propres||capitaux stables',
    source_ref='CAPITAUX PROPRES / CAPITAUX STABLES',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='sf_solvabilite';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:dettes financieres||total passif',
    source_ref='DETTES FINANCIERES / TOTAL PASSIF',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='sf_dettes_fin';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:caf||dettes financieres',
    source_ref='CAF / DETTES FINANCIERES',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='sf_cap_rembours';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:ressources stables||actif immobilise',
    source_ref='RESSOURCES STABLES / ACTIF IMMOBILISE',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='liq_fdr';

-- BFR : valeur FCFA qui apparaît dans la table C avec dénominateur vide
UPDATE bdef_indicateurs SET
    extraction_key='ratio:bfr||',
    source_ref='BFR (valeur FCFA, dans tableau C)',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='liq_bfr';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:valeur ajoutee||frais de personnel',
    source_ref='VALEUR AJOUTEE / FRAIS DE PERSONNEL',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='eff_prod_travail';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:valeur ajoutee||dotations aux amortissements',
    source_ref='VALEUR AJOUTEE / DOTATIONS AUX AMORTISSEMENTS',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='eff_prod_capital';

UPDATE bdef_indicateurs SET
    extraction_key='ratio:total amortissements et provisions||total actif immobilise brut',
    source_ref='AMORT. ET PROV. / TOTAL ACTIF IMMO. BRUT',
    source_tableau='EDITIONS RATIOS — C Ratios'
WHERE code='eff_vetuste';

-- ── Calculés purs (pas de clé d'extraction) ───────────────────────────────────
-- act_tx_ca : (CA_T - CA_{T-1}) / CA_{T-1}  — dépend de act_ca (chronologique)
-- inv_tx_autofin : (CAFG / AZ) * 100         — dépend de _raw_caf et inv_actif_immo
-- eff_stock_* : non disponibles dans le fichier 2024 ; les stocks MP/march/PF
--               ne sont pas exposés séparément dans le BDEF actuel.
--               À réévaluer sur le fichier multi-années.
UPDATE bdef_indicateurs SET extraction_key=NULL
WHERE code IN ('act_tx_ca','inv_tx_autofin',
               'eff_stock_mp','eff_stock_march','eff_stock_pf');
