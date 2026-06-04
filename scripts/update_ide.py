#!/usr/bin/env python3
"""
Mise à jour des données IDE depuis un fichier CSV CNUCED.

Usage:
    python update_ide.py --fichier senegal.csv --direction entrant --indicateur flux
    python update_ide.py --fichier cameroun.csv --direction sortant --indicateur stock

Le pays est auto-détecté depuis la colonne Economy_Label du CSV.
La correspondance est faite avec ref_pays (nom_cnuced ou nom_fr).
"""

import argparse
import csv
import os
import sys
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

# ── Arguments ─────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Import IDE depuis CSV CNUCED")
parser.add_argument("--fichier",    required=True, help="Chemin vers le fichier CSV")
parser.add_argument("--direction",  required=True, choices=["entrant", "sortant"])
parser.add_argument("--indicateur", required=True, choices=["flux", "stock"])
args = parser.parse_args()

# ── Lecture du CSV ────────────────────────────────────────────────────────────
fichier = Path(args.fichier)
if not fichier.exists():
    print(f"❌ Fichier introuvable : {fichier}")
    sys.exit(1)

rows = []
economy_label = None

with open(fichier, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Détecter les colonnes dynamiquement
        label_col = next((k for k in row if "economy" in k.lower()), None)
        annee_col = next((k for k in row if "year"    in k.lower() or "année" in k.lower()), None)
        val_col   = next((k for k in row if "value"   in k.lower() or "valeur" in k.lower()), None)

        if not annee_col or not val_col:
            print(f"❌ Colonnes non trouvées. Disponibles : {list(row.keys())}")
            sys.exit(1)

        # Récupérer Economy_Label depuis la 1ère ligne de données
        if economy_label is None and label_col:
            economy_label = row[label_col].strip()

        annee_str = row[annee_col].strip()
        val_str   = row[val_col].strip() if val_col else ""

        if not annee_str:
            continue
        try:
            annee = int(annee_str)
        except ValueError:
            continue

        valeur = None
        if val_str and val_str not in ("", "...", "—", "-", "n.d.", "N/A"):
            try:
                valeur = float(val_str.replace(",", "").replace(" ", "").replace("\xa0", ""))
            except ValueError:
                pass

        rows.append((annee, valeur))

if not rows:
    print("⚠  Aucune ligne valide trouvée dans le fichier.")
    sys.exit(0)

print(f"📂 {fichier.name} — {len(rows)} lignes lues (Economy_Label: '{economy_label}')")

# ── Résolution ref_pays ───────────────────────────────────────────────────────
import unicodedata

def normalize_name(s: str) -> str:
    s = s.replace("'", "'").replace("'", "'").replace("`", "'")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()

conn = psycopg2.connect(**DB_CONFIG)
cur  = conn.cursor()

ref_pays_id = None
nom_fr      = economy_label  # fallback si pas trouvé dans ref_pays

if economy_label:
    # 1. Exact
    cur.execute(
        "SELECT id, nom_fr FROM ref_pays WHERE nom_cnuced = %s OR nom_fr = %s LIMIT 1",
        (economy_label, economy_label)
    )
    result = cur.fetchone()

    # 2. Normalisé si pas trouvé
    if not result:
        label_norm = normalize_name(economy_label)
        cur.execute("SELECT id, nom_fr, nom_cnuced FROM ref_pays")
        for row in cur.fetchall():
            if normalize_name(row[1] or "") == label_norm or normalize_name(row[2] or "") == label_norm:
                result = (row[0], row[1])
                break

    if result:
        ref_pays_id, nom_fr = result
        print(f"🌍 Pays résolu : {nom_fr} (ref_pays_id={ref_pays_id})")
    else:
        print(f"⚠  Pays '{economy_label}' non trouvé dans ref_pays — importé sans liaison ref_pays")

# ── Insertion en BDD ──────────────────────────────────────────────────────────
inseres = 0
ignores = 0
mis_a_jour = 0

for annee, valeur in rows:
    if ref_pays_id:
        # Upsert par ref_pays_id (précis)
        cur.execute("""
            INSERT INTO ide_cnuced (pays, annee, direction, indicateur, valeur, source, ref_pays_id)
            VALUES (%s, %s, %s, %s, %s, 'CNUCED', %s)
            ON CONFLICT (pays, annee, direction, indicateur) DO UPDATE
                SET valeur = EXCLUDED.valeur,
                    ref_pays_id = EXCLUDED.ref_pays_id
        """, (nom_fr, annee, args.direction, args.indicateur, valeur, ref_pays_id))
    else:
        cur.execute("""
            INSERT INTO ide_cnuced (pays, annee, direction, indicateur, valeur, source)
            VALUES (%s, %s, %s, %s, %s, 'CNUCED')
            ON CONFLICT (pays, annee, direction, indicateur) DO NOTHING
        """, (nom_fr, annee, args.direction, args.indicateur, valeur))

    if cur.rowcount == 1:
        inseres += 1
    else:
        ignores += 1

conn.commit()
cur.close()
conn.close()

print(f"{'─'*50}")
print(f"✅ {inseres} nouvelle(s) ligne(s) insérée(s)")
print(f"⏭  {ignores} ligne(s) déjà existante(s) ignorée(s)")
print(f"{'─'*50}")
