"use client";

import Navbar from "@/components/layout/Navbar";
import { ChevronDown, ChevronUp, FileText, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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

function ThematiquesCascadeFilter({ secteurs, secteursSel, branchesSel, activitesSel, onSecteur, onBranche, onActivite }: {
  secteurs:any[]; secteursSel:string[]; branchesSel:string[]; activitesSel:string[];
  onSecteur:(v:string)=>void; onBranche:(v:string)=>void; onActivite:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const branches = secteurs.filter(s=>secteursSel.includes(s.nom)).flatMap((s:any)=>s.branches||[]);
  const activites = branches.filter((b:any)=>branchesSel.includes(b.nom)).flatMap((b:any)=>b.activites||[]);
  const hasFilter = secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  return (
    <div>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {hasFilter&&<span style={{width:6,height:6,borderRadius:"50%",background:"#ca631f",display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:hasFilter?"#ca631f":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Thématiques</span>
        </div>
        {open?<ChevronUp size={12} style={{color:"#9aa5b4"}}/>:<ChevronDown size={12} style={{color:"#9aa5b4"}}/>}
      </button>
      {open&&<div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"#ca631f",marginBottom:4}}>Secteur</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {secteurs.map((s:any)=>{const sel=secteursSel.includes(s.nom); return (
              <button key={s.nom} onClick={()=>onSecteur(s.nom)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(202,99,31,0.1)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(202,99,31,0.1)":"transparent";}}>
                <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?"#ca631f":"#C5BFBB"}`,background:sel?"#ca631f":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{fontSize:12,color:sel?"#ca631f":"#4a5568",fontWeight:sel?700:400}}>{s.nom}</span>
              </button>);})}
          </div>
        </div>
        {secteursSel.length>0&&branches.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(202,99,31,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#004f91",marginBottom:4}}>Branche</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {branches.map((b:any)=>{const sel=branchesSel.includes(b.nom); return (
              <button key={b.nom} onClick={()=>onBranche(b.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(0,79,145,0.1)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(0,79,145,0.1)":"transparent";}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:sel?"#004f91":"#C5BFBB",flexShrink:0}}/><span style={{fontSize:12,color:sel?"#004f91":"#4a5568",fontWeight:sel?600:400}}>{b.nom}</span>
              </button>);})}
          </div>
        </div>}
        {branchesSel.length>0&&activites.length>0&&<div style={{paddingLeft:24,borderLeft:"2px solid rgba(0,79,145,0.15)"}}>
          <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4}}>Activité</p>
          <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
            {activites.map((a:any)=>{const sel=activitesSel.includes(a.nom); return (
              <button key={a.nom} onClick={()=>onActivite(a.nom)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(24,128,56,0.08)":"transparent",textAlign:"left" as const}}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(24,128,56,0.08)":"transparent";}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:sel?"#188038":"#C5BFBB",flexShrink:0}}/><span style={{fontSize:11,color:sel?"#188038":"#4a5568",fontWeight:sel?600:400}}>{a.nom}</span>
              </button>);})}
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

// ── Modal vue accord (identique admin) ───────────────────────────────────────
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

  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );
  const STATUT_LABELS: Record<string,string> = { en_vigueur:"En vigueur", expire:"Expiré" };
  const secIds:number[] = a.secteur_ids  || [];
  const braIds:number[] = a.branche_ids  || [];
  const actIds:number[] = a.activite_ids || [];
  const hasNaema = secIds.length>0||braIds.length>0||actIds.length>0;

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.25)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#ca631f,#FFB0A1,#004f91)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.15rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{a.titre}</h2>
              <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {a.reference&&<span style={{fontSize:11,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"1px solid rgba(202,99,31,0.2)",padding:"2px 9px",borderRadius:999}}>{a.reference}</span>}
                <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:999,color:a.statut==="en_vigueur"?"#15803d":"#6b7280",background:a.statut==="en_vigueur"?"rgba(21,128,61,0.08)":"#f3f4f6",border:`1px solid ${a.statut==="en_vigueur"?"rgba(21,128,61,0.2)":"#e5e7eb"}`}}>
                  {STATUT_LABELS[a.statut]||a.statut}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>
          {a.commentaires&&<div style={{background:"rgba(202,99,31,0.04)",border:"1px solid rgba(202,99,31,0.1)",borderRadius:10,padding:"12px 14px",marginBottom:18}}>
            <LBL>Résumé</LBL><p style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}>{a.commentaires}</p>
          </div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {a.date_signature&&<div style={{background:"rgba(0,79,145,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Date de signature</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_signature)}</p></div>}
            {a.date_entree_vigueur&&<div style={{background:"rgba(24,128,56,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Entrée en vigueur</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_entree_vigueur)}</p></div>}
            {a.date_expiration&&<div style={{background:"rgba(202,99,31,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Expiration</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{fmtDate(a.date_expiration)}</p></div>}
          </div>
          {(a.parties_pays_ids?.length>0||a.parties_signataires)&&<div style={{marginBottom:16}}>
            <LBL>Parties signataires</LBL>
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
              {(a.parties_pays_ids||[]).map((id:number)=>{
                const p=allPays.find((r:any)=>r.id===id);
                return <span key={id} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:"#004f91",background:"rgba(0,79,145,0.07)",border:"1px solid rgba(0,79,145,0.18)",padding:"3px 11px",borderRadius:999}}>
                  {p?.nom_fr||`#${id}`}
                </span>;
              })}
              {a.parties_signataires&&a.parties_signataires.split(", ").filter(Boolean).map((p:string)=>(
                <span key={p} style={{fontSize:12,fontWeight:600,color:"#ca631f",background:"rgba(202,99,31,0.07)",border:"1px solid rgba(202,99,31,0.18)",padding:"3px 11px",borderRadius:999}}>{p}</span>
              ))}
            </div>
          </div>}
          {hasNaema&&<div style={{marginBottom:16}}>
            <LBL>Thématiques</LBL>
            <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
              {secIds.map((secId:number)=>{
                const secNom=secteurs.find(s=>s.id===secId)?.nom;
                if (!secNom) return null;
                const brasDuSec=branches.filter(b=>b.secteur_id===secId&&braIds.includes(b.id));
                return (
                  <div key={secId}>
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:brasDuSec.length?5:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:700,color:"#ca631f"}}>{secNom}</span>
                    </div>
                    {brasDuSec.length>0&&<div style={{paddingLeft:20,borderLeft:"2px solid rgba(202,99,31,0.15)",display:"flex",flexDirection:"column" as const,gap:5}}>
                      {brasDuSec.map((bra:any)=>{
                        const actsDeBra=activites.filter(ac=>ac.branche_id===bra.id&&actIds.includes(ac.id));
                        return (
                          <div key={bra.id}>
                            <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:actsDeBra.length?4:0}}>
                              <div style={{width:6,height:6,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                              <span style={{fontSize:11,fontWeight:600,color:"#004f91"}}>{bra.nom}</span>
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
          </div>}
          {fichiers.length>0&&<div style={{marginBottom:16}}>
            <LBL>Documents</LBL>
            <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
              {fichiers.map((f:any)=>(
                <a key={f.id} href={`${API_BASE}/accords/${a.id}/fichiers/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                  style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(202,99,31,0.06)",border:"1px solid rgba(202,99,31,0.18)",borderRadius:7,padding:"4px 10px",fontSize:11,color:"#ca631f",textDecoration:"none",fontWeight:500}}>
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
  const [paysDistincts, setPaysDistincts] = useState<{id:number;nom:string;code_iso2:string}[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [allPays,     setAllPays]     = useState<any[]>([]);

  // Filtres — pays filtrés par ID maintenant
  const [recherche,    setRecherche]    = useState("");
  const [statutFiltre, setStatutFiltre] = useState("");
  const [paysIdsFiltres, setPaysIdsFiltres] = useState<number[]>([]);
  const [secteursSel,  setSecteursSel]  = useState<string[]>([]);
  const [branchesSel,  setBranchesSel]  = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);

  useEffect(()=>{
    const safe = (p:Promise<any>,fb:any)=>p.catch(()=>fb);
    Promise.all([
      safe(fetch(`${API_BASE}/accords/parties-distinctes`).then(r=>r.json()), {}),
      safe(fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()),   []),
      safe(fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()),   []),
      safe(fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()),  []),
      safe(fetch(`${API_BASE}/entreprises/ref/pays`).then(r=>r.json()),       []),
    ]).then(([partiesData,secsData,brasData,actsData,paysData])=>{
      // parties-distinctes retourne maintenant {id, nom, code_iso2}
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

  // Résoudre les noms de pays depuis IDs pour un accord
  const getPaysNoms = (a:any, max=2): string => {
    let noms: string[] = [];
    if (a.parties_pays_ids?.length>0) {
      noms = (a.parties_pays_ids as number[])
        .map((id:number)=>allPays.find((r:any)=>r.id===id)?.nom_fr)
        .filter(Boolean) as string[];
    } else if (a.parties_signataires) {
      noms = a.parties_signataires.split(", ").filter(Boolean);
    }
    if (max && noms.length > max) {
      return noms.slice(0, max).join(", ") + `, +${noms.length - max}`;
    }
    return noms.join(", ");
  };

  // Filtrage côté client
  const accords = tous.filter(a=>{
    if (recherche) {
      const q=recherche.toLowerCase();
      const paysStr=getPaysNoms(a).toLowerCase();
      if (!a.titre?.toLowerCase().includes(q)&&!a.reference?.toLowerCase().includes(q)&&!paysStr.includes(q)) return false;
    }
    if (statutFiltre&&a.statut!==statutFiltre) return false;
    // Filtre par pays — on compare les IDs
    if (paysIdsFiltres.length>0) {
      const hasMatch = paysIdsFiltres.some(id=>(a.parties_pays_ids||[]).includes(id));
      if (!hasMatch) return false;
    }
    // Filtre thématiques par IDs (secteur_ids, branche_ids, activite_ids)
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
  });

  const stats = { total:tous.length, en_vigueur:tous.filter(a=>a.statut==="en_vigueur").length };
  const hasFilter=!!recherche||!!statutFiltre||paysIdsFiltres.length>0||secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  const reinit=()=>{setRecherche("");setStatutFiltre("");setPaysIdsFiltres([]);setSecteursSel([]);setBranchesSel([]);setActivitesSel([]);};
  const nbFiltres=(recherche?1:0)+(statutFiltre?1:0)+paysIdsFiltres.length+secteursSel.length+branchesSel.length+activitesSel.length;

  const togglePays    =(v:string)=>{
    const id=paysDistincts.find(p=>p.nom===v)?.id;
    if (!id) return;
    setPaysIdsFiltres(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  };
  const toggleBranche =(v:string)=>{setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setActivitesSel([]);};
  const toggleActivite=(v:string)=>setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleSecteur =(v:string)=>{setSecteursSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setBranchesSel([]);setActivitesSel([]);};

  // Pour SideFilter on passe les noms (affichage) mais on filtre par IDs en interne
  const paysSelNoms = paysIdsFiltres.map(id=>paysDistincts.find(p=>p.id===id)?.nom||"").filter(Boolean);

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
          <h1 style={{fontWeight:800,fontSize:"clamp(2.2rem,4vw,3.2rem)",color:"#fff",lineHeight:1.1,marginBottom:16}}>Accords &amp; Traités</h1>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:15,maxWidth:540,lineHeight:1.7,marginBottom:24}}>Accords internationaux de coopération économique et traités bilatéraux d'investissement signés par le Sénégal.</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap" as const}}>
            {stats.total>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999}}>{stats.total} accord{stats.total>1?"s":""}</span>}
            {stats.en_vigueur>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(202,99,31,0.18)",border:"1px solid rgba(202,99,31,0.35)",padding:"6px 14px",borderRadius:999}}>{stats.en_vigueur} en vigueur</span>}
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
                  style={{background:"rgba(202,99,31,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
                  <SlidersHorizontal size={14} style={{color:"#ca631f"}}/>
                  {sidebarOpen&&nbFiltres>0&&<span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.15)",borderRadius:999,padding:"1px 5px"}}>{nbFiltres}</span>}
                </button>
              </div>
              {sidebarOpen&&<>
                {hasFilter&&<button onClick={reinit} style={{display:"flex",alignItems:"center",gap:5,width:"100%",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:8,padding:"7px 10px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:16}}>
                  <X size={12}/> Effacer tous les filtres
                </button>}
                <div style={{position:"relative" as const,marginBottom:18}}>
                  <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                  <input value={recherche} onChange={e=>setRecherche(e.target.value)} placeholder="Titre, référence, partie…"
                    style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                  {recherche&&<button onClick={()=>setRecherche("")} style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                </div>
                <div style={{marginBottom:18}}>
                  <p style={{fontSize:11,fontWeight:700,color:statutFiltre?"#004f91":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>Statut</p>
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
                <SideFilter label="Parties signataires" color="#004f91" selected={paysSelNoms} onToggle={togglePays}
                  items={paysDistincts.map((p:any)=>({value:p.nom,label:p.nom}))}/>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs}
                  secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel}
                  onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
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
                {hasFilter&&<button onClick={reinit} style={{marginTop:16,padding:"8px 18px",borderRadius:10,border:"none",background:"#004f91",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>Effacer les filtres</button>}
              </div>
            ) : (
              <>
                <p style={{fontSize:13,color:"#9aa5b4",marginBottom:16}}>{accords.length} accord{accords.length>1?"s":""}{hasFilter?" trouvé"+(accords.length>1?"s":""):""}</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:12}}>
                  {accords.map(a=>(
                    <div key={a.id} onClick={()=>setSelec(a)}
                      style={{background:"#fff",borderTop:"1px solid #E8E5E3",borderRight:"1px solid #E8E5E3",borderBottom:"1px solid #E8E5E3",borderLeft:"3px solid #ca631f",borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}
                      onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(202,99,31,0.12)";ev.currentTarget.style.borderTopColor="#FFB0A1";ev.currentTarget.style.borderRightColor="#FFB0A1";ev.currentTarget.style.borderBottomColor="#FFB0A1";}}
                      onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderTopColor="#E8E5E3";ev.currentTarget.style.borderRightColor="#E8E5E3";ev.currentTarget.style.borderBottomColor="#E8E5E3";}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:a.reference?2:8}}>{a.titre}</div>
                      {a.reference&&<div style={{fontSize:11,fontWeight:600,color:"#9aa5b4",marginBottom:8}}>{a.reference}</div>}
                      <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:10}}>
                        {a.date_expiration&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                          <div style={{width:5,height:5,borderRadius:"50%",background:"#C5BFBB",flexShrink:0}}/><span style={{color:"#4a5568"}}>Expire le {fmtDate(a.date_expiration)}</span>
                        </div>}
                        {getPaysNoms(a,2)&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                          <div style={{width:5,height:5,borderRadius:"50%",background:"#C5BFBB",flexShrink:0}}/><span style={{color:"#4a5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getPaysNoms(a,2)}</span>
                        </div>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid #F2F0EF",paddingTop:8}}>
                        <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:999,color:a.statut==="en_vigueur"?"#15803d":"#6b7280",background:a.statut==="en_vigueur"?"rgba(21,128,61,0.08)":"#f3f4f6"}}>
                          {a.statut==="en_vigueur"?"En vigueur":"Expiré"}
                        </span>
                        <span style={{fontSize:11,color:"#ca631f",fontWeight:600}}>Voir les détails →</span>
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
