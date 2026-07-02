"use client";

import Navbar from "@/components/layout/Navbar";
import Badge, { BadgeVariant } from "@/components/shared/Badge";
import { ChevronDown, ChevronUp, FileText, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmtDate(d: string) {
  if (!d) return "—";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
}

function computeStatut(a: any): "en_vigueur"|"expire"|"signe"|null {
  const today = new Date().toISOString().split("T")[0];
  if (a.date_expiration && a.date_expiration < today) return "expire";
  if (a.date_signature && a.date_entree_vigueur && a.date_signature <= today && today < a.date_entree_vigueur) return "signe";
  const ref = a.date_entree_vigueur || a.date_signature;
  if (ref && ref <= today) return "en_vigueur";
  return null;
}

const STATUT_VARIANT: Record<string, BadgeVariant> = { en_vigueur:"green", signe:"blue", expire:"gray" };
const STATUT_LABELS: Record<string,string> = { en_vigueur:"En vigueur", expire:"Expiré", signe:"Signé" };

const STATUT_OPTS = [
  { value:"",           label:"Tous",        bg:"#F2F0EF",             text:"#4a5568" },
  { value:"en_vigueur", label:"En vigueur",  bg:"#dcfce7",             text:"#15803d" },
  { value:"signe",      label:"Signé",       bg:"rgba(0,79,145,0.08)", text:"#004f91" },
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
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
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

// ── Modal vue accord ─────────────────────────────────────────────────────────
function AccordVue({ accord:a, onClose }: { accord:any; onClose:()=>void }) {
  const [fichiers,  setFichiers]  = useState<any[]>([]);
  const [secteurs,  setSecteurs]  = useState<any[]>([]);
  const [branches,  setBranches]  = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);
  const [allPays,   setAllPays]   = useState<any[]>([]);

  useEffect(()=>{
    fetch(`${API_BASE}/accords/${a.id}/fichiers`).then(r=>r.json()).then(setFichiers).catch(()=>{});
    fetch(`${API_BASE}/entreprises/ref/pays`).then(r=>r.json()).then(setAllPays).catch(()=>{});
    Promise.all([
      fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),
      fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),
    ]).then(([s,b,ac])=>{ setSecteurs(s||[]); setBranches(b||[]); setActivites(ac||[]); }).catch(()=>{});
  },[a.id]);

  const statut = computeStatut(a);
  const ST_VUE: any = {
    en_vigueur: { label:"En vigueur", c:"#188038", bg:"rgba(24,128,56,0.08)" },
    signe:      { label:"Signé",     c:"#004f91", bg:"rgba(0,79,145,0.07)"  },
    expire:     { label:"Expiré",    c:"#6b7280", bg:"#F2F0EF"              },
  };
  const stV = statut ? ST_VUE[statut] : null;
  const secIds:number[] = a.secteur_ids  || [];
  const braIds:number[] = a.branche_ids  || [];
  const actIds:number[] = a.activite_ids || [];
  const hasNaema = secIds.length>0||braIds.length>0||actIds.length>0;
  const SecTitle = ({children}:{children:string}) => (
    <p style={{fontSize:10.5,fontWeight:700,color:"#004f91",letterSpacing:"0.14em",textTransform:"uppercase" as const,marginBottom:10}}>{children}</p>
  );
  const Bloc = ({label,children}:{label:string;children:React.ReactNode}) => (
    <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"9px 12px",minWidth:0}}>
      <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>{label}</p>
      {children}
    </div>
  );

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(2,20,38,0.45)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column" as const,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,30,60,0.28)",animation:"vueIn 0.22s ease"}}>
        {/* Liseré d'accent */}
        <div style={{height:4,background:"#004f91",flexShrink:0}}/>

        {/* En-tête */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,padding:"18px 28px 16px",borderBottom:"1px solid #F2F0EF",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <h2 style={{fontWeight:800,fontSize:"1.1rem",color:"#1a1a2e",lineHeight:1.3}}>{a.titre}</h2>
            <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginTop:8}}>
              {stV&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:stV.c,background:stV.bg,padding:"3px 10px",borderRadius:999}}>{stV.label}</span>}
              {a.reference&&<span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{a.reference}</span>}
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"#F5F4F3",border:"none",cursor:"pointer",borderRadius:99,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}
            onMouseEnter={ev=>(ev.currentTarget.style.background="#ECEAE8")}
            onMouseLeave={ev=>(ev.currentTarget.style.background="#F5F4F3")}>
            <X size={15} color="#4a5568"/>
          </button>
        </div>

        {/* Corps */}
        <div style={{padding:"22px 28px",overflowY:"auto" as const,flex:1,display:"flex",flexDirection:"column" as const,gap:22}}>

          {/* Dates */}
          <section>
            <SecTitle>Dates</SecTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Bloc label="Signature"><p style={{fontSize:12.5,fontWeight:600,color:a.date_signature?"#1a1a2e":"#9aa5b4"}}>{a.date_signature?fmtDate(a.date_signature):"—"}</p></Bloc>
              {a.date_entree_vigueur&&<Bloc label="Entrée en vigueur"><p style={{fontSize:12.5,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_entree_vigueur)}</p></Bloc>}
              <Bloc label="Expiration"><p style={{fontSize:12.5,fontWeight:600,color:a.date_expiration?"#1a1a2e":"#9aa5b4"}}>{a.date_expiration?fmtDate(a.date_expiration):"Non définie"}</p></Bloc>
            </div>
          </section>

          {/* Résumé */}
          {a.commentaires&&(
            <section>
              <SecTitle>Résumé</SecTitle>
              <div style={{background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,padding:"13px 15px"}}>
                <style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style>
                <div data-rte dangerouslySetInnerHTML={{__html:a.commentaires}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/>
              </div>
            </section>
          )}

          {/* Parties signataires */}
          {(a.parties_pays_ids?.length>0||a.parties_signataires)&&(
            <section>
              <SecTitle>Parties signataires</SecTitle>
              <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>
                {(a.parties_pays_ids||[]).map((id:number)=>{
                  const p=allPays.find((r:any)=>r.id===id);
                  return <span key={id} style={{fontSize:11,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",padding:"3px 10px",borderRadius:999}}>{p?.nom_fr||`#${id}`}</span>;
                })}
                {a.parties_signataires&&a.parties_signataires.split(", ").filter(Boolean).map((p:string)=>(
                  <span key={p} style={{fontSize:11,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.07)",padding:"3px 10px",borderRadius:999}}>{p}</span>
                ))}
              </div>
            </section>
          )}

          {/* Thématiques */}
          {hasNaema&&(
            <section>
              <SecTitle>Thématiques</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {secIds.map((secId:number)=>{
                  const secNom=secteurs.find(s=>s.id===secId)?.nom;
                  if (!secNom) return null;
                  const brasDuSec=branches.filter(b=>b.secteur_id===secId&&braIds.includes(b.id));
                  return (
                    <div key={secId}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#004f91"}}>{secNom}</span>
                      </div>
                      {brasDuSec.length>0&&<div style={{paddingLeft:20,borderLeft:"2px solid rgba(0,79,145,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                        {brasDuSec.map((bra:any)=>{
                          const actsDeBra=activites.filter(ac=>ac.branche_id===bra.id&&actIds.includes(ac.id));
                          return (
                            <div key={bra.id}>
                              <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                                <div style={{width:6,height:6,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                                <span style={{fontSize:11,fontWeight:600,color:"#ca631f"}}>{bra.nom}</span>
                              </div>
                              {actsDeBra.length>0&&<div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>
                                {actsDeBra.map((act:any)=>(
                                  <div key={act.id} style={{display:"flex",alignItems:"center",gap:6}}>
                                    <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                                    <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act.nom}</span>
                                  </div>
                                ))}
                              </div>}
                            </div>
                          );
                        })}
                      </div>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Documents */}
          {fichiers.length>0&&(
            <section>
              <SecTitle>{fichiers.length>1?"Documents":"Document"}</SecTitle>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                {fichiers.map((f:any)=>(
                  <a key={f.id} href={`${API_BASE}/accords/${a.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                    style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,79,145,0.05)",border:"1px solid rgba(0,79,145,0.15)",borderRadius:10,padding:"9px 12px",textDecoration:"none"}}>
                    <FileText size={13} style={{color:"#004f91",flexShrink:0}}/>
                    <span style={{fontSize:12.5,color:"#004f91",fontWeight:600}}>{f.titre||f.fichier_nom}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Pied */}
        <div style={{display:"flex",justifyContent:"flex-end",padding:"14px 28px",borderTop:"1px solid #F2F0EF",background:"#FCFBFA",flexShrink:0}}>
          <button onClick={onClose}
            style={{padding:"10px 20px",borderRadius:10,border:"1px solid #E4E1DE",background:"#fff",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"var(--font-google-sans)"}}>
            Fermer
          </button>
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
    <main style={{minHeight:"100vh",background:"#F2F0EF",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar/>

      {/* Hero */}
      <section style={{padding:"100px 40px 40px",background:"linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)",position:"relative" as const,overflow:"hidden"}}>
        <div style={{position:"absolute" as const,inset:0,pointerEvents:"none"}}>
          <div style={{position:"absolute" as const,bottom:"-20%",left:"-5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,255,255,0.05) 0%,transparent 65%)"}}/>
        </div>
        <div style={{maxWidth:1280,margin:"0 auto",position:"relative" as const,zIndex:1}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(202,99,31,0.1)",border:"1px solid rgba(202,99,31,0.25)",borderRadius:999,padding:"6px 14px",marginBottom:17}}>
            <span style={{fontSize:11,fontWeight:700,color:"#D96D3B",letterSpacing:"0.15em",textTransform:"uppercase"}}>Plateforme de Promotion des Investissements et des Investisseurs</span>
          </div>
          <h1 style={{fontWeight:800,fontSize:"clamp(2.2rem,4vw,3.2rem)",color:"#fff",lineHeight:1.1,marginBottom:24}}>Accords &amp; Traités</h1>
          <div style={{display:"flex",gap:10,flexWrap:"wrap" as const}}>
            {stats.total>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>{stats.total} accord{stats.total>1?"s":""}</span>}
            {stats.en_vigueur>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(21,128,61,0.25)",border:"1px solid rgba(21,128,61,0.4)",padding:"6px 14px",borderRadius:999}}>{stats.en_vigueur} en vigueur</span>}
            {stats.expire>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(107,114,128,0.25)",border:"1px solid rgba(107,114,128,0.4)",padding:"6px 14px",borderRadius:999}}>{stats.expire} expiré{stats.expire>1?"s":""}</span>}
          </div>
        </div>
      </section>

      {/* Layout sidebar + contenu */}
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
                <div style={{marginBottom:18}}>
                  <p style={{fontSize:11,fontWeight:700,color:statutFiltre?"#004f91":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>Statut</p>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                    {STATUT_OPTS.map(b=>(
                      <button key={b.value} onClick={()=>setStatutFiltre(b.value)}
                        className="sb-item-row"
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",background:"transparent",cursor:"pointer",textAlign:"left" as const,fontSize:12,fontWeight:statutFiltre===b.value?700:400,color:statutFiltre===b.value?b.text:"#4a5568"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:b.text,opacity:statutFiltre===b.value?1:0.3,flexShrink:0}}/>{b.label}
                      </button>
                    ))}
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
                    {partiesOpen?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
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
              <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:300,gap:12,color:"#9aa5b4"}}>
                <Loader2 size={24} style={{animation:"spin 1s linear infinite"}}/><span style={{fontSize:14}}>Chargement…</span>
              </div>
            ) : accords.length===0 ? (
              <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                <FileText size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucun accord trouvé</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<button onClick={reinit} style={{marginTop:16,padding:"8px 18px",borderRadius:10,border:"none",background:"#004f91",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>Effacer les filtres</button>}
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:14}}>
                {accords.map(a=>{
                  const statut = computeStatut(a);
                  const ST: any = {
                    en_vigueur: { label:"En vigueur", c:"#188038", bg:"rgba(24,128,56,0.08)" },
                    signe:      { label:"Signé",     c:"#004f91", bg:"rgba(0,79,145,0.07)"  },
                    expire:     { label:"Expiré",    c:"#6b7280", bg:"#F2F0EF"              },
                  };
                  const st = statut ? ST[statut] : null;
                  return (
                  <div key={a.id} onClick={()=>setSelec(a)}
                    style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:14,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 3px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden"}}
                    onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";}}>

                    <div style={{padding:"14px 16px 14px",flex:1}}>
                      {/* Statut + référence */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        {st ? (
                          <span style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:st.c,background:st.bg,padding:"3px 10px",borderRadius:999}}>{st.label}</span>
                        ) : <span/>}
                        {a.reference && <span style={{fontSize:10.5,fontWeight:600,color:"#9aa5b4"}}>{a.reference}</span>}
                      </div>

                      {/* Titre */}
                      <div style={{fontWeight:700,fontSize:13.5,color:"#1a1a2e",lineHeight:1.35}}>{a.titre}</div>

                      {/* Dates libellées */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                        <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px"}}>
                          <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>Signature</p>
                          <p style={{fontSize:12,fontWeight:600,color:a.date_signature?"#1a1a2e":"#9aa5b4"}}>{a.date_signature?fmtDate(a.date_signature):"—"}</p>
                        </div>
                        <div style={{background:"rgba(0,79,145,0.04)",border:"1px solid rgba(0,79,145,0.10)",borderRadius:10,padding:"8px 11px"}}>
                          <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:"#004f91",textTransform:"uppercase" as const,marginBottom:3}}>Expiration</p>
                          <p style={{fontSize:12,fontWeight:600,color:a.date_expiration?"#1a1a2e":"#9aa5b4"}}>{a.date_expiration?fmtDate(a.date_expiration):"Non définie"}</p>
                        </div>
                      </div>

                    </div>

                    {/* Action */}
                    <div style={{display:"flex",borderTop:"1px solid #F2F0EF"}}>
                      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 0",fontSize:11.5,color:"#004f91",fontWeight:600,transition:"background 0.15s"}}
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgba(0,79,145,0.05)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="none"}>
                        Voir les détails →
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
      </div>

      {selec&&<AccordVue accord={selec} onClose={()=>setSelec(null)}/>}
    </main>
  );
}
