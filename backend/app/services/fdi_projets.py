"""Ingestion des projets fDi Markets : résolution des libellés, puis écriture.

La source affiche ses libellés TRONQUÉS côté serveur — « Clothing & clothing
acc… », « Banque de dévelo… ». Ce module fait donc deux choses distinctes, et
il importe de ne pas les confondre :

  * `resoudre_ligne()` **interprète** un libellé tronqué en le rapprochant de la
    nomenclature. L'interprétation réussit ou échoue, mais elle ne devine
    jamais : deux candidats possibles, et la ligne repart sans rattachement,
    avec son texte brut, pour arbitrage humain.

  * `importer_lot()` **écrit**, en remplaçant le lot entier. Aucun rapprochement
    ligne à ligne avec l'existant : sans identifiant de projet chez fDi, deux
    lignes jumelles ne se distinguent que par leur description, saisie plus
    tard. Fusionner à l'import détruirait des projets réels.

Le texte brut est conservé partout, à côté de chaque identifiant : c'est ce qui
rend l'interprétation rejouable, et une erreur détectable.
"""
from __future__ import annotations

import csv
import re
import unicodedata
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover — annotation seule
    from sqlalchemy.ext.asyncio import AsyncSession


class LigneInvalide(ValueError):
    """La ligne ne porte pas le minimum exigé pour être écrite."""


# Les points de suspension que les interfaces emploient pour couper un libellé,
# dans leurs deux graphies — le caractère unique et les trois points.
FIN_TRONQUEE = re.compile(r"\s*(?:…|\.\.\.)\s*$")


def est_tronque(v: str) -> bool:
    return bool(FIN_TRONQUEE.search(v or ""))


def normaliser(v: str) -> str:
    """Minuscules, sans accent, sans ponctuation, espaces réduits.

    C'est la forme sur laquelle on compare : elle absorbe « Coal, oil & gas »
    contre « coal oil and gas », et surtout la ponctuation que la troncature
    coupe au milieu d'un mot.
    """
    txt = unicodedata.normalize("NFKD", v or "").encode("ascii", "ignore").decode()
    txt = txt.lower().replace("&", " and ")
    txt = FIN_TRONQUEE.sub("", txt)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", txt)).strip()


def rapprocher(brut: str, candidats: list[dict], champ: str = "libelle_en") -> tuple[str, list[dict]]:
    """Rapproche un libellé, éventuellement tronqué, d'une liste de candidats.

    Renvoie (verdict, candidats retenus) où verdict vaut :
      exact   le libellé complet correspond ;
      unique  le libellé est tronqué mais un seul candidat commence ainsi ;
      ambigu  plusieurs candidats commencent ainsi — on ne tranche pas ;
      aucun   rien ne correspond, la source a peut-être changé.
    """
    if not brut or not brut.strip():
        return "aucun", []
    cle = normaliser(brut)
    exacts = [c for c in candidats if normaliser(c[champ]) == cle]
    if exacts:
        return "exact", exacts[:1]
    prefixes = [c for c in candidats if normaliser(c[champ]).startswith(cle)]
    # Une entité peut porter plusieurs libellés (cf. fdi_variantes.csv) : deux
    # graphies du MÊME poste ne sont pas une ambiguïté, seulement deux chemins
    # vers lui. L'ambiguïté, c'est deux postes différents.
    ids = {c.get("id") for c in prefixes}
    if len(prefixes) == 1 or (len(ids) == 1 and None not in ids):
        return "unique", prefixes[:1]
    return ("ambigu", prefixes) if prefixes else ("aucun", [])


# ── Montants ─────────────────────────────────────────────────────────────────
VIDES = {"", "-", "—", "n/a", "na"}


def _est_vide(brut) -> bool:
    """Une case que fDi n'a pas remplie, astérisque d'estimation comprise.

    La source écrit « - », mais aussi « * - » : son algorithme a bien tourné,
    il n'a rien produit. Les deux disent la même chose — pas de valeur — et
    l'astérisque seule ne porte aucune information : un « estimé » sans nombre
    ne se compte, ne se somme et ne s'affiche pas.
    """
    if brut is None:
        return True
    txt = str(brut).strip()
    if txt.startswith("*"):
        txt = txt[1:].strip()
    return txt.lower() in VIDES


MONTANT = re.compile(r"^\s*(\*)?\s*\$?\s*([\d\s.,]+)\s*(m|bn|k)?\s*$", re.I)
ECHELLE = {"k": 0.001, "m": 1.0, "bn": 1000.0, None: 1.0, "": 1.0}


def lire_montant(brut: str | None) -> tuple[float | None, bool | None]:
    """« * $9.60m » → (9.60, True). Le montant en MILLIONS, et l'estimation.

    L'astérisque marque les valeurs calculées par l'algorithme du Financial
    Times. Le drapeau reste nul quand la valeur l'est : « estimé » ne veut rien
    dire sans montant — et fDi écrit bel et bien « * - », un tiret marqué comme
    estimé. On le lit comme un vide, pas comme une erreur : refuser la ligne
    ferait perdre un projet réel pour une case que la source n'a pas remplie.
    """
    if _est_vide(brut):
        return None, None
    m = MONTANT.match(str(brut))
    if not m:
        raise LigneInvalide(f"montant illisible : « {brut} »")
    estime = m.group(1) is not None
    nombre = m.group(2).replace(" ", "").replace(",", "")
    return round(float(nombre) * ECHELLE.get((m.group(3) or "").lower(), 1.0), 2), estime


def lire_entier(brut: str | None) -> tuple[int | None, bool | None]:
    """« * 415 » → (415, True). Même règle d'astérisque que les montants,
    « * - » compris : un effectif estimé mais non chiffré reste un vide."""
    if _est_vide(brut):
        return None, None
    txt = str(brut).strip()
    estime = txt.startswith("*")
    chiffres = re.sub(r"[^\d]", "", txt)
    if not chiffres:
        raise LigneInvalide(f"effectif illisible : « {brut} »")
    return int(chiffres), estime


