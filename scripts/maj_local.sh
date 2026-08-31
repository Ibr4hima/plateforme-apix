#!/usr/bin/env bash
# =============================================================================
# Mise à jour de l'environnement LOCAL.
#
# Une seule commande, toujours la même, dans n'importe quel ordre de besoins :
#
#     bash scripts/maj_local.sh
#
# Elle RÉCUPÈRE d'abord les nouveautés du dépôt, puis applique les migrations
# qui manquent, puis rejoue les imports de référentiels et de projets fDi. Tout
# y est IDEMPOTENT : la relancer deux fois de suite ne fait rien la seconde
# fois. Il n'y a donc jamais à se demander « est-ce que j'ai déjà passé
# celle-là ? » — c'est précisément ce que ce script sait.
#
# LE « git pull » EN FAIT PARTIE, et c'est délibéré. Les pages de projets sont
# versionnées dans le dépôt, mais l'écran, lui, lit la BASE : entre les deux, il
# faut un import. Tant que les deux gestes étaient séparés, en oublier un
# donnait exactement la mauvaise conclusion — « les nouvelles pages ne sont pas
# arrivées » — alors qu'elles n'avaient simplement pas été chargées. Un geste
# qu'on peut oublier finit par être oublié : on le supprime.
#
#     bash scripts/maj_local.sh --sans-pull   # rester sur le code en place
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

PULL=1
[ "${1:-}" = "--sans-pull" ] && PULL=0

# ── 0. Le dépôt ──────────────────────────────────────────────────────────────
# Avance rapide seulement : si la branche locale a divergé, c'est un travail en
# cours qu'une fusion silencieuse abîmerait. On le dit et on continue avec le
# code en place — remettre la base à niveau reste utile.
if [ "$PULL" = "1" ]; then
  echo "▸ Dépôt"
  BRANCHE=$(git rev-parse --abbrev-ref HEAD)
  if [ -n "$(git status --porcelain)" ]; then
    gris "  modifications locales en cours — récupération ignorée"
  elif git pull --ff-only origin "$BRANCHE" >/dev/null 2>&1; then
    gris "  $BRANCHE à jour ($(git rev-parse --short HEAD))"
  else
    gris "  récupération impossible (branche divergente ou réseau) — on continue"
  fi
fi

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

# ── 3. Ce que l'écran proposera ──────────────────────────────────────────────
# Le même calcul que la route publique : un pays n'est offert au filtre que si
# un lot rend son périmètre exhaustif — directement (« Dest = Sénégal ») ou par
# sa zone (« Dest = Africa » via ref_pays.continent). L'afficher ici évite de
# chercher dans le navigateur ce que le terminal savait déjà : une page
# importée mais absente de cette liste est un rattachement manquant, pas un
# import raté.
echo "▸ Pays proposés au filtre public"
psql_c -tA -F ' · ' -c "
  WITH releves AS (SELECT DISTINCT perimetre, sens FROM fdi_lots_import WHERE perimetre IS NOT NULL),
       -- DISTINCT : le Sénégal est rendu complet DEUX fois, par son propre
       -- relevé et par celui de l'Afrique. Sans lui, la jointure doublerait
       -- ses projets — l'erreur même contre laquelle tout ceci existe.
       complets AS (SELECT DISTINCT r.sens, p.nom_fr FROM ref_pays p JOIN releves r
                      ON p.nom_fr = r.perimetre OR p.continent = r.perimetre)
  SELECT c.sens, p.nom_fr, count(*)
    FROM fdi_projets pr
    JOIN fdi_lots_import l ON l.id = pr.lot_id
    JOIN ref_pays p ON p.id = CASE l.sens WHEN 'source' THEN pr.pays_source_id ELSE pr.pays_dest_id END
    JOIN complets c ON c.nom_fr = p.nom_fr AND c.sens = l.sens
   GROUP BY 1, 2 ORDER BY 3 DESC;" | sed 's/^/  /'

vert "✅ Base à jour."
echo
gris "À relancer vous-même si le back ou le front tournaient déjà :"
gris "   • back  : Ctrl-C puis  cd backend && uvicorn app.main:app --reload"
gris "   • front : rien à faire, Next recharge tout seul."
