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

# Le Caddyfile est monté en bind-mount : `up -d` ne recrée pas le conteneur
# quand seul son CONTENU change, donc Caddy garde son ancienne config en
# mémoire. On recharge explicitement (reload à chaud, sinon redémarrage) pour
# que toute modif de routage prenne effet à chaque déploiement.
echo "▸ Rechargement de la configuration Caddy…"
$COMPOSE exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null \
  || $COMPOSE restart caddy

# Le volume backend_uploads est monté sur /app/uploads mais créé « root » par
# Docker, alors que le backend tourne en utilisateur non-root (uid 1000) → sans
# ce chown, les téléversements (PDF du code, modalités, projets…) échouent.
# On attend que le conteneur backend soit lancé, on chowne, puis on affiche un
# diagnostic (droits + test d'écriture) directement dans les logs de déploiement.
echo "▸ Droits + diagnostic du dossier uploads…"
for _ in $(seq 1 15); do
  if [ -n "$($COMPOSE ps -q backend 2>/dev/null)" ]; then break; fi
  sleep 2
done
$COMPOSE exec -T -u root backend sh -c '
  set -e
  mkdir -p /app/uploads/code_investissement /app/uploads/modalites_application
  chown -R 1000:1000 /app/uploads
  echo "  --- ls -la /app/uploads ---"; ls -la /app/uploads
  echo "  --- modalites ---"; ls -la /app/uploads/modalites_application 2>&1 || true
  echo "  --- test écriture appuser ---"
  su appuser -s /bin/sh -c "touch /app/uploads/modalites_application/_wt && echo WRITE_OK && rm -f /app/uploads/modalites_application/_wt" 2>&1 || echo WRITE_FAIL
' || echo "  ⚠ exec backend impossible (conteneur pas prêt ?)"

echo "▸ Nettoyage des images inutilisées…"
docker image prune -f >/dev/null 2>&1 || true

echo "✅ Déploiement terminé."
