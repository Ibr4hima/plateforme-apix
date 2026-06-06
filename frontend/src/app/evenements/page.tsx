"use client";

import Navbar from "@/components/layout/Navbar";
import { CalendarDays, ChevronDown, ChevronUp, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const ROLES_APIX: Record<string,string> = { organisateur:"Organisateur", co_organisateur:"Co-organisateur", participant:"Participant", partenaire:"Partenaire", sponsor:"Sponsor" };
const ROLE_COLORS: Record<string,{color:string;bg:string}> = {
  organisateur:    { color:"#15803d", bg:"rgba(21,128,61,0.1)"   },
  co_organisateur: { color:"#004f91", bg:"rgba(0,79,145,0.1)"    },
  participant:     { color:"#ca631f", bg:"rgba(202,99,31,0.1)"   },
  partenaire:      { color:"#7c3aed", bg:"rgba(124,58,237,0.1)"  },
  sponsor:         { color:"#d97706", bg:"rgba(217,119,6,0.1)"   },
};

function fmtDate(d: string) {
  if (!d) return "";
  const [y,m,j] = d.split("-").map(Number);
  return new Date(y,m-1,j).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
}
function ordinal(n: number) { return n === 1 ? "1ère édition" : `${n}ème édition`; }

const STATUT_OPTS = [
  { value:"",         label:"Tous",     bg:"#F2F0EF", text:"#4a5568" },
  { value:"a_venir",  label:"À venir",  bg:"#dbeafe", text:"#1d4ed8" },
  { value:"en_cours", label:"En cours", bg:"#dcfce7", text:"#15803d" },
  { value:"termine",  label:"Terminés", bg:"#f3f4f6", text:"#6b7280" },
];

function SideFilter({ label, items, selected, onToggle, color }: {
  label:string; items:{value:string;label:string}[];
  selected:string[]; onToggle:(v:string)=>void; color:string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{marginBottom:20}}>
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
                <span style={{fontSize:12,color:sel?"#1a1a2e":"#4a5568",fontWeight:sel?600:400}}>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Filtre thématiques — secteur multi-select ─────────────────────────────────
function ThematiquesCascadeFilter({ secteurs, secteursSel, branchesSel, activitesSel, onSecteur, onBranche, onActivite }: {
  secteurs: any[];
  secteursSel: string[]; branchesSel: string[]; activitesSel: string[];
  onSecteur:(v:string)=>void; onBranche:(v:string)=>void; onActivite:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const branches = secteurs.filter(s=>secteursSel.includes(s.nom)).flatMap((s:any)=>s.branches||[]);
  const activites = branches.filter((b:any)=>branchesSel.includes(b.nom)).flatMap((b:any)=>b.activites||[]);
  const hasFilter = secteursSel.length>0 || branchesSel.length>0 || activitesSel.length>0;

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
      {open&&(
        <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
          <div>
            <p style={{fontSize:10,fontWeight:700,color:"#E35336",marginBottom:4}}>Secteur</p>
            <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
              {secteurs.map((s:any)=>{
                const sel=secteursSel.includes(s.nom);
                return (
                  <button key={s.nom} onClick={()=>onSecteur(s.nom)}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(227,83,54,0.1)":"transparent",textAlign:"left" as const}}
                    onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}}
                    onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(227,83,54,0.1)":"transparent";}}>
                    <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?"#E35336":"#C5BFBB"}`,background:sel?"#E35336":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{fontSize:12,color:sel?"#E35336":"#4a5568",fontWeight:sel?700:400}}>{s.nom}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {secteursSel.length>0&&branches.length>0&&(
            <div style={{paddingLeft:12,borderLeft:"2px solid rgba(227,83,54,0.15)"}}>
              <p style={{fontSize:10,fontWeight:700,color:"#366FE3",marginBottom:4}}>Branche</p>
              <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                {branches.map((b:any)=>{
                  const sel=branchesSel.includes(b.nom);
                  return (
                    <button key={b.nom} onClick={()=>onBranche(b.nom)}
                      style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(54,111,227,0.1)":"transparent",textAlign:"left" as const}}
                      onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}}
                      onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(54,111,227,0.1)":"transparent";}}>
                      <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?"#366FE3":"#C5BFBB"}`,background:sel?"#366FE3":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{fontSize:12,color:sel?"#366FE3":"#4a5568",fontWeight:sel?600:400}}>{b.nom}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {branchesSel.length>0&&activites.length>0&&(
            <div style={{paddingLeft:24,borderLeft:"2px solid rgba(24,128,56,0.15)"}}>
              <p style={{fontSize:10,fontWeight:700,color:"#188038",marginBottom:4}}>Activité</p>
              <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                {activites.map((a:any)=>{
                  const sel=activitesSel.includes(a.nom);
                  return (
                    <button key={a.nom} onClick={()=>onActivite(a.nom)}
                      style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:sel?"rgba(24,128,56,0.08)":"transparent",textAlign:"left" as const}}
                      onMouseEnter={e=>{if(!sel)e.currentTarget.style.background="#F8F7F6";}}
                      onMouseLeave={e=>{e.currentTarget.style.background=sel?"rgba(24,128,56,0.08)":"transparent";}}>
                      <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${sel?"#188038":"#C5BFBB"}`,background:sel?"#188038":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {sel&&<svg width="8" height="6" viewBox="0 0 9 7"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{fontSize:11,color:sel?"#188038":"#4a5568",fontWeight:sel?600:400}}>{a.nom}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal vue événement ───────────────────────────────────────────────────────
function EvenementVue({ ev:e, onClose }: { ev:any; onClose:()=>void }) {
  if (!e) return null;
  const dateStr = e.date_debut
    ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDate(e.date_debut) : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`)
    : e.prochain_mois ? `${e.prochain_jour?e.prochain_jour+" ":""}${MOIS[(e.prochain_mois||1)-1]} ${e.prochain_annee||""}` : null;
  const LBL = ({children}:{children:string}) => (
    <p style={{fontSize:10,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.12em",marginBottom:5}}>{children}</p>
  );
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#FAFAF9",borderRadius:20,width:"100%",maxWidth:640,maxHeight:"90vh",border:"1px solid #E8E5E3",boxShadow:"0 32px 80px rgba(0,0,0,0.25)",overflow:"hidden"}}>
        <div style={{height:5,background:"linear-gradient(90deg,#ca631f,#FFB0A1,#004f91)"}}/>
        <div style={{padding:"24px 28px 28px",overflowY:"auto" as const,maxHeight:"calc(90vh - 5px)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div style={{flex:1,paddingRight:16}}>
              <h2 style={{fontWeight:800,fontSize:"1.2rem",color:"#1a1a2e",lineHeight:1.3,marginBottom:8}}>{e.nom_event}</h2>
              <div style={{display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {e.edition!=null&&<span style={{fontSize:11,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.08)",border:"1px solid rgba(202,99,31,0.2)",padding:"2px 9px",borderRadius:999}}>{ordinal(e.edition)}</span>}
                {e.role_apix&&<span style={{fontSize:11,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.08)",border:"1px solid rgba(0,79,145,0.2)",padding:"2px 9px",borderRadius:999}}>{ROLES_APIX[e.role_apix]||e.role_apix}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{background:"#F2F0EF",border:"none",cursor:"pointer",borderRadius:8,padding:7,flexShrink:0}}><X size={14} color="#4a5568"/></button>
          </div>
          {e.description&&<div style={{background:"rgba(202,99,31,0.04)",border:"1px solid rgba(202,99,31,0.1)",borderRadius:10,padding:"12px 14px",marginBottom:18}}><style>{`[data-rte] ul{padding-left:20px;list-style-type:disc}[data-rte] ol{padding-left:20px;list-style-type:decimal}[data-rte] li{margin-bottom:2px}`}</style><div data-rte dangerouslySetInnerHTML={{__html:e.description}} style={{fontSize:13,color:"#4a5568",lineHeight:1.7}}/></div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {dateStr&&<div style={{background:"rgba(202,99,31,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Date</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{dateStr}</p>{e.duree_jours&&<p style={{fontSize:11,color:"#9aa5b4",marginTop:3}}>{e.duree_jours} jour{e.duree_jours>1?"s":""}</p>}</div>}
            {(e.ville||e.pays_hote_nom)&&<div style={{background:"rgba(0,79,145,0.05)",borderRadius:10,padding:"12px 14px"}}><LBL>Lieu</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{[e.ville,e.pays_hote_nom].filter(Boolean).join(", ")}</p></div>}
            {e.organisateur&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Organisateur</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>{e.organisateur}</p></div>}
            {e.est_recurrent&&<div style={{background:"#F8F7F6",borderRadius:10,padding:"12px 14px"}}><LBL>Récurrence</LBL><p style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>Tous les {e.frequence_valeur} {e.frequence_type==="mois"?"mois":`an${e.frequence_valeur>1?"s":""}`}</p></div>}
          </div>
          {e.thematiques_tree&&Object.keys(e.thematiques_tree).length>0&&(
            <div style={{marginBottom:16}}>
              <LBL>Thématiques</LBL>
              <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                {Object.entries(e.thematiques_tree).map(([sec,branches]:any)=>(
                  <div key={sec}>
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:Object.keys(branches).length?5:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#ca631f",flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:700,color:"#ca631f"}}>{sec}</span>
                    </div>
                    {Object.entries(branches).map(([bra,acts]:any)=>(
                      <div key={bra} style={{paddingLeft:20,borderLeft:"2px solid rgba(202,99,31,0.15)"}}>
                        <div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:acts.length?4:0}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"#004f91",flexShrink:0}}/>
                          <span style={{fontSize:11,fontWeight:600,color:"#004f91"}}>{bra}</span>
                        </div>
                        {acts.length>0&&<div style={{paddingLeft:18,display:"flex",flexDirection:"column" as const,gap:3}}>{acts.map((act:string)=>(
                          <div key={act} style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{width:5,height:5,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                            <span style={{fontSize:11,color:"#188038",fontWeight:500}}>{act}</span>
                          </div>
                        ))}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          {e.pays_invites_noms&&<div style={{marginBottom:14}}><LBL>Pays invités</LBL><div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>{e.pays_invites_noms.split(",").map((p:string)=>p.trim()).filter(Boolean).map((p:string)=><span key={p} style={{fontSize:11,color:"#004f91",background:"rgba(0,79,145,0.07)",border:"1px solid rgba(0,79,145,0.15)",padding:"2px 10px",borderRadius:999,fontWeight:500}}>{p}</span>)}</div></div>}
          {e.entreprises_invitees&&<div style={{marginBottom:14}}><LBL>Entreprises invitées</LBL><div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>{e.entreprises_invitees.split(",").map((ent:string)=>ent.trim()).filter(Boolean).map((ent:string)=><span key={ent} style={{fontSize:11,color:"#ca631f",background:"rgba(202,99,31,0.06)",border:"1px solid rgba(202,99,31,0.15)",padding:"2px 10px",borderRadius:999,fontWeight:500}}>{ent}</span>)}</div></div>}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:20,borderTop:"1px solid #F2F0EF",paddingTop:18}}>
            <button onClick={onClose} style={{padding:"9px 20px",borderRadius:9,border:"1px solid #C5BFBB",background:"transparent",color:"#4a5568",fontWeight:600,cursor:"pointer",fontSize:13}}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function EvenementsPage() {
  const [tous,        setTous]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selec,       setSelec]       = useState<any>(null);
  const [paysHotes,   setPaysHotes]   = useState<{nom:string;code_iso2:string}[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats,       setStats]       = useState<any>({a_venir:0,en_cours:0,total:0});

  const [recherche,    setRecherche]    = useState("");
  const [statutFiltre, setStatutFiltre] = useState("");
  const [paysFiltres,  setPaysFiltres]  = useState<string[]>([]);
  const [secteursSel,  setSecteursSel]  = useState<string[]>([]);
  const [branchesSel,  setBranchesSel]  = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);

  useEffect(()=>{
    const safe = (p:Promise<any>, fb:any) => p.catch(()=>fb);
    Promise.all([
      safe(fetch(`${API_BASE}/evenements/pays-hotes`).then(r=>r.json()), []),
      safe(fetch(`${API_BASE}/entreprises/ref/pays`).then(r=>r.json()),  []),
      safe(fetch(`${API_BASE}/evenements/stats`).then(r=>r.json()),      {}),
      safe(fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r=>r.json()), []),
      safe(fetch(`${API_BASE}/entreprises/ref/branches`).then(r=>r.json()), []),
      safe(fetch(`${API_BASE}/entreprises/ref/activites`).then(r=>r.json()), []),
    ]).then(([hotes,refPays,statsData,secsData,brasData,actsData])=>{
      const enrichis=(hotes||[]).map((nom:string)=>{
        const ref=(refPays||[]).find((p:any)=>p.nom_fr===nom);
        return {nom,code_iso2:ref?.code_iso2||""};
      });
      setPaysHotes(enrichis);
      setStats(statsData||{});
      const tree = (secsData||[]).map((s:any)=>({
        ...s,
        branches: (brasData||[]).filter((b:any)=>b.secteur_id===s.id).map((b:any)=>({
          ...b,
          activites: (actsData||[]).filter((a:any)=>a.branche_id===b.id)
        }))
      }));
      setSecteurs(tree);
    });
  },[]);

  const charger = useCallback(async()=>{
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/evenements?per_page=100`);
      const data = await res.json();
      setTous(data.data||[]);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ charger(); },[charger]);

  const evenements = tous.filter(e=>{
    if (recherche) {
      const q = recherche.toLowerCase();
      if (!e.nom_event?.toLowerCase().includes(q) && !e.organisateur?.toLowerCase().includes(q) && !e.ville?.toLowerCase().includes(q) && !e.pays_hote_nom?.toLowerCase().includes(q)) return false;
    }
    if (statutFiltre) {
      const today = new Date(); today.setHours(0,0,0,0);
      if (e.date_debut) {
        const debut = new Date(e.date_debut+"T00:00:00");
        const fin   = e.date_fin ? new Date(e.date_fin+"T00:00:00") : debut;
        if (statutFiltre==="a_venir"  && debut <= today) return false;
        if (statutFiltre==="en_cours" && (debut > today || fin < today)) return false;
        if (statutFiltre==="termine"  && fin >= today) return false;
      }
    }
    if (paysFiltres.length>0 && !paysFiltres.includes(e.pays_hote_nom||"")) return false;
    if (secteursSel.length>0 && !secteursSel.some((s:string)=>(e.secteur_noms||[]).includes(s))) return false;
    if (branchesSel.length>0 && !branchesSel.some((b:string)=>(e.branche_noms||[]).includes(b))) return false;
    if (activitesSel.length>0 && !activitesSel.some((a:string)=>(e.activite_noms||[]).includes(a))) return false;
    return true;
  });

  const hasFilter = !!recherche||!!statutFiltre||paysFiltres.length>0||secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  const reinit = ()=>{ setRecherche(""); setStatutFiltre(""); setPaysFiltres([]); setSecteursSel([]); setBranchesSel([]); setActivitesSel([]); };
  const nbFiltres = (recherche?1:0)+(statutFiltre?1:0)+paysFiltres.length+secteursSel.length+branchesSel.length+activitesSel.length;

  const togglePays     = (v:string) => setPaysFiltres(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleSecteur  = (v:string) => { setSecteursSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setBranchesSel([]); setActivitesSel([]); };
  const toggleBranche  = (v:string) => { setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setActivitesSel([]); };
  const toggleActivite = (v:string) => setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);

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
          <h1 style={{fontWeight:800,fontSize:"clamp(2.2rem,4vw,3.2rem)",color:"#fff",lineHeight:1.1,marginBottom:24}}>Événements</h1>
          <div style={{display:"flex",gap:10,flexWrap:"wrap" as const}}>
  {(stats.total||0)>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",padding:"6px 14px",borderRadius:999,backdropFilter:"blur(10px)"}}>{stats.total} événement{stats.total>1?"s":""}</span>}
  {(stats.en_cours||0)>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(202,99,31,0.18)",border:"1px solid rgba(202,99,31,0.35)",padding:"6px 14px",borderRadius:999,backdropFilter:"blur(10px)"}}>{stats.en_cours} en cours</span>}
  {(stats.a_venir||0)>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(54,111,227,0.18)",border:"1px solid rgba(54,111,227,0.35)",padding:"6px 14px",borderRadius:999,backdropFilter:"blur(10px)"}}>{stats.a_venir} à venir</span>}
  {(stats.termine||0)>0&&<span style={{fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",padding:"6px 14px",borderRadius:999,backdropFilter:"blur(10px)"}}>{stats.termine} terminé{stats.termine>1?"s":""}</span>}
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
                <button onClick={()=>setSidebarOpen(o=>!o)} style={{background:"rgba(202,99,31,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
                  <SlidersHorizontal size={14} style={{color:"#ca631f"}}/>
                  {sidebarOpen&&nbFiltres>0&&<span style={{fontSize:10,fontWeight:700,color:"#ca631f",background:"rgba(202,99,31,0.15)",borderRadius:999,padding:"1px 5px"}}>{nbFiltres}</span>}
                </button>
              </div>
              {sidebarOpen&&<>
                {hasFilter&&<button onClick={reinit} style={{display:"flex",alignItems:"center",gap:5,width:"100%",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:8,padding:"7px 10px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:16}}><X size={12}/> Effacer tous les filtres</button>}
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
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",background:statutFiltre===b.value?b.bg:"transparent",cursor:"pointer",textAlign:"left" as const,fontSize:12,fontWeight:statutFiltre===b.value?700:400,color:statutFiltre===b.value?b.text:"#4a5568"}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:b.text,opacity:statutFiltre===b.value?1:0.3,flexShrink:0}}/>{b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <SideFilter label="Pays hôte" color="#004f91" selected={paysFiltres} onToggle={togglePays}
                  items={paysHotes.map(p=>({value:p.nom,label:p.nom}))}/>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs} secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel} onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
              </>}
            </div>
          </div>

          {/* Grille */}
          <div style={{flex:1,minWidth:0}}>
            {loading?(
              <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:300,gap:12,color:"#9aa5b4"}}>
                <Loader2 size={24} style={{animation:"spin 1s linear infinite"}}/><span style={{fontSize:14}}>Chargement…</span>
              </div>
            ):evenements.length===0?(
              <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                <CalendarDays size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucun événement trouvé</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<button onClick={reinit} style={{marginTop:16,padding:"8px 18px",borderRadius:10,border:"none",background:"#ca631f",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>Effacer les filtres</button>}
              </div>
            ):(
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:12}}>
                  {evenements.map(e=>{
                    const dateStr = e.date_debut
                      ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDate(e.date_debut) : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`)
                      : e.prochain_mois ? `${e.prochain_jour?e.prochain_jour+" ":""}${MOIS[(e.prochain_mois||1)-1]} ${e.prochain_annee||""}` : null;
                    const lieu = [e.ville,e.pays_hote_nom].filter(Boolean).join(", ");
                    return (
                      <div key={e.id} onClick={()=>setSelec(e)}
                        style={{background:"#fff",border:"1px solid #E8E5E3",borderLeft:"3px solid #ca631f",borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",position:"relative" as const}}
                        onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 4px 16px rgba(202,99,31,0.12)";ev.currentTarget.style.borderColor="#ca631f";}}
                        onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";ev.currentTarget.style.borderColor="#E8E5E3";ev.currentTarget.style.borderLeftColor="#ca631f";}}>
                        {e.role_apix&&(()=>{const rc=ROLE_COLORS[e.role_apix]||{color:"#6b7280",bg:"#f3f4f6"}; return (
                          <div style={{position:"absolute" as const,top:12,right:12}}>
                            <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:999,color:rc.color,background:rc.bg}}>{ROLES_APIX[e.role_apix]||e.role_apix}</span>
                          </div>
                        );})()}
                        <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",lineHeight:1.35,marginBottom:e.edition!=null?2:8,paddingRight:e.role_apix?90:0}}>{e.nom_event}</div>
                        {e.edition!=null&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginBottom:8}}>{ordinal(e.edition)}</div>}
                        <div style={{display:"flex",flexDirection:"column" as const,gap:3,marginBottom:12}}>
                          {dateStr&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                            <div style={{width:6,height:6,borderRadius:"50%",background:"#188038",flexShrink:0}}/>
                            <span style={{color:"#4a5568"}}>{dateStr}</span>
                          </div>}
                          {lieu&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                            <div style={{width:6,height:6,borderRadius:"50%",background:"#B7410E",flexShrink:0}}/>
                            <span style={{color:"#4a5568"}}>{lieu}</span>
                          </div>}
                        </div>
                        <div style={{display:"flex",borderTop:"1px solid #F2F0EF",paddingTop:10}}>
                          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(202,99,31,0.08)",borderRadius:7,padding:"6px 0",fontSize:11,color:"#ca631f",fontWeight:600}}>
                            Voir les détails →
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <EvenementVue ev={selec} onClose={()=>setSelec(null)}/>
    </main>
  );
}
