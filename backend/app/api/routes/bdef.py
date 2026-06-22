"""
Endpoints d'administration BDEF : import de fichiers, file de revue, association.

Flux (import bloquant, cf. bdef_import.py) :
  1. POST /bdef/importer       → upload du classeur ; si secteurs incertains,
                                  rien n'est écrit, l'import passe en 'en_revue'.
  2. GET  /bdef/revue          → liste les secteurs à valider.
  3. POST /bdef/associer       → enregistre l'alias d'un secteur douteux.
  4. (ré)POST /bdef/importer   → les alias résolvent les secteurs, valeurs écrites.
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy import select, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bdef import (
    BdefMacroSecteur, BdefGroupe, BdefSecteur, BdefImport, BdefImportRevue,
    BdefValeur, BdefValeurRejetee, BdefIndicateur, BdefIndicateurCategorie,
)
from app.services.bdef_import import lancer_import, associer_secteur
from app.services.bdef_verification import (
    verifier, SecteurValeurs, IndicateurInfo, raison_erreur_borne,
)
from app.utils.bdef_matching import (
    NIVEAU_GLOBAL, NIVEAU_SECTEUR, NIVEAU_GROUPE, NIVEAU_MACRO,
)

# Niveau → colonne FK de bdef_valeurs
_FK_PAR_NIVEAU = {
    NIVEAU_MACRO:   BdefValeur.macro_secteur_id,
    NIVEAU_GROUPE:  BdefValeur.groupe_id,
    NIVEAU_SECTEUR: BdefValeur.secteur_id,
}

router = APIRouter(prefix="/bdef", tags=["BDEF"])


# ── Import d'un classeur ──────────────────────────────────────────────────────

@router.post("/importer", status_code=200)
async def importer_bdef(
    fichier: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    contenu = await fichier.read()
    if not contenu:
        raise HTTPException(400, "Fichier vide.")
    try:
        resultat = await lancer_import(db, contenu, fichier.filename or "import.xlsx")
    except Exception as e:
        raise HTTPException(400, f"Erreur lors de l'import : {e}")
    if "erreur" in resultat:
        raise HTTPException(400, resultat["erreur"])
    return resultat


# ── Historique des imports ────────────────────────────────────────────────────

@router.get("/imports")
async def liste_imports(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BdefImport).order_by(desc(BdefImport.cree_le)))
    return [
        {
            "id": i.id, "fichier": i.fichier, "statut": i.statut,
            "annees": i.annees, "nb_valeurs": i.nb_valeurs, "nb_revue": i.nb_revue,
            "cree_le": i.cree_le.isoformat() if i.cree_le else None,
            "termine_le": i.termine_le.isoformat() if i.termine_le else None,
        }
        for i in res.scalars().all()
    ]


# ── File de revue ─────────────────────────────────────────────────────────────

@router.get("/revue")
async def liste_revue(
    statut: str = "en_attente",
    import_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(BdefImportRevue).where(BdefImportRevue.statut == statut)
    if import_id is not None:
        q = q.where(BdefImportRevue.import_id == import_id)
    res = await db.execute(q.order_by(BdefImportRevue.niveau, BdefImportRevue.code_bdef))
    return [
        {
            "id": r.id, "import_id": r.import_id, "niveau": r.niveau,
            "code_bdef": r.code_bdef, "libelle_brut": r.libelle_brut,
            "score": float(r.score_fuzzy) if r.score_fuzzy is not None else None,
            "candidats": r.candidats, "statut": r.statut,
        }
        for r in res.scalars().all()
    ]


# ── Association d'un secteur douteux (création d'alias) ───────────────────────

@router.post("/associer", status_code=200)
async def associer(payload: dict, db: AsyncSession = Depends(get_db)):
    niveau   = (payload.get("niveau") or "").strip()
    libelle  = (payload.get("libelle_brut") or "").strip()
    cible_id = payload.get("cible_id")
    if niveau not in (NIVEAU_SECTEUR, NIVEAU_GROUPE, NIVEAU_MACRO):
        raise HTTPException(400, "niveau invalide (secteur|groupe|macro_secteur).")
    if not libelle or cible_id is None:
        raise HTTPException(400, "libelle_brut et cible_id sont requis.")
    return await associer_secteur(db, niveau, libelle, int(cible_id),
                                  valide_par=payload.get("valide_par"))


# ── Référentiel des secteurs (pour le picker d'association) ──────────────────

@router.get("/secteurs")
async def liste_secteurs(db: AsyncSession = Depends(get_db)):
    macro = (await db.execute(select(BdefMacroSecteur).order_by(BdefMacroSecteur.ordre))).scalars().all()
    groupes = (await db.execute(select(BdefGroupe).order_by(BdefGroupe.ordre))).scalars().all()
    secteurs = (await db.execute(select(BdefSecteur).order_by(BdefSecteur.ordre))).scalars().all()
    return {
        NIVEAU_MACRO:   [{"id": s.id, "code": s.code, "libelle": s.libelle} for s in macro],
        NIVEAU_GROUPE:  [{"id": s.id, "code": s.code, "libelle": s.libelle,
                          "macro_secteur_id": s.macro_secteur_id} for s in groupes],
        NIVEAU_SECTEUR: [{"id": s.id, "code": s.code, "libelle": s.libelle,
                          "groupe_id": s.groupe_id} for s in secteurs],
    }


# ── Lecture des valeurs (consultation / vérification) ─────────────────────────

@router.get("/valeurs")
async def lire_valeurs(
    niveau: str = NIVEAU_GLOBAL,
    cible_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Renvoie les indicateurs (hors variables _raw_) et leurs valeurs par année,
    pour un secteur donné (ou le global), groupés par catégorie. Format pensé
    pour un tableau indicateurs × années.
    """
    if niveau not in (NIVEAU_GLOBAL, NIVEAU_SECTEUR, NIVEAU_GROUPE, NIVEAU_MACRO):
        raise HTTPException(400, "niveau invalide.")

    q = (
        select(BdefValeur, BdefIndicateur, BdefIndicateurCategorie)
        .join(BdefIndicateur, BdefValeur.indicateur_id == BdefIndicateur.id)
        .join(BdefIndicateurCategorie, BdefIndicateur.categorie_id == BdefIndicateurCategorie.id)
        .where(BdefValeur.niveau == niveau)
        .where(~BdefIndicateur.code.like("\\_raw\\_%"))
    )
    if niveau == NIVEAU_GLOBAL:
        q = q.where(
            BdefValeur.macro_secteur_id.is_(None),
            BdefValeur.groupe_id.is_(None),
            BdefValeur.secteur_id.is_(None),
        )
    else:
        if cible_id is None:
            raise HTTPException(400, "cible_id requis pour ce niveau.")
        q = q.where(_FK_PAR_NIVEAU[niveau] == cible_id)

    res = await db.execute(q)

    annees: set[int] = set()
    indic: dict[str, dict] = {}
    for val, ind, cat in res.all():
        annees.add(val.annee)
        d = indic.setdefault(ind.code, {
            "code": ind.code, "libelle": ind.libelle, "unite": ind.unite,
            "categorie": cat.libelle, "categorie_ordre": cat.ordre or 0,
            "ordre": ind.ordre or 0, "valeurs": {}, "initiales": {},
        })
        d["valeurs"][val.annee] = float(val.valeur) if val.valeur is not None else None
        d["initiales"][val.annee] = (
            float(val.valeur_initiale) if val.valeur_initiale is not None
            else (float(val.valeur) if val.valeur is not None else None)
        )

    indicateurs = sorted(indic.values(), key=lambda x: (x["categorie_ordre"], x["ordre"], x["code"]))
    return {"niveau": niveau, "cible_id": cible_id,
            "annees": sorted(annees), "indicateurs": indicateurs}


