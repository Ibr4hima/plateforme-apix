"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreBadge, BarreTitreSegment } from "@/components/shared/BarreTitre";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import VueTerritorialeSenegal from "@/components/shared/VueTerritorialeSenegal";
import Badge from "@/components/shared/Badge";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards, SkeletonChart } from "@/components/shared/Skeleton";
import { ArrowDownUp, ArrowUpDown, Building2, ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthGate } from "@/lib/authGate";
import { useGeoArbre, useNaemaArbre, useRefFormesJuridiques, useRefPolesEntreprises } from "@/lib/referentiels";
import { fetchTous } from "@/lib/fetchTous";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { fmtDate } from "@/lib/format";
import { badgePole, poleAccent } from "@/lib/couleurs";
import { demarrerRedimension } from "@/lib/redimension";
import { SideFilter, ThematiquesCascadeFilter, LocalisationFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { useFicheUrl } from "@/lib/ficheUrl";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function DateRangeFilter({ minYear, maxYear, startYear, endYear, onChange }: {
  minYear: number; maxYear: number; startYear: number; endYear: number;
  onChange: (start: number, end: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const isFiltered = startYear > minYear || endYear < maxYear;
  const range      = maxYear - minYear || 1;
  const leftPct    = ((startYear - minYear) / range) * 100;
  const rightPct   = ((endYear   - minYear) / range) * 100;

  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?8:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {isFiltered&&<span style={{width:6,height:6,borderRadius:"50%",background:"#004f91",display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:isFiltered?"#004f91":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Date de création</span>
        </div>
        <span style={{width:20,height:20,borderRadius:"50%",background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {open?<ChevronUp size={11} style={{color:"#4a5568"}}/>:<ChevronDown size={11} style={{color:"#4a5568"}}/>}
        </span>
      </button>
      {open&&(
        <div style={{padding:"2px 4px 0"}}>
          <div style={{position:"relative" as const,height:24,marginBottom:10}}>
            <div style={{position:"absolute" as const,top:"50%",left:0,right:0,height:4,background:"#E8E5E3",borderRadius:2,transform:"translateY(-50%)"}}/>
            <div style={{position:"absolute" as const,top:"50%",left:`${leftPct}%`,width:`${Math.max(0,rightPct-leftPct)}%`,height:4,background:"#004f91",borderRadius:2,transform:"translateY(-50%)"}}/>
            <input type="range" min={minYear} max={maxYear} value={startYear}
              onChange={ev=>onChange(Math.min(Number(ev.target.value),endYear-1),endYear)}
              className="drs-thumb"
              style={{zIndex:startYear>=endYear-1?4:2} as React.CSSProperties}/>
            <input type="range" min={minYear} max={maxYear} value={endYear}
              onChange={ev=>onChange(startYear,Math.max(Number(ev.target.value),startYear+1))}
              className="drs-thumb"
              style={{zIndex:3} as React.CSSProperties}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.08)",padding:"2px 8px",borderRadius:6}}>{startYear}</span>
            <span style={{fontSize:10,color:"#9aa5b4"}}>—</span>
            <span style={{fontSize:11,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.08)",padding:"2px 8px",borderRadius:6}}>{endYear}</span>
          </div>
          {isFiltered&&<button onClick={()=>onChange(minYear,maxYear)}
            style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginTop:4}}>
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
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 520);
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
    <main style={{minHeight:"100vh",background:"#F6F5F3",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.drs-thumb{-webkit-appearance:none;appearance:none;background:transparent;height:24px;margin:0;padding:0;position:absolute;top:0;left:0;width:100%;pointer-events:none}
.drs-thumb::-webkit-slider-runnable-track{background:transparent;height:4px}
.drs-thumb::-moz-range-track{background:transparent;height:4px}
.drs-thumb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all;margin-top:-6px}
.drs-thumb::-moz-range-thumb{background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all}`}</style>
      <Navbar/>
      <BarreTitre titre="Entreprises formalisées"
        droite={onglet==="liste" ? (
          <BarreTitreBadge label="Année de création" detail={triDate==="desc"?"Descendante":"Ascendante"}
            icon={triDate==="desc"?<ArrowDownUp size={13} color="#fff"/>:<ArrowUpDown size={13} color="#fff"/>}
            onClick={()=>setTriDate(triDate==="desc"?"asc":"desc")}/>
        ) : null}>
        <BarreTitreSegment options={[{v:"liste",l:"Liste des entreprises"},{v:"territoire",l:"Vue territoriale"}]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* Vue territoriale */}
      {onglet==="territoire" && (
        <section style={{padding:"36px 40px 80px",maxWidth:1280,margin:"0 auto"}}>
          {loading ? (
            <SkeletonChart height={520}/>
          ) : (
            <div className="charge-in"><VueTerritorialeSenegal zones={[]} mode="region"/></div>
          )}
        </section>
      )}

      {onglet==="liste" && <div style={{display:"flex",alignItems:"flex-start"}}>
          {/* Sidebar bande */}
          <aside style={{width:sidebarOpen?sidebarWidth:52,flexShrink:0,transition:isResizing.current?"none":"width 0.25s",background:"#fff",borderRight:"1px solid #E8E5E3",height:"calc(100vh - 64px)",overflowY:"auto" as const,position:"sticky" as const,top:64,display:"flex",flexDirection:"column" as const}}>
            <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
            {sidebarOpen&&<div onMouseDown={startResize} style={{position:"absolute" as const,right:0,top:0,bottom:0,width:4,cursor:"col-resize",zIndex:10,background:"transparent",transition:"background 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
            <div style={{padding:sidebarOpen?"14px 16px 10px":"12px 8px",borderBottom:"1px solid #F2F0EF",display:"flex",alignItems:"center",justifyContent:sidebarOpen?"space-between":"center",flexShrink:0}}>
              {sidebarOpen&&<span style={{fontSize:12,fontWeight:700,color:"#1a1a2e",letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Filtres</span>}
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <button onClick={()=>setSidebarOpen(o=>!o)} aria-label={sidebarOpen?"Réduire les filtres":"Afficher les filtres"} style={{background:"rgba(0,79,145,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
                  <SlidersHorizontal size={14} style={{color:"#004f91"}}/>
                  {sidebarOpen&&nbFiltres>0&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.15)",borderRadius:999,padding:"1px 5px"}}>{nbFiltres}</span>}
                </button>
                {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser"
                  style={{background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.20)",cursor:"pointer",borderRadius:999,padding:"5px",display:"flex",alignItems:"center",transition:"background 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
                  <span className="material-symbols-outlined" style={{fontSize:15,color:"#dc2626",fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",lineHeight:1}}>close</span>
                </button>}
              </div>
            </div>
            {sidebarOpen&&<div style={{padding:"16px",overflowY:"auto" as const,flex:1}}>
                <div style={{position:"relative" as const,marginBottom:18}}>
                  <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                  <input value={recherche} onChange={e=>setRecherche(e.target.value)} placeholder="Rechercher…"
                    style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                  {recherche&&<button onClick={()=>setRecherche("")} aria-label="Effacer la recherche" style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                </div>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <SideFilter label="Forme juridique" color="#004f91" items={formeOpts} selected={formesSel} onToggle={toggleForme} listMaxHeight={180} format={v=>v.replace(/\s*\([^)]*\)\s*$/,"")}/>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                {dateMin<dateMax&&<DateRangeFilter minYear={dateMin} maxYear={dateMax} startYear={dateStart} endYear={dateEnd} onChange={(s,e)=>{setDateStart(s);setDateEnd(e);}}/>}
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs} secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel} onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <LocalisationFilter regions={regions} regionsSel={regionsSel} departementsSel={deptsSel} arrondissementsSel={arrondsSel} onRegion={toggleRegion} onDepartement={toggleDept} onArrondissement={toggleArr}/>
                {poles.length>0&&<><div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <SideFilter label="Pôle territoire" color="#004f91" items={poles} selected={polesSel} onToggle={togglePole} listMaxHeight={180}/></>}
            </div>}
          </aside>
          {/* Grille */}
          <div style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>
            {loading?(
              <SkeletonCards n={6} cols={2} height={200}/>
            ):erreur?(
              <ErreurChargement onRetry={()=>charger()}/>
            ):entreprises.length===0?(
              <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                <Building2 size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucune entreprise trouvée</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<BoutonEffacerFiltres onClick={reinit}/>}
              </div>
            ):(
              <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:14}}>
                {entreprises.map(e=>{
                  // Couleur du pôle : jetons partagés du design system.
                  const accentPole = poleAccent(e.pole_territoire_nom||"");
                  return (
                  <div key={e.id} onClick={()=>gate(()=>setSelec(e))}
                    style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:16,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 2px rgba(0,0,0,0.03)",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:13}}
                    onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 14px 32px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=accentPole;}}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";}}>

                    {/* Dénomination + forme juridique | badge pôle territoire */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,minWidth:0}}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontWeight:800,fontSize:15.5,color:"#1a1a2e",lineHeight:1.35,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nom}</div>
                        {e.forme_juridique&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginTop:3}}>{e.forme_juridique.replace(/\s*\([^)]*\)\s*$/,"")}</div>}
                      </div>
                      {e.pole_territoire_nom&&(
                        <span title={e.pole_territoire_nom} style={{...badgePole(e.pole_territoire_nom),whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",flexShrink:1,minWidth:0}}>
                          {e.pole_territoire_nom}
                        </span>
                      )}
                    </div>

                    {/* Date de création · Région en rangée épurée */}
                    <div style={{display:"flex",alignItems:"center",borderTop:"1px solid #F2F0EF",paddingTop:13,marginTop:"auto"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Date de création</p>
                        <p style={{fontSize:12.5,fontWeight:700,color:e.date_creation?"#1a1a2e":"#C5BFBB",fontVariantNumeric:"tabular-nums"}}>{e.date_creation?fmtDate(e.date_creation):"—"}</p>
                      </div>
                      <div style={{width:1,alignSelf:"stretch",background:"#F2F0EF",margin:"0 18px"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Région</p>
                        <p style={{fontSize:12.5,fontWeight:700,color:e.region_nom?"#1a1a2e":"#C5BFBB",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{e.region_nom||"—"}</p>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
      </div>}

      {/* Modal partagé — une seule source de vérité */}
      <EntreprisePublicModal entreprise={selec} onClose={()=>setSelec(null)}/>
    </main>
  );
}
