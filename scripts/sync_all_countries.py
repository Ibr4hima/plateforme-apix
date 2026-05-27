#!/usr/bin/env python3
"""
Script universel de synchronisation des données IDE — tous les pays configurés.

Ce script :
1. Lit la liste des pays actifs depuis ide_pays_config
2. Pour chaque pays, télécharge les 4 CSV depuis CNUCED
3. Insère uniquement les nouvelles données (ON CONFLICT DO NOTHING)
4. Affiche un rapport complet

Usage:
    python sync_all_countries.py                    # tous les pays actifs
    python sync_all_countries.py --pays SEN         # un seul pays
    python sync_all_countries.py --dry-run          # simulation sans insertion

Prérequis:
    pip install psycopg2-binary requests

Variables d'environnement:
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
    (ou fichier .env à la racine du projet)
"""

import argparse
import csv
import io
import os
import sys
import time
import psycopg2
import requests
from pathlib import Path
from datetime import datetime

# ── Config BDD ────────────────────────────────────────────────────────────────
def get_db_config():
    # Charger .env si présent
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

    return {
        "host":     os.getenv("POSTGRES_HOST", "localhost"),
        "port":     int(os.getenv("POSTGRES_PORT", "5432")),
        "dbname":   os.getenv("POSTGRES_DB",   "apix_db"),
        "user":     os.getenv("POSTGRES_USER", "apix_user"),
        "password": os.getenv("POSTGRES_PASSWORD", os.getenv("DB_PASSWORD", "")),
    }

# ── URL de téléchargement CNUCED ──────────────────────────────────────────────
# Format CSV tabulaire CNUCED (valeurs séparées par virgules, format long)
CNUCED_BASE = "https://unctadstat.unctad.org/en/DownloadData.html"

# URLs directes de téléchargement CNUCED (format bulk CSV)
def get_cnuced_url(indicator: str, economy: str) -> str:
    """
    Construit l'URL de téléchargement CNUCED.
    indicator: US.FdiFlowsStock (flux et stock IDE)
    economy: code ISO3 du pays (ex: SEN)
    """
    return (
        f"https://unctadstat.unctad.org/api/publicationData"
        f"?id={indicator}"
        f"&dim=Economy,Year,Mode,Indicator"
        f"&filter=Economy:{economy}"
        f"&lang=en"
        f"&outputFormat=csv"
    )

# ── Téléchargement CSV CNUCED ─────────────────────────────────────────────────
def download_cnuced(code_iso3: str, direction: str, indicateur: str) -> list[dict] | None:
    """
    Télécharge les données IDE depuis CNUCED pour un pays.
    Retourne une liste de {annee, valeur} ou None si échec.
    """
    # Mapping vers les paramètres CNUCED
    mode_map = {"flux": "Inflows" if direction=="entrant" else "Outflows",
                "stock": "InwardStock" if direction=="entrant" else "OutwardStock"}

    url = (
        f"https://unctadstat.unctad.org/en/bulk/"
        f"US_FdiFlowsStock_en_{code_iso3}.csv"
    )

    headers = {"User-Agent": "Mozilla/5.0 (compatible; APIX-Sync/1.0)"}

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code != 200:
            return None

        content = resp.text
        reader  = csv.DictReader(io.StringIO(content))
        rows    = []

        mode_cnuced = mode_map.get(indicateur, "")

        for row in reader:
            # Filtrer par direction/indicateur
            mode_col = next((k for k in row if "mode" in k.lower() or "type" in k.lower()), None)
            year_col = next((k for k in row if "year" in k.lower()), None)
            val_col  = next((k for k in row if "value" in k.lower()), None)

            if not year_col or not val_col:
                continue

            if mode_col and mode_cnuced and mode_cnuced.lower() not in (row.get(mode_col,"")).lower():
                continue

            try:
                annee = int(row[year_col].strip())
                val_str = row[val_col].strip()
                valeur = float(val_str) if val_str and val_str not in ("","...","N/A","-") else None
                rows.append({"annee": annee, "valeur": valeur})
            except (ValueError, KeyError):
                continue

        return rows if rows else None

    except Exception as e:
        print(f"    ⚠️  Erreur téléchargement: {e}")
        return None


