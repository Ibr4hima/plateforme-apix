"use client";

import PanneauFiltres, { carteCliquable } from "@/components/shared/PanneauFiltres";
import { CurseurPlageNace } from "@/components/shared/CurseurNace";
import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreBadge, BarreTitreSegment } from "@/components/shared/BarreTitre";
import EntreprisePublicModal from "@/components/shared/EntreprisePublicModal";
import VueTerritorialeSenegal from "@/components/shared/VueTerritorialeSenegal";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { GRILLE_CARTES, COLONNES_CARTES } from "@/lib/grilles";
import { ArrowDownUp, ArrowUpDown, Building2, ChevronDown, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGate } from "@/lib/authGate";
import { useGeoArbre, useNaemaArbre, useRefFormesJuridiques, useRefPolesEntreprises } from "@/lib/referentiels";
import { requeteDonnees, useDonnees } from "@/lib/donnees";
import { useListePaginee, useTemoinDeFin } from "@/lib/listePaginee";
import { useDebounced } from "@/lib/useDebounced";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { fmtDate } from "@/lib/format";
import { badgePole } from "@/lib/couleurs";
import { SideFilter, ThematiquesCascadeFilter, LocalisationFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { useFicheUrlId } from "@/lib/ficheUrl";
import { useOuvertureFiche } from "@/lib/ouvertureFiche";

import { API_BASE } from "@/lib/api";

// Une carte de l'annuaire (GET /entreprises/cartes)
type CarteEntreprise = { id: number; nom: string; forme_juridique: string | null; date_creation: string | null;
  pole_territoire_nom: string | null; region_nom: string | null };
// La fiche entière d'une entreprise
const urlFiche = (id: number) => `${API_BASE}/entreprises/${id}`;

function DateRangeFilter({ minYear, maxYear, startYear, endYear, onChange }: {
  minYear: number; maxYear: number; startYear: number; endYear: number;
  onChange: (start: number, end: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const isFiltered = startYear > minYear || endYear < maxYear;

  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:open?8:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {isFiltered&&<span style={{width:6,height:6,borderRadius:"50%",background:"var(--bleu-action)",display:"inline-block"}}/>}
          <span style={{fontSize:11,fontWeight:700,color:isFiltered?"var(--bleu)":"var(--gris)",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Date de création</span>
        </div>
        <span style={{width:20,height:20,borderRadius:"50%",background:"var(--champ)",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {open?<ChevronUp size={11} style={{color:"var(--texte)"}}/>:<ChevronDown size={11} style={{color:"var(--texte)"}}/>}
        </span>
      </button>
      {open&&(
        <div style={{padding:"2px 4px 0"}}>
          <div style={{marginBottom:10,padding:"4px 0"}}>
            <CurseurPlageNace min={minYear} max={maxYear} debut={startYear} fin={endYear} ecartMin={1}
              onChange={(d,f)=>onChange(d,f)}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:700,color:"var(--bleu)",background:"rgb(var(--bleu-rgb) / 0.08)",padding:"2px 8px",borderRadius:6}}>{startYear}</span>
            <span style={{fontSize:10,color:"var(--gris)"}}>—</span>
            <span style={{fontSize:11,fontWeight:700,color:"var(--bleu)",background:"rgb(var(--bleu-rgb) / 0.08)",padding:"2px 8px",borderRadius:6}}>{endYear}</span>
          </div>
          {isFiltered&&<button onClick={()=>onChange(minYear,maxYear)}
            style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--danger)",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginTop:4}}>
            <X size={10}/> Réinitialiser
          </button>}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function EntreprisesPage() {
  const gate = useAuthGate();
  const [onglet,      setOnglet]      = useEtatUrl<"liste"|"territoire">("onglet", "liste", ["liste","territoire"]);
  const [triDate,     setTriDate]     = useEtatUrl<"desc"|"asc">("tri", "desc", ["desc","asc"]);
  const [formeOpts,   setFormeOpts]   = useState<string[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [regions,     setRegions]     = useState<any[]>([]);
  const [poles,       setPoles]       = useState<string[]>([]);

  const [recherche,    setRecherche]    = useState("");
  const [formesSel,    setFormesSel]    = useState<string[]>([]);
  const [secteursSel,  setSecteursSel]  = useState<string[]>([]);
  const [branchesSel,  setBranchesSel]  = useState<string[]>([]);
  const [activitesSel, setActivitesSel] = useState<string[]>([]);
  const [regionsSel,   setRegionsSel]   = useState<string[]>([]);
  const [deptsSel,     setDeptsSel]     = useState<string[]>([]);
  const [arrondsSel,   setArrondsSel]   = useState<string[]>([]);
  const [polesSel,     setPolesSel]     = useState<string[]>([]);
  // Les bornes du curseur d'années viennent du serveur ; `plage` est le choix
  // de l'utilisateur, null tant qu'il n'a pas resserré le curseur
  const qFacettes = useDonnees<{ total: number; annee_min: number | null; annee_max: number | null }>(`${API_BASE}/entreprises/facettes`);
  const dateMin = qFacettes.data?.annee_min ?? 0, dateMax = qFacettes.data?.annee_max ?? 0;
  const [plage, setPlage] = useState<{ debut: number; fin: number } | null>(null);
  const dateStart = plage?.debut ?? dateMin, dateEnd = plage?.fin ?? dateMax;

  // Référentiels servis par le cache partagé (une requête par session)
  const { data: formesData } = useRefFormesJuridiques();
  const { arbre: naemaArbre } = useNaemaArbre();
  const { arbre: geoArbre } = useGeoArbre();
  const { data: polesData } = useRefPolesEntreprises();
  useEffect(()=>{ setFormeOpts(Array.isArray(formesData)?(formesData as string[]):[]); },[formesData]);
  useEffect(()=>{ setSecteurs(naemaArbre); },[naemaArbre]);
  useEffect(()=>{ setRegions(geoArbre); },[geoArbre]);
  useEffect(()=>{ setPoles((((polesData as any[])||[])).map((p:any)=>p.nom)); },[polesData]);


  const isDateFiltered = dateMin<dateMax && (dateStart>dateMin||dateEnd<dateMax);

  // ── Les cartes, trente à la fois, filtres, recherche et tri appliqués par le
  // serveur. La page aspirait l'annuaire entier : 109 requêtes et 10 Mo sur la
  // base de banc (perf/RESULTATS-2026-11-07.md). La recherche part un quart de
  // seconde après la dernière touche, le curseur d'années quand il s'arrête ;
  // les filtres cochés par leur nom partent par identifiant.
  const rechercheEnvoyee = useDebounced(recherche.trim(), 250);
  const anneesEnvoyees = useDebounced(isDateFiltered ? `${dateStart}-${dateEnd}` : "", 300);
  const url = useMemo(() => {
    const p = new URLSearchParams({ par_page: "30", tri: triDate });
    if (rechercheEnvoyee) p.set("q", rechercheEnvoyee);
    formesSel.forEach(f => p.append("formes", f));
    const ids = (noms: string[], options: any[]) => options.filter((o: any) => noms.includes(o.nom)).map((o: any) => o.id);
    const branchesPlates = secteurs.flatMap((s: any) => s.branches || []);
    const departementsPlats = regions.flatMap((r: any) => r.departements || []);
    const choix: [string, number[]][] = [
      ["secteurs", ids(secteursSel, secteurs)],
      ["branches", ids(branchesSel, branchesPlates)],
      ["activites", ids(activitesSel, branchesPlates.flatMap((b: any) => b.activites || []))],
      ["regions", ids(regionsSel, regions)],
      ["departements", ids(deptsSel, departementsPlats)],
      ["arrondissements", ids(arrondsSel, departementsPlats.flatMap((d: any) => d.arrondissements || []))],
      ["poles", ids(polesSel, (polesData as any[]) || [])],
    ];
    for (const [nom, valeurs] of choix) if (valeurs.length) p.set(nom, valeurs.join(","));
    if (anneesEnvoyees) { const [debut, fin] = anneesEnvoyees.split("-"); p.set("annee_min", debut); p.set("annee_max", fin); }
    return `${API_BASE}/entreprises/cartes?${p}`;
  }, [triDate, rechercheEnvoyee, formesSel, secteursSel, branchesSel, activitesSel, regionsSel, deptsSel, arrondsSel, polesSel,
      anneesEnvoyees, secteurs, regions, polesData]);
  const liste = useListePaginee<CarteEntreprise>(url);
  const entreprises = liste.elements;
  const loading = liste.isPending, erreur = liste.isError;
  // Le panneau qui défile porte le témoin de bas de liste ; un autre filtre
  // ou un autre tri repart du haut
  const [panneau, setPanneau] = useState<HTMLDivElement | null>(null);
  useEffect(() => { panneau?.scrollTo({ top: 0 }); }, [url, panneau]);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = liste;
  const temoin = useTemoinDeFin(() => { if (!isFetchingNextPage) fetchNextPage(); }, !!hasNextPage, panneau);

  // La fiche : demandée dès le survol de la carte, elle s'ouvre complète —
  // attendue 0,4 s au plus, sans quoi elle s'ouvre sur les champs de la carte
  // et ce qui manque arrive à sa place (lib/ouvertureFiche)
  const queryClient = useQueryClient();
  const prechargerFiche = useCallback((id: number) => { queryClient.prefetchQuery(requeteDonnees(urlFiche(id))); }, [queryClient]);
  const [selId, setSelId] = useState<number | null>(null);
  const qFiche = useDonnees<any>(selId != null ? urlFiche(selId) : null);
  const ficheComplete = !!qFiche.data;
  const fichePrete = useOuvertureFiche(selId, ficheComplete);
  const ficheOuverte = selId == null || !fichePrete ? null : qFiche.data ?? entreprises.find(e => e.id === selId) ?? null;
  useFicheUrlId(id => setSelId(Number(id)));   // ouverture directe par l'adresse « ?fiche=<id> »

  // Les cartes, mémorisées : ouvrir ou fermer une fiche ne les redessine pas
  const grilleCartes = useMemo(() => entreprises.map(e=>{
                  return (
                  <div key={e.id} {...carteCliquable(()=>gate(()=>setSelId(e.id)))}
                    style={{background:"var(--carte)",border:"1px solid var(--filet-carte)",borderRadius:8,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"var(--ombre-1)",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:13}}
                    onMouseEnter={ev=>{prechargerFiche(e.id);ev.currentTarget.style.boxShadow="var(--ombre-survol)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="var(--filet-carte-survol)";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="var(--filet-carte)";}}>

                    {/* Dénomination + forme juridique | badge pôle territoire */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,minWidth:0}}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontWeight:800,fontSize:15.5,color:"var(--encre)",lineHeight:1.35,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nom}</div>
                        {e.forme_juridique&&<div style={{fontSize:11,fontWeight:500,color:"var(--gris)",marginTop:3}}>{e.forme_juridique.replace(/\s*\([^)]*\)\s*$/,"")}</div>}
                      </div>
                      {e.pole_territoire_nom&&(
                        <span title={e.pole_territoire_nom} style={{...badgePole(e.pole_territoire_nom),whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",flexShrink:1,minWidth:0}}>
                          {e.pole_territoire_nom}
                        </span>
                      )}
                    </div>

                    {/* Date de création · Région en rangée épurée */}
                    <div style={{display:"flex",alignItems:"center",borderTop:"1px solid var(--bordure)",paddingTop:13,marginTop:"auto"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Date de création</p>
                        <p style={{fontSize:12.5,fontWeight:700,color:e.date_creation?"var(--encre)":"var(--gris)",fontVariantNumeric:"tabular-nums"}}>{e.date_creation?fmtDate(e.date_creation):"—"}</p>
                      </div>
                      <div style={{width:1,alignSelf:"stretch",background:"var(--fond)",margin:"0 18px"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Région</p>
                        <p style={{fontSize:12.5,fontWeight:700,color:e.region_nom?"var(--encre)":"var(--gris)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{e.region_nom||"—"}</p>
                      </div>
                    </div>
                  </div>
                  );
                }), [entreprises, gate, prechargerFiche]);

  const hasFilter=!!recherche||formesSel.length>0||secteursSel.length>0||branchesSel.length>0||activitesSel.length>0||regionsSel.length>0||deptsSel.length>0||arrondsSel.length>0||polesSel.length>0||isDateFiltered;
  const reinit=()=>{setRecherche("");setFormesSel([]);setSecteursSel([]);setBranchesSel([]);setActivitesSel([]);setRegionsSel([]);setDeptsSel([]);setArrondsSel([]);setPolesSel([]);setPlage(null);};
  const nbFiltres=(recherche?1:0)+formesSel.length+secteursSel.length+branchesSel.length+activitesSel.length+regionsSel.length+deptsSel.length+arrondsSel.length+polesSel.length+(isDateFiltered?1:0);

  const toggleForme   =(v:string)=>setFormesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleSecteur =(v:string)=>{setSecteursSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setBranchesSel([]);setActivitesSel([]);};
  const toggleBranche =(v:string)=>{setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setActivitesSel([]);};
  const toggleActivite=(v:string)=>setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleRegion  =(v:string)=>{setRegionsSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setDeptsSel([]);setArrondsSel([]);};
  const toggleDept    =(v:string)=>{setDeptsSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setArrondsSel([]);};
  const toggleArr     =(v:string)=>setArrondsSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const togglePole    =(v:string)=>setPolesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);

  return (
    <main style={{ height:"100dvh", display:"flex", flexDirection:"column", overflow:"hidden",
      background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <BarreTitre titre="Entreprises formalisées" compact actions={<NavActions home flouFond/>}
        droite={onglet==="liste" ? (
          <BarreTitreBadge label="Année de création" detail={triDate==="desc"?"Descendante":"Ascendante"}
            icon={triDate==="desc"?<ArrowDownUp size={13}/>:<ArrowUpDown size={13}/>}
            onClick={()=>setTriDate(triDate==="desc"?"asc":"desc")}/>
        ) : null}>
        <BarreTitreSegment options={[{v:"liste",l:"Liste des entreprises",count:liste.data?liste.total:undefined},{v:"territoire",l:"Vue territoriale"}]} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* Vue territoriale */}
      {onglet==="territoire" && (
        <section style={{flex:1,minHeight:0,overflowY:"auto",overscrollBehavior:"contain",
          padding:"36px 40px 80px",maxWidth:1280,margin:"0 auto",width:"100%"}}>
          {/* La carte ne dépend pas de la liste : elle s'affiche sans l'attendre */}
          <div className="charge-in"><VueTerritorialeSenegal zones={[]} mode="region"/></div>
        </section>
      )}

      {onglet==="liste" && <div style={{display:"flex",flex:1,minHeight:0}}>
          {/* Sidebar bande */}
          <PanneauFiltres nbFiltres={nbFiltres} aDesFiltres={hasFilter} onReinit={reinit}
            recherche={recherche} setRecherche={setRecherche}>
                <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
                <SideFilter label="Forme juridique" color="var(--bleu)" items={formeOpts} selected={formesSel} onToggle={toggleForme} listMaxHeight={180} format={v=>v.replace(/\s*\([^)]*\)\s*$/,"")}/>
                <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
                {dateMin<dateMax&&<DateRangeFilter minYear={dateMin} maxYear={dateMax} startYear={dateStart} endYear={dateEnd} onChange={(s,e)=>setPlage({debut:s,fin:e})}/>}
                <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs} secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel} onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
                <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
                <LocalisationFilter regions={regions} regionsSel={regionsSel} departementsSel={deptsSel} arrondissementsSel={arrondsSel} onRegion={toggleRegion} onDepartement={toggleDept} onArrondissement={toggleArr}/>
                {poles.length>0&&<><div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
                <SideFilter label="Pôle territoire" color="var(--bleu)" items={poles} selected={polesSel} onToggle={togglePole} listMaxHeight={180}/></>}
          </PanneauFiltres>
          {/* Grille */}
          <div ref={setPanneau} style={{flex:1,minWidth:0,overflowY:"auto",overscrollBehavior:"contain",padding:"36px 40px 80px"}}>
            {loading?(
              <SkeletonCards n={6} cols={COLONNES_CARTES} height={200}/>
            ):erreur&&entreprises.length===0?(
              <ErreurChargement onRetry={()=>liste.refetch()}/>
            ):entreprises.length===0?(
              <div style={{textAlign:"center",padding:"80px 24px",color:"var(--gris)"}}>
                <Building2 size={48} style={{margin:"0 auto 16px",opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>Aucune entreprise trouvée</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<BoutonEffacerFiltres onClick={reinit}/>}
              </div>
            ):(
              <>
              {/* Pendant qu'un nouveau filtre charge, les cartes du précédent restent, estompées */}
              <div className="charge-in" style={{...GRILLE_CARTES,opacity:liste.isPlaceholderData?0.55:1,transition:"opacity 0.15s"}}>
                {grilleCartes}
              </div>
              {/* La suite arrive au fil du défilement */}
              {hasNextPage&&<div ref={temoin} style={{height:1}}/>}
              {isFetchingNextPage&&<div style={{marginTop:14}}><SkeletonCards n={3} cols={COLONNES_CARTES} height={200}/></div>}
              {erreur&&!isFetchingNextPage&&<div style={{marginTop:14}}><ErreurChargement onRetry={()=>fetchNextPage()}/></div>}
              </>
            )}
          </div>
      </div>}

      {/* Modal partagé — une seule source de vérité */}
      <EntreprisePublicModal entreprise={ficheOuverte} complet={ficheComplete} onClose={()=>setSelId(null)}/>
    </main>
  );
}
