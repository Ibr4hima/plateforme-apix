"""Lecture du relevé des signaux d'investisseur fDi Markets.

CE QUE CE MODULE FAIT DE PLUS QUE CELUI DES PROJETS, et rien d'autre : il lit
des colonnes MULTIPLES. Un projet annoncé a un pays, un secteur, une activité ;
un signal peut en viser plusieurs de chaque, et relever de plusieurs natures.
Quatre tables de liaison portent ces valeurs, et c'est là toute la différence.

TOUT LE RESTE EST EMPRUNTÉ au lecteur des projets — normalisation, appariement
par préfixe, lecture des montants et des dates, résolution des entreprises et
des pays, correspondance des graphies. Ce n'est pas une commodité : deux
lecteurs qui interpréteraient « Coal, oil & gas » différemment finiraient par
ranger le même libellé sous deux postes, et les deux relevés cesseraient d'être
comparables.

CE QUE LE RELEVÉ NE PEUT PAS DIRE. Le tableau de fDi n'affiche qu'une valeur
par case multiple et cache les autres derrière un bouton — sans signaler de
façon fiable qu'il en cache. Le relevé porte donc UNE valeur par case, et les
autres s'ajoutent à la main depuis l'administration. D'où l'origine portée par
chaque valeur : « import » pour ce qui vient d'ici, « saisie » pour ce qu'un
humain a ajouté. Le réimport ne réécrit que les siennes.
"""

from __future__ import annotations

import csv
import hashlib
from pathlib import Path
from typing import TYPE_CHECKING

from app.services.fdi_projets import (DOSSIER_PROJETS, LigneInvalide, _entreprise,
                                      _est_vide, _pays, _referentiels, lire_date,
                                      lire_montant, rapprocher)

if TYPE_CHECKING:  # pragma: no cover — annotation seule
    from sqlalchemy.ext.asyncio import AsyncSession

DOSSIER_SIGNAUX = DOSSIER_PROJETS.parent / "signaux"

# L'ordre est celui des colonnes à l'écran de fDi. La recopie suit l'œil ; un
# ordre « logique » qui ne serait pas le sien multiplierait les inversions.
COLONNES = ["ligne", "date", "parent", "entreprise", "source", "destination",
            "secteur", "activite", "signal", "funding", "capex"]

# La pagination de la source, identique à celle des projets.
LIGNES_PAR_PAGE = 15

# Les quatre colonnes multiples, et la table de liaison de chacune. L'ordre de
# ce tableau est celui dans lequel les erreurs sont rapportées.
MULTIPLES = (
    ("destination", "fdi_signal_destinations"),
    ("secteur",     "fdi_signal_secteurs"),
    ("activite",    "fdi_signal_activites"),
    ("signal",      "fdi_signal_natures"),
)


