-- 106 — Retrait du module « Données transactionnelles » (remplacé par une autre
-- source d'import). Suppression des tables et de leurs données.
DROP TABLE IF EXISTS stat_transactions CASCADE;
DROP TABLE IF EXISTS stat_produits CASCADE;
DROP TABLE IF EXISTS stat_unites CASCADE;
