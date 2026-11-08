-- =============================================================================
-- Migration 156 — Les traités bilatéraux s'intitulent « Sénégal x <pays> »
--
-- Le titre d'un traité bilatéral d'investissement n'est pas saisi : la page
-- d'administration le compose avec les deux pays qu'il lie. Elle écrivait
-- « Sénégal — Canada » ; elle écrit désormais « Sénégal x Canada », sur les
-- cartes comme sur les fiches. Les titres déjà enregistrés suivent — ceux-là
-- seuls, composés par la page : les autres titres sont saisis à la main.
-- =============================================================================

UPDATE accords_traites
   SET titre = 'Sénégal x ' || substr(titre, char_length('Sénégal — ') + 1)
 WHERE COALESCE(type_accord, 'tbi') = 'tbi'
   AND titre LIKE 'Sénégal — %';
