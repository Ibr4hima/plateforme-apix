from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.ide import IdeCnuced, IdeAnalyse, IdeKpiConfig

router = APIRouter(prefix="/ide", tags=["IDE"])


# ── Calcul de tous les KPIs ───────────────────────────────────────────────────
def calc_kpis(rows: list) -> dict:
    def serie(direction, indicateur):
        return sorted([r for r in rows if r.direction==direction and r.indicateur==indicateur], key=lambda r: r.annee)
    def val(r): return float(r.valeur) if r.valeur is not None else None
    def last_valid(s): return next((r for r in reversed(s) if r.valeur is not None), None)
    def variation(v1, v2): return round((v1-v2)/abs(v2)*100,1) if v2 and v2!=0 else None

    fe = serie("entrant","flux"); fs = serie("sortant","flux")
    se = serie("entrant","stock"); ss = serie("sortant","stock")

    lfe = last_valid(fe); lfs = last_valid(fs)
    lse = last_valid(se); lss = last_valid(ss)

    pfe = next((r for r in reversed(fe) if r.annee < lfe.annee and r.valeur is not None), None) if lfe else None
    pfs = next((r for r in reversed(fs) if r.annee < lfs.annee and r.valeur is not None), None) if lfs else None
    pse = next((r for r in reversed(se) if r.annee < lse.annee and r.valeur is not None), None) if lse else None
    pss = next((r for r in reversed(ss) if r.annee < lss.annee and r.valeur is not None), None) if lss else None

    rec_fe = max((r for r in fe if r.valeur is not None), key=lambda r: r.valeur, default=None)
    rec_fs = max((r for r in fs if r.valeur is not None), key=lambda r: r.valeur, default=None)

    fe5   = [val(r) for r in fe[-5:] if r.valeur is not None]
    moy5  = round(sum(fe5)/len(fe5),1) if fe5 else None

    fe_now = val(lfe) if lfe else None
    fe_10  = next((val(r) for r in reversed(fe) if lfe and r.annee==lfe.annee-10 and r.valeur is not None), None)
    var10  = variation(fe_now, fe_10) if fe_now and fe_10 else None

    se_first = next((r for r in se if r.valeur is not None), None)
    tcam = None
    if se_first and lse and lse.annee > se_first.annee and se_first.valeur and lse.valeur:
        n = lse.annee - se_first.annee
        tcam = round(((float(lse.valeur)/float(se_first.valeur))**(1/n)-1)*100,1)

    se_1990 = next((val(r) for r in se if r.annee==1990 and r.valeur is not None), None)
    mult = round(val(lse)/se_1990,1) if lse and se_1990 and se_1990>0 else None

    bal  = round(val(lfe)-val(lfs),1) if lfe and lfs and lfe.annee==lfs.annee else None
    pbal_fe = next((r for r in reversed(fe) if lfe and r.annee==lfe.annee-1 and r.valeur is not None), None)
    pbal_fs = next((r for r in reversed(fs) if lfs and r.annee==lfs.annee-1 and r.valeur is not None), None)
    pbal = round(val(pbal_fe)-val(pbal_fs),1) if pbal_fe and pbal_fs else None

    ratio = round(val(lse)/val(lss),1) if lse and lss and val(lss) and val(lss)>0 else None

    consec = 0
    for i in range(len(fe)-1, 0, -1):
        if fe[i].valeur is not None and fe[i-1].valeur is not None and float(fe[i].valeur)>float(fe[i-1].valeur):
            consec += 1
        else:
            break

    total = round(sum(val(r) for r in fe if r.valeur is not None), 1)

    periode_rec  = [val(r) for r in fe if 2020<=r.annee<=2024 and r.valeur is not None]
    periode_prev = [val(r) for r in fe if 2015<=r.annee<=2019 and r.valeur is not None]
    moy_rec  = sum(periode_rec)/len(periode_rec)   if periode_rec  else None
    moy_prev = sum(periode_prev)/len(periode_prev) if periode_prev else None
    acceleration = variation(moy_rec, moy_prev) if moy_rec and moy_prev else None

    return {
        "flux_entrant_dernier":        {"valeur":val(lfe),"annee":lfe.annee if lfe else None,"variation":variation(val(lfe),val(pfe)),"unite":"M$","sens":"hausse_bien"},
        "flux_entrant_record":         {"valeur":val(rec_fe),"annee":rec_fe.annee if rec_fe else None,"variation":None,"unite":"M$","sens":"info"},
        "flux_entrant_moy5":           {"valeur":moy5,"annee":None,"variation":None,"unite":"M$","sens":"info"},
        "flux_entrant_var10":          {"valeur":var10,"annee":None,"variation":None,"unite":"%","sens":"hausse_bien"},
        "stock_entrant_dernier":       {"valeur":val(lse),"annee":lse.annee if lse else None,"variation":variation(val(lse),val(pse)),"unite":"M$","sens":"hausse_bien"},
        "stock_entrant_multiplication":{"valeur":mult,"annee":None,"variation":None,"unite":"×","sens":"info"},
        "stock_entrant_tcam":          {"valeur":tcam,"annee":None,"variation":None,"unite":"%","sens":"info"},
        "flux_sortant_dernier":        {"valeur":val(lfs),"annee":lfs.annee if lfs else None,"variation":variation(val(lfs),val(pfs)),"unite":"M$","sens":"baisse_bien"},
        "flux_sortant_record":         {"valeur":val(rec_fs),"annee":rec_fs.annee if rec_fs else None,"variation":None,"unite":"M$","sens":"info"},
        "stock_sortant_dernier":       {"valeur":val(lss),"annee":lss.annee if lss else None,"variation":variation(val(lss),val(pss)),"unite":"M$","sens":"baisse_bien"},
        "balance_derniere":            {"valeur":bal,"annee":lfe.annee if lfe else None,"variation":variation(bal,pbal) if bal and pbal else None,"unite":"M$","sens":"hausse_bien"},
        "ratio_stock":                 {"valeur":ratio,"annee":None,"variation":None,"unite":"×","sens":"info"},
        "annees_hausse_consecutive":   {"valeur":consec,"annee":None,"variation":None,"unite":"ans","sens":"info"},
        "flux_entrant_total_periode":  {"valeur":total,"annee":None,"variation":None,"unite":"M$","sens":"info"},
        "flux_entrant_acceleration":   {"valeur":acceleration,"annee":None,"variation":None,"unite":"%","sens":"hausse_bien"},
    }