MOIS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def lire_date(brut: str) -> tuple[int, int | None]:
    """« Jun 2026 » → (2026, 6). La source ne donne que le mois, jamais le jour."""
    txt = (brut or "").strip()
    an = re.search(r"(19|20)\d{2}", txt)
    if not an:
        raise LigneInvalide(f"date sans année : « {brut} »")
    mois = None
    for nom, num in MOIS.items():
        if nom in txt.lower():
            mois = num
            break
    return int(an.group(0)), mois


# ── Lecture des CSV versionnés ────────────────────────────────────────────────
DOSSIER_PROJETS = Path(__file__).resolve().parents[2] / "scripts" / "fdi" / "projets"

COLONNES = ["ligne", "date", "parent", "entreprise", "source", "dest",
            "secteur", "sous_secteur", "activite", "capex", "emplois", "type"]


def lire_lot_csv(chemin: Path) -> list[dict]:
    """Un fichier de page, tel que relevé sur la source.

    Les valeurs y sont VERBATIM, troncature comprise : c'est la trace de ce que
    fDi affichait, et ce qui rend la résolution rejouable.
    """
    with chemin.open(encoding="utf-8") as f:
        lignes = list(csv.DictReader(f))
    if not lignes:
        raise LigneInvalide(f"{chemin.name} est vide")
    manquantes = [c for c in COLONNES if c not in lignes[0]]
    if manquantes:
        raise LigneInvalide(f"{chemin.name} : colonnes manquantes {manquantes}")
    for l in lignes:
        l["ligne"] = int(l["ligne"])
    rangs = [l["ligne"] for l in lignes]
    if sorted(rangs) != list(range(1, len(lignes) + 1)):
        raise LigneInvalide(f"{chemin.name} : les rangs ne sont pas 1..{len(lignes)}")
    return sorted(lignes, key=lambda l: l["ligne"])


FICHIER_PAYS = DOSSIER_PROJETS.parent / "fdi_pays.csv"


def lire_pays_csv() -> dict[str, str]:
    """La correspondance « pays anglais de fDi » → code ISO 3166 alpha-3.

    fDi nomme ses pays en anglais (« Turkey »), le référentiel de la plateforme
    les nomme en français (« Turquie ») et ne porte pas de nom anglais. Le
    rapprochement passe donc par une table explicite, jamais par une devinette
    de similarité : « Niger » et « Nigeria » se ressemblent assez pour qu'une
    heuristique se trompe, et un projet attribué au mauvais pays est une erreur
    invisible.

    Le code ISO fait le pont : il ne change pas quand un pays est renommé en
    base. Plusieurs libellés peuvent viser le même code — « Turkey », « Türkiye »
    — car la source varie sa graphie avec le temps.
    """
    if not FICHIER_PAYS.exists():
        raise LigneInvalide(f"{FICHIER_PAYS.name} est introuvable")
    table: dict[str, str] = {}
    with FICHIER_PAYS.open(encoding="utf-8") as f:
        for l in csv.DictReader(f):
            cle = normaliser(l["libelle_en"])
            if cle in table and table[cle] != l["code_iso3"]:
                raise LigneInvalide(
                    f"{FICHIER_PAYS.name} : « {l['libelle_en']} » vise deux pays "
                    f"({table[cle]} et {l['code_iso3']})")
            table[cle] = l["code_iso3"]
    return table


def libelles_pays_en() -> dict[str, str]:
    """Code ISO → le nom ANGLAIS sous lequel proposer le pays à la saisie.

    Le référentiel ref_pays ne porte que le nom français ; l'anglais vit ici,
    dans la correspondance, et c'est très bien ainsi — un nom anglais en base
    serait une seconde autorité sur la graphie de la source, à tenir d'accord
    avec celle-ci sans que rien ne le garantisse. On lit donc le même fichier
    que l'import, ce qui donne au formulaire de saisie une propriété qu'aucune
    colonne ne lui donnerait : tout libellé qu'il propose est, par
    construction, un libellé que l'analyseur sait rapprocher.

    Quand la source écrit un pays de plusieurs façons — « Macao » et « Macau »,
    « Turkey » et « Türkiye » — on retient la PREMIÈRE du fichier. Le fichier
    est rangé par nom français et versionné : le choix est stable, et il se
    change en déplaçant une ligne, sous revue.
    """
    if not FICHIER_PAYS.exists():
        raise LigneInvalide(f"{FICHIER_PAYS.name} est introuvable")
    noms: dict[str, str] = {}
    with FICHIER_PAYS.open(encoding="utf-8") as f:
        for l in csv.DictReader(f):
            noms.setdefault(l["code_iso3"], l["libelle_en"])
    return noms


FICHIER_ALIAS_ENTREPRISES = DOSSIER_PROJETS.parent / "fdi_entreprises_alias.csv"


def lire_alias_entreprises() -> list[tuple[str, str, str]]:
    """Les entreprises que la source nomme de deux façons — (alias, retenu, motif).

    Distinct d'un nom TRONQUÉ, que l'écran d'arbitrage tranche : ici les deux
    graphies sont complètes, et la source elle-même se contredit. « G
    Environment » et « G Environnement » désignent le même bureau d'études,
    même mois, même montant, même sous-secteur — mais rien dans la donnée ne
    le dit, et l'import n'a pas à le deviner. La décision est humaine ; elle se
    versionne ici, avec son motif, plutôt que de vivre dans une base.

    Le relevé, lui, reste VERBATIM : on ne réécrit pas la page pour la rendre
    cohérente. Corriger le CSV ferait perdre la trace de ce que la source a
    réellement publié, et le jour où fDi rectifie, on ne saurait plus que
    c'était nous.
    """
    if not FICHIER_ALIAS_ENTREPRISES.exists():
        return []
    lignes = []
    with FICHIER_ALIAS_ENTREPRISES.open(encoding="utf-8") as f:
        for l in csv.DictReader(f):
            alias, retenu = (l.get("alias") or "").strip(), (l.get("nom_retenu") or "").strip()
            motif = (l.get("motif") or "").strip()
            if not alias or not retenu:
                raise LigneInvalide(
                    f"{FICHIER_ALIAS_ENTREPRISES.name} : « alias » et « nom_retenu » "
                    "sont tous deux obligatoires.")
            if not motif:
                # Une fusion sans raison écrite est une fusion que personne
                # n'osera défaire, et que personne ne saura justifier en réunion.
                raise LigneInvalide(
                    f"{FICHIER_ALIAS_ENTREPRISES.name} : « {alias} » n'a pas de motif.")
            if normaliser(alias) == normaliser(retenu):
                raise LigneInvalide(
                    f"{FICHIER_ALIAS_ENTREPRISES.name} : « {alias} » se vise lui-même.")
            lignes.append((alias, retenu, motif))
    return lignes


