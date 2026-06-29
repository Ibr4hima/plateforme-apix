#!/usr/bin/env bash
# Applique les migrations SQL non encore appliquées, en suivant l'état dans la
# table « schema_migrations ». Idempotent : ne rejoue jamais une migration déjà
# passée (y compris celles exécutées par initdb au tout premier démarrage).
set -euo pipefail

cd "$(dirname "$0")/.."

# Variables POSTGRES_* (depuis .env.prod)
set -a; source .env.prod; set +a

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"
psql_c() { $COMPOSE exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"; }

# Table de suivi
psql_c -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now());" >/dev/null

count=$(psql_c -tAc "SELECT count(*) FROM schema_migrations;")
initialized=$(psql_c -tAc "SELECT to_regclass('public.ref_pays') IS NOT NULL;")

# Baseline : base déjà initialisée par initdb mais suivi vide → on marque toutes
# les migrations existantes comme appliquées, sans les rejouer.
if [ "$count" = "0" ] && [ "$initialized" = "t" ]; then
  echo "  Baseline : marquage des migrations existantes comme appliquées (sans rejouer)."
  for f in database/migrations/*.sql; do
    name=$(basename "$f")
    psql_c -c "INSERT INTO schema_migrations(filename) VALUES ('$name') ON CONFLICT DO NOTHING;" >/dev/null
  done
  echo "  Baseline posée."
  exit 0
fi

# Application des migrations manquantes, dans l'ordre
applied_any=0
for f in $(ls database/migrations/*.sql | sort); do
  name=$(basename "$f")
  already=$(psql_c -tAc "SELECT 1 FROM schema_migrations WHERE filename='$name';")
  if [ "$already" != "1" ]; then
    echo "  → application de $name"
    $COMPOSE exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$f"
    psql_c -c "INSERT INTO schema_migrations(filename) VALUES ('$name');" >/dev/null
    applied_any=1
  fi
done

[ "$applied_any" = "0" ] && echo "  Aucune nouvelle migration." || echo "  Migrations appliquées."
