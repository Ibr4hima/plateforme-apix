#!/bin/bash
# Synchronisation IDE multi-pays depuis un dossier organisé.
#
# Structure attendue :
#   <dossier>/
#     flux_entrant/    ← senegal.csv, cameroun.csv, ...
#     flux_sortant/
#     stock_entrant/
#     stock_sortant/
#
# Usage :
#   ./sync_ide.sh /chemin/vers/dossier
#   ./sync_ide.sh ~/Downloads/ide_data_2025
#   ./sync_ide.sh ~/Downloads/ide_data_2025 --dry-run

DOSSIER=${1:-~/ide_data}
EXTRA_ARGS=${2:-}

export DB_PASSWORD=${DB_PASSWORD:-apix_password}
export DB_USER=${DB_USER:-apix_user}
export DB_NAME=${DB_NAME:-apix_db}
export DB_HOST=${DB_HOST:-localhost}
export DB_PORT=${DB_PORT:-5432}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

python "$SCRIPT_DIR/sync_all_ide.py" --dossier "$DOSSIER" $EXTRA_ARGS