async def appliquer_alias_entreprises(db: "AsyncSession", utilisateur: str | None = None) -> int:
    """Fusionne les graphies déclarées. À lancer AVANT d'importer les lots.

    Deux temps, parce que la base peut être dans deux états. Sur une base
    neuve, il suffit de poser l'alias : `_entreprise` le consultera avant de
    créer quoi que ce soit. Sur une base où l'import est déjà passé, une
    entreprise jumelle existe déjà et porte des projets — il faut les
    rapatrier, puis la supprimer. Sans ce second temps, la correction ne
    prendrait effet qu'après une remise à zéro.

    Rejouable : au second passage il n'y a plus de jumelle, et l'alias est déjà
    là.
    """
    from sqlalchemy import text
    fusions = 0
    for alias, retenu, _motif in lire_alias_entreprises():
        cle_alias, cle_retenu = normaliser(alias), normaliser(retenu)

        # L'entreprise retenue, créée si elle n'existe pas encore.
        r = (await db.execute(text(
            "SELECT id FROM fdi_entreprises WHERE nom_normalise = :c"), {"c": cle_retenu})).first()
        if not r:
            r = (await db.execute(text(
                "INSERT INTO fdi_entreprises (nom, nom_normalise, statut_nom, modifie_par) "
                "VALUES (:n, :c, 'complet', :u) RETURNING id"),
                {"n": retenu, "c": cle_retenu, "u": utilisateur})).first()
        garde = r.id

        # La jumelle née de la graphie fautive, s'il y en a une.
        jumelle = (await db.execute(text(
            "SELECT id FROM fdi_entreprises WHERE nom_normalise = :c"), {"c": cle_alias})).first()
        if jumelle and jumelle.id != garde:
            for colonne in ("entreprise_id", "parent_id"):
                await db.execute(text(
                    f"UPDATE fdi_projets SET {colonne} = :garde WHERE {colonne} = :j"),
                    {"garde": garde, "j": jumelle.id})
            # Les alias déjà tranchés vers la jumelle suivent — sauf ceux qui
            # existent déjà côté retenu, que la contrainte d'unicité refuserait.
            await db.execute(text(
                "UPDATE fdi_entreprise_alias a SET entreprise_id = :garde "
                " WHERE a.entreprise_id = :j AND NOT EXISTS ("
                "   SELECT 1 FROM fdi_entreprise_alias b"
                "    WHERE b.alias_normalise = a.alias_normalise AND b.entreprise_id = :garde)"),
                {"garde": garde, "j": jumelle.id})
            await db.execute(text("DELETE FROM fdi_entreprises WHERE id = :j"), {"j": jumelle.id})
            fusions += 1

        # L'alias lui-même : c'est lui que `_entreprise` consultera au prochain
        # import, avant même de chercher un nom identique.
        await db.execute(text(
            "INSERT INTO fdi_entreprise_alias (alias_brut, alias_normalise, tronque, "
            "                                  entreprise_id, decide_par) "
            "VALUES (:b, :c, false, :e, :u) ON CONFLICT (alias_normalise, entreprise_id) "
            "DO NOTHING"),
            {"b": alias, "c": cle_alias, "e": garde, "u": utilisateur})
    return fusions


FICHIER_VARIANTES = DOSSIER_PROJETS.parent / "fdi_variantes.csv"

FAMILLES_VARIANTES = {"secteur": "secteurs", "sous_secteur": "sous",
                      "activite": "activites", "type": "types"}


def lire_variantes() -> dict[str, list[tuple[str, str]]]:
    """Les libellés que la table des projets écrit autrement que la nomenclature.

    fDi n'est pas cohérent avec lui-même : le classeur de classification écrit
    « Computing infrastucture », la table des projets « Computing
    infrastructure ». Le libellé de la nomenclature reste VERBATIM — c'est la
    source — et la variante s'ajoute à côté comme second chemin vers le même
    poste. Corriger le libellé casserait l'appariement dans l'autre sens.

    Chaque ligne porte son motif : une correspondance sans raison écrite est
    une correspondance qu'on n'ose plus toucher.
    """
    if not FICHIER_VARIANTES.exists():
        return {}
    par_famille: dict[str, list[tuple[str, str]]] = {}
    with FICHIER_VARIANTES.open(encoding="utf-8") as f:
        for l in csv.DictReader(f):
            famille = FAMILLES_VARIANTES.get(l["famille"])
            if famille is None:
                raise LigneInvalide(
                    f"{FICHIER_VARIANTES.name} : famille inconnue « {l['famille']} »")
            par_famille.setdefault(famille, []).append((l["code"], l["libelle_alias"]))
    return par_famille


# ── Les arbitrages de troncature, ligne par ligne ────────────────────────────
FICHIER_ARBITRAGES = DOSSIER_PROJETS.parent / "fdi_arbitrages.csv"


