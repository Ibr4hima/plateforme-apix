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
    rangs: list[int] = []
    for l in lignes:
        r = await resoudre_ligne(db, l, ref, correspondance, utilisateur)
        manques += [f"L{r['ligne']} · {m}" for m in r.pop("manques")]
        listes = {nom: r.pop(nom) for nom, _, _ in LIAISONS}
        rangs.append(r["ligne"])

        signal_id = (await db.execute(text("""
            INSERT INTO fdi_signaux_investisseurs
                (lot_id, ligne, annee, mois, parent_brut, parent_id,
                 entreprise_brut, entreprise_id, statut_entreprise,
                 pays_source_brut, pays_source_id,
                 capex_musd, capex_estime, funding_musd, funding_estime,
                 modifie_le, modifie_par)
            VALUES (:lot, :ligne, :annee, :mois, :parent_brut, :parent_id,
                    :entreprise_brut, :entreprise_id, :statut_entreprise,
                    :pays_source_brut, :pays_source_id,
                    :capex_musd, :capex_estime, :funding_musd, :funding_estime,
                    now(), :u)
            ON CONFLICT (lot_id, ligne) DO UPDATE SET
                annee = EXCLUDED.annee, mois = EXCLUDED.mois,
                parent_brut = EXCLUDED.parent_brut,
                entreprise_brut = EXCLUDED.entreprise_brut,
                -- UNE DÉCISION HUMAINE SURVIT AU RÉIMPORT. Compléter un nom
                -- tronqué depuis l'administration met la ligne à « resolu » ;
                -- laisser le relevé réécrire entreprise_id effacerait ce
                -- travail en silence, à la première mise à jour de la page.
                --
                -- La garde tient à ce que le TEXTE BRUT n'ait pas bougé : si
                -- la source écrit désormais autre chose, ce n'est plus la même
                -- entreprise qu'on avait tranchée, et la décision ne vaut plus.
                -- Même règle que pour les valeurs ajoutées à la main, et pour
                -- la même raison.
                entreprise_id = CASE
                    WHEN fdi_signaux_investisseurs.statut_entreprise = 'resolu'
                     AND fdi_signaux_investisseurs.entreprise_brut
                         IS NOT DISTINCT FROM EXCLUDED.entreprise_brut
                    THEN fdi_signaux_investisseurs.entreprise_id
                    ELSE EXCLUDED.entreprise_id END,
                statut_entreprise = CASE
                    WHEN fdi_signaux_investisseurs.statut_entreprise = 'resolu'
                     AND fdi_signaux_investisseurs.entreprise_brut
                         IS NOT DISTINCT FROM EXCLUDED.entreprise_brut
                    THEN 'resolu' ELSE EXCLUDED.statut_entreprise END,
                parent_id = CASE
                    WHEN fdi_signaux_investisseurs.statut_entreprise = 'resolu'
                     AND fdi_signaux_investisseurs.parent_brut
                         IS NOT DISTINCT FROM EXCLUDED.parent_brut
                    THEN fdi_signaux_investisseurs.parent_id
                    ELSE EXCLUDED.parent_id END,
                pays_source_brut = EXCLUDED.pays_source_brut,
                pays_source_id = EXCLUDED.pays_source_id,
                capex_musd = EXCLUDED.capex_musd, capex_estime = EXCLUDED.capex_estime,
                funding_musd = EXCLUDED.funding_musd, funding_estime = EXCLUDED.funding_estime,
                modifie_le = now(), modifie_par = EXCLUDED.modifie_par
            RETURNING id"""), {**r, "lot": lot_id, "u": utilisateur})).scalar_one()

        # SEULES LES VALEURS DU RELEVÉ SONT REMPLACÉES. Celles qu'un humain a
        # ajoutées dans l'administration portent origine « saisie » et
        # survivent : c'est toute la raison d'être de cette colonne, puisque le
        # relevé ne peut pas être exhaustif sur ces quatre-là.
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

    # Les lignes que la page ne montre plus : le relevé fait foi. Une saisie
    # manuelle, elle, vit dans son propre lot et n'est pas concernée.
    await db.execute(text(
        "DELETE FROM fdi_signaux_investisseurs "
        " WHERE lot_id = :i AND origine = 'import' AND NOT (ligne = ANY(:rangs))"),
        {"i": lot_id, "rangs": rangs})
    await db.execute(text(
        "UPDATE fdi_lots_import SET nb_lignes = "
        "  (SELECT count(*) FROM fdi_signaux_investisseurs WHERE lot_id = :i) "
        " WHERE id = :i"), {"i": lot_id})
    if empreinte_page:
        await db.execute(text(
            "UPDATE fdi_lots_import SET empreinte = :e WHERE id = :i"),
            {"e": empreinte_page, "i": lot_id})

    return {"inchange": False, "lot_id": lot_id, "lignes": len(rangs), "manques": manques}
