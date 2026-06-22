"""
Orchestration de l'import BDEF : parseur → matching → persistance.

Architecture en deux temps :

  1. `decider_import(...)` — cœur PUR, sans BD. À partir des blocs parsés, des
     métadonnées d'indicateurs, des candidats et des alias, il décide :
       - quels secteurs sont matchés avec certitude (à écrire) ;
       - quels secteurs partent en revue (incertains).
     Testable sans fichier ni base.

  2. `lancer_import(db, ...)` / `valider_revue(db, ...)` — couche BD qui charge
     les référentiels, applique la décision et persiste.

Import BLOQUANT (cf. décision produit) : si un seul secteur est incertain,
AUCUNE valeur n'est écrite. L'import passe en statut 'en_revue', les secteurs
douteux sont consignés. L'utilisateur les associe (création d'alias) puis
relance l'import — les alias résolvent alors les secteurs et les valeurs sont
écrites. Même logique que l'import IDE.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bdef import (
    BdefMacroSecteur, BdefGroupe, BdefSecteur, BdefIndicateur,
    BdefValeur, BdefValeurRejetee, BdefImport, BdefImportRevue, BdefSecteurAlias,
)
from app.services.bdef_excel import extraire_blocs, FEUILLE_COMPTES, FEUILLE_RATIOS
from app.services.bdef_mapping import grouper_par_secteur, IndicateurMeta
from app.services.bdef_decision import decider_import, SecteurMatche
from app.services.bdef_verification import comparer_fidelite, raison_erreur_borne, valeur_stockee
from app.utils.bdef_matching import NIVEAU_SECTEUR, NIVEAU_GROUPE, NIVEAU_MACRO

# Niveau → colonne FK de bdef_valeurs
_FK_PAR_NIVEAU = {
    NIVEAU_MACRO:   "macro_secteur_id",
    NIVEAU_GROUPE:  "groupe_id",
    NIVEAU_SECTEUR: "secteur_id",
}


# ── Chargement des référentiels ───────────────────────────────────────────────

async def _charger_indicateurs(db: AsyncSession) -> list[IndicateurMeta]:
    res = await db.execute(select(BdefIndicateur))
    metas = []
    for ind in res.scalars().all():
        metas.append(IndicateurMeta(
            code=ind.code,
            mode=ind.mode or "lu",
            extraction_key=ind.extraction_key,
            formule_vars=ind.formule_vars,
        ))
    return metas


async def _charger_candidats(db: AsyncSession) -> dict[str, list[dict]]:
    macro = (await db.execute(select(BdefMacroSecteur))).scalars().all()
    groupes = (await db.execute(select(BdefGroupe))).scalars().all()
    secteurs = (await db.execute(select(BdefSecteur))).scalars().all()
    return {
        NIVEAU_MACRO:   [{"id": s.id, "libelle": s.libelle, "code": s.code} for s in macro],
        NIVEAU_GROUPE:  [{"id": s.id, "libelle": s.libelle, "code": s.code} for s in groupes],
        NIVEAU_SECTEUR: [{"id": s.id, "libelle": s.libelle, "code": s.code} for s in secteurs],
    }


async def _charger_alias(db: AsyncSession) -> dict[str, dict[str, int]]:
    res = await db.execute(select(BdefSecteurAlias))
    out: dict[str, dict[str, int]] = {}
    for a in res.scalars().all():
        out.setdefault(a.niveau, {})[a.libelle_brut] = a.cible_id
    return out


async def _charger_indicateur_ids(db: AsyncSession) -> dict[str, int]:
    res = await db.execute(select(BdefIndicateur.code, BdefIndicateur.id))
    return {code: iid for code, iid in res.all()}


async def _charger_indicateur_unites(db: AsyncSession) -> dict[str, str]:
    res = await db.execute(select(BdefIndicateur.code, BdefIndicateur.unite))
    return {code: unite for code, unite in res.all()}


# ── Persistance des valeurs ───────────────────────────────────────────────────

async def _ecrire_valeurs(
    db: AsyncSession,
    matches: list[SecteurMatche],
    indicateur_ids: dict[str, int],
    indicateur_unites: dict[str, str],
    annees: list[int],
    import_id: int,
) -> tuple[int, int]:
    """
    Écrit les valeurs de tous les secteurs matchés dans bdef_valeurs.
    Les montants FCFA (exprimés en millions dans le fichier source) sont
    convertis en FCFA réels avant stockage.
    Les valeurs qui déclenchent une erreur de borne sont rejetées (non écrites)
    et stockées dans bdef_valeurs_rejetees pour correction manuelle.
    Retourne (nb_ok, nb_rejetes).
    """
    # Préchargement des valeurs existantes pour les indicateurs concernés
    codes_indic = {c for m in matches for c in m.valeurs.valeurs}
    ids_indic = [indicateur_ids[c] for c in codes_indic if c in indicateur_ids]
    existant: dict[tuple, BdefValeur] = {}
    if ids_indic and annees:
        res = await db.execute(
            select(BdefValeur).where(
                BdefValeur.indicateur_id.in_(ids_indic),
                BdefValeur.annee.in_(annees),
            )
        )
        for row in res.scalars().all():
            cible = row.macro_secteur_id or row.groupe_id or row.secteur_id
            existant[(row.indicateur_id, row.niveau, cible, row.annee)] = row

    nb_ok = 0
    nb_rej = 0
    for m in matches:
        fk = _FK_PAR_NIVEAU.get(m.niveau)
        for code_ind, vals in m.valeurs.valeurs.items():
            iid = indicateur_ids.get(code_ind)
            if iid is None:
                continue
            unite = indicateur_unites.get(code_ind)
            for va in vals:
                valeur = valeur_stockee(unite, va.valeur)
                raison = raison_erreur_borne(code_ind, valeur)
                if raison:
                    # valeur non importée — stockée pour correction manuelle
                    kwargs_rej: dict = {
                        "import_id": import_id,
                        "indicateur_id": iid,
                        "indicateur_code": code_ind,
                        "niveau": m.niveau,
                        "annee": va.annee,
                        "valeur_source": valeur,
                        "raison": raison,
                        "libelle_cible": m.libelle_brut,
                    }
                    if fk:
                        kwargs_rej[fk] = m.cible_id
                    db.add(BdefValeurRejetee(**kwargs_rej))
                    nb_rej += 1
                    continue

                key = (iid, m.niveau, m.cible_id, va.annee)
                row = existant.get(key)
                if row:
                    row.valeur = valeur
                else:
                    kwargs = {
                        "indicateur_id": iid, "niveau": m.niveau,
                        "annee": va.annee, "valeur": valeur,
                    }
                    if fk:
                        kwargs[fk] = m.cible_id
                    db.add(BdefValeur(**kwargs))
                nb_ok += 1
    return nb_ok, nb_rej


# ── Point d'entrée import ─────────────────────────────────────────────────────

def _parse_excel_sync(contenu: bytes) -> tuple[list, list]:
    """Parsing Excel synchrone — exécuté dans un thread pool."""
    import io, openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True, read_only=True)
    blocs_comptes, blocs_ratios = [], []
    if "EDITIONS COMPTES" in wb.sheetnames:
        rows = list(wb["EDITIONS COMPTES"].iter_rows(values_only=True))
        blocs_comptes = extraire_blocs(rows, FEUILLE_COMPTES)
    if "EDITIONS RATIOS" in wb.sheetnames:
        rows = list(wb["EDITIONS RATIOS"].iter_rows(values_only=True))
        blocs_ratios = extraire_blocs(rows, FEUILLE_RATIOS)
    wb.close()
    return blocs_comptes, blocs_ratios


async def lancer_import(db: AsyncSession, contenu: bytes, filename: str,
                        cree_par: str | None = None) -> dict:
    """
    Parse un classeur BDEF et l'importe. Bloquant : si des secteurs sont
    incertains, rien n'est écrit et l'import passe en 'en_revue'.
    """
    import asyncio

    # openpyxl est synchrone et CPU-intensif — on le déporte dans un thread
    # pour ne pas bloquer l'event loop asyncio (et donc les requêtes DB).
    blocs_comptes, blocs_ratios = await asyncio.to_thread(_parse_excel_sync, contenu)

    if not blocs_comptes and not blocs_ratios:
        return {"erreur": "Aucune feuille EDITIONS COMPTES/RATIOS reconnue."}

    groupes = grouper_par_secteur(blocs_comptes, blocs_ratios)
    indicateurs = await _charger_indicateurs(db)
    candidats = await _charger_candidats(db)
    alias = await _charger_alias(db)

    decision = decider_import(groupes, indicateurs, candidats, alias)

    imp = BdefImport(fichier=filename, annees=decision.annees, cree_par=cree_par)
    db.add(imp)
    await db.flush()   # pour obtenir imp.id

    if decision.bloque:
        for sr in decision.revue:
            db.add(BdefImportRevue(
                import_id=imp.id, niveau=sr.niveau, code_bdef=sr.code,
                libelle_brut=sr.libelle_brut, score_fuzzy=sr.score,
                candidats=sr.candidats,
            ))
        imp.statut = "en_revue"
        imp.nb_revue = len(decision.revue)
        await db.flush()
        return {
            "import_id": imp.id,
            "statut": "en_revue",
            "annees": decision.annees,
            "nb_secteurs_ok": len(decision.matches),
            "revue": [
                {"niveau": sr.niveau, "code_bdef": sr.code, "libelle_brut": sr.libelle_brut,
                 "score": sr.score, "candidats": sr.candidats}
                for sr in decision.revue
            ],
        }

    indicateur_ids = await _charger_indicateur_ids(db)
    indicateur_unites = await _charger_indicateur_unites(db)
    nb_ok, nb_rej = await _ecrire_valeurs(
        db, decision.matches, indicateur_ids, indicateur_unites, decision.annees, imp.id
    )
    from sqlalchemy.sql import func as _func
    imp.statut = "termine"
    imp.nb_valeurs = nb_ok
    imp.termine_le = _func.now()
    await db.flush()

    fidelite = await _controle_fidelite(
        db, decision.matches, indicateur_ids, indicateur_unites, decision.annees
    )

    return {
        "import_id": imp.id,
        "statut": "termine",
        "annees": decision.annees,
        "nb_secteurs": len(decision.matches),
        "nb_valeurs": nb_ok,
        "nb_rejetes": nb_rej,
        "fidelite": fidelite,
        "revue": [],
    }


# ── Contrôle de fidélité (relecture post-écriture) ────────────────────────────

async def _controle_fidelite(
    db: AsyncSession,
    matches: list[SecteurMatche],
    indicateur_ids: dict[str, int],
    indicateur_unites: dict[str, str],
    annees: list[int],
) -> dict:
    """
    Relit en base les valeurs qui viennent d'être écrites et les compare aux
    valeurs résolues depuis le fichier (mises à l'échelle FCFA). Prouve
    qu'aucune valeur n'a été perdue ou altérée entre l'extraction et l'écriture.
    """
    # valeurs attendues (résolues depuis le fichier, hors valeurs rejetées)
    attendu: dict[tuple, float] = {}
    for m in matches:
        for code, vals in m.valeurs.valeurs.items():
            unite = indicateur_unites.get(code)
            for va in vals:
                valeur = valeur_stockee(unite, va.valeur)
                if raison_erreur_borne(code, valeur) is None:
                    attendu[(code, m.niveau, m.cible_id, va.annee)] = valeur

    # valeurs relues en base
    code_par_id = {iid: code for code, iid in indicateur_ids.items()}
    ids = [indicateur_ids[c] for c in {k[0] for k in attendu} if c in indicateur_ids]
    relu: dict[tuple, float | None] = {}
    if ids and annees:
        res = await db.execute(
            select(BdefValeur).where(
                BdefValeur.indicateur_id.in_(ids),
                BdefValeur.annee.in_(annees),
            )
        )
        for row in res.scalars().all():
            cible = row.macro_secteur_id or row.groupe_id or row.secteur_id
            code = code_par_id.get(row.indicateur_id)
            if code:
                relu[(code, row.niveau, cible, row.annee)] = (
                    float(row.valeur) if row.valeur is not None else None
                )

    rapport = comparer_fidelite(attendu, relu)
    return {
        "total": rapport.total,
        "identiques": rapport.identiques,
        "taux": rapport.taux,
        "divergences": [
            {"indicateur": d.indicateur, "niveau": d.niveau, "cible_id": d.cible_id,
             "annee": d.annee, "attendu": d.attendu, "trouve": d.trouve}
            for d in rapport.divergences[:50]   # borne de sécurité
        ],
    }


# ── Validation d'une ligne de revue (création d'alias) ────────────────────────

async def associer_secteur(db: AsyncSession, niveau: str, libelle_brut: str,
                           cible_id: int, valide_par: str | None = None) -> dict:
    """
    Enregistre un alias (niveau, libelle_brut → cible_id) et marque les lignes
    de revue correspondantes comme validées. Le prochain import résoudra ce
    secteur automatiquement.
    """
    # upsert de l'alias
    res = await db.execute(
        select(BdefSecteurAlias).where(
            BdefSecteurAlias.niveau == niveau,
            BdefSecteurAlias.libelle_brut == libelle_brut,
        )
    )
    alias = res.scalar_one_or_none()
    if alias:
        alias.cible_id = cible_id
    else:
        db.add(BdefSecteurAlias(niveau=niveau, libelle_brut=libelle_brut, cible_id=cible_id))

    # marquer les lignes de revue en attente correspondantes
    res = await db.execute(
        select(BdefImportRevue).where(
            BdefImportRevue.niveau == niveau,
            BdefImportRevue.libelle_brut == libelle_brut,
            BdefImportRevue.statut == "en_attente",
        )
    )
    from sqlalchemy.sql import func as _func
    n = 0
    for row in res.scalars().all():
        row.cible_id_valide = cible_id
        row.statut = "valide"
        row.valide_le = _func.now()
        row.valide_par = valide_par
        n += 1

    await db.flush()
    return {"success": True, "niveau": niveau, "libelle_brut": libelle_brut,
            "cible_id": cible_id, "lignes_revue_resolues": n}
