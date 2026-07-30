#!/usr/bin/env python3
"""Confronte les libellés pays de la NACE au référentiel ref_pays de la base.

À lancer AVANT de figer la table d'alias, pour arbitrer sur des données
réelles : le référentiel a pu être renommé ou complété par des migrations
postérieures au seed.

    cd backend && python3 scripts/nace/verifier_rapprochement_pays.py

Le script n'importe rien de l'application hormis le rapprocheur partagé :
il tourne donc dans n'importe quel interpréteur, sans FastAPI ni asyncpg.
Deux modes de lecture du référentiel :

  1. connexion directe si psycopg2 ou psycopg (v3) est installé — l'URL
     vient de DATABASE_URL_SYNC, DATABASE_URL ou du fichier .env (racine
     du dépôt ou backend/), les pilotes asynchrones étant ramenés au
     pilote synchrone ;
  2. sinon, un export TSV passé en --ref, à produire sans aucune
     dépendance Python (la commande exacte est rappelée à l'écran).

Source des libellés, par ordre de préférence :
  1. un fichier passé en argument (un libellé par ligne) ;
  2. la table nace_pays si elle est déjà peuplée (tous les libellés
     distincts, toutes éditions) ;
  3. à défaut, libelles_pays_nace_2019.txt livré à côté de ce script
     (les 178 partenaires du tableau 34 de l'édition 2019).

Sortie : les rattachements APPROCHÉS (les seuls susceptibles de se
tromper), les ORPHELINS avec suggestions et un squelette d'alias, puis
le contrôle inverse (pays du référentiel qu'aucun libellé n'atteint).
"""
import json
import os
import re
import sys
from pathlib import Path

RACINE_BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RACINE_BACKEND))

from app.utils.pays_matching import (                          # noqa: E402
    correspondre_pays, normaliser_nom, suggerer_proches,
)

ICI = Path(__file__).parent
FICHIER_ALIAS = ICI / "alias_pays_nace.json"

REQUETE_REF = ("SELECT id, nom_fr, nom_cnuced, code_iso2 FROM ref_pays "
               "WHERE actif IS NOT FALSE ORDER BY nom_fr")

# Repli sans dépendance Python : psql écrit le référentiel en TSV, relu par --ref
AIDE_TSV = f"""Aucun pilote PostgreSQL (psycopg2 / psycopg) dans cet interpréteur.

Deux solutions, au choix :

  a) installer le pilote          pip install psycopg2-binary

  b) exporter le référentiel en TSV, sans dépendance Python :
       docker compose exec -T postgres sh -c \\
         'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F"\\t" -c "{REQUETE_REF}"' \\
         > /tmp/ref_pays.tsv
     puis relancer :
       python3 scripts/nace/verifier_rapprochement_pays.py --ref /tmp/ref_pays.tsv"""


