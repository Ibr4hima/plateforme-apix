#!/usr/bin/env python3
"""
Synchronisation IDE multi-pays depuis un dossier organisé par série.

Structure attendue du dossier :
    ide_data/
      flux_entrant/    ← un CSV par pays (senegal.csv, cameroun.csv, ...)
      flux_sortant/
      stock_entrant/
      stock_sortant/

Usage :
    python sync_all_ide.py --dossier ~/Downloads/ide_data_2025
    python sync_all_ide.py --dossier ./ide_data --dry-run

Le pays est auto-détecté depuis la colonne Economy_Label de chaque fichier.
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

# Nom de sous-dossier → (direction, indicateur)
SERIES_MAP = {
    "flux_entrant":  ("entrant", "flux"),
    "flux_sortant":  ("sortant", "flux"),
    "stock_entrant": ("entrant", "stock"),
    "stock_sortant": ("sortant", "stock"),
}

# ── Arguments ─────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Import IDE multi-pays depuis un dossier")
parser.add_argument("--dossier",  required=True, help="Dossier racine contenant les sous-dossiers par série")
parser.add_argument("--dry-run",  action="store_true", help="Simuler sans écrire en BDD")
args = parser.parse_args()

dossier = Path(args.dossier).expanduser()
if not dossier.is_dir():
    print(f"❌ Dossier introuvable : {dossier}")
    sys.exit(1)

# ── Helpers ───────────────────────────────────────────────────────────────────
def lire_csv(fichier: Path) -> dict[str, list[tuple[int, float | None]]]:
    """Retourne {economy_label: [(annee, valeur), ...]} — supporte fichiers multi-pays."""
    SKIP = {"economy_label", "economy", "économie", "pays"}
    result: dict[str, list] = {}

    with open(fichier, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        annee_col = val_col = label_col = None
        for row in reader:
            if annee_col is None:
                label_col = next((k for k in row if "economy" in k.lower()), None)
                annee_col = next((k for k in row if "year" in k.lower() or "année" in k.lower()), None)
                val_col   = next((k for k in row if "value" in k.lower() or "valeur" in k.lower()), None)
            if not annee_col:
                continue

            label = row[label_col].strip() if label_col else ""
            if not label or label.lower() in SKIP:
                continue

            try:
                annee = int(row[annee_col].strip())
            except (ValueError, KeyError):
                continue

            val_str = row[val_col].strip() if val_col else ""
            valeur  = None
            if val_str and val_str not in ("", "...", "—", "-", "n.d.", "N/A"):
                try:
                    valeur = float(val_str.replace(",", "").replace(" ", "").replace("\xa0", ""))
                except ValueError:
                    pass

            if 1970 <= annee <= 2050:
                result.setdefault(label, []).append((annee, valeur))

    return result


def normalize_name(s: str) -> str:
    import unicodedata
    s = s.replace("’", "'").replace("‘", "'").replace("`", "'")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


def resoudre_ref_pays(cur, label: str) -> tuple[int | None, str]:
    """Retourne (ref_pays_id, nom_fr) depuis ref_pays — matching exact puis normalisé."""
    # 1. Exact
    cur.execute(
        "SELECT id, nom_fr FROM ref_pays WHERE nom_cnuced = %s OR nom_fr = %s LIMIT 1",
        (label, label)
    )
    result = cur.fetchone()
    if result:
        return result[0], result[1]

    # 2. Normalisé (sans accents, casse ignorée)
    label_norm = normalize_name(label)
    cur.execute("SELECT id, nom_fr, nom_cnuced FROM ref_pays")
    for row in cur.fetchall():
        rpid, nom_fr, nom_cnuced = row
        if normalize_name(nom_fr or "") == label_norm or normalize_name(nom_cnuced or "") == label_norm:
            return rpid, nom_fr

    return None, label


def importer_serie(cur, ref_pays_id: int | None, nom_fr: str,
                   direction: str, indicateur: str,
                   rows: list[tuple[int, float | None]], dry_run: bool) -> tuple[int, int]:
    inseres = mis_a_jour = 0
    for annee, valeur in rows:
        if dry_run:
            inseres += 1
            continue
        if ref_pays_id:
            cur.execute("""
                INSERT INTO ide_cnuced (pays, annee, direction, indicateur, valeur, source, ref_pays_id)
                VALUES (%s, %s, %s, %s, %s, 'CNUCED', %s)
                ON CONFLICT (pays, annee, direction, indicateur) DO UPDATE
                    SET valeur = EXCLUDED.valeur, ref_pays_id = EXCLUDED.ref_pays_id
            """, (nom_fr, annee, direction, indicateur, valeur, ref_pays_id))
        else:
            cur.execute("""
                INSERT INTO ide_cnuced (pays, annee, direction, indicateur, valeur, source)
                VALUES (%s, %s, %s, %s, %s, 'CNUCED')
                ON CONFLICT (pays, annee, direction, indicateur) DO NOTHING
            """, (nom_fr, annee, direction, indicateur, valeur))

        if cur.rowcount == 1:
            inseres += 1
        else:
            mis_a_jour += 1

    return inseres, mis_a_jour


# ── Traitement ────────────────────────────────────────────────────────────────
print(f"\n{'═'*60}")
print(f"  Synchronisation IDE — {dossier.name}")
if args.dry_run:
    print("  ⚠  MODE SIMULATION (--dry-run) — aucune écriture en BDD")
print(f"{'═'*60}\n")

conn = None if args.dry_run else psycopg2.connect(**DB_CONFIG)
cur  = conn.cursor() if conn else None

total_inseres  = 0
total_ignores  = 0
total_fichiers = 0
erreurs        = []

for sous_dossier, (direction, indicateur) in SERIES_MAP.items():
    chemin = dossier / sous_dossier
    if not chemin.is_dir():
        print(f"  ⏭  {sous_dossier}/ — dossier absent, ignoré")
        continue

    fichiers_csv = sorted(chemin.glob("*.csv")) + sorted(chemin.glob("*.CSV"))
    if not fichiers_csv:
        print(f"  ⏭  {sous_dossier}/ — aucun fichier CSV")
        continue

    print(f"  📁 {sous_dossier}/  ({len(fichiers_csv)} fichier(s))")

    for fichier in fichiers_csv:
        try:
            lignes_par_pays = lire_csv(fichier)
        except Exception as e:
            erreurs.append(f"{fichier.name}: erreur de lecture — {e}")
            continue

        if not lignes_par_pays:
            erreurs.append(f"{fichier.name}: aucune ligne valide")
            continue

        total_fichiers += 1
        nb_pays = len(lignes_par_pays)
        if nb_pays > 1:
            print(f"    📄 {fichier.name} — {nb_pays} pays détectés")

        for economy_label, rows in lignes_par_pays.items():
            ref_pays_id, nom_fr = resoudre_ref_pays(cur, economy_label) if cur else (None, economy_label)
            if not ref_pays_id and not args.dry_run:
                erreurs.append(f"{fichier.name}: pays '{economy_label}' introuvable dans ref_pays")
                print(f"    ⚠  '{economy_label}' non trouvé dans ref_pays — ignoré")
                continue

            ins, maj = importer_serie(cur, ref_pays_id, nom_fr or economy_label, direction, indicateur, rows, args.dry_run)
            total_inseres += ins
            total_ignores += maj

            flag = "🔵" if args.dry_run else ("✅" if ins > 0 else "⏭ ")
            print(f"    {flag} {(nom_fr or economy_label):<30} {ins:>4} insérées  {maj:>4} mises à jour")

    print()

if conn:
    conn.commit()
    cur.close()
    conn.close()

# ── Rapport final ─────────────────────────────────────────────────────────────
print(f"{'═'*60}")
print(f"  📊 Bilan — {total_fichiers} fichier(s) traité(s)")
print(f"  ✅ {total_inseres} ligne(s) insérée(s)")
print(f"  ⏭  {total_ignores} ligne(s) déjà existante(s)")
if erreurs:
    print(f"\n  Erreurs ({len(erreurs)}) :")
    for e in erreurs:
        print(f"    ⚠  {e}")
print(f"{'═'*60}\n")
