-- 104 — Statistiques : indicateurs de commerce extérieur (marchandises & services)
-- et passage du PIB en USD bruts (import ×1 000 000). Les balances et le PIB/hab
-- sont calculés à la volée côté API.

-- PIB désormais stocké en USD bruts (avant : Md USD) → convertir l'existant.
UPDATE stat_pays SET valeur = valeur * 1000000000 WHERE indicateur = 'pib';
UPDATE stat_indicateurs SET unite = 'USD' WHERE code = 'pib';

INSERT INTO stat_indicateurs (code,libelle,unite,categorie,ordre,derive) VALUES
  ('importations_marchandises','Importations de marchandises','USD','Commerce extérieur',10,FALSE),
  ('exportations_marchandises','Exportations de marchandises','USD','Commerce extérieur',11,FALSE),
  ('balance_marchandises','Balance commerciale des marchandises','USD','Commerce extérieur',12,TRUE),
  ('importations_services','Importations de services','USD','Commerce extérieur',13,FALSE),
  ('exportations_services','Exportations de services','USD','Commerce extérieur',14,FALSE),
  ('balance_services','Balance commerciale des services','USD','Commerce extérieur',15,TRUE)
ON CONFLICT (code) DO UPDATE SET libelle=EXCLUDED.libelle,unite=EXCLUDED.unite,categorie=EXCLUDED.categorie,ordre=EXCLUDED.ordre,derive=EXCLUDED.derive;
