#!/usr/bin/env python3
"""Confronte les libellés pays de la NACE au référentiel ref_pays de la base.

À lancer AVANT de figer la table d'alias, pour arbitrer sur des données
réelles : le référentiel a pu être renommé ou complété par des migrations
postérieures au seed.

    cd backend && python3 scripts/nace/verifier_rapprochement_pays.py

Source des libellés, par ordre de préférence :
  1. un fichier passé en argument (un libellé par ligne) ;
  2. la table nace_pays si elle est déjà peuplée (tous les libellés
     distincts, toutes éditions) ;
  3. à défaut, libelles_pays_nace_2019.txt livré à côté de ce script
     (les 178 partenaires du tableau 34 de l'édition 2019).

Le rapprochement réutilise tel quel celui du module BMCE, puis applique
les alias de alias_pays_nace.json s'il existe. Sortie :

  · le décompte rattachés / orphelins ;
  · chaque orphelin avec les trois noms de ref_pays les plus proches,
    pour trancher ;
  · un squelette d'alias_pays_nace.json prêt à compléter ;
  · les pays de ref_pays qu'aucun libellé n'atteint (contrôle inverse).
"""
import asyncio
import json
import sys
from difflib import get_close_matches
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import text                                    # noqa: E402
from app.core.database import AsyncSessionLocal                # noqa: E402
from app.api.routes.bmce import (                              # noqa: E402
    _normaliser_nom, _correspondre_pays, FORMES_ETAT, LIAISONS,
)

ICI = Path(__file__).parent
FICHIER_ALIAS = ICI / "alias_pays_nace.json"


def suggerer(libelle: str, noms_ref: list[str], index: dict) -> list[str]:
    """Noms de ref_pays les plus proches d'un libellé orphelin.

    La forme réduite (sans « RÉPUBLIQUE DE », « ÎLES »…) passe d'abord car
    elle est plus discriminante : sur la chaîne entière, « REPUBLIQUE
    TCHEQUE » suggérerait « République centrafricaine », « République
    dominicaine »… alors que « TCHEQUE » mène droit à Tchéquie.
    """
    n = _normaliser_nom(libelle)
    tokens = [t for t in n.split() if t not in FORMES_ETAT | LIAISONS
              and t not in {"ILE", "ILES", "CITE"}]
    reduit = " ".join(tokens)
    formes = ([reduit] if tokens and reduit != n else []) + [n]
    vus: list[str] = []
    for forme in formes:
        for p in get_close_matches(forme, noms_ref, n=3, cutoff=0.45):
            if p not in vus:
                vus.append(p)
    return [f"{index[p][1]} [{index[p][2]}]" for p in vus[:3]]


async def charger_reference(db) -> dict[str, tuple[int, str, str]]:
    """{nom normalisé: (id, nom_fr, code_iso2)} sur nom_fr ET nom_cnuced."""
    res = await db.execute(text(
        "SELECT id, nom_fr, nom_cnuced, code_iso2 FROM ref_pays "
        "WHERE actif IS NOT FALSE ORDER BY nom_fr"))
    index: dict[str, tuple[int, str, str]] = {}
    for pid, nom_fr, nom_cnuced, iso2 in res:
        for nom in (nom_fr, nom_cnuced):
            if nom:
                index.setdefault(_normaliser_nom(nom), (pid, nom_fr, iso2 or "--"))
    return index


async def charger_libelles(db) -> tuple[list[str], str]:
    if len(sys.argv) > 1:
        chemin = Path(sys.argv[1])
        return [l.strip() for l in chemin.read_text(encoding="utf-8").splitlines() if l.strip()], str(chemin)
    try:
        res = await db.execute(text("SELECT DISTINCT pays FROM nace_pays ORDER BY pays"))
        libs = [r[0] for r in res]
        if libs:
            return libs, "table nace_pays"
    except Exception:
        pass                                    # table absente : on retombe sur le fichier
    fic = ICI / "libelles_pays_nace_2019.txt"
    return [l.strip() for l in fic.read_text(encoding="utf-8").splitlines() if l.strip()], fic.name


async def principal() -> int:
    alias = json.loads(FICHIER_ALIAS.read_text(encoding="utf-8")) if FICHIER_ALIAS.exists() else {}
    async with AsyncSessionLocal() as db:
        index = await charger_reference(db)
        libelles, origine = await charger_libelles(db)

    print(f"Référentiel : {len({v[0] for v in index.values()})} pays actifs "
          f"({len(index)} graphies avec les alias CNUCED)")
    print(f"Libellés NACE : {len(libelles)} — source : {origine}")
    if alias:
        print(f"Alias NACE déjà définis : {len(alias)}")
    print()

    noms_ref = list(index)
    rattaches: dict[str, tuple[int, str, str]] = {}
    approches: list[tuple[str, str, str]] = []   # rattachés autrement qu'à l'identique
    orphelins: list[str] = []
    for lib in libelles:
        vise = alias.get(lib, lib)              # alias explicite prioritaire
        cle = _normaliser_nom(vise)
        trouve = index.get(cle)
        exact = trouve is not None
        if trouve is None:
            pid = _correspondre_pays(vise, {k: v[0] for k, v in index.items()})
            trouve = next((v for v in index.values() if v[0] == pid), None) if pid else None
        if trouve:
            rattaches[lib] = trouve
            if not exact and lib not in alias:
                approches.append((lib, trouve[1], trouve[2]))
        else:
            orphelins.append(lib)

    print(f"── RÉSULTAT : {len(rattaches)} rattachés · {len(orphelins)} orphelins "
          f"({len(rattaches) / max(1, len(libelles)) * 100:.0f} %) ──\n")

    if approches:
        # Ces rattachements viennent de la réduction des formes d'État ou du
        # rapprochement flou : ce sont eux qui peuvent se tromper (« CONGO
        # DEMOCRATIQUE » risque « Congo » au lieu de la RDC). À relire.
        print(f"── {len(approches)} rattachements APPROCHÉS, à relire ──")
        for lib, nom, iso in approches:
            print(f"   {lib:34} → {nom} [{iso}]")
        print()

    if orphelins:
        print("── ORPHELINS et suggestions du référentiel ──")
        suggestions: dict[str, str] = {}
        for lib in orphelins:
            proches = suggerer(lib, noms_ref, index)
            print(f"   {lib:34} → {' · '.join(proches) if proches else '(rien de proche)'}")
            suggestions[lib] = proches[0].rsplit(" [", 1)[0] if proches else ""
        print("\n── Squelette pour alias_pays_nace.json (à relire et corriger) ──")
        print(json.dumps(suggestions, ensure_ascii=False, indent=2))

    # Contrôle inverse : pays du référentiel qu'aucun libellé n'atteint. Utile
    # pour repérer un partenaire mal orthographié qui serait passé inaperçu.
    atteints = {v[0] for v in rattaches.values()}
    manquants = sorted({(v[0], v[1]) for v in index.values() if v[0] not in atteints}, key=lambda x: x[1])
    print(f"\n── {len(manquants)} pays de ref_pays sans libellé NACE correspondant ──")
    print("   (normal pour les pays sans échange avec le Sénégal ; y chercher"
          " un partenaire\n    dont la graphie NACE n'aurait pas été reconnue)")
    for _, nom in manquants:
        print(f"   {nom}")
    return 0 if not orphelins else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(principal()))
