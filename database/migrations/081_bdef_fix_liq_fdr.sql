-- Migration 081 : BDEF — correctif extraction_key de liq_fdr
--
-- La clé 'ratio:ressources stables||actif immobilise' ne correspondait à rien
-- dans le fichier : le dénominateur réel est "actif immobilisé net" (3 mots).
-- Le mot "net" manquait → 0 valeur enregistrée pour cet indicateur.

UPDATE bdef_indicateurs SET
    extraction_key = 'ratio:ressources stables||actif immobilise net',
    source_ref     = 'RESSOURCES STABLES / ACTIF IMMOBILISE NET'
WHERE code = 'liq_fdr';
