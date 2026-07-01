"use client";

import Navbar from "@/components/layout/Navbar";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import VueTerritorialeSenegal from "@/components/shared/VueTerritorialeSenegal";
import Badge from "@/components/shared/Badge";
import { Building2, ChevronDown, ChevronUp, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtDate(d: string) {
  if (!d) return "";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
}

function SideFilter({ label, items, selected, onToggle, color, searchable=false }: {
  label:string; items:string[]; selected:string[]; onToggle:(v:string)=>void; color:string; searchable?:boolean;
}) {
  const [open, setOpen]     = useState(true);
  const [search, setSearch] = useState("");
  const filtered = searchable ? items.filter(i=>i.toLowerCase().includes(search.toLowerCase())) : items;
  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?8:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{label}</span>
          {selected.length>0&&<span style={{fontSize:10,fontWeight:700,color,background:color+"18",padding:"1px 6px",borderRadius:999}}>{selected.length}</span>}
        </div>
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {open&&(
        <>
          {searchable&&<div style={{position:"relative" as const,marginBottom:6}}>
            <Search size={11} style={{position:"absolute" as const,left:8,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…"
              style={{width:"100%",paddingLeft:24,paddingRight:8,paddingTop:6,paddingBottom:6,borderRadius:7,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:11,outline:"none",boxSizing:"border-box" as const}}/>
          </div>}
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:180,overflowY:"auto" as const}}>
            {filtered.map(item=>{
              const sel=selected.includes(item);
              return (
                <button key={item} onClick={()=>onToggle(item)}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                  onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                  <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?color:"#C5BFBB"}`,background:sel?color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                      </div>
                  <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ThematiquesCascadeFilter({ secteurs, secteursSel, branchesSel, activitesSel, onSecteur, onBranche, onActivite }: {
  secteurs:any[]; secteursSel:string[]; branchesSel:string[]; activitesSel:string[];
  onSecteur:(v:string)=>void; onBranche:(v:string)=>void; onActivite:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const branches  = secteurs.filter(s=>secteursSel.includes(s.nom)).flatMap((s:any)=>s.branches||[]);
  const activites = branches.filter((b:any)=>branchesSel.includes(b.nom)).flatMap((b:any)=>b.activites||[]);
  const hasFilter = secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Thématiques</span>
          {secteursSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.1)",padding:"1px 6px",borderRadius:999}}>{secteursSel.length}</span>}
          {branchesSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.1)",padding:"1px 6px",borderRadius:999}}>{branchesSel.length}</span>}
          {activitesSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#188038",background:"rgba(24,128,56,0.1)",padding:"1px 6px",borderRadius:999}}>{activitesSel.length}</span>}
        </div>
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {open&&<div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"#004f91",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Secteur</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {secteurs.map((s:any)=>{const sel=secteursSel.includes(s.nom); return (
              <button key={s.nom} onClick={()=>onSecteur(s.nom)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#004f91":"#C5BFBB"}`,background:sel?"#004f91":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:sel?"#004f91":"#4a5568",fontWeight:sel?700:400}}>{s.nom}</span>
              </button>);})}
          </div>
        </div>
        {secteursSel.length>0&&branches.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(0,79,145,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#ca631f",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Branche</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {branches.map((b:any)=>{const sel=branchesSel.includes(b.nom); return (
              <button key={b.nom} onClick={()=>onBranche(b.nom)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#ca631f":"#C5BFBB"}`,background:sel?"#ca631f":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:sel?"#ca631f":"#4a5568",fontWeight:sel?600:400}}>{b.nom}</span>
              </button>);})}
          </div>
        </div>}
        {branchesSel.length>0&&activites.length>0&&<div style={{paddingLeft:24,borderLeft:"2px solid rgba(202,99,31,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Activité</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {activites.map((a:any)=>{const sel=activitesSel.includes(a.nom); return (
              <button key={a.nom} onClick={()=>onActivite(a.nom)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#188038":"#C5BFBB"}`,background:sel?"#188038":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:sel?"#188038":"#4a5568",fontWeight:sel?600:400}}>{a.nom}</span>
              </button>);})}
          </div>
        </div>}
        {hasFilter&&<button onClick={()=>{secteursSel.slice().forEach(onSecteur);branchesSel.slice().forEach(onBranche);activitesSel.slice().forEach(onActivite);}}
          style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>
          <X size={10}/> Effacer thématiques
        </button>}
      </div>}
    </div>
  );
}

