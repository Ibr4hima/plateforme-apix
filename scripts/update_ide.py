#!/usr/bin/env python3
"""
Script de mise à jour des données IDE depuis les CSV CNUCED.

Usage:
    python update_ide.py --fichier ide_flux_entrants_senegal.csv --direction entrant --indicateur flux
    python update_ide.py --fichier ide_flux_sortants_senegal.csv --direction sortant --indicateur flux
    python update_ide.py --fichier ide_stock_entrants_senegal.csv --direction entrant --indicateur stock
    python update_ide.py --fichier ide_stock_sortants_senegal.csv --direction sortant --indicateur stock

Le script:
- Lit le CSV
- Insère uniquement les lignes manquantes (ON CONFLICT DO NOTHING)
- Affiche un rapport : nouvelles lignes / lignes déjà existantes
"""

import argparse
import csv
import os
import psycopg2
from pathlib import Path

# ── Configuration BDD ─────────────────────────────────────────────────────────
DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     int(os.getenv("DB_PORT", "5432")),
    "dbname":   os.getenv("DB_NAME",     "apix_db"),
    "user":     os.getenv("DB_USER",     "apix_user"),
    "password": os.getenv("DB_PASSWORD", "apix_password"),
}

# ── Parsing arguments ─────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Mise à jour des données IDE depuis CSV CNUCED")
parser.add_argument("--fichier",     required=True,  help="Chemin vers le fichier CSV")
parser.add_argument("--direction",   required=True,  choices=["entrant","sortant"], help="Direction IDE")
parser.add_argument("--indicateur",  required=True,  choices=["flux","stock"],      help="Type d'indicateur")
parser.add_argument("--pays",        default="Sénégal", help="Nom du pays (défaut: Sénégal)")
args = parser.parse_args()

# ── Lecture du CSV ────────────────────────────────────────────────────────────
fichier = Path(args.fichier)
if not fichier.exists():
    print(f"❌ Fichier introuvable : {fichier}")
    exit(1)

rows = []
with open(fichier, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Colonnes possibles du CNUCED (tabulaire)
        annee_col = next((k for k in row if "Year" in k or "year" in k or "Année" in k), None)
        val_col   = next((k for k in row if "Value" in k or "value" in k or "Valeur" in k), None)

        if not annee_col or not val_col:
            print(f"❌ Colonnes non trouvées. Colonnes disponibles: {list(row.keys())}")
            exit(1)

        annee_str = row[annee_col].strip()
        val_str   = row[val_col].strip()

        if not annee_str:
            continue

        try:
            annee = int(annee_str)
        except ValueError:
            continue

        valeur = None
        if val_str and val_str not in ("", "...", "N/A", "-"):
            try:
                valeur = float(val_str.replace(",","").replace(" ",""))
            except ValueError:
                pass

        rows.append((args.pays, annee, args.direction, args.indicateur, valeur))

print(f"📂 Fichier lu : {len(rows)} lignes trouvées")

# ── Insertion en BDD ──────────────────────────────────────────────────────────
conn = psycopg2.connect(**DB_CONFIG)
cur  = conn.cursor()

inseres = 0
ignores = 0

for pays, annee, direction, indicateur, valeur in rows:
    cur.execute("""
        INSERT INTO ide_cnuced (pays, annee, direction, indicateur, valeur, source)
        VALUES (%s, %s, %s, %s, %s, 'CNUCED')
        ON CONFLICT (pays, annee, direction, indicateur) DO NOTHING
    """, (pays, annee, direction, indicateur, valeur))

    if cur.rowcount == 1:
        inseres += 1
        print(f"  ✅ {annee} → {valeur} M$ ({direction}/{indicateur})")
    else:
        ignores += 1

conn.commit()
cur.close()
conn.close()

print(f"\n{'─'*50}")
print(f"✅ {inseres} nouvelle(s) ligne(s) insérée(s)")
print(f"⏭  {ignores} ligne(s) déjà existante(s) ignorée(s)")
print(f"{'─'*50}")
