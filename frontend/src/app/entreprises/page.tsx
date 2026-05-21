"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import { Loader2, Building2, Search, X, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtDate(d: string) {
  if (!d) return "";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
}

// ── Filtre multi-select générique sidebar ─────────────────────────────────────
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
          {selected.length>0&&<span style={{width:6,height:6,borderRadius:"50%",background:color,display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:selected.length>0?color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>{label}</span>
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
                  style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?color+"12":"transparent",textAlign:"left" as const}}
                  onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}}
                  onMouseLeave={e=>{e.currentTarget.style.background=sel?color+"12":"transparent";}}>
                  <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?color:"#C5BFBB"}`,background:sel?color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{fontSize:11,color:sel?"#1a1a2e":"#4a5568",fontWeight:sel?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Filtre thématiques cascade ────────────────────────────────────────────────
function ThematiquesCascadeFilter({ secteurs, secteurSel, branchesSel, activitesSel, onSecteur, onBranche, onActivite }: {
  secteurs:any[]; secteurSel:string; branchesSel:string[]; activitesSel:string[];
  onSecteur:(v:string)=>void; onBranche:(v:string)=>void; onActivite:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const secteurObj = secteurs.find(s=>s.nom===secteurSel);
  const branches   = secteurObj?.branches||[];
  const activites  = branches.filter((b:any)=>branchesSel.includes(b.nom)).flatMap((b:any)=>b.activites||[]);
  const hasFilter  = !!secteurSel||branchesSel.length>0||activitesSel.length>0;
  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {hasFilter&&<span style={{width:6,height:6,borderRadius:"50%",background:"#E35336",display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:hasFilter?"#E35336":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Thématiques</span>
        </div>
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {open&&<div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"#E35336",marginBottom:4}}>Secteur</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {secteurs.map((s:any)=>{const sel=secteurSel===s.nom; return (
              <button key={s.nom} onClick={()=>onSecteur(sel?"":s.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(227,83,54,0.1)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(227,83,54,0.1)":"transparent";}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:sel?"#E35336":"#C5BFBB",flexShrink:0}}/><span style={{fontSize:11,color:sel?"#E35336":"#4a5568",fontWeight:sel?700:400}}>{s.nom}</span>
              </button>);
            })}
          </div>
        </div>
        {secteurSel&&branches.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(227,83,54,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#366FE3",marginBottom:4}}>Branche</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {branches.map((b:any)=>{const sel=branchesSel.includes(b.nom); return (
              <button key={b.nom} onClick={()=>onBranche(b.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(54,111,227,0.1)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(54,111,227,0.1)":"transparent";}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:sel?"#366FE3":"#C5BFBB",flexShrink:0}}/><span style={{fontSize:11,color:sel?"#366FE3":"#4a5568",fontWeight:sel?600:400}}>{b.nom}</span>
              </button>);
            })}
          </div>
        </div>}
        {branchesSel.length>0&&activites.length>0&&<div style={{paddingLeft:24,borderLeft:"2px solid rgba(24,128,56,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4}}>Activité</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {activites.map((a:any)=>{const sel=activitesSel.includes(a.nom); return (
              <button key={a.nom} onClick={()=>onActivite(a.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(24,128,56,0.08)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(24,128,56,0.08)":"transparent";}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:sel?"#188038":"#C5BFBB",flexShrink:0}}/><span style={{fontSize:11,color:sel?"#188038":"#4a5568",fontWeight:sel?600:400}}>{a.nom}</span>
              </button>);
            })}
          </div>
        </div>}
        {hasFilter&&<button onClick={()=>{onSecteur("");branchesSel.slice().forEach(onBranche);activitesSel.slice().forEach(onActivite);}}
          style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>
          <X size={10}/> Effacer thématiques
        </button>}
      </div>}
    </div>
  );
}

// ── Filtre localisation cascade ───────────────────────────────────────────────
function LocalisationFilter({ regions, regionsSel, departementsSel, onRegion, onDepartement }: {
  regions:any[]; regionsSel:string[]; departementsSel:string[];
  onRegion:(v:string)=>void; onDepartement:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const departements = regions.filter(r=>regionsSel.includes(r.nom)).flatMap((r:any)=>r.departements||[]);
  const hasFilter = regionsSel.length>0||departementsSel.length>0;
  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {hasFilter&&<span style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:hasFilter?"#366FE3":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Localisation</span>
        </div>
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {open&&<div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"#366FE3",marginBottom:4}}>Région</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:160,overflowY:"auto" as const}}>
            {regions.map((r:any)=>{const sel=regionsSel.includes(r.nom); return (
              <button key={r.nom} onClick={()=>onRegion(r.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(54,111,227,0.1)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(54,111,227,0.1)":"transparent";}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:sel?"#366FE3":"#C5BFBB",flexShrink:0}}/><span style={{fontSize:11,color:sel?"#366FE3":"#4a5568",fontWeight:sel?600:400}}>{r.nom}</span>
              </button>);
            })}
          </div>
        </div>
        {regionsSel.length>0&&departements.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(54,111,227,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4}}>Département</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:140,overflowY:"auto" as const}}>
            {departements.map((d:any)=>{const sel=departementsSel.includes(d.nom); return (
              <button key={d.nom} onClick={()=>onDepartement(d.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(24,128,56,0.08)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(24,128,56,0.08)":"transparent";}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:sel?"#188038":"#C5BFBB",flexShrink:0}}/><span style={{fontSize:11,color:sel?"#188038":"#4a5568",fontWeight:sel?600:400}}>{d.nom}</span>
              </button>);
            })}
          </div>
        </div>}
        {hasFilter&&<button onClick={()=>{regionsSel.slice().forEach(onRegion);departementsSel.slice().forEach(onDepartement);}}
          style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#dc2626",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>
          <X size={10}/> Effacer localisation
        </button>}
      </div>}
    </div>
  );
}

// ── Modal vue entreprise ──────────────────────────────────────────────────────
function EntrepriseVue({ ent:e, onClose }: { ent:any; onClose:()=>void }) {
  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.25)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:38,height:38,borderRadius:10,background:"rgba(227,83,54,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Building2 size={18} style={{color:"#E35336"}}/>
                </div>
                <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{e.nom}</h2>
              </div>
              {e.forme_juridique&&<span style={{fontSize:11,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",padding:"2px 9px",borderRadius:999}}>{e.forme_juridique}</span>}
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>
          {/* Infos principales */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {e.date_creation&&<div style={{background:"rgba(54,111,227,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Date de création</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(e.date_creation)}</p></div>}
            {e.adresse&&<div style={{background:"rgba(227,83,54,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Adresse</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{e.adresse}</p></div>}
            {e.telephone&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Téléphone</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{e.telephone}</p></div>}
            {e.mail&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Email</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{e.mail}</p></div>}
            {(e.region_nom||e.departement_nom)&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Localisation</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{[e.arrondissement_nom,e.departement_nom,e.region_nom].filter(Boolean).join(", ")}</p></div>}
            {e.siteweb&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Site web</LBL><a href={e.siteweb} target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:"#366FE3",textDecoration:"none"}}>{e.siteweb}</a></div>}
          </div>
          {/* NAEMA */}
          {(e.secteur||e.branche||e.activite)&&<div style={{marginBottom:16}}>
            <LBL>Classification NAEMA</LBL>
            <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
              {e.secteur&&<div>
                <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:e.branche?5:0}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"#E35336",flexShrink:0}}/><span style={{fontSize:12,fontWeight:700,color:"#E35336"}}>{e.secteur.nom}</span>
                </div>
                {e.branche&&<div style={{paddingLeft:20,borderLeft:"2px solid rgba(227,83,54,0.15)"}}>
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:e.activite?4:0}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/><span style={{fontSize:11,fontWeight:600,color:"#366FE3"}}>{e.branche.nom}</span>
                  </div>
                  {e.activite&&<div style={{paddingLeft:18}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/><span style={{fontSize:11,color:"#188038",fontWeight:500}}>{e.activite.nom}</span>
                    </div>
                  </div>}
                </div>}
              </div>}
            </div>
          </div>}
          {/* Points focaux */}
          {e.points_focaux?.length>0&&<div style={{marginBottom:16}}>
            <LBL>Points focaux</LBL>
            <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
              {e.points_focaux.map((pf:any,i:number)=>(
                <div key={i} style={{background:"#F8F7F6",borderRadius:10,padding:"10px 14px",fontSize:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontWeight:700,color:"#1a1a2e"}}>{pf.civilite} {pf.prenom} {pf.nom}</span>
                    {pf.poste&&<span style={{color:"#9aa5b4"}}>— {pf.poste}</span>}
                    {pf.est_principal&&<span style={{fontSize:10,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",borderRadius:999,padding:"1px 7px"}}>Principal</span>}
                  </div>
                  <div style={{color:"#4a5568"}}>{pf.telephone}{pf.mail&&` · ${pf.mail}`}</div>
                </div>
              ))}
            </div>
          </div>}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:20,borderTop:"1px solid #F2F0EF",paddingTop:18}}>
            <button onClick={onClose} style={{padding:"9px 20px",borderRadius:9,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function EntreprisesPage() {
  const [tous,        setTous]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selec,       setSelec]       = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [formeOpts,   setFormeOpts]   = useState<string[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [regions,     setRegions]     = useState<any[]>([]);

  // Filtres
  const [recherche,    setRecherche]    = useState("");
  const [formesSel,    setFormesSel]    = useState<string[]>([]);
  const [secteurSel,   setSecteurSel]   = useState("");
  const [branchesSel,  setBranchesSel]  = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);
  const [regionsSel,   setRegionsSel]   = useState<string[]>([]);
  const [deptsSel,     setDeptsSel]     = useState<string[]>([]);

  useEffect(()=>{
    const safe=(p:Promise<any>,fb:any)=>p.catch(()=>fb);
    Promise.all([
      safe(fetch(`${API_BASE}/entreprises/ref/formes-juridiques`).then(r=>r.json()), []),
      safe(fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),          []),
      safe(fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),          []),
      safe(fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),         []),
      safe(fetch(`${API_BASE}/entreprises/ref/regions`).then(r=>r.json()),         []),
      safe(fetch(`${API_BASE}/entreprises/ref/departements`).then(r=>r.json()),    []),
    ]).then(([formes,secsData,brasData,actsData,regsData,deptsData])=>{
      setFormeOpts(Array.isArray(formes)?formes:[]);
      const tree=(secsData||[]).map((s:any)=>({...s,branches:(brasData||[]).filter((b:any)=>b.secteur_id===s.id).map((b:any)=>({...b,activites:(actsData||[]).filter((a:any)=>a.branche_id===b.id)}))}));
      setSecteurs(tree);
      const regTree=(regsData||[]).map((r:any)=>({...r,departements:(deptsData||[]).filter((d:any)=>d.region_id===r.id)}));
      setRegions(regTree);
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

  // Filtrage côté client
  const entreprises = tous.filter(e=>{
    if (recherche) {
      const q=recherche.toLowerCase();
      if (!e.nom?.toLowerCase().includes(q)&&!e.forme_juridique?.toLowerCase().includes(q)&&!e.adresse?.toLowerCase().includes(q)) return false;
    }
    if (formesSel.length>0&&!formesSel.includes(e.forme_juridique||"")) return false;
    if (secteurSel&&e.secteur?.nom!==secteurSel) return false;
    if (branchesSel.length>0&&!branchesSel.includes(e.branche?.nom||"")) return false;
    if (activitesSel.length>0&&!activitesSel.includes(e.activite?.nom||"")) return false;
    if (regionsSel.length>0&&!regionsSel.includes(e.region_nom||"")) return false;
    if (deptsSel.length>0&&!deptsSel.includes(e.departement_nom||"")) return false;
    return true;
  });

  const hasFilter=!!recherche||formesSel.length>0||!!secteurSel||branchesSel.length>0||activitesSel.length>0||regionsSel.length>0||deptsSel.length>0;
  const reinit=()=>{setRecherche("");setFormesSel([]);setSecteurSel("");setBranchesSel([]);setActivitesSel([]);setRegionsSel([]);setDeptsSel([]);};
  const nbFiltres=(recherche?1:0)+formesSel.length+(secteurSel?1:0)+branchesSel.length+activitesSel.length+regionsSel.length+deptsSel.length;

  const toggleForme   =(v:string)=>setFormesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleBranche =(v:string)=>{setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setActivitesSel([]);};
  const toggleActivite=(v:string)=>setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const setSecteur    =(v:string)=>{setSecteurSel(v);setBranchesSel([]);setActivitesSel([]);};
  const toggleRegion  =(v:string)=>{setRegionsSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setDeptsSel([]);};
  const toggleDept    =(v:string)=>setDeptsSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);

  return (
    <main style={{minHeight:"100vh",background:"#F2F0EF",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar/>

      {/* Hero */}
      <section style={{padding:"100px 40px 48px",background:"linear-gradient(160deg,#1a1a2e 0%,#2a2a4e 60%,#E35336 100%)",position:"relative" as const,overflow:"hidden"}}>
        <div style={{position:"absolute" as const,inset:0,background:"linear-gradient(160deg,rgba(26,26,46,0.96),rgba(227,83,54,0.25))"}}/>
        <div style={{maxWidth:1280,margin:"0 auto",position:"relative" as const,zIndex:1}}>
          <p style={{fontSize:11,fontWeight:700,color:"#FFB0A1",letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:10}}>APIX · Plateforme investissements</p>
          <h1 style={{fontWeight:800,fontSize:"clamp(2.2rem,4vw,3.2rem)",color:"#fff",lineHeight:1.1,marginBottom:16}}>Entreprises installées</h1>
          <p style={{color:"rgba(255,255,255,0.7)",fontSize:15,maxWidth:540,lineHeight:1.7,marginBottom:24}}>Cartographie des entreprises formalisées et installées au Sénégal.</p>
          {tous.length>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>{tous.length} entreprise{tous.length>1?"s":""}</span>}
        </div>
      </section>

      {/* Layout sidebar + contenu */}
      <section style={{padding:"36px 40px 80px",maxWidth:1280,margin:"0 auto"}}>
        <div style={{display:"flex",gap:24,alignItems:"flex-start"}}>

          {/* Sidebar */}
          <div style={{width:sidebarOpen?280:52,flexShrink:0,transition:"width 0.25s"}}>
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #E8E5E3",padding:sidebarOpen?"20px 16px":"10px 8px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)",position:"sticky" as const,top:24,maxHeight:"calc(100vh - 80px)",overflowY:"auto" as const}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:sidebarOpen?"space-between":"center",marginBottom:sidebarOpen?18:0}}>
                {sidebarOpen&&<span style={{fontSize:12,fontWeight:700,color:"#1a1a2e",letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Filtres</span>}
                <button onClick={()=>setSidebarOpen(o=>!o)}
                  style={{background:"rgba(227,83,54,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
                  <SlidersHorizontal size={14} style={{color:"#E35336"}}/>
                  {sidebarOpen&&nbFiltres>0&&<span style={{fontSize:10,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.15)",borderRadius:999,padding:"1px 5px"}}>{nbFiltres}</span>}
                </button>
              </div>
              {sidebarOpen&&<>
                {hasFilter&&<button onClick={reinit} style={{display:"flex",alignItems:"center",gap:5,width:"100%",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:8,padding:"7px 10px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:16}}>
                  <X size={12}/> Effacer tous les filtres
                </button>}
                {/* Recherche */}
                <div style={{position:"relative" as const,marginBottom:18}}>
                  <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                  <input value={recherche} onChange={e=>setRecherche(e.target.value)} placeholder="Nom, adresse…"
                    style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                  {recherche&&<button onClick={()=>setRecherche("")} style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                </div>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <SideFilter label="Forme juridique" color="#188038" items={formeOpts} selected={formesSel} onToggle={toggleForme} searchable/>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs} secteurSel={secteurSel} branchesSel={branchesSel} activitesSel={activitesSel} onSecteur={setSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <LocalisationFilter regions={regions} regionsSel={regionsSel} departementsSel={deptsSel} onRegion={toggleRegion} onDepartement={toggleDept}/>
              </>}
            </div>
          </div>

          {/* Grille */}
          <div style={{flex:1,minWidth:0}}>
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
              <>
                <p style={{fontSize:13,color:"#9aa5b4",marginBottom:16}}>{entreprises.length} entreprise{entreprises.length>1?"s":""}{hasFilter?" trouvée"+(entreprises.length>1?"s":""):""}</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:12}}>
                  {entreprises.map(e=>(
                    <div key={e.id} onClick={()=>setSelec(e)}
                      style={{background:"#fff",borderTop:"1px solid #E8E5E3",borderRight:"1px solid #E8E5E3",borderBottom:"1px solid #E8E5E3",borderLeft:"3px solid #E35336",borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}
                      onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(227,83,54,0.12)";ev.currentTarget.style.borderTopColor="#FFB0A1";ev.currentTarget.style.borderRightColor="#FFB0A1";ev.currentTarget.style.borderBottomColor="#FFB0A1";}}
                      onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderTopColor="#E8E5E3";ev.currentTarget.style.borderRightColor="#E8E5E3";ev.currentTarget.style.borderBottomColor="#E8E5E3";}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:e.forme_juridique?2:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nom}</div>
                      {e.forme_juridique&&<div style={{fontSize:11,fontWeight:600,color:"#9aa5b4",marginBottom:8}}>{e.forme_juridique}</div>}
                      <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:10}}>
                        {e.date_creation&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><div style={{width:6,height:6,borderRadius:"50%",background:"#E35336",flexShrink:0}}/><span style={{color:"#4a5568"}}>{fmtDate(e.date_creation)}</span></div>}
                        {e.adresse&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/><span style={{color:"#4a5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.adresse}</span></div>}
                        {e.region_nom&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}><div style={{width:6,height:6,borderRadius:"50%",background:"#188038",flexShrink:0}}/><span style={{color:"#4a5568"}}>{e.region_nom}</span></div>}
                      </div>
                      <div style={{fontSize:11,color:"#E35336",fontWeight:600,borderTop:"1px solid #F2F0EF",paddingTop:8}}>Voir la fiche →</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {selec&&<EntrepriseVue ent={selec} onClose={()=>setSelec(null)}/>}
    </main>
  );
}
