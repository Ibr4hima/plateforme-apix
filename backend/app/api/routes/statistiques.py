"""
Module Statistiques : données macro par pays (population, superficie, PIB…),
séries temporelles, analyse par pays / comparative, et fiches de comparaison.
Les indicateurs « dérivés » (densité, PIB/hab) sont calculés à la volée pour
rester toujours cohérents avec les valeurs de base.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.shared import RefPays, StatIndicateur, StatPays

router = APIRouter(prefix="/statistiques", tags=["Statistiques"])


@router.get("/indicateurs")
async def indicateurs(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(StatIndicateur).order_by(StatIndicateur.ordre))).scalars().all()
    return [{"code": r.code, "libelle": r.libelle, "unite": r.unite,
             "categorie": r.categorie, "ordre": r.ordre, "derive": r.derive} for r in rows]


@router.get("/pays")
async def pays_disponibles(db: AsyncSession = Depends(get_db)):
    """Pays ayant au moins une donnée statistique."""
    ids = (await db.execute(select(StatPays.pays_id).distinct())).scalars().all()
    if not ids:
        return []
    rows = (await db.execute(
        select(RefPays).where(RefPays.id.in_(ids)).order_by(RefPays.nom_fr)
    )).scalars().all()
    return [{"id": p.id, "nom": p.nom_fr, "code_iso3": p.code_iso3,
             "continent": p.continent} for p in rows]


def _completer_derives(par_pays_annee: dict) -> None:
    """Ajoute densité (pop/superficie) et pib_hab (pib*1e9/pop) là où c'est possible."""
    for (pid, annee), vals in par_pays_annee.items():
        pop = vals.get("population")
        surf = vals.get("superficie")
        pib = vals.get("pib")
        if pop and surf and surf > 0:
            vals["densite"] = round(pop / surf, 2)
        if pop and pib and pop > 0:
            vals["pib_hab"] = round(pib * 1_000_000_000 / pop, 1)


async def _donnees(db: AsyncSession, pays_ids: List[int],
                   annee_min: Optional[int], annee_max: Optional[int]) -> List[dict]:
    q = select(StatPays).where(StatPays.pays_id.in_(pays_ids))
    if annee_min is not None:
        q = q.where(StatPays.annee >= annee_min)
    if annee_max is not None:
        q = q.where(StatPays.annee <= annee_max)
    rows = (await db.execute(q)).scalars().all()
    # noms des pays
    noms = {p.id: p.nom_fr for p in (await db.execute(
        select(RefPays).where(RefPays.id.in_(pays_ids)))).scalars().all()}
    # regroupe pour dériver
    par = {}
    for r in rows:
        par.setdefault((r.pays_id, r.annee), {})[r.indicateur] = float(r.valeur) if r.valeur is not None else None
    _completer_derives(par)
    out = []
    for (pid, annee), vals in par.items():
        for ind, val in vals.items():
            out.append({"pays_id": pid, "pays": noms.get(pid, ""), "annee": annee,
                        "indicateur": ind, "valeur": val})
    return out


