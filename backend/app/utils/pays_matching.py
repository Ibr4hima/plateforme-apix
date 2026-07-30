"""Rapprochement des libellés de pays des publications ANSD au référentiel.

Les bulletins et notes de l'ANSD écrivent les pays en majuscules, avec des
graphies variables (« REPUBLIQUE POPULAIRE DE CHINE », « ETATS UNIS
D'AMERIQUE », « ARABIE SEOUDITE ») et quelques coquilles (« AFGANISTAN »,
« BENGLADESH »). Ce module isole la logique de rapprochement pour qu'elle
soit partagée par les modules d'import et par les scripts d'audit — ces
derniers doivent pouvoir tourner sans FastAPI ni pilote de base, d'où
l'absence de toute dépendance ici.
"""
import re
import unicodedata
from difflib import get_close_matches

# Formes d'État et liaisons que les publications accolent aux noms de pays
FORMES_ETAT = {"REPUBLIQUE", "ROYAUME", "ETAT", "ETATS", "UNION", "SULTANAT",
               "PRINCIPAUTE", "EMIRAT", "EMIRATS", "COMMONWEALTH", "FEDERATION",
               "POPULAIRE", "DEMOCRATIQUE", "ISLAMIQUE", "ARABE", "FEDERALE",
               "FEDERATIVE", "SOCIALISTE"}
LIAISONS = {"D", "DE", "DU", "DES", "LA", "LE", "LES", "L"}


def normaliser_nom(nom: str) -> str:
    """« Côte d'Ivoire » → « COTE D IVOIRE » : sans accents ni ponctuation."""
    t = unicodedata.normalize("NFD", nom)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z0-9]+", " ", t.upper()).strip()


def correspondre_pays(libelle: str, index: dict[str, int]) -> int | None:
    """Identifiant du pays correspondant au libellé, ou None.

    `index` associe un nom normalisé (nom_fr ou nom_cnuced du référentiel)
    à l'identifiant du pays. Quatre passes, de la plus sûre à la plus
    permissive : égalité, réduction des formes d'État, nom du référentiel
    suivi d'une liaison, puis rapprochement flou très serré (coquilles).
    """
    n = normaliser_nom(libelle)
    if n in index:
        return index[n]
    # « REPUBLIQUE POPULAIRE DE CHINE » → « CHINE »
    tokens = n.split()
    while len(tokens) > 1 and tokens[0] in FORMES_ETAT | LIAISONS:
        tokens.pop(0)
    reduit = " ".join(tokens)
    if reduit != n and reduit in index:
        return index[reduit]
    # « ETATS UNIS D AMERIQUE » : un nom du référentiel suivi d'une liaison
    candidats = [r for r in index
                 if n.startswith(r + " ") and n[len(r) + 1:].split()[0] in LIAISONS]
    if candidats:
        return index[max(candidats, key=len)]
    # Coquilles (« AFGANISTAN ») : rapprochement flou très serré
    proches = get_close_matches(n, list(index), n=1, cutoff=0.9)
    return index[proches[0]] if proches else None


def suggerer_proches(libelle: str, noms_ref: list[str], n: int = 3) -> list[str]:
    """Noms du référentiel les plus proches d'un libellé non rattaché.

    La forme réduite (sans « RÉPUBLIQUE DE », « ÎLES »…) est comparée
    d'abord car elle est plus discriminante : sur la chaîne entière,
    « REPUBLIQUE TCHEQUE » suggérerait « République centrafricaine » ou
    « République dominicaine », alors que « TCHEQUE » mène à Tchéquie.
    """
    norm = normaliser_nom(libelle)
    tokens = [t for t in norm.split()
              if t not in FORMES_ETAT | LIAISONS and t not in {"ILE", "ILES", "CITE"}]
    reduit = " ".join(tokens)
    formes = ([reduit] if tokens and reduit != norm else []) + [norm]
    vus: list[str] = []
    for forme in formes:
        for p in get_close_matches(forme, noms_ref, n=n, cutoff=0.45):
            if p not in vus:
                vus.append(p)
    return vus[:n]
