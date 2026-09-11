-- =============================================================================
-- Migration 150 — El Salvador au référentiel pays
--
-- UN TROU, PAS UNE OMISSION DÉLIBÉRÉE. Le seed d'origine retient les États
-- souverains, et toute l'Amérique centrale y figure — Belize, Costa Rica,
-- Guatemala, Honduras, Nicaragua, Panama. El Salvador seul manque. Rien ne
-- justifie cette exception : c'est un oubli, et il s'est vu le jour où un
-- signal d'investisseur fDi a donné le pays pour destination et n'a trouvé
-- personne à qui se rattacher.
--
-- CE QUE L'ABSENCE COÛTAIT. Un rattachement manqué ne perd pas la donnée : la
-- ligne entre avec son libellé brut et l'écran d'administration la signale.
-- Mais elle sort de tout ce qui se compte par pays — classements, filtres,
-- cartes — et « El Salvador » s'afficherait en anglais au milieu de noms
-- français. Un seul signal aujourd'hui ; la même absence en toucherait
-- d'autres demain, sans que rien ne le rappelle.
--
-- CONTINENT ET RÉGION SONT RECOPIÉS depuis le Guatemala plutôt qu'écrits en
-- dur, comme la migration 129 l'avait fait depuis la Chine pour Hong Kong et
-- Macao, et pour la même raison : le vocabulaire de ces colonnes a changé au
-- fil des migrations, et recopier garantit l'alignement sur ce que porte
-- RÉELLEMENT la base plutôt que sur ce qu'on croit qu'elle porte. Le Guatemala
-- est le voisin immédiat, du même sous-ensemble géographique.
--
-- niveau_revenu reste NULL : le déduire d'un voisin serait une invention, et
-- les groupements par revenu filtrent sur IS NOT NULL — un NULL les exclut
-- proprement au lieu de les classer à tort.
--
-- origine reste NULL, comme pour Taïwan (114) et Hong Kong (129). Surtout PAS
-- 'transaction' : cette valeur sert de file d'attente de curation des
-- partenaires créés automatiquement à l'import, et El Salvador est un ajout
-- délibéré, pas une ligne à arbitrer.
--
-- Idempotente : l'insertion est ignorée si le code ISO3 existe déjà.
--
-- Après application, relancer `scripts/fdi/importer_signaux.py` pour que la
-- destination « El Salvador » se rattache — la correspondance anglaise est
-- déclarée dans scripts/fdi/fdi_pays.csv.
-- =============================================================================

INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr, continent, region_geo, actif)
SELECT 'SV', 'SLV', 'Salvador', continent, region_geo, TRUE
FROM ref_pays WHERE code_iso3 = 'GTM'
  AND NOT EXISTS (SELECT 1 FROM ref_pays WHERE code_iso3 = 'SLV');
