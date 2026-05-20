-- =============================================================================
-- Migration 030 — Enrichissement table projets
-- =============================================================================

-- ── ref_devises ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_devises (
    id      SERIAL PRIMARY KEY,
    code    VARCHAR(10)  NOT NULL UNIQUE,  -- FCFA, USD, EUR
    symbole VARCHAR(5)   NOT NULL,         -- CFA, $, €
    nom     VARCHAR(100) NOT NULL
);

INSERT INTO ref_devises (code, symbole, nom) VALUES
    ('FCFA', 'CFA', 'Franc CFA'),
    ('USD',  '$',   'Dollar américain'),
    ('EUR',  '€',   'Euro')
ON CONFLICT (code) DO NOTHING;

-- ── Nouvelles colonnes projets ────────────────────────────────────────────────
ALTER TABLE projets
    ADD COLUMN IF NOT EXISTS description        TEXT,
    ADD COLUMN IF NOT EXISTS investissement     NUMERIC(20,2),
    ADD COLUMN IF NOT EXISTS devise_id          INTEGER REFERENCES ref_devises(id),
    ADD COLUMN IF NOT EXISTS porteur_projet     VARCHAR(500);

-- ── Supprimer les colonnes MOA inline (migrer vers table dédiée) ──────────────
-- On garde moa/tel_moa/mail_moa pour compatibilité mais on migre vers
-- une table projet_moa avec la même structure que projet_coordinateurs

CREATE TABLE IF NOT EXISTS projet_moa (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id   UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    nom         VARCHAR(500),
    telephone   VARCHAR(50),
    mail        VARCHAR(255),
    ordre       INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Migrer les données existantes moa → projet_moa
INSERT INTO projet_moa (projet_id, nom, telephone, mail)
SELECT id, moa, tel_moa, mail_moa FROM projets
WHERE moa IS NOT NULL;

-- Supprimer les colonnes inline
ALTER TABLE projets
    DROP COLUMN IF EXISTS moa,
    DROP COLUMN IF EXISTS tel_moa,
    DROP COLUMN IF EXISTS mail_moa;

COMMENT ON TABLE ref_devises     IS 'Devises de référence pour les investissements';
COMMENT ON TABLE projet_moa      IS 'Maîtres d''ouvrage rattachés à un projet (0-N)';
COMMENT ON COLUMN projets.investissement IS 'Montant de l''investissement';
COMMENT ON COLUMN projets.devise_id      IS 'Devise de l''investissement';
COMMENT ON COLUMN projets.porteur_projet IS 'Nom du porteur du projet';
