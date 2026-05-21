"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import { Loader2, FileText, X, ChevronDown, ChevronUp, SlidersHorizontal, Search } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtDate(d: string) {
  if (!d) return "—";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
}
function flag(code: string) {
  try { return String.fromCodePoint(...code.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0))); }
  catch { return ""; }
}

const STATUT_OPTS = [
  { value:"",           label:"Tous",        bg:"#F2F0EF", text:"#4a5568" },
  { value:"en_vigueur", label:"En vigueur",  bg:"#dcfce7", text:"#15803d" },
  { value:"expire",     label:"Expirés",     bg:"#f3f4f6", text:"#6b7280" },
];

// ── Filtre multi-select sidebar ───────────────────────────────────────────────
function SideFilter({ label, items, selected, onToggle, color }: {
  label:string; items:{value:string;label:string;flag?:string}[];
  selected:string[]; onToggle:(v:string)=>void; color:string;
}) {
  const [open, setOpen] = useState(true);
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
        <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
          {items.map(item=>{
            const sel=selected.includes(item.value);
            return (
              <button key={item.value} onClick={()=>onToggle(item.value)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?color+"12":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}}
                onMouseLeave={e=>{e.currentTarget.style.background=sel?color+"12":"transparent";}}>
                <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?color:"#C5BFBB"}`,background:sel?color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                {item.flag&&<span style={{fontSize:13}}>{item.flag}</span>}
                <span style={{fontSize:12,color:sel?"#1a1a2e":"#4a5568",fontWeight:sel?600:400}}>{item.label}</span>
              </button>
            );
          })}
        </div>
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
  const branches = secteurObj?.branches||[];
  const activites = branches.filter((b:any)=>branchesSel.includes(b.nom)).flatMap((b:any)=>b.activites||[]);
  const hasFilter = !!secteurSel||branchesSel.length>0||activitesSel.length>0;
  return (
    <div>
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
                <div style={{width:7,height:7,borderRadius:"50%",background:sel?"#E35336":"#C5BFBB",flexShrink:0}}/><span style={{fontSize:12,color:sel?"#E35336":"#4a5568",fontWeight:sel?700:400}}>{s.nom}</span>
              </button>
            );})}
          </div>
        </div>
        {secteurSel&&branches.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(227,83,54,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#366FE3",marginBottom:4}}>Branche</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {branches.map((b:any)=>{const sel=branchesSel.includes(b.nom); return (
              <button key={b.nom} onClick={()=>onBranche(b.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(54,111,227,0.1)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(54,111,227,0.1)":"transparent";}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:sel?"#366FE3":"#C5BFBB",flexShrink:0}}/><span style={{fontSize:12,color:sel?"#366FE3":"#4a5568",fontWeight:sel?600:400}}>{b.nom}</span>
              </button>
            );})}
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
              </button>
            );})}
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

// ── Modal vue accord ──────────────────────────────────────────────────────────
function AccordVue({ accord:a, onClose }: { accord:any; onClose:()=>void }) {
  const [fichiers, setFichiers] = useState<any[]>([]);
  useEffect(()=>{
    fetch(`${API_BASE}/accords/${a.id}/fichiers`).then(r=>r.json()).then(setFichiers).catch(()=>{});
  },[a.id]);

  const parseThematiques = (raw:string) => {
    if (!raw) return null;
    const items = raw.split(",").map((s:string)=>s.trim()).filter(Boolean);
    const secs = items.filter(s=>s.startsWith("sec:")).map(s=>s.slice(4));
    const bras = items.filter(s=>s.startsWith("bra:")).map(s=>s.slice(4));
    const acts = items.filter(s=>s.startsWith("act:")).map(s=>s.slice(4));
    if (!secs.length&&!bras.length&&!acts.length) return null;
    return {secs,bras,acts};
  };
  const th = parseThematiques(a.secteur_activite);
  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.25)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#E35336,#FFB0A1,#366FE3)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{a.titre}</h2>
              <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {a.reference&&<span style={{fontSize:11,fontWeight:700,color:"#E35336",background:"rgba(227,83,54,0.08)",border:"1px solid rgba(227,83,54,0.2)",padding:"2px 9px",borderRadius:999}}>{a.reference}</span>}
                <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:999,
                  color:a.statut==="en_vigueur"?"#15803d":"#6b7280",
                  background:a.statut==="en_vigueur"?"rgba(21,128,61,0.08)":"#f3f4f6",
                  border:`1px solid ${a.statut==="en_vigueur"?"rgba(21,128,61,0.2)":"#e5e7eb"}`}}>
                  {a.statut==="en_vigueur"?"En vigueur":"Expiré"}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>
          {a.commentaires&&<div style={{background:"rgba(227,83,54,0.04)",border:"1px solid rgba(227,83,54,0.1)",borderRadius:10,padding:"12px 14px",marginBottom:18}}><p style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}>{a.commentaires}</p></div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {a.date_signature&&<div style={{background:"rgba(54,111,227,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Date de signature</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_signature)}</p></div>}
            {a.date_entree_vigueur&&<div style={{background:"rgba(24,128,56,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Entrée en vigueur</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_entree_vigueur)}</p></div>}
            {a.date_expiration&&<div style={{background:"rgba(227,83,54,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Expiration</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_expiration)}</p></div>}
          </div>
          {a.pays_signataires&&<div style={{marginBottom:16}}>
            <LBL>Parties signataires</LBL>
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
              {a.pays_signataires.split(", ").filter(Boolean).map((p:string)=>(
                <span key={p} style={{fontSize:12,fontWeight:600,color:"#366FE3",background:"rgba(54,111,227,0.07)",border:"1px solid rgba(54,111,227,0.18)",padding:"3px 11px",borderRadius:999}}>{p}</span>
              ))}
            </div>
          </div>}
          {th&&<div style={{marginBottom:16}}>
            <LBL>Thématiques</LBL>
            <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
              {th.secs.map((sec:string)=>(
                <div key={sec}>
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:th.bras.length?5:0}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:"#E35336",flexShrink:0}}/><span style={{fontSize:12,fontWeight:700,color:"#E35336"}}>{sec}</span>
                  </div>
                  {th.bras.length>0&&<div style={{paddingLeft:20,borderLeft:"2px solid rgba(227,83,54,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                    {th.bras.map((bra:string)=>(
                      <div key={bra}>
                        <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:th.acts.length?4:0}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/><span style={{fontSize:11,fontWeight:600,color:"#366FE3"}}>{bra}</span>
                        </div>
                        {th.acts.length>0&&<div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                          {th.acts.map((act:string)=>(
                            <div key={act} style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/><span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act}</span>
                            </div>
                          ))}
                        </div>}
                      </div>
                    ))}
                  </div>}
                </div>
              ))}
            </div>
          </div>}
          {fichiers.length>0&&<div style={{marginBottom:16}}>
            <LBL>Documents</LBL>
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
              {fichiers.map((f:any)=>(
                <a key={f.id} href={`${API_BASE}/accords/${a.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(227,83,54,0.06)",border:"1px solid rgba(227,83,54,0.18)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#E35336",textDecoration:"none",fontWeight:500}}>
                  <FileText size={11}/> {f.titre||f.fichier_nom}
                </a>
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
export default function AccordsPage() {
  const [tous,        setTous]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selec,       setSelec]       = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [paysDistincts, setPaysDistincts] = useState<{nom:string;code_iso2:string}[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);

  // Filtres
  const [recherche,    setRecherche]    = useState("");
  const [statutFiltre, setStatutFiltre] = useState("");
  const [paysFiltres,  setPaysFiltres]  = useState<string[]>([]);
  const [secteurSel,   setSecteurSel]   = useState("");
  const [branchesSel,  setBranchesSel]  = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);

  useEffect(()=>{
    const safe = (p:Promise<any>,fb:any)=>p.catch(()=>fb);
    Promise.all([
      safe(fetch(`${API_BASE}/accords/parties-distinctes`).then(r=>r.json()), {}),
      safe(fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),   []),
      safe(fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),   []),
      safe(fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),  []),
    ]).then(([partiesData,secsData,brasData,actsData])=>{
      setPaysDistincts(partiesData?.pays||[]);
      const tree=(secsData||[]).map((s:any)=>({...s,
        branches:(brasData||[]).filter((b:any)=>b.secteur_id===s.id).map((b:any)=>({...b,
          activites:(actsData||[]).filter((a:any)=>a.branche_id===b.id)
        }))
      }));
      setSecteurs(tree);
    });
  },[]);

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const res=await fetch(`${API_BASE}/accords?per_page=100`);
      const data=await res.json();
      setTous(data.data||[]);
    } catch(e){console.error(e);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{charger();},[charger]);

  // Filtrage côté client
  const accords = tous.filter(a=>{
    if (recherche) {
      const q=recherche.toLowerCase();
      if (!a.titre?.toLowerCase().includes(q)&&!a.reference?.toLowerCase().includes(q)&&!a.pays_signataires?.toLowerCase().includes(q)) return false;
    }
    if (statutFiltre&&a.statut!==statutFiltre) return false;
    if (paysFiltres.length>0&&!paysFiltres.some((p:string)=>a.pays_signataires?.includes(p))) return false;
    if (secteurSel&&!a.secteur_activite?.includes(`sec:${secteurSel}`)) return false;
    if (branchesSel.length>0&&!branchesSel.some(b=>a.secteur_activite?.includes(`bra:${b}`))) return false;
    if (activitesSel.length>0&&!activitesSel.some(ac=>a.secteur_activite?.includes(`act:${ac}`))) return false;
    return true;
  });

  const stats = {
    total: tous.length,
    en_vigueur: tous.filter(a=>a.statut==="en_vigueur").length,
  };

  const hasFilter=!!recherche||!!statutFiltre||paysFiltres.length>0||!!secteurSel||branchesSel.length>0||activitesSel.length>0;
  const reinit=()=>{setRecherche("");setStatutFiltre("");setPaysFiltres([]);setSecteurSel("");setBranchesSel([]);setActivitesSel([]);};
  const nbFiltres=(recherche?1:0)+(statutFiltre?1:0)+paysFiltres.length+(secteurSel?1:0)+branchesSel.length+activitesSel.length;

  const togglePays    =(v:string)=>setPaysFiltres(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleBranche =(v:string)=>{setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setActivitesSel([]);};
  const toggleActivite=(v:string)=>setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const setSecteur    =(v:string)=>{setSecteurSel(v);setBranchesSel([]);setActivitesSel([]);};

  return (
    <main style={{minHeight:"100vh",background:"#F2F0EF",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar/>

      {/* Hero */}
      <section style={{padding:"100px 40px 48px",background:"linear-gradient(160deg,#1a1a2e 0%,#2a2a4e 60%,#366FE3 100%)",position:"relative" as const,overflow:"hidden"}}>
        <div style={{position:"absolute" as const,inset:0,background:"linear-gradient(160deg,rgba(26,26,46,0.96),rgba(54,111,227,0.25))"}}/>
        <div style={{maxWidth:1280,margin:"0 auto",position:"relative" as const,zIndex:1}}>
          <p style={{fontSize:11,fontWeight:700,color:"#FFB0A1",letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:10}}>APIX · Plateforme investissements</p>
          <h1 style={{fontWeight:800,fontSize:"clamp(2.2rem,4vw,3.2rem)",color:"#fff",lineHeight:1.1,marginBottom:16}}>Accords &amp; Traités</h1>
          <p style={{color:"rgba(255,255,255,0.7)",fontSize:15,maxWidth:540,lineHeight:1.7,marginBottom:24}}>Accords internationaux de coopération économique et traités bilatéraux d'investissement signés par le Sénégal.</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap" as const}}>
            {stats.total>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>{stats.total} accord{stats.total>1?"s":""}</span>}
            {stats.en_vigueur>0&&<span style={{fontSize:13,fontWeight:700,color:"#15803d",background:"#dcfce7",padding:"6px 14px",borderRadius:999}}>{stats.en_vigueur} en vigueur</span>}
          </div>
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
                  style={{background:"rgba(54,111,227,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
                  <SlidersHorizontal size={14} style={{color:"#366FE3"}}/>
                  {sidebarOpen&&nbFiltres>0&&<span style={{fontSize:10,fontWeight:700,color:"#366FE3",background:"rgba(54,111,227,0.15)",borderRadius:999,padding:"1px 5px"}}>{nbFiltres}</span>}
                </button>
              </div>

              {sidebarOpen&&<>
                {hasFilter&&<button onClick={reinit} style={{display:"flex",alignItems:"center",gap:5,width:"100%",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:8,padding:"7px 10px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:16}}>
                  <X size={12}/> Effacer tous les filtres
                </button>}

                {/* Recherche */}
                <div style={{position:"relative" as const,marginBottom:18}}>
                  <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                  <input value={recherche} onChange={e=>setRecherche(e.target.value)} placeholder="Titre, référence, partie…"
                    style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                  {recherche&&<button onClick={()=>setRecherche("")} style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                </div>

                {/* Statut */}
                <div style={{marginBottom:18}}>
                  <p style={{fontSize:11,fontWeight:700,color:statutFiltre?"#366FE3":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>Statut</p>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                    {STATUT_OPTS.map(b=>(
                      <button key={b.value} onClick={()=>setStatutFiltre(b.value)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",background:statutFiltre===b.value?b.bg:"transparent",cursor:"pointer",textAlign:"left" as const,fontSize:12,fontWeight:statutFiltre===b.value?700:400,color:statutFiltre===b.value?b.text:"#4a5568"}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:b.text,opacity:statutFiltre===b.value?1:0.3,flexShrink:0}}/>{b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <SideFilter label="Parties signataires" color="#366FE3" selected={paysFiltres} onToggle={togglePays}
                  items={paysDistincts.map((p:any)=>({value:p.nom,label:p.nom,flag:p.code_iso2?flag(p.code_iso2):undefined}))}/>

                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs}
                  secteurSel={secteurSel} branchesSel={branchesSel} activitesSel={activitesSel}
                  onSecteur={setSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
              </>}
            </div>
          </div>

          {/* Grille accords */}
          <div style={{flex:1,minWidth:0}}>
            {loading ? (
              <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:300,gap:12,color:"#9aa5b4"}}>
                <Loader2 size={24} style={{animation:"spin 1s linear infinite"}}/><span style={{fontSize:14}}>Chargement…</span>
              </div>
            ) : accords.length===0 ? (
              <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                <FileText size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucun accord trouvé</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<button onClick={reinit} style={{marginTop:16,padding:"8px 18px",borderRadius:10,border:"none",background:"#366FE3",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>Effacer les filtres</button>}
              </div>
            ) : (
              <>
                <p style={{fontSize:13,color:"#9aa5b4",marginBottom:16}}>{accords.length} accord{accords.length>1?"s":""}{hasFilter?" trouvé"+(accords.length>1?"s":""):""}</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:12}}>
                  {accords.map(a=>(
                    <div key={a.id} onClick={()=>setSelec(a)}
                      style={{background:"#fff",borderTop:"1px solid #E8E5E3",borderRight:"1px solid #E8E5E3",borderBottom:"1px solid #E8E5E3",borderLeft:"3px solid #366FE3",borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}
                      onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(54,111,227,0.12)";ev.currentTarget.style.borderTopColor="#FFB0A1";ev.currentTarget.style.borderRightColor="#FFB0A1";ev.currentTarget.style.borderBottomColor="#FFB0A1";}}
                      onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderTopColor="#E8E5E3";ev.currentTarget.style.borderRightColor="#E8E5E3";ev.currentTarget.style.borderBottomColor="#E8E5E3";}}>
                      {/* Titre */}
                      <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:a.reference?2:8}}>{a.titre}</div>
                      {a.reference&&<div style={{fontSize:11,fontWeight:600,color:"#9aa5b4",marginBottom:8}}>{a.reference}</div>}
                      {/* Infos */}
                      <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:10}}>
                        {a.date_expiration&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"#E35336",flexShrink:0}}/><span style={{color:"#4a5568"}}>Expire le {fmtDate(a.date_expiration)}</span>
                        </div>}
                        {a.pays_signataires&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"#366FE3",flexShrink:0}}/><span style={{color:"#4a5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.pays_signataires}</span>
                        </div>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid #F2F0EF",paddingTop:8}}>
                        <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:999,
                          color:a.statut==="en_vigueur"?"#15803d":"#6b7280",
                          background:a.statut==="en_vigueur"?"rgba(21,128,61,0.08)":"#f3f4f6"}}>
                          {a.statut==="en_vigueur"?"En vigueur":"Expiré"}
                        </span>
                        <span style={{fontSize:11,color:"#366FE3",fontWeight:600}}>Voir les détails →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {selec&&<AccordVue accord={selec} onClose={()=>setSelec(null)}/>}
    </main>
  );
}
