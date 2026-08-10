"use client";

import PanneauFiltres, { carteCliquable } from "@/components/shared/PanneauFiltres";
import { CurseurPlageNace } from "@/components/shared/CurseurNace";
import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreBadge, BarreTitreSegment } from "@/components/shared/BarreTitre";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import VueTerritorialeSenegal from "@/components/shared/VueTerritorialeSenegal";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards, SkeletonChart } from "@/components/shared/Skeleton";
import { GRILLE_CARTES, MIN_CARTE } from "@/lib/grilles";
import { ArrowDownUp, ArrowUpDown, Building2, ChevronDown, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthGate } from "@/lib/authGate";
import { useGeoArbre, useNaemaArbre, useRefFormesJuridiques, useRefPolesEntreprises } from "@/lib/referentiels";
import { fetchTous } from "@/lib/fetchTous";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { fmtDate } from "@/lib/format";
import { badgePole, poleAccent } from "@/lib/couleurs";
import { SideFilter, ThematiquesCascadeFilter, LocalisationFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { useFicheUrl } from "@/lib/ficheUrl";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function DateRangeFilter({ minYear, maxYear, startYear, endYear, onChange }: {
  minYear: number; maxYear: number; startYear: number; endYear: number;
  onChange: (start: number, end: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const isFiltered = startYear > minYear || endYear < maxYear;

  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?8:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {isFiltered&&<span style={{width:6,height:6,borderRadius:"50%",background:"var(--bleu-action)",display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:isFiltered?"var(--bleu)":"var(--gris)",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Date de création</span>
        </div>
        <span style={{width:20,height:20,borderRadius:"50%",background:"var(--champ)",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {open?<ChevronUp size={11} style={{color:"var(--texte)"}}/>:<ChevronDown size={11} style={{color:"var(--texte)"}}/>}
        </span>
      </button>
      {open&&(
        <div style={{padding:"2px 4px 0"}}>
          <div style={{marginBottom:10,padding:"4px 0"}}>
            <CurseurPlageNace min={minYear} max={maxYear} debut={startYear} fin={endYear} ecartMin={1}
              onChange={(d,f)=>onChange(d,f)}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:700,color:"var(--bleu)",background:"rgb(var(--bleu-rgb) / 0.08)",padding:"2px 8px",borderRadius:6}}>{startYear}</span>
            <span style={{fontSize:10,color:"var(--gris)"}}>—</span>
            <span style={{fontSize:11,fontWeight:700,color:"var(--bleu)",background:"rgb(var(--bleu-rgb) / 0.08)",padding:"2px 8px",borderRadius:6}}>{endYear}</span>
          </div>
          {isFiltered&&<button onClick={()=>onChange(minYear,maxYear)}
            style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--danger)",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginTop:4}}>
            <X size={10}/> Réinitialiser
          </button>}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function EntreprisesPage() {
  const gate = useAuthGate();
  const [onglet,      setOnglet]      = useEtatUrl<"liste"|"territoire">("onglet", "liste", ["liste","territoire"]);
  const [triDate,     setTriDate]     = useEtatUrl<"desc"|"asc">("tri", "desc", ["desc","asc"]);
  const [tous,        setTous]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [erreur,      setErreur]      = useState(false);
  const [selec,       setSelec]       = useState<any>(null);
  useFicheUrl(tous, setSelec);   // ouverture directe depuis la recherche globale (⌘K)
  const [formeOpts,   setFormeOpts]   = useState<string[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [regions,     setRegions]     = useState<any[]>([]);
  const [poles,       setPoles]       = useState<string[]>([]);

  const [recherche,    setRecherche]    = useState("");
  const [formesSel,    setFormesSel]    = useState<string[]>([]);
  const [secteursSel,  setSecteursSel]  = useState<string[]>([]);
  const [branchesSel,  setBranchesSel]  = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);
  const [regionsSel,   setRegionsSel]   = useState<string[]>([]);
  const [deptsSel,     setDeptsSel]     = useState<string[]>([]);
  const [arrondsSel,   setArrondsSel]   = useState<string[]>([]);
  const [polesSel,     setPolesSel]     = useState<string[]>([]);
  const [dateMin,   setDateMin]   = useState(0);
  const [dateMax,   setDateMax]   = useState(0);
  const [dateStart, setDateStart] = useState(0);
  const [dateEnd,   setDateEnd]   = useState(0);
  const dateInitRef = useRef(false);

  // Référentiels servis par le cache partagé (une requête par session)
  const { data: formesData } = useRefFormesJuridiques();
  const { arbre: naemaArbre } = useNaemaArbre();
  const { arbre: geoArbre } = useGeoArbre();
  const { data: polesData } = useRefPolesEntreprises();
  useEffect(()=>{ setFormeOpts(Array.isArray(formesData)?(formesData as string[]):[]); },[formesData]);
  useEffect(()=>{ setSecteurs(naemaArbre); },[naemaArbre]);
  useEffect(()=>{ setRegions(geoArbre); },[geoArbre]);
  useEffect(()=>{ setPoles((((polesData as any[])||[])).map((p:any)=>p.nom)); },[polesData]);

  // Chargement principal : en cas d'échec, état d'erreur avec relance
  const charger = useCallback(async()=>{
    setLoading(true); setErreur(false);
    try {
      setTous(await fetchTous(`${API_BASE}/entreprises`));
    } catch(e){console.error(e); setErreur(true);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{charger();},[charger]);

  useEffect(()=>{
    if (dateInitRef.current||tous.length===0) return;
    dateInitRef.current=true;
    const years=tous.filter(e=>e.date_creation).map(e=>parseInt(e.date_creation.split("-")[0])).filter(y=>!isNaN(y));
    if (years.length===0) return;
    const mn=Math.min(...years), mx=Math.max(...years);
    setDateMin(mn); setDateMax(mx); setDateStart(mn); setDateEnd(mx);
  },[tous]);

  const isDateFiltered = dateMin<dateMax && (dateStart>dateMin||dateEnd<dateMax);

  const entreprises = useMemo(() => tous.filter(e=>{
    if (recherche){const q=recherche.toLowerCase();if(!e.nom?.toLowerCase().includes(q)&&!e.forme_juridique?.toLowerCase().includes(q)&&!e.adresse?.toLowerCase().includes(q))return false;}
    if (formesSel.length>0&&!formesSel.includes(e.forme_juridique||""))return false;
    if (secteursSel.length>0){const ids=secteursSel.map((n:string)=>secteurs.find((s:any)=>s.nom===n)?.id).filter(Boolean);if(!ids.some((id:number)=>(e.secteur_ids||[]).includes(id)))return false;}
    if (branchesSel.length>0){const ids=branchesSel.map((n:string)=>secteurs.flatMap((s:any)=>s.branches||[]).find((b:any)=>b.nom===n)?.id).filter(Boolean);if(!ids.some((id:number)=>(e.branche_ids||[]).includes(id)))return false;}
    if (activitesSel.length>0){const ids=activitesSel.map((n:string)=>secteurs.flatMap((s:any)=>s.branches||[]).flatMap((b:any)=>b.activites||[]).find((a:any)=>a.nom===n)?.id).filter(Boolean);if(!ids.some((id:number)=>(e.activite_ids||[]).includes(id)))return false;}
    if (regionsSel.length>0&&!regionsSel.includes(e.region_nom||""))return false;
    if (deptsSel.length>0&&!deptsSel.includes(e.departement_nom||""))return false;
    if (arrondsSel.length>0&&!arrondsSel.includes(e.arrondissement_nom||""))return false;
    if (polesSel.length>0&&!polesSel.includes(e.pole_territoire_nom||""))return false;
    if (isDateFiltered&&e.date_creation){const y=parseInt(e.date_creation.split("-")[0]);if(!isNaN(y)&&(y<dateStart||y>dateEnd))return false;}
    return true;
  }).sort((a,b)=>{
    // Tri par date de création — entreprises sans date en fin de liste
    const da=a.date_creation||"", db_=b.date_creation||"";
    if(!da&&!db_) return 0; if(!da) return 1; if(!db_) return -1;
    return triDate==="asc" ? da.localeCompare(db_) : db_.localeCompare(da);
  }), [tous, recherche, formesSel, secteursSel, branchesSel, activitesSel, regionsSel, deptsSel, arrondsSel, polesSel, isDateFiltered, dateStart, dateEnd, triDate, secteurs]);

  const hasFilter=!!recherche||formesSel.length>0||secteursSel.length>0||branchesSel.length>0||activitesSel.length>0||regionsSel.length>0||deptsSel.length>0||arrondsSel.length>0||polesSel.length>0||isDateFiltered;
  const reinit=()=>{setRecherche("");setFormesSel([]);setSecteursSel([]);setBranchesSel([]);setActivitesSel([]);setRegionsSel([]);setDeptsSel([]);setArrondsSel([]);setPolesSel([]);setDateStart(dateMin);setDateEnd(dateMax);};
  const nbFiltres=(recherche?1:0)+formesSel.length+secteursSel.length+branchesSel.length+activitesSel.length+regionsSel.length+deptsSel.length+arrondsSel.length+polesSel.length+(isDateFiltered?1:0);

  const toggleForme   =(v:string)=>setFormesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleSecteur =(v:string)=>{setSecteursSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setBranchesSel([]);setActivitesSel([]);};
  const toggleBranche =(v:string)=>{setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setActivitesSel([]);};
  const toggleActivite=(v:string)=>setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleRegion  =(v:string)=>{setRegionsSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setDeptsSel([]);setArrondsSel([]);};
  const toggleDept    =(v:string)=>{setDeptsSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setArrondsSel([]);};
  const toggleArr     =(v:string)=>setArrondsSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const togglePole    =(v:string)=>setPolesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);

  return (
    <main style={{ height:"100dvh", display:"flex", flexDirection:"column", overflow:"hidden",
      background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <BarreTitre titre="Entreprises formalisées" compact actions={<NavActions onDark home flouFond/>}
        droite={onglet==="liste" ? (
          <BarreTitreBadge label="Année de création" detail={triDate==="desc"?"Descendante":"Ascendante"}
            icon={triDate==="desc"?<ArrowDownUp size={13} color="var(--sur-bleu)"/>:<ArrowUpDown size={13} color="var(--sur-bleu)"/>}
            onClick={()=>setTriDate(triDate==="desc"?"asc":"desc")}/>
        ) : null}>
        <BarreTitreSegment options={[{v:"liste",l:"Liste des entreprises",count:entreprises.length},{v:"territoire",l:"Vue territoriale"}]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* Vue territoriale */}
      {onglet==="territoire" && (
        <section style={{flex:1,minHeight:0,overflowY:"auto",overscrollBehavior:"contain",
          padding:"36px 40px 80px",maxWidth:1280,margin:"0 auto",width:"100%"}}>
          {loading ? (
            <SkeletonChart height={520}/>
          ) : (
            <div className="charge-in"><VueTerritorialeSenegal zones={[]} mode="region"/></div>
          )}
        </section>
      )}

      {onglet==="liste" && <div style={{display:"flex",flex:1,minHeight:0}}>
          {/* Sidebar bande */}
          <PanneauFiltres nbFiltres={nbFiltres} aDesFiltres={hasFilter} onReinit={reinit}
            recherche={recherche} setRecherche={setRecherche}>
                <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
                <SideFilter label="Forme juridique" color="var(--bleu)" items={formeOpts} selected={formesSel} onToggle={toggleForme} listMaxHeight={180} format={v=>v.replace(/\s*\([^)]*\)\s*$/,"")}/>
                <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
                {dateMin<dateMax&&<DateRangeFilter minYear={dateMin} maxYear={dateMax} startYear={dateStart} endYear={dateEnd} onChange={(s,e)=>{setDateStart(s);setDateEnd(e);}}/>}
                <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs} secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel} onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
                <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
                <LocalisationFilter regions={regions} regionsSel={regionsSel} departementsSel={deptsSel} arrondissementsSel={arrondsSel} onRegion={toggleRegion} onDepartement={toggleDept} onArrondissement={toggleArr}/>
                {poles.length>0&&<><div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
                <SideFilter label="Pôle territoire" color="var(--bleu)" items={poles} selected={polesSel} onToggle={togglePole} listMaxHeight={180}/></>}
          </PanneauFiltres>
          {/* Grille */}
          <div style={{flex:1,minWidth:0,overflowY:"auto",overscrollBehavior:"contain",padding:"36px 40px 80px"}}>
            {loading?(
              <SkeletonCards n={6} min={MIN_CARTE} height={200}/>
            ):erreur?(
              <ErreurChargement onRetry={()=>charger()}/>
            ):entreprises.length===0?(
              <div style={{textAlign:"center",padding:"80px 24px",color:"var(--gris)"}}>
                <Building2 size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>Aucune entreprise trouvée</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<BoutonEffacerFiltres onClick={reinit}/>}
              </div>
            ):(
              <>
              <div className="charge-in" style={GRILLE_CARTES}>
                {entreprises.map(e=>{
                  // Couleur du pôle : jetons partagés du design system.
                  const accentPole = poleAccent(e.pole_territoire_nom||"");
                  return (
                  <div key={e.id} {...carteCliquable(()=>gate(()=>setSelec(e)))}
                    style={{background:"var(--carte)",border:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"none",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:13}}
                    onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=accentPole;}}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="none";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="rgb(var(--encre-rgb) / 0.12)";}}>

                    {/* Dénomination + forme juridique | badge pôle territoire */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,minWidth:0}}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontWeight:800,fontSize:15.5,color:"var(--encre)",lineHeight:1.35,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nom}</div>
                        {e.forme_juridique&&<div style={{fontSize:11,fontWeight:500,color:"var(--gris)",marginTop:3}}>{e.forme_juridique.replace(/\s*\([^)]*\)\s*$/,"")}</div>}
                      </div>
                      {e.pole_territoire_nom&&(
                        <span title={e.pole_territoire_nom} style={{...badgePole(e.pole_territoire_nom),whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",flexShrink:1,minWidth:0}}>
                          {e.pole_territoire_nom}
                        </span>
                      )}
                    </div>

                    {/* Date de création · Région en rangée épurée */}
                    <div style={{display:"flex",alignItems:"center",borderTop:"1px solid var(--bordure)",paddingTop:13,marginTop:"auto"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Date de création</p>
                        <p style={{fontSize:12.5,fontWeight:700,color:e.date_creation?"var(--encre)":"var(--gris)",fontVariantNumeric:"tabular-nums"}}>{e.date_creation?fmtDate(e.date_creation):"—"}</p>
                      </div>
                      <div style={{width:1,alignSelf:"stretch",background:"var(--fond)",margin:"0 18px"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Région</p>
                        <p style={{fontSize:12.5,fontWeight:700,color:e.region_nom?"var(--encre)":"var(--gris)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{e.region_nom||"—"}</p>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
      </div>}

      {/* Modal partagé — une seule source de vérité */}
      <EntreprisePublicModal entreprise={selec} onClose={()=>setSelec(null)}/>
    </main>
  );
}
