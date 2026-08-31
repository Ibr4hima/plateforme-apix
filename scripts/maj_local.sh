#!/usr/bin/env bash
# =============================================================================
# Mise à jour de l'environnement LOCAL, après un « git pull ».
#
# Une seule commande, toujours la même, dans n'importe quel ordre de besoins :
#
#     bash scripts/maj_local.sh
#
# Elle applique les migrations qui manquent, puis rejoue les imports de
# référentiels fDi. Tout y est IDEMPOTENT : la relancer deux fois de suite ne
# fait rien la seconde fois. Il n'y a donc jamais à se demander « est-ce que
# j'ai déjà passé celle-là ? » — c'est précisément ce que ce script sait.
#
# Ce qu'elle ne fait PAS, volontairement : démarrer ou redémarrer le back et le
# front. Ils tournent dans vos terminaux, elle n'a pas à s'en mêler ; elle
# rappelle seulement, à la fin, ce qu'il faut relancer.
#
# Le pendant en production est `scripts/deploy.sh`, qui enchaîne les mêmes
# étapes après avoir construit les images.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

vert() { printf "\033[0;32m%s\033[0m\n" "$1"; }
gris() { printf "\033[0;90m%s\033[0m\n" "$1"; }

[ -f .env ] || { echo "✗ .env introuvable à la racine du dépôt."; exit 1; }
set -a; source .env; set +a

CONTENEUR=${CONTENEUR_PG:-apix_postgres}
psql_c() { docker exec -i "$CONTENEUR" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"; }

docker ps --format '{{.Names}}' | grep -qx "$CONTENEUR" || {
  echo "✗ le conteneur « $CONTENEUR » ne tourne pas. Lancez : docker compose up -d postgres"; exit 1; }

# ── 1. Migrations ────────────────────────────────────────────────────────────
echo "▸ Migrations"
psql_c -q -c "CREATE TABLE IF NOT EXISTS schema_migrations (
                filename text PRIMARY KEY, applied_at timestamptz DEFAULT now());"

# Première fois : la base existe déjà (elle a été créée par initdb avec le
# schéma complet), mais le suivi est vide. On marque comme appliquées les
# migrations ANTÉRIEURES au chantier fDi — elles sont forcément passées,
# puisque l'application tourne — et on laisse rejouer les suivantes : toutes
# celles du chantier fDi sont écrites en « IF NOT EXISTS », donc les repasser
# ne coûte rien et remet le suivi d'aplomb.
suivies=$(psql_c -tAc "SELECT count(*) FROM schema_migrations;")
if [ "$suivies" = "0" ]; then
  gris "  premier passage : marquage des migrations antérieures à 130 (chantier fDi)"
  for f in database/migrations/*.sql; do
    nom=$(basename "$f")
    [ "${nom%%_*}" -lt 130 ] 2>/dev/null || continue
    psql_c -q -c "INSERT INTO schema_migrations(filename) VALUES ('$nom') ON CONFLICT DO NOTHING;"
  done
fi

applique=0
for f in $(ls database/migrations/*.sql | sort); do
  nom=$(basename "$f")
  deja=$(psql_c -tAc "SELECT 1 FROM schema_migrations WHERE filename='$nom';")
  if [ "$deja" != "1" ]; then
    echo "  → $nom"
    docker exec -i "$CONTENEUR" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$f"
    psql_c -q -c "INSERT INTO schema_migrations(filename) VALUES ('$nom');"
    applique=1
  fi
done
[ "$applique" = "0" ] && gris "  aucune migration à appliquer."

# ── 2. Référentiels et projets fDi ───────────────────────────────────────────
# Les deux dans cet ordre : la résolution des secteurs, activités et types
# s'appuie sur la nomenclature. Les saisies faites en administration —
# descriptions, entreprises arbitrées — survivent au rejeu.
echo "▸ Nomenclature fDi"
( cd backend && python scripts/fdi/importer.py )
echo "▸ Projets fDi"
( cd backend && python scripts/fdi/importer_projets.py )

vert "✅ Base à jour."
echo
gris "À relancer vous-même si le back ou le front tournaient déjà :"
gris "   • back  : Ctrl-C puis  cd backend && uvicorn app.main:app --reload"
gris "   • front : rien à faire, Next recharge tout seul."
