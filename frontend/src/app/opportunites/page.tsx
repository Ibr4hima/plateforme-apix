"use client";

import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGeoArbre, useNaema, useNaemaArbre, useRefPolesTerritoires } from "@/lib/referentiels";
import { useTous, VIDE } from "@/lib/donnees";
import { useEtatUrl } from "@/lib/useEtatUrl";
import PanneauFiltres, { carteCliquable } from "@/components/shared/PanneauFiltres";
import { SideFilter, ThematiquesCascadeFilter, LocalisationFilter } from "@/components/shared/FiltresLateraux";
import ProjetVueModal from "@/components/shared/ProjetVueModal";
import PotentialiteVueModal from "@/components/shared/PotentialiteVueModal";
import AvantageVueModal from "@/components/shared/AvantageVueModal";
import { voile } from "@/lib/couleurs";

import { API_BASE as API } from "@/lib/api";


// Secteurs économiques des avantages & incitations
const SECTEURS_AVGS = [
  {key:"primaire",   label:"Secteur Primaire",   color:"var(--vert)"},
  {key:"secondaire", label:"Secteur Secondaire", color:"var(--orange)"},
  {key:"tertiaire",  label:"Secteur Tertiaire",  color:"var(--bleu)"},
] as const;

// Niveaux de découpage territorial des potentialités
const NIVEAUX_POTS = [
  {key:"pole",           label:"Pôles territoires", unit:"pôle",           abbr:"PÔLE", color:"var(--bleu)"},
  {key:"region",         label:"Régions",           unit:"région",         abbr:"RÉG",  color:"var(--orange)"},
  {key:"departement",    label:"Départements",      unit:"département",    abbr:"DÉP",  color:"var(--vert)"},
  {key:"arrondissement", label:"Arrondissements",   unit:"arrondissement", abbr:"ARR",  color:"var(--violet)"},
] as const;

