-- Authentification : table des utilisateurs (email + mot de passe haché).
-- Restreinte aux adresses @apix.sn (contrôle applicatif côté backend).
-- Le rôle (admin / viewer) est dérivé de la variable d'env ADMIN_EMAILS,
-- on ne stocke donc pas le rôle ici pour éviter toute désynchronisation.

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
