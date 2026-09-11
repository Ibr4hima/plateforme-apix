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

from sqlalchemy import text as sa_text  # noqa: E402

from app.core.database import AsyncSessionLocal, engine  # noqa: E402
from app.services.fdi_projets import (  # noqa: E402
    DOSSIER_PROJETS,
    LigneInvalide,
    appliquer_alias_entreprises,
    ecarter_deja_releves,
    empreinte_contexte,
    empreinte_lot,
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

    total = preserves = arbitrer = ecartes = inchanges = 0
    # Ce qui gouverne l'interprétation des pages. Une page dont ni le fichier ni
    # ce contexte n'ont bougé n'est pas réécrite : la base contient déjà
    # exactement ce que cet import y mettrait.
    tout = "--tout" in sys.argv
    contexte = empreinte_contexte()
    non_resolus: list[str] = []
    # Les arbitrages de troncature effectivement appliqués. Ceux qui ne le sont
    # pas méritent d'être signalés : soit la page a changé, soit la décision ne
    # sert plus, et un fichier de décisions mortes finit par n'être plus relu.
    utilises: set = set()
    # Les pages effectivement réécrites. Une page ignorée n'exerce aucun de ses
    # arbitrages : les déclarer inutilisés serait une fausse alerte.
    rejouees: set = set()
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

                lignes, mis_de_cote = ecarter_deja_releves(lignes, perimetre, sens)
                ecartes += len(mis_de_cote)
                if not lignes:
                    print(f"  {libelle:<30} page entière déjà relevée ailleurs")
                    continue

                rapport = await importer_lot(
                    db, libelle, perimetre, lignes, "import", sens,
                    chemin.stem, utilises,
                    None if tout else empreinte_lot(chemin, contexte))
                total += rapport["lignes"]
                preserves += rapport["preserves"]
                # Une page inchangée ne s'annonce pas : mille cent lignes de
                # journal identiques à chaque fois, c'est un journal qu'on ne
                # lit plus — et un journal qu'on ne lit plus ne signale rien.
                if rapport["inchange"]:
                    inchanges += 1
                    continue
                rejouees.add(chemin.stem)
                suffixe = f", {rapport['supprimes']} ligne(s) retirée(s)" if rapport["supprimes"] else ""
                print(f"  {libelle:<30} {rapport['lignes']:>3} lignes{suffixe}")
            # LE RAPPORT DÉCRIT L'ÉTAT DE LA BASE, PAS LE TRAVAIL FAIT. C'est
            # la différence qui compte depuis que les pages inchangées ne sont
            # plus réécrites : compter sur les seuls lots rejoués annoncerait
            # tranquillement « aucun champ non rattaché » alors que quatre le
            # sont depuis trois versements. Ce qu'on veut savoir, c'est ce que
            # la base contient — pas ce que cet import y a écrit.
            arbitrer = (await db.execute(sa_text(
                "SELECT count(*) FROM fdi_projets WHERE statut_entreprise <> 'resolu'"
            ))).scalar_one()
            for nom, cid, cbrut in (("pays d'origine", "pays_source_id", "pays_source_brut"),
                                    ("pays de destination", "pays_dest_id", "pays_dest_brut"),
                                    ("secteur", "secteur_id", "secteur_brut"),
                                    ("sous-secteur", "sous_secteur_id", "sous_secteur_brut"),
                                    ("activité", "activite_id", "activite_brut"),
                                    ("type", "type_projet_id", "type_brut")):
                for r in (await db.execute(sa_text(
                    f"SELECT l.libelle, p.ligne, p.{cbrut} AS brut "
                    f"  FROM fdi_projets p JOIN fdi_lots_import l ON l.id = p.lot_id "
                    f" WHERE p.{cid} IS NULL AND coalesce(p.{cbrut}, '') <> '' "
                    f" ORDER BY l.id, p.ligne"))).fetchall():
                    non_resolus.append(f"{r.libelle} L{r.ligne} · {nom} « {r.brut} »")
            await db.commit()

            # LES STATISTIQUES DU PLANIFICATEUR, APRÈS ÉCRITURE ET AVANT USAGE.
            #
            # Un import massif réécrit des milliers de lignes ; PostgreSQL, lui,
            # garde les statistiques d'avant jusqu'au prochain passage de
            # l'autovacuum — qui peut tarder de plusieurs minutes. Entre les
            # deux, le planificateur choisit ses plans sur une table qu'il croit
            # petite, et il se trompe.
            #
            # Ce n'est pas une inquiétude de principe : mesuré ici, la première
            # page de la vue publique des signaux est passée de 45 ms à 3 599 ms
            # juste après le versement de deux mille neuf cents lignes, et est
            # revenue à 45 ms par ce seul ANALYZE. Un déploiement qui rend
            # l'écran inutilisable pendant quelques minutes est un déploiement
            # raté, même si toutes les données sont justes.
            for t in ("fdi_projets", "fdi_entreprises", "fdi_lots_import"):
                await db.execute(sa_text(f"ANALYZE {t}"))
            await db.commit()
    except LigneInvalide as e:
        # Rien n'est écrit : une page illisible s'arrête avant la base plutôt
        # que d'y laisser la moitié d'un lot.
        print(f"  ✗ page illisible : {e}")
        return 1
    finally:
        await engine.dispose()

    if inchanges:
        print(f"  {inchanges} page(s) inchangée(s), non réécrite(s) "
              f"— « --tout » pour les rejouer quand même")
    # « reconnues » et non « saisies conservées » : ce compte est celui des
    # lignes dont la signature n'a pas bougé, donc que le rejeu a identifiées
    # comme le MÊME projet et dont il a reporté descriptions et arbitrages. Il
    # vaut 16 872 sur un rejeu complet — et l'annoncer comme autant de saisies
    # humaines faisait dire au journal ce qui n'est pas : il n'y en a presque
    # aucune. Un journal qui exagère est un journal qu'on cesse de lire.
    print(f"  → {total} projets en base"
          + (f", {preserves} ligne(s) reconnue(s) comme le même projet "
             f"(descriptions et arbitrages reportés)" if preserves else ""))
    if ecartes:
        # Ni une perte ni une erreur : ces lignes sont en base, sous le relevé
        # du pays lui-même, qui est le seul à le rendre exhaustif.
        print(f"  {ecartes} ligne(s) écartée(s) du relevé de zone — pays déjà relevé "
              f"pour lui-même")
    if utilises:
        print(f"  {len(utilises)} troncature(s) ambiguë(s) tranchée(s) à la main "
              f"(fdi_arbitrages.csv)")
    # Seuls les arbitrages des pages RÉÉCRITES peuvent être jugés : une page
    # ignorée n'en exerce aucun. La complétude du fichier est garantie ailleurs,
    # par les tests, qui le relisent contre tout le relevé à chaque exécution.
    dormants = sorted(k for k in set(lire_arbitrages()) - utilises if k[0] in rejouees)
    for f, ligne, colonne in dormants:
        print(f"  ⚠ arbitrage inutilisé : {f} L{ligne} « {colonne} » — la ligne se "
              f"rattache désormais seule, ou la page a changé")
    if arbitrer:
        # Ni un échec ni un oubli : un nom tronqué se tranche à l'écran.
        print(f"  ⚠ {arbitrer} ligne(s) dont l'entreprise reste à arbitrer "
              f"(administration → Projets fDi Markets → Entreprises)")
    if non_resolus:
        # LE TOTAL D'ABORD, le détail ensuite. Les lignes de détail portent le
        # libellé du lot — « Afrique reçoit · page 1040 » — et se confondent
        # donc avec les lignes de progression dans un journal filtré à la hâte.
        # C'est exactement ce qui est arrivé : quatre sous-secteurs non
        # rattachés sont passés inaperçus plusieurs versements de suite, cachés
        # par un filtre de lecture. Ce total-ci ne ressemble à rien d'autre.
        print(f"  ⚠ {len(non_resolus)} CHAMP(S) NON RATTACHÉ(S) :")
    for message in non_resolus:
        # La ligne est en base avec son texte brut : c'est le rattachement qui
        # manque, et le signaler vaut mieux que de deviner le voisin le plus proche.
        print(f"      {message}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
