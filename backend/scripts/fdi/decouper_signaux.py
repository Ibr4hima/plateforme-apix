#!/usr/bin/env python3
"""Découpe un export de signaux d'investisseur en pages versionnables.

    python scripts/fdi/decouper_signaux.py export.csv --depart 2
    python scripts/fdi/decouper_signaux.py export.csv --depart 199 --rang 15

CE QUE CE SCRIPT RÉSOUT. Le relevé se faisait page par page, à l'œil, quinze
lignes à la fois. Un export de la source donne les mêmes colonnes mais une
numérotation CONTINUE — 1 à 1485 — là où le modèle de lot attend un rang dans
les bornes d'une page. Ce script fait la conversion, et rien d'autre : il ne
touche à aucune valeur, ne devine rien, ne corrige rien.

POURQUOI GARDER LE DÉCOUPAGE EN PAGES puisqu'on a l'export complet. Parce que
le lot est l'unité d'idempotence de toute la chaîne : un lot = une page, son
libellé est la clé qui permet de rejouer un import sans rien doubler, et
l'empreinte d'une page évite de réécrire ce qui n'a pas bougé. Un lot unique de
mille cinq cents lignes ferait tout réécrire au moindre ajout.

CE QU'IL FAUT SAVOIR AVANT DE RE-EXPORTER. Les pages de fDi sont classées par
date décroissante : un signal nouveau paraît en tête et TOUT descend d'un rang.
Un export complet repris plus tard décalera donc chaque page, et le travail
humain accroché aux rangs déplacés sera effacé — à raison, puisqu'il ne décrit
plus la bonne entreprise, et l'import le dira. Mieux vaut donc ajouter les
nouvelles pages en tête que réexporter l'ensemble.
"""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services.fdi_projets import LigneInvalide  # noqa: E402
from app.services.fdi_signaux import COLONNES, DOSSIER_SIGNAUX, LIGNES_PAR_PAGE  # noqa: E402


def completer(page: int, lignes: list[dict], rang: int) -> Path:
    """Ajoute des lignes à une page DÉJÀ écrite, à partir du rang donné.

    POURQUOI CE CAS EXISTE. Un export s'arrête rarement sur une frontière de
    page : la source reclasse à chaque signal nouveau, et le dernier tirage se
    termine au milieu d'une page. La suivante reprend donc là où l'on s'était
    arrêté, et la page entamée doit se compléter SANS que ses lignes déjà
    écrites bougent — un rang qui glisse, et le travail humain qui y est
    accroché décrit une autre entreprise.

    D'où le refus si la page ne contient pas exactement les rangs attendus :
    mieux vaut ne rien écrire que décaler une page en silence.
    """
    chemin = DOSSIER_SIGNAUX / f"signaux_p{page:03d}.csv"
    if not chemin.exists():
        raise LigneInvalide(
            f"{chemin.name} n'existe pas : impossible d'y ajouter à partir du rang {rang}")
    with chemin.open(encoding="utf-8") as f:
        deja = list(csv.DictReader(f))
    rangs = sorted(int(l["ligne"]) for l in deja)
    if rangs != list(range(1, rang)):
        raise LigneInvalide(
            f"{chemin.name} porte les rangs {rangs or '—'} ; pour ajouter à partir "
            f"du rang {rang} il devrait porter exactement 1 à {rang - 1}")
    with chemin.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLONNES, lineterminator="\n")
        w.writeheader()
        for l in deja:
            w.writerow({c: l[c] for c in COLONNES})
        for i, l in enumerate(lignes):
            w.writerow({**{c: l[c] for c in COLONNES}, "ligne": rang + i})
    return chemin


def decouper(source: Path, depart: int, rang: int = 1) -> list[Path]:
    with source.open(encoding="utf-8-sig") as f:
        lignes = list(csv.DictReader(f))
    if not lignes:
        raise LigneInvalide(f"{source.name} est vide")

    manquantes = [c for c in COLONNES if c not in lignes[0]]
    if manquantes:
        raise LigneInvalide(f"{source.name} : colonnes manquantes {manquantes}")

    # LA NUMÉROTATION DOIT ÊTRE CONTINUE ET SANS TROU. C'est la seule chose qui
    # garantit qu'on découpe au bon endroit : un rang manquant décalerait toutes
    # les pages suivantes d'une ligne, en silence, et chaque signal se
    # retrouverait sur le rang d'un autre.
    rangs = [int(l["ligne"]) for l in lignes]
    attendus = list(range(1, len(lignes) + 1))
    if rangs != attendus:
        trous = sorted(set(attendus) - set(rangs))[:5]
        doubles = sorted({r for r in rangs if rangs.count(r) > 1})[:5]
        raise LigneInvalide(
            f"{source.name} : numérotation attendue de 1 à {len(lignes)} sans trou "
            f"(manquants {trous or '—'}, doublons {doubles or '—'})")

    DOSSIER_SIGNAUX.mkdir(parents=True, exist_ok=True)
    ecrits = []

    # La page entamée d'abord, s'il y en a une : les lignes qu'elle prend sont
    # retirées du lot avant le découpage régulier, sans quoi tout ce qui suit
    # serait décalé d'autant.
    if rang > 1:
        place = LIGNES_PAR_PAGE - (rang - 1)
        ecrits.append(completer(depart, lignes[:place], rang))
        lignes = lignes[place:]
        depart += 1

    for i in range(0, len(lignes), LIGNES_PAR_PAGE):
        page = depart + i // LIGNES_PAR_PAGE
        bloc = lignes[i:i + LIGNES_PAR_PAGE]
        chemin = DOSSIER_SIGNAUX / f"signaux_p{page:03d}.csv"
        with chemin.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLONNES, lineterminator="\n")
            w.writeheader()
            for n, l in enumerate(bloc, 1):
                # Le rang est réécrit ; TOUT LE RESTE est recopié tel quel,
                # troncatures comprises. C'est le préfixe qui retrouve l'entrée
                # de nomenclature — « corriger » un libellé coupé le rendrait
                # introuvable.
                w.writerow({**{c: l[c] for c in COLONNES}, "ligne": n})
        ecrits.append(chemin)
    return ecrits


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2
    depart = 1
    if "--depart" in sys.argv:
        depart = int(sys.argv[sys.argv.index("--depart") + 1])
    # Le rang auquel la PREMIÈRE ligne de l'export se pose dans la page de
    # départ. Sert à compléter une page entamée : un export s'arrête rarement
    # sur une frontière de page.
    rang = 1
    if "--rang" in sys.argv:
        rang = int(sys.argv[sys.argv.index("--rang") + 1])

    source = Path(args[0])
    if not source.exists():
        print(f"  ✗ fichier introuvable : {source}")
        return 1
    try:
        ecrits = decouper(source, depart, rang)
    except LigneInvalide as e:
        print(f"  ✗ {e}")
        return 1

    dernier = ecrits[-1]
    with dernier.open(encoding="utf-8") as f:
        reste = len(list(csv.DictReader(f)))
    print(f"  {len(ecrits)} page(s) écrite(s) : {ecrits[0].name} → {dernier.name}")
    if reste < LIGNES_PAR_PAGE:
        # Une page incomplète n'est pas une erreur — c'est la dernière de
        # l'export. Mais elle se dira, parce qu'un export tronqué en cours de
        # téléchargement ressemble exactement à cela.
        print(f"  ⚠ la dernière page n'a que {reste} ligne(s) sur {LIGNES_PAR_PAGE} : "
              f"fin de l'export, ou export interrompu ?")
    print("  → relancer ensuite : python scripts/fdi/importer_signaux.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
