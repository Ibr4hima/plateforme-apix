-- =============================================================================
-- 153 — « Arabie Saoudite » devient « Arabie saoudite ».
-- =============================================================================
--
-- POURQUOI. En français, l'adjectif d'un nom de pays ne prend pas la majuscule :
-- on écrit « Arabie saoudite » comme « Guinée équatoriale » ou « Timor
-- oriental ». Seuls les points cardinaux employés comme noms la prennent —
-- « Corée du Sud », « Afrique du Nord » —, et le référentiel les orthographie
-- déjà ainsi. La ligne fautive vient du tout premier lot de pays
-- (archive/009_ref_pays.sql) et n'avait jamais été reprise.
--
-- CE QUE CELA TOUCHE. Le nom s'affiche partout où un pays est nommé : filtres,
-- cartes, fiches, classements des trois rapports. Rien ne s'y RÉFÈRE par le
-- nom — projets, signaux et groupements pointent tous l'identifiant du pays —,
-- la correction est donc sans effet de bord.
--
-- LE SEUL AUTRE CAS DU MÊME GENRE A ÉTÉ CHERCHÉ ET N'EXISTE PAS : aucun autre
-- libellé du référentiel ne porte d'adjectif capitalisé (vérifié sur
-- Saoudite, Oriental, Occidental, Équatoriale, Centrafricaine, Démocratique,
-- Unis, Vert, Tchèque, Dominicaine).
--
-- IDEMPOTENTE : la condition porte sur la valeur fautive, donc rejouable.
-- =============================================================================

UPDATE ref_pays SET nom_fr = 'Arabie saoudite'
 WHERE code_iso3 = 'SAU' AND nom_fr = 'Arabie Saoudite';
