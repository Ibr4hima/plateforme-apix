#!/usr/bin/env bash
# =============================================================================
# Baseline du schéma — règle la dérive migrations ↔ base réelle.
#
# Ce script :
#   1. dump le schéma de la base RÉELLE (pg_dump --schema-only) ;
#   2. l'écrit dans database/migrations/116_baseline_schema.sql ;
#   3. archive les migrations 001–115 dans database/migrations/archive/
#      (docker-entrypoint-initdb.d ne lit pas les sous-dossiers : une base
#      vierge ne jouera plus QUE la baseline, puis les 117+ à venir).
#
# À lancer depuis la racine du projet, contre la base LA PLUS À JOUR
# (la prod de préférence, ou la locale si elle en est une copie fidèle) :
#   ./database/scripts/generer_baseline.sh                    # local (apix_postgres)
#   CONTENEUR=apix_postgres_prod ./database/scripts/generer_baseline.sh   # prod
#
# Puis vérifier le fichier généré et commiter.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/../.."

CONTENEUR="${CONTENEUR:-apix_postgres}"
ENV_FILE="${ENV_FILE:-.env}"

# Identifiants : variables d'environnement, sinon le .env racine
if [ -f "$ENV_FILE" ]; then
  DB="${POSTGRES_DB:-$(grep -E '^POSTGRES_DB='   "$ENV_FILE" | tail -1 | cut -d= -f2-)}"
  USR="${POSTGRES_USER:-$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -1 | cut -d= -f2-)}"
else
  DB="${POSTGRES_DB:?POSTGRES_DB requis}"; USR="${POSTGRES_USER:?POSTGRES_USER requis}"
fi

CIBLE="database/migrations/116_baseline_schema.sql"
HORODATAGE="$(date '+%Y-%m-%d %H:%M')"

echo "→ Dump du schéma de « ${DB} » via le conteneur ${CONTENEUR} ..."
{
  echo "-- ============================================================================="
  echo "-- Migration 116 — BASELINE du schéma ($HORODATAGE)"
  echo "--"
  echo "-- Instantané pg_dump --schema-only de la base réelle. Les migrations"
  echo "-- historiques 001–115 sont archivées dans migrations/archive/ : une base"
  echo "-- vierge joue CE fichier puis les migrations 117+. Les bases existantes"
  echo "-- sont déjà à ce niveau — ne pas rejouer ce fichier dessus."
  echo "-- ============================================================================="
  docker exec -i "${CONTENEUR}" pg_dump -U "$USR" -d "$DB" \
    --schema-only --no-owner --no-privileges --no-comments
} > "$CIBLE"

LIGNES=$(wc -l < "$CIBLE")
TABLES=$(grep -c "^CREATE TABLE" "$CIBLE" || true)
echo "→ $CIBLE : $LIGNES lignes, $TABLES tables."
if [ "$TABLES" -lt 40 ]; then
  echo "⚠ Moins de 40 tables : le dump semble incomplet, rien n'est archivé." >&2
  exit 1
fi

echo "→ Archivage des migrations 001–115…"
mkdir -p database/migrations/archive
for f in database/migrations/[0-1][0-9][0-9]*.sql; do
  base="$(basename "$f")"
  [ "$base" = "116_baseline_schema.sql" ] && continue
  git mv "$f" "database/migrations/archive/$base" 2>/dev/null || mv "$f" "database/migrations/archive/$base"
done

echo "✓ Terminé. Vérifier le diff puis commiter :"
echo "    git add database && git commit -m 'Migration 116 : baseline du schéma réel'"
