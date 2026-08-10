"use client";

import PanneauFiltres, { carteCliquable } from "@/components/shared/PanneauFiltres";
import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreBadge, BarreTitreSegment } from "@/components/shared/BarreTitre";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthGate } from "@/lib/authGate";
import { useNaemaArbre, useRefPays } from "@/lib/referentiels";
import { fetchTous } from "@/lib/fetchTous";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { fmtDate } from "@/lib/format";
import { badge_vert, badge_orange, badge_bleu, badge_violet, badge_ambre, badge_gris, voile } from "@/lib/couleurs";
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
  "Organisateur": "var(--vert)", "Co-organisateur": "var(--vert)",
  "Participant": "var(--orange)", "Partenaire": "var(--bleu)",
  "Invité": "var(--violet)", "Sponsor": "var(--ambre)",
};
const accentRole = (role?: string | null) => (role && ROLE_ACCENT[role]) || "var(--bleu)";



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
  { value:"",         label:"Tous",     bg:"var(--fond)", text:"var(--texte)" },
  { value:"a_venir",  label:"À venir",  bg:"rgb(var(--bleu-rgb) / 0.08)", text:"var(--bleu-action)" },
  { value:"en_cours", label:"En cours", bg:"rgb(var(--vert-rgb) / 0.08)", text:"var(--vert-action)" },
  { value:"termine",  label:"Terminés", bg:"var(--champ)", text:"var(--gris-fort)" },
];

