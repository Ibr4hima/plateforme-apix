#!/bin/sh
# =============================================================================
# Lance l'API comme en production : un processus par cœur du serveur.
#
#     sh demarrer.sh
#
# La capacité de l'API croît avec ses processus (perf/RESULTATS-2026-11-07-cache.md :
# 2 processus plafonnaient à 40 pages par seconde, la base restant sous 20 %
# d'un cœur). API_WORKERS fixe leur nombre ; sans lui, un par cœur disponible,
# au moins 2, au plus 8. Les connexions à la base se partagent entre eux
# (DB_CONNEXIONS_MAX, 80 par défaut : app/core/database.py).
#
# APIX_GARDE_FOUS active les durées maximales des requêtes SQL et des
# attentes de verrou — pour l'API seulement : les imports lancés à côté
# (docker compose exec … python scripts/…) ne passent pas par ce script.
# =============================================================================
set -eu

n="${API_WORKERS:-}"
case "$n" in
  ''|*[!0-9]*) n="$(nproc 2>/dev/null || echo 2)" ;;
esac
[ "$n" -lt 2 ] && n=2
[ "$n" -gt 8 ] && n=8

export API_WORKERS="$n"
export APIX_GARDE_FOUS=1
echo "API : $n processus"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "$n"
