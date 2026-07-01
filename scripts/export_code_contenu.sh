#!/usr/bin/env bash
# =============================================================================
# Exporte le contenu du « Code des investissements » de la base LOCALE vers une
# migration SQL (database/migrations/037_code_contenu.sql).
#
# Pourquoi : le contenu (chapitres / sections / articles) vit dans la base de
# données, pas dans le code. Les éditions faites via l'admin local restent dans
# la base locale ; la prod a sa propre base. Cette migration « fige » le contenu
# local pour qu'il soit rejoué automatiquement au déploiement.
#
# Usage (sur ta machine, avec la stack locale démarrée) :
#   bash scripts/export_code_contenu.sh
#   git add database/migrations/037_code_contenu.sql
#   git commit -m "Contenu du code des investissements" && git push
#
# Variables optionnelles :
#   CONTAINER   nom du conteneur Postgres local (défaut: apix_postgres)
#   PGUSER/PGDB identifiants (sinon lus depuis .env : POSTGRES_USER/POSTGRES_DB)
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

# Identifiants : priorité aux variables d'env, sinon .env
if [ -f .env ]; then set -a; # shellcheck disable=SC1091
  source .env; set +a; fi
PGUSER="${PGUSER:-${POSTGRES_USER:-postgres}}"
PGDB="${PGDB:-${POSTGRES_DB:-apix}}"
CONTAINER="${CONTAINER:-apix_postgres}"
OUT="database/migrations/037_code_contenu.sql"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "✗ Conteneur Postgres « $CONTAINER » introuvable. Démarre la stack locale (docker compose up -d) ou passe CONTAINER=..." >&2
  exit 1
fi

dump() {
  # Format COPY (défaut de pg_dump) : UNE ligne physique par ligne de données,
  # les retours à la ligne du contenu HTML étant échappés en \n. Bien plus
  # robuste que --inserts (dont les statements multi-lignes cassaient le filtrage).
  # On extrait uniquement le bloc « COPY ... FROM stdin; ... \. ».
  docker exec -i "$CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" \
    --data-only --no-owner --no-privileges -t "public.$1" \
    | awk '/^COPY /{p=1} p{print} /^\\\.$/{p=0}'
}

CH=$(dump code_chapitres)
SE=$(dump code_sections)
AR=$(dump code_articles)

# Nombre de lignes de données = lignes du bloc COPY moins l'en-tête et le « \. »
nb() { printf '%s' "$1" | grep -cvE '^COPY |^\\\.$' || true; }
echo "  chapitres : $(nb "$CH") · sections : $(nb "$SE") · articles : $(nb "$AR")"

if [ -z "$CH" ] && [ -z "$AR" ]; then
  echo "✗ Aucun contenu trouvé dans la base locale. Rien à exporter." >&2
  exit 1
fi

{
  echo "-- ============================================================================="
  echo "-- Migration 037 — Contenu du Code des investissements (export de la base locale)"
  echo "-- Généré par scripts/export_code_contenu.sh — NE PAS éditer à la main."
  echo "-- Rejoue le contenu (chapitres/sections/articles) tel qu'édité en local."
  echo "-- ============================================================================="
  echo "BEGIN;"
  echo ""
  echo "-- Garantit la présence de la colonne 'contenu' (le modèle l'utilise mais"
  echo "-- aucune migration ne l'ajoutait sur code_chapitres/code_sections). Idempotent."
  echo "ALTER TABLE code_chapitres ADD COLUMN IF NOT EXISTS contenu TEXT;"
  echo "ALTER TABLE code_sections  ADD COLUMN IF NOT EXISTS contenu TEXT;"
  echo ""
  echo "-- On repart d'une table propre pour éviter les doublons (le PDF n'est pas touché)."
  echo "DELETE FROM code_articles;"
  echo "DELETE FROM code_sections;"
  echo "DELETE FROM code_chapitres;"
  echo ""
  echo "-- Chapitres"
  printf '%s\n' "$CH"
  echo ""
  echo "-- Sections"
  printf '%s\n' "$SE"
  echo ""
  echo "-- Articles"
  printf '%s\n' "$AR"
  echo ""
  echo "COMMIT;"
} > "$OUT"

echo "✅ $OUT généré ($(grep -c '^INSERT' "$OUT") INSERT)."
echo "   Vérifie, puis : git add $OUT && git commit -m \"Contenu du code des investissements\" && git push"
