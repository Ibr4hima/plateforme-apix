-- =============================================================================
-- Migration 151 — un signal est identifié par son CONTENU, plus par son rang
--
-- CE QUI NE VA PLUS. Un signal était identifié par le couple (lot, ligne),
-- c'est-à-dire par sa POSITION dans une page de fDi. Or fDi classe par date
-- décroissante : qu'un signal nouveau paraisse, et tout descend d'un rang
-- jusqu'à la dernière page. La ligne 3 d'hier décrit aujourd'hui une autre
-- entreprise.
--
-- Tant que le relevé se constituait, la conséquence était nulle. Elle ne l'est
-- plus : 1 186 entreprises restent à arbitrer et 2 349 destinations à
-- compléter à la main, et à ce rythme-là chaque signal ajouté par la source
-- effacerait le travail de la veille. Le garde-fou d'empreinte posé jusqu'ici
-- protégeait de l'ERREUR — recoller une description sur la mauvaise entreprise
-- — mais pas de la PERTE.
--
-- CE QUI CHANGE. Une colonne `empreinte` porte la signature du contenu :
-- période, maison mère, entreprise, pays d'origine, montants, et ce que le
-- relevé écrit dans les quatre colonnes multiples. C'est elle qui identifie le
-- signal. Un réimport reconnaît chaque ligne où qu'elle soit tombée, et la
-- saisie humaine reste accrochée à la bonne.
--
-- L'INDEX EST PARTIEL, sur les empreintes non nulles, pour deux raisons : la
-- colonne se remplit au premier import qui suit cette migration, et les lignes
-- pas encore reprises ne doivent pas se heurter entre elles en attendant ; et
-- un signal saisi à la main avant d'avoir sa signature reste écrivable.
--
-- (LOT, LIGNE) PERD SON UNICITÉ, ET C'EST LE CŒUR DE LA MIGRATION. Ces deux
-- colonnes disent désormais D'OÙ VIENT la ligne — quelle page, quel rang — et
-- non plus qui elle est. Les garder uniques rendrait tout décalage impossible :
-- pendant un réimport, deux lignes revendiquent transitoirement le même rang,
-- le temps que chacune reçoive le sien. Un index simple les remplace, pour la
-- lecture par lot.
--
-- Idempotente : chaque objet est créé ou supprimé sous condition d'existence.
-- =============================================================================

ALTER TABLE fdi_signaux_investisseurs
    ADD COLUMN IF NOT EXISTS empreinte text;

COMMENT ON COLUMN fdi_signaux_investisseurs.empreinte IS
    'Signature du contenu relevé — identifie le signal, indépendamment de sa '
    'position dans la pagination de fDi. Calculée par app.services.fdi_signaux.';

ALTER TABLE fdi_signaux_investisseurs
    DROP CONSTRAINT IF EXISTS fdi_signaux_investisseurs_lot_id_ligne_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fdi_sig_empreinte
    ON fdi_signaux_investisseurs (empreinte)
    WHERE empreinte IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fdi_sig_lot_ligne
    ON fdi_signaux_investisseurs (lot_id, ligne);