function LocalisationFilter({ regions, regionsSel, departementsSel, arrondissementsSel, onRegion, onDepartement, onArrond }: {
  regions:any[]; regionsSel:string[]; departementsSel:string[]; arrondissementsSel:string[];
  onRegion:(v:string)=>void; onDepartement:(v:string)=>void; onArrond:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const departements    = regions.filter(r=>regionsSel.includes(r.nom)).flatMap((r:any)=>r.departements||[]);
  const arrondissements = departements.filter(d=>departementsSel.includes(d.nom)).flatMap((d:any)=>d.arrondissements||[]);
  const hasFilter = regionsSel.length>0||departementsSel.length>0||arrondissementsSel.length>0;
  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Localisation</span>
          {regionsSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.1)",padding:"1px 6px",borderRadius:999}}>{regionsSel.length}</span>}
          {departementsSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.1)",padding:"1px 6px",borderRadius:999}}>{departementsSel.length}</span>}
          {arrondissementsSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#188038",background:"rgba(24,128,56,0.1)",padding:"1px 6px",borderRadius:999}}>{arrondissementsSel.length}</span>}
        </div>
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {open&&<div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"#004f91",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Région</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:160,overflowY:"auto" as const}}>
            {regions.map((r:any)=>{const sel=regionsSel.includes(r.nom); return (
              <button key={r.nom} onClick={()=>onRegion(r.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#004f91":"#C5BFBB"}`,background:sel?"#004f91":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div><span style={{fontSize:12,color:sel?"#004f91":"#4a5568",fontWeight:sel?600:400}}>{r.nom}</span>
              </button>);})}
          </div>
        </div>
        {regionsSel.length>0&&departements.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(0,79,145,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#ca631f",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Département</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:140,overflowY:"auto" as const}}>
            {departements.map((d:any)=>{const sel=departementsSel.includes(d.nom); return (
              <button key={d.nom} onClick={()=>onDepartement(d.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#ca631f":"#C5BFBB"}`,background:sel?"#ca631f":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div><span style={{fontSize:12,color:sel?"#ca631f":"#4a5568",fontWeight:sel?600:400}}>{d.nom}</span>
              </button>);})}
          </div>
        </div>}
        {departementsSel.length>0&&arrondissements.length>0&&<div style={{paddingLeft:24,borderLeft:"2px solid rgba(202,99,31,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Arrondissement</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:120,overflowY:"auto" as const}}>
            {arrondissements.map((a:any)=>{const sel=arrondissementsSel.includes(a.nom); return (
              <button key={a.nom} onClick={()=>onArrond(a.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#188038":"#C5BFBB"}`,background:sel?"#188038":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div><span style={{fontSize:12,color:sel?"#188038":"#4a5568",fontWeight:sel?600:400}}>{a.nom}</span>
              </button>);})}
          </div>
        </div>}
        {hasFilter&&<button onClick={()=>{regionsSel.slice().forEach(onRegion);departementsSel.slice().forEach(onDepartement);arrondissementsSel.slice().forEach(onArrond);}}
          style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>
          <X size={10}/> Effacer localisation
        </button>}
      </div>}
    </div>
  );
}

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
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
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
  const [onglet,      setOnglet]      = useState<"liste"|"territoire">("liste");
  const [tous,        setTous]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selec,       setSelec]       = useState<any>(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(200, Math.min(520, startW + ev.clientX - startX))); };
    const onUp = () => { isResizing.current = false; document.body.style.userSelect = ""; document.body.style.cursor = ""; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };
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

  useEffect(()=>{
    const safe=(p:Promise<any>,fb:any)=>p.catch(()=>fb);
    Promise.all([
      safe(fetch(`${API_BASE}/entreprises/ref/formes-juridiques`).then(r=>r.json()),[]),
      safe(fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),         []),
      safe(fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),         []),
      safe(fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),        []),
      safe(fetch(`${API_BASE}/entreprises/ref/regions`).then(r=>r.json()),          []),
      safe(fetch(`${API_BASE}/entreprises/ref/departements`).then(r=>r.json()),     []),
      safe(fetch(`${API_BASE}/entreprises/ref/arrondissements`).then(r=>r.json()), []),
      safe(fetch(`${API_BASE}/entreprises/ref/poles`).then(r=>r.json()),            []),
    ]).then(([formes,secsData,brasData,actsData,regsData,deptsData,arrsData,polesData])=>{
      setFormeOpts(Array.isArray(formes)?formes:[]);
      const tree=(secsData||[]).map((s:any)=>({...s,branches:(brasData||[]).filter((b:any)=>b.secteur_id===s.id).map((b:any)=>({...b,activites:(actsData||[]).filter((a:any)=>a.branche_id===b.id)}))}));
      setSecteurs(tree);
      const regTree=(regsData||[]).map((r:any)=>({...r,departements:(deptsData||[]).filter((d:any)=>d.region_id===r.id).map((d:any)=>({...d,arrondissements:(arrsData||[]).filter((a:any)=>a.departement_id===d.id)}))}));
      setRegions(regTree);
      setPoles((polesData||[]).map((p:any)=>p.nom));
    });
  },[]);

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const res=await fetch(`${API_BASE}/entreprises?per_page=100`);
      const data=await res.json();
      setTous(data.data||[]);
    } catch(e){console.error(e);}
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

  const entreprises = tous.filter(e=>{
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
  });

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
    <main style={{minHeight:"100vh",background:"#F2F0EF",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.drs-thumb{-webkit-appearance:none;appearance:none;background:transparent;height:24px;margin:0;padding:0;position:absolute;top:0;left:0;width:100%;pointer-events:none}
.drs-thumb::-webkit-slider-runnable-track{background:transparent;height:4px}
.drs-thumb::-moz-range-track{background:transparent;height:4px}
.drs-thumb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all;margin-top:-6px}
.drs-thumb::-moz-range-thumb{background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all}`}</style>
      <Navbar/>
      <section style={{padding:"100px 40px 40px",background:"linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",position:"relative" as const,overflow:"hidden"}}>
        <div style={{maxWidth:1280,margin:"0 auto",position:"relative" as const,zIndex:1}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(202,99,31,0.1)",border:"1px solid rgba(202,99,31,0.25)",borderRadius:999,padding:"6px 14px",marginBottom:17}}>
            <span style={{fontSize:11,fontWeight:700,color:"#D96D3B",letterSpacing:"0.15em",textTransform:"uppercase"}}>Plateforme de Promotion des Investissements et des Investisseurs</span>
          </div>
          <h1 style={{fontWeight:800,fontSize:"clamp(2.2rem,4vw,3.2rem)",color:"#fff",lineHeight:1.1,marginBottom:16}}>Entreprises formalisées</h1>
          {tous.length>0&&<span style={{display:"inline-flex",alignItems:"center",fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>
            {tous.length} entreprise{tous.length>1?"s":""}
          </span>}
        </div>
      </section>

      {/* Onglets sticky */}
      <div style={{background:"#fff",borderBottom:"1px solid #E8E5E3",position:"sticky" as const,top:0,zIndex:10}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 40px",display:"flex",gap:0}}>
          {([
            {key:"liste",      label:"Liste des entreprises", color:"#004f91"},
            {key:"territoire", label:"Vue territoriale",      color:"#004f91"},
          ] as const).map(t=>(
            <button key={t.key} onClick={()=>setOnglet(t.key)}
              style={{padding:"16px 22px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"var(--font-google-sans)",fontSize:13,fontWeight:600,color:onglet===t.key?t.color:"#9aa5b4",borderBottom:`2px solid ${onglet===t.key?t.color:"transparent"}`,transition:"all 0.15s"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vue territoriale */}
      {onglet==="territoire" && (
        <section style={{padding:"36px 40px 80px",maxWidth:1280,margin:"0 auto"}}>
          {loading ? (
            <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:300,gap:12,color:"#9aa5b4"}}>
              <Loader2 size={24} style={{animation:"spin 1s linear infinite"}}/><span style={{fontSize:14}}>Chargement…</span>
            </div>
          ) : (
            <VueTerritorialeSenegal zones={[]} mode="region"/>
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
                <button onClick={()=>setSidebarOpen(o=>!o)} style={{background:"rgba(0,79,145,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
                  <SlidersHorizontal size={14} style={{color:"#004f91"}}/>
                  {sidebarOpen&&nbFiltres>0&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.15)",borderRadius:999,padding:"1px 5px"}}>{nbFiltres}</span>}
                </button>
                {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser"
                  style={{background:"#fee2e2",border:"none",cursor:"pointer",borderRadius:8,padding:"6px",display:"flex",alignItems:"center"}}>
                  <span className="material-symbols-outlined" style={{fontSize:16,color:"#dc2626",fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",lineHeight:1}}>close</span>
                </button>}
              </div>
            </div>
            {sidebarOpen&&<div style={{padding:"16px",overflowY:"auto" as const,flex:1}}>
                <div style={{position:"relative" as const,marginBottom:18}}>
                  <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                  <input value={recherche} onChange={e=>setRecherche(e.target.value)} placeholder="Rechercher…"
                    style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                  {recherche&&<button onClick={()=>setRecherche("")} style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                </div>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <SideFilter label="Forme juridique" color="#004f91" items={formeOpts} selected={formesSel} onToggle={toggleForme}/>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                {dateMin<dateMax&&<DateRangeFilter minYear={dateMin} maxYear={dateMax} startYear={dateStart} endYear={dateEnd} onChange={(s,e)=>{setDateStart(s);setDateEnd(e);}}/>}
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs} secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel} onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <LocalisationFilter regions={regions} regionsSel={regionsSel} departementsSel={deptsSel} arrondissementsSel={arrondsSel} onRegion={toggleRegion} onDepartement={toggleDept} onArrond={toggleArr}/>
                {poles.length>0&&<><div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <SideFilter label="Pôle territoire" color="#004f91" items={poles} selected={polesSel} onToggle={togglePole}/></>}
            </div>}
          </aside>
          {/* Grille */}
          <div style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>
            {loading?(
              <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:300,gap:12,color:"#9aa5b4"}}>
                <Loader2 size={24} style={{animation:"spin 1s linear infinite"}}/><span style={{fontSize:14}}>Chargement…</span>
              </div>
            ):entreprises.length===0?(
              <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                <Building2 size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucune entreprise trouvée</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<button onClick={reinit} style={{marginTop:16,padding:"8px 18px",borderRadius:10,border:"none",background:"#E35336",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>Effacer les filtres</button>}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:12}}>
                {entreprises.map(e=>(
                  <div key={e.id} onClick={()=>setSelec(e)}
                    style={{background:"#fff",border:"1px solid #E8E5E3",borderLeft:"3px solid #ca631f",borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",position:"relative" as const}}
                    onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(202,99,31,0.12)";ev.currentTarget.style.borderColor="#ca631f";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderColor="#E8E5E3";ev.currentTarget.style.borderLeftColor="#ca631f";}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:e.forme_juridique?2:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nom}</div>
                    {e.forme_juridique&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginBottom:8}}>{e.forme_juridique}</div>}
                    <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:12}}>
                      {e.date_creation&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                        <span style={{color:"#4a5568"}}>Créée le {fmtDate(e.date_creation)}</span>
                      </div>}
                      {(e.departement_nom||e.region_nom)&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:"#B7410E",flexShrink:0}}/>
                        <span style={{color:"#4a5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{[e.departement_nom,e.region_nom].filter(Boolean).join(", ")}</span>
                      </div>}
                    </div>
                    <div style={{display:"flex",borderTop:"1px solid #F2F0EF",paddingTop:10}}>
                      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(202,99,31,0.08)",borderRadius:7,padding:"6px 0",fontSize:11,color:"#ca631f",fontWeight:600}}>
                        Voir la fiche →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>}

      {/* Modal partagé — une seule source de vérité */}
      <EntreprisePublicModal entreprise={selec} onClose={()=>setSelec(null)}/>
    </main>
  );
}
