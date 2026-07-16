"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import Badge, { BadgeVariant } from "@/components/shared/Badge";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { ChevronDown, ChevronUp, FileText, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthGate } from "@/lib/authGate";
import AccordVueModal, { computeStatut, fmtDate } from "@/components/shared/AccordVueModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUT_VARIANT: Record<string, BadgeVariant> = { en_vigueur:"green", signe:"blue", expire:"orange" };

// Badges de statut — pastels (fond très clair, texte foncé de la même teinte)
const foncerPastel = (hex:string) => {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  const mn=Math.min(r,g,b);
  const f=(v:number)=>Math.round(Math.max(0,Math.min(255,((v-mn)*2+mn*0.22)*0.85)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};
const STATUT_LABELS: Record<string,string> = { en_vigueur:"En vigueur", expire:"Expiré", signe:"Signé non en vigueur" };

const STATUT_OPTS = [
  { value:"",           label:"Tous",        bg:"#F2F0EF",             text:"#4a5568" },
  { value:"en_vigueur", label:"En vigueur",  bg:"rgba(0,79,145,0.08)", text:"#004f91" },
  { value:"expire",     label:"Expirés",     bg:"#f3f4f6",             text:"#6b7280" },
];

function SideFilter({ label, items, selected, onToggle, color, listMaxHeight }: {
  label:string; items:{value:string;label:string}[];
  selected:string[]; onToggle:(v:string)=>void; color:string; listMaxHeight?:number;
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
        <span style={{width:20,height:20,borderRadius:"50%",background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {open?<ChevronUp size={11} style={{color:"#4a5568"}}/>:<ChevronDown size={11} style={{color:"#4a5568"}}/>}
        </span>
      </button>
      {open&&(
        <div style={{display:"flex",flexDirection:"column" as const,gap:2,maxHeight:listMaxHeight,overflowY:listMaxHeight?"auto" as const:undefined}}>
          {items.map(item=>{
            const sel=selected.includes(item.value);
            return (
              <button key={item.value} onClick={()=>onToggle(item.value)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?color:"#C5BFBB"}`,background:sel?color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  </div>
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThematiquesCascadeFilter({ secteurs, secteursSel, branchesSel, activitesSel, onSecteur, onBranche, onActivite }: {
  secteurs:any[]; secteursSel:string[]; branchesSel:string[]; activitesSel:string[];
  onSecteur:(v:string)=>void; onBranche:(v:string)=>void; onActivite:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const branches = secteurs.filter(s=>secteursSel.includes(s.nom)).flatMap((s:any)=>s.branches||[]);
  const activites = branches.filter((b:any)=>branchesSel.includes(b.nom)).flatMap((b:any)=>b.activites||[]);
  return (
    <div>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Thématiques</span>
          {secteursSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.1)",padding:"1px 6px",borderRadius:999}}>{secteursSel.length}</span>}
          {branchesSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.1)",padding:"1px 6px",borderRadius:999}}>{branchesSel.length}</span>}
          {activitesSel.length>0&&<span style={{fontSize:10,fontWeight:700,color:"#188038",background:"rgba(24,128,56,0.1)",padding:"1px 6px",borderRadius:999}}>{activitesSel.length}</span>}
        </div>
        <span style={{width:20,height:20,borderRadius:"50%",background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {open?<ChevronUp size={11} style={{color:"#4a5568"}}/>:<ChevronDown size={11} style={{color:"#4a5568"}}/>}
        </span>
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
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{s.nom}</span>
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
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{b.nom}</span>
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
                <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{a.nom}</span>
              </button>);})}
          </div>
        </div>}
      </div>}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AccordsPage() {
  const gate = useAuthGate();
  const [tous,        setTous]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [erreur,      setErreur]      = useState(false);
  const [selec,       setSelec]       = useState<any>(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      setSidebarWidth(Math.max(200, Math.min(520, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      isResizing.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  const [paysDistincts, setPaysDistincts] = useState<{id:number;nom:string;code_iso2:string}[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [allPays,     setAllPays]     = useState<any[]>([]);

  const [recherche,      setRecherche]      = useState("");
  const [statutFiltre,   setStatutFiltre]   = useState("");
  // Type de traité (onglet hero) : bilatéraux d'investissement / internationaux (à venir)
  const [typeTraite,     setTypeTraite]     = useState<"tbi"|"inter">("tbi");
  const [paysIdsFiltres, setPaysIdsFiltres] = useState<number[]>([]);
  const [secteursSel,    setSecteursSel]    = useState<string[]>([]);
  const [branchesSel,    setBranchesSel]    = useState<string[]>([]);
  const [activitesSel,   setActivitesSel]   = useState<string[]>([]);
  const [apixFiltre,     setApixFiltre]     = useState(false);
  const [partiesOpen,    setPartiesOpen]    = useState(true);

  useEffect(()=>{
    const safe = (p:Promise<any>,fb:any)=>p.catch(()=>fb);
    Promise.all([
      safe(fetch(`${API_BASE}/accords/parties-distinctes`).then(r=>r.json()), {}),
      safe(fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),   []),
      safe(fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),   []),
      safe(fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),  []),
      safe(fetch(`${API_BASE}/entreprises/ref/pays`).then(r=>r.json()),       []),
    ]).then(([partiesData,secsData,brasData,actsData,paysData])=>{
      setPaysDistincts(partiesData?.pays||[]);
      setAllPays(paysData||[]);
      const tree=(secsData||[]).map((s:any)=>({...s,
        branches:(brasData||[]).filter((b:any)=>b.secteur_id===s.id).map((b:any)=>({...b,
          activites:(actsData||[]).filter((a:any)=>a.branche_id===b.id)
        }))
      }));
      setSecteurs(tree);
    });
  },[]);

  // Chargement principal : en cas d'échec, état d'erreur avec relance
  const charger = useCallback(async()=>{
    setLoading(true); setErreur(false);
    try {
      const res=await fetch(`${API_BASE}/accords?per_page=100`);
      if(!res.ok) throw new Error();
      const data=await res.json();
      setTous(data.data||[]);
    } catch(e){console.error(e); setErreur(true);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{charger();},[charger]);

  const getPaysNoms = (a:any, max=2): string => {
    let noms: string[] = [];
    if (a.parties_pays_ids?.length>0) {
      noms = (a.parties_pays_ids as number[])
        .map((id:number)=>allPays.find((r:any)=>r.id===id)?.nom_fr)
        .filter(Boolean) as string[];
    } else if (a.parties_signataires) {
      noms = a.parties_signataires.split(", ").filter(Boolean);
    }
    if (max && noms.length > max) return noms.slice(0, max).join(", ") + `, +${noms.length - max}`;
    return noms.join(", ");
  };

  const accords = tous.filter(a=>{
    // Onglet actif = Traités Bilatéraux d'Investissement (l'existant sans type est bilatéral)
    if ((a.type_accord || "tbi") !== "tbi") return false;
    if (recherche) {
      const q=recherche.toLowerCase();
      const paysStr=getPaysNoms(a).toLowerCase();
      if (!a.titre?.toLowerCase().includes(q)&&!a.reference?.toLowerCase().includes(q)&&!paysStr.includes(q)) return false;
    }
    if (statutFiltre&&computeStatut(a)!==statutFiltre) return false;
    const hasPartiesFilter = paysIdsFiltres.length>0||apixFiltre;
    if (hasPartiesFilter) {
      const matchesPays = paysIdsFiltres.length>0&&paysIdsFiltres.some(id=>(a.parties_pays_ids||[]).includes(id));
      const matchesApix = apixFiltre&&!!(a.parties_signataires?.toLowerCase().includes("apix"));
      if (!matchesPays&&!matchesApix) return false;
    }
    if (secteursSel.length>0) {
      const secIds=secteursSel.map((nom:string)=>secteurs.find((s:any)=>s.nom===nom)?.id).filter(Boolean);
      if (!secIds.some((id:number)=>(a.secteur_ids||[]).includes(id))) return false;
    }
    if (branchesSel.length>0) {
      const braIds=branchesSel.map((nom:string)=>secteurs.flatMap((s:any)=>s.branches||[]).find((b:any)=>b.nom===nom)?.id).filter(Boolean);
      if (!braIds.some((id:number)=>(a.branche_ids||[]).includes(id))) return false;
    }
    if (activitesSel.length>0) {
      const actIds=activitesSel.map((nom:string)=>secteurs.flatMap((s:any)=>s.branches||[]).flatMap((b:any)=>b.activites||[]).find((ac:any)=>ac.nom===nom)?.id).filter(Boolean);
      if (!actIds.some((id:number)=>(a.activite_ids||[]).includes(id))) return false;
    }
    return true;
  }).sort((a:any,b:any)=>{
    if (!a.date_expiration && !b.date_expiration) return 0;
    if (!a.date_expiration) return 1;
    if (!b.date_expiration) return -1;
    return a.date_expiration.localeCompare(b.date_expiration);
  });

  const stats = {
    total:      tous.length,
    en_vigueur: tous.filter(a=>computeStatut(a)==="en_vigueur").length,
    expire:     tous.filter(a=>computeStatut(a)==="expire").length,
  };
  const hasFilter=!!recherche||!!statutFiltre||paysIdsFiltres.length>0||apixFiltre||secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  const reinit=()=>{setRecherche("");setStatutFiltre("");setPaysIdsFiltres([]);setApixFiltre(false);setSecteursSel([]);setBranchesSel([]);setActivitesSel([]);};
  const nbFiltres=(recherche?1:0)+(statutFiltre?1:0)+paysIdsFiltres.length+(apixFiltre?1:0)+secteursSel.length+branchesSel.length+activitesSel.length;

  const toggleBranche =(v:string)=>{setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setActivitesSel([]);};
  const toggleActivite=(v:string)=>setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleSecteur =(v:string)=>{setSecteursSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setBranchesSel([]);setActivitesSel([]);};
  const togglePaysId  =(id:number)=>setPaysIdsFiltres(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const senegalId  = paysDistincts.find((p:any)=>p.nom==="Sénégal")?.id;
  const autresPays = paysDistincts.filter((p:any)=>p.nom!=="Sénégal").sort((a:any,b:any)=>a.nom.localeCompare(b.nom,"fr"));

  return (
    <main style={{minHeight:"100vh",background:"#F6F5F3",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar/>

      {/* Hero */}
      <BarreTitre titre={"Accords & Traités"}>
        <BarreTitreSegment options={[
          {v:"tbi",   l:"Traités Bilatéraux d'Investissement"},
          {v:"inter", l:"Traités Internationaux", badge:"Bientôt"},
        ]} value={typeTraite} onChange={setTypeTraite}/>
      </BarreTitre>

      {typeTraite === "inter" ? (
      /* Traités internationaux — à venir */
      <div style={{maxWidth:1400,margin:"0 auto",padding:"80px 40px",textAlign:"center" as const}}>
        <div style={{display:"inline-flex",flexDirection:"column" as const,alignItems:"center",gap:16}}>
          <div style={{width:64,height:64,borderRadius:16,background:"rgba(0,79,145,0.08)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <FileText size={28} style={{color:"#004f91"}}/>
          </div>
          <h2 style={{fontWeight:800,fontSize:"1.4rem",color:"#1a1a2e"}}>Traités Internationaux</h2>
          <p style={{fontSize:14,color:"#9aa5b4",maxWidth:380,lineHeight:1.7}}>Les traités internationaux seront disponibles prochainement.</p>
          <div style={{background:"rgba(0,79,145,0.07)",border:"1px solid rgba(0,79,145,0.2)",borderRadius:10,padding:"10px 20px"}}>
            <span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>Disponible prochainement</span>
          </div>
        </div>
      </div>
      ) : (
      /* Layout sidebar + contenu */
      <div style={{display:"flex",alignItems:"flex-start"}}>

          {/* Sidebar bande */}
          <aside style={{width:sidebarOpen?sidebarWidth:52,flexShrink:0,transition:isResizing.current?"none":"width 0.25s",background:"#fff",borderRight:"1px solid #E8E5E3",height:"calc(100vh - 64px)",overflowY:"auto" as const,position:"sticky" as const,top:64,display:"flex",flexDirection:"column" as const}}>
            <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
            {/* Handle de resize */}
            {sidebarOpen&&<div onMouseDown={startResize}
              style={{position:"absolute" as const,right:0,top:0,bottom:0,width:4,cursor:"col-resize",zIndex:10,background:"transparent",transition:"background 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
            {/* Header toggle */}
            <div style={{padding:sidebarOpen?"14px 16px 10px":"12px 8px",borderBottom:"1px solid #F2F0EF",display:"flex",alignItems:"center",justifyContent:sidebarOpen?"space-between":"center",flexShrink:0}}>
              {sidebarOpen&&<span style={{fontSize:12,fontWeight:700,color:"#1a1a2e",letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Filtres</span>}
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <button onClick={()=>setSidebarOpen(o=>!o)}
                  style={{background:"rgba(0,79,145,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
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
                  {recherche&&<button onClick={()=>setRecherche("")} style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                </div>
                {/* Statut */}
                <div style={{marginBottom:18}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Statut</span>
                    {statutFiltre&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.1)",padding:"1px 6px",borderRadius:999}}>1</span>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                    {[
                      {v:"",           l:"Tous"},
                      {v:"en_vigueur", l:"En vigueur"},
                      {v:"signe",      l:"Signés non en vigueur"},
                      {v:"expire",     l:"Expirés"},
                    ].map(o=>{const sel=statutFiltre===o.v; return (
                      <button key={o.v} onClick={()=>setStatutFiltre(o.v)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const,width:"100%"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#004f91":"#C5BFBB"}`,background:sel?"#004f91":"transparent",flexShrink:0}}/>
                        <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{o.l}</span>
                      </button>
                    );})}
                  </div>
                </div>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                {/* Parties signataires — section personnalisée */}
                <div style={{marginBottom:18}}>
                  <button onClick={()=>setPartiesOpen(o=>!o)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:partiesOpen?8:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Parties signataires</span>
                      {(paysIdsFiltres.length>0||apixFiltre)&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.1)",padding:"1px 6px",borderRadius:999}}>{paysIdsFiltres.length+(apixFiltre?1:0)}</span>}
                    </div>
                    <span style={{width:20,height:20,borderRadius:"50%",background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {partiesOpen?<ChevronUp size={11} style={{color:"#4a5568"}}/>:<ChevronDown size={11} style={{color:"#4a5568"}}/>}
        </span>
                  </button>
                  {partiesOpen&&<div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                    {/* Sénégal */}
                    {senegalId!==undefined&&(()=>{const sel=paysIdsFiltres.includes(senegalId); return (
                      <button onClick={()=>togglePaysId(senegalId)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const,width:"100%"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#004f91":"#C5BFBB"}`,background:sel?"#004f91":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                                  </div>
                        <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>Sénégal</span>
                      </button>
                    );})()}
                    {/* APIX S.A */}
                    {(()=>{const sel=apixFiltre; return (
                      <button onClick={()=>setApixFiltre(f=>!f)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const,width:"100%"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#004f91":"#C5BFBB"}`,background:sel?"#004f91":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                                  </div>
                        <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>APIX S.A</span>
                      </button>
                    );})()}
                    {/* Sous-section Pays */}
                    {autresPays.length>0&&<>
                      <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.08em",margin:"8px 0 2px",padding:"0 8px"}}>Pays</p>
                      <div style={{maxHeight:160,overflowY:"auto" as const}}>
                        {autresPays.map((p:any)=>{const sel=paysIdsFiltres.includes(p.id); return (
                          <button key={p.id} onClick={()=>togglePaysId(p.id)}
                            style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const,width:"100%"}}
                            onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                            onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                            <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"#004f91":"#C5BFBB"}`,background:sel?"#004f91":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                                          </div>
                            <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{p.nom}</span>
                          </button>
                        );})}
                      </div>
                    </>}
                  </div>}
                </div>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs}
                  secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel}
                  onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
            </div>}
          </aside>

          {/* Grille accords */}
          <div style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>
            {loading ? (
              <SkeletonCards n={6} cols={2} height={200}/>
            ) : erreur ? (
              <ErreurChargement onRetry={()=>charger()}/>
            ) : accords.length===0 ? (
              <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                <FileText size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucun accord trouvé</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<button onClick={reinit} style={{marginTop:16,padding:"8px 18px",borderRadius:10,border:"none",background:"#004f91",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>Effacer les filtres</button>}
              </div>
            ) : (
              <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:14}}>
                {accords.map(a=>{
                  const statut = computeStatut(a);
                  // Pastels alignés sur les rôles des événements : en vigueur
                  // vert tendre, signé bleu clair, expiré pêche
                  const ST: any = {
                    en_vigueur: { label:"En vigueur",            p:"#B4DE9D" },
                    signe:      { label:"Signé non en vigueur",  p:"#9DC3E6" },
                    expire:     { label:"Expiré",                p:"#E6C79D" },
                  };
                  const st = statut ? ST[statut] : null;
                  const estExpire = statut==="expire";
                  const txtC = estExpire ? "#4a5568" : "#1a1a2e";
                  // Date secondaire : expiration si renseignée, sinon entrée en vigueur
                  const dateSec = a.date_expiration
                    ? { label:"Expiration", val:fmtDate(a.date_expiration), vide:false }
                    : { label:"Entrée en vigueur", val:a.date_entree_vigueur?fmtDate(a.date_entree_vigueur):"Non définie", vide:!a.date_entree_vigueur };
                  // Accent du survol = pastel du statut
                  const accent = st ? st.p : "#C5BFBB";
                  return (
                  <div key={a.id} onClick={()=>gate(()=>setSelec(a))}
                    style={{background:estExpire?"#FBFAF9":"#fff",border:"1px solid #ECEAE7",borderRadius:16,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 2px rgba(0,0,0,0.03)",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:13}}
                    onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 14px 32px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=accent;}}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";}}>

                    {/* Titre + référence | statut pastel à droite */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontWeight:800,fontSize:15.5,color:txtC,lineHeight:1.35,letterSpacing:"-0.01em"}}>{a.titre}</div>
                        {a.reference&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginTop:3}}>{a.reference}</div>}
                      </div>
                      {st&&(
                        <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:foncerPastel(st.p),background:`${st.p}40`,border:`1px solid ${st.p}90`,padding:"3px 11px",borderRadius:999,whiteSpace:"nowrap" as const,flexShrink:0}}>
                          {st.label}
                        </span>
                      )}
                    </div>

                    {/* Dates en rangée épurée + flèche d'action */}
                    <div style={{display:"flex",alignItems:"center",borderTop:"1px solid #F2F0EF",paddingTop:13,marginTop:"auto"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Signature</p>
                        <p style={{fontSize:12.5,fontWeight:700,color:a.date_signature?txtC:"#C5BFBB",fontVariantNumeric:"tabular-nums"}}>{a.date_signature?fmtDate(a.date_signature):"—"}</p>
                      </div>
                      <div style={{width:1,alignSelf:"stretch",background:"#F2F0EF",margin:"0 18px"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>{dateSec.label}</p>
                        <p style={{fontSize:12.5,fontWeight:700,color:dateSec.vide?"#C5BFBB":txtC,fontVariantNumeric:"tabular-nums"}}>{dateSec.val}</p>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
      </div>
      )}

      {selec&&<AccordVueModal accord={selec} onClose={()=>setSelec(null)}/>}
    </main>
  );
}
