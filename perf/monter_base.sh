#!/usr/bin/env bash
# =============================================================================
# Banc de mesure — la base de test.
#
#     PGPORT=5600 bash perf/monter_base.sh
#
# Crée une base JETABLE (apixbanc par défaut) sur un Postgres local, y applique
# les migrations du dépôt, le référentiel des pays, puis les imports réels que
# la production rejoue à chaque déploiement : commerce extérieur (NACE) et
# relevé fDi (nomenclature, projets, signaux). Le volume « à l'échelle » vient
# ensuite de perf/generer_donnees.py.
#
# Ne touche à aucune autre base : refuse de partir si la base cible existe.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PGHOST:=127.0.0.1}" "${PGPORT:=5600}" "${BANC_BASE:=apixbanc}"
export PGHOST PGPORT
if psql -U postgres -Atc "select 1 from pg_database where datname = '$BANC_BASE'" | grep -q 1; then
  echo "La base $BANC_BASE existe déjà : supprimez-la d'abord (dropdb -U postgres $BANC_BASE)." >&2
  exit 1
fi
psql -U postgres -q -c "DO \$\$ BEGIN CREATE ROLE apix LOGIN SUPERUSER PASSWORD 'apix'; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;"
psql -U postgres -q -c "CREATE DATABASE $BANC_BASE OWNER apix;"
psql -U postgres -d "$BANC_BASE" -q -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
export PGPASSWORD=apix
P="psql -U apix -d $BANC_BASE -q -v ON_ERROR_STOP=1"
JOURNAL=$(mktemp)
ok=0; ko=0
for f in $(ls database/migrations/*.sql | sort); do
  if $P -f "$f" > "$JOURNAL" 2>&1; then ok=$((ok+1)); else ko=$((ko+1)); echo "ÉCHEC $f : $(grep -m1 ERROR "$JOURNAL")"; fi
done
echo "migrations : $ok appliquées, $ko en échec"
# Le référentiel des pays : la liste ISO de l'ancienne migration 009, puis
# les compléments versionnés depuis
python3 - > "$JOURNAL" <<'PY'
s = open("database/migrations/archive/009_ref_pays.sql", encoding="utf-8").read()
s = s.replace("INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr, nom_en, region_monde) VALUES",
              "INSERT INTO seed_pays (code_iso2, code_iso3, nom_fr, nom_en, region_monde) VALUES")
print("CREATE TEMP TABLE seed_pays(code_iso2 text, code_iso3 text, nom_fr text, nom_en text, region_monde text);")
print(s)
print("INSERT INTO ref_pays (code_iso2, code_iso3, nom_fr) SELECT code_iso2, code_iso3, nom_fr FROM seed_pays ON CONFLICT DO NOTHING;")
PY
$P -f "$JOURNAL" > /dev/null
for f in database/migrations/archive/114_ref_pays_taiwan.sql database/migrations/129_*.sql \
         database/migrations/13[6-9]_ref_pays*.sql database/migrations/142_*.sql database/migrations/146_*.sql \
         database/migrations/150_*.sql database/migrations/153_*.sql database/migrations/154_*.sql; do
  [ -f "$f" ] && { $P -f "$f" > "$JOURNAL" 2>&1 || echo "complément en échec : $(basename "$f")"; }
done
$P -Atc "select 'ref_pays : ' || count(*) from ref_pays"
# Les imports réels, comme au déploiement
cd backend
export POSTGRES_HOST=$PGHOST POSTGRES_PORT=$PGPORT POSTGRES_DB=$BANC_BASE POSTGRES_USER=apix POSTGRES_PASSWORD=apix SECRET_KEY=banc
for imp in scripts/nace/importer.py scripts/fdi/importer.py scripts/fdi/importer_projets.py scripts/fdi/importer_signaux.py; do
  if python "$imp" > "$JOURNAL" 2>&1; then echo "import $imp : ok"; else echo "import $imp : ÉCHEC"; tail -3 "$JOURNAL"; fi
done
rm -f "$JOURNAL"
$P -Atc "select 'fdi_projets : ' || count(*) from fdi_projets"
$P -Atc "select 'fdi_signaux : ' || count(*) from fdi_signaux_investisseurs"