@router.get("/donnees")
async def donnees(
    pays: str = Query(..., description="ids de pays séparés par virgule"),
    annee_min: Optional[int] = None,
    annee_max: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    ids = [int(x) for x in pays.split(",") if x.strip().isdigit()]
    if not ids:
        return []
    return await _donnees(db, ids, annee_min, annee_max)


@router.get("/comparaison")
async def comparaison(
    pays: str = Query(..., description="ids de pays à comparer, séparés par virgule"),
    annee: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Fiche de comparaison : dernière valeur (ou année demandée) de chaque
    indicateur pour chaque pays, prête pour un tableau côte à côte."""
    ids = [int(x) for x in pays.split(",") if x.strip().isdigit()]
    if not ids:
        return {"pays": [], "indicateurs": [], "valeurs": {}}
    inds = (await db.execute(select(StatIndicateur).order_by(StatIndicateur.ordre))).scalars().all()
    data = await _donnees(db, ids, None, None)
    # dernière année disponible par (pays, indicateur), ou l'année demandée
    latest = {}
    for d in data:
        if annee is not None and d["annee"] != annee:
            continue
        key = (d["pays_id"], d["indicateur"])
        if key not in latest or d["annee"] > latest[key]["annee"]:
            latest[key] = d
    paysrows = (await db.execute(select(RefPays).where(RefPays.id.in_(ids)))).scalars().all()
    paysmap = {p.id: p for p in paysrows}
    valeurs = {}
    for (pid, ind), d in latest.items():
        valeurs.setdefault(str(pid), {})[ind] = {"valeur": d["valeur"], "annee": d["annee"]}
    return {
        "pays": [{"id": pid, "nom": paysmap[pid].nom_fr, "code_iso3": paysmap[pid].code_iso3}
                 for pid in ids if pid in paysmap],
        "indicateurs": [{"code": i.code, "libelle": i.libelle, "unite": i.unite,
                         "categorie": i.categorie, "ordre": i.ordre} for i in inds],
        "valeurs": valeurs,
    }


# ══════════════════════════════════════════════════════════════════════════════
# IMPORT ADMIN — extraction des données depuis des fichiers Excel/CSV
# Format attendu : colonne A = pays, colonne B = année, colonne C = valeur.
# Un fichier peut contenir plusieurs pays. Le pays est auto-résolu vers ref_pays
# (exact puis normalisé sans accents), avec possibilité d'associer manuellement
# les libellés non reconnus (comme pour l'IDE).
# ══════════════════════════════════════════════════════════════════════════════
import io
import csv
import unicodedata
import re as _re
from fastapi import UploadFile, File, Form, HTTPException
from app.core.auth import require_admin
from app.models.shared import StatPays as _StatPays

# Seuls les indicateurs « de base » sont importables (densité et PIB/hab dérivés)
_INDICATEURS_IMPORT = {"population", "superficie", "pib", "croissance_pib"}


def _parse_stat_file(contenu: bytes, nom_fichier: str):
    """Retourne {pays_label: [(annee, valeur), ...]} — supporte multi-pays."""
    ext = (nom_fichier or "").lower().rsplit(".", 1)[-1]
    if ext in ("xlsx", "xls"):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True)
        ws = wb.active
        data = list(ws.iter_rows(values_only=True))
    else:
        texte = contenu.decode("utf-8-sig", errors="replace")
        sep = "," if texte[:2048].count(",") >= texte[:2048].count(";") else ";"
        data = list(csv.reader(io.StringIO(texte), delimiter=sep))

    SKIP = {"economy_label", "economy", "économie", "pays", "country", "nom", "libelle"}
    result = {}
    for row in data[1:] if data else []:
        try:
            label = str(row[0]).strip() if row[0] else ""
            if not label or label.lower() in SKIP:
                continue
            annee = int(str(row[1]).strip())
            if not (1900 <= annee <= 2100):
                continue
            raw = str(row[2]).strip() if len(row) > 2 else ""
            valeur = None if raw in ("", "...", "—", "-", "n.d.", "N/A", "None") else float(
                raw.replace(" ", "").replace(",", ".").replace(" ", "").replace("\xa0", "")
            )
            result.setdefault(label, []).append((annee, valeur))
        except (ValueError, IndexError):
            continue
    return result


def _norm(s: str) -> str:
    s = _re.sub(r"\s*\(\.+\d*\)", "", s or "")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


async def _resolve_pays(db: AsyncSession, label: str):
    from sqlalchemy import or_
    res = await db.execute(select(RefPays).where(or_(RefPays.nom_cnuced == label, RefPays.nom_fr == label, RefPays.code_iso3 == label.upper())).limit(1))
    obj = res.scalar_one_or_none()
    if obj:
        return obj
    ln = _norm(label)
    for p in (await db.execute(select(RefPays))).scalars().all():
        if _norm(p.nom_fr or "") == ln or _norm(p.nom_cnuced or "") == ln:
            return p
    return None


@router.get("/pays-ref")
async def pays_ref(db: AsyncSession = Depends(get_db)):
    """Tous les pays du référentiel (pour l'association manuelle)."""
    rows = (await db.execute(select(RefPays).order_by(RefPays.nom_fr))).scalars().all()
    return [{"id": p.id, "nom_fr": p.nom_fr, "code_iso3": p.code_iso3} for p in rows]


@router.get("/admin/couverture")
async def couverture(db: AsyncSession = Depends(get_db), _: dict = Depends(require_admin)):
    """Pour chaque pays ayant des données : indicateurs et plages d'années."""
    rows = (await db.execute(select(_StatPays))).scalars().all()
    noms = {p.id: (p.nom_fr, p.code_iso3) for p in (await db.execute(select(RefPays))).scalars().all()}
    agg = {}
    for r in rows:
        e = agg.setdefault(r.pays_id, {})
        s = e.setdefault(r.indicateur, {"min": r.annee, "max": r.annee, "nb": 0})
        s["min"] = min(s["min"], r.annee); s["max"] = max(s["max"], r.annee); s["nb"] += 1
    return [
        {"pays_id": pid, "pays": noms.get(pid, ("", ""))[0], "code_iso3": noms.get(pid, ("", ""))[1], "series": e}
        for pid, e in sorted(agg.items(), key=lambda x: noms.get(x[0], ("",))[0])
    ]


@router.post("/importer")
async def importer(
    indicateur: str = Form(...),
    fichiers: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    if indicateur not in _INDICATEURS_IMPORT:
        raise HTTPException(400, f"Indicateur « {indicateur} » non importable (densité et PIB/hab sont calculés automatiquement).")

    resultats, erreurs, non_resolus = {}, [], {}
    for fichier in (fichiers or []):
        contenu = await fichier.read()
        if not contenu:
            continue
        try:
            par_pays = _parse_stat_file(contenu, fichier.filename or "")
        except Exception as e:
            erreurs.append(f"{fichier.filename}: erreur de lecture — {e}")
            continue
        if not par_pays:
            erreurs.append(f"{fichier.filename}: aucune ligne valide trouvée")
            continue
        for label, lignes in par_pays.items():
            pays_obj = await _resolve_pays(db, label)
            if not pays_obj:
                non_resolus[label] = non_resolus.get(label, 0) + len(lignes)
                continue
            ins = maj = 0
            for annee, valeur in lignes:
                # Les fichiers de population sont en milliers d'habitants → stocker en habitants
                if indicateur == "population" and valeur is not None:
                    valeur = valeur * 1000
                row = (await db.execute(select(_StatPays).where(
                    _StatPays.pays_id == pays_obj.id, _StatPays.annee == annee, _StatPays.indicateur == indicateur
                ))).scalar_one_or_none()
                if row:
                    row.valeur = valeur; maj += 1
                else:
                    db.add(_StatPays(pays_id=pays_obj.id, annee=annee, indicateur=indicateur, valeur=valeur)); ins += 1
            d = resultats.setdefault(pays_obj.nom_fr, {"pays_id": pays_obj.id, "insere": 0, "mis_a_jour": 0})
            d["insere"] += ins; d["mis_a_jour"] += maj
    await db.flush()
    return {
        "pays": [{"pays": nom, "pays_id": d["pays_id"], "insere": d["insere"], "mis_a_jour": d["mis_a_jour"]} for nom, d in sorted(resultats.items())],
        "erreurs": erreurs,
        "non_resolus": [{"label": l, "nb_lignes": n} for l, n in sorted(non_resolus.items())],
    }


@router.post("/associer-pays")
async def associer_pays(payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    label = (payload.get("label") or "").strip()
    ref_id = payload.get("ref_pays_id")
    if not label or not ref_id:
        raise HTTPException(400, "label et ref_pays_id sont requis")
    p = (await db.execute(select(RefPays).where(RefPays.id == int(ref_id)))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Pays introuvable dans le référentiel")
    p.nom_cnuced = label
    await db.flush()
    return {"success": True, "nom_fr": p.nom_fr}


@router.delete("/indicateur/{code}", status_code=204)
async def vider_indicateur(code: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    """Supprime toutes les données d'un indicateur, pour tous les pays."""
    for r in (await db.execute(select(_StatPays).where(_StatPays.indicateur == code))).scalars().all():
        await db.delete(r)
    await db.flush()


@router.delete("/pays/{pays_id}", status_code=204)
async def supprimer_pays(pays_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    for r in (await db.execute(select(_StatPays).where(_StatPays.pays_id == pays_id))).scalars().all():
        await db.delete(r)
    await db.flush()
