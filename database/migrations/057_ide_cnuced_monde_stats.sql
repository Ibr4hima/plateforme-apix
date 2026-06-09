-- =============================================================================
-- Migration 057 — ide_cnuced_monde : restructuration en table d'agrégats
--                 Remplace la table de définition par une table de stats pré-calculées
--                 Jointure : ref_groupements.pays_ids ↔ ide_cnuced.ref_pays_id
-- =============================================================================

-- 1. Supprimer l'ancienne structure
DROP TABLE IF EXISTS ide_cnuced_monde;

-- 2. Créer la table finale
CREATE TABLE ide_cnuced_monde (
    id         SERIAL        PRIMARY KEY,
    code       VARCHAR(20)   NOT NULL,
    nom_fr     VARCHAR(200)  NOT NULL,
    annee      SMALLINT      NOT NULL,
    indicateur VARCHAR(10)   NOT NULL,  -- 'flux' | 'stock'
    direction  VARCHAR(10)   NOT NULL,  -- 'entrant' | 'sortant'
    moyenne    NUMERIC(16,4),
    min        NUMERIC(16,4),
    max        NUMERIC(16,4),
    variance   NUMERIC(22,4),
    ecart_type NUMERIC(16,4),
    UNIQUE (code, annee, indicateur, direction)
);

COMMENT ON TABLE ide_cnuced_monde IS 'Stats IDE pré-agrégées par groupement/zone (source : ide_cnuced × ref_groupements)';

-- 3. Peupler depuis ref_groupements × ide_cnuced
INSERT INTO ide_cnuced_monde (code, nom_fr, annee, indicateur, direction, moyenne, min, max, variance, ecart_type)
SELECT
    g.code,
    g.nom_fr,
    c.annee,
    c.indicateur,
    c.direction,
    AVG(c.valeur)         AS moyenne,
    MIN(c.valeur)         AS min,
    MAX(c.valeur)         AS max,
    VAR_POP(c.valeur)     AS variance,
    STDDEV_POP(c.valeur)  AS ecart_type
FROM ref_groupements g
JOIN ide_cnuced c
    ON  c.ref_pays_id = ANY(g.pays_ids)
    AND c.valeur IS NOT NULL
GROUP BY g.code, g.nom_fr, c.annee, c.indicateur, c.direction
ORDER BY g.code, c.annee, c.indicateur, c.direction;

-- 4. Index pour les requêtes fréquentes
CREATE INDEX idx_icm_code       ON ide_cnuced_monde (code);
CREATE INDEX idx_icm_code_annee ON ide_cnuced_monde (code, annee);