def lire_arbitrages() -> dict[tuple[str, int, str], dict]:
    """Les tranchages humains d'une troncature AMBIGUË, page et rang à l'appui.

    Quand la source coupe « Pipeline transportati… », deux postes commencent
    ainsi — pétrole brut par oléoduc, gaz naturel par gazoduc — et l'import
    refuse de choisir : deviner rangerait un gazoduc sous le pétrole, et la
    ligne serait alors RATTACHÉE, donc silencieuse. Aucun contrôle ultérieur ne
    la rattraperait.

    Pourquoi pas fdi_variantes.csv ? Parce qu'une variante est GLOBALE : elle
    dit qu'une graphie désigne toujours le même poste. Ici la même troncature
    recouvre plusieurs postes selon la ligne — Sasol au Mozambique transporte du
    gaz, la CNPC au Niger du pétrole. La décision est donc attachée à un rang
    précis d'une page précise, et à rien d'autre.

    Pourquoi pas l'écran de correction ? Parce qu'il écrit dans la base, et que
    la base se reconstruit. Une décision qui ne survit pas à une remise à zéro
    est une décision qu'il faudra reprendre, sans savoir qu'on l'avait déjà
    prise. Ici elle est versionnée, relue en revue, et rejouée à chaque import.

    LE LIBELLÉ BRUT EST RECOPIÉ DANS LE FICHIER, et vérifié à l'import. Si la
    source republie la page avec d'autres lignes, le rang pointe sur autre
    chose : mieux vaut arrêter l'import que d'appliquer à une ligne inconnue une
    décision prise pour une autre. C'est la règle déjà retenue pour les
    descriptions et pour les colonnes verrouillées, et elle vaut ici de même.
    """
    if not FICHIER_ARBITRAGES.exists():
        return {}
    par_cle: dict[tuple[str, int, str], dict] = {}
    with FICHIER_ARBITRAGES.open(encoding="utf-8") as f:
        for l in csv.DictReader(f):
            colonne = (l["colonne"] or "").strip()
            if colonne not in FAMILLES_VARIANTES:
                raise LigneInvalide(
                    f"{FICHIER_ARBITRAGES.name} : colonne inconnue « {colonne} » — "
                    f"attendu {', '.join(sorted(FAMILLES_VARIANTES))}")
            if not (l.get("motif") or "").strip():
                raise LigneInvalide(
                    f"{FICHIER_ARBITRAGES.name} : {l['fichier']} ligne {l['ligne']} — "
                    "un arbitrage sans motif écrit est un arbitrage qu'on n'ose plus toucher")
            cle = (l["fichier"].strip(), int(l["ligne"]), colonne)
            if cle in par_cle:
                raise LigneInvalide(
                    f"{FICHIER_ARBITRAGES.name} : {cle[0]} ligne {cle[1]} « {colonne} » "
                    "arbitré deux fois")
            par_cle[cle] = {"brut": l["brut"].strip(), "code": l["code"].strip(),
                            "motif": l["motif"].strip()}
    return par_cle


# ── Réécrire une valeur dans la notation de la source ─────────────────────────
# L'écran de correction ne saisit pas des colonnes de base mais des CASES DE
# RELEVÉ : « Mar 2014 », « * $9.60m », « * 1 012 ». C'est ce que l'utilisateur a
# sous les yeux chez fDi, et c'est ce que les lecteurs ci-dessus savent relire.
#
# Ces trois fonctions vivent ici, contre l'analyseur qu'elles inversent, et non
# dans la route qui les appelle : écrire et relire la même notation à deux
# endroits différents, c'est se donner deux chances de diverger. Un test vérifie
# l'aller-retour.
_MOIS_EN = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def date_brute(annee: int | None, mois: int | None) -> str:
    if annee is None:
        return ""
    return f"{_MOIS_EN[mois - 1]} {annee}" if mois else str(annee)


def montant_brut(v, estime) -> str:
    """« * $9.60m ». Toujours en millions : l'échelle est absorbée à la lecture,
    la rendre en milliards obligerait l'écran à savoir laquelle choisir."""
    if v is None:
        return ""
    return f"{'* ' if estime else ''}${float(v):,.2f}m".replace(",", " ")


def entier_brut(v, estime) -> str:
    if v is None:
        return ""
    return f"{'* ' if estime else ''}{v:,}".replace(",", " ")


def empreinte(annee: int | None, mois: int | None, entreprise: str | None,
              secteur: str | None, sous_secteur: str | None,
              capex: float | None, emplois: int | None, type_projet: str | None) -> tuple:
    """Ce qui identifie une ligne dans son lot, description exclue.

    Sert au réimport : empreinte inchangée, la ligne décrit le même projet et
    l'on garde ce qu'un humain y a saisi. Empreinte différente, le rang pointe
    sur autre chose — mieux vaut perdre une description que la coller sur un
    projet qui n'est plus le sien.

    Les nombres sont comparés en NOMBRES, jamais en texte : la base rend un
    Decimal(« 9.60 ») là où la source donne 9.6, et une comparaison de chaînes
    déclarerait deux fois le même projet différent. C'est arrivé — la
    description d'une ligne a été effacée à un réimport avant que ce test ne
    l'attrape.
    """
    return (
        annee, mois,
        normaliser(entreprise or ""), normaliser(secteur or ""), normaliser(sous_secteur or ""),
        None if capex is None else round(float(capex), 2),
        None if emplois is None else int(emplois),
        normaliser(type_projet or ""),
    )


# ── Écriture ─────────────────────────────────────────────────────────────────
async def _referentiels(db: "AsyncSession") -> dict:
    """Les nomenclatures en mémoire : 332 lignes, une requête par famille."""
    from sqlalchemy import text
    async def q(sql):
        return [dict(r._mapping) for r in (await db.execute(text(sql))).fetchall()]
    ref = {
        "secteurs":  await q("SELECT id, code, libelle_en FROM fdi_secteurs"),
        "sous":      await q("SELECT id, code, secteur_id, libelle_en FROM fdi_sous_secteurs"),
        "activites": await q("SELECT id, code, libelle_en FROM fdi_activites"),
        "types":     await q("SELECT id, code, libelle_en FROM fdi_types_projet"),
        # Le référentiel pays de la plateforme, indexé par code ISO : c'est lui
        # que la correspondance anglaise vient rejoindre.
        "pays":      {r["code_iso3"]: r["id"] for r in
                      await q("SELECT id, code_iso3 FROM ref_pays WHERE code_iso3 IS NOT NULL")},
    }

    # Les variantes de graphie deviennent des candidats de plus, portant le même
    # identifiant que le poste qu'elles désignent : l'appariement les trouve, et
    # le projet se rattache au bon poste sans qu'aucun libellé soit réécrit.
    for famille, alias in lire_variantes().items():
        par_code = {r["code"]: r for r in ref[famille]}
        for code, libelle in alias:
            poste = par_code.get(code)
            if poste is None:
                raise LigneInvalide(
                    f"{FICHIER_VARIANTES.name} : code « {code} » absent de la nomenclature")
            ref[famille].append({**poste, "libelle_en": libelle})
    return ref


