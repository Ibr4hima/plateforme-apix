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
            vals["pib_hab"] = round(pib / pop, 1)  # pib en USD bruts
        im, ex = vals.get("importations_marchandises"), vals.get("exportations_marchandises")
        if im is not None and ex is not None:
            vals["balance_marchandises"] = round(ex - im, 1)
        ims, exs = vals.get("importations_services"), vals.get("exportations_services")
        if ims is not None and exs is not None:
            vals["balance_services"] = round(exs - ims, 1)


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
    # Superficie : constante par pays (stockée à l'année sentinelle) → on la
    # propage à toutes les années réelles du pays pour densité/KPI/graphes.
    superf = {}
    for r in rows:
        if r.indicateur == "superficie" and r.valeur is not None:
            superf[r.pays_id] = float(r.valeur)  # une seule valeur par pays
    par = {}
    for r in rows:
        if r.indicateur == "superficie":
            continue
        par.setdefault((r.pays_id, r.annee), {})[r.indicateur] = float(r.valeur) if r.valeur is not None else None
    for (pid, annee), vals in par.items():
        if pid in superf:
            vals["superficie"] = superf[pid]
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
_INDICATEURS_IMPORT = {
    "population", "superficie", "pib", "croissance_pib",
    "importations_marchandises", "exportations_marchandises",
    "importations_services", "exportations_services",
}
# Indicateurs exprimés en millions de USD dans les fichiers → stockés en USD (×1e6)
_MILLIONS_USD = {
    "pib", "importations_marchandises", "exportations_marchandises",
    "importations_services", "exportations_services",
}


def _lire_tableur(contenu: bytes, nom_fichier: str):
    ext = (nom_fichier or "").lower().rsplit(".", 1)[-1]
    if ext in ("xlsx", "xls"):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True)
        return list(wb.active.iter_rows(values_only=True))
    texte = contenu.decode("utf-8-sig", errors="replace")
    sep = "," if texte[:2048].count(",") >= texte[:2048].count(";") else ";"
    return list(csv.reader(io.StringIO(texte), delimiter=sep))


def _detecter_colonnes(header):
    """Repère les colonnes Pays / Année / Valeur depuis l'en-tête (ordre libre).
    Repli positionnel : Pays=0, Année=1, Valeur=2 si l'en-tête n'est pas reconnu."""
    hs = [str(c or "").strip().lower() for c in header]

    def trouver(mots):
        for i, h in enumerate(hs):
            if any(m in h for m in mots):
                return i
        return None

    pays = trouver(["pays", "country", "economy", "économie", "economie", "nom"])
    annee = trouver(["année", "annee", "year"])
    id_col = trouver(["id"])
    val = None
    for i in range(len(hs)):
        if i not in (pays, annee, id_col):
            val = i
            break
    if pays is None or annee is None or val is None:
        return 0, 1, 2
    return pays, annee, val


def _num(raw: str):
    if raw in ("", "...", "—", "-", "n.d.", "N/A", "None"):
        return None
    return float(raw.replace(" ", "").replace("\xa0", "").replace(",", "."))


def _parse_stat_file(contenu: bytes, nom_fichier: str):
    """Retourne {pays_label: [(annee, valeur), ...]} — colonnes détectées par
    en-tête (Pays / Année / Valeur dans n'importe quel ordre), multi-pays."""
    data = _lire_tableur(contenu, nom_fichier)
    if not data:
        return {}
    ci_pays, ci_annee, ci_val = _detecter_colonnes(data[0])
    SKIP = {"economy_label", "economy", "économie", "pays", "country", "nom", "libelle"}
    result = {}
    for row in data[1:]:
        try:
            label = str(row[ci_pays]).strip() if len(row) > ci_pays and row[ci_pays] else ""
            if not label or label.lower() in SKIP:
                continue
            annee = int(float(str(row[ci_annee]).strip()))
            if not (1900 <= annee <= 2100):
                continue
            raw = str(row[ci_val]).strip() if len(row) > ci_val else ""
            valeur = _num(raw)
            result.setdefault(label, []).append((annee, valeur))
        except (ValueError, IndexError):
            continue
    return result


# La superficie n'a pas d'année (colonnes : ID, Pays, Superficie) → année sentinelle.
ANNEE_SUPERFICIE = 0


