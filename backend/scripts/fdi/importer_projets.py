#!/usr/bin/env python3
"""Importe en base les pages de projets fDi versionnées dans le dépôt.

    docker compose exec -T backend python scripts/fdi/importer_projets.py

Un fichier `projets/<perimetre>_pNN.csv` = un lot. Le découpage suit celui de
la source : fDi pagine, nous relevons page par page, et chaque page se rejoue
seule. Rejouable à chaque déploiement — les descriptions saisies à l'écran et
les entreprises arbitrées à la main sont conservées quand la ligne décrit
toujours le même projet (cf. `importer_lot`).

À lancer APRÈS `importer.py` : la résolution des secteurs, sous-secteurs,
activités et types s'appuie sur la nomenclature.
"""
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.core.database import AsyncSessionLocal, engine  # noqa: E402
from app.services.fdi_projets import (  # noqa: E402
    DOSSIER_PROJETS,
    LigneInvalide,
    importer_lot,
    lire_lot_csv,
)

# senegal_p01.csv → périmètre « senegal », page 1.
NOM = re.compile(r"^(?P<perimetre>[a-z0-9_]+)_p(?P<page>\d+)$")

PERIMETRES = {"senegal": "Sénégal"}


def decrire(chemin: Path) -> tuple[str, str]:
    """(libellé du lot, périmètre) — le libellé est la clé d'idempotence."""
    m = NOM.match(chemin.stem)
    if not m:
        raise LigneInvalide(
            f"{chemin.name} : nom de fichier attendu « perimetre_pNN.csv ». "
            "Le libellé du lot en dépend, et avec lui la préservation des saisies.")
    perimetre = PERIMETRES.get(m["perimetre"], m["perimetre"].replace("_", " ").title())
    return f"{perimetre} · page {int(m['page']):02d}", perimetre


async def main() -> int:
    fichiers = sorted(DOSSIER_PROJETS.glob("*.csv"))
    if not fichiers:
        print("  aucune page de projets à importer.")
        return 0

    total = preserves = arbitrer = 0
    non_resolus: list[str] = []
    try:
        async with AsyncSessionLocal() as db:
            for chemin in fichiers:
                libelle, perimetre = decrire(chemin)
                rapport = await importer_lot(db, libelle, perimetre,
                                             lire_lot_csv(chemin), "import")
                total += rapport["lignes"]
                preserves += rapport["preserves"]
                arbitrer += rapport["entreprises_a_arbitrer"]
                for ligne, champ, brut, verdict in rapport["non_resolus"]:
                    non_resolus.append(f"{libelle} L{ligne} · {champ} « {brut} » → {verdict}")
                suffixe = f", {rapport['supprimes']} ligne(s) retirée(s)" if rapport["supprimes"] else ""
                print(f"  {libelle:<22} {rapport['lignes']:>3} lignes{suffixe}")
            await db.commit()
    except LigneInvalide as e:
        # Rien n'est écrit : une page illisible s'arrête avant la base plutôt
        # que d'y laisser la moitié d'un lot.
        print(f"  ✗ page illisible : {e}")
        return 1
    finally:
        await engine.dispose()

    print(f"  → {total} projets, {preserves} saisies humaines conservées")
    if arbitrer:
        # Ni un échec ni un oubli : un nom tronqué se tranche à l'écran.
        print(f"  ⚠ {arbitrer} ligne(s) dont l'entreprise reste à arbitrer "
              f"(administration → Projets fDi Markets → Entreprises)")
    for message in non_resolus:
        # La ligne est en base avec son texte brut : c'est le rattachement qui
        # manque, et le signaler vaut mieux que de deviner le voisin le plus proche.
        print(f"  ⚠ {message}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
