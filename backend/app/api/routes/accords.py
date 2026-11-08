from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional, List
import shutil, os, uuid as uuid_lib
import json

from app.core.database import get_db
from app.core.auth import require_admin
from app.core.cache import en_cache
from datetime import date as date_type
from app.models.accord import Accord, AccordFichier
from app.schemas.accord import (
    AccordCreate, AccordUpdate,
    AccordResponse, AccordListResponse, AccordDetailResponse, AccordFichierOut
)
from app.core.uploads import lire_pdf
from app.core.fichier_partiel import FichierPartiel

router = APIRouter(prefix="/accords", tags=["Accords & Traités"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads/accords")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def parse_date(s):
    if not s: return None
    try: return date_type.fromisoformat(s)
    except: return None


def get_statut_calcule(accord) -> str:
    if accord.date_expiration and accord.date_expiration < date_type.today():
        return "expire"
    return accord.statut or "en_vigueur"


def accord_to_response(a) -> AccordResponse:
    r = AccordResponse.model_validate(a)
    r.statut = get_statut_calcule(a)
    return r


# ── GET /accords ──────────────────────────────────────────────────────────────
@router.get("", response_model=AccordListResponse)
async def liste_accords(
    page:                int           = Query(1, ge=1),
    per_page:            int           = Query(12, ge=1, le=100),
    statut:              Optional[str] = None,
    reference:           Optional[str] = None,
    parties_signataires: List[str]     = Query(default=[]),
    admin:               bool          = Query(False),
    db:                  AsyncSession  = Depends(get_db),
):
    filters = [] if admin else [Accord.est_publie == True, Accord.is_deleted == False]

    if statut:
        # Le statut « expire » est calculé à la volée (cf. get_statut_calcule) :
        # un accord dont la date_expiration est passée est expiré, quel que soit
        # le statut stocké. On reflète exactement cette logique dans le filtre.
        today = date_type.today()
        if statut == "expire":
            filters.append(Accord.date_expiration < today)
        else:
            filters.append(and_(
                Accord.statut == statut,
                or_(Accord.date_expiration == None, Accord.date_expiration >= today),
            ))
    if reference:
        filters.append(Accord.reference.ilike(f"%{reference}%"))
    if parties_signataires:
        filters.append(or_(*[Accord.parties_signataires.ilike(f"%{p}%") for p in parties_signataires]))

    total = (await db.execute(select(func.count()).select_from(Accord).where(and_(*filters)))).scalar()
    result = await db.execute(
        select(Accord).where(and_(*filters))
        # L'identifiant départage les accords signés le même jour : sans lui,
        # ils pouvaient passer d'une page à l'autre
        .order_by(Accord.date_signature.desc().nullslast(), Accord.id.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    return AccordListResponse(
        total=total, page=page, per_page=per_page,
        data=[accord_to_response(a) for a in result.scalars().all()]
    )


# ── GET /accords/cartes — les traités, en une requête légère ──────────────────
# Toutes les cartes en une réponse, pour l'administration ; la page publique
# lit le catalogue paginé (ci-dessous). La fiche complète se demande à
# l'ouverture (GET /accords/{id}).
_CHAMPS_CARTE = """a.id, a.titre, a.reference, a.type_accord, a.parties_signataires, a.parties_pays_ids,
       a.date_signature, a.date_entree_vigueur, a.date_expiration, a.statut, a.est_publie,
       a.secteur_ids, a.branche_ids, a.activite_ids"""
# Les traités de la page publique : bilatéraux d'investissement (l'existant
# sans type l'est), publiés
_PUBLIES = "a.est_publie = true AND a.is_deleted = false AND COALESCE(a.type_accord, 'tbi') = 'tbi'"


def _carte_accord(r, aujourdhui) -> dict:
    iso = lambda v: v.isoformat() if v else None  # noqa: E731
    return {
        **{k: r[k] for k in ("id", "titre", "reference", "type_accord", "parties_signataires")},
        "parties_pays_ids": r["parties_pays_ids"] or [],
        "date_signature": iso(r["date_signature"]), "date_entree_vigueur": iso(r["date_entree_vigueur"]),
        "date_expiration": iso(r["date_expiration"]),
        # La règle de get_statut_calcule
        "statut": "expire" if r["date_expiration"] and r["date_expiration"] < aujourdhui else (r["statut"] or "en_vigueur"),
        "secteur_ids": r["secteur_ids"] or [], "branche_ids": r["branche_ids"] or [],
        "activite_ids": r["activite_ids"] or [], "est_publie": r["est_publie"],
    }


@router.get("/cartes")
@en_cache("accords", selon_le_jour=True)
async def cartes_accords(
    admin: bool = Query(False, description="l'administration : tous les accords, publiés ou non, de tout type"),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text as sa_text
    # L'administration voit tout, comme sa liste complète (GET /accords?admin=true)
    filtre = "true" if admin else _PUBLIES
    rows = (await db.execute(sa_text(f"""
        SELECT {_CHAMPS_CARTE}
          FROM accords_traites a
         WHERE {filtre}
         ORDER BY a.date_signature DESC NULLS LAST, a.id DESC"""))).mappings().all()
    aujourdhui = date_type.today()
    return [_carte_accord(r, aujourdhui) for r in rows]


# ── GET /accords/catalogue — la page Accords, une page de cartes à la fois ────
# La page recevait tous les traités (0,6 Mo pour les 2 500 du banc,
# perf/RESULTATS-2026-11-08-prospects-agenda.md) et les filtrait, les triait
# elle-même. Elle les reçoit désormais par pages, avec ses règles appliquées
# ici :
#   · statut : expiré si l'échéance est passée, sinon en vigueur si l'entrée en
#     vigueur l'est, sinon signé si la signature l'est (computeStatutAccord) ;
#     sans statut (« sans_statut ») si aucune de ces dates n'est passée ;
#   · recherche : titre, référence, ou les signataires — les pays par leur nom
#     dans le référentiel, à défaut les parties écrites en toutes lettres ;
#   · parties : l'un des pays choisis, ou l'APIX parmi les signataires ;
#   · ordre : les accords actifs d'abord, celui qui expire le plus tôt en tête
#     (sans échéance : à la suite) ; puis les expirés, du plus récemment expiré
#     au plus ancien ; à égalité, la signature la plus récente d'abord.
_STATUT_ACCORD = """CASE WHEN a.date_expiration < CURRENT_DATE THEN 'expire'
         WHEN a.date_entree_vigueur <= CURRENT_DATE THEN 'en_vigueur'
         WHEN a.date_signature <= CURRENT_DATE THEN 'signe' END"""
_SIGNATAIRES = """CASE WHEN cardinality(a.parties_pays_ids) > 0 THEN
           (SELECT string_agg(rp.nom_fr, ', ' ORDER BY u.n)
              FROM unnest(a.parties_pays_ids) WITH ORDINALITY u(id, n)
              JOIN ref_pays rp ON rp.id = u.id AND rp.actif AND rp.nom_fr <> '')
         ELSE array_to_string(array_remove(string_to_array(a.parties_signataires, ', '), ''), ', ') END"""
_EXPIRE = "COALESCE(a.date_expiration < CURRENT_DATE, false)"
_ORDRE_CATALOGUE = f"""{_EXPIRE}, a.date_expiration IS NULL,
         CASE WHEN {_EXPIRE} THEN NULL ELSE a.date_expiration END,
         CASE WHEN {_EXPIRE} THEN a.date_expiration END DESC,
         a.date_signature DESC NULLS LAST, a.id DESC"""


def _liste_ids(valeur: Optional[str]) -> list[int]:
    return [int(x) for x in (valeur or "").split(",") if x.strip().isdigit()]


def _motif(texte: str) -> str:
    """Un texte cherché tel quel : % et _ n'y sont pas des jokers."""
    return "%" + texte.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


async def _compter_statuts(db: AsyncSession, where: str, params: dict) -> dict:
    """Les accords de chaque statut (« sans_statut » : aucune date passée), et
    combien de ceux sans statut ont une signature, prévue : la page les dit
    « Non datés » s'ils n'en ont aucune, « Autres » sinon."""
    from sqlalchemy import text as sa_text
    rows = (await db.execute(sa_text(f"""
        SELECT COALESCE({_STATUT_ACCORD}, 'sans_statut') AS statut, count(*) AS n,
               count(*) FILTER (WHERE a.date_signature IS NOT NULL) AS signes
          FROM accords_traites a
         WHERE {where}
         GROUP BY 1"""), params)).mappings().all()
    n = {"en_vigueur": 0, "signe": 0, "expire": 0, "sans_statut": 0, "sans_statut_signes": 0}
    for r in rows:
        n[r["statut"]] = r["n"]
        if r["statut"] == "sans_statut":
            n["sans_statut_signes"] = r["signes"]
    return n


@router.get("/catalogue")
@en_cache("accords", selon_le_jour=True)
async def catalogue_accords(
    q: Optional[str] = Query(None),
    statut: Optional[str] = Query(None, pattern="^(en_vigueur|signe|expire|sans_statut)$"),
    pays: Optional[str] = Query(None, description="identifiants des pays signataires, séparés par des virgules"),
    apix: bool = Query(False, description="l'APIX parmi les signataires (avec les pays : l'un ou l'autre)"),
    secteurs: Optional[str] = Query(None),
    branches: Optional[str] = Query(None),
    activites: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    par_page: int = Query(60, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text as sa_text
    conds, params = [_PUBLIES], {}
    if q and q.strip():
        conds.append(f"(a.titre ILIKE :q OR a.reference ILIKE :q OR ({_SIGNATAIRES}) ILIKE :q)")
        params["q"] = _motif(q.strip())
    parties = []
    if ids := _liste_ids(pays):
        parties.append("a.parties_pays_ids && CAST(:pays AS integer[])")
        params["pays"] = ids
    if apix:
        parties.append("a.parties_signataires ILIKE '%apix%'")
    if parties:
        conds.append("(" + " OR ".join(parties) + ")")
    for nom, valeur, colonne in (("secteurs", secteurs, "secteur_ids"), ("branches", branches, "branche_ids"),
                                 ("activites", activites, "activite_ids")):
        if ids := _liste_ids(valeur):
            conds.append(f"a.{colonne} && CAST(:{nom} AS integer[])")
            params[nom] = ids
    # Les filtres sans le statut : les nombres des onglets
    filtres, params_filtres = " AND ".join(conds), dict(params)
    if statut == "sans_statut":
        conds.append(f"({_STATUT_ACCORD}) IS NULL")
    elif statut:
        conds.append(f"({_STATUT_ACCORD}) = :statut")
        params["statut"] = statut
    where = " AND ".join(conds)
    total = (await db.execute(sa_text(f"SELECT count(*) FROM accords_traites a WHERE {where}"), params)).scalar_one()
    rows = (await db.execute(sa_text(f"""
        SELECT {_CHAMPS_CARTE}
          FROM accords_traites a
         WHERE {where}
         ORDER BY {_ORDRE_CATALOGUE}
         LIMIT :n OFFSET :o"""), {**params, "n": par_page, "o": (page - 1) * par_page})).mappings().all()
    aujourdhui = date_type.today()
    reponse = {
        "data": [_carte_accord(r, aujourdhui) for r in rows],
        "total": total, "page": page, "par_page": par_page, "pages": max(1, -(-total // par_page)),
    }
    if page == 1:
        # Les onglets de la page, un par statut : leur nombre suit la recherche
        # et les filtres (par_statut) ; « Expirés » et les accords sans statut
        # n'ont d'onglet que s'il en existe parmi tous les traités publiés
        # (statuts) — les onglets ne bougent pas avec la recherche.
        reponse["par_statut"] = await _compter_statuts(db, filtres, params_filtres)
        reponse["statuts"] = await _compter_statuts(db, _PUBLIES, {})
    return reponse


# ── GET /accords/admin/cartes — l'administration, soixante cartes à la fois ───
# La page d'administration recevait tous les accords (1 Mo pour les 2 500 du
# banc) et les triait, les filtrait elle-même. Elle les reçoit désormais par
# pages, avec sa règle : tous les accords (publiés ou non, de tout type), les
# échéances les plus proches d'abord, sans échéance en dernier, à égalité la
# signature la plus récente ; la recherche sur le titre et la référence.
@router.get("/admin/cartes")
async def cartes_accords_admin(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    par_page: int = Query(60, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_admin),
):
    from sqlalchemy import text as sa_text
    conds, params = ["true"], {}
    if q and q.strip():
        conds.append("(a.titre ILIKE :q OR a.reference ILIKE :q)")
        params["q"] = _motif(q.strip())
    where = " AND ".join(conds)
    total = (await db.execute(sa_text(f"SELECT count(*) FROM accords_traites a WHERE {where}"), params)).scalar_one()
    total_general = (await db.execute(sa_text("SELECT count(*) FROM accords_traites"))).scalar_one()
    rows = (await db.execute(sa_text(f"""
        SELECT {_CHAMPS_CARTE}
          FROM accords_traites a
         WHERE {where}
         ORDER BY a.date_expiration ASC NULLS LAST, a.date_signature DESC NULLS LAST, a.id DESC
         LIMIT :n OFFSET :o"""), {**params, "n": par_page, "o": (page - 1) * par_page})).mappings().all()
    aujourdhui = date_type.today()
    return {
        "data": [_carte_accord(r, aujourdhui) for r in rows],
        "total": total, "total_general": total_general,
        "page": page, "par_page": par_page, "pages": max(1, -(-total // par_page)),
    }


# ── GET /accords/parties-distinctes ──────────────────────────────────────────
# Les parties des accords publiés : les pays (dans le référentiel actif), et
# les organisations écrites en toutes lettres. Les pays se lisent en une
# requête, les organisations sur les seuls textes distincts.
@router.get("/parties-distinctes")
@en_cache("accords")
async def parties_distinctes(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text as sa_text
    pays = (await db.execute(sa_text("""
        SELECT id, nom_fr, code_iso2 FROM ref_pays
         WHERE actif = TRUE
           AND id IN (SELECT unnest(parties_pays_ids) FROM accords_traites WHERE est_publie = true)
         ORDER BY nom_fr"""))).all()
    textes = (await db.execute(sa_text("""
        SELECT DISTINCT parties_signataires FROM accords_traites
         WHERE est_publie = true AND parties_signataires IS NOT NULL"""))).scalars().all()
    organisations = {p for t in textes if t for p in (x.strip() for x in t.split(",")) if p}
    return {"pays": [{"id": i, "nom": nom, "code_iso2": iso2} for i, nom, iso2 in pays],
            "organisations": sorted(organisations)}


# ── GET /accords/:id ──────────────────────────────────────────────────────────
# Avec ses documents : la fiche n'a plus à les demander après s'être ouverte
# (elle grandissait alors sous les yeux du lecteur).
@router.get("/{accord_id}", response_model=AccordDetailResponse)
async def detail_accord(accord_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Accord).where(Accord.id == accord_id))
    accord = result.scalar_one_or_none()
    if not accord: raise HTTPException(status_code=404, detail="Accord introuvable")
    fichiers = (await db.execute(
        select(AccordFichier).where(AccordFichier.accord_id == accord_id).order_by(AccordFichier.created_at.asc())
    )).scalars().all()
    return AccordDetailResponse(**accord_to_response(accord).model_dump(), fichiers=[
        AccordFichierOut(id=f.id, titre=f.titre, fichier_nom=f.nom_fichier) for f in fichiers])


# ── POST /accords ─────────────────────────────────────────────────────────────
@router.post("", response_model=AccordResponse, status_code=201)
async def creer_accord(
    titre:               str            = Form(...),
    type_accord:         str            = Form("tbi"),  # tbi / inter
    reference:           Optional[str]  = Form(None),
    parties_signataires: Optional[str]  = Form(None),  # organisations libres
    parties_pays_ids:    Optional[str]  = Form(None),  # JSON array d'IDs ref_pays
    date_signature:      Optional[str]  = Form(None),
    date_entree_vigueur: Optional[str]  = Form(None),
    date_expiration:     Optional[str]  = Form(None),
    secteur_ids:         Optional[str]  = Form(None),  # JSON array
    branche_ids:         Optional[str]  = Form(None),
    activite_ids:        Optional[str]  = Form(None),
    commentaires:        Optional[str]  = Form(None),
    statut:              str            = Form("en_vigueur"),
    est_publie:          bool           = Form(True),
    created_by:          Optional[str]  = Form(None),
    fichier:             Optional[UploadFile] = File(None),
    db:                  AsyncSession   = Depends(get_db),
    current_user:        dict           = Depends(require_admin),
):
    fichier_nom, fichier_path = None, None
    if fichier and fichier.filename:
        contenu = await lire_pdf(fichier)
        unique_name = f"{uuid_lib.uuid4()}.pdf"
        dest = os.path.join(UPLOAD_DIR, unique_name)
        with open(dest, "wb") as f:
            f.write(contenu)
        fichier_nom, fichier_path = fichier.filename, dest

    def parse_ids(s): return json.loads(s) if s else []

    accord = Accord(
        titre=titre, type_accord=type_accord, reference=reference,
        parties_signataires=parties_signataires,
        parties_pays_ids=parse_ids(parties_pays_ids),
        date_signature=parse_date(date_signature),
        date_entree_vigueur=parse_date(date_entree_vigueur),
        date_expiration=parse_date(date_expiration),
        secteur_ids=parse_ids(secteur_ids),
        branche_ids=parse_ids(branche_ids),
        activite_ids=parse_ids(activite_ids),
        commentaires=commentaires, statut=statut,
        est_publie=est_publie, created_by=created_by,
        fichier_nom=fichier_nom, fichier_path=fichier_path,
    )
    db.add(accord)
    await db.flush()
    await db.refresh(accord)
    return accord_to_response(accord)


# ── PATCH /accords/:id ────────────────────────────────────────────────────────
@router.patch("/{accord_id}", response_model=AccordResponse)
async def modifier_accord(accord_id: int, payload: AccordUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    result = await db.execute(select(Accord).where(Accord.id == accord_id))
    accord = result.scalar_one_or_none()
    if not accord: raise HTTPException(status_code=404, detail="Accord introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(accord, field, value)
    await db.flush()
    await db.refresh(accord)
    return accord_to_response(accord)


# ── DELETE /accords/:id ───────────────────────────────────────────────────────
@router.delete("/{accord_id}", status_code=204)
async def supprimer_accord(accord_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    result = await db.execute(select(Accord).where(Accord.id == accord_id))
    accord = result.scalar_one_or_none()
    if not accord: raise HTTPException(status_code=404, detail="Accord introuvable")
    await db.delete(accord)
    await db.flush()


# ── Fichiers PDF ──────────────────────────────────────────────────────────────

@router.get("/{accord_id}/fichiers")
async def liste_fichiers(accord_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AccordFichier).where(AccordFichier.accord_id == accord_id)
        .order_by(AccordFichier.created_at.asc())
    )
    return [{"id": f.id, "titre": f.titre, "fichier_nom": f.nom_fichier, "chemin": f.chemin} for f in result.scalars().all()]


@router.post("/{accord_id}/fichiers", status_code=201)
async def ajouter_fichier(
    accord_id: int,
    titre:     str        = Form(...),
    fichier:   UploadFile = File(...),
    db:        AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    result = await db.execute(select(Accord).where(Accord.id == accord_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Accord introuvable")
    contenu = await lire_pdf(fichier)
    nom_fichier = f"{uuid_lib.uuid4()}.pdf"
    chemin = os.path.join(UPLOAD_DIR, nom_fichier)
    with open(chemin, "wb") as f:
        f.write(contenu)
    af = AccordFichier(accord_id=accord_id, titre=titre, nom_fichier=fichier.filename, chemin=f"/uploads/accords/{nom_fichier}")
    db.add(af)
    await db.flush()
    await db.refresh(af)
    return {"id": af.id, "titre": af.titre, "fichier_nom": af.nom_fichier, "chemin": af.chemin}


@router.get("/{accord_id}/fichiers/{fichier_id}/download")
async def telecharger_fichier(accord_id: int, fichier_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AccordFichier).where(AccordFichier.id == fichier_id, AccordFichier.accord_id == accord_id)
    )
    af = result.scalar_one_or_none()
    if not af: raise HTTPException(status_code=404, detail="Fichier introuvable")
    chemin_physique = os.path.join(os.path.dirname(__file__), "../../../", af.chemin.lstrip("/"))
    if not os.path.exists(chemin_physique): raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    return FichierPartiel(chemin_physique, media_type="application/pdf", filename=af.nom_fichier or "accord.pdf")


@router.delete("/{accord_id}/fichiers/{fichier_id}", status_code=204)
async def supprimer_fichier(accord_id: int, fichier_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    result = await db.execute(
        select(AccordFichier).where(AccordFichier.id == fichier_id, AccordFichier.accord_id == accord_id)
    )
    af = result.scalar_one_or_none()
    if not af: raise HTTPException(status_code=404, detail="Fichier introuvable")
    chemin_physique = os.path.join(os.path.dirname(__file__), "../../../", af.chemin.lstrip("/"))
    if os.path.exists(chemin_physique): os.remove(chemin_physique)
    await db.delete(af)
    await db.flush()