def _parse_superficie_file(contenu: bytes, nom_fichier: str):
    """Retourne {pays_label: [(0, superficie)]} depuis un fichier ID / Pays / Superficie."""
    ext = (nom_fichier or "").lower().rsplit(".", 1)[-1]
    if ext in ("xlsx", "xls"):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True)
        data = list(wb.active.iter_rows(values_only=True))
    else:
        texte = contenu.decode("utf-8-sig", errors="replace")
        sep = "," if texte[:2048].count(",") >= texte[:2048].count(";") else ";"
        data = list(csv.reader(io.StringIO(texte), delimiter=sep))
    SKIP = {"pays", "country", "nom", "libelle", "economy_label"}
    result = {}
    for row in data[1:] if data else []:
        try:
            label = str(row[1]).strip() if len(row) > 1 and row[1] else ""
            if not label or label.lower() in SKIP:
                continue
            raw = str(row[2]).strip() if len(row) > 2 else ""
            valeur = None if raw in ("", "...", "—", "-", "n.d.", "N/A", "None") else float(
                raw.replace(" ", "").replace(",", ".").replace(" ", "")
            )
            result.setdefault(label, []).append((ANNEE_SUPERFICIE, valeur))
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
            par_pays = (_parse_superficie_file if indicateur == "superficie" else _parse_stat_file)(contenu, fichier.filename or "")
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
                if valeur is not None:
                    if indicateur == "population":
                        valeur = valeur * 1000            # milliers d'habitants → habitants
                    elif indicateur in _MILLIONS_USD:
                        valeur = valeur * 1_000_000        # millions USD → USD
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


# ══════════════════════════════════════════════════════════════════════════════
# DONNÉES TRANSACTIONNELLES (resourcetrade.earth) — commerce bilatéral par ressource
# Colonnes du fichier Excel : Exporter ISO3, Importer ISO3, Resource, Year,
# Value (1000USD). Pays résolus par code ISO3 (secours : nom). Valeur ×1000 (le
# fichier est en milliers de USD). Libellés de ressources éditables.
# ══════════════════════════════════════════════════════════════════════════════
from app.models.shared import StatRessource, StatTransaction
from sqlalchemy import delete as _delete, func as _sqlfunc
from sqlalchemy.dialects.postgresql import insert as _pg_insert


async def _cache_pays(db: AsyncSession):
    rows = (await db.execute(select(RefPays))).scalars().all()
    by_code, by_name = {}, {}
    for p in rows:
        if p.code_iso3:
            by_code[p.code_iso3.upper()] = p.id
        if p.nom_fr:
            by_name[_norm(p.nom_fr)] = p.id
        if p.nom_cnuced:
            by_name[_norm(p.nom_cnuced)] = p.id
    return by_code, by_name


def _colonnes_tx(header):
    """Repère les colonnes du fichier resourcetrade (en-têtes anglais)."""
    hs = [str(c or "").strip().lower() for c in header]

    def trouver(*mots, exact=None):
        if exact is not None:
            for i, h in enumerate(hs):
                if h == exact:
                    return i
        for i, h in enumerate(hs):
            if all(m in h for m in mots):
                return i
        return None

    return {
        "exp_code": trouver("exporter", "iso"),
        "imp_code": trouver("importer", "iso"),
        "exp_nom": trouver(exact="exporter"),
        "imp_nom": trouver(exact="importer"),
        "ressource": trouver("resource") if trouver("resource") is not None else trouver("produit"),
        "annee": trouver("year") if trouver("year") is not None else trouver("année"),
        "valeur": trouver("value"),
    }


