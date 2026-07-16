-- Migration 067 : Déduplication des prospects
--   * Ancre d'identité : site web + LinkedIn
--   * Ownership : colonne agent_id (préparée pour le futur système d'authentification)
--   * Table normalisée prospect_contacts : chaque téléphone / mail / site / linkedin
--     stocké en une ligne, avec contrainte UNIQUE(type, valeur_normalisee) qui
--     garantit au niveau base qu'aucun doublon ne peut exister, même en cas de
--     saisies simultanées par deux agents.

-- ── 1. Nouveaux champs sur prospects ──────────────────────────────────────────
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS linkedin TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agent_id INTEGER;  -- ownership (auth à venir)

-- ── 2. Table normalisée des coordonnées ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospect_contacts (
  id                SERIAL PRIMARY KEY,
  prospect_id       INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  type              VARCHAR(20) NOT NULL,   -- telephone | email | siteweb | linkedin
  valeur_normalisee TEXT NOT NULL,          -- valeur nettoyée servant à la comparaison
  valeur_affichee   TEXT NOT NULL,          -- valeur d'origine (pour les messages)
  origine           VARCHAR(20) DEFAULT 'entreprise',  -- entreprise | point_focal
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Contrainte clé : unicité globale par type de coordonnée.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_prospect_contacts_type_val
  ON prospect_contacts(type, valeur_normalisee);
CREATE INDEX IF NOT EXISTS idx_prospect_contacts_prospect
  ON prospect_contacts(prospect_id);

-- ── 3. Backfill des données existantes ────────────────────────────────────────
-- Les règles de normalisation ci-dessous doivent rester IDENTIQUES à celles du
-- backend (app/utils/dedup.py), sinon un doublon pourrait passer entre les mailles.
-- ON CONFLICT DO NOTHING : si des doublons existent déjà dans les données, on
-- garde la première occurrence sans faire échouer la migration.

-- Téléphones de l'entreprise/personne : on ne garde que chiffres et +, 00 -> +
INSERT INTO prospect_contacts (prospect_id, type, valeur_normalisee, valeur_affichee, origine)
SELECT p.id, 'telephone',
       regexp_replace(regexp_replace(tel, '[^0-9+]', '', 'g'), '^00', '+'),
       tel, 'entreprise'
FROM prospects p, unnest(COALESCE(p.telephones, '{}')) AS tel
WHERE regexp_replace(regexp_replace(tel, '[^0-9+]', '', 'g'), '^00', '+') <> ''
ON CONFLICT (type, valeur_normalisee) DO NOTHING;

-- Mails de l'entreprise/personne : minuscules + trim
INSERT INTO prospect_contacts (prospect_id, type, valeur_normalisee, valeur_affichee, origine)
SELECT p.id, 'email', lower(trim(m)), m, 'entreprise'
FROM prospects p, unnest(COALESCE(p.mails, '{}')) AS m
WHERE lower(trim(m)) <> ''
ON CONFLICT (type, valeur_normalisee) DO NOTHING;

-- Téléphones des points focaux
INSERT INTO prospect_contacts (prospect_id, type, valeur_normalisee, valeur_affichee, origine)
SELECT pf.prospect_id, 'telephone',
       regexp_replace(regexp_replace(tel, '[^0-9+]', '', 'g'), '^00', '+'),
       tel, 'point_focal'
FROM prospect_points_focaux pf, unnest(COALESCE(pf.telephones, '{}')) AS tel
WHERE regexp_replace(regexp_replace(tel, '[^0-9+]', '', 'g'), '^00', '+') <> ''
ON CONFLICT (type, valeur_normalisee) DO NOTHING;

-- Mails des points focaux
INSERT INTO prospect_contacts (prospect_id, type, valeur_normalisee, valeur_affichee, origine)
SELECT pf.prospect_id, 'email', lower(trim(m)), m, 'point_focal'
FROM prospect_points_focaux pf, unnest(COALESCE(pf.mails, '{}')) AS m
WHERE lower(trim(m)) <> ''
ON CONFLICT (type, valeur_normalisee) DO NOTHING;

-- Sites web : domaine seul (sans protocole, sans www., sans chemin)
INSERT INTO prospect_contacts (prospect_id, type, valeur_normalisee, valeur_affichee, origine)
SELECT p.id, 'siteweb',
       regexp_replace(regexp_replace(regexp_replace(lower(trim(p.siteweb)), '^https?://', ''), '^www\.', ''), '/.*$', ''),
       p.siteweb, 'entreprise'
FROM prospects p
WHERE p.siteweb IS NOT NULL
  AND regexp_replace(regexp_replace(regexp_replace(lower(trim(p.siteweb)), '^https?://', ''), '^www\.', ''), '/.*$', '') <> ''
ON CONFLICT (type, valeur_normalisee) DO NOTHING;
