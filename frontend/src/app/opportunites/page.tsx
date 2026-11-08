"use client";

import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { useEffect, useMemo, useState } from "react";
import { useGeoArbre, useNaema, useNaemaArbre, useRefPolesTerritoires } from "@/lib/referentiels";
import { useQueryClient } from "@tanstack/react-query";
import { requeteDonnees, useDonnees, VIDE } from "@/lib/donnees";
import { useListePaginee, useTemoinDeFin } from "@/lib/listePaginee";
import { useDebounced } from "@/lib/useDebounced";
import { useEtatUrl } from "@/lib/useEtatUrl";
import PanneauFiltres, { carteCliquable } from "@/components/shared/PanneauFiltres";
import { SideFilter, ThematiquesCascadeFilter, LocalisationFilter } from "@/components/shared/FiltresLateraux";
import ProjetVueModal from "@/components/shared/ProjetVueModal";
import PotentialiteVueModal from "@/components/shared/PotentialiteVueModal";
import AvantageVueModal from "@/components/shared/AvantageVueModal";
import { voile } from "@/lib/couleurs";

import { API_BASE as API } from "@/lib/api";


// Secteurs économiques des avantages & incitations — les couleurs des
// secteurs partout ailleurs (vue territoriale, application) : primaire bleu,
// secondaire orange, tertiaire vert
const SECTEURS_AVGS = [
  {key:"primaire",   label:"Secteur Primaire",   color:"var(--bleu)"},
  {key:"secondaire", label:"Secteur Secondaire", color:"var(--orange)"},
  {key:"tertiaire",  label:"Secteur Tertiaire",  color:"var(--vert)"},
] as const;

// Niveaux de découpage territorial des potentialités
const NIVEAUX_POTS = [
  {key:"pole",           label:"Pôles territoires", unit:"pôle",           abbr:"PÔLE", color:"var(--bleu)"},
  {key:"region",         label:"Régions",           unit:"région",         abbr:"RÉG",  color:"var(--orange)"},
  {key:"departement",    label:"Départements",      unit:"département",    abbr:"DÉP",  color:"var(--vert)"},
  {key:"arrondissement", label:"Arrondissements",   unit:"arrondissement", abbr:"ARR",  color:"var(--violet)"},
] as const;

// Une carte de la Banque de projets (GET /projets/cartes)
type CarteProjet = { id: number; titre_projet: string; pole_nom: string | null; region_nom: string | null; departement_nom: string | null };