def _pays(brut: str | None, correspondance: dict[str, str], ref: dict[str, int]):
    """(identifiant ref_pays, motif d'échec) — l'un ou l'autre, jamais les deux.

    Deux échecs distincts, et il importe de les distinguer : un pays que la
    correspondance ignore (graphie nouvelle chez fDi) se corrige dans le CSV ;
    un pays connu mais absent de ref_pays se corrige par une migration du
    référentiel. Dans les deux cas la ligne entre en base avec son texte brut.
    """
    if not brut or not brut.strip():
        return None, None
    cle = normaliser(brut)
    code = correspondance.get(cle)
    if code is None:
        # La colonne Source est tronquée comme les autres — « Republic of the
        # C… ». On applique donc au pays la règle des nomenclatures : un seul
        # pays commence ainsi, on tranche ; plusieurs, on refuse. Plusieurs
        # graphies visant le MÊME pays (« Turkey », « Türkiye ») ne comptent
        # que pour un.
        codes = {c for libelle, c in correspondance.items() if libelle.startswith(cle)}
        if len(codes) != 1:
            return None, "hors correspondance" if not codes else "préfixe ambigu"
        code = codes.pop()
    pays_id = ref.get(code)
    if pays_id is None:
        return None, f"{code} absent de ref_pays"
    return pays_id, None


async def _entreprise(db: "AsyncSession", brut: str | None, utilisateur: str | None):
    """L'entreprise derrière un nom, éventuellement tronqué.

    Un nom COMPLET est une identité : on rattache et l'on considère la question
    réglée. Un nom TRONQUÉ ne l'est pas — « Banque de dévelo… » peut désigner
    plusieurs banques — alors on rattache quand même, pour ne pas perdre le
    projet, mais au statut « proposé » : l'écran d'arbitrage le soumettra, et
    rien n'est compté comme sûr entre-temps.
    """
    from sqlalchemy import text
    if not brut or not brut.strip():
        return None, "en_attente"
    brut = " ".join(brut.split())
    cle = normaliser(brut)
    tronque = est_tronque(brut)

    # La mémoire des arbitrages d'abord : si ce texte a déjà été tranché, on
    # repropose la même entreprise plutôt que d'en créer une jumelle.
    r = (await db.execute(text(
        "SELECT entreprise_id FROM fdi_entreprise_alias WHERE alias_normalise = :c "
        "ORDER BY occurrences DESC LIMIT 1"), {"c": cle})).first()
    if r:
        return r.entreprise_id, ("propose" if tronque else "resolu")

    r = (await db.execute(text(
        "SELECT id FROM fdi_entreprises WHERE nom_normalise = :c"), {"c": cle})).first()
    if not r:
        r = (await db.execute(text(
            "INSERT INTO fdi_entreprises (nom, nom_normalise, statut_nom, modifie_par) "
            "VALUES (:n, :c, :s, :u) RETURNING id"),
            {"n": brut, "c": cle, "s": "tronque" if tronque else "complet", "u": utilisateur})).first()
    await db.execute(text(
        "INSERT INTO fdi_entreprise_alias (alias_brut, alias_normalise, tronque, entreprise_id, decide_par) "
        "VALUES (:b, :c, :t, :e, :u) ON CONFLICT (alias_normalise, entreprise_id) DO NOTHING"),
        {"b": brut, "c": cle, "t": tronque, "e": r.id, "u": utilisateur})
    return r.id, ("propose" if tronque else "resolu")


# Les colonnes factuelles d'un projet : celles que la source fournit, et donc
# celles qu'un réimport réécrit. Une saisie humaine ne survit à un réimport que
# si la colonne est nommée dans champs_verrouilles ; cette liste borne ce qui
# peut y figurer, pour qu'un nom de colonne inventé ne verrouille rien de plus.
CHAMPS_MODIFIABLES = (
    "annee", "mois", "parent_brut", "entreprise_brut", "pays_source_brut",
    "pays_dest_brut", "secteur_brut", "sous_secteur_brut", "activite_brut",
    "type_brut", "capex_musd", "capex_estime", "emplois", "emplois_estime",
)


def _garde_si(colonne: str, verrou: str | None = None) -> str:
    """Le fragment SQL qui fait qu'un réimport n'écrase pas une correction.

    « verrou » nomme la colonne qui porte la décision quand ce n'est pas celle
    qu'on écrit : le drapeau d'estimation suit son montant, l'identifiant de
    pays suit son libellé. Sans cela, corriger « Sengal » en « Senegal »
    garderait le libellé mais laisserait le CSV réimposer l'ancien rattachement,
    et la ligne pointerait sur un pays qu'elle ne nomme plus.

    Le nom de colonne est interpolé dans la requête : il ne vient jamais d'une
    saisie, seulement des constantes de ce module, et la vérification ci-dessous
    le garantit plutôt que de le supposer.
    """
    porteur = verrou or colonne
    if porteur not in CHAMPS_MODIFIABLES:
        raise ValueError(f"colonne non modifiable : {porteur}")
    return (f"CASE WHEN :garde AND '{porteur}' = ANY(fdi_projets.champs_verrouilles) "
            f"THEN fdi_projets.{colonne} ELSE EXCLUDED.{colonne} END")