# ── Import depuis fichier CSV local (fallback) ────────────────────────────────
def lire_csv_local(chemin: str) -> list[dict]:
    """Lit un CSV CNUCED téléchargé manuellement."""
    rows = []
    with open(chemin, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            year_col = next((k for k in row if "Year" in k or "year" in k), None)
            val_col  = next((k for k in row if "Value" in k or "value" in k), None)
            if not year_col or not val_col:
                continue
            try:
                annee   = int(row[year_col].strip())
                val_str = row[val_col].strip()
                valeur  = float(val_str) if val_str and val_str not in ("","...","N/A","-") else None
                rows.append({"annee": annee, "valeur": valeur})
            except ValueError:
                continue
    return rows


# ── Insertion BDD ─────────────────────────────────────────────────────────────
def inserer_donnees(cur, nom_cnuced: str, direction: str, indicateur: str,
                    rows: list[dict], dry_run: bool = False) -> tuple[int, int]:
    inseres = ignores = 0
    for r in rows:
        if dry_run:
            # Vérifier si existe déjà
            cur.execute(
                "SELECT 1 FROM ide_cnuced WHERE pays=%s AND annee=%s AND direction=%s AND indicateur=%s",
                (nom_cnuced, r["annee"], direction, indicateur)
            )
            if cur.fetchone():
                ignores += 1
            else:
                inseres += 1
        else:
            cur.execute("""
                INSERT INTO ide_cnuced (pays, annee, direction, indicateur, valeur, source)
                VALUES (%s, %s, %s, %s, %s, 'CNUCED')
                ON CONFLICT (pays, annee, direction, indicateur) DO NOTHING
            """, (nom_cnuced, r["annee"], direction, indicateur, r["valeur"]))
            if cur.rowcount == 1:
                inseres += 1
            else:
                ignores += 1
    return inseres, ignores


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Synchronisation IDE — tous pays")
    parser.add_argument("--pays",    help="Code ISO3 d'un pays spécifique (ex: SEN)")
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans insertion")
    parser.add_argument("--dossier", help="Dossier contenant les CSV locaux (fallback si téléchargement échoue)")
    args = parser.parse_args()

    db_config = get_db_config()
    conn = psycopg2.connect(**db_config)
    cur  = conn.cursor()

    # Récupérer les pays à traiter
    q = "SELECT code_iso3, nom_fr, nom_cnuced, zone FROM ide_pays_config WHERE est_actif = TRUE"
    if args.pays:
        q += f" AND code_iso3 = '{args.pays.upper()}'"
    cur.execute(q)
    pays_list = cur.fetchall()

    if not pays_list:
        print("❌ Aucun pays trouvé en base. Vérifiez ide_pays_config.")
        sys.exit(1)

    print(f"\n{'═'*60}")
    print(f"  SYNCHRONISATION IDE — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    if args.dry_run:
        print(f"  ⚠️  MODE SIMULATION (aucune donnée insérée)")
    print(f"{'═'*60}")
    print(f"  {len(pays_list)} pays à traiter\n")

    SERIES = [
        ("entrant", "flux"),
        ("sortant", "flux"),
        ("entrant", "stock"),
        ("sortant", "stock"),
    ]

    rapport = []

    for code_iso3, nom_fr, nom_cnuced, zone in pays_list:
        print(f"\n🌍 {nom_fr} ({code_iso3}) — {zone or '—'}")
        print(f"{'─'*50}")
        pays_total_inseres = 0
        pays_total_ignores = 0

        for direction, indicateur in SERIES:
            label = f"{indicateur.upper()} {direction.upper()}"
            rows  = None

            # 1. Essayer depuis fichier local si dossier fourni
            if args.dossier:
                noms_possibles = [
                    f"ide_{indicateur}_{direction}s_{nom_cnuced.lower()}.csv",
                    f"ide_{indicateur}_{direction}s_{code_iso3.lower()}.csv",
                    f"ide_{indicateur}_{direction}s_{nom_fr.lower()}.csv",
                    f"{code_iso3.lower()}_{direction}_{indicateur}.csv",
                ]
                for nom in noms_possibles:
                    chemin = Path(args.dossier) / nom
                    if chemin.exists():
                        rows = lire_csv_local(str(chemin))
                        print(f"  📂 {label}: {len(rows)} lignes depuis fichier local")
                        break

            # 2. Sinon télécharger depuis CNUCED
            if rows is None:
                print(f"  🌐 {label}: téléchargement depuis CNUCED...", end=" ", flush=True)
                rows = download_cnuced(code_iso3, direction, indicateur)
                if rows:
                    print(f"{len(rows)} lignes")
                else:
                    print("❌ Échec")
                    rapport.append({"pays":nom_fr, "serie":label, "statut":"échec", "inseres":0, "ignores":0})
                    continue

            # 3. Insérer
            inseres, ignores = inserer_donnees(cur, nom_cnuced, direction, indicateur, rows, args.dry_run)
            pays_total_inseres += inseres
            pays_total_ignores += ignores

            statut = "✅" if inseres > 0 else "⏭"
            print(f"  {statut} {label}: +{inseres} nouvelles / {ignores} existantes")
            rapport.append({"pays":nom_fr, "serie":label, "statut":"ok", "inseres":inseres, "ignores":ignores})

            time.sleep(0.5)  # politesse envers CNUCED

        print(f"\n  Total {nom_fr}: +{pays_total_inseres} nouvelles lignes")

        if not args.dry_run:
            conn.commit()

    # Rapport final
    print(f"\n{'═'*60}")
    print(f"  RAPPORT FINAL")
    print(f"{'═'*60}")
    total_inseres = sum(r["inseres"] for r in rapport)
    total_ignores = sum(r["ignores"] for r in rapport)
    echecs        = [r for r in rapport if r["statut"] == "échec"]

    print(f"  ✅ {total_inseres} nouvelles lignes insérées")
    print(f"  ⏭  {total_ignores} lignes déjà existantes")
    if echecs:
        print(f"  ❌ {len(echecs)} échec(s) de téléchargement:")
        for e in echecs:
            print(f"     - {e['pays']} / {e['serie']}")
    print(f"{'═'*60}\n")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
