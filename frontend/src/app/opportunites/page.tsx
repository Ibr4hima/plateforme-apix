"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import Badge from "@/components/shared/Badge";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { ChevronDown, ChevronUp, FileText, Search, SlidersHorizontal, User, X } from "lucide-react";
import { POLE_COULEURS, normPole } from "@/components/shared/VueTerritorialeSenegal";
import { parsePhoneNumber } from "libphonenumber-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "@/lib/fuse";
import { useGeoArbre, useNaema, useNaemaArbre, useRefPolesTerritoires } from "@/lib/referentiels";
import { fetchTous } from "@/lib/fetchTous";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { foncerPastel, COMP_PALETTE } from "@/lib/couleurs";
import { fmtPhone } from "@/lib/telephone";
import { demarrerRedimension } from "@/lib/redimension";
import { SideFilter, ThematiquesCascadeFilter, LocalisationFilter } from "@/components/shared/FiltresLateraux";
import ProjetVueModal from "@/components/shared/ProjetVueModal";
import PotentialiteVueModal from "@/components/shared/PotentialiteVueModal";
import AvantageVueModal from "@/components/shared/AvantageVueModal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";


const devSymbole = (code?:string, sym?:string) => sym || (code ? ({XOF:"FCFA",USD:"$",EUR:"€"}[code]||code) : "");

