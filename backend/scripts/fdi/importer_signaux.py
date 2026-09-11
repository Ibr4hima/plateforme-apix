#!/usr/bin/env python3
"""Importe en base les pages de signaux d'investisseur fDi versionnées dans le dépôt.

    docker compose exec -T backend python scripts/fdi/importer_signaux.py

Un fichier `signaux/signaux_pNNN.csv` = un lot, une page de la source. Chaque
page se rejoue seule, et l'ensemble se rejoue à chaque déploiement.

CE QUE CE SCRIPT PRÉSERVE, et qui justifie toute sa prudence : les VALEURS
AJOUTÉES À LA MAIN. Le tableau de fDi n'affiche qu'une destination, un secteur,
une activité et une nature par signal, et cache les autres — sans signaler de
façon fiable qu'il en cache. Le relevé porte donc ce qui est visible, et le
reste se complète dans l'administration. Un réimport qui effacerait ces ajouts
détruirait des heures de travail en silence ; il ne réécrit donc que les
valeurs d'origine « import ».

À lancer APRÈS `importer.py` : la résolution des secteurs, activités, natures
de signal et régions du monde s'appuie sur la nomenclature.
"""
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import text as sa_text  # noqa: E402

from app.core.database import AsyncSessionLocal, engine  # noqa: E402
from app.services.fdi_projets import (  # noqa: E402
    LigneInvalide,
    appliquer_alias_entreprises,
    lire_pays_csv,
)
from app.services import fdi_signaux as S  # noqa: E402

# signaux_p001.csv          → Afrique, page 1
# signaux_afrique_p001.csv  → idem, périmètre écrit en toutes lettres
NOM = re.compile(r"^signaux(?:_(?P<perimetre>[a-z0-9_]+))?_p(?P<page>\d+)$")

PERIMETRES = {"afrique": "Afrique", "senegal": "Sénégal"}


def decrire(chemin: Path) -> tuple[str, str]:
    """(libellé du lot, périmètre). Le libellé est la clé d'idempotence : c'est
    par lui qu'un réimport retrouve le lot au lieu d'en créer un second."""
    m = NOM.match(chemin.stem)
    if not m:
        raise LigneInvalide(
            f"{chemin.name} : nom de fichier attendu « signaux_pNNN.csv ». Le libellé "
            "du lot en dépend, et avec lui la préservation des saisies.")
    brut = m["perimetre"] or "afrique"
    perimetre = PERIMETRES.get(brut, brut.replace("_", " ").title())
    return f"Signaux {perimetre} · page {int(m['page']):03d}", perimetre


def numero(chemin: Path) -> int:
    """Le numéro de page, pour trier. Trier sur le nom rangerait « p100 » entre
    « p10 » et « p11 », et le journal annoncerait les pages dans le désordre."""
    m = NOM.match(chemin.stem)
    return int(m["page"]) if m else 0


