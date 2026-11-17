-- =============================================================================
-- 159 — Le tableau des projets dans l'ordre de la liste fDi TRIÉE PAR DATE
-- =============================================================================
--
-- POURQUOI. Le tableau d'administration se rangeait par pays de destination
-- (index 144), parce que le premier relevé avait été fait pays par pays. Les
-- mises à jour se font désormais en capturant la liste fDi triée par DATE :
-- c'est elle qu'on a sous les yeux en vérifiant, page après page. Le tableau
-- la suit donc ligne pour ligne — l'ordre déjà mesuré et employé par la vue
-- publique : le plus récent d'abord, une saisie en tête de son mois, puis la
-- société mère dans l'ordre alphabétique de fDi, puis l'ordre du relevé.
--
-- CE QUE L'INDEX PORTE : cette clef de tri exacte, pour que Postgres rende une
-- page déjà dans l'ordre et s'arrête à la quinzième ligne au lieu de trier les
-- dix-sept mille. Chaque expression doit rester RIGOUREUSEMENT identique à
-- celles de app/api/routes/fdi_projets.py (ORDRE_FDI, SAISIE_EN_TETE,
-- CLE_SOCIETE_MERE) : au moindre écart, l'index cesserait d'être employé, sans
-- que rien ne le signale.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_fdi_projets_ordre_date ON fdi_projets (
    annee DESC,
    mois DESC NULLS LAST,
    ((origine = 'saisie')) DESC,
    (CASE WHEN origine = 'saisie' THEN created_at END) DESC,
    (translate(lower(regexp_replace(normalize(coalesce(COALESCE(NULLIF(parent_brut, ''), entreprise_brut), ''), NFKD), '[^ -~]', '', 'g')), '-''', '') COLLATE "C"),
    lot_id,
    ligne,
    id
);

COMMENT ON INDEX idx_fdi_projets_ordre_date IS
    'Ordre de la liste fDi triée par date : mois décroissant, saisies en tête, société mère, relevé. Rend une page du tableau sans trier la table.';