function ScrollTitle({ text, speed=25, delay=2.5 }: { text:string; speed?:number; delay?:number }) {
  const cRef = useRef<HTMLDivElement>(null);
  const tRef = useRef<HTMLSpanElement>(null);
  const [ov, setOv] = useState(0);

  useEffect(()=>{
    const measure = ()=>{
      const c=cRef.current; const t=tRef.current;
      if (!c||!t) return;
      setOv(Math.max(0, t.scrollWidth - c.clientWidth));
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (cRef.current) obs.observe(cRef.current);
    return ()=>obs.disconnect();
  }, [text]);

  const scrollTime = ov > 0 ? ov / speed : 0;
  const total = delay + scrollTime;
  const pausePct = ov > 0 ? (delay / total * 100).toFixed(1) : "0";
  const animName = `scroll-title-${ov}`;

  return (
    <div ref={cRef} style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:8,overflow:"hidden",whiteSpace:"nowrap" as const}}>
      {ov>0 && <style>{`@keyframes ${animName}{0%,${pausePct}%{transform:translateX(0)}100%{transform:translateX(-${ov}px)}}`}</style>}
      <span ref={tRef} style={{display:"inline-block",...(ov>0?{animation:`${animName} ${total}s linear infinite`}:{})}}>{text}</span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const DEVISE_SYM: Record<string,string> = { XOF:"FCFA", USD:"$", EUR:"€", GBP:"£", CNY:"¥" };
const devSym = (code?:string, sym?:string) => sym || (code ? DEVISE_SYM[code]||code : "");

function BadgePole({ nom }: { nom:string }) {
  const c = POLE_COULEURS[normPole(nom)] || "#C5BFBB";
  return (
    <span title={nom} style={{display:"inline-flex",alignItems:"center",fontSize:10.5,fontWeight:700,color:foncerPastel(c),background:`${c}40`,border:`1px solid ${c}90`,padding:"3px 11px",borderRadius:999,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",flexShrink:1,minWidth:0}}>
      {nom}
    </span>
  );
}

// Secteurs économiques des avantages & incitations
const SECTEURS_AVGS = [
  {key:"primaire",   label:"Secteur Primaire",   color:"#188038"},
  {key:"secondaire", label:"Secteur Secondaire", color:"#ca631f"},
  {key:"tertiaire",  label:"Secteur Tertiaire",  color:"#004f91"},
] as const;

// Niveaux de découpage territorial des potentialités
const NIVEAUX_POTS = [
  {key:"pole",           label:"Pôles territoires", unit:"pôle",           abbr:"PÔLE", color:"#004f91"},
  {key:"region",         label:"Régions",           unit:"région",         abbr:"RÉG",  color:"#ca631f"},
  {key:"departement",    label:"Départements",      unit:"département",    abbr:"DÉP",  color:"#188038"},
  {key:"arrondissement", label:"Arrondissements",   unit:"arrondissement", abbr:"ARR",  color:"#6A1B9A"},
] as const;

function fmtInvest(p:any) {
  const sym = devSym(p.devise_code, p.devise_symbole);
  if (!p.investissement_est_intervalle)
    return p.investissement ? `${Number(p.investissement).toLocaleString("fr-FR")} ${sym}` : null;
  if (!p.investissement_min) return null;
  const min = Number(p.investissement_min).toLocaleString("fr-FR");
  const max = p.investissement_max ? Number(p.investissement_max).toLocaleString("fr-FR") : "…";
  return `${min} – ${max} ${sym}`;
}

// ── Filtre Atouts & Potentialités ────────────────────────────────────────────
function AtotusFiltreFilter({ pots, refAvantages, selected, onToggle }: {
  pots:any[]; refAvantages:any[]; selected:string[]; onToggle:(v:string)=>void;
}) {
  const [open, setOpen] = useState(true);
  const usedAvantageIds = new Set<number>();
  pots.forEach(p => (p.avantage_ids||[]).forEach((id:number) => usedAvantageIds.add(id)));
  const CAT_COLORS: Record<string,string> = {
    "Ressources naturelles":"#059669","Infrastructure":"#0891b2",
    "Démographie":"#7c3aed","Démographie & main d'œuvre":"#7c3aed","Atouts économiques":"#ca631f",
    "Environnement des affaires":"#d97706","Localisation stratégique":"#E35336",
  };
  const catMap = new Map<string, {libelle:string; couleur:string; atouts:string[]}>();
  refAvantages.filter(a => usedAvantageIds.has(a.id)).forEach(a => {
    const cat = a.categorie_libelle || "Autres";
    if (!catMap.has(cat)) catMap.set(cat, {libelle:cat, couleur:CAT_COLORS[cat]||"#9aa5b4", atouts:[]});
    if (!catMap.get(cat)!.atouts.includes(a.libelle)) catMap.get(cat)!.atouts.push(a.libelle);
  });
  const categories = Array.from(catMap.values());
  if (categories.length === 0) return null;
  const hasFilter = selected.length > 0;
  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?10:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"#9aa5b4",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Atouts & potentialités</span>
          {hasFilter&&<span style={{fontSize:10,fontWeight:700,color:"#059669",background:"rgba(5,150,105,0.12)",padding:"1px 6px",borderRadius:999}}>{selected.length}</span>}
        </div>
        <span style={{width:20,height:20,borderRadius:"50%",background:"#F5F4F3",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {open?<ChevronUp size={11} style={{color:"#4a5568"}}/>:<ChevronDown size={11} style={{color:"#4a5568"}}/>}
        </span>
      </button>
      {open&&(
        <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
          {categories.map(cat=>{
            const color = cat.couleur;
            return (
              <div key={cat.libelle}>
                <p style={{fontSize:10,fontWeight:700,color,marginBottom:4,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>{cat.libelle}</p>
                <div style={{paddingLeft:8,borderLeft:`2px solid ${color}25`,display:"flex",flexDirection:"column" as const,gap:2}}>
                  {cat.atouts.map(atout=>{
                    const sel = selected.includes(atout);
                    return (
                      <button key={atout} onClick={()=>onToggle(atout)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F8F7F6";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?color:"#C5BFBB"}`,background:sel?color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                                  </div>
                        <span style={{fontSize:12,color:"#4a5568",fontWeight:sel?700:400}}>{atout}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Modal vue projet (identique admin) ───────────────────────────────────────
export default function OpportunitesPage() {
  const [onglet, setOnglet] = useEtatUrl<"projets"|"potentialites"|"avantages">("onglet", "projets", ["projets","potentialites","avantages"]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);

  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 520);

  // Données référentielles
  const [poles,       setPoles]       = useState<any[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [branches,    setBranches]    = useState<any[]>([]);
  const [activites,   setActivites]   = useState<any[]>([]);
  const [refAvantages,setRefAvantages]= useState<any[]>([]);

  // Stats hero
  const [stats, setStats] = useState({ projets:0, potentialites:0, activites:0 });

  // ── Projets ──
  const [projets,    setProjets]    = useState<any[]>([]);
  const [projLoad,   setProjLoad]   = useState(true);
  const [projErr,    setProjErr]    = useState(false);
  const [projSel,    setProjSel]    = useState<any>(null);
  const [projQ,      setProjQ]      = useState("");
  const [projPoles,  setProjPoles]  = useState<string[]>([]);
  const [projSects,  setProjSects]  = useState<string[]>([]);
  const [projBranches,    setProjBranches]    = useState<string[]>([]);
  const [projActivites,   setProjActivites]   = useState<string[]>([]);
  const [projRegions,     setProjRegions]     = useState<string[]>([]);
  const [projDepts,       setProjDepts]       = useState<string[]>([]);
  const [projArrs,        setProjArrs]        = useState<string[]>([]);
  // Arbre géo pour filtres
  const [regions, setRegions] = useState<any[]>([]);

  // ── Potentialités ──
  const [pots,     setPots]     = useState<any[]>([]);
  const [potsLoad, setPotsLoad] = useState(true);
  const [potsErr,  setPotsErr]  = useState(false);
  const [potSel,   setPotSel]   = useState<any>(null);
  const [potsNiveau,setPotsNiveau]=useState<string[]>([]);
  const [potsPoles, setPotsPoles]=useState<string[]>([]);
  const [potsSects,  setPotsSects]  = useState<string[]>([]);
  const [potsBranches,setPotsBranches]=useState<string[]>([]);
  const [potsActivites,setPotsActivites]=useState<string[]>([]);
  const [potsAtouts, setPotsAtouts] = useState<string[]>([]);
  const [potsQ,      setPotsQ]      = useState("");
  const [selectedNiveau, setSelectedNiveau] = useState<string|null>(null);

  // ── Avantages ──
  const [avgs,          setAvgs]          = useState<any[]>([]);
  const [avgsLoad,      setAvgsLoad]      = useState(true);
  const [avgsErr,       setAvgsErr]       = useState(false);
  const [avgSel,        setAvgSel]        = useState<any>(null);
  const [avgSects,      setAvgSects]      = useState<string[]>([]);
  const [avgBranches,   setAvgBranches]   = useState<string[]>([]);
  const [avgActivites,  setAvgActivites]  = useState<string[]>([]);
  const [avgTypes,      setAvgTypes]      = useState<string[]>([]);
  const [avgsQ,         setAvgsQ]         = useState("");
  const [avgsOpen,      setAvgsOpen]      = useState<Record<number,boolean>>({});
  const [refAvgTypes,   setRefAvgTypes]   = useState<any[]>([]);
  const [expandedSec, setExpandedSec] = useState<number|null>(null);
  const [expandedBranch,setExpandedBranch] = useState<number|null>(null);
  const [selectedSecAvg, setSelectedSecAvg] = useState<string|null>(null);

  useEffect(()=>{ setSelectedSecAvg(null); setSelectedNiveau(null); },[onglet]);

  // Référentiels servis par le cache partagé
  const naemaPage = useNaema();
  const { arbre: naemaArbrePage } = useNaemaArbre();
  const { arbre: geoArbrePage } = useGeoArbre();
  const { data: polesRefData } = useRefPolesTerritoires();
  useEffect(()=>{ setPoles(((polesRefData as any[])||[])); },[polesRefData]);
  useEffect(()=>{ setBranches(naemaPage.branches); setActivites(naemaPage.activites); },[naemaPage.branches, naemaPage.activites]);
  useEffect(()=>{ setSecteurs(naemaArbrePage); },[naemaArbrePage]);
  useEffect(()=>{ setRegions(geoArbrePage); },[geoArbrePage]);
  useEffect(()=>{
    fetch(`${API}/ref-potentialites/flat`).then(r=>r.json()).then(d=>setRefAvantages(d||[])).catch(()=>{});
    fetch(`${API}/ref-avantages`).then(r=>r.json()).then(setRefAvgTypes).catch(()=>{});
  },[]);

  // Chargements principaux par onglet : en cas d'échec, état d'erreur avec relance
  const chargerProjets = useCallback(async()=>{
    setProjLoad(true); setProjErr(false);
    try {
      const data = await fetchTous(`${API}/projets`);
      setProjets(data);
      setStats(prev=>({...prev, projets:data.length}));
    } catch { setProjErr(true); }
    finally { setProjLoad(false); }
  },[]);

  const chargerPots = useCallback(async()=>{
    setPotsLoad(true); setPotsErr(false);
    try {
      const data = await fetchTous(`${API}/opportunites/potentialites`);
      setPots(data);
      setStats(prev=>({...prev, potentialites:data.length}));
    } catch { setPotsErr(true); }
    finally { setPotsLoad(false); }
  },[]);

  const chargerAvgs = useCallback(async()=>{
    setAvgsLoad(true); setAvgsErr(false);
    try {
      const data = await fetchTous(`${API}/opportunites/avantages`);
      setAvgs(data);
      setStats(prev=>({...prev, activites:data.length}));
    } catch { setAvgsErr(true); }
    finally { setAvgsLoad(false); }
  },[]);

  useEffect(()=>{ chargerProjets(); chargerPots(); chargerAvgs(); },[chargerProjets,chargerPots,chargerAvgs]);

  // ── Filtrage projets ──
  // Arbre secteurs à plat, partagé par les trois onglets (mémoïsé)
  const branchesPlats = useMemo(()=>secteurs.flatMap((s:any)=>s.branches||[]),[secteurs]);
  const activitesPlats = useMemo(()=>branchesPlats.flatMap((b:any)=>b.activites||[]),[branchesPlats]);

  const projetsFiltres = useMemo(()=>projets.filter(p=>{
    if (projQ) { const q=projQ.toLowerCase(); if (!p.titre_projet?.toLowerCase().includes(q)&&!p.porteur_projet?.toLowerCase().includes(q)) return false; }
    if (projPoles.length>0&&!projPoles.includes(p.pole_nom||"")) return false;
    if (projSects.length>0) {
      const secIds = projSects.map(n=>secteurs.find((s:any)=>s.nom===n)?.id).filter(Boolean);
      if (!secIds.some((id:any)=>(p.secteur_ids||[]).includes(id))) return false;
    }
    if (projBranches.length>0) {
      const braIds = projBranches.map(n=>branchesPlats.find((b:any)=>b.nom===n)?.id).filter(Boolean);
      if (!braIds.some((id:any)=>(p.branche_ids||[]).includes(id))) return false;
    }
    if (projActivites.length>0) {
      const actIds = projActivites.map(n=>activitesPlats.find((a:any)=>a.nom===n)?.id).filter(Boolean);
      if (!actIds.some((id:any)=>(p.activite_ids||[]).includes(id))) return false;
    }
    if (projRegions.length>0&&!projRegions.includes(p.region_nom||"")) return false;
    if (projDepts.length>0&&!projDepts.includes(p.departement_nom||"")) return false;
    if (projArrs.length>0&&!projArrs.includes(p.arrondissement_nom||"")) return false;
    return true;
  }),[projets, projQ, projPoles, projSects, projBranches, projActivites, projRegions, projDepts, projArrs, secteurs, branchesPlats, activitesPlats]);

  // ── Filtrage potentialités ──
  const potBranchesPlats = branchesPlats;
  const potActivitesPlats = activitesPlats;

  // Enrichissement texte pour recherche
  const potsWithText = useMemo(()=>pots.map(p=>({
    ...p,
    _secteurs:  (p.secteur_ids||[]).map((id:number)=>secteurs.find((s:any)=>s.id===id)?.nom||"").filter(Boolean).join(" "),
    _branches:  (p.branche_ids||[]).map((id:number)=>potBranchesPlats.find((b:any)=>b.id===id)?.nom||"").filter(Boolean).join(" "),
    _activites: (p.activite_ids||[]).map((id:number)=>potActivitesPlats.find((a:any)=>a.id===id)?.nom||"").filter(Boolean).join(" "),
    _atouts:    (p.avantage_ids||[]).map((id:number)=>refAvantages.find((a:any)=>a.id===id)?.libelle||"").filter(Boolean).join(" "),
  })),[pots,secteurs,potBranchesPlats,potActivitesPlats,refAvantages]);

  const fuse = useMemo(()=>new Fuse(potsWithText,{
    keys:["titre","description","niveau_nom","pole_nom","_secteurs","_branches","_activites","_atouts"],
    threshold:0.35,
    ignoreLocation:true,
    minMatchCharLength:2,
  }),[potsWithText]);

  const potsBase = useMemo(()=>
    potsQ.trim() ? fuse.search(potsQ.trim()).map((r:any)=>r.item) : potsWithText
  ,[potsQ,fuse,potsWithText]);

  const potsFiltres = useMemo(()=>potsBase.filter((p:any)=>{
    if (potsNiveau.length>0&&!potsNiveau.includes(p.niveau)) return false;
    if (potsPoles.length>0&&!potsPoles.includes(p.pole_nom||"")) return false;
    if (potsSects.length>0) {
      const secIds = potsSects.map(n=>secteurs.find((s:any)=>s.nom===n)?.id).filter(Boolean);
      if (!secIds.some((id:any)=>(p.secteur_ids||[]).includes(id))) return false;
    }
    if (potsBranches.length>0) {
      const braIds = potsBranches.map(n=>potBranchesPlats.find((b:any)=>b.nom===n)?.id).filter(Boolean);
      if (!braIds.some((id:any)=>(p.branche_ids||[]).includes(id))) return false;
    }
    if (potsActivites.length>0) {
      const actIds = potsActivites.map(n=>potActivitesPlats.find((a:any)=>a.nom===n)?.id).filter(Boolean);
      if (!actIds.some((id:any)=>(p.activite_ids||[]).includes(id))) return false;
    }
    if (potsAtouts.length>0) {
      // Filtrer sur les libellés d'atouts (refAvantages)
      const atoutIds = refAvantages.filter(a=>potsAtouts.includes(a.libelle)).map(a=>a.id);
      if (!atoutIds.some((id:number)=>(p.avantage_ids||[]).includes(id))) return false;
    }
    return true;
  }),[potsBase, potsNiveau, potsPoles, potsSects, potsBranches, potsActivites, potsAtouts, secteurs, potBranchesPlats, potActivitesPlats, refAvantages]);

  // ── Filtrage avantages ──
  const avgBranchesPlats = branchesPlats;
  const avgActivitesPlats = activitesPlats;

  const avgsBase = useMemo(()=>{
    const q=avgsQ.trim().toLowerCase();
    if (!q) return avgs;
    const words=q.split(/\s+/).filter(w=>w.length>1);
    return avgs.filter(a=>{
      const hay=[a.activite_nom,a.secteur_nom,a.branche_nom,...(a.selections||[]).map((s:any)=>s.type_libelle)].filter(Boolean).join(" ").toLowerCase();
      return words.every(w=>hay.includes(w));
    });
  },[avgsQ,avgs]);

  const avgsFiltres = useMemo(()=>avgsBase.filter(a=>{
    if (avgSects.length>0) {
      const secIds = avgSects.map(n=>secteurs.find((s:any)=>s.nom===n)?.id).filter(Boolean);
      if (!secIds.includes(a.secteur_id)) return false;
    }
    if (avgBranches.length>0) {
      const braIds = avgBranches.map(n=>avgBranchesPlats.find((b:any)=>b.nom===n)?.id).filter(Boolean);
      if (!braIds.includes(a.branche_id)) return false;
    }
    if (avgActivites.length>0) {
      const actIds = avgActivites.map(n=>avgActivitesPlats.find((ac:any)=>ac.nom===n)?.id).filter(Boolean);
      if (!actIds.includes(a.activite_id)) return false;
    }
    if (avgTypes.length>0) {
      const hasType = (a.selections||[]).some((s:any)=>avgTypes.includes(s.type_libelle));
      if (!hasType) return false;
    }
    return true;
  }),[avgsBase, avgSects, avgBranches, avgActivites, avgTypes, secteurs, avgBranchesPlats, avgActivitesPlats]);

  // ── Helpers filtres ──
  const hasFilterProj = projQ||projPoles.length>0||projSects.length>0||projBranches.length>0||projActivites.length>0||projRegions.length>0||projDepts.length>0||projArrs.length>0;
  const hasFilterPots = !!potsQ||potsNiveau.length>0||potsPoles.length>0||potsSects.length>0||potsBranches.length>0||potsActivites.length>0||potsAtouts.length>0;
  const hasFilterAvgs = !!avgsQ||avgSects.length>0||avgBranches.length>0||avgActivites.length>0||avgTypes.length>0;
  const nbFiltres = onglet==="projets"?(projQ?1:0)+projPoles.length+projSects.length+projBranches.length+projActivites.length+projRegions.length+projDepts.length+projArrs.length : onglet==="potentialites"?(potsQ?1:0)+potsNiveau.length+potsPoles.length+potsSects.length+potsBranches.length+potsActivites.length+potsAtouts.length : (avgsQ?1:0)+avgSects.length+avgBranches.length+avgActivites.length+avgTypes.length;
  const reinit = () => { setProjQ(""); setProjPoles([]); setProjSects([]); setProjBranches([]); setProjActivites([]); setProjRegions([]); setProjDepts([]); setProjArrs([]); setPotsQ(""); setPotsNiveau([]); setPotsPoles([]); setPotsSects([]); setPotsBranches([]); setPotsActivites([]); setPotsAtouts([]); setAvgsQ(""); setAvgSects([]); setAvgBranches([]); setAvgActivites([]); setAvgTypes([]); };

  const toggle = (arr:string[], setArr:(v:string[])=>void) => (v:string) => setArr(arr.includes(v)?arr.filter((x:string)=>x!==v):[...arr,v]);

  // ── Accordéon avantages ──
  const secMap = new Map<number,{id:number;nom:string;branches:Map<number,{id:number;nom:string;items:any[]}>}>();
  avgsFiltres.forEach(a=>{
    const sid=a.secteur_id||0; const bid=a.branche_id||0;
    if (!secMap.has(sid)) secMap.set(sid,{id:sid,nom:a.secteur_nom||"Sans secteur",branches:new Map()});
    const sec=secMap.get(sid)!;
    if (!sec.branches.has(bid)) sec.branches.set(bid,{id:bid,nom:a.branche_nom||"Sans branche",items:[]});
    sec.branches.get(bid)!.items.push(a);
  });
  const secList=Array.from(secMap.values());
  const SECT_COLORS=["#ca631f","#004f91","#059669","#7c3aed","#0891b2","#d97706","#E35336"];

  const NIVEAUX_LABELS: Record<string,string> = {pole:"Pôles",region:"Régions",departement:"Départements",arrondissement:"Arrondissements"};
  const potTitle = (p:any) => (p.titre||"")
    .replace(/^[Pp]otentialités?\s+(de\s+l[''’]|de\s+la\s+|de\s+le\s+|du\s+|de\s+)/i, "")
    .replace(/^(.)/, (_:string,c:string) => c.toUpperCase());

  return (
    <main style={{minHeight:"100vh",background:"#F6F5F3",fontFamily:"var(--font-google-sans)"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}`}</style>
      <Navbar/>

      {/* Hero */}
      <BarreTitre titre={"Opportunités d'investissement"}>
        <BarreTitreSegment options={[{v:"projets",l:"Banque de projets"},{v:"potentialites",l:"Potentialités par zone"},{v:"avantages",l:"Avantages & incitations"}]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* Layout sidebar + contenu */}
      <div style={{display:"flex",alignItems:"flex-start"}}>

          {/* Sidebar (filtres uniquement sur la Banque de projets) */}
          {onglet==="projets"&&<aside style={{width:sidebarOpen?sidebarWidth:52,flexShrink:0,transition:isResizing.current?"none":"width 0.25s",background:"#fff",borderRight:"1px solid #E8E5E3",height:"calc(100vh - 64px)",overflowY:"auto" as const,position:"sticky" as const,top:64,display:"flex",flexDirection:"column" as const}}>
            <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
            <div style={{padding:sidebarOpen?"20px 16px":"10px 8px",flex:1}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:sidebarOpen?"space-between":"center",marginBottom:sidebarOpen?18:0}}>
                {sidebarOpen&&<span style={{fontSize:12,fontWeight:700,color:"#1a1a2e",letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Filtres</span>}
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <button onClick={()=>setSidebarOpen(o=>!o)} aria-label={sidebarOpen?"Réduire les filtres":"Afficher les filtres"}
                    style={{background:"rgba(0,79,145,0.08)",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
                    <SlidersHorizontal size={14} style={{color:"#004f91"}}/>
                    {sidebarOpen&&nbFiltres>0&&<span style={{fontSize:10,fontWeight:700,color:"#004f91",background:"rgba(0,79,145,0.15)",borderRadius:999,padding:"1px 5px"}}>{nbFiltres}</span>}
                  </button>
                  {sidebarOpen&&nbFiltres>0&&<button onClick={reinit} title="Tout réinitialiser"
                    style={{background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.20)",cursor:"pointer",borderRadius:999,padding:"5px",display:"flex",alignItems:"center",transition:"background 0.15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
                    <span className="material-symbols-outlined" style={{fontSize:15,color:"#dc2626",fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",lineHeight:1}}>close</span>
                  </button>}
                </div>
              </div>
              {sidebarOpen&&<div>

                  {/* Filtres Projets */}
                  {onglet==="projets"&&<>
                    <div style={{position:"relative" as const,marginBottom:18}}>
                      <Search size={13} style={{position:"absolute" as const,left:9,top:"50%",transform:"translateY(-50%)",color:"#9aa5b4"}}/>
                      <input value={projQ} onChange={e=>setProjQ(e.target.value)} placeholder="Rechercher…"
                        style={{width:"100%",paddingLeft:30,paddingRight:8,paddingTop:8,paddingBottom:8,borderRadius:8,border:"1px solid #E8E5E3",background:"#F8F7F6",fontSize:12,color:"#1a1a2e",outline:"none",fontFamily:"var(--font-google-sans)",boxSizing:"border-box" as const}}/>
                      {projQ&&<button onClick={()=>setProjQ("")} aria-label="Effacer la recherche" style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:0}}><X size={11} style={{color:"#9aa5b4"}}/></button>}
                    </div>
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <SideFilter label="Pôle territoire" color="#004f91"
                      items={poles.map((p:any)=>({value:p.pole_territoire,label:p.pole_territoire}))}
                      selected={projPoles} onToggle={toggle(projPoles,setProjPoles)}/>
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <ThematiquesCascadeFilter
                      secteurs={secteurs}
                      secteursSel={projSects} branchesSel={projBranches} activitesSel={projActivites}
                      onSecteur={v=>{setProjSects(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjBranches([]); setProjActivites([]);}}
                      onBranche={v=>{setProjBranches(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjActivites([]);}}
                      onActivite={v=>setProjActivites(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
                    />
                    <div style={{height:1,background:"#F2F0EF",marginBottom:18}}/>
                    <LocalisationFilter
                      regions={regions}
                      regionsSel={projRegions} departementsSel={projDepts} arrondissementsSel={projArrs}
                      onRegion={v=>{setProjRegions(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjDepts([]); setProjArrs([]);}}
                      onDepartement={v=>{setProjDepts(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjArrs([]);}}
                      onArrondissement={v=>setProjArrs(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
                    />
                  </>}

              </div>}
            </div>
            {sidebarOpen&&<div onMouseDown={startResize} style={{position:"absolute" as const,top:0,right:0,width:4,height:"100%",cursor:"col-resize",zIndex:10}} onMouseEnter={e=>(e.currentTarget.style.background="rgba(0,79,145,0.5)")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}/>}
          </aside>}

          {/* Contenu principal */}
          <div style={{flex:1,minWidth:0,padding:"36px 40px 80px"}}>

            {/* ── Onglet Projets ── */}
            {onglet==="projets"&&(
              <>
                {projLoad ? (
                  <SkeletonCards n={6} cols={2} height={200}/>
                ) : projErr ? (
                  <ErreurChargement onRetry={()=>chargerProjets()}/>
                ) : projetsFiltres.length===0 ? (
                  <div style={{textAlign:"center",padding:"80px 24px",color:"#9aa5b4"}}>
                    <p style={{fontSize:16,fontWeight:600,color:"#4a5568"}}>Aucun projet trouvé</p>
                    <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                  </div>
                ) : (
                  <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
                    {projetsFiltres.map(p=>{
                      return (
                      <div key={p.id} onClick={()=>setProjSel(p)}
                        style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:16,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"0 1px 2px rgba(0,0,0,0.03)",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:13}}
                        onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="0 14px 32px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="rgba(0,79,145,0.33)";}}
                        onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="#ECEAE7";
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                            });
                          }}>

                        {/* Titre + pôle territoire en sous-titre */}
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:800,fontSize:15.5,color:"#1a1a2e",lineHeight:1.35,letterSpacing:"-0.01em",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.titre_projet}</div>
                          {p.pole_nom&&<div style={{fontSize:11,fontWeight:500,color:"#9aa5b4",marginTop:3}}>{p.pole_nom}</div>}
                        </div>

                        {/* Région · Département en rangée épurée */}
                        <div style={{display:"flex",alignItems:"center",borderTop:"1px solid #F2F0EF",paddingTop:13,marginTop:"auto"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Région</p>
                            <p style={{fontSize:12.5,fontWeight:700,color:p.region_nom?"#1a1a2e":"#C5BFBB",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{p.region_nom||"—"}</p>
                          </div>
                          <div style={{width:1,alignSelf:"stretch",background:"#F2F0EF",margin:"0 18px"}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"#9aa5b4",textTransform:"uppercase" as const,marginBottom:4}}>Département</p>
                            <p style={{fontSize:12.5,fontWeight:700,color:p.departement_nom?"#1a1a2e":"#C5BFBB",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{p.departement_nom||"—"}</p>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Onglet Potentialités ── */}
            {onglet==="potentialites"&&(
              <>
                {potsLoad ? (
                  <SkeletonCards n={4} cols={4} height={190}/>
                ) : potsErr ? (
                  <ErreurChargement onRetry={()=>chargerPots()}/>
                ) : (
                  <>
                  {/* ── Picker 4 cards — niveau de découpage territorial ── */}
                  <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
                    {NIVEAUX_POTS.map(n=>{
                      const count=pots.filter((p:any)=>p.niveau===n.key).length;
                      const total = n.key==="pole" ? poles.length
                        : n.key==="region" ? regions.length
                        : n.key==="departement" ? regions.reduce((s:number,r:any)=>s+(r.departements?.length||0),0)
                        : regions.reduce((s:number,r:any)=>s+(r.departements||[]).reduce((s2:number,d:any)=>s2+(d.arrondissements?.length||0),0),0);
                      const pct = total>0 ? Math.round(count/total*100) : 0;
                      return (
                        <div key={n.key} onClick={()=>count>0&&setSelectedNiveau(selectedNiveau===n.key?null:n.key)}
                          style={{background:"#fff",border:selectedNiveau===n.key?`1.5px solid ${n.color}88`:"1px solid #ECEAE7",borderRadius:16,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:selectedNiveau===n.key?`0 4px 18px ${n.color}26`:"0 1px 2px rgba(0,0,0,0.03)",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:14,opacity:count>0?1:0.55}}
                          onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="0 14px 32px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${n.color}88`;}}}
                          onMouseLeave={ev=>{ev.currentTarget.style.boxShadow=selectedNiveau===n.key?`0 4px 18px ${n.color}26`:"0 1px 2px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=selectedNiveau===n.key?`${n.color}88`:"#ECEAE7";}}>

                          {/* Niveau */}
                          <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:n.color,flexShrink:0}}/>
                            <span style={{fontSize:10.5,fontWeight:800,color:n.color,letterSpacing:"0.1em",textTransform:"uppercase" as const,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{n.label}</span>
                          </div>

                          {/* Compteur principal */}
                          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                            <span style={{fontSize:"2rem",fontWeight:800,color:total>0?"#1a1a2e":"#C5BFBB",lineHeight:1,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{total||"—"}</span>
                            <span style={{fontSize:12,fontWeight:600,color:"#9aa5b4"}}>{n.unit}{total>1?"s":""}</span>
                          </div>

                          {/* Couverture des fiches */}
                          <div style={{marginTop:"auto"}}>
                            <div style={{height:6,background:"#F2F0EF",borderRadius:99,overflow:"hidden",marginBottom:7}}>
                              <div style={{height:"100%",width:`${Math.max(pct>0?4:0,pct)}%`,background:n.color,borderRadius:99,transition:"width 0.4s ease"}}/>
                            </div>
                            <p style={{fontSize:11,fontWeight:600,color:count>0?"#4a5568":"#9aa5b4"}}>
                              {count>0
                                ? <>{count} fiche{count>1?"s":""} définie{count>1?"s":""}{total>0?<span style={{color:"#9aa5b4",fontWeight:500}}> · {pct} %</span>:null}</>
                                : "Aucune fiche définie"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* ── Fiches du niveau sélectionné, affichées sous les cards ── */}
                  {selectedNiveau!==null&&(
                  <div className="charge-in" style={{marginTop:selectedNiveau==="pole"?0:26}}>
                    {(()=>{
                      const meta = NIVEAUX_POTS.find(x=>x.key===selectedNiveau)!;
                      const items = pots.filter((p:any)=>p.niveau===selectedNiveau);
                      const bandeau = (
                        <div style={{display:"flex",alignItems:"center",gap:15,padding:"15px 20px",margin:"26px 0 18px",borderRadius:16,
                          background:`linear-gradient(100deg, ${meta.color}14 0%, ${meta.color}06 42%, rgba(255,255,255,0) 100%)`,
                          border:`1px solid ${meta.color}22`}}>
                          <div style={{width:44,height:44,borderRadius:13,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",border:`1px solid ${meta.color}33`,boxShadow:`0 2px 6px ${meta.color}1a`}}>
                            <span style={{fontSize:14,fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{items.length}</span>
                          </div>
                          <div style={{minWidth:0,flex:1}}>
                            <p style={{fontSize:9.5,fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>Niveau territorial</p>
                            <div style={{fontWeight:800,fontSize:16,color:"#1a1a2e",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{meta.label}</div>
                          </div>
                        </div>
                      );
                      if (items.length===0) return <>{bandeau}<div style={{textAlign:"center",padding:"40px 0",color:"#9aa5b4"}}><p style={{fontSize:13}}>Aucune fiche</p></div></>;
                      // Rattachements géographiques via le référentiel déjà chargé
                      const regionDuDept = (nom:string) => regions.find((r:any)=>(r.departements||[]).some((d:any)=>d.nom===nom))?.nom || null;
                      const deptDeArr = (nom:string) => {
                        for (const r of regions) for (const d of (r.departements||[])) if ((d.arrondissements||[]).some((a:any)=>a.nom===nom)) return d.nom;
                        return null;
                      };
                      const poleDeRegion = (nom:string) => poles.find((x:any)=>(x.localisation||"").includes(nom))?.pole_territoire || null;
                      // Regroupement des fiches par rattachement territorial
                      const groupeDe = (p:any): string => selectedNiveau==="pole" ? meta.label
                        : selectedNiveau==="region" ? (poleDeRegion(p.region_nom||"") || "Autres")
                        : selectedNiveau==="departement" ? (p.region_nom || regionDuDept(p.departement_nom||"") || "Autres")
                        : (p.departement_nom || deptDeArr(p.arrondissement_nom||"") || "Autres");
                      const rattachement = selectedNiveau==="region" ? "Pôle" : selectedNiveau==="departement" ? "Région" : "Département";
                      const groupes = new Map<string, any[]>();
                      items.forEach((p:any)=>{ const k=groupeDe(p); if(!groupes.has(k)) groupes.set(k,[]); groupes.get(k)!.push(p); });
                      const cles = Array.from(groupes.keys()).sort((a,b)=>a.localeCompare(b,"fr"));
                      return (
                        <>
                        {selectedNiveau==="pole"&&bandeau}
                        {(()=>{
                          const Tuile = ({p}:{p:any}) => {
                            const nbActs = (p.activite_ids||[]).length;
                            return (
                              <div onClick={()=>setPotSel(p)}
                                style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,cursor:"pointer",transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",minWidth:0}}
                                onMouseEnter={ev=>{
                                  ev.currentTarget.style.borderColor=`${meta.color}55`;ev.currentTarget.style.background="#fff";ev.currentTarget.style.transform="translateY(-1px)";ev.currentTarget.style.boxShadow="0 8px 20px rgba(0,30,60,0.08)";
                                  // Nom trop long : glisse pour révéler la fin
                                  const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                                  const span = box?.firstElementChild as HTMLElement | null;
                                  if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                                }}
                                onMouseLeave={ev=>{
                                  ev.currentTarget.style.borderColor="#F0EEEC";ev.currentTarget.style.background="#FAFAF9";ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="none";
                                  const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                                  if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                                }}>
                                <span style={{width:6,height:6,borderRadius:"50%",background:meta.color,flexShrink:0}}/>
                                <div data-marquee style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:600,color:"#1a1a2e",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                  <span style={{display:"inline-block"}}>{potTitle(p)}</span>
                                </div>
                                {nbActs>0&&<span style={{fontSize:10.5,fontWeight:700,color:"#9aa5b4",flexShrink:0,whiteSpace:"nowrap" as const}}>{nbActs} activité{nbActs>1?"s":""}</span>}
                              </div>
                            );
                          };
                          // Pôles : pas de regroupement pertinent → conteneur sans en-tête
                          if (selectedNiveau==="pole") return (
                            <div style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:16,boxShadow:"0 1px 2px rgba(0,0,0,0.03)"}}>
                              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,padding:16}}>
                                {items.map((p:any)=><Tuile key={p.id} p={p}/>)}
                              </div>
                            </div>
                          );
                          // Autres niveaux : un bandeau de rattachement par groupe
                          return (
                        <div style={{display:"flex",flexDirection:"column" as const,gap:22}}>
                          {cles.map(cle=>{
                            const fiches = groupes.get(cle)!;
                            return (
                              <div key={cle}>
                                {/* Bandeau du rattachement territorial */}
                                <div style={{display:"flex",alignItems:"center",gap:15,padding:"15px 20px",marginBottom:14,borderRadius:16,
                                  background:`linear-gradient(100deg, ${meta.color}14 0%, ${meta.color}06 42%, rgba(255,255,255,0) 100%)`,
                                  border:`1px solid ${meta.color}22`}}>
                                  <div style={{width:44,height:44,borderRadius:13,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",border:`1px solid ${meta.color}33`,boxShadow:`0 2px 6px ${meta.color}1a`}}>
                                    <span style={{fontSize:14,fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{fiches.length}</span>
                                  </div>
                                  <div style={{minWidth:0,flex:1}}>
                                    <p style={{fontSize:9.5,fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>{rattachement}</p>
                                    <div style={{fontWeight:800,fontSize:16,color:"#1a1a2e",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{cle}</div>
                                  </div>
                                </div>
                                {/* Fiches du groupe */}
                                <div style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:16,boxShadow:"0 1px 2px rgba(0,0,0,0.03)"}}>
                                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,padding:16}}>
                                    {fiches.map((p:any)=><Tuile key={p.id} p={p}/>)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                          );
                        })()}
                        </>
                      );
                    })()}
                  </div>
                  )}
                  </>
                )}
              </>
            )}

            {/* ── Onglet Avantages ── */}
            {onglet==="avantages"&&(
              <>
                {avgsLoad ? (
                  <SkeletonCards n={3} cols={3} height={190}/>
                ) : avgsErr ? (
                  <ErreurChargement onRetry={()=>chargerAvgs()}/>
                ) : (
                  <>
                  {/* ── Vue secteurs : 3 cards compteur ── */}
                  <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                    {SECTEURS_AVGS.map(s=>{
                      const items = avgs.filter((a:any)=>(a.secteur_nom||"").toLowerCase().includes(s.key));
                      const count = items.length;
                      const sec = secteurs.find((r:any)=>r.nom.toLowerCase().includes(s.key));
                      const secBranches = sec ? branches.filter((b:any)=>b.secteur_id===sec.id) : [];
                      const branchIds = new Set(secBranches.map((b:any)=>b.id));
                      const actCount = activites.filter((a:any)=>branchIds.has(a.branche_id)).length;
                      const pct = actCount>0 ? Math.round(count/actCount*100) : 0;
                      return (
                        <div key={s.key} onClick={()=>count>0&&setSelectedSecAvg(selectedSecAvg===s.key?null:s.key)}
                          style={{background:"#fff",border:selectedSecAvg===s.key?`1.5px solid ${s.color}88`:"1px solid #ECEAE7",borderRadius:16,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:selectedSecAvg===s.key?`0 4px 18px ${s.color}26`:"0 1px 2px rgba(0,0,0,0.03)",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:14,opacity:count>0?1:0.55}}
                          onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="0 14px 32px rgba(0,30,60,0.10)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${s.color}88`;}}}
                          onMouseLeave={ev=>{ev.currentTarget.style.boxShadow=selectedSecAvg===s.key?`0 4px 18px ${s.color}26`:"0 1px 2px rgba(0,0,0,0.03)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=selectedSecAvg===s.key?`${s.color}88`:"#ECEAE7";}}>

                          {/* Secteur */}
                          <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                            <span style={{fontSize:10.5,fontWeight:800,color:s.color,letterSpacing:"0.1em",textTransform:"uppercase" as const,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{s.label}</span>
                          </div>

                          {/* Compteur principal */}
                          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                            <span style={{fontSize:"2rem",fontWeight:800,color:actCount>0?"#1a1a2e":"#C5BFBB",lineHeight:1,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{actCount||"—"}</span>
                            <span style={{fontSize:12,fontWeight:600,color:"#9aa5b4"}}>activité{actCount>1?"s":""}</span>
                          </div>

                          {/* Couverture des avantages */}
                          <div style={{marginTop:"auto"}}>
                            <div style={{height:6,background:"#F2F0EF",borderRadius:99,overflow:"hidden",marginBottom:7}}>
                              <div style={{height:"100%",width:`${Math.max(pct>0?4:0,pct)}%`,background:s.color,borderRadius:99,transition:"width 0.4s ease"}}/>
                            </div>
                            <p style={{fontSize:11,fontWeight:600,color:count>0?"#4a5568":"#9aa5b4"}}>
                              {count>0
                                ? <>{count} avantage{count>1?"s":""} défini{count>1?"s":""}{actCount>0?<span style={{color:"#9aa5b4",fontWeight:500}}> · {pct} %</span>:null}</>
                                : "Aucun avantage défini"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* ── Branches et activités du secteur sélectionné, sous les cards ── */}
                  {selectedSecAvg!==null&&(()=>{
                    const meta = SECTEURS_AVGS.find(x=>x.key===selectedSecAvg)!;
                    const filtered=avgs.filter((a:any)=>(a.secteur_nom||"").toLowerCase().includes(selectedSecAvg!));
                    const braMap = new Map<number,{id:number;nom:string;items:any[]}>();
                    filtered.forEach((a:any)=>{
                      const bid=a.branche_id||0;
                      if(!braMap.has(bid)) braMap.set(bid,{id:bid,nom:a.branche_nom||"Sans branche",items:[]});
                      braMap.get(bid)!.items.push(a);
                    });
                    const bras=Array.from(braMap.values()).sort((a,b)=>a.nom.localeCompare(b.nom,"fr"));
                    return (
                      <div className="charge-in" style={{marginTop:26,display:"flex",flexDirection:"column" as const,gap:22}}>
                        {bras.map(bra=>(
                          <div key={bra.id}>
                            {/* Bandeau de la branche */}
                            <div style={{display:"flex",alignItems:"center",gap:15,padding:"15px 20px",marginBottom:14,borderRadius:16,
                              background:`linear-gradient(100deg, ${meta.color}14 0%, ${meta.color}06 42%, rgba(255,255,255,0) 100%)`,
                              border:`1px solid ${meta.color}22`}}>
                              <div style={{width:44,height:44,borderRadius:13,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",border:`1px solid ${meta.color}33`,boxShadow:`0 2px 6px ${meta.color}1a`}}>
                                <span style={{fontSize:14,fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{bra.items.length}</span>
                              </div>
                              <div style={{minWidth:0,flex:1}}>
                                <p style={{fontSize:9.5,fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>Branche</p>
                                <div style={{fontWeight:800,fontSize:16,color:"#1a1a2e",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{bra.nom}</div>
                              </div>
                            </div>
                            {/* Activités de la branche */}
                            <div style={{background:"#fff",border:"1px solid #ECEAE7",borderRadius:16,boxShadow:"0 1px 2px rgba(0,0,0,0.03)"}}>
                              <div style={{display:"grid",gridTemplateColumns:`repeat(${selectedSecAvg==="secondaire"?2:3},1fr)`,gap:10,padding:16}}>
                                {bra.items.map((a:any)=>(
                                  <div key={a.id} onClick={()=>setAvgSel(a)}
                                    style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#FAFAF9",border:"1px solid #F0EEEC",borderRadius:12,cursor:"pointer",transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",minWidth:0}}
                                    onMouseEnter={ev=>{
                                      ev.currentTarget.style.borderColor=`${meta.color}55`;ev.currentTarget.style.background="#fff";ev.currentTarget.style.transform="translateY(-1px)";ev.currentTarget.style.boxShadow="0 8px 20px rgba(0,30,60,0.08)";
                                      // Nom trop long : glisse pour révéler la fin
                                      const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                                      const span = box?.firstElementChild as HTMLElement | null;
                                      if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                                    }}
                                    onMouseLeave={ev=>{
                                      ev.currentTarget.style.borderColor="#F0EEEC";ev.currentTarget.style.background="#FAFAF9";ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="none";
                                      const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                                      if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                                    }}>
                                    <span style={{width:6,height:6,borderRadius:"50%",background:meta.color,flexShrink:0}}/>
                                    <div data-marquee style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:600,color:"#1a1a2e",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                      <span style={{display:"inline-block"}}>{a.activite_nom}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  </>
                )}
              </>
            )}
          </div>
        </div>

      {projSel&&<ProjetVueModal projet={projSel} secteurs={secteurs} branches={branches} activites={activites} onClose={()=>setProjSel(null)}/>}
      {potSel&&<PotentialiteVueModal pot={potSel} refAvantages={refAvantages} onClose={()=>setPotSel(null)}/>}
      {avgSel&&<AvantageVueModal avg={avgSel} onClose={()=>setAvgSel(null)}/>}
    </main>
  );
}
