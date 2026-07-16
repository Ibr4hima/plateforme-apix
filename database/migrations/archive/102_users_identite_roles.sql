-- 102 — Identité des utilisateurs (prénom / nom, remplis par un admin) et
-- nouveau modèle de rôles : agent (tous les modules publics, pas d'admin),
-- admin (admin en lecture seule), admin_plus (édition sur les pages admin
-- cochées dans `modules`), dev (via DEV_EMAILS, jamais stocké).
ALTER TABLE users ADD COLUMN IF NOT EXISTS prenom TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nom TEXT;
UPDATE users SET role = 'agent' WHERE role = 'restreint';