# ── Vérification automatisée des données ──────────────────────────────────────

@router.get("/verification")
async def verification(db: AsyncSession = Depends(get_db)):
    """
    Contrôle qualité de l'ensemble des valeurs enregistrées : recalcul des
    indicateurs calculés, couverture, bornes/outliers et cohérence comptable.
    Renvoie un rapport prêt à afficher (cf. bdef_verification.verifier).
    """
    # Métadonnées indicateurs (id → code) + infos pour le rapport
    res = await db.execute(select(BdefIndicateur))
    inds = res.scalars().all()
    code_par_id = {i.id: i.code for i in inds}
    libelle_par_code = {i.code: i.libelle for i in inds}
    indicateurs = {
        i.code: IndicateurInfo(libelle=i.libelle, unite=i.unite, mode=i.mode or "lu")
        for i in inds
    }

    # Libellés des cibles par niveau (pour nommer les secteurs dans le rapport)
    macro = {s.id: f"{s.code} — {s.libelle}" for s in
             (await db.execute(select(BdefMacroSecteur))).scalars().all()}
    grp = {s.id: f"{s.code} — {s.libelle}" for s in
           (await db.execute(select(BdefGroupe))).scalars().all()}
    sec = {s.id: f"{s.code} — {s.libelle}" for s in
           (await db.execute(select(BdefSecteur))).scalars().all()}
    libelles = {NIVEAU_MACRO: macro, NIVEAU_GROUPE: grp, NIVEAU_SECTEUR: sec}

    # Toutes les valeurs (y compris _raw_, nécessaires aux recalculs), groupées
    # par secteur (niveau, cible_id).
    res = await db.execute(select(BdefValeur))
    secteurs: dict[tuple, SecteurValeurs] = {}
    for v in res.scalars().all():
        cible = v.macro_secteur_id or v.groupe_id or v.secteur_id  # None si global
        key = (v.niveau, cible)
        sv = secteurs.get(key)
        if sv is None:
            lib = "Global des secteurs" if v.niveau == NIVEAU_GLOBAL \
                else libelles.get(v.niveau, {}).get(cible, f"{v.niveau} #{cible}")
            sv = SecteurValeurs(niveau=v.niveau, cible_id=cible, libelle=lib)
            secteurs[key] = sv
        code = code_par_id.get(v.indicateur_id)
        if code and v.valeur is not None:
            sv.valeurs.setdefault(code, {})[v.annee] = float(v.valeur)

    rapport = verifier(list(secteurs.values()), indicateurs)

    # Ajoute les valeurs rejetées à l'import comme anomalies de type "borne"
    rejets = (await db.execute(
        select(BdefValeurRejetee).where(BdefValeurRejetee.statut == "en_attente")
    )).scalars().all()
    anomalies_extra = [
        {
            "severite": "erreur",
            "categorie": "borne",
            "indicateur": r.indicateur_code or "",
            "indicateur_libelle": libelle_par_code.get(r.indicateur_code or "", r.indicateur_code or ""),
            "niveau": r.niveau,
            "cible_id": r.macro_secteur_id or r.groupe_id or r.secteur_id,
            "libelle_cible": r.libelle_cible or "",
            "annee": r.annee,
            "message": r.raison or "",
            "valeur": float(r.valeur_source),
            "attendu": None,
            "rejetee_id": r.id,
        }
        for r in rejets
    ]

    return {
        "score": rapport.score,
        "nb_secteurs": rapport.nb_secteurs,
        "nb_valeurs": rapport.nb_valeurs,
        "annees": rapport.annees,
        "nb_erreurs": rapport.nb_erreurs,
        "nb_avertissements": rapport.nb_avertissements,
        "couverture": [
            {"code": c.code, "libelle": c.libelle, "annees_couvertes": c.annees_couvertes,
             "nb_present": c.nb_present, "nb_attendu": c.nb_attendu, "taux": c.taux}
            for c in rapport.couverture
        ],
        "anomalies": [
            {"severite": a.severite, "categorie": a.categorie, "indicateur": a.indicateur,
             "indicateur_libelle": libelle_par_code.get(a.indicateur, a.indicateur),
             "niveau": a.niveau, "cible_id": a.cible_id, "libelle_cible": a.libelle_cible,
             "annee": a.annee, "message": a.message,
             "valeur": a.valeur, "attendu": a.attendu,
             "rejetee_id": None}
            for a in rapport.anomalies
        ] + anomalies_extra,
    }


