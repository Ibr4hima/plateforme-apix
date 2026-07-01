#!/usr/bin/env bash
# =============================================================================
# Exporte le contenu d'un document juridique (« Code des investissements » ou
# « Modalités d'application ») de la base LOCALE vers une migration SQL.
#
# Pourquoi : le contenu (chapitres / sections / articles) vit dans la base de
# données, pas dans le code. Les éditions faites via l'admin local restent dans
# la base locale ; la prod a sa propre base. Cette migration « fige » le contenu
# local pour qu'il soit rejoué automatiquement au déploiement.
#
# Usage (sur ta machine, avec la stack locale démarrée) :
#   bash scripts/export_code_contenu.sh              # → Code des investissements
#   bash scripts/export_code_contenu.sh modalites    # → Modalités d'application
#   git add database/migrations/<fichier généré>
#   git commit -m "Contenu ..." && git push
#
# Variables optionnelles :
#   CONTAINER   nom du conteneur Postgres local (défaut: apix_postgres)
#   PGUSER/PGDB identifiants (sinon lus depuis .env : POSTGRES_USER/POSTGRES_DB)
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

DOC="${1:-code}"
case "$DOC" in
  code)
    PREFIX="code";      LABEL="Code des investissements"
    OUT="database/migrations/037_code_contenu.sql" ;;
  modalites)
    PREFIX="modalites"; LABEL="Modalités d'application"
    OUT="database/migrations/094_modalites_contenu.sql" ;;
  *)
    echo "✗ Document inconnu : « $DOC ». Valeurs possibles : code | modalites" >&2
    exit 1 ;;
esac

# Identifiants : priorité aux variables d'env, sinon .env
if [ -f .env ]; then set -a; # shellcheck disable=SC1091
  source .env; set +a; fi
PGUSER="${PGUSER:-${POSTGRES_USER:-postgres}}"
PGDB="${PGDB:-${POSTGRES_DB:-apix}}"
CONTAINER="${CONTAINER:-apix_postgres}"

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

CH=$(dump "${PREFIX}_chapitres")
SE=$(dump "${PREFIX}_sections")
AR=$(dump "${PREFIX}_articles")

# Nombre de lignes de données = lignes du bloc COPY moins l'en-tête et le « \. »
nb() { printf '%s' "$1" | grep -cvE '^COPY |^\\\.$' || true; }
echo "  [$DOC] chapitres : $(nb "$CH") · sections : $(nb "$SE") · articles : $(nb "$AR")"

if [ -z "$CH" ] && [ -z "$AR" ]; then
  echo "✗ Aucun contenu trouvé dans la base locale pour « $LABEL ». Rien à exporter." >&2
  exit 1
fi

{
  echo "-- ============================================================================="
  echo "-- Migration — Contenu « $LABEL » (export de la base locale)"
  echo "-- Généré par scripts/export_code_contenu.sh — NE PAS éditer à la main."
  echo "-- Rejoue le contenu (chapitres/sections/articles) tel qu'édité en local."
  echo "-- ============================================================================="
  echo "BEGIN;"
  echo ""
  echo "-- Garantit la présence de la colonne 'contenu' (idempotent, sans effet si déjà là)."
  echo "ALTER TABLE ${PREFIX}_chapitres ADD COLUMN IF NOT EXISTS contenu TEXT;"
  echo "ALTER TABLE ${PREFIX}_sections  ADD COLUMN IF NOT EXISTS contenu TEXT;"
  echo ""
  echo "-- On repart d'une table propre pour éviter les doublons (le PDF n'est pas touché)."
  echo "DELETE FROM ${PREFIX}_articles;"
  echo "DELETE FROM ${PREFIX}_sections;"
  echo "DELETE FROM ${PREFIX}_chapitres;"
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

echo "✅ $OUT généré (chapitres $(nb "$CH") · sections $(nb "$SE") · articles $(nb "$AR"))."
echo "   Vérifie, puis : git add $OUT && git commit -m \"Contenu $LABEL\" && git push"