@router.post("/transactions/importer")
async def importer_transactions(
    fichiers: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Importe un fichier Excel/CSV de transactions bilatérales par ressource.
    Réimporter une année remplace ses données."""
    import openpyxl
    by_code, by_name = await _cache_pays(db)
    crees: dict[str, str] = {}   # nom → code, partenaires créés automatiquement
    ressources: set[str] = set()
    annees_vues: set[int] = set()
    total = 0
    BATCH = 4000

    async def _resoudre_ou_creer(code: str, nom: str):
        """Résout un acteur (code ISO3 puis nom) ; s'il est absent, le crée pour
        ne perdre aucune donnée. Retourne son id, ou None si ni code ni nom."""
        code = (code or "").strip().upper()
        nom = (nom or "").strip()
        if code and code in by_code:
            return by_code[code]
        n = _norm(nom)
        if n and n in by_name:
            return by_name[n]
        if not code and not nom:
            return None
        # Création : code ISO3 s'il est libre et alphabétique, sinon sans code
        code_ok = code if (2 <= len(code) <= 3 and code.isalpha() and code not in by_code) else None
        p = RefPays(code_iso3=code_ok, nom_fr=nom or code, actif=False, origine="transaction")
        db.add(p)
        await db.flush()
        if code_ok:
            by_code[code_ok] = p.id
        if n:
            by_name[n] = p.id
        crees[nom or code] = code_ok or ""
        return p.id

    for fichier in (fichiers or []):
        contenu = await fichier.read()
        if not contenu:
            continue
        ext = (fichier.filename or "").lower().rsplit(".", 1)[-1]
        if ext in ("xlsx", "xls"):
            wb = openpyxl.load_workbook(io.BytesIO(contenu), read_only=True, data_only=True)
            it = wb.active.iter_rows(values_only=True)
        else:
            texte = contenu.decode("utf-8-sig", errors="replace")
            sep = "," if texte[:2048].count(",") >= texte[:2048].count(";") else ";"
            it = iter(csv.reader(io.StringIO(texte), delimiter=sep))

        try:
            header = next(it)
        except StopIteration:
            continue
        c = _colonnes_tx(header)
        if c["exp_code"] is None or c["imp_code"] is None or c["valeur"] is None or c["annee"] is None:
            raise HTTPException(400, "Colonnes attendues introuvables (Exporter ISO3, Importer ISO3, Resource, Year, Value).")

        annees_purgees: set[int] = set()
        batch: list[dict] = []

        def g(row, key):
            i = c[key]
            return row[i] if i is not None and i < len(row) else None

        for row in it:
            try:
                annee = int(float(str(g(row, "annee")).strip()))
                if not (1900 <= annee <= 2100):
                    continue
                if annee not in annees_purgees:
                    await db.execute(_delete(StatTransaction).where(StatTransaction.annee == annee))
                    annees_purgees.add(annee); annees_vues.add(annee)

                eid = await _resoudre_ou_creer(str(g(row, "exp_code") or ""), str(g(row, "exp_nom") or ""))
                iid = await _resoudre_ou_creer(str(g(row, "imp_code") or ""), str(g(row, "imp_nom") or ""))
                if eid is None or iid is None:
                    continue

                ress = str(g(row, "ressource") or "").strip()
                if ress:
                    ressources.add(ress)
                val = _num(str(g(row, "valeur") or ""))
                if val is not None:
                    val = val * 1000  # milliers USD → USD

                batch.append({"annee": annee, "exportateur_id": eid, "importateur_id": iid,
                              "ressource": ress or None, "valeur": val})
                total += 1
                if len(batch) >= BATCH:
                    await db.execute(_pg_insert(StatTransaction.__table__), batch); batch = []
            except (ValueError, TypeError):
                continue
        if batch:
            await db.execute(_pg_insert(StatTransaction.__table__), batch)

    if ressources:
        await db.execute(
            _pg_insert(StatRessource.__table__).values([{"nom_en": r, "libelle": r} for r in ressources])
            .on_conflict_do_nothing(index_elements=["nom_en"])
        )
    await db.flush()
    return {
        "lignes": total,
        "annees": sorted(annees_vues),
        "ressources_vues": len(ressources),
        "partenaires_crees": [{"nom": nom, "code": c} for nom, c in sorted(crees.items())],
    }


@router.get("/transactions/couverture")
async def couverture_transactions(db: AsyncSession = Depends(get_db), _: dict = Depends(require_admin)):
    rows = (await db.execute(
        select(StatTransaction.annee, _sqlfunc.count()).group_by(StatTransaction.annee).order_by(StatTransaction.annee)
    )).all()
    return [{"annee": a, "nb_lignes": n} for a, n in rows]


@router.delete("/transactions/{annee}", status_code=204)
async def supprimer_annee_transactions(annee: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    await db.execute(_delete(StatTransaction).where(StatTransaction.annee == annee))
    await db.flush()


@router.get("/ressources")
async def liste_ressources(db: AsyncSession = Depends(get_db), _: dict = Depends(require_admin)):
    rows = (await db.execute(select(StatRessource).order_by(StatRessource.nom_en))).scalars().all()
    return [{"nom_en": r.nom_en, "libelle": r.libelle} for r in rows]


@router.patch("/ressources/{nom_en:path}")
async def modifier_ressource(nom_en: str, payload: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(require_admin)):
    r = (await db.execute(select(StatRessource).where(StatRessource.nom_en == nom_en))).scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Ressource introuvable")
    if "libelle" in payload:
        r.libelle = (payload["libelle"] or "").strip() or r.nom_en
    await db.flush()
    return {"nom_en": r.nom_en, "libelle": r.libelle}