async def main() -> int:
    fichiers = sorted(S.DOSSIER_SIGNAUX.glob("*.csv"), key=numero)
    if not fichiers:
        print("  aucune page de signaux à importer.")
        return 0

    total = inchanges = crees = 0
    tout = "--tout" in sys.argv
    contexte = S.empreinte_contexte()
    manques: list[str] = []
    try:
        async with AsyncSessionLocal() as db:
            # AVANT les lots, pour la même raison que chez les projets : une
            # graphie fautive déclarée doit déjà pointer vers la bonne
            # entreprise quand la première ligne qui la porte est écrite.
            fusions = await appliquer_alias_entreprises(db, "import")
            if fusions:
                print(f"  {fusions} entreprise(s) fusionnée(s) (fdi_entreprises_alias.csv)")

            # AVANT TOUT IMPORT : les lignes d'avant la bascule vers
            # l'identité par le contenu n'ont pas de clé, et sans elle le
            # premier import les doublerait toutes.
            reprises = await S.reprendre_empreintes(db)
            if reprises:
                print(f"  {reprises} signal(aux) ont reçu leur empreinte "
                      f"(reprise unique, à la bascule d'identité)")

            ref = await S.referentiels(db)
            correspondance = lire_pays_csv()

            for chemin in fichiers:
                libelle, perimetre = decrire(chemin)
                lignes = S.lire_lot_csv(chemin)
                rapport = await S.importer_lot(
                    db, libelle, f"Dest = {perimetre}", "destination", lignes,
                    ref, correspondance, "import",
                    None if tout else S.empreinte_lot(chemin, contexte))
                # Une page inchangée ne s'annonce pas : trois cents lignes de
                # journal identiques à chaque fois, c'est un journal qu'on ne
                # lit plus — et qui donc ne signale plus rien.
                if rapport["inchange"]:
                    inchanges += 1
                    continue
                total += rapport["lignes"]
                crees += rapport.get("crees", 0)
                # CE QUI EST CRÉÉ SE DIT, le reste non. Depuis que l'identité
                # d'un signal tient à son contenu, une page rejouée ne crée
                # rien : elle retrouve ses lignes où qu'elles soient tombées. Un
                # nombre de créations inattendu est donc le symptôme à guetter —
                # soit la source a publié du nouveau, soit la formule de clé a
                # changé et la base est en train de se dédoubler.
                marque = (f"   + {rapport['crees']} nouveau(x)"
                          if rapport.get("crees") else "")
                print(f"  {libelle:<32} {rapport['lignes']:>3} lignes{marque}")

            # LE RAPPORT DÉCRIT L'ÉTAT DE LA BASE, PAS LE TRAVAIL FAIT. Depuis
            # que les pages inchangées ne sont plus réécrites, compter sur les
            # seuls lots rejoués annoncerait « rien à signaler » alors que des
            # rattachements manquent depuis plusieurs versements.
            arbitrer = (await db.execute(sa_text(
                "SELECT count(*) FROM fdi_signaux_investisseurs "
                " WHERE statut_entreprise <> 'resolu'"))).scalar_one()

            for nom, table, colonne in (
                    ("destination", "fdi_signal_destinations", "pays_id IS NULL AND region_id IS NULL"),
                    ("secteur",     "fdi_signal_secteurs",     "secteur_id IS NULL"),
                    ("activité",    "fdi_signal_activites",    "activite_id IS NULL"),
                    ("nature",      "fdi_signal_natures",      "nature_id IS NULL")):
                for r in (await db.execute(sa_text(
                    f"SELECT l.libelle, s.ligne, v.brut "
                    f"  FROM {table} v "
                    f"  JOIN fdi_signaux_investisseurs s ON s.id = v.signal_id "
                    f"  JOIN fdi_lots_import l ON l.id = s.lot_id "
                    f" WHERE {colonne} AND coalesce(v.brut, '') <> '' "
                    f" ORDER BY l.id, s.ligne"))).fetchall():
                    manques.append(f"{r.libelle} L{r.ligne} · {nom} « {r.brut} »")

            for r in (await db.execute(sa_text(
                "SELECT l.libelle, s.ligne, s.pays_source_brut AS brut "
                "  FROM fdi_signaux_investisseurs s "
                "  JOIN fdi_lots_import l ON l.id = s.lot_id "
                " WHERE s.pays_source_id IS NULL AND coalesce(s.pays_source_brut,'') <> '' "
                " ORDER BY l.id, s.ligne"))).fetchall():
                manques.append(f"{r.libelle} L{r.ligne} · pays d'origine « {r.brut} »")

            # CE QUI RESTE À COMPLÉTER À LA MAIN. Un signal relevé sous
            # « Dest = Afrique » qui n'affiche aucune destination africaine est
            # dans le résultat par une destination que le tableau cachait :
            # c'est exactement le travail que l'administration attend.
            en_base, sans_afrique = (await db.execute(sa_text("""
                SELECT count(*),
                       count(*) FILTER (WHERE NOT coalesce(vise, false))
                FROM (
                    SELECT s.id, bool_or(p.continent = 'Afrique'
                                         OR r.libelle_en = 'Africa') AS vise
                    FROM fdi_signaux_investisseurs s
                    LEFT JOIN fdi_signal_destinations d ON d.signal_id = s.id
                    LEFT JOIN ref_pays p ON p.id = d.pays_id
                    LEFT JOIN fdi_regions_monde r ON r.id = d.region_id
                    GROUP BY s.id
                ) x"""))).first()
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
            for t in ("fdi_signaux_investisseurs", "fdi_signal_destinations",
                      "fdi_signal_secteurs", "fdi_signal_activites",
                      "fdi_signal_natures", "fdi_lots_import"):
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
    print(f"  → {total} signaux écrits, {en_base} en base")
    if crees:
        print(f"  + {crees} signal(aux) créé(s) — les autres ont été retrouvés par leur "
              f"contenu, où qu'ils soient tombés dans la pagination.")
    if arbitrer:
        print(f"  ⚠ {arbitrer} ligne(s) dont l'entreprise reste à arbitrer "
              f"(administration → fDi Markets → Investor signals)")
    if sans_afrique:
        # Ni une erreur ni une lacune du relevé : la destination africaine
        # existe chez fDi, le tableau ne la montrait pas. C'est une file de
        # travail, et elle mérite d'être chiffrée à chaque import.
        print(f"  ⚠ {sans_afrique} signal(aux) sans destination africaine visible "
              f"— à compléter dans l'administration")
    if manques:
        # LE TOTAL D'ABORD, le détail ensuite : les lignes de détail portent le
        # libellé du lot et se confondraient avec les lignes de progression
        # dans un journal filtré à la hâte. Ce total-ci ne ressemble à rien d'autre.
        print(f"  ⚠ {len(manques)} CHAMP(S) NON RATTACHÉ(S) :")
    for message in manques:
        print(f"      {message}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