async def resoudre_ligne(db: "AsyncSession", l: dict, ref: dict, pays_en: dict,
                         utilisateur: str | None = None,
                         arbitrages: dict | None = None,
                         fichier: str = "", utilises: set | None = None
                         ) -> tuple[dict, list[tuple]]:
    """Une ligne de relevé — brute, telle qu'elle est lue ou saisie — devient les
    colonnes d'un projet : montants convertis, pays et nomenclatures rapprochés,
    entreprises créées ou retrouvées.

    Extraite de la boucle d'import pour que la SAISIE MANUELLE emprunte le même
    chemin. Deux implémentations auraient fini par diverger — « * $9.60m » lu
    autrement, un préfixe tronqué rapproché autrement — et la table aurait alors
    contenu deux interprétations de la même règle sans que rien ne le signale.

    Rend les colonnes, et la liste de ce qui n'a pas pu être résolu. Ne décide
    pas quoi en faire : l'import l'accumule dans son rapport, la saisie le rend
    à qui la fait.
    """
    par_secteur: dict[int, list] = {}
    for s in ref["sous"]:
        par_secteur.setdefault(s["secteur_id"], []).append(s)

    rang = l.get("ligne")
    manques: list[tuple] = []

    def arbitrer(colonne: str, brut, secteur_attendu: int | None = None) -> int | None:
        """Le tranchage humain de cette case, s'il y en a un. Sinon None.

        Consulté SEULEMENT quand le rapprochement automatique a échoué : si la
        source cesse un jour de tronquer, le poste se retrouve tout seul et
        l'arbitrage devient inutile plutôt que faux.
        """
        a = (arbitrages or {}).get((rang, colonne))
        if a is None:
            return None
        ou = f"{fichier or '?'} ligne {rang}"
        if (brut or "").strip() != a["brut"]:
            raise LigneInvalide(
                f"{FICHIER_ARBITRAGES.name} : {ou} porte « {brut} » alors que "
                f"l'arbitrage a été rendu pour « {a['brut']} ». La ligne a changé : "
                "reprendre la décision plutôt que l'appliquer à un autre projet.")
        poste = next((p for p in ref[FAMILLES_VARIANTES[colonne]] if p["code"] == a["code"]), None)
        if poste is None:
            raise LigneInvalide(
                f"{FICHIER_ARBITRAGES.name} : {ou} vise le code « {a['code']} », "
                "absent de la nomenclature")
        if secteur_attendu is not None and poste.get("secteur_id") != secteur_attendu:
            raise LigneInvalide(
                f"{FICHIER_ARBITRAGES.name} : {ou} range « {a['code']} » sous un secteur "
                "qui n'est pas celui de la ligne")
        if utilises is not None:
            utilises.add((fichier, rang, colonne))
        return poste["id"]

    annee, mois = lire_date(l["date"])
    capex, capex_est = lire_montant(l.get("capex"))
    emplois, emplois_est = lire_entier(l.get("emplois"))

    vs, cs = rapprocher(l.get("secteur", ""), ref["secteurs"])
    secteur_id = cs[0]["id"] if vs in ("exact", "unique") else None
    if secteur_id is None:
        secteur_id = arbitrer("secteur", l.get("secteur"))
    if secteur_id is None:
        manques.append((rang, "secteur", l.get("secteur"), vs))

    sous_id = None
    if secteur_id:
        vss, css = rapprocher(l.get("sous_secteur", ""), par_secteur.get(secteur_id, []))
        sous_id = css[0]["id"] if vss in ("exact", "unique") else None
        if sous_id is None:
            sous_id = arbitrer("sous_secteur", l.get("sous_secteur"), secteur_id)
        if sous_id is None:
            manques.append((rang, "sous-secteur", l.get("sous_secteur"), vss))

    va, ca = rapprocher(l.get("activite", ""), ref["activites"])
    activite_id = ca[0]["id"] if va in ("exact", "unique") else None
    if activite_id is None:
        activite_id = arbitrer("activite", l.get("activite"))
    if activite_id is None:
        manques.append((rang, "activité", l.get("activite"), va))

    vt, ct = rapprocher(l.get("type", ""), ref["types"])
    type_id = ct[0]["id"] if vt in ("exact", "unique") else None
    if type_id is None and (l.get("type") or "").strip():
        type_id = arbitrer("type", l.get("type"))
    if type_id is None and (l.get("type") or "").strip():
        manques.append((rang, "type", l.get("type"), vt))

    src_id, src_motif = _pays(l.get("source"), pays_en, ref["pays"])
    if src_motif:
        manques.append((rang, "pays d'origine", l.get("source"), src_motif))
    dst_id, dst_motif = _pays(l.get("dest"), pays_en, ref["pays"])
    if dst_motif:
        manques.append((rang, "pays de destination", l.get("dest"), dst_motif))

    parent_id, _ = await _entreprise(db, l.get("parent"), utilisateur)
    ent_id, statut = await _entreprise(db, l.get("entreprise"), utilisateur)

    return ({
        "annee": annee, "mois": mois,
        "parent_brut": l.get("parent"), "parent_id": parent_id,
        "entreprise_brut": l.get("entreprise"), "entreprise_id": ent_id,
        "statut_entreprise": statut,
        "pays_source_brut": l.get("source"), "pays_source_id": src_id,
        "pays_dest_brut": l.get("dest"), "pays_dest_id": dst_id,
        "secteur_brut": l.get("secteur"), "secteur_id": secteur_id,
        "sous_secteur_brut": l.get("sous_secteur"), "sous_secteur_id": sous_id,
        "activite_brut": l.get("activite"), "activite_id": activite_id,
        "type_brut": l.get("type"), "type_projet_id": type_id,
        "capex_musd": capex, "capex_estime": capex_est,
        "emplois": emplois, "emplois_estime": emplois_est,
    }, manques)


