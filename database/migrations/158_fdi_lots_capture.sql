-- =============================================================================
-- Migration 158 — Les lots versés depuis une capture d'écran
--
-- POURQUOI. Une mise à jour du relevé fDi passait par une session de
-- transcription, un fichier de page dans le dépôt, un commit et un
-- déploiement : une heure de détours pour quinze lignes. L'administration
-- reçoit désormais la capture elle-même (fDi Markets → Verser une capture) :
-- l'API Claude la lit, la plateforme la vérifie contre ce qui est déjà
-- relevé, un humain valide, et le lot s'écrit en base.
--
-- CE QUE FAIT 158. Ces lots-là n'ont pas de fichier derrière eux ; il faut
-- pouvoir les reconnaître, ne serait-ce que pour les archiver un jour dans le
-- dépôt. La colonne `source` le dit déjà pour les autres provenances : elle
-- reçoit la valeur « capture ».
--
-- La contrainte est retrouvée par sa définition et non par son nom : elle a
-- été déclarée sans nom (migration 134), et le nom que Postgres lui a donné
-- n'est écrit nulle part. Rejouable : la nouvelle contrainte porte elle aussi
-- « page_html », elle est donc retirée puis reposée à l'identique.
-- =============================================================================

DO $$
DECLARE c record;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint
              WHERE conrelid = 'fdi_lots_import'::regclass AND contype = 'c'
                AND pg_get_constraintdef(oid) LIKE '%page_html%'
    LOOP
        EXECUTE format('ALTER TABLE fdi_lots_import DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE fdi_lots_import ADD CONSTRAINT fdi_lots_import_source_check
    CHECK (source IN ('saisie', 'page_html', 'export', 'capture'));