# ── Correction manuelle d'une valeur rejetée ─────────────────────────────────

_FK_PAR_NIVEAU_STR = {
    NIVEAU_MACRO:   "macro_secteur_id",
    NIVEAU_GROUPE:  "groupe_id",
    NIVEAU_SECTEUR: "secteur_id",
}


@router.post("/corriger", status_code=200)
async def corriger_valeur(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Valide la correction manuelle d'une valeur en erreur de borne.

    Deux modes :
      - via `rejetee_id` : valeur non importée (table bdef_valeurs_rejetees) ;
      - via (indicateur, niveau, cible_id, annee) : valeur déjà présente en base
        et signalée en erreur par le rapport de vérification.
    Dans les deux cas la valeur corrigée est écrite dans bdef_valeurs.
    """
    valeur_corrigee = payload.get("valeur_corrigee")
    if valeur_corrigee is None:
        raise HTTPException(400, "valeur_corrigee est requis.")
    val = float(valeur_corrigee)

    rejetee_id = payload.get("rejetee_id")

    if rejetee_id is not None:
        rej = (await db.execute(
            select(BdefValeurRejetee).where(BdefValeurRejetee.id == int(rejetee_id))
        )).scalar_one_or_none()
        if not rej:
            raise HTTPException(404, "Valeur rejetée introuvable.")
        code = rej.indicateur_code or ""
        indicateur_id = rej.indicateur_id
        niveau = rej.niveau
        annee = rej.annee
        cible_id = rej.macro_secteur_id or rej.groupe_id or rej.secteur_id
    else:
        # Correction d'une valeur déjà présente en base (rapport de vérification)
        code = (payload.get("indicateur") or "").strip()
        niveau = (payload.get("niveau") or "").strip()
        cible_id = payload.get("cible_id")
        annee = payload.get("annee")
        if not code or not niveau or annee is None:
            raise HTTPException(400, "indicateur, niveau et annee sont requis.")
        ind = (await db.execute(
            select(BdefIndicateur).where(BdefIndicateur.code == code)
        )).scalar_one_or_none()
        if not ind:
            raise HTTPException(404, "Indicateur introuvable.")
        indicateur_id = ind.id
        rej = None
        annee = int(annee)
        cible_id = int(cible_id) if cible_id is not None else None

    raison = raison_erreur_borne(code, val)
    if raison:
        raise HTTPException(400, f"Valeur toujours invalide : {raison}")

    # Upsert dans bdef_valeurs
    fk_col = _FK_PAR_NIVEAU_STR.get(niveau)
    q = select(BdefValeur).where(
        BdefValeur.indicateur_id == indicateur_id,
        BdefValeur.niveau == niveau,
        BdefValeur.annee == annee,
    )
    if fk_col and cible_id is not None:
        q = q.where(getattr(BdefValeur, fk_col) == cible_id)
    existing = (await db.execute(q)).scalar_one_or_none()

    if existing:
        existing.valeur = val
    else:
        kwargs: dict = {
            "indicateur_id": indicateur_id,
            "niveau": niveau,
            "annee": annee,
            "valeur": val,
        }
        if fk_col and cible_id is not None:
            kwargs[fk_col] = cible_id
        db.add(BdefValeur(**kwargs))

    if rej is not None:
        rej.statut = "corrige"
    await db.flush()
    return {"success": True, "rejetee_id": rejetee_id, "valeur": val}


# ── Modification manuelle d'une valeur (édition directe en admin) ─────────────

@router.post("/modifier", status_code=200)
async def modifier_valeur(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Modifie directement une valeur en base depuis l'admin.

    payload : { indicateur, niveau, cible_id, annee, valeur } pour fixer une
    nouvelle valeur, ou { ..., reset: true } pour revenir à la valeur initiale
    (celle issue de l'import). La `valeur_initiale` n'est jamais altérée par une
    modification, ce qui permet de toujours restaurer l'état d'origine.
    """
    code = (payload.get("indicateur") or "").strip()
    niveau = (payload.get("niveau") or "").strip()
    cible_id = payload.get("cible_id")
    annee = payload.get("annee")
    reset = bool(payload.get("reset"))
    if not code or not niveau or annee is None:
        raise HTTPException(400, "indicateur, niveau et annee sont requis.")

    ind = (await db.execute(
        select(BdefIndicateur).where(BdefIndicateur.code == code)
    )).scalar_one_or_none()
    if not ind:
        raise HTTPException(404, "Indicateur introuvable.")

    annee = int(annee)
    cible_id = int(cible_id) if cible_id is not None else None
    fk_col = _FK_PAR_NIVEAU_STR.get(niveau)

    q = select(BdefValeur).where(
        BdefValeur.indicateur_id == ind.id,
        BdefValeur.niveau == niveau,
        BdefValeur.annee == annee,
    )
    if fk_col and cible_id is not None:
        q = q.where(getattr(BdefValeur, fk_col) == cible_id)
    row = (await db.execute(q)).scalar_one_or_none()

    if reset:
        if not row or row.valeur_initiale is None:
            raise HTTPException(404, "Aucune valeur initiale à restaurer.")
        row.valeur = row.valeur_initiale
    else:
        valeur = payload.get("valeur")
        if valeur is None or valeur == "":
            raise HTTPException(400, "valeur est requise.")
        val = float(valeur)
        raison = raison_erreur_borne(code, val)
        if raison:
            raise HTTPException(400, f"Valeur invalide : {raison}")
        if row:
            if row.valeur_initiale is None:
                row.valeur_initiale = row.valeur if row.valeur is not None else val
            row.valeur = val
        else:
            kwargs: dict = {
                "indicateur_id": ind.id, "niveau": niveau,
                "annee": annee, "valeur": val, "valeur_initiale": val,
            }
            if fk_col and cible_id is not None:
                kwargs[fk_col] = cible_id
            row = BdefValeur(**kwargs)
            db.add(row)

    await db.flush()
    vi = float(row.valeur_initiale) if row.valeur_initiale is not None else None
    vc = float(row.valeur) if row.valeur is not None else None
    return {"success": True, "valeur": vc, "valeur_initiale": vi,
            "modifie": vi is not None and vc is not None and abs(vc - vi) > 1e-9}


# ── Suppression de toutes les données BDEF ────────────────────────────────────

@router.delete("/vider", status_code=200)
async def vider_donnees(db: AsyncSession = Depends(get_db)):
    """
    Supprime toutes les valeurs, corrections en attente et l'historique des imports.
    Les alias de secteurs sont conservés pour faciliter les réimports futurs.
    """
    await db.execute(delete(BdefValeur))
    await db.execute(delete(BdefValeurRejetee))
    await db.execute(delete(BdefImport))          # cascade → bdef_import_revue
    await db.flush()
    return {"success": True, "message": "Toutes les données BDEF ont été supprimées."}