async def importer_lot(db: "AsyncSession", libelle: str, perimetre: str,
                       lignes: list[dict], utilisateur: str | None = None,
                       sens: str = "destination", fichier: str = "",
                       utilises: set | None = None) -> dict:
    """Écrit un lot de projets. Rejouable, et respectueux des saisies humaines.

    Le lot est remplacé, jamais fusionné ligne à ligne avec l'existant : sans
    identifiant de projet chez fDi, rien ne permettrait de rapprocher deux
    lignes jumelles sans risquer d'en perdre une.

    Le SENS accompagne le lot : un relevé « Dest = Senegal » ne rend exhaustif
    que le Sénégal comme destination, jamais les pays d'origine qui y figurent.
    Sans cette mention, une page finirait par présenter « 56 projets français »
    alors que la base n'en connaît que 56 vers le Sénégal.

    Mais « remplacer » ne veut pas dire « effacer ce qu'un humain a saisi ». À
    rang égal ET signature inchangée, la ligne décrit le même projet : ses
    descriptions et ses arbitrages d'entreprise sont conservés. Si la signature
    a bougé, le rang pointe sur autre chose et l'on repart de zéro — coller une
    description sur un projet qui n'est plus le sien serait pire que de la
    perdre.
    """
    from sqlalchemy import text

    ref = await _referentiels(db)
    pays_en = lire_pays_csv()
    # Les tranchages humains qui concernent CE fichier, indexés par (rang,
    # colonne) : resoudre_ligne n'a pas à connaître le reste du relevé.
    arbitrages = {(r, c): a for (f, r, c), a in lire_arbitrages().items() if f == fichier}
    par_secteur: dict[int, list] = {}
    for s in ref["sous"]:
        par_secteur.setdefault(s["secteur_id"], []).append(s)

    lot = (await db.execute(text("SELECT id FROM fdi_lots_import WHERE libelle = :l"),
                            {"l": libelle})).first()
    if lot:
        lot_id = lot.id
        await db.execute(text(
            "UPDATE fdi_lots_import SET perimetre = :p, sens = :s, importe_le = now(), "
            "importe_par = :u, nb_lignes = :n WHERE id = :i"),
            {"p": perimetre, "s": sens, "u": utilisateur, "n": len(lignes), "i": lot_id})
    else:
        lot_id = (await db.execute(text(
            "INSERT INTO fdi_lots_import (libelle, perimetre, sens, source, importe_par, nb_lignes) "
            "VALUES (:l, :p, :s, 'saisie', :u, :n) RETURNING id"),
            {"l": libelle, "p": perimetre, "s": sens, "u": utilisateur, "n": len(lignes)})).first().id

    # Ce que le lot contenait déjà, pour savoir quoi préserver.
    avant = {r.ligne: dict(r._mapping) for r in (await db.execute(text(
        "SELECT ligne, description_en, description_fr, entreprise_id, parent_id, "
        "       statut_entreprise, secteur_brut, sous_secteur_brut, entreprise_brut, "
        "       annee, mois, capex_musd, emplois, type_brut, champs_verrouilles "
        "FROM fdi_projets WHERE lot_id = :i"), {"i": lot_id})).fetchall()}

    rapport = {"lignes": len(lignes), "non_resolus": [], "preserves": 0, "entreprises_a_arbitrer": 0}

    for l in lignes:
        col, manques = await resoudre_ligne(db, l, ref, pays_en, utilisateur,
                                            arbitrages, fichier, utilises)
        rapport["non_resolus"].extend(manques)
        annee, mois = col["annee"], col["mois"]
        capex, capex_est = col["capex_musd"], col["capex_estime"]
        emplois, emplois_est = col["emplois"], col["emplois_estime"]
        secteur_id, sous_id = col["secteur_id"], col["sous_secteur_id"]
        activite_id, type_id = col["activite_id"], col["type_projet_id"]
        src_id, dst_id = col["pays_source_id"], col["pays_dest_id"]
        parent_id, ent_id, statut = col["parent_id"], col["entreprise_id"], col["statut_entreprise"]
        if statut != "resolu":
            rapport["entreprises_a_arbitrer"] += 1

        # Préservation : même rang, même signature → c'est le même projet.
        #
        # La signature se calcule sur ce que la BASE porte, corrections humaines
        # comprises. Une ligne corrigée en administration a donc une signature
        # qui ne colle plus au CSV : sans précaution elle serait déclarée
        # « autre projet » et ses descriptions effacées. On compare donc la
        # signature du CSV à celle que l'ancienne ligne AURAIT eue sans ses
        # verrous — c'est-à-dire à ce que le précédent import avait écrit.
        ancien = avant.get(l["ligne"])
        verrous = set(ancien["champs_verrouilles"] or []) if ancien else set()
        def _tel_quel(nom, depuis_csv):
            """La valeur à comparer : celle du CSV si l'humain n'y a pas touché,
            sinon celle qu'il a posée — puisque c'est elle qu'on va garder."""
            return ancien[nom] if nom in verrous else depuis_csv
        garde = ancien is not None and empreinte(
            ancien["annee"], ancien["mois"], ancien["entreprise_brut"], ancien["secteur_brut"],
            ancien["sous_secteur_brut"], ancien["capex_musd"], ancien["emplois"], ancien["type_brut"],
        ) == empreinte(
            _tel_quel("annee", annee), _tel_quel("mois", mois),
            _tel_quel("entreprise_brut", l.get("entreprise")),
            _tel_quel("secteur_brut", l.get("secteur")),
            _tel_quel("sous_secteur_brut", l.get("sous_secteur")),
            _tel_quel("capex_musd", capex), _tel_quel("emplois", emplois),
            _tel_quel("type_brut", l.get("type")),
        )
        if garde:
            rapport["preserves"] += 1

        await db.execute(text("""
            INSERT INTO fdi_projets (lot_id, ligne, annee, mois, parent_brut, parent_id,
                entreprise_brut, entreprise_id, statut_entreprise, pays_source_brut,
                pays_source_id, pays_dest_brut, pays_dest_id,
                secteur_brut, secteur_id, sous_secteur_brut, sous_secteur_id,
                activite_brut, activite_id, type_brut, type_projet_id, capex_musd, capex_estime,
                emplois, emplois_estime, modifie_par)
            VALUES (:lot, :ligne, :annee, :mois, :pb, :pi, :eb, :ei, :se, :src, :srci, :dst, :dsti,
                :secb, :seci, :ssb, :ssi, :ab, :ai, :tb, :ti, :cap, :cape, :emp, :empe, :u)
            ON CONFLICT (lot_id, ligne) DO UPDATE SET
                -- Chaque colonne factuelle vient du CSV, SAUF si un humain l'a
                -- corrigée en administration : elle figure alors dans
                -- champs_verrouilles et la valeur en base l'emporte. Le verrou
                -- ne tient que si la ligne décrit toujours le même projet
                -- (:garde) ; sinon le rang pointe ailleurs et tout repart du CSV.
                annee            = """ + _garde_si("annee") + """,
                mois             = """ + _garde_si("mois", "annee") + """,
                parent_brut      = """ + _garde_si("parent_brut") + """,
                entreprise_brut  = """ + _garde_si("entreprise_brut") + """,
                pays_source_brut = """ + _garde_si("pays_source_brut") + """,
                pays_source_id   = """ + _garde_si("pays_source_id", "pays_source_brut") + """,
                pays_dest_brut   = """ + _garde_si("pays_dest_brut") + """,
                pays_dest_id     = """ + _garde_si("pays_dest_id", "pays_dest_brut") + """,
                secteur_brut     = """ + _garde_si("secteur_brut") + """,
                secteur_id       = """ + _garde_si("secteur_id", "secteur_brut") + """,
                sous_secteur_brut= """ + _garde_si("sous_secteur_brut") + """,
                sous_secteur_id  = """ + _garde_si("sous_secteur_id", "sous_secteur_brut") + """,
                activite_brut    = """ + _garde_si("activite_brut") + """,
                activite_id      = """ + _garde_si("activite_id", "activite_brut") + """,
                type_brut        = """ + _garde_si("type_brut") + """,
                type_projet_id   = """ + _garde_si("type_projet_id", "type_brut") + """,
                capex_musd       = """ + _garde_si("capex_musd") + """,
                capex_estime     = """ + _garde_si("capex_estime", "capex_musd") + """,
                emplois          = """ + _garde_si("emplois") + """,
                emplois_estime   = """ + _garde_si("emplois_estime", "emplois") + """,
                -- Saisies humaines : conservées si la ligne décrit le même projet.
                description_en = CASE WHEN :garde THEN fdi_projets.description_en ELSE NULL END,
                description_fr = CASE WHEN :garde THEN fdi_projets.description_fr ELSE NULL END,
                entreprise_id = CASE WHEN :garde AND fdi_projets.statut_entreprise = 'resolu'
                                     THEN fdi_projets.entreprise_id ELSE EXCLUDED.entreprise_id END,
                parent_id = CASE WHEN :garde AND fdi_projets.statut_entreprise = 'resolu'
                                 THEN fdi_projets.parent_id ELSE EXCLUDED.parent_id END,
                statut_entreprise = CASE WHEN :garde AND fdi_projets.statut_entreprise = 'resolu'
                                         THEN 'resolu' ELSE EXCLUDED.statut_entreprise END,
                modifie_le = now(), modifie_par = EXCLUDED.modifie_par
        """), {"lot": lot_id, "ligne": l["ligne"], "annee": annee, "mois": mois,
               "pb": l.get("parent"), "pi": parent_id, "eb": l.get("entreprise"), "ei": ent_id,
               "se": statut, "src": l.get("source"), "srci": src_id,
               "dst": l.get("dest"), "dsti": dst_id,
               "secb": l.get("secteur"), "seci": secteur_id,
               "ssb": l.get("sous_secteur"), "ssi": sous_id,
               "ab": l.get("activite"), "ai": activite_id,
               "tb": l.get("type"), "ti": type_id, "cap": capex, "cape": capex_est,
               "emp": emplois, "empe": emplois_est, "u": utilisateur, "garde": garde})

    # Une page qui rétrécit : les rangs disparus n'ont plus de projet en face.
    # Les projets SAISIS À LA MAIN sont épargnés — ils n'ont pas de rang chez
    # fDi, donc rien dans le CSV ne peut jamais venir « en face » d'eux, et les
    # supprimer au premier réimport serait la manière la plus sûre de rendre la
    # saisie inutilisable.
    supprimes = (await db.execute(text(
        "DELETE FROM fdi_projets WHERE lot_id = :i AND ligne > :n "
        "AND origine = 'import' RETURNING id"),
        {"i": lot_id, "n": len(lignes)})).fetchall()
    rapport["supprimes"] = len(supprimes)
    rapport["lot_id"] = lot_id
    return rapport


