#!/usr/bin/env python3
"""Importe en base la classification fDi Markets versionnée dans le dépôt.

    docker compose exec -T backend python scripts/fdi/importer.py

Idempotent (upsert sur le code) : rejouable à chaque déploiement, la base suit
les CSV du dépôt.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import text as sa_text  # noqa: E402

from app.core.database import AsyncSessionLocal, engine  # noqa: E402
from app.services.fdi_classification import ClassificationInvalide, importer  # noqa: E402


async def main() -> int:
    try:
        async with AsyncSessionLocal() as db:
            rapport = await importer(db)
            await db.commit()

            # LES STATISTIQUES DU PLANIFICATEUR, comme après les deux autres
            # imports. Ces tables-ci sont petites — quelques dizaines de lignes —
            # mais elles sont JOINTES à tout ce que les écrans affichent : un
            # secteur, une activité, une nature de signal. PostgreSQL qui n'a
            # jamais analysé fdi_secteurs suppose une cardinalité par défaut et
            # choisit ses plans dessus.
            #
            # Mesuré : la première page de la vue publique des signaux tombait à
            # 2 945 ms après un simple rechargement de la nomenclature, alors
            # même que pas une ligne de signal n'avait bougé, et revenait à
            # 44 ms par ce seul ANALYZE. Les deux tables n'avaient jamais été
            # analysées de leur existence.
            for t in ("fdi_secteurs", "fdi_sous_secteurs", "fdi_activites",
                      "fdi_signaux", "fdi_types_projet", "fdi_regions_monde"):
                await db.execute(sa_text(f"ANALYZE {t}"))
            await db.commit()
    except ClassificationInvalide as e:
        print(f"  ✗ classification invalide : {e}")
        return 1
    finally:
        await engine.dispose()

    print(f"  secteurs                {rapport['secteurs']:>4}")
    print(f"  sous-secteurs           {rapport['sous_secteurs']:>4}")
    print(f"  activités économiques   {rapport['activites']:>4}")
    print(f"  signaux d'investisseur  {rapport['signaux']:>4}")
    print(f"  types de projet         {rapport['types_projet']:>4}")
    print(f"  → {rapport['libelles_partages']} libellés de sous-secteur partagés par "
          f"plusieurs secteurs : l'appariement exige toujours le secteur.")

    if rapport["secteurs_sans_sous_secteur"]:
        print(f"  ⚠ secteurs sans sous-secteur : {', '.join(rapport['secteurs_sans_sous_secteur'])}")

    for famille, codes in rapport["ajouts_admin"].items():
        if codes:
            print(f"  + {len(codes)} {famille} ajoutés depuis l'administration : {', '.join(codes[:5])}")
    for famille, codes in rapport["proteges"].items():
        if codes:
            # La base a été corrigée à l'écran ET le dépôt décrit ces lignes :
            # l'import ne les a pas touchées. À arbitrer un jour, sciemment.
            print(f"  ≠ {len(codes)} {famille} corrigés à l'écran, non écrasés : {', '.join(codes[:5])}")
    for famille, codes in rapport["orphelins_en_base"].items():
        if codes:
            # Ni supprimés ni ignorés : une nomenclature qui perd un poste est
            # une décision à prendre, pas un effet de bord d'import.
            print(f"  ⚠ {len(codes)} {famille} en base absents du dépôt : {', '.join(codes[:5])}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
