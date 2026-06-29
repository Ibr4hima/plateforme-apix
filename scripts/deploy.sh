#!/usr/bin/env bash
# Déploiement de la démo APIX sur le VPS.
#  1. construit les nouvelles images (si le build échoue, l'ancienne version
#     reste en ligne → pas de page cassée pour les testeurs) ;
#  2. applique les migrations SQL non encore appliquées ;
#  3. (re)démarre la stack et nettoie les images orphelines.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.prod ]; then
  echo "✗ .env.prod introuvable. Copier .env.prod.example → .env.prod et le renseigner." >&2
  exit 1
fi
if [ ! -f secrets.caddy.env ]; then
  echo "✗ secrets.caddy.env introuvable. Copier secrets.caddy.env.example et générer le hash." >&2
  exit 1
fi

set -a; source .env.prod; set +a
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

echo "▸ Build des images (l'ancienne version reste en ligne si le build échoue)…"
$COMPOSE build

echo "▸ Démarrage de la base de données…"
$COMPOSE up -d postgres
echo "  attente de Postgres…"
for _ in $(seq 1 30); do
  if $COMPOSE exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "▸ Migrations…"
bash scripts/apply_migrations.sh

echo "▸ (Re)démarrage de la stack…"
$COMPOSE up -d

echo "▸ Nettoyage des images inutilisées…"
docker image prune -f >/dev/null 2>&1 || true

echo "✅ Déploiement terminé."
