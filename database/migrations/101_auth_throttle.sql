-- 101 — Anti-force-brute : compteurs d'échecs et verrouillages progressifs,
-- par compte (login:<email>) et par adresse IP (login-ip:<ip>, register-ip:<ip>).
CREATE TABLE IF NOT EXISTS auth_throttle (
    cle               TEXT PRIMARY KEY,
    echecs            INTEGER NOT NULL DEFAULT 0,
    dernier_echec     TIMESTAMPTZ,
    verrouille_jusqua TIMESTAMPTZ
);
