-- =============================================================================
-- 144 — L'ordre de fDi, en base, pour ne plus envoyer le relevé entier.
-- =============================================================================
--
-- POURQUOI. Le tableau des projets annoncés triait, filtrait et découpait dans
-- le navigateur. Cela supposait de lui envoyer les seize mille huit cents
-- lignes pour en afficher quinze : onze méga-octets et près d'une seconde à
-- chaque ouverture de l'écran. Le tri passe donc en base — mais trier seize
-- mille lignes à chaque page tournée ne vaudrait guère mieux. Il faut que
-- Postgres puisse les rendre DÉJÀ dans l'ordre et s'arrêter à la quinzième.
--
-- CE QUE L'INDEX PORTE. La clef de tri exacte du tableau, et rien d'autre :
--
--   1. le libellé BRUT de la destination, réduit — décomposé, dépouillé de
--      tout ce qui n'est pas ASCII imprimable, puis mis en minuscules ;
--   2. la date, du plus récent au plus ancien ;
--   3. le lot puis le rang, c'est-à-dire l'ordre du relevé.
--
-- POURQUOI LE LIBELLÉ BRUT, ET RÉDUIT. Le tableau se lit par pays, et l'ordre
-- doit être celui de fDi, parce que le geste quotidien est le rapprochement
-- page à page avec la source. Or fDi range ses destinations sur SES propres
-- libellés, qui ne sont pas d'une seule langue : « South Africa » en anglais,
-- « Côte d Ivoire » en français. Trier sur nos noms français mettrait
-- l'Afrique du Sud en tête au lieu de l'Algérie.
--
-- La réduction n'est pas une commodité : c'est elle qui reproduit l'ordre de la
-- source. Le libellé brut tel quel échoue dès « São Tomé », que fDi range avant
-- « Senegal » alors que « São » se classe après « Se » sur les octets. Les deux
-- écritures — celle du navigateur et celle-ci — ont été comparées rang par rang
-- sur les 55 destinations du relevé : ordre identique, ce cas compris.
--
-- L'expression doit rester RIGOUREUSEMENT identique à celle de
-- app/api/routes/fdi_projets.py (constante CLE_DEST) : au moindre écart,
-- Postgres n'y verrait plus le même calcul, l'index cesserait d'être employé,
-- et l'écran retomberait au tri complet sans que rien ne le signale — une
-- lenteur muette, la pire espèce.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_fdi_projets_ordre_fdi ON fdi_projets (
    (lower(regexp_replace(normalize(coalesce(pays_dest_brut, ''), NFKD), '[^ -~]', '', 'g'))),
    annee DESC,
    mois DESC NULLS LAST,
    lot_id,
    ligne
);

COMMENT ON INDEX idx_fdi_projets_ordre_fdi IS
    'Ordre du tableau des projets : destination telle que fDi la range, puis date décroissante, puis ordre du relevé. Permet de rendre une page sans trier la table.';
