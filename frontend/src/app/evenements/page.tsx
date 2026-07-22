"use client";

import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreBadge, BarreTitreSegment } from "@/components/shared/BarreTitre";
import Badge, { BadgeVariant } from "@/components/shared/Badge";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { CalendarDays, FileText, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthGate } from "@/lib/authGate";
import { useNaemaArbre, useRefPays } from "@/lib/referentiels";
import { fetchTous } from "@/lib/fetchTous";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { fmtDate } from "@/lib/format";
import { badge_vert, badge_orange, badge_bleu, badge_violet, badge_ambre, badge_gris } from "@/lib/couleurs";
import { demarrerRedimension } from "@/lib/redimension";
import { SideFilter, ThematiquesCascadeFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { computeStatutEvenement } from "@/lib/statuts";
import EvenementVueModal, { MOIS, ordinal, ROLE_PILL, ROLES_APIX } from "@/components/shared/EvenementVueModal";
import { useFicheUrl } from "@/lib/ficheUrl";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Badges de rôle APIX sur les cards — jetons du design system :
// organisation vert, participant orange, partenaire bleu, invité violet,
// sponsor ambre (5e teinte assortie).
const ROLE_BADGE: Record<string, React.CSSProperties> = {
  "Organisateur":    badge_vert,
  "Co-organisateur": badge_vert,
  "Participant":     badge_orange,
  "Partenaire":      badge_bleu,
  "Invité":          badge_violet,
  "Sponsor":         badge_ambre,
};
function BadgeRole({ role }: { role:string }) {
  return (
    <span style={{...(ROLE_BADGE[role]||badge_gris), whiteSpace:"nowrap" as const, flexShrink:0}}>
      {ROLES_APIX[role]||role}
    </span>
  );
}
// Accent de survol des cards = couleur du rôle (assortie au badge)
const ROLE_ACCENT: Record<string, string> = {
  "Organisateur": "#188038", "Co-organisateur": "#188038",
  "Participant": "#ca631f", "Partenaire": "#004f91",
  "Invité": "#6A1B9A", "Sponsor": "#a16207",
};
const accentRole = (role?: string | null) => (role && ROLE_ACCENT[role]) || "#004f91";

const ROLE_VARIANT: Record<string, BadgeVariant> = {
  "Organisateur":    "green",
  "Co-organisateur": "yellow",
  "Participant":     "orange",
  "Partenaire":      "teal",
  "Sponsor":         "lavender",
  "Invité":          "gray",
};



// Échéance d'un événement à venir : « Dans 2 ans », « Dans 3 mois », « Dans 12 jours »
function dansCombien(e: any): string | null {
  const d = e.date_debut ? new Date(e.date_debut+"T00:00:00")
    : e.prochain_annee ? new Date(e.prochain_annee,(e.prochain_mois||1)-1,e.prochain_jour||1) : null;
  if (!d) return null;
  const now = new Date();
  const jours = Math.ceil((d.getTime()-now.getTime())/86400000);
  if (jours <= 0) return null;
  let mois = (d.getFullYear()-now.getFullYear())*12 + (d.getMonth()-now.getMonth());
  if (d.getDate() < now.getDate()) mois -= 1;
  const ans = Math.floor(mois/12);
  if (ans >= 1) return `Dans ${ans} an${ans>1?"s":""}`;
  if (mois >= 1) return `Dans ${mois} mois`;
  return `Dans ${jours} jour${jours>1?"s":""}`;
}

const STATUT_OPTS = [
  { value:"",         label:"Tous",     bg:"#F2F0EF", text:"#4a5568" },
  { value:"a_venir",  label:"À venir",  bg:"rgba(0,79,145,0.08)", text:"#004f91" },
  { value:"en_cours", label:"En cours", bg:"rgba(24,128,56,0.08)", text:"#188038" },
  { value:"termine",  label:"Terminés", bg:"#f3f4f6", text:"#6b7280" },
];

// ── Frise chronologique des événements ────────────────────────────────────────
function FriseChronologique({ evenements, onOpen, prochainId }: { evenements:any[]; onOpen:(e:any)=>void; prochainId:number|null }) {
  const ST: any = {
    a_venir:  { label:"À venir",  c:"#004f91", bg:"rgba(0,79,145,0.07)"  },
    en_cours: { label:"En cours", c:"#188038", bg:"rgba(24,128,56,0.08)" },
    termine:  { label:"Terminé",  c:"#6b7280", bg:"#F2F0EF"              },
  };
  const dateDe = (e:any): Date|null => {
    if (e.date_debut) return new Date(e.date_debut+"T00:00:00");
    if (e.prochain_annee) return new Date(e.prochain_annee, (e.prochain_mois||1)-1, e.prochain_jour||1);
    return null;
  };
  const avecDate = evenements.map(e=>({ e, d:dateDe(e) })).filter(x=>x.d) as {e:any;d:Date}[];
  const sansDate = evenements.filter(e=>!dateDe(e));
  avecDate.sort((a,b)=>b.d.getTime()-a.d.getTime());
  const parAnnee: {annee:number; items:{e:any;d:Date}[]}[] = [];
  avecDate.forEach(x=>{ const y=x.d.getFullYear(); let g=parAnnee.find(p=>p.annee===y); if(!g){g={annee:y,items:[]};parAnnee.push(g);} g.items.push(x); });

  const hoverIn = (ev:React.MouseEvent<HTMLDivElement>) => {
    ev.currentTarget.style.boxShadow="0 12px 28px rgba(0,30,60,0.10)"; ev.currentTarget.style.transform="translateY(-2px)"; ev.currentTarget.style.borderColor="rgba(0,79,145,0.25)";
    ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
      const span = box.firstElementChild as HTMLElement|null;
      if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d/40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
    });
  };
  const hoverOut = (ev:React.MouseEvent<HTMLDivElement>) => {
    ev.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.03)"; ev.currentTarget.style.transform="none"; ev.currentTarget.style.borderColor="#ECEAE7";
    ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
      const span = box.firstElementChild as HTMLElement|null;
      if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
    });
  };

  const Carte = ({ e }: { e:any }) => {
    const statut = computeStatutEvenement(e) ?? ((e.prochain_annee||e.prochain_mois) ? "a_venir" : null);
    const st = statut ? ST[statut] : null;
    const estProchain = prochainId!=null && e.id===prochainId;
    const estEnCours = statut==="en_cours";
    const estPasse = statut==="termine";
    const accent = estProchain
      ? { grad:"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", label:"Prochain événement", b:"rgba(0,79,145,0.45)", b2:"rgba(0,79,145,0.6)", sh:"0 4px 18px rgba(0,79,145,0.15)" }
      : estEnCours
      ? { grad:"linear-gradient(90deg,#0d5c26 0%,#188038 60%,#2aa14e 100%)", label:"Événement en cours", b:"rgba(24,128,56,0.45)", b2:"rgba(24,128,56,0.6)", sh:"0 4px 18px rgba(24,128,56,0.15)" }
      : null;
    const dateStr = e.date_debut
      ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDate(e.date_debut) : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`)
      : e.prochain_mois||e.prochain_annee ? `${e.prochain_jour?e.prochain_jour+" ":""}${e.prochain_mois?MOIS[(e.prochain_mois||1)-1]+" ":""}${e.prochain_annee||""}`.trim() : null;
    const lieu = [e.ville,e.pays_hote_nom].filter(Boolean).join(", ");
    const txtC  = estPasse ? "#4a5568" : "#1a1a2e";
    const hoverC = accent ? null : accentRole(e.role_apix);
    return (
      <div onClick={()=>onOpen(e)}
        onMouseEnter={ev=>{ hoverIn(ev); ev.currentTarget.style.borderColor = accent ? accent.b2 : `${hoverC}55`; }}
        onMouseLeave={ev=>{ hoverOut(ev); if(accent){ ev.currentTarget.style.borderColor=accent.b; ev.currentTarget.style.boxShadow=accent.sh; } }}
        style={{background:estPasse?"#FBFAF9":"#fff",border:accent?`1.5px solid ${accent.b}`:"1px solid #ECEAE7",borderRadius:16,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:accent?accent.sh:"0 1px 2px rgba(0,0,0,0.03)",overflow:"hidden",minWidth:0,display:"flex",flexDirection:"column" as const}}>
        {/* Bande épaisse : événement en cours (vert) et prochain événement (bleu) */}
        {accent&&(
          <div style={{display:"flex",alignItems:"center",gap:7,background:accent.grad,padding:"6px 16px",flexShrink:0}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#fff",animation:"pulseDot 1.6s ease-out infinite",flexShrink:0}}/>
            <span style={{fontSize:10,fontWeight:800,color:"#fff",letterSpacing:"0.12em",textTransform:"uppercase" as const}}>{accent.label}</span>
          </div>
        )}
        <div style={{padding:"16px 18px 14px",flex:1,display:"flex",flexDirection:"column" as const,gap:12}}>
          {/* Titre + édition | rôle APIX (le statut se lit sur la bande / les dates) */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,minWidth:0}}>
            <div style={{minWidth:0,flex:1}}>
              <div data-marquee style={{fontWeight:800,fontSize:14.5,color:txtC,lineHeight:1.35,letterSpacing:"-0.01em",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                <span style={{display:"inline-block"}}>{e.nom_event}</span>
              </div>
              {(()=>{
                const sousTitre = statut==="a_venir" ? (dansCombien(e) ?? (e.edition!=null?ordinal(e.edition):null)) : (e.edition!=null?ordinal(e.edition):null);
                return sousTitre&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginTop:3}}>{sousTitre}</div>;
              })()}
            </div>
            {e.role_apix&&<BadgeRole role={e.role_apix}/>}
          </div>

          {/* Date · Lieu en rangée épurée */}
          <div style={{display:"flex",alignItems:"center",borderTop:"1px solid #F2F0EF",paddingTop:11,marginTop:"auto"}}>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Date</p>
              <p data-marquee style={{fontSize:12,fontWeight:700,color:dateStr?txtC:"#C5BFBB",fontVariantNumeric:"tabular-nums",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                <span style={{display:"inline-block"}}>{dateStr||"—"}</span>
              </p>
            </div>
            <div style={{width:1,alignSelf:"stretch",background:"#F2F0EF",margin:"0 14px"}}/>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Lieu</p>
              <p data-marquee style={{fontSize:12,fontWeight:700,color:lieu?txtC:"#C5BFBB",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                <span style={{display:"inline-block"}}>{lieu||"—"}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  let idx = 0;
  return (
    <div style={{maxWidth:1020,margin:"0 auto"}}>
      <div style={{position:"relative" as const}}>
        {/* Ligne centrale */}
        <div style={{position:"absolute" as const,top:8,bottom:8,left:"50%",width:2,transform:"translateX(-1px)",background:"linear-gradient(180deg,rgba(0,79,145,0.30) 0%,rgba(0,79,145,0.12) 60%,rgba(0,79,145,0.04) 100%)",borderRadius:2}}/>

        {parAnnee.map(({annee,items})=>(
          <div key={annee}>
            {/* Jalon année */}
            <div style={{display:"flex",justifyContent:"center",padding:"6px 0 20px",position:"relative" as const,zIndex:1}}>
              <span style={{background:"#004f91",color:"#fff",fontWeight:800,fontSize:13,letterSpacing:"0.06em",padding:"7px 22px",borderRadius:999,boxShadow:"0 4px 14px rgba(0,79,145,0.30)"}}>{annee}</span>
            </div>
            {items.map(({e})=>{
              const statut = computeStatutEvenement(e) ?? ((e.prochain_annee||e.prochain_mois) ? "a_venir" : null);
              const st = statut ? ST[statut] : null;
              const gauche = idx++ % 2 === 0;
              return (
                <div key={e.id} style={{display:"grid",gridTemplateColumns:"1fr 64px 1fr",alignItems:"center",marginBottom:16}}>
                  <div style={{minWidth:0}}>{gauche&&<Carte e={e}/>}</div>
                  {/* Puce sur la ligne + connecteur */}
                  <div style={{position:"relative" as const,alignSelf:"stretch",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{position:"absolute" as const,top:"50%",height:2,background:"rgba(0,79,145,0.15)",width:24,...(gauche?{right:"50%",marginRight:6}:{left:"50%",marginLeft:6})}}/>
                    {prochainId!=null&&e.id===prochainId
                      ? <div style={{width:15,height:15,borderRadius:"50%",background:"#004f91",border:"3px solid #F2F0EF",animation:"pulseHalo 1.8s ease-out infinite",position:"relative" as const,zIndex:1}}/>
                      : statut==="en_cours"
                      ? <div style={{width:15,height:15,borderRadius:"50%",background:"#188038",border:"3px solid #F2F0EF",animation:"pulseHaloVert 1.8s ease-out infinite",position:"relative" as const,zIndex:1}}/>
                      : <div style={{width:13,height:13,borderRadius:"50%",background:st?st.c:"#004f91",border:"3px solid #F2F0EF",boxShadow:`0 0 0 1px ${st?st.c:"#004f91"}44`,position:"relative" as const,zIndex:1}}/>}
                  </div>
                  <div style={{minWidth:0}}>{!gauche&&<Carte e={e}/>}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Événements récurrents sans date fixée */}
      {sansDate.length>0&&(
        <div style={{marginTop:36}}>
          <p style={{fontSize:10.5,fontWeight:700,color:"#9aa5b4",letterSpacing:"0.14em",textTransform:"uppercase" as const,textAlign:"center" as const,marginBottom:14}}>Date à confirmer</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
            {sansDate.map(e=><Carte key={e.id} e={e}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EvenementsPage() {
  const gate = useAuthGate();
  const [tous,        setTous]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [erreur,      setErreur]      = useState(false);
  const [selec,       setSelec]       = useState<any>(null);
  useFicheUrl(tous, setSelec);   // ouverture directe depuis la recherche globale (⌘K)
  const [paysHotes,   setPaysHotes]   = useState<{nom:string;code_iso2:string}[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 520);
  const [stats,       setStats]       = useState<any>({a_venir:0,en_cours:0,total:0});

  const [recherche,    setRecherche]    = useState("");
  const [vueMode,      setVueMode]      = useEtatUrl<"liste"|"frise">("vue", "liste", ["liste","frise"]);
  const [statutFiltre, setStatutFiltre] = useState("");
  const [paysFiltres,  setPaysFiltres]  = useState<string[]>([]);
  const [secteursSel,  setSecteursSel]  = useState<string[]>([]);
  const [branchesSel,  setBranchesSel]  = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);

  // Référentiels servis par le cache partagé
  const { data: refPaysData } = useRefPays();
  const { arbre: naemaArbre } = useNaemaArbre();
  useEffect(()=>{ setSecteurs(naemaArbre); },[naemaArbre]);
  useEffect(()=>{
    const safe = (p:Promise<any>, fb:any) => p.catch(()=>fb);
    Promise.all([
      safe(fetch(`${API_BASE}/evenements/pays-hotes`).then(r=>r.json()), []),
      safe(fetch(`${API_BASE}/evenements/stats`).then(r=>r.json()),      {}),
    ]).then(([hotes,statsData])=>{
      const refPays = (refPaysData as any[]) || [];
      const enrichis=(hotes||[]).map((nom:string)=>{
        const ref=refPays.find((p:any)=>p.nom_fr===nom);
        return {nom,code_iso2:ref?.code_iso2||""};
      });
      setPaysHotes(enrichis);
      setStats(statsData||{});
    });
  },[refPaysData]);

  // Chargement principal : en cas d'échec, état d'erreur avec relance
  const charger = useCallback(async()=>{
    setLoading(true); setErreur(false);
    try {
      setTous(await fetchTous(`${API_BASE}/evenements`));
    } catch(e){ console.error(e); setErreur(true); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ charger(); },[charger]);

  const evenements = useMemo(() => tous.filter(e=>{
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
  }), [tous, recherche, statutFiltre, paysFiltres, secteursSel, branchesSel, activitesSel]);

  // Prochain événement à venir (date la plus proche dans le futur)
  const prochainId: number|null = useMemo(()=>{
    const today = new Date(); today.setHours(0,0,0,0);
    let best: any = null, bestD: Date|null = null;
    evenements.forEach(e=>{
      const d = e.date_debut ? new Date(e.date_debut+"T00:00:00")
        : e.prochain_annee ? new Date(e.prochain_annee,(e.prochain_mois||1)-1,e.prochain_jour||1) : null;
      if (d && d>today && (!bestD || d<bestD)) { bestD=d; best=e; }
    });
    return best?.id ?? null;
  },[evenements]);

  const hasFilter = !!recherche||!!statutFiltre||paysFiltres.length>0||secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  const reinit = ()=>{ setRecherche(""); setStatutFiltre(""); setPaysFiltres([]); setSecteursSel([]); setBranchesSel([]); setActivitesSel([]); };
  const nbFiltres = (recherche?1:0)+(statutFiltre?1:0)+paysFiltres.length+secteursSel.length+branchesSel.length+activitesSel.length;

  const togglePays     = (v:string) => setPaysFiltres(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleSecteur  = (v:string) => { setSecteursSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setBranchesSel([]); setActivitesSel([]); };
  const toggleBranche  = (v:string) => { setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setActivitesSel([]); };
  const toggleActivite = (v:string) => setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);

  return (
    <main style={{minHeight:"100vh",background:"#F6F5F3",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}
@keyframes pulseHalo{0%{box-shadow:0 0 0 0 rgba(0,79,145,0.45)}70%{box-shadow:0 0 0 9px rgba(0,79,145,0)}100%{box-shadow:0 0 0 0 rgba(0,79,145,0)}}
@keyframes pulseHaloVert{0%{box-shadow:0 0 0 0 rgba(24,128,56,0.45)}70%{box-shadow:0 0 0 9px rgba(24,128,56,0)}100%{box-shadow:0 0 0 0 rgba(24,128,56,0)}}`}</style>
      {/* Barre de titre */}
      <BarreTitre titre="Événements" compact actions={<NavActions onDark flouFond/>}
        droite={(()=>{
          const prochain = prochainId!=null ? tous.find(e=>e.id===prochainId) : null;
          if (!prochain) return null;
          return <BarreTitreBadge label="Prochain événement" detail={`${prochain.nom_event}${prochain.date_debut?` · ${fmtDate(prochain.date_debut)}`:""}`} onClick={()=>gate(()=>setSelec(prochain))}
            icon={<span className="material-symbols-outlined" style={{fontSize:16,color:"#fff",fontVariationSettings:"'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20",lineHeight:1}}>event</span>}/>;
        })()}>
        <BarreTitreSegment options={[{v:"liste",l:"Liste"},{v:"frise",l:"Frise chronologique"}]} value={vueMode} onChange={setVueMode}/>
      </BarreTitre>

      {/* Layout sidebar + contenu */}
      <div style={{display:"flex",alignItems:"flex-start"}}>

          {/* Sidebar bande */}
          <aside style={{width:sidebarOpen?sidebarWidth:52,flexShrink:0,transition:isResizing.current?"none":"width 0.25s",background:"#fff",borderRight:"1px solid #E8E5E3",height:"100vh",overflowY:"auto" as const,position:"sticky" as const,top:0,display:"flex",flexDirection:"column" as const}}>
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
              <>
                <div style={{position:"relative" as const,marginBottom:18}}>
                  <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                  <input value={recherche} onChange={e=>setRecherche(e.target.value)} placeholder="Rechercher…"
                    style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                  {recherche&&<button onClick={()=>setRecherche("")} aria-label="Effacer la recherche" style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                </div>
                <div style={{marginBottom:18}}>
                  <p style={{fontSize:11,fontWeight:700,color:statutFiltre?"#004f91":"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>Statut</p>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                    {STATUT_OPTS.map(b=>(
                      <button key={b.value} onClick={()=>setStatutFiltre(b.value)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",background:"transparent",cursor:"pointer",textAlign:"left" as const,fontSize:12,fontWeight:statutFiltre===b.value?700:400,color:statutFiltre===b.value?b.text:"#4a5568"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:b.text,opacity:statutFiltre===b.value?1:0.3,flexShrink:0}}/>{b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <SideFilter label="Pays hôte" color="#004f91" marginBottom={20} selected={paysFiltres} onToggle={togglePays}
                  items={paysHotes.map(p=>({value:p.nom,label:p.nom}))}/>
                <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs} secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel} onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
              </>
            </div>}
          </aside>

          {/* Grille */}
          <div style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>
            {loading?(
              <SkeletonCards n={6} cols={2} height={220}/>
            ):erreur?(
              <ErreurChargement onRetry={()=>charger()}/>
            ):evenements.length===0?(
              <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                <CalendarDays size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucun événement trouvé</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<BoutonEffacerFiltres onClick={reinit}/>}
              </div>
            ):vueMode==="frise"?(
              <FriseChronologique evenements={evenements} onOpen={(e:any)=>gate(()=>setSelec(e))} prochainId={prochainId}/>
            ):(
              <>
                <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:14}}>
                  {evenements.map(e=>{
                    const dateStr = e.date_debut
                      ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDate(e.date_debut) : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`)
                      : e.prochain_mois ? `${e.prochain_jour?e.prochain_jour+" ":""}${MOIS[(e.prochain_mois||1)-1]} ${e.prochain_annee||""}` : null;
                    const lieu = [e.ville,e.pays_hote_nom].filter(Boolean).join(", ");
                    const statut = computeStatutEvenement(e);
                    // Récurrents sans date fixe : la prochaine occurrence est à venir
                    const statutAff = statut ?? ((e.prochain_annee || e.prochain_mois) ? "a_venir" : null);
                    const ST: any = {
                      a_venir:  { label:"À venir",  c:"#004f91", bg:"rgba(0,79,145,0.07)"  },
                      en_cours: { label:"En cours", c:"#188038", bg:"rgba(24,128,56,0.08)" },
                      termine:  { label:"Terminé",  c:"#6b7280", bg:"#F2F0EF"              },
                    };
                    const st = statutAff ? ST[statutAff] : null;
                    const estProchain = prochainId!=null && e.id===prochainId;
                    const estEnCours = statutAff==="en_cours";
                    const estPasse = statutAff==="termine";
                    const accent = estProchain
                      ? { c:"#004f91", grad:"linear-gradient(90deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", label:"Prochain événement", b:"rgba(0,79,145,0.45)", b2:"rgba(0,79,145,0.6)", sh:"0 4px 18px rgba(0,79,145,0.15)" }
                      : estEnCours
                      ? { c:"#188038", grad:"linear-gradient(90deg,#0d5c26 0%,#188038 60%,#2aa14e 100%)", label:"Événement en cours", b:"rgba(24,128,56,0.45)", b2:"rgba(24,128,56,0.6)", sh:"0 4px 18px rgba(24,128,56,0.15)" }
                      : null;
                    const txtC   = estPasse ? "#4a5568" : "#1a1a2e";
                    // Accent du survol = couleur du rôle (assortie au badge)
                    const hoverC = accent ? accent.c : accentRole(e.role_apix);
                    return (
                      <div key={e.id} onClick={()=>gate(()=>setSelec(e))}
                        style={{background:estPasse?"#FBFAF9":"#fff",border:accent?`1.5px solid ${accent.b}`:"1px solid #ECEAE7",borderRadius:16,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:accent?accent.sh:"0 1px 2px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column" as const,overflow:"hidden"}}
                        onMouseEnter={ev=>{
                          ev.currentTarget.style.boxShadow="0 14px 32px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=accent?accent.b2:`${hoverC}55`;
                          // Contenus trop longs : glissent pour révéler la fin
                          ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                            const span = box.firstElementChild as HTMLElement | null;
                            if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                          });
                        }}
                        onMouseLeave={ev=>{
                          ev.currentTarget.style.boxShadow=accent?accent.sh:"0 1px 2px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=accent?accent.b:"#ECEAE7";
                          ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                            const span = box.firstElementChild as HTMLElement | null;
                            if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                          });
                        }}>

                        {/* Bande épaisse (comme la frise) : événement en cours (vert)
                            et prochain événement (bleu) */}
                        {accent&&(
                          <div style={{display:"flex",alignItems:"center",gap:7,background:accent.grad,padding:"6px 16px",flexShrink:0}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:"#fff",animation:"pulseDot 1.6s ease-out infinite",flexShrink:0}}/>
                            <span style={{fontSize:10,fontWeight:800,color:"#fff",letterSpacing:"0.12em",textTransform:"uppercase" as const}}>{accent.label}</span>
                          </div>
                        )}
                        <div style={{padding:"18px 20px 16px",flex:1,display:"flex",flexDirection:"column" as const,gap:13}}>
                          {/* Titre + édition | rôle APIX (le statut se lit sur la bande / les dates) */}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                            <div style={{minWidth:0,flex:1}}>
                              <div style={{fontWeight:800,fontSize:15.5,color:txtC,lineHeight:1.35,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{e.nom_event}</div>
                              {(()=>{
                                const sousTitre = statutAff==="a_venir" ? (dansCombien(e) ?? (e.edition!=null?ordinal(e.edition):null)) : (e.edition!=null?ordinal(e.edition):null);
                                return sousTitre&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginTop:3}}>{sousTitre}</div>;
                              })()}
                            </div>
                            {e.role_apix&&<BadgeRole role={e.role_apix}/>}
                          </div>

                          {/* Date · Lieu en rangée épurée */}
                          <div style={{display:"flex",alignItems:"center",borderTop:"1px solid #F2F0EF",paddingTop:13,marginTop:"auto"}}>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Date</p>
                              <p data-marquee style={{fontSize:12.5,fontWeight:700,color:dateStr?txtC:"#C5BFBB",fontVariantNumeric:"tabular-nums",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                <span style={{display:"inline-block"}}>{dateStr||"—"}</span>
                              </p>
                            </div>
                            <div style={{width:1,alignSelf:"stretch",background:"#F2F0EF",margin:"0 18px"}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Lieu</p>
                              <p data-marquee style={{fontSize:12.5,fontWeight:700,color:lieu?txtC:"#C5BFBB",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                <span style={{display:"inline-block"}}>{lieu||"—"}</span>
                              </p>
                            </div>
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

      <EvenementVueModal ev={selec} onClose={()=>setSelec(null)}/>
    </main>
  );
}
