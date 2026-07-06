-- 100 — RBAC : rôle et modules autorisés par utilisateur.
-- Rôles : dev (développeur, défini via DEV_EMAILS, non modifiable en base),
--         admin (tout + pages admin), agent (tous les modules en consultation),
--         restreint (uniquement les modules listés dans `modules`).
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'restreint';
ALTER TABLE users ADD COLUMN IF NOT EXISTS modules TEXT[] NOT NULL DEFAULT '{}';