# ── Lecture publique : le sens, et les filtres à choix multiple ───────────────
# Ces deux fonctions décrivent la page publique mais vivent ici, avec le reste
# de la logique pure : la route les importe, les tests aussi, sans base ni
# configuration.

# Le pays observé et le pays d'en face, selon le sens de lecture. Un projet a
# deux pays ; choisir « destination », c'est demander ce qu'un pays reçoit,
# « source » ce qu'il implante ailleurs.
COTE = {"destination": ("pays_dest", "pays_source"), "source": ("pays_source", "pays_dest")}


def sens_de_lecture(v: str) -> tuple[str, str]:
    """(colonne du pays observé, colonne du pays partenaire).

    Un sens inconnu — URL bricolée — retombe sur la destination plutôt que de
    casser la page : c'est la lecture qui intéresse l'APIX.
    """
    return COTE.get(v, COTE["destination"])


def filtres_multiples(v: str | None) -> list[str]:
    """Les valeurs d'un filtre à choix multiple, séparées par « | ».

    Ni virgule ni point-virgule : ils apparaissent dans les libellés eux-mêmes
    (« Pesticide, fertilisers & other agricultural chemicals »), et couperaient
    un secteur en deux filtres qui ne trouveraient rien.
    """
    return [x.strip() for x in (v or "").split("|") if x.strip()]