def lire_lot_csv(chemin: Path) -> list[dict]:
    """Un fichier de page, tel que relevé sur la source, VERBATIM.

    Mêmes règles de rang que les projets : uniques, dans les bornes d'une page.
    C'est là qu'on attrape une ligne recopiée deux fois ou un rang fautif, qui
    sont les erreurs réelles de transcription.
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
    if len(set(rangs)) != len(rangs):
        doubles = sorted({r for r in rangs if rangs.count(r) > 1})
        raise LigneInvalide(f"{chemin.name} : rang(s) en double {doubles}")
    hors = [r for r in rangs if not 1 <= r <= LIGNES_PAR_PAGE]
    if hors:
        raise LigneInvalide(
            f"{chemin.name} : rang(s) hors des bornes d'une page {hors} — "
            f"la source en montre au plus {LIGNES_PAR_PAGE}")
    return sorted(lignes, key=lambda l: l["ligne"])


# ── Empreinte du contexte ────────────────────────────────────────────────────
# Ce qui gouverne l'interprétation d'une page de signaux. Une page inchangée
# doit être RÉÉCRITE si l'un de ces fichiers a bougé, sinon une correction du
# référentiel ne redescendrait jamais jusqu'aux lignes.
FICHIERS_GOUVERNANTS = (
    "fdi_pays.csv", "fdi_variantes.csv", "fdi_entreprises_alias.csv",
    "fdi_secteurs.csv", "fdi_business_activites.csv", "fdi_signaux.csv",
    "fdi_regions_monde.csv",
)


def empreinte_contexte() -> str:
    """Empreinte des référentiels ET du code qui les applique."""
    h = hashlib.sha256()
    for nom in FICHIERS_GOUVERNANTS:
        chemin = DOSSIER_PROJETS.parent / nom
        h.update(chemin.read_bytes() if chemin.exists() else b"")
    h.update(Path(__file__).read_bytes())
    return h.hexdigest()


def empreinte_lot(chemin: Path, contexte: str) -> str:
    h = hashlib.sha256(contexte.encode())
    h.update(chemin.read_bytes())
    return h.hexdigest()


# ── Résolution ───────────────────────────────────────────────────────────────
async def referentiels(db: "AsyncSession") -> dict:
    """Les nomenclatures utiles aux signaux, en mémoire.

    On reprend celles des projets — secteurs, activités, pays — et l'on ajoute
    les deux qui n'existent que pour les signaux : les natures et les régions
    du monde de fDi.
    """
    from sqlalchemy import text
    ref = await _referentiels(db)

    async def q(sql):
        return [dict(r._mapping) for r in (await db.execute(text(sql))).fetchall()]

    ref["natures"] = await q("SELECT id, code, libelle_en FROM fdi_signaux")
    ref["regions"] = await q("SELECT id, code, libelle_en FROM fdi_regions_monde")
    return ref


def _destination(brut: str | None, ref: dict, correspondance: dict[str, str]):
    """(pays_id, region_id, motif) — au plus un identifiant, jamais deux.

    UNE DESTINATION EST UN PAYS OU UNE RÉGION DU MONDE, et il faut le savoir
    avant de compter : « Africa » n'est pas un pays, et le ranger comme tel
    ferait apparaître un pays fantôme dans tous les classements.

    On essaie les DEUX, et l'on refuse si les deux répondent. Le cas ne se
    présente pas aujourd'hui — aucun pays ne s'appelle « Middle East » — mais un
    libellé tronqué pourrait un jour amorcer les deux listes, et deviner serait
    alors le plus sûr moyen de se tromper sans le savoir.
    """
    if not brut or not brut.strip():
        return None, None, None

    verdict, region = rapprocher(brut, ref["regions"])
    region_id = region[0]["id"] if verdict in ("exact", "unique") else None
    pays_id, motif_pays = _pays(brut, correspondance, ref["pays"])

    if region_id is not None and pays_id is not None:
        return None, None, "désigne à la fois un pays et une région du monde"
    if region_id is not None:
        return None, region_id, None
    if pays_id is not None:
        return pays_id, None, None
    if verdict == "ambigu":
        return None, None, "plusieurs régions du monde commencent ainsi"
    return None, None, motif_pays or "hors correspondance"


def _poste(brut: str | None, candidats: list[dict]):
    """(identifiant, motif) pour un poste de nomenclature, tronqué ou non.

    « n/a » n'est pas une lacune : c'est fDi qui dit que la colonne ne
    s'applique pas. On ne crée alors aucune valeur, et surtout on ne la compte
    pas parmi les rattachements manqués — sans quoi la file de travail se
    remplirait de lignes où il n'y a rien à faire.
    """
    if _est_vide(brut):
        return None, None
    verdict, retenus = rapprocher(brut, candidats)
    if verdict in ("exact", "unique"):
        return retenus[0]["id"], None
    return None, ("plusieurs postes commencent ainsi" if verdict == "ambigu"
                  else "aucun poste ne correspond")


async def resoudre_ligne(db: "AsyncSession", l: dict, ref: dict,
                         correspondance: dict[str, str],
                         utilisateur: str | None = None) -> dict:
    """Une ligne de relevé, prête à écrire : la ligne et ses quatre listes.

    Rien n'est refusé pour un rapprochement manqué : la ligne entre avec son
    texte brut et sans identifiant, et l'écran d'administration la signale.
    Perdre un signal parce qu'un libellé a changé chez fDi serait pire que de
    porter un rattachement en attente.
    """
    annee, mois = lire_date(l.get("date", ""))
    capex, capex_est = lire_montant(l.get("capex"))
    funding, funding_est = lire_montant(l.get("funding"))

    parent_id, _ = await _entreprise(db, l.get("parent"), utilisateur)
    ent_id, statut = await _entreprise(db, l.get("entreprise"), utilisateur)
    source_id, motif_source = _pays(l.get("source"), correspondance, ref["pays"])

    manques: list[str] = []
    if motif_source:
        manques.append(f"pays d'origine « {l.get('source')} » : {motif_source}")

    # Les quatre colonnes multiples. Le relevé n'en porte qu'une valeur par
    # case ; le rang 1 lui est donc réservé, et les ajouts manuels prendront
    # les suivants.
    dest_pays, dest_region, motif = _destination(l.get("destination"), ref, correspondance)
    if motif:
        manques.append(f"destination « {l.get('destination')} » : {motif}")

    secteur_id, motif = _poste(l.get("secteur"), ref["secteurs"])
    if motif:
        manques.append(f"secteur « {l.get('secteur')} » : {motif}")

    activite_id, motif = _poste(l.get("activite"), ref["activites"])
    if motif:
        manques.append(f"activité « {l.get('activite')} » : {motif}")

    nature_id, motif = _poste(l.get("signal"), ref["natures"])
    if motif:
        manques.append(f"nature du signal « {l.get('signal')} » : {motif}")

    return {
        "ligne": l["ligne"], "annee": annee, "mois": mois,
        "parent_brut": (l.get("parent") or "").strip() or None, "parent_id": parent_id,
        "entreprise_brut": (l.get("entreprise") or "").strip() or None,
        "entreprise_id": ent_id, "statut_entreprise": statut,
        "pays_source_brut": (l.get("source") or "").strip() or None,
        "pays_source_id": source_id,
        "capex_musd": capex, "capex_estime": capex_est,
        "funding_musd": funding, "funding_estime": funding_est,
        # Une case vide ne produit aucune valeur : une liste vide dit « la
        # source n'a rien écrit », ce qui n'est pas la même chose qu'une valeur
        # non rattachée.
        "destinations": ([] if _est_vide(l.get("destination")) else
                         [{"rang": 1, "brut": (l.get("destination") or "").strip(),
                           "pays_id": dest_pays, "region_id": dest_region}]),
        "secteurs": ([] if _est_vide(l.get("secteur")) else
                     [{"rang": 1, "brut": (l.get("secteur") or "").strip(),
                       "secteur_id": secteur_id}]),
        "activites": ([] if _est_vide(l.get("activite")) else
                      [{"rang": 1, "brut": (l.get("activite") or "").strip(),
                        "activite_id": activite_id}]),
        "natures": ([] if _est_vide(l.get("signal")) else
                    [{"rang": 1, "brut": (l.get("signal") or "").strip(),
                      "nature_id": nature_id}]),
        "manques": manques,
    }


# ── Écriture ─────────────────────────────────────────────────────────────────
LIAISONS = (
    ("destinations", "fdi_signal_destinations", ("pays_id", "region_id")),
    ("secteurs",     "fdi_signal_secteurs",     ("secteur_id",)),
    ("activites",    "fdi_signal_activites",    ("activite_id",)),
    ("natures",      "fdi_signal_natures",      ("nature_id",)),
)


def empreinte_signal(annee, mois, parent, entreprise, source, funding, capex,
                     releve: tuple = ()) -> tuple:
    """Ce qui identifie une ligne dans son lot, travail humain exclu.

    LE RANG N'EST PAS UNE IDENTITÉ. Une page de fDi est un classement par date
    décroissante : qu'un signal nouveau paraisse, et tout descend d'un cran. La
    ligne 3 d'hier est la ligne 4 d'aujourd'hui, et la ligne 3 décrit désormais
    une autre entreprise.

    Sans cette comparaison, le réimport recollerait sur cette ligne 3 ce qu'un
    humain avait écrit pour l'ancienne : sa description, et les destinations
    qu'il avait ajoutées à la main parce que la source n'en montre qu'une. Rien
    ne le signalerait — ni erreur, ni ligne rouge : une description simplement
    attribuée à la mauvaise entreprise, dans un écran lu par la Présidence.
    C'est le raisonnement déjà tenu pour les projets ; il valait pour les
    signaux et il y manquait.

    Mieux vaut donc perdre une description que la coller sur un signal qui n'est
    plus le sien.

    LES QUATRE COLONNES MULTIPLES Y ENTRENT, MAIS SEULEMENT PAR CE QUE LE RELEVÉ
    EN DIT. Elles vivent en tables de liaison, et une valeur ajoutée à la main
    ne doit surtout pas changer la signature de la ligne — la garde se
    retournerait contre le travail qu'elle protège. On ne compare donc QUE les
    valeurs d'origine « import », c'est-à-dire exactement ce que la source a
    écrit dans la case : une saisie humaine n'y touche jamais.

    Les colonnes scalaires seules ne suffisaient pas, et le relevé complet l'a
    montré. Deux signaux Swvl d'août 2019, même maison mère, même entreprise,
    même pays d'origine, pas un montant : ils ne diffèrent que par leur
    destination, Nigeria pour l'un, Kenya pour l'autre. Une ligne qui glisse de
    l'un à l'autre passait pour « le même signal », et le travail humain
    migrait du premier au second sans que rien ne le dise. Un cas sur quatre
    mille cinq cents — mais silencieux, et sur le point de porter des heures de
    complétion à la main.

    Les nombres sont comparés en NOMBRES, jamais en texte : la base rend un
    Decimal(« 33.30 ») là où la source donne 33.3, et une comparaison de chaînes
    déclarerait deux fois la même ligne différente — ce qui effacerait
    justement la description qu'on cherche à préserver.
    """
    from app.services.fdi_projets import normaliser
    arrondi = lambda v: None if v is None else round(float(v), 2)  # noqa: E731
    return (
        annee, mois,
        normaliser(parent or ""), normaliser(entreprise or ""), normaliser(source or ""),
        arrondi(funding), arrondi(capex),
        # Le relevé arrive DÉJÀ CANONIQUE, par `signature_releve` — on ne le
        # normalise pas ici. Le normaliser détruirait les séparateurs qui
        # distinguent « le pays 42 » de « la région 42 ».
        tuple(releve),
    )


# Les préfixes de signature, un par famille. Ils tiennent dans un caractère
# parce que la chaîne signée n'a pas à être lisible — seulement stable.
_PREFIXES = {"destinations": "d", "secteurs": "s", "activites": "a", "natures": "n"}


def signature_releve(listes: dict[str, list[dict]]) -> tuple[str, ...]:
    """Ce que le relevé dit des quatre colonnes multiples, sous forme canonique.

    ON SIGNE LE SENS, PAS LE TEXTE — et c'est ce qui permet à la saisie et à
    l'import de produire la même identité pour le même signal.

    La source affiche ses libellés TRONQUÉS : « New Funding/Resour… ». Un import
    recopie cette troncature ; un formulaire où l'on CHOISIT dans le
    référentiel, lui, connaît le libellé entier. Signer le texte brut ferait
    donc deux signatures pour un seul signal, et l'export qui l'apporterait plus
    tard en créerait un doublon au lieu de le reconnaître — exactement ce que la
    bascule d'identité était censée empêcher.

    On signe donc le POSTE rattaché : « d:p42 » pour le pays 42, « d:r3 » pour
    la région 3. Le libellé tronqué et le libellé entier désignent le même
    poste, donc la même signature.

    CE QUI N'EST PAS RATTACHÉ se signe par son texte normalisé, faute de mieux,
    et se reconnaît au tilde. La conséquence est à connaître : si la
    nomenclature est corrigée plus tard et que la valeur se rattache enfin, la
    signature change et l'import créera une seconde ligne. Le compte rendu
    l'annonce — « + N créé(s) » là où l'on n'attendait rien — et c'est le seul
    endroit où cela peut arriver. Aujourd'hui aucune valeur du relevé n'est dans
    ce cas.
    """
    from app.services.fdi_projets import normaliser
    out: list[str] = []
    for nom, _, colonnes in LIAISONS:
        p = _PREFIXES[nom]
        for v in listes.get(nom, []):
            if nom == "destinations":
                if v.get("pays_id"):
                    out.append(f"{p}:p{v['pays_id']}")
                elif v.get("region_id"):
                    out.append(f"{p}:r{v['region_id']}")
                else:
                    out.append(f"{p}:~{normaliser(v.get('brut') or '')}")
            else:
                ident = v.get(colonnes[0])
                out.append(f"{p}:{ident}" if ident
                           else f"{p}:~{normaliser(v.get('brut') or '')}")
    return tuple(out)


def cle_signal(*args, **kw) -> str:
    """L'empreinte sous forme de chaîne, telle qu'elle est STOCKÉE et indexée.

    C'EST LA CLÉ D'IDENTITÉ DU SIGNAL. Deux conséquences qui obligent :

    Elle doit être STABLE DANS LE TEMPS. Si sa définition change — un champ de
    plus, une normalisation retouchée — les signaux déjà en base ne se
    reconnaissent plus, et le réimport suivant les insère tous une seconde
    fois. Un test épingle donc la valeur exacte d'une ligne connue : toute
    modification involontaire de la formule fait tomber la suite au lieu de
    doubler quatre mille cinq cents lignes en silence.

    Elle ne doit contenir AUCUN travail humain, pour que saisir n'altère jamais
    l'identité de ce qu'on saisit — voir `empreinte_signal`.
    """
    brut = "\x1f".join(
        "" if v is None else str(v)
        for v in _aplatir(empreinte_signal(*args, **kw))
    )
    return hashlib.sha256(brut.encode()).hexdigest()


def _aplatir(valeur):
    """Déplie les tuples imbriqués, pour que la chaîne signée soit sans ambiguïté."""
    for v in valeur:
        if isinstance(v, tuple):
            yield from _aplatir(v)
        else:
            yield v


async def reprendre_empreintes(db: "AsyncSession") -> int:
    """Donne son empreinte à chaque signal qui n'en a pas encore. Renvoie le compte.

    LA BASCULE NE DOIT RIEN DOUBLER. Le jour où l'identité passe du rang au
    contenu, les lignes déjà en base n'ont pas de clé : le premier import ne les
    reconnaîtrait pas et les insérerait une seconde fois — quatre mille cinq
    cents doublons, et tout le travail humain resté sur les originaux pendant
    que les écrans affichent les copies. C'est arrivé une fois sur la base de
    vérification, ce qui a valu cette fonction.

    LA CLÉ EST RECALCULÉE DEPUIS CE QUE LA BASE PORTE, non depuis les CSV : ce
    sont les mêmes valeurs, mais passer par la base garantit qu'une ligne saisie
    à la main — qui n'a aucun fichier derrière elle — reçoit sa clé comme les
    autres.

    Idempotente : une ligne qui a déjà son empreinte n'est pas relue.
    """
    from sqlalchemy import text

    lignes = (await db.execute(text(
        "SELECT id, annee, mois, parent_brut, entreprise_brut, pays_source_brut,"
        "       funding_musd, capex_musd"
        "  FROM fdi_signaux_investisseurs WHERE empreinte IS NULL"))).fetchall()
    if not lignes:
        return 0

    # Le relevé de chaque ligne, en une requête par famille plutôt qu'une par
    # ligne : à quatre mille cinq cents lignes, la différence est celle entre
    # quelques secondes et un quart d'heure.
    releve: dict[int, dict[str, list[dict]]] = {}
    for nom, table, colonnes in LIAISONS:
        cols = ", ".join(colonnes)
        for r in (await db.execute(text(
            f"SELECT signal_id, brut, {cols} FROM {table}"
            f" WHERE origine = 'import' ORDER BY signal_id, rang"))).fetchall():
            releve.setdefault(r.signal_id, {}).setdefault(nom, []).append(dict(r._mapping))

    for l in lignes:
        await db.execute(text(
            "UPDATE fdi_signaux_investisseurs SET empreinte = :e WHERE id = :i"),
            {"i": l.id, "e": cle_signal(
                l.annee, l.mois, l.parent_brut, l.entreprise_brut, l.pays_source_brut,
                l.funding_musd, l.capex_musd, signature_releve(releve.get(l.id, {})))})
    return len(lignes)


async def importer_lot(db: "AsyncSession", libelle: str, perimetre: str, sens: str,
                       lignes: list[dict], ref: dict, correspondance: dict[str, str],
                       utilisateur: str | None = None,
                       empreinte_page: str | None = None) -> dict:
    """Écrit une page. Idempotent : rejouable sans doubler quoi que ce soit."""
    from sqlalchemy import text

    lot = (await db.execute(text(
        "SELECT id, empreinte FROM fdi_lots_import WHERE libelle = :l AND base = 'signaux'"),
        {"l": libelle})).first()
    if lot and empreinte_page and lot.empreinte == empreinte_page:
        return {"inchange": True, "lot_id": lot.id, "lignes": 0, "manques": []}

    if lot:
        lot_id = lot.id
        await db.execute(text(
            "UPDATE fdi_lots_import SET perimetre = :p, sens = :s, importe_le = now(), "
            "  importe_par = :u WHERE id = :i"),
            {"p": perimetre, "s": sens, "u": utilisateur, "i": lot_id})
    else:
        lot_id = (await db.execute(text(
            "INSERT INTO fdi_lots_import (libelle, perimetre, sens, base, source, importe_par) "
            "VALUES (:l, :p, :s, 'signaux', 'saisie', :u) RETURNING id"),
            {"l": libelle, "p": perimetre, "s": sens, "u": utilisateur})).scalar_one()

    manques: list[str] = []
    crees = majs = 0
    for l in lignes:
        r = await resoudre_ligne(db, l, ref, correspondance, utilisateur)
        manques += [f"L{r['ligne']} · {m}" for m in r.pop("manques")]
        listes = {nom: r.pop(nom) for nom, _, _ in LIAISONS}

        # L'IDENTITÉ DE LA LIGNE : son contenu, pas sa place. L'ordre des
        # familles est celui de LIAISONS, ici comme partout ailleurs où cette
        # clé se calcule — deux ordres différents donneraient deux clés pour un
        # même signal, et le réimport le doublerait.
        r["empreinte"] = cle_signal(
            r["annee"], r["mois"], r["parent_brut"], r["entreprise_brut"],
            r["pays_source_brut"], r["funding_musd"], r["capex_musd"],
            signature_releve(listes))

        # LE TRAVAIL HUMAIN N'EST PLUS JAMAIS REMIS EN CAUSE. Il l'était tant
        # que l'identité tenait au rang : une ligne qui glissait emportait la
        # description de celle qui l'occupait. Puisque la ligne retrouvée est
        # LA MÊME par construction, tout ce qu'un humain y a posé lui appartient
        # — la décision sur l'entreprise, les descriptions, et les valeurs
        # ajoutées dans les quatre colonnes multiples.
        #
        # Ce qui se réécrit, ce sont les colonnes du relevé et les
        # rattachements qui en dérivent : une nomenclature corrigée doit
        # redescendre jusqu'ici. Et la provenance — quelle page, quel rang —
        # qui change à chaque repagination et n'est plus qu'un repère.
        avant = (await db.execute(text(
            "SELECT id FROM fdi_signaux_investisseurs WHERE empreinte = :e"),
            {"e": r["empreinte"]})).first()

        signal_id = (await db.execute(text("""
            INSERT INTO fdi_signaux_investisseurs
                (lot_id, ligne, empreinte, annee, mois, parent_brut, parent_id,
                 entreprise_brut, entreprise_id, statut_entreprise,
                 pays_source_brut, pays_source_id,
                 capex_musd, capex_estime, funding_musd, funding_estime,
                 modifie_le, modifie_par)
            VALUES (:lot, :ligne, :empreinte, :annee, :mois, :parent_brut, :parent_id,
                    :entreprise_brut, :entreprise_id, :statut_entreprise,
                    :pays_source_brut, :pays_source_id,
                    :capex_musd, :capex_estime, :funding_musd, :funding_estime,
                    now(), :u)
            ON CONFLICT (empreinte) WHERE empreinte IS NOT NULL DO UPDATE SET
                lot_id = EXCLUDED.lot_id, ligne = EXCLUDED.ligne,
                parent_id = CASE
                    WHEN fdi_signaux_investisseurs.statut_entreprise = 'resolu'
                    THEN fdi_signaux_investisseurs.parent_id ELSE EXCLUDED.parent_id END,
                entreprise_id = CASE
                    WHEN fdi_signaux_investisseurs.statut_entreprise = 'resolu'
                    THEN fdi_signaux_investisseurs.entreprise_id
                    ELSE EXCLUDED.entreprise_id END,
                statut_entreprise = CASE
                    WHEN fdi_signaux_investisseurs.statut_entreprise = 'resolu'
                    THEN 'resolu' ELSE EXCLUDED.statut_entreprise END,
                pays_source_id = EXCLUDED.pays_source_id,
                capex_estime = EXCLUDED.capex_estime,
                funding_estime = EXCLUDED.funding_estime,
                modifie_le = now(), modifie_par = EXCLUDED.modifie_par
            RETURNING id"""), {**r, "lot": lot_id, "u": utilisateur})).scalar_one()
        if avant:
            majs += 1
        else:
            crees += 1

        # SEULES LES VALEURS DU RELEVÉ SONT REMPLACÉES. Celles qu'un humain a
        # ajoutées portent origine « saisie » et survivent toujours : c'est
        # toute la raison d'être de cette colonne, puisque le relevé ne peut pas
        # être exhaustif sur ces quatre colonnes-là.
        for nom, table, colonnes in LIAISONS:
            await db.execute(text(
                f"DELETE FROM {table} WHERE signal_id = :s AND origine = 'import'"),
                {"s": signal_id})
            for v in listes[nom]:
                champs = ", ".join(colonnes)
                valeurs = ", ".join(f":{c}" for c in colonnes)
                await db.execute(text(
                    f"INSERT INTO {table} (signal_id, rang, brut, {champs}, origine) "
                    f"VALUES (:s, :rang, :brut, {valeurs}, 'import')"),
                    {"s": signal_id, **v})

    # AUCUNE SUPPRESSION. Une ligne que cette page ne montre plus n'a pas
    # disparu du relevé : elle a glissé vers la page suivante, qui l'importera.
    # La supprimer ici pour la réinsérer là-bas lui ferait perdre son identité,
    # et avec elle tout ce qu'un humain y avait posé — c'est précisément ce
    # qu'on vient de corriger.
    #
    # Un signal réellement retiré par la source demeure donc en base. C'est
    # assumé : la plateforme garde ce qu'elle a vu, et l'administration dispose
    # d'une suppression explicite pour les cas où il faut trancher.
    await db.execute(text(
        "UPDATE fdi_lots_import SET nb_lignes = "
        "  (SELECT count(*) FROM fdi_signaux_investisseurs WHERE lot_id = :i) "
        " WHERE id = :i"), {"i": lot_id})
    if empreinte_page:
        await db.execute(text(
            "UPDATE fdi_lots_import SET empreinte = :e WHERE id = :i"),
            {"e": empreinte_page, "i": lot_id})

    return {"inchange": False, "lot_id": lot_id, "lignes": crees + majs,
            "manques": manques, "crees": crees, "majs": majs}