def url_base() -> str:
    """URL PostgreSQL en pilote synchrone, depuis l'environnement ou .env."""
    brut = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("DATABASE_URL")
    if not brut:
        for env in (RACINE_BACKEND / ".env", RACINE_BACKEND.parent / ".env"):
            if not env.exists():
                continue
            texte = env.read_text(encoding="utf-8")
            # Les .env du projet donnent soit DATABASE_URL, soit les morceaux
            m = re.search(r"^DATABASE_URL(?:_SYNC)?\s*=\s*(.+)$", texte, re.M)
            if m:
                brut = m.group(1).strip().strip('"\'')
                break
            morceaux = {c: re.search(rf"^{c}\s*=\s*(.+)$", texte, re.M) for c in
                        ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_PORT")}
            if all(morceaux.values()):
                v = {c: m.group(1).strip().strip('"\'') for c, m in morceaux.items()}
                brut = (f"postgresql://{v['POSTGRES_USER']}:{v['POSTGRES_PASSWORD']}"
                        f"@localhost:{v['POSTGRES_PORT']}/{v['POSTGRES_DB']}")
                break
    if not brut:
        sys.exit("DATABASE_URL introuvable : exportez-la ou renseignez .env")
    return re.sub(r"^postgresql\+\w+://", "postgresql://", brut)


def indexer_reference(lignes) -> dict[str, tuple[int, str, str]]:
    """{nom normalisé: (id, nom_fr, code_iso2)} sur nom_fr ET nom_cnuced."""
    index: dict[str, tuple[int, str, str]] = {}
    for pid, nom_fr, nom_cnuced, iso2 in lignes:
        for nom in (nom_fr, nom_cnuced):
            if nom:
                index.setdefault(normaliser_nom(nom), (int(pid), nom_fr, iso2 or "--"))
    return index


def lire_reference_tsv(chemin: Path):
    """Lignes (id, nom_fr, nom_cnuced, code_iso2) d'un export `psql -At -F'\\t'`."""
    lignes = []
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        if not ligne.strip():
            continue
        champs = (ligne.split("\t") + ["", "", "", ""])[:4]
        lignes.append(tuple(c.strip() or None for c in champs))
    if not lignes:
        sys.exit(f"{chemin} est vide : l'export psql a-t-il abouti ?")
    return lignes


def charger_libelles(cur, chemin: Path | None) -> tuple[list[str], str]:
    """Libellés NACE : fichier explicite, puis table nace_pays, puis le TXT livré."""
    if chemin:
        lignes = chemin.read_text(encoding="utf-8").splitlines()
        return [l.strip() for l in lignes if l.strip()], str(chemin)
    if cur is not None:
        try:
            cur.execute("SELECT DISTINCT pays FROM nace_pays ORDER BY pays")
            libs = [r[0] for r in cur.fetchall()]
            if libs:
                return libs, "table nace_pays"
        except Exception:
            cur.connection.rollback()           # table absente : on continue
    fic = ICI / "libelles_pays_nace_2019.txt"
    return [l.strip() for l in fic.read_text(encoding="utf-8").splitlines() if l.strip()], fic.name


def charger_arbitrage() -> tuple[dict[str, str], dict[str, str]]:
    """(alias, hors_referentiel) de alias_pays_nace.json — les clés `_…` sont
    de la documentation et sont ignorées."""
    if not FICHIER_ALIAS.exists():
        return {}, {}
    doc = json.loads(FICHIER_ALIAS.read_text(encoding="utf-8"))
    return doc.get("alias", {}), doc.get("hors_referentiel", {})


def pilote():
    """psycopg2 ou psycopg (v3), selon ce qui est installé — None si aucun."""
    for nom in ("psycopg2", "psycopg"):
        try:
            return __import__(nom)
        except ModuleNotFoundError:
            continue
    return None


def analyser_arguments() -> tuple[Path | None, Path | None]:
    """(--ref export TSV, fichier de libellés positionnel)."""
    ref = libelles = None
    args = sys.argv[1:]
    while args:
        a = args.pop(0)
        if a in ("-h", "--help"):
            sys.exit(__doc__)
        elif a == "--ref":
            if not args:
                sys.exit("--ref attend un chemin de fichier TSV")
            ref = Path(args.pop(0))
        elif a.startswith("--ref="):
            ref = Path(a.split("=", 1)[1])
        elif a.startswith("-"):
            sys.exit(f"Option inconnue : {a}")
        else:
            libelles = Path(a)
    for chemin in (ref, libelles):
        if chemin and not chemin.exists():
            sys.exit(f"Fichier introuvable : {chemin}")
    return ref, libelles


def principal() -> int:
    chemin_ref, chemin_libelles = analyser_arguments()
    alias, hors_ref = charger_arbitrage()

    if chemin_ref:
        # Mode hors ligne : le référentiel vient de l'export psql, et les
        # libellés du fichier fourni ou du TXT livré (pas d'accès à nace_pays).
        index = indexer_reference(lire_reference_tsv(chemin_ref))
        libelles, origine = charger_libelles(None, chemin_libelles)
        source_ref = str(chemin_ref)
    else:
        pilote_pg = pilote()
        if pilote_pg is None:
            sys.exit(AIDE_TSV)
        with pilote_pg.connect(url_base()) as conn, conn.cursor() as cur:
            cur.execute(REQUETE_REF)
            index = indexer_reference(cur.fetchall())
            libelles, origine = charger_libelles(cur, chemin_libelles)
        source_ref = f"base ({pilote_pg.__name__})"
    print(f"Source du référentiel : {source_ref}")

    print(f"Référentiel : {len({v[0] for v in index.values()})} pays actifs "
          f"({len(index)} graphies avec les alias CNUCED)")
    print(f"Libellés NACE : {len(libelles)} — source : {origine}")
    if alias or hors_ref:
        print(f"Arbitrage {FICHIER_ALIAS.name} : {len(alias)} alias · "
              f"{len(hors_ref)} hors référentiel")
    print()

    noms_ref = list(index)
    par_id = {v[0]: v for v in index.values()}
    index_id = {k: v[0] for k, v in index.items()}
    rattaches: dict[str, tuple[int, str, str]] = {}
    approches: list[tuple[str, str, str]] = []
    orphelins: list[str] = []
    arbitres: list[str] = []                    # « Autres pays » assumés
    alias_morts: list[str] = []                 # alias visant un nom absent de ref_pays
    for lib in libelles:
        if lib in hors_ref:                     # arbitré : pas un oubli
            arbitres.append(lib)
            continue
        vise = alias.get(lib, lib)              # alias explicite prioritaire
        trouve = index.get(normaliser_nom(vise))
        exact = trouve is not None
        if trouve is None:
            pid = correspondre_pays(vise, index_id)
            trouve = par_id.get(pid) if pid else None
        if trouve:
            rattaches[lib] = trouve
            if not exact and lib not in alias:
                approches.append((lib, trouve[1], trouve[2]))
        elif lib in alias:
            # L'alias pointe un nom qui n'existe pas (ou plus) dans ref_pays :
            # c'est une erreur de saisie ou un renommage du référentiel.
            alias_morts.append(f"{lib} → « {alias[lib]} »")
        else:
            orphelins.append(lib)

    print(f"── RÉSULTAT : {len(rattaches)} rattachés · {len(arbitres)} hors référentiel "
          f"assumés · {len(orphelins)} orphelins non arbitrés ──")
    print(f"   couverture du référentiel : "
          f"{len(rattaches) / max(1, len(libelles)) * 100:.0f} % des libellés\n")

    if alias_morts:
        s = "S" if len(alias_morts) > 1 else ""
        print(f"── {len(alias_morts)} ALIAS CASSÉ{s} : la cible est absente de ref_pays ──")
        for m in alias_morts:
            print(f"   {m}")
        print()

    if approches:
        # Rattachements obtenus par réduction des formes d'État ou par
        # rapprochement flou : les seuls qui peuvent se tromper (« CONGO
        # DEMOCRATIQUE » risque « Congo » au lieu de la RDC). À relire.
        print(f"── {len(approches)} rattachements APPROCHÉS, à relire ──")
        for lib, nom, iso in approches:
            print(f"   {lib:34} → {nom} [{iso}]")
        print()

    if orphelins:
        print("── ORPHELINS et suggestions du référentiel ──")
        suggestions: dict[str, str] = {}
        for lib in orphelins:
            proches = suggerer_proches(lib, noms_ref)
            libelle_proches = [f"{index[p][1]} [{index[p][2]}]" for p in proches]
            print(f"   {lib:34} → {' · '.join(libelle_proches) if proches else '(rien de proche)'}")
            suggestions[lib] = index[proches[0]][1] if proches else ""
        print("\n── Squelette pour alias_pays_nace.json (à relire et corriger) ──")
        print(json.dumps(suggestions, ensure_ascii=False, indent=2))

    # Contrôle inverse : pays du référentiel qu'aucun libellé n'atteint. Utile
    # pour repérer un partenaire dont la graphie NACE n'aurait pas été reconnue.
    atteints = {v[0] for v in rattaches.values()}
    manquants = sorted((v[1] for v in par_id.values() if v[0] not in atteints))
    print(f"\n── {len(manquants)} pays de ref_pays sans libellé NACE correspondant ──")
    print("   (normal pour les pays sans échange avec le Sénégal ; y chercher un\n"
          "    partenaire dont la graphie NACE n'aurait pas été reconnue)")
    for nom in manquants:
        print(f"   {nom}")
    return 1 if (orphelins or alias_morts) else 0


if __name__ == "__main__":
    raise SystemExit(principal())