// ── Modal vue projet (identique admin) ───────────────────────────────────────
export default function OpportunitesPage() {
  const [onglet, setOnglet] = useEtatUrl<"projets"|"potentialites"|"avantages">("onglet", "projets", ["projets","potentialites","avantages"]);

  // Données référentielles
  const [poles,       setPoles]       = useState<any[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [branches,    setBranches]    = useState<any[]>([]);
  const [activites,   setActivites]   = useState<any[]>([]);
  const [refAvantages,setRefAvantages]= useState<any[]>([]);

  // ── Projets ──
  // Les trois collections viennent du cache React Query (lib/donnees) : les
  // onglets déjà visités raffichent sans squelette.
  const qProjets = useTous(`${API}/projets`);
  const projets = (qProjets.data ?? VIDE) as any[];
  const projLoad = qProjets.isPending, projErr = qProjets.isError, chargerProjets = qProjets.refetch;
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
  const qPots = useTous(`${API}/opportunites/potentialites`);
  const pots = (qPots.data ?? VIDE) as any[];
  const potsLoad = qPots.isPending, potsErr = qPots.isError, chargerPots = qPots.refetch;
  const [potSel,   setPotSel]   = useState<any>(null);
  const [selectedNiveau, setSelectedNiveau] = useState<string|null>(null);

  // ── Avantages ──
  const qAvgs = useTous(`${API}/opportunites/avantages`);
  const avgs = (qAvgs.data ?? VIDE) as any[];
  const avgsLoad = qAvgs.isPending, avgsErr = qAvgs.isError, chargerAvgs = qAvgs.refetch;
  const [avgSel,        setAvgSel]        = useState<any>(null);
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
  },[]);


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

  // ── Helpers filtres (la barre latérale ne concerne que la Banque de projets) ──
  const hasFilterProj = projQ||projPoles.length>0||projSects.length>0||projBranches.length>0||projActivites.length>0||projRegions.length>0||projDepts.length>0||projArrs.length>0;
  const nbFiltres = (projQ?1:0)+projPoles.length+projSects.length+projBranches.length+projActivites.length+projRegions.length+projDepts.length+projArrs.length;
  const reinit = () => { setProjQ(""); setProjPoles([]); setProjSects([]); setProjBranches([]); setProjActivites([]); setProjRegions([]); setProjDepts([]); setProjArrs([]); };

  const toggle = (arr:string[], setArr:(v:string[])=>void) => (v:string) => setArr(arr.includes(v)?arr.filter((x:string)=>x!==v):[...arr,v]);

  const potTitle = (p:any) => (p.titre||"")
    .replace(/^[Pp]otentialités?\s+(de\s+l[''’]|de\s+la\s+|de\s+le\s+|du\s+|de\s+)/i, "")
    .replace(/^(.)/, (_:string,c:string) => c.toUpperCase());

  return (
    <main style={{ height:"100dvh", display:"flex", flexDirection:"column", overflow:"hidden",
      background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {/* Hero */}
      <BarreTitre titre={"Opportunités d'investissement"} compact actions={<NavActions onDark home flouFond/>}>
        <BarreTitreSegment options={[{v:"projets",l:"Banque de projets",count:projetsFiltres.length},{v:"potentialites",l:"Potentialités par zone"},{v:"avantages",l:"Avantages & incitations"}]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* Layout sidebar + contenu */}
      <div style={{display:"flex",flex:1,minHeight:0}}>

          {/* Sidebar (filtres uniquement sur la Banque de projets) */}
          {onglet==="projets"&&<PanneauFiltres nbFiltres={nbFiltres} aDesFiltres={!!hasFilterProj} onReinit={reinit}
            recherche={projQ} setRecherche={setProjQ}>
            <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
            <SideFilter label="Pôle territoire" color="var(--bleu)"
              items={poles.map((p:any)=>({value:p.pole_territoire,label:p.pole_territoire}))}
              selected={projPoles} onToggle={toggle(projPoles,setProjPoles)}/>
            <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
            <ThematiquesCascadeFilter
              secteurs={secteurs}
              secteursSel={projSects} branchesSel={projBranches} activitesSel={projActivites}
              onSecteur={v=>{setProjSects(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjBranches([]); setProjActivites([]);}}
              onBranche={v=>{setProjBranches(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjActivites([]);}}
              onActivite={v=>setProjActivites(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
            />
            <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
            <LocalisationFilter
              regions={regions}
              regionsSel={projRegions} departementsSel={projDepts} arrondissementsSel={projArrs}
              onRegion={v=>{setProjRegions(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjDepts([]); setProjArrs([]);}}
              onDepartement={v=>{setProjDepts(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjArrs([]);}}
              onArrondissement={v=>setProjArrs(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
            />
          </PanneauFiltres>}

          {/* Contenu principal */}
          <div style={{flex:1,minWidth:0,overflowY:"auto",overscrollBehavior:"contain",padding:"36px 40px 80px"}}>

            {/* ── Onglet Projets ── */}
            {onglet==="projets"&&(
              <>
                {projLoad ? (
                  <SkeletonCards n={6} cols={2} height={200}/>
                ) : projErr ? (
                  <ErreurChargement onRetry={()=>chargerProjets()}/>
                ) : projetsFiltres.length===0 ? (
                  <div style={{textAlign:"center",padding:"80px 24px",color:"var(--gris)"}}>
                    <p style={{fontSize: "var(--t-16)",fontWeight:600,color:"var(--texte)"}}>Aucun projet trouvé</p>
                    <p style={{fontSize: "var(--t-14)",marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                  </div>
                ) : (
                  <>
                  <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
                    {projetsFiltres.map(p=>{
                      return (
                      <div key={p.id} {...carteCliquable(()=>setProjSel(p))}
                        style={{background:"var(--carte)",border:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"none",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:13}}
                        onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="rgb(var(--bleu-rgb) / 0.33)";}}
                        onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="none";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="rgb(var(--encre-rgb) / 0.12)";
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                            });
                          }}>

                        {/* Titre + pôle territoire en sous-titre */}
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:800,fontSize: "var(--t-15)",color:"var(--encre)",lineHeight:1.35,letterSpacing:"-0.01em",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.titre_projet}</div>
                          {p.pole_nom&&<div style={{fontSize: "var(--t-11)",fontWeight:500,color:"var(--gris)",marginTop:3}}>{p.pole_nom}</div>}
                        </div>

                        {/* Région · Département en rangée épurée */}
                        <div style={{display:"flex",alignItems:"center",borderTop:"1px solid var(--bordure)",paddingTop:13,marginTop:"auto"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize: "var(--t-9)",fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Région</p>
                            <p style={{fontSize: "var(--t-125)",fontWeight:700,color:p.region_nom?"var(--encre)":"var(--gris)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{p.region_nom||"—"}</p>
                          </div>
                          <div style={{width:1,alignSelf:"stretch",background:"var(--fond)",margin:"0 18px"}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize: "var(--t-9)",fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Département</p>
                            <p style={{fontSize: "var(--t-125)",fontWeight:700,color:p.departement_nom?"var(--encre)":"var(--gris)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{p.departement_nom||"—"}</p>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                  </>
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
                        <div key={n.key} {...(count>0?carteCliquable(()=>setSelectedNiveau(selectedNiveau===n.key?null:n.key)):{})}
                          style={{background:"var(--carte)",border:selectedNiveau===n.key?`1.5px solid ${voile(n.color, 53)}`:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:selectedNiveau===n.key?`0 4px 18px ${voile(n.color, 15)}`:"none",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:14,opacity:count>0?1:0.55}}
                          onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${voile(n.color, 53)}`;}}}
                          onMouseLeave={ev=>{ev.currentTarget.style.boxShadow=selectedNiveau===n.key?`0 4px 18px ${voile(n.color, 15)}`:"none";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=selectedNiveau===n.key?`${voile(n.color, 53)}`:"rgb(var(--encre-rgb) / 0.12)";}}>

                          {/* Niveau */}
                          <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:n.color,flexShrink:0}}/>
                            <span style={{fontSize: "var(--t-105)",fontWeight:800,color:n.color,letterSpacing:"0.1em",textTransform:"uppercase" as const,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{n.label}</span>
                          </div>

                          {/* Compteur principal */}
                          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                            <span style={{fontSize: "var(--t-r200)",fontWeight:800,color:total>0?"var(--encre)":"var(--gris)",lineHeight:1,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{total||"—"}</span>
                            <span style={{fontSize: "var(--t-12)",fontWeight:600,color:"var(--gris)"}}>{n.unit}{total>1?"s":""}</span>
                          </div>

                          {/* Couverture des fiches */}
                          <div style={{marginTop:"auto"}}>
                            <div style={{height:6,background:"var(--fond)",borderRadius:99,overflow:"hidden",marginBottom:7}}>
                              <div style={{height:"100%",width:`${Math.max(pct>0?4:0,pct)}%`,background:n.color,borderRadius:99,transition:"width 0.4s ease"}}/>
                            </div>
                            <p style={{fontSize: "var(--t-11)",fontWeight:600,color:count>0?"var(--texte)":"var(--gris)"}}>
                              {count>0
                                ? <>{count} fiche{count>1?"s":""} définie{count>1?"s":""}{total>0?<span style={{color:"var(--gris)",fontWeight:500}}> · {pct} %</span>:null}</>
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
                          background:`linear-gradient(100deg, ${voile(meta.color, 8)} 0%, ${voile(meta.color, 2)} 42%, rgba(255,255,255,0) 100%)`,
                          border:`1px solid ${voile(meta.color, 13)}`}}>
                          <div style={{width:44,height:44,borderRadius:13,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--carte)",border:`1px solid ${voile(meta.color, 20)}`,boxShadow:`0 2px 6px ${voile(meta.color, 10)}`}}>
                            <span style={{fontSize: "var(--t-14)",fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{items.length}</span>
                          </div>
                          <div style={{minWidth:0,flex:1}}>
                            <p style={{fontSize: "var(--t-95)",fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>Niveau territorial</p>
                            <div style={{fontWeight:800,fontSize: "var(--t-16)",color:"var(--encre)",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{meta.label}</div>
                          </div>
                        </div>
                      );
                      if (items.length===0) return <>{bandeau}<div style={{textAlign:"center",padding:"40px 0",color:"var(--gris)"}}><p style={{fontSize: "var(--t-13)"}}>Aucune fiche</p></div></>;
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
                              <div {...carteCliquable(()=>setPotSel(p))}
                                style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"var(--carte-douce)",border:"1px solid var(--bordure)",borderRadius:12,cursor:"pointer",transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",minWidth:0}}
                                onMouseEnter={ev=>{
                                  ev.currentTarget.style.borderColor=`${voile(meta.color, 33)}`;ev.currentTarget.style.background="var(--carte)";ev.currentTarget.style.transform="translateY(-1px)";ev.currentTarget.style.boxShadow="var(--ombre-2)";
                                  // Nom trop long : glisse pour révéler la fin
                                  const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                                  const span = box?.firstElementChild as HTMLElement | null;
                                  if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                                }}
                                onMouseLeave={ev=>{
                                  ev.currentTarget.style.borderColor="var(--bordure)";ev.currentTarget.style.background="var(--carte-douce)";ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="none";
                                  const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                                  if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                                }}>
                                <span style={{width:6,height:6,borderRadius:"50%",background:meta.color,flexShrink:0}}/>
                                <div data-marquee style={{flex:1,minWidth:0,fontSize: "var(--t-125)",fontWeight:600,color:"var(--encre)",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                  <span style={{display:"inline-block"}}>{potTitle(p)}</span>
                                </div>
                                {nbActs>0&&<span style={{fontSize: "var(--t-105)",fontWeight:700,color:"var(--gris)",flexShrink:0,whiteSpace:"nowrap" as const}}>{nbActs} activité{nbActs>1?"s":""}</span>}
                              </div>
                            );
                          };
                          // Pôles : pas de regroupement pertinent → conteneur sans en-tête
                          if (selectedNiveau==="pole") return (
                            <div style={{background:"var(--carte)",border:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,boxShadow:"none"}}>
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
                                  background:`linear-gradient(100deg, ${voile(meta.color, 8)} 0%, ${voile(meta.color, 2)} 42%, rgba(255,255,255,0) 100%)`,
                                  border:`1px solid ${voile(meta.color, 13)}`}}>
                                  <div style={{width:44,height:44,borderRadius:13,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--carte)",border:`1px solid ${voile(meta.color, 20)}`,boxShadow:`0 2px 6px ${voile(meta.color, 10)}`}}>
                                    <span style={{fontSize: "var(--t-14)",fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{fiches.length}</span>
                                  </div>
                                  <div style={{minWidth:0,flex:1}}>
                                    <p style={{fontSize: "var(--t-95)",fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>{rattachement}</p>
                                    <div style={{fontWeight:800,fontSize: "var(--t-16)",color:"var(--encre)",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{cle}</div>
                                  </div>
                                </div>
                                {/* Fiches du groupe */}
                                <div style={{background:"var(--carte)",border:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,boxShadow:"none"}}>
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
                        <div key={s.key} {...(count>0?carteCliquable(()=>setSelectedSecAvg(selectedSecAvg===s.key?null:s.key)):{})}
                          style={{background:"var(--carte)",border:selectedSecAvg===s.key?`1.5px solid ${voile(s.color, 53)}`:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:selectedSecAvg===s.key?`0 4px 18px ${voile(s.color, 15)}`:"none",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:14,opacity:count>0?1:0.55}}
                          onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${voile(s.color, 53)}`;}}}
                          onMouseLeave={ev=>{ev.currentTarget.style.boxShadow=selectedSecAvg===s.key?`0 4px 18px ${voile(s.color, 15)}`:"none";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=selectedSecAvg===s.key?`${voile(s.color, 53)}`:"rgb(var(--encre-rgb) / 0.12)";}}>

                          {/* Secteur */}
                          <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                            <span style={{fontSize: "var(--t-105)",fontWeight:800,color:s.color,letterSpacing:"0.1em",textTransform:"uppercase" as const,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{s.label}</span>
                          </div>

                          {/* Compteur principal */}
                          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                            <span style={{fontSize: "var(--t-r200)",fontWeight:800,color:actCount>0?"var(--encre)":"var(--gris)",lineHeight:1,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{actCount||"—"}</span>
                            <span style={{fontSize: "var(--t-12)",fontWeight:600,color:"var(--gris)"}}>activité{actCount>1?"s":""}</span>
                          </div>

                          {/* Couverture des avantages */}
                          <div style={{marginTop:"auto"}}>
                            <div style={{height:6,background:"var(--fond)",borderRadius:99,overflow:"hidden",marginBottom:7}}>
                              <div style={{height:"100%",width:`${Math.max(pct>0?4:0,pct)}%`,background:s.color,borderRadius:99,transition:"width 0.4s ease"}}/>
                            </div>
                            <p style={{fontSize: "var(--t-11)",fontWeight:600,color:count>0?"var(--texte)":"var(--gris)"}}>
                              {count>0
                                ? <>{count} avantage{count>1?"s":""} défini{count>1?"s":""}{actCount>0?<span style={{color:"var(--gris)",fontWeight:500}}> · {pct} %</span>:null}</>
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
                              background:`linear-gradient(100deg, ${voile(meta.color, 8)} 0%, ${voile(meta.color, 2)} 42%, rgba(255,255,255,0) 100%)`,
                              border:`1px solid ${voile(meta.color, 13)}`}}>
                              <div style={{width:44,height:44,borderRadius:13,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--carte)",border:`1px solid ${voile(meta.color, 20)}`,boxShadow:`0 2px 6px ${voile(meta.color, 10)}`}}>
                                <span style={{fontSize: "var(--t-14)",fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{bra.items.length}</span>
                              </div>
                              <div style={{minWidth:0,flex:1}}>
                                <p style={{fontSize: "var(--t-95)",fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>Branche</p>
                                <div style={{fontWeight:800,fontSize: "var(--t-16)",color:"var(--encre)",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{bra.nom}</div>
                              </div>
                            </div>
                            {/* Activités de la branche */}
                            <div style={{background:"var(--carte)",border:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,boxShadow:"none"}}>
                              <div style={{display:"grid",gridTemplateColumns:`repeat(${selectedSecAvg==="secondaire"?2:3},1fr)`,gap:10,padding:16}}>
                                {bra.items.map((a:any)=>(
                                  <div key={a.id} {...carteCliquable(()=>setAvgSel(a))}
                                    style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"var(--carte-douce)",border:"1px solid var(--bordure)",borderRadius:12,cursor:"pointer",transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",minWidth:0}}
                                    onMouseEnter={ev=>{
                                      ev.currentTarget.style.borderColor=`${voile(meta.color, 33)}`;ev.currentTarget.style.background="var(--carte)";ev.currentTarget.style.transform="translateY(-1px)";ev.currentTarget.style.boxShadow="var(--ombre-2)";
                                      // Nom trop long : glisse pour révéler la fin
                                      const box = ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null;
                                      const span = box?.firstElementChild as HTMLElement | null;
                                      if (box && span) { const d = span.scrollWidth - box.clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                                    }}
                                    onMouseLeave={ev=>{
                                      ev.currentTarget.style.borderColor="var(--bordure)";ev.currentTarget.style.background="var(--carte-douce)";ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="none";
                                      const span = (ev.currentTarget.querySelector("[data-marquee]") as HTMLElement | null)?.firstElementChild as HTMLElement | null;
                                      if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                                    }}>
                                    <span style={{width:6,height:6,borderRadius:"50%",background:meta.color,flexShrink:0}}/>
                                    <div data-marquee style={{flex:1,minWidth:0,fontSize: "var(--t-125)",fontWeight:600,color:"var(--encre)",overflow:"hidden",whiteSpace:"nowrap" as const}}>
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