export default function OpportunitesPage() {
  const [onglet, setOnglet] = useEtatUrl<"projets"|"potentialites"|"avantages">("onglet", "projets", ["projets","potentialites","avantages"]);

  const queryClient = useQueryClient();
  const precharger = (url: string) => { queryClient.prefetchQuery(requeteDonnees(url)); };

  // Données référentielles
  const [poles,       setPoles]       = useState<any[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [branches,    setBranches]    = useState<any[]>([]);
  const [activites,   setActivites]   = useState<any[]>([]);

  // ── Projets ──
  // La page chargeait les trois collections entières dès l'ouverture, quel que
  // soit l'onglet : 125 requêtes et 14 Mo sur la base de banc. Chaque onglet
  // demande désormais ce qu'il affiche, en listes légères, et chaque fiche se
  // complète à l'ouverture (et dès le survol). Le cache React Query
  // (lib/donnees) rend les onglets déjà visités sans squelette.
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
  // Le nombre de fiches par niveau pour les cartes, puis les fiches du seul
  // niveau ouvert (demandées dès le survol de sa carte)
  const qCompteurs = useDonnees<Record<string, number>>(onglet==="potentialites" ? `${API}/opportunites/potentialites/compteurs` : null);
  const compteurs = qCompteurs.data;
  const potsLoad = qCompteurs.isPending, potsErr = qCompteurs.isError, chargerPots = qCompteurs.refetch;
  const [selectedNiveau, setSelectedNiveau] = useState<string|null>(null);
  const urlNiveau = (niveau: string) => `${API}/opportunites/potentialites/cartes?niveau=${niveau}`;
  const qPots = useDonnees<any[]>(onglet==="potentialites" && selectedNiveau ? urlNiveau(selectedNiveau) : null);
  const pots = (qPots.data ?? VIDE) as any[];
  const [potSel,   setPotSel]   = useState<any>(null);
  const urlPotentialite = (id: number) => `${API}/opportunites/potentialites/${id}`;

  // ── Avantages ──
  const qAvgs = useDonnees<any[]>(onglet==="avantages" ? `${API}/opportunites/avantages/cartes` : null);
  const avgs = (qAvgs.data ?? VIDE) as any[];
  const avgsLoad = qAvgs.isPending, avgsErr = qAvgs.isError, chargerAvgs = qAvgs.refetch;
  const urlAvantage = (id: number) => `${API}/opportunites/avantages/${id}`;
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


  // ── Projets : trente cartes à la fois, filtres appliqués par le serveur ──
  // Arbre secteurs à plat, partagé par les trois onglets (mémoïsé)
  const branchesPlats = useMemo(()=>secteurs.flatMap((s:any)=>s.branches||[]),[secteurs]);
  const activitesPlats = useMemo(()=>branchesPlats.flatMap((b:any)=>b.activites||[]),[branchesPlats]);
  const departementsPlats = useMemo(()=>regions.flatMap((r:any)=>r.departements||[]),[regions]);
  const arrondissementsPlats = useMemo(()=>departementsPlats.flatMap((d:any)=>d.arrondissements||[]),[departementsPlats]);

  // La recherche part un quart de seconde après la dernière touche ; les
  // filtres, cochés par leur nom, partent par identifiant
  const projQEnvoyee = useDebounced(projQ.trim(), 250);
  const urlProjets = useMemo(()=>{
    const p = new URLSearchParams({ par_page: "30" });
    if (projQEnvoyee) p.set("q", projQEnvoyee);
    const ids = (noms:string[], options:any[], cle="nom") => options.filter((o:any)=>noms.includes(o[cle])).map((o:any)=>o.id);
    const choix: [string, number[]][] = [
      ["poles", ids(projPoles, poles, "pole_territoire")],
      ["secteurs", ids(projSects, secteurs)],
      ["branches", ids(projBranches, branchesPlats)],
      ["activites", ids(projActivites, activitesPlats)],
      ["regions", ids(projRegions, regions)],
      ["departements", ids(projDepts, departementsPlats)],
      ["arrondissements", ids(projArrs, arrondissementsPlats)],
    ];
    for (const [nom, valeurs] of choix) if (valeurs.length) p.set(nom, valeurs.join(","));
    return `${API}/projets/cartes?${p}`;
  },[projQEnvoyee, projPoles, projSects, projBranches, projActivites, projRegions, projDepts, projArrs,
     poles, secteurs, branchesPlats, activitesPlats, regions, departementsPlats, arrondissementsPlats]);
  const liste = useListePaginee<CarteProjet>(urlProjets);
  const projets = liste.elements;
  const projLoad = liste.isPending, projErr = liste.isError;
  // Le panneau qui défile porte le témoin de bas de liste ; un autre filtre
  // repart du haut
  const [panneau, setPanneau] = useState<HTMLDivElement | null>(null);
  useEffect(() => { panneau?.scrollTo({ top: 0 }); }, [urlProjets, panneau]);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = liste;
  const temoin = useTemoinDeFin(() => { if (!isFetchingNextPage) fetchNextPage(); }, onglet==="projets" && !!hasNextPage, panneau);

  // La fiche projet : ouverte aussitôt sur les champs de la carte, complétée
  // à l'arrivée de la fiche entière
  const urlProjet = (id: number) => `${API}/projets/${id}`;
  const [projSelId, setProjSelId] = useState<number | null>(null);
  const qProjet = useDonnees<any>(projSelId != null ? urlProjet(projSelId) : null);
  const projetOuvert = projSelId == null ? null : qProjet.data ?? projets.find(p => p.id === projSelId) ?? null;

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
      <BarreTitre titre={"Opportunités d'investissement"} compact actions={<NavActions home flouFond/>}>
        <BarreTitreSegment options={[{v:"projets",l:"Banque de projets",count:liste.data?liste.total:undefined},{v:"potentialites",l:"Potentialités par zone"},{v:"avantages",l:"Avantages & incitations"}]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* Layout sidebar + contenu */}
      <div style={{display:"flex",flex:1,minHeight:0}}>

          {/* Sidebar (filtres uniquement sur la Banque de projets) */}
          {onglet==="projets"&&<PanneauFiltres nbFiltres={nbFiltres} aDesFiltres={!!hasFilterProj} onReinit={reinit}
            recherche={projQ} setRecherche={setProjQ}>
            <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
            <SideFilter label="Pôle territoire" color="var(--bleu)"
              items={poles.map((p:any)=>({value:p.pole_territoire,label:p.pole_territoire}))}
              selected={projPoles} onToggle={toggle(projPoles,setProjPoles)}/>
            <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
            <ThematiquesCascadeFilter
              secteurs={secteurs}
              secteursSel={projSects} branchesSel={projBranches} activitesSel={projActivites}
              onSecteur={v=>{setProjSects(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjBranches([]); setProjActivites([]);}}
              onBranche={v=>{setProjBranches(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjActivites([]);}}
              onActivite={v=>setProjActivites(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
            />
            <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
            <LocalisationFilter
              regions={regions}
              regionsSel={projRegions} departementsSel={projDepts} arrondissementsSel={projArrs}
              onRegion={v=>{setProjRegions(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjDepts([]); setProjArrs([]);}}
              onDepartement={v=>{setProjDepts(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setProjArrs([]);}}
              onArrondissement={v=>setProjArrs(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}
            />
          </PanneauFiltres>}

          {/* Contenu principal */}
          <div ref={setPanneau} style={{flex:1,minWidth:0,overflowY:"auto",overscrollBehavior:"contain",padding:"36px 40px 80px"}}>

            {/* ── Onglet Projets ── */}
            {onglet==="projets"&&(
              <>
                {projLoad ? (
                  <SkeletonCards n={6} cols={2} height={200}/>
                ) : projErr && projets.length===0 ? (
                  <ErreurChargement onRetry={()=>liste.refetch()}/>
                ) : projets.length===0 ? (
                  <div style={{textAlign:"center",padding:"80px 24px",color:"var(--gris)"}}>
                    <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>Aucun projet trouvé</p>
                    <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                  </div>
                ) : (
                  <>
                  {/* Pendant qu'un nouveau filtre charge, les cartes du précédent restent, estompées */}
                  <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,
                    opacity:liste.isPlaceholderData?0.55:1,transition:"opacity 0.15s"}}>
                    {projets.map(p=>{
                      return (
                      <div key={p.id} {...carteCliquable(()=>setProjSelId(p.id))}
                        style={{background:"var(--carte)",border:"1px solid var(--filet-carte)",borderRadius:8,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"var(--ombre-1)",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:13}}
                        onMouseEnter={ev=>{precharger(urlProjet(p.id));ev.currentTarget.style.boxShadow="var(--ombre-survol)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="var(--filet-carte-survol)";}}
                        onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="var(--filet-carte)";
                            ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                              const span = box.firstElementChild as HTMLElement | null;
                              if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                            });
                          }}>

                        {/* Titre + pôle territoire en sous-titre */}
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:800,fontSize:15.5,color:"var(--encre)",lineHeight:1.35,letterSpacing:"-0.01em",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.titre_projet}</div>
                          {p.pole_nom&&<div style={{fontSize:11,fontWeight:500,color:"var(--gris)",marginTop:3}}>{p.pole_nom}</div>}
                        </div>

                        {/* Région · Département en rangée épurée */}
                        <div style={{display:"flex",alignItems:"center",borderTop:"1px solid var(--bordure)",paddingTop:13,marginTop:"auto"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Région</p>
                            <p style={{fontSize:12.5,fontWeight:700,color:p.region_nom?"var(--encre)":"var(--gris)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{p.region_nom||"—"}</p>
                          </div>
                          <div style={{width:1,alignSelf:"stretch",background:"var(--fond)",margin:"0 18px"}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Département</p>
                            <p style={{fontSize:12.5,fontWeight:700,color:p.departement_nom?"var(--encre)":"var(--gris)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{p.departement_nom||"—"}</p>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                  {/* La suite arrive au fil du défilement */}
                  {hasNextPage && <div ref={temoin} style={{height:1}}/>}
                  {isFetchingNextPage && <div style={{marginTop:14}}><SkeletonCards n={2} cols={2} height={120}/></div>}
                  {projErr && !isFetchingNextPage && <div style={{marginTop:14}}><ErreurChargement onRetry={()=>fetchNextPage()}/></div>}
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
                      const count=compteurs?.[n.key] ?? 0;
                      const total = n.key==="pole" ? poles.length
                        : n.key==="region" ? regions.length
                        : n.key==="departement" ? regions.reduce((s:number,r:any)=>s+(r.departements?.length||0),0)
                        : regions.reduce((s:number,r:any)=>s+(r.departements||[]).reduce((s2:number,d:any)=>s2+(d.arrondissements?.length||0),0),0);
                      const pct = total>0 ? Math.round(count/total*100) : 0;
                      return (
                        <div key={n.key} {...(count>0?carteCliquable(()=>setSelectedNiveau(selectedNiveau===n.key?null:n.key)):{})}
                          style={{background:"var(--carte)",border:selectedNiveau===n.key?`1px solid ${voile(n.color, 53)}`:"1px solid var(--filet-carte)",borderRadius:8,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:selectedNiveau===n.key?"var(--ombre-survol)":"var(--ombre-1)",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:14,opacity:count>0?1:0.55}}
                          onMouseEnter={ev=>{if(count>0){precharger(urlNiveau(n.key));ev.currentTarget.style.boxShadow="var(--ombre-survol)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=selectedNiveau===n.key?`${voile(n.color, 53)}`:"var(--filet-carte-survol)";}}}
                          onMouseLeave={ev=>{ev.currentTarget.style.boxShadow=selectedNiveau===n.key?"var(--ombre-survol)":"var(--ombre-1)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=selectedNiveau===n.key?`${voile(n.color, 53)}`:"var(--filet-carte)";}}>

                          {/* Niveau */}
                          <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:n.color,flexShrink:0}}/>
                            <span style={{fontSize:10.5,fontWeight:800,color:n.color,letterSpacing:"0.1em",textTransform:"uppercase" as const,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{n.label}</span>
                          </div>

                          {/* Compteur principal */}
                          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                            <span style={{fontSize:"2rem",fontWeight:800,color:total>0?"var(--encre)":"var(--gris)",lineHeight:1,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{total||"—"}</span>
                            <span style={{fontSize:12,fontWeight:600,color:"var(--gris)"}}>{n.unit}{total>1?"s":""}</span>
                          </div>

                          {/* Couverture des fiches */}
                          <div style={{marginTop:"auto"}}>
                            <div style={{height:6,background:"var(--fond)",borderRadius:99,overflow:"hidden",marginBottom:7}}>
                              <div style={{height:"100%",width:`${Math.max(pct>0?4:0,pct)}%`,background:n.color,borderRadius:99,transition:"width 0.4s ease"}}/>
                            </div>
                            <p style={{fontSize:11,fontWeight:600,color:count>0?"var(--texte)":"var(--gris)"}}>
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
                  {selectedNiveau!==null&&qPots.isPending&&(
                    <div style={{marginTop:26}}><SkeletonCards n={6} cols={3} height={46}/></div>
                  )}
                  {selectedNiveau!==null&&qPots.isError&&(
                    <div style={{marginTop:26}}><ErreurChargement onRetry={()=>qPots.refetch()}/></div>
                  )}
                  {selectedNiveau!==null&&qPots.data&&(
                  <div className="charge-in" style={{marginTop:selectedNiveau==="pole"?0:26}}>
                    {(()=>{
                      const meta = NIVEAUX_POTS.find(x=>x.key===selectedNiveau)!;
                      const items = pots.filter((p:any)=>p.niveau===selectedNiveau);
                      const bandeau = (
                        <div style={{display:"flex",alignItems:"center",gap:15,padding:"15px 20px",margin:"26px 0 18px",borderRadius:8,
                          background:voile(meta.color, 4),
                          border:`1px solid ${voile(meta.color, 13)}`}}>
                          <div style={{width:44,height:44,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--carte)",border:`1px solid ${voile(meta.color, 20)}`,boxShadow:"var(--ombre-1)"}}>
                            <span style={{fontSize:14,fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{items.length}</span>
                          </div>
                          <div style={{minWidth:0,flex:1}}>
                            <p style={{fontSize:9.5,fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>Niveau territorial</p>
                            <div style={{fontWeight:800,fontSize:16,color:"var(--encre)",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{meta.label}</div>
                          </div>
                        </div>
                      );
                      if (items.length===0) return <>{bandeau}<div style={{textAlign:"center",padding:"40px 0",color:"var(--gris)"}}><p style={{fontSize:13}}>Aucune fiche</p></div></>;
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
                                style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"var(--carte-douce)",border:"1px solid var(--bordure)",borderRadius:8,cursor:"pointer",transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",minWidth:0}}
                                onMouseEnter={ev=>{
                                  precharger(urlPotentialite(p.id));
                                  ev.currentTarget.style.borderColor="var(--filet-carte-survol)";ev.currentTarget.style.background="var(--carte)";ev.currentTarget.style.transform="translateY(-1px)";ev.currentTarget.style.boxShadow="var(--ombre-survol)";
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
                                <div data-marquee style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:600,color:"var(--encre)",overflow:"hidden",whiteSpace:"nowrap" as const}}>
                                  <span style={{display:"inline-block"}}>{potTitle(p)}</span>
                                </div>
                                {nbActs>0&&<span style={{fontSize:10.5,fontWeight:700,color:"var(--gris)",flexShrink:0,whiteSpace:"nowrap" as const}}>{nbActs} activité{nbActs>1?"s":""}</span>}
                              </div>
                            );
                          };
                          // Pôles : pas de regroupement pertinent → conteneur sans en-tête
                          if (selectedNiveau==="pole") return (
                            <div style={{background:"var(--carte)",border:"1px solid var(--filet-carte)",borderRadius:8,boxShadow:"var(--ombre-1)"}}>
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
                                <div style={{display:"flex",alignItems:"center",gap:15,padding:"15px 20px",marginBottom:14,borderRadius:8,
                                  background:voile(meta.color, 4),
                                  border:`1px solid ${voile(meta.color, 13)}`}}>
                                  <div style={{width:44,height:44,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--carte)",border:`1px solid ${voile(meta.color, 20)}`,boxShadow:"var(--ombre-1)"}}>
                                    <span style={{fontSize:14,fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{fiches.length}</span>
                                  </div>
                                  <div style={{minWidth:0,flex:1}}>
                                    <p style={{fontSize:9.5,fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>{rattachement}</p>
                                    <div style={{fontWeight:800,fontSize:16,color:"var(--encre)",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{cle}</div>
                                  </div>
                                </div>
                                {/* Fiches du groupe */}
                                <div style={{background:"var(--carte)",border:"1px solid var(--filet-carte)",borderRadius:8,boxShadow:"var(--ombre-1)"}}>
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
                          style={{background:"var(--carte)",border:selectedSecAvg===s.key?`1px solid ${voile(s.color, 53)}`:"1px solid var(--filet-carte)",borderRadius:8,cursor:count>0?"pointer":"default",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:selectedSecAvg===s.key?"var(--ombre-survol)":"var(--ombre-1)",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:14,opacity:count>0?1:0.55}}
                          onMouseEnter={ev=>{if(count>0){ev.currentTarget.style.boxShadow="var(--ombre-survol)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=selectedSecAvg===s.key?`${voile(s.color, 53)}`:"var(--filet-carte-survol)";}}}
                          onMouseLeave={ev=>{ev.currentTarget.style.boxShadow=selectedSecAvg===s.key?"var(--ombre-survol)":"var(--ombre-1)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=selectedSecAvg===s.key?`${voile(s.color, 53)}`:"var(--filet-carte)";}}>

                          {/* Secteur */}
                          <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                            <span style={{fontSize:10.5,fontWeight:800,color:s.color,letterSpacing:"0.1em",textTransform:"uppercase" as const,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{s.label}</span>
                          </div>

                          {/* Compteur principal */}
                          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                            <span style={{fontSize:"2rem",fontWeight:800,color:actCount>0?"var(--encre)":"var(--gris)",lineHeight:1,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{actCount||"—"}</span>
                            <span style={{fontSize:12,fontWeight:600,color:"var(--gris)"}}>activité{actCount>1?"s":""}</span>
                          </div>

                          {/* Couverture des avantages */}
                          <div style={{marginTop:"auto"}}>
                            <div style={{height:6,background:"var(--fond)",borderRadius:99,overflow:"hidden",marginBottom:7}}>
                              <div style={{height:"100%",width:`${Math.max(pct>0?4:0,pct)}%`,background:s.color,borderRadius:99,transition:"width 0.4s ease"}}/>
                            </div>
                            <p style={{fontSize:11,fontWeight:600,color:count>0?"var(--texte)":"var(--gris)"}}>
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
                            <div style={{display:"flex",alignItems:"center",gap:15,padding:"15px 20px",marginBottom:14,borderRadius:8,
                              background:voile(meta.color, 4),
                              border:`1px solid ${voile(meta.color, 13)}`}}>
                              <div style={{width:44,height:44,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--carte)",border:`1px solid ${voile(meta.color, 20)}`,boxShadow:"var(--ombre-1)"}}>
                                <span style={{fontSize:14,fontWeight:800,color:meta.color,fontVariantNumeric:"tabular-nums"}}>{bra.items.length}</span>
                              </div>
                              <div style={{minWidth:0,flex:1}}>
                                <p style={{fontSize:9.5,fontWeight:700,color:meta.color,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:3}}>Branche</p>
                                <div style={{fontWeight:800,fontSize:16,color:"var(--encre)",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{bra.nom}</div>
                              </div>
                            </div>
                            {/* Activités de la branche */}
                            <div style={{background:"var(--carte)",border:"1px solid var(--filet-carte)",borderRadius:8,boxShadow:"var(--ombre-1)"}}>
                              <div style={{display:"grid",gridTemplateColumns:`repeat(${selectedSecAvg==="secondaire"?2:3},1fr)`,gap:10,padding:16}}>
                                {bra.items.map((a:any)=>(
                                  <div key={a.id} {...carteCliquable(()=>setAvgSel(a))}
                                    style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"var(--carte-douce)",border:"1px solid var(--bordure)",borderRadius:8,cursor:"pointer",transition:"border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s",minWidth:0}}
                                    onMouseEnter={ev=>{
                                      precharger(urlAvantage(a.id));
                                      ev.currentTarget.style.borderColor="var(--filet-carte-survol)";ev.currentTarget.style.background="var(--carte)";ev.currentTarget.style.transform="translateY(-1px)";ev.currentTarget.style.boxShadow="var(--ombre-survol)";
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
                                    <div data-marquee style={{flex:1,minWidth:0,fontSize:12.5,fontWeight:600,color:"var(--encre)",overflow:"hidden",whiteSpace:"nowrap" as const}}>
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

      {projetOuvert&&<ProjetVueModal projet={projetOuvert} secteurs={secteurs} branches={branches} activites={activites} onClose={()=>setProjSelId(null)}/>}
      {potSel&&<PotentialiteVueModal pot={potSel} onClose={()=>setPotSel(null)}/>}
      {avgSel&&<AvantageVueModal avg={avgSel} onClose={()=>setAvgSel(null)}/>}
    </main>
  );
}
