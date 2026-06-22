-- Migration 083 : BDEF — montants exprimés en FCFA réels
--
-- Le fichier source BDEF exprime tous les montants en MILLIONS de FCFA
-- (ex. une valeur de 2943 correspond à 2 943 000 000 FCFA). Les imports
-- précédents ont stocké ces valeurs brutes. On les remet à l'échelle pour
-- stocker des FCFA réels, cohérents avec l'affichage de la plateforme.
--
-- Seuls les indicateurs en unité FCFA sont concernés ; les ratios, % et
-- jours restent inchangés. Les imports ultérieurs appliquent ce facteur
-- automatiquement (cf. bdef_verification.valeur_stockee).

UPDATE bdef_valeurs v
SET valeur = valeur * 1000000
FROM bdef_indicateurs i
WHERE v.indicateur_id = i.id
  AND i.unite = 'FCFA';

UPDATE bdef_valeurs_rejetees r
SET valeur_source = valeur_source * 1000000
FROM bdef_indicateurs i
WHERE r.indicateur_id = i.id
  AND i.unite = 'FCFA';