// ── Frise chronologique des événements ────────────────────────────────────────
function FriseChronologique({ evenements, onOpen, prochainId }: { evenements:any[]; onOpen:(e:any)=>void; prochainId:number|null }) {
  const ST: any = {
    a_venir:  { label:"À venir",  c:"var(--bleu)", bg:"rgb(var(--bleu-rgb) / 0.07)"  },
    en_cours: { label:"En cours", c:"var(--vert)", bg:"rgb(var(--vert-rgb) / 0.08)" },
    termine:  { label:"Terminé",  c:"var(--gris-fort)", bg:"var(--fond)"              },
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
    ev.currentTarget.style.boxShadow="var(--ombre-1)"; ev.currentTarget.style.transform="translateY(-2px)"; ev.currentTarget.style.borderColor="rgb(var(--bleu-rgb) / 0.25)";
    ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
      const span = box.firstElementChild as HTMLElement|null;
      if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d/40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
    });
  };
  const hoverOut = (ev:React.MouseEvent<HTMLDivElement>) => {
    ev.currentTarget.style.boxShadow="none"; ev.currentTarget.style.transform="none"; ev.currentTarget.style.borderColor="rgb(var(--encre-rgb) / 0.12)";
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
      ? { grad:"linear-gradient(90deg,var(--bleu-nuit) 0%,var(--bleu) 60%,var(--bleu-clair) 100%)", label:"Prochain événement", b:"rgb(var(--bleu-rgb) / 0.45)", b2:"rgb(var(--bleu-rgb) / 0.6)", sh:"0 4px 18px rgb(var(--bleu-rgb) / 0.15)" }
      : estEnCours
      ? { grad:"linear-gradient(90deg,var(--vert-fonce) 0%,var(--vert) 60%,var(--vert) 100%)", label:"Événement en cours", b:"rgb(var(--vert-rgb) / 0.45)", b2:"rgb(var(--vert-rgb) / 0.6)", sh:"0 4px 18px rgb(var(--vert-rgb) / 0.15)" }
      : null;
    const dateStr = e.date_debut
      ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDate(e.date_debut) : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`)
      : e.prochain_mois||e.prochain_annee ? `${e.prochain_jour?e.prochain_jour+" ":""}${e.prochain_mois?MOIS[(e.prochain_mois||1)-1]+" ":""}${e.prochain_annee||""}`.trim() : null;
    const lieu = [e.ville,e.pays_hote_nom].filter(Boolean).join(", ");
    const txtC  = estPasse ? "var(--texte)" : "var(--encre)";
    const hoverC = accent ? null : accentRole(e.role_apix);
    return (
      <div {...carteCliquable(()=>onOpen(e))}
        onMouseEnter={ev=>{ hoverIn(ev); ev.currentTarget.style.borderColor = accent ? accent.b2 : `${hoverC}55`; }}
        onMouseLeave={ev=>{ hoverOut(ev); if(accent){ ev.currentTarget.style.borderColor=accent.b; ev.currentTarget.style.boxShadow=accent.sh; } }}
        style={{background:estPasse?"var(--carte-douce)":"var(--carte)",border:accent?`1.5px solid ${accent.b}`:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:accent?accent.sh:"none",overflow:"hidden",minWidth:0,display:"flex",flexDirection:"column" as const}}>
        {/* Bande épaisse : événement en cours (vert) et prochain événement (bleu) */}
        {accent&&(
          <div style={{display:"flex",alignItems:"center",gap:7,background:accent.grad,padding:"6px 16px",flexShrink:0}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"var(--carte)",animation:"pulseDot 1.6s ease-out infinite",flexShrink:0}}/>
            <span style={{fontSize:10,fontWeight:800,color:"var(--sur-bleu)",letterSpacing:"0.12em",textTransform:"uppercase" as const}}>{accent.label}</span>
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
                return sousTitre&&<div style={{fontSize:11,fontWeight:500,color:"var(--gris)",marginTop:3}}>{sousTitre}</div>;
              })()}
            </div>
            {e.role_apix&&<BadgeRole role={e.role_apix}/>}
          </div>

          {/* Date · Lieu en rangée épurée */}
          <div style={{display:"flex",alignItems:"center",borderTop:"1px solid var(--bordure)",paddingTop:11,marginTop:"auto"}}>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Date</p>
              <p data-marquee style={{fontSize:12,fontWeight:700,color:dateStr?txtC:"var(--gris)",fontVariantNumeric:"tabular-nums",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                <span style={{display:"inline-block"}}>{dateStr||"—"}</span>
              </p>
            </div>
            <div style={{width:1,alignSelf:"stretch",background:"var(--fond)",margin:"0 14px"}}/>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Lieu</p>
              <p data-marquee style={{fontSize:12,fontWeight:700,color:lieu?txtC:"var(--gris)",overflow:"hidden",whiteSpace:"nowrap" as const}}>
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
        <div style={{position:"absolute" as const,top:8,bottom:8,left:"50%",width:2,transform:"translateX(-1px)",background:"linear-gradient(180deg,rgb(var(--bleu-rgb) / 0.30) 0%,rgb(var(--bleu-rgb) / 0.12) 60%,rgb(var(--bleu-rgb) / 0.04) 100%)",borderRadius:2}}/>

        {parAnnee.map(({annee,items})=>(
          <div key={annee}>
            {/* Jalon année */}
            <div style={{display:"flex",justifyContent:"center",padding:"6px 0 20px",position:"relative" as const,zIndex:1}}>
              <span style={{background:"var(--bleu-action)",color:"var(--sur-bleu)",fontWeight:800,fontSize:13,letterSpacing:"0.06em",padding:"7px 22px",borderRadius:999,boxShadow:"0 4px 14px rgb(var(--ombre-rgb) / 0.30)"}}>{annee}</span>
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
                    <div style={{position:"absolute" as const,top:"50%",height:2,background:"rgb(var(--bleu-rgb) / 0.15)",width:24,...(gauche?{right:"50%",marginRight:6}:{left:"50%",marginLeft:6})}}/>
                    {prochainId!=null&&e.id===prochainId
                      ? <div style={{width:15,height:15,borderRadius:"50%",background:"var(--bleu-action)",border:"3px solid var(--bordure)",animation:"pulseHalo 1.8s ease-out infinite",position:"relative" as const,zIndex:1}}/>
                      : statut==="en_cours"
                      ? <div style={{width:15,height:15,borderRadius:"50%",background:"var(--vert-action)",border:"3px solid var(--bordure)",animation:"pulseHaloVert 1.8s ease-out infinite",position:"relative" as const,zIndex:1}}/>
                      : <div style={{width:13,height:13,borderRadius:"50%",background:st?st.c:"var(--bleu)",border:"3px solid var(--bordure)",boxShadow:`0 0 0 1px ${voile(st?st.c:"var(--bleu)", 27)}`,position:"relative" as const,zIndex:1}}/>}
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
          <p style={{fontSize:10.5,fontWeight:700,color:"var(--gris)",letterSpacing:"0.14em",textTransform:"uppercase" as const,textAlign:"center" as const,marginBottom:14}}>Date à confirmer</p>
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
    fetch(`${API_BASE}/evenements/pays-hotes`).then(r=>r.json()).catch(()=>[])
      .then((hotes)=>{
        const refPays = (refPaysData as any[]) || [];
        setPaysHotes((hotes||[]).map((nom:string)=>{
          const ref=refPays.find((p:any)=>p.nom_fr===nom);
          return {nom,code_iso2:ref?.code_iso2||""};
        }));
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
      } else {
        // Récurrent sans date fixée : sa prochaine occurrence est à venir —
        // c'est ce que les cartes affichent déjà. Sans cette branche, il
        // traversait TOUS les filtres de statut, « Terminés » compris.
        if (statutFiltre !== "a_venir") return false;
      }
    }
    if (paysFiltres.length>0 && !paysFiltres.includes(e.pays_hote_nom||"")) return false;
    if (secteursSel.length>0 && !secteursSel.some((s:string)=>(e.secteur_noms||[]).includes(s))) return false;
    if (branchesSel.length>0 && !branchesSel.some((b:string)=>(e.branche_noms||[]).includes(b))) return false;
    if (activitesSel.length>0 && !activitesSel.some((a:string)=>(e.activite_noms||[]).includes(a))) return false;
    return true;
  }), [tous, recherche, statutFiltre, paysFiltres, secteursSel, branchesSel, activitesSel]);

  // Prochain événement (date future la plus proche). Deux portées, deux rôles :
  // sur la liste FILTRÉE pour la carte à mettre en avant dans la vue courante,
  // sur `tous` pour le badge du bandeau — il annonce le prochain événement de
  // l'agence, pas celui du filtre en cours, sans quoi filtrer sur un secteur
  // faisait proclamer au hero un « prochain événement » qui n'était pas le vrai.
  const prochainDe = (liste:any[]): number|null => {
    const today = new Date(); today.setHours(0,0,0,0);
    let best: any = null, bestD: Date|null = null;
    liste.forEach(e=>{
      const d = e.date_debut ? new Date(e.date_debut+"T00:00:00")
        : e.prochain_annee ? new Date(e.prochain_annee,(e.prochain_mois||1)-1,e.prochain_jour||1) : null;
      if (d && d>today && (!bestD || d<bestD)) { bestD=d; best=e; }
    });
    return best?.id ?? null;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prochainId: number|null = useMemo(()=>prochainDe(evenements),[evenements]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prochainGlobalId: number|null = useMemo(()=>prochainDe(tous),[tous]);

  const hasFilter = !!recherche||!!statutFiltre||paysFiltres.length>0||secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  const reinit = ()=>{ setRecherche(""); setStatutFiltre(""); setPaysFiltres([]); setSecteursSel([]); setBranchesSel([]); setActivitesSel([]); };
  const nbFiltres = (recherche?1:0)+(statutFiltre?1:0)+paysFiltres.length+secteursSel.length+branchesSel.length+activitesSel.length;

  const togglePays     = (v:string) => setPaysFiltres(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleSecteur  = (v:string) => { setSecteursSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setBranchesSel([]); setActivitesSel([]); };
  const toggleBranche  = (v:string) => { setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setActivitesSel([]); };
  const toggleActivite = (v:string) => setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);

  return (
    <main style={{ height:"100dvh", display:"flex", flexDirection:"column", overflow:"hidden",
      background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}
@keyframes pulseHalo{0%{box-shadow:0 0 0 0 rgb(var(--ombre-rgb) / 0.45)}70%{box-shadow:0 0 0 9px rgb(var(--ombre-rgb) / 0)}100%{box-shadow:0 0 0 0 rgb(var(--ombre-rgb) / 0)}}
@keyframes pulseHaloVert{0%{box-shadow:0 0 0 0 rgb(var(--ombre-rgb) / 0.45)}70%{box-shadow:0 0 0 9px rgb(var(--ombre-rgb) / 0)}100%{box-shadow:0 0 0 0 rgb(var(--ombre-rgb) / 0)}}`}</style>
      {/* Barre de titre */}
      <BarreTitre titre="Événements" compact actions={<NavActions onDark home flouFond/>}
        droite={(()=>{
          const prochain = prochainGlobalId!=null ? tous.find(e=>e.id===prochainGlobalId) : null;
          if (!prochain) return null;
          return <BarreTitreBadge label="Prochain événement" detail={`${prochain.nom_event}${prochain.date_debut?` · ${fmtDate(prochain.date_debut)}`:""}`} onClick={()=>gate(()=>setSelec(prochain))}
            icon={<span className="material-symbols-outlined" style={{fontSize:16,color:"var(--sur-bleu)",fontVariationSettings:"'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20",lineHeight:1}}>event</span>}/>;
        })()}>
        <BarreTitreSegment options={[{v:"liste",l:"Liste",count:evenements.length},{v:"frise",l:"Frise chronologique"}]} value={vueMode} onChange={setVueMode}/>
      </BarreTitre>

      {/* Layout sidebar + contenu */}
      <div style={{display:"flex",flex:1,minHeight:0}}>

          {/* Sidebar bande */}
          <PanneauFiltres nbFiltres={nbFiltres} aDesFiltres={hasFilter} onReinit={reinit}
            recherche={recherche} setRecherche={setRecherche}>
                <div style={{marginBottom:18}}>
                  <p style={{fontSize:11,fontWeight:700,color:statutFiltre?"var(--bleu)":"var(--gris)",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>Statut</p>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                    {STATUT_OPTS.map(b=>(
                      <button key={b.value} onClick={()=>setStatutFiltre(b.value)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",background:"transparent",cursor:"pointer",textAlign:"left" as const,fontSize:12,fontWeight:statutFiltre===b.value?700:400,color:statutFiltre===b.value?b.text:"var(--texte)"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="var(--carte-douce)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:b.text,opacity:statutFiltre===b.value?1:0.3,flexShrink:0}}/>{b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
                <SideFilter label="Pays hôte" color="var(--bleu)" marginBottom={20} selected={paysFiltres} onToggle={togglePays}
                  items={paysHotes.map(p=>({value:p.nom,label:p.nom}))}/>
                <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs} secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel} onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
          </PanneauFiltres>

          {/* Grille */}
          <div style={{flex:1,minWidth:0,overflowY:"auto",overscrollBehavior:"contain",padding:"36px 40px 80px"}}>
            {loading?(
              <SkeletonCards n={6} cols={2} height={220}/>
            ):erreur?(
              <ErreurChargement onRetry={()=>charger()}/>
            ):evenements.length===0?(
              <div style={{textAlign:"center",padding:"80px 24px",color:"var(--gris)"}}>
                <CalendarDays size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>Aucun événement trouvé</p>
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
                      a_venir:  { label:"À venir",  c:"var(--bleu)", bg:"rgb(var(--bleu-rgb) / 0.07)"  },
                      en_cours: { label:"En cours", c:"var(--vert)", bg:"rgb(var(--vert-rgb) / 0.08)" },
                      termine:  { label:"Terminé",  c:"var(--gris-fort)", bg:"var(--fond)"              },
                    };
                    const st = statutAff ? ST[statutAff] : null;
                    const estProchain = prochainId!=null && e.id===prochainId;
                    const estEnCours = statutAff==="en_cours";
                    const estPasse = statutAff==="termine";
                    const accent = estProchain
                      ? { c:"var(--bleu)", grad:"linear-gradient(90deg,var(--bleu-nuit) 0%,var(--bleu) 60%,var(--bleu-clair) 100%)", label:"Prochain événement", b:"rgb(var(--bleu-rgb) / 0.45)", b2:"rgb(var(--bleu-rgb) / 0.6)", sh:"0 4px 18px rgb(var(--bleu-rgb) / 0.15)" }
                      : estEnCours
                      ? { c:"var(--vert)", grad:"linear-gradient(90deg,var(--vert-fonce) 0%,var(--vert) 60%,var(--vert) 100%)", label:"Événement en cours", b:"rgb(var(--vert-rgb) / 0.45)", b2:"rgb(var(--vert-rgb) / 0.6)", sh:"0 4px 18px rgb(var(--vert-rgb) / 0.15)" }
                      : null;
                    const txtC   = estPasse ? "var(--texte)" : "var(--encre)";
                    // Accent du survol = couleur du rôle (assortie au badge)
                    const hoverC = accent ? accent.c : accentRole(e.role_apix);
                    return (
                      <div key={e.id} {...carteCliquable(()=>gate(()=>setSelec(e)))}
                        style={{background:estPasse?"var(--carte-douce)":"var(--carte)",border:accent?`1.5px solid ${accent.b}`:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:accent?accent.sh:"none",display:"flex",flexDirection:"column" as const,overflow:"hidden"}}
                        onMouseEnter={ev=>{
                          ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=accent?accent.b2:`${hoverC}55`;
                          // Contenus trop longs : glissent pour révéler la fin
                          ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                            const span = box.firstElementChild as HTMLElement | null;
                            if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                          });
                        }}
                        onMouseLeave={ev=>{
                          ev.currentTarget.style.boxShadow=accent?accent.sh:"none";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=accent?accent.b:"rgb(var(--encre-rgb) / 0.12)";
                          ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                            const span = box.firstElementChild as HTMLElement | null;
                            if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                          });
                        }}>

                        {/* Bande épaisse (comme la frise) : événement en cours (vert)
                            et prochain événement (bleu) */}
                        {accent&&(
                          <div style={{display:"flex",alignItems:"center",gap:7,background:accent.grad,padding:"6px 16px",flexShrink:0}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:"var(--carte)",animation:"pulseDot 1.6s ease-out infinite",flexShrink:0}}/>
                            <span style={{fontSize:10,fontWeight:800,color:"var(--sur-bleu)",letterSpacing:"0.12em",textTransform:"uppercase" as const}}>{accent.label}</span>
                          </div>
                        )}
                        <div style={{padding:"18px 20px 16px",flex:1,display:"flex",flexDirection:"column" as const,gap:13}}>
                          {/* Titre + édition | rôle APIX (le statut se lit sur la bande / les dates) */}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                            <div style={{minWidth:0,flex:1}}>
                              <div style={{fontWeight:800,fontSize:15.5,color:txtC,lineHeight:1.35,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{e.nom_event}</div>
                              {(()=>{
                                const sousTitre = statutAff==="a_venir" ? (dansCombien(e) ?? (e.edition!=null?ordinal(e.edition):null)) : (e.edition!=null?ordinal(e.edition):null);
                                return sousTitre&&<div style={{fontSize:11,fontWeight:500,color:"var(--gris)",marginTop:3}}>{sousTitre}</div>;
                              })()}
                            </div>
                            {e.role_apix&&<BadgeRole role={e.role_apix}/>}
                          </div>

                          {/* Date · Lieu en rangée épurée */}
                          <div style={{display:"flex",alignItems:"center",borderTop:"1px solid var(--bordure)",paddingTop:13,marginTop:"auto"}}>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Date</p>
                              <p data-marquee style={{fontSize:12.5,fontWeight:700,color:dateStr?txtC:"var(--gris)",fontVariantNumeric:"tabular-nums",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                <span style={{display:"inline-block"}}>{dateStr||"—"}</span>
                              </p>
                            </div>
                            <div style={{width:1,alignSelf:"stretch",background:"var(--fond)",margin:"0 18px"}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Lieu</p>
                              <p data-marquee style={{fontSize:12.5,fontWeight:700,color:lieu?txtC:"var(--gris)",overflow:"hidden",whiteSpace:"nowrap" as const}}>
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
