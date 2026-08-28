from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

# Classification sectorielle fDi Markets — consultation seule.
#
# Aucune route d'écriture, et c'est délibéré : la nomenclature vient des CSV
# versionnés (backend/scripts/fdi/), que le déploiement rejoue à chaque mise en
# ligne. Une modification saisie ici serait écrasée au déploiement suivant,
# sans trace ni avertissement — l'endroit où l'on corrige la nomenclature, ce
# sont les fichiers du dépôt, où le changement se relit dans un diff.
router = APIRouter(prefix="/fdi", tags=["fdi"])


@router.get("/classification")
async def classification(db: AsyncSession = Depends(get_db)):
    """L'arbre secteurs → sous-secteurs, et les activités économiques.

    Une seule réponse plutôt que trois requêtes : 324 lignes au total, que
    l'écran filtre et déplie côté client. Aller-retour unique, pas d'état de
    chargement partiel.
    """
    secteurs = (await db.execute(text(
        "SELECT id, code, libelle_en, libelle_fr, ordre FROM fdi_secteurs ORDER BY ordre"
    ))).fetchall()

    sous = (await db.execute(text(
        "SELECT id, secteur_id, code, libelle_en, libelle_fr, libelle_en_base, "
        "       cle_appariement, ordre "
        "FROM fdi_sous_secteurs ORDER BY ordre"
    ))).fetchall()

    activites = (await db.execute(text(
        "SELECT id, code, libelle_en, libelle_fr, ordre FROM fdi_activites ORDER BY ordre"
    ))).fetchall()

    # Un libellé qui sert à plusieurs secteurs — « Other » en sert 24 — n'est
    # pas une anomalie mais une propriété de la nomenclature. Le compter ici
    # évite que chaque écran le recalcule, et permet de le signaler à l'œil.
    partages: dict[str, int] = {}
    for r in sous:
        partages[r.cle_appariement] = partages.get(r.cle_appariement, 0) + 1

    par_secteur: dict[int, list] = {}
    for r in sous:
        par_secteur.setdefault(r.secteur_id, []).append({
            "id": r.id,
            "code": r.code,
            "libelle_en": r.libelle_en,
            "libelle_fr": r.libelle_fr,
            "libelle_en_base": r.libelle_en_base,
            "partage": partages[r.cle_appariement] > 1,
            "ordre": r.ordre,
        })

    return {
        "secteurs": [
            {
                "id": s.id, "code": s.code, "libelle_en": s.libelle_en,
                "libelle_fr": s.libelle_fr, "ordre": s.ordre,
                "sous_secteurs": par_secteur.get(s.id, []),
            }
            for s in secteurs
        ],
        "activites": [
            {"id": a.id, "code": a.code, "libelle_en": a.libelle_en,
             "libelle_fr": a.libelle_fr, "ordre": a.ordre}
            for a in activites
        ],
        "totaux": {
            "secteurs": len(secteurs),
            "sous_secteurs": len(sous),
            "activites": len(activites),
            "libelles_partages": sum(1 for n in partages.values() if n > 1),
        },
    }
