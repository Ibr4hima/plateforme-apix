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
