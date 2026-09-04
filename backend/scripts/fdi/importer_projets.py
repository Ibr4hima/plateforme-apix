#!/usr/bin/env python3
"""Importe en base les pages de projets fDi versionnées dans le dépôt.

    docker compose exec -T backend python scripts/fdi/importer_projets.py

Un fichier `projets/<perimetre>[_source]_pNN.csv` = un lot. Le découpage suit
celui de la source : fDi pagine, nous relevons page par page, et chaque page se
rejoue seule. Rejouable à chaque déploiement — les descriptions saisies à
l'écran et les entreprises arbitrées à la main sont conservées quand la ligne
décrit toujours le même projet (cf. `importer_lot`).

LE SENS FAIT PARTIE DU PÉRIMÈTRE. `senegal_p01.csv` est relevé sous
« Dest = Senegal » ; `senegal_source_p01.csv` sous « Source = Senegal ». La
distinction n'est pas cosmétique : un lot ne rend exhaustif que le couple
(pays, sens) qu'il a interrogé. Les pays d'origine qui apparaissent dans le
premier n'y figurent que pour ce qu'ils ont envoyé au Sénégal — les compter
comme des périmètres à part entière donnerait une image fausse (cf. migration
135).

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
    appliquer_alias_entreprises,
    importer_lot,
    lire_arbitrages,
    lire_lot_csv,
)

# senegal_p01.csv        → Sénégal, destination, page 1
# senegal_source_p01.csv → Sénégal, source, page 1
NOM = re.compile(r"^(?P<perimetre>[a-z0-9]+(?:_[a-z0-9]+)*?)(?P<sens>_source)?_p(?P<page>\d+)$")

# Le périmètre écrit dans le nom du fichier, et son libellé en base. Il peut
# désigner un PAYS ou une ZONE : « Dest = Africa » rend complet chacun des pays
# africains, et la route publique le résout sur le continent de ref_pays.
PERIMETRES = {"senegal": "Sénégal", "afrique": "Afrique"}

# Ce qu'une ZONE ne doit PAS reprendre, parce que c'est déjà relevé pays par
# pays. Le Sénégal est dans l'Afrique : sans cette garde, ses projets
# entreraient une seconde fois par le relevé continental et tous les totaux
# seraient faux — deux fois le nombre de projets, deux fois les montants.
#
# Le contrôle est fait ICI, à l'import, et non laissé à la vigilance de qui
# transcrit : sur mille cent pages, une ligne oubliée est une certitude, et
# elle ne se verrait qu'au moment où quelqu'un citerait le total en réunion.
EXCLUS = {"Afrique": {"senegal"}}

# Ce que le libellé du lot annonce, en clair : il apparaît tel quel dans les
# rapports d'import et dans l'administration.
VERBE = {"destination": "reçoit", "source": "investit"}


def decrire(chemin: Path) -> tuple[str, str, str]:
    """(libellé du lot, périmètre, sens) — le libellé est la clé d'idempotence.

    Le sens entre dans le libellé : sans lui, la page 1 des projets reçus et
    la page 1 des projets émis porteraient le même nom, et le second import
    écraserait le premier.
    """
    m = NOM.match(chemin.stem)
    if not m:
        raise LigneInvalide(
            f"{chemin.name} : nom de fichier attendu « perimetre_pNN.csv » ou "
            "« perimetre_source_pNN.csv ». Le libellé du lot en dépend, et avec "
            "lui la préservation des saisies.")
    perimetre = PERIMETRES.get(m["perimetre"], m["perimetre"].replace("_", " ").title())
    sens = "source" if m["sens"] else "destination"
    return f"{perimetre} {VERBE[sens]} · page {int(m['page']):02d}", perimetre, sens


def numero(chemin: Path) -> tuple[str, int]:
    """(périmètre, numéro de page) — la clef de tri des fichiers.

    Trier sur le NOM rangerait « p100 » entre « p10 » et « p11 », et le
    journal d'import annoncerait les pages dans le désordre. Sans importance
    pour ce qui est écrit, mais un relevé qu'on ne peut pas suivre à l'œil est
    un relevé qu'on ne vérifie plus.
    """
    m = NOM.match(chemin.stem)
    return (chemin.stem if not m else m["perimetre"], 0 if not m else int(m["page"]))


async def main() -> int:
    fichiers = sorted(DOSSIER_PROJETS.glob("*.csv"), key=numero)
    if not fichiers:
        print("  aucune page de projets à importer.")
        return 0

    total = preserves = arbitrer = ecartes = 0
    non_resolus: list[str] = []
    # Les arbitrages de troncature effectivement appliqués. Ceux qui ne le sont
    # pas méritent d'être signalés : soit la page a changé, soit la décision ne
    # sert plus, et un fichier de décisions mortes finit par n'être plus relu.
    utilises: set = set()
    try:
        async with AsyncSessionLocal() as db:
            # AVANT les lots : une graphie fautive déclarée doit déjà pointer
            # vers la bonne entreprise quand la première ligne qui la porte
            # est écrite, sinon l'import recrée la jumelle qu'on vient de
            # défaire.
            fusions = await appliquer_alias_entreprises(db, "import")
            if fusions:
                print(f"  {fusions} entreprise(s) fusionnée(s) (fdi_entreprises_alias.csv)")

            for chemin in fichiers:
                libelle, perimetre, sens = decrire(chemin)
                lignes = lire_lot_csv(chemin)

                # Un pays déjà relevé pour lui-même n'entre pas dans le lot de
                # sa zone : ses projets y seraient comptés deux fois. Mais ses
                # lignes RESTENT dans le fichier, parce que le fichier dit ce
                # que la page affichait — et que les retirer du relevé décalerait
                # les rangs, donc les frontières de page, donc l'identité même
                # des lots. On écarte à l'écriture, jamais à la transcription.
                interdits = EXCLUS.get(perimetre, set())
                if interdits and sens == "destination":
                    gardees = [l for l in lignes
                               if (l.get("dest") or "").strip().lower() not in interdits]
                    ecartes += len(lignes) - len(gardees)
                    lignes = gardees
                    if not lignes:
                        print(f"  {libelle:<30} page entière déjà relevée ailleurs")
                        continue

                rapport = await importer_lot(db, libelle, perimetre,
                                             lignes, "import", sens,
                                             chemin.stem, utilises)
                total += rapport["lignes"]
                preserves += rapport["preserves"]
                arbitrer += rapport["entreprises_a_arbitrer"]
                for ligne, champ, brut, verdict in rapport["non_resolus"]:
                    non_resolus.append(f"{libelle} L{ligne} · {champ} « {brut} » → {verdict}")
                suffixe = f", {rapport['supprimes']} ligne(s) retirée(s)" if rapport["supprimes"] else ""
                print(f"  {libelle:<30} {rapport['lignes']:>3} lignes{suffixe}")
            await db.commit()
    except LigneInvalide as e:
        # Rien n'est écrit : une page illisible s'arrête avant la base plutôt
        # que d'y laisser la moitié d'un lot.
        print(f"  ✗ page illisible : {e}")
        return 1
    finally:
        await engine.dispose()

    print(f"  → {total} projets, {preserves} saisies humaines conservées")
    if ecartes:
        # Ni une perte ni une erreur : ces lignes sont en base, sous le relevé
        # du pays lui-même, qui est le seul à le rendre exhaustif.
        print(f"  {ecartes} ligne(s) écartée(s) du relevé de zone — pays déjà relevé "
              f"pour lui-même")
    if utilises:
        print(f"  {len(utilises)} troncature(s) ambiguë(s) tranchée(s) à la main "
              f"(fdi_arbitrages.csv)")
    dormants = sorted(set(lire_arbitrages()) - utilises)
    for f, ligne, colonne in dormants:
        print(f"  ⚠ arbitrage inutilisé : {f} L{ligne} « {colonne} » — la ligne se "
              f"rattache désormais seule, ou la page a changé")
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
