#!/usr/bin/env python3
"""Importe en base les CSV NACE versionnés dans le dépôt.

Même corps que POST /nace/importer, mais sans passer par HTTP : le
déploiement l'exécute dans le conteneur backend (les CSV sont dans l'image),
là où aucun jeton d'administrateur n'est disponible.

    docker compose exec -T backend python scripts/nace/importer.py

L'import est idempotent (upsert sur la clé naturelle), donc rejouable à
chaque déploiement : les données suivent les CSV du dépôt.
"""
import asyncio
import sys
from pathlib import Path

# Exécutable depuis n'importe quel dossier : la racine du backend (qui porte
# le paquet `app`) est ajoutée au chemin d'import.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.api.routes.nace import importer_csv  # noqa: E402
from app.core.database import AsyncSessionLocal, engine  # noqa: E402


async def main() -> int:
    async with AsyncSessionLocal() as db:
        rapport = await importer_csv(db)
        await db.commit()
    await engine.dispose()

    for famille, d in rapport.items():
        editions = ", ".join(str(e) for e in d["editions"])
        print(f"  {famille:<22} {d['lignes']:>6} lignes · éditions {editions}")

    pays = rapport.get("pays", {})
    print(
        f"  → pays : {pays.get('rattachees', 0)} rattachés au référentiel, "
        f"{pays.get('hors_referentiel', 0)} hors référentiel assumés"
    )
    # Un libellé ni rattaché ni arbitré signifie qu'une édition a introduit un
    # partenaire inconnu : ses montants existent en base mais resteront hors
    # de toute agrégation par pays. On le signale sans faire échouer le
    # déploiement — le reste des données est bon.
    orphelins = pays.get("non_arbitres") or []
    if orphelins:
        print(f"  ⚠ {len(orphelins)} libellé(s) pays non arbitré(s) : {', '.join(orphelins)}")
        print("    → les trancher dans backend/scripts/nace/alias_pays_nace.json")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