# ── GET /ide/cnuced — données brutes ──────────────────────────────────────────
@router.get("/cnuced")
async def get_cnuced(
    direction:  Optional[str] = Query(None),
    indicateur: Optional[str] = Query(None),
    pays:       Optional[str] = Query(None),       # un seul pays
    pays_list:  Optional[str] = Query(None),       # plusieurs pays séparés par virgule
    annee_min:  Optional[int] = Query(None),
    annee_max:  Optional[int] = Query(None),
    annees:     Optional[str] = Query(None),       # années spécifiques : "2003,2008,2020"
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import and_, or_
    q = select(IdeCnuced)

    # Filtre pays : liste ou pays unique
    if pays_list:
        noms = [p.strip() for p in pays_list.split(",") if p.strip()]
        q = q.where(IdeCnuced.pays.in_(noms))
    elif pays:
        q = q.where(IdeCnuced.pays == pays)
    else:
        q = q.where(IdeCnuced.pays == "Sénégal")

    if direction:  q = q.where(IdeCnuced.direction  == direction)
    if indicateur: q = q.where(IdeCnuced.indicateur == indicateur)

    # Filtre années : spécifiques ou plage
    if annees:
        liste_annees = [int(a.strip()) for a in annees.split(",") if a.strip().isdigit()]
        if liste_annees: q = q.where(IdeCnuced.annee.in_(liste_annees))
    else:
        if annee_min: q = q.where(IdeCnuced.annee >= annee_min)
        if annee_max: q = q.where(IdeCnuced.annee <= annee_max)

    q = q.order_by(IdeCnuced.pays, IdeCnuced.annee)
    res = await db.execute(q)
    return [{"annee":r.annee, "valeur":float(r.valeur) if r.valeur is not None else None,
             "direction":r.direction, "indicateur":r.indicateur, "pays":r.pays}
            for r in res.scalars().all()]


# ── GET /ide/cnuced/pays-disponibles ─────────────────────────────────────────
@router.get("/cnuced/pays-disponibles")
async def get_pays_disponibles(db: AsyncSession = Depends(get_db)):
    """Retourne les pays qui ont des données IDE, avec leur code ISO"""
    from sqlalchemy import distinct
    from app.models.shared import RefPays
    res = await db.execute(select(distinct(IdeCnuced.pays)).order_by(IdeCnuced.pays))
    noms = [r[0] for r in res.fetchall()]
    # Enrichir avec les infos de ref_pays (code_iso2 pour le drapeau)
    result = []
    for nom in noms:
        rp = await db.execute(
            select(RefPays).where(
                (RefPays.nom_fr == nom) | (RefPays.nom_cnuced == nom)
            ).limit(1)
        )
        pays_obj = rp.scalar_one_or_none()
        result.append({
            "nom": nom,
            "code_iso2": pays_obj.code_iso2 if pays_obj else None,
            "code_iso3": pays_obj.code_iso3 if pays_obj else None,
        })
    return result


# ── GET /ide/cnuced/kpis-calcules ─────────────────────────────────────────────
@router.get("/cnuced/kpis-calcules")
async def get_kpis_calcules(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(IdeCnuced).where(IdeCnuced.pays=="Sénégal").order_by(IdeCnuced.annee))
    return calc_kpis(list(res.scalars().all()))


# ── GET /ide/kpis-config ──────────────────────────────────────────────────────
@router.get("/kpis-config")
async def get_kpis_config(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(IdeKpiConfig).order_by(IdeKpiConfig.ordre))
    return [{"id":k.id,"code":k.code,"label":k.label,"description":k.description,"est_actif":k.est_actif,"ordre":k.ordre}
            for k in res.scalars().all()]


# ── GET /ide/kpis-config/actifs ───────────────────────────────────────────────
@router.get("/kpis-config/actifs")
async def get_kpis_actifs(db: AsyncSession = Depends(get_db)):
    res_conf = await db.execute(select(IdeKpiConfig).where(IdeKpiConfig.est_actif==True).order_by(IdeKpiConfig.ordre))
    configs  = res_conf.scalars().all()
    if not configs: return []
    if len(configs) > 4: configs = configs[:4]
    res_data = await db.execute(select(IdeCnuced).where(IdeCnuced.pays=="Sénégal").order_by(IdeCnuced.annee))
    kpis     = calc_kpis(list(res_data.scalars().all()))
    return [{"code":k.code,"label":k.label,"ordre":k.ordre,**kpis.get(k.code,{})} for k in configs]


# ── PATCH /ide/kpis-config/:id ────────────────────────────────────────────────
@router.patch("/kpis-config/{kpi_id}")
async def modifier_kpi_config(kpi_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    res = await db.execute(select(IdeKpiConfig).where(IdeKpiConfig.id==kpi_id))
    k   = res.scalar_one_or_none()
    if not k: raise HTTPException(404, "KPI introuvable")
    if "est_actif" in payload: k.est_actif = payload["est_actif"]
    if "ordre"     in payload: k.ordre     = int(payload["ordre"])
    await db.flush()
    return {"id":k.id,"code":k.code,"label":k.label,"est_actif":k.est_actif,"ordre":k.ordre}


# ── GET /ide/analyses ─────────────────────────────────────────────────────────
@router.get("/analyses")
async def liste_analyses(
    source: Optional[str]  = Query(None),
    publie: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(IdeAnalyse)
    if source: q = q.where(IdeAnalyse.source == source)
    if publie is not None: q = q.where(IdeAnalyse.est_publie == publie)
    q = q.order_by(IdeAnalyse.ordre, IdeAnalyse.created_at.desc())
    res = await db.execute(q)
    return [analyse_to_dict(a) for a in res.scalars().all()]


def analyse_to_dict(a: IdeAnalyse) -> dict:
    return {"id":a.id,"source":a.source,"titre":a.titre,"commentaire":a.commentaire,
            "direction":a.direction,"indicateur":a.indicateur,"annee_debut":a.annee_debut,
            "annee_fin":a.annee_fin,"est_publie":a.est_publie,"ordre":a.ordre,
            "created_at":a.created_at.isoformat() if a.created_at else None}


# ── POST /ide/analyses ────────────────────────────────────────────────────────
@router.post("/analyses", status_code=201)
async def creer_analyse(payload: dict, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    if not payload.get("titre") or not payload.get("commentaire"):
        raise HTTPException(422, "Titre et commentaire obligatoires")
    a = IdeAnalyse(
        source      = payload.get("source","cnuced"),
        titre       = payload["titre"],
        commentaire = payload["commentaire"],
        direction   = payload.get("direction") or None,
        indicateur  = payload.get("indicateur") or None,
        annee_debut = int(payload["annee_debut"]) if payload.get("annee_debut") else None,
        annee_fin   = int(payload["annee_fin"])   if payload.get("annee_fin")   else None,
        ordre       = int(payload.get("ordre",0)),
    )
    db.add(a); await db.flush()
    return analyse_to_dict(a)


# ── PATCH /ide/analyses/:id ───────────────────────────────────────────────────
@router.patch("/analyses/{analyse_id}")
async def modifier_analyse(analyse_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    res = await db.execute(select(IdeAnalyse).where(IdeAnalyse.id==analyse_id))
    a   = res.scalar_one_or_none()
    if not a: raise HTTPException(404, "Analyse introuvable")
    for f in ["titre","commentaire","direction","indicateur","source"]:
        if f in payload: setattr(a, f, payload[f] or None)
    for f in ["annee_debut","annee_fin"]:
        if f in payload: setattr(a, f, int(payload[f]) if payload[f] else None)
    if "ordre"     in payload: a.ordre     = int(payload.get("ordre",0))
    if "est_publie" in payload: a.est_publie = payload["est_publie"]
    await db.flush()
    return analyse_to_dict(a)


# ── DELETE /ide/analyses/:id ──────────────────────────────────────────────────
@router.delete("/analyses/{analyse_id}", status_code=204)
async def supprimer_analyse(analyse_id: int, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    res = await db.execute(select(IdeAnalyse).where(IdeAnalyse.id==analyse_id))
    a   = res.scalar_one_or_none()
    if not a: raise HTTPException(404, "Analyse introuvable")
    await db.delete(a); await db.flush()


# ── GET /ide/pays-ref ─────────────────────────────────────────────────────────
@router.get("/pays-ref")
async def get_pays_ref(db: AsyncSession = Depends(get_db)):
    from app.models.shared import RefPays
    res = await db.execute(
        select(RefPays).where(RefPays.actif == True).order_by(RefPays.nom_fr)
    )
    return [
        {
            "id": p.id,
            "nom_fr": p.nom_fr,
            "nom_cnuced": p.nom_cnuced,
            "code_iso2": p.code_iso2,
            "continent": p.continent,
            "region_geo": p.region_geo,
            "niveau_revenu": p.niveau_revenu,
        }
        for p in res.scalars().all()
    ]


# ── POST /ide/upload ──────────────────────────────────────────────────────────
@router.post("/upload")
async def upload_ide(
    ref_pays_id: int = None,
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException
    raise HTTPException(400, "Utiliser le formulaire multipart")


@router.post("/upload/fichiers", status_code=200)
async def upload_ide_fichiers(
    ref_pays_id:    int                         = None,
    flux_entrant:   Optional[bytes]             = None,
    flux_sortant:   Optional[bytes]             = None,
    stock_entrant:  Optional[bytes]             = None,
    stock_sortant:  Optional[bytes]             = None,
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException, UploadFile, Form, File
    raise HTTPException(400, "Utiliser la route multipart correcte")


@router.post("/upload/multipart", status_code=200)
async def upload_ide_multipart(
    db: AsyncSession = Depends(get_db),
    **kwargs
):
    from fastapi import HTTPException
    raise HTTPException(400, "Utiliser /ide/upload-pays")


@router.post("/upload-pays", status_code=200)
async def upload_pays_ide(
    ref_pays_id:   int                                                     = None,
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException, UploadFile, Form, File
    raise HTTPException(400, "Envoyer les fichiers via multipart")


# Route upload réelle avec fichiers
from fastapi import UploadFile, File, Form
import io

@router.post("/importer", status_code=200)
async def importer_ide(
    ref_pays_id:  int         = Form(...),
    flux_entrant:  UploadFile = File(None),
    flux_sortant:  UploadFile = File(None),
    stock_entrant: UploadFile = File(None),
    stock_sortant: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException
    from app.models.shared import RefPays
    import openpyxl

    # Vérifier que le pays existe
    res = await db.execute(select(RefPays).where(RefPays.id == ref_pays_id))
    pays_obj = res.scalar_one_or_none()
    if not pays_obj:
        raise HTTPException(404, "Pays introuvable dans ref_pays")

    nom_pays = pays_obj.nom_fr

    fichiers = {
        ("entrant", "flux"):  flux_entrant,
        ("sortant", "flux"):  flux_sortant,
        ("entrant", "stock"): stock_entrant,
        ("sortant", "stock"): stock_sortant,
    }

    total_insere = 0
    total_mis_a_jour = 0

    for (direction, indicateur), fichier in fichiers.items():
        if fichier is None:
            continue
        contenu = await fichier.read()
        if not contenu:
            continue

        try:
            wb = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True)
            ws = wb.active
        except Exception as e:
            raise HTTPException(400, f"Erreur lecture fichier {direction}/{indicateur}: {e}")

        # Parser le fichier CNUCED — format attendu :
        # Ligne d'en-tête avec des années en colonnes (ex: 1990, 1991, ..., 2023)
        # Ligne(s) de données avec les valeurs
        annees_cols: list[tuple[int, int]] = []  # (annee, col_index)
        for row in ws.iter_rows():
            # Chercher la ligne d'en-tête contenant des années
            for cell in row:
                try:
                    val = int(str(cell.value).strip()) if cell.value is not None else None
                    if val and 1970 <= val <= 2050:
                        annees_cols.append((val, cell.column))
                except:
                    pass
            if annees_cols:
                break

        if not annees_cols:
            continue

        # Lire les valeurs — prendre la première ligne après l'en-tête qui a des données numériques
        data_row = None
        header_row = None
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            cols_as_years = sum(1 for c in row if c is not None and str(c).strip().isdigit() and 1970 <= int(str(c).strip()) <= 2050)
            if cols_as_years >= 5:
                header_row = i
                data_row_idx = i + 1
                break

        if header_row is None:
            continue

        # Trouver la ligne de données
        rows = list(ws.iter_rows(values_only=True))
        if data_row_idx >= len(rows):
            continue
        data_row = rows[data_row_idx]

        header = rows[header_row]

        for col_idx, h_val in enumerate(header):
            try:
                annee = int(str(h_val).strip()) if h_val is not None else None
                if not annee or not (1970 <= annee <= 2050):
                    continue
                cell_val = data_row[col_idx] if col_idx < len(data_row) else None
                if cell_val is None or str(cell_val).strip() in ("", "...", "—", "-"):
                    valeur = None
                else:
                    valeur = float(str(cell_val).replace(",", ".").replace(" ", ""))
            except:
                continue

            # Upsert
            existing = await db.execute(
                select(IdeCnuced).where(
                    IdeCnuced.ref_pays_id == ref_pays_id,
                    IdeCnuced.annee == annee,
                    IdeCnuced.direction == direction,
                    IdeCnuced.indicateur == indicateur,
                )
            )
            row_obj = existing.scalar_one_or_none()
            if row_obj:
                row_obj.valeur = valeur
                row_obj.pays = nom_pays
                total_mis_a_jour += 1
            else:
                db.add(IdeCnuced(
                    pays=nom_pays,
                    annee=annee,
                    direction=direction,
                    indicateur=indicateur,
                    valeur=valeur,
                    source="CNUCED",
                    ref_pays_id=ref_pays_id,
                ))
                total_insere += 1

    await db.flush()
    return {
        "success": True,
        "pays": nom_pays,
        "insere": total_insere,
        "mis_a_jour": total_mis_a_jour,
    }


# ── GET /ide/cnuced/stats ─────────────────────────────────────────────────────
@router.get("/cnuced/stats")
async def get_cnuced_stats(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func as sqlfunc, text
    from app.models.shared import RefPays

    res = await db.execute(
        select(
            IdeCnuced.ref_pays_id,
            IdeCnuced.pays,
            IdeCnuced.direction,
            IdeCnuced.indicateur,
            sqlfunc.min(IdeCnuced.annee).label("annee_min"),
            sqlfunc.max(IdeCnuced.annee).label("annee_max"),
            sqlfunc.count(IdeCnuced.id).label("nb"),
        )
        .where(IdeCnuced.ref_pays_id != None)
        .group_by(IdeCnuced.ref_pays_id, IdeCnuced.pays, IdeCnuced.direction, IdeCnuced.indicateur)
        .order_by(IdeCnuced.pays)
    )
    rows = res.fetchall()

    # Regrouper par pays
    pays_dict: dict = {}
    for row in rows:
        rpid = row.ref_pays_id
        if rpid not in pays_dict:
            pays_dict[rpid] = {
                "ref_pays_id": rpid,
                "pays": row.pays,
                "series": {},
            }
        key = f"{row.direction}_{row.indicateur}"
        pays_dict[rpid]["series"][key] = {
            "annee_min": row.annee_min,
            "annee_max": row.annee_max,
            "nb": row.nb,
        }

    # Enrichir avec code_iso2
    result = []
    for rpid, data in pays_dict.items():
        rp = await db.execute(select(RefPays).where(RefPays.id == rpid))
        pays_obj = rp.scalar_one_or_none()
        result.append({
            "ref_pays_id": rpid,
            "pays": data["pays"],
            "code_iso2": pays_obj.code_iso2 if pays_obj else None,
            "series": data["series"],
        })

    result.sort(key=lambda x: x["pays"])
    return result


# ── DELETE /ide/cnuced/pays/:ref_pays_id ─────────────────────────────────────
@router.delete("/cnuced/pays/{ref_pays_id}", status_code=200)
async def supprimer_pays_ide(ref_pays_id: int, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    from sqlalchemy import delete as sqldel
    res = await db.execute(
        select(IdeCnuced).where(IdeCnuced.ref_pays_id == ref_pays_id).limit(1)
    )
    if not res.scalar_one_or_none():
        raise HTTPException(404, "Aucune donnée IDE pour ce pays")
    result = await db.execute(
        sqldel(IdeCnuced).where(IdeCnuced.ref_pays_id == ref_pays_id)
    )
    await db.flush()
    return {"success": True, "supprime": result.rowcount}
