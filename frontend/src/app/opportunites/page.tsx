"use client";

import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Segments } from "@/components/shared/Segments";
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


/** LA CARTE DES TROIS ONGLETS — un titre, une ligne de contexte, une pastille,
 *  et deux données étiquetées sous un filet.
 *
 *  POURQUOI ELLE REMPLACE LES TUILES. Les potentialités et les avantages
 *  étaient rendus en petites étiquettes serrées, à l'intérieur d'un grand cadre
 *  blanc précédé d'un bandeau : à deux ou trois fiches, un cadre presque vide
 *  occupait la largeur de l'écran, et l'objet qu'on vient consulter y était
 *  l'élément le plus petit. L'onglet des projets, lui, employait déjà cette
 *  carte-ci. Une même page ne peut pas présenter ses trois collections de trois
 *  façons. */
function CarteOpp({ onVoir, aria, titre, contexte, badge, teinte, donnees }: {
  onVoir: () => void; aria: string; titre: string;
  contexte?: string | null; badge?: string | null; teinte: string;
  donnees: { label: string; valeur: string | null }[];
}) {
  return (
    <div {...carteCliquable(onVoir, aria)}
      style={{background:"var(--carte)",border:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,
        cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",
        padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:13}}
      onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=`${voile(teinte, 33)}`;}}
      onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="none";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="rgb(var(--encre-rgb) / 0.12)";}}>

      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,minWidth:0}}>
        <div style={{minWidth:0,flex:1}}>
          <div title={titre} style={{fontWeight:800,fontSize:15.5,color:"var(--encre)",lineHeight:1.35,
            letterSpacing:"-0.01em",overflow:"hidden",whiteSpace:"nowrap" as const,textOverflow:"ellipsis"}}>{titre}</div>
          {contexte && <div style={{fontSize:11,fontWeight:500,color:"var(--gris)",marginTop:3,
            overflow:"hidden",whiteSpace:"nowrap" as const,textOverflow:"ellipsis"}}>{contexte}</div>}
        </div>
        {badge && (
          <span title={badge} style={{fontSize:11,fontWeight:700,color:teinte,padding:"4px 12px",
            borderRadius:999,border:`1px solid ${voile(teinte, 35)}`,background:`${voile(teinte, 5)}`,
            whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",flexShrink:1,minWidth:0}}>{badge}</span>
        )}
      </div>

      <div style={{display:"flex",alignItems:"center",borderTop:"1px solid var(--bordure)",paddingTop:13,marginTop:"auto"}}>
        {donnees.map((d,i)=>(
          <React.Fragment key={d.label}>
            {i>0 && <div style={{width:1,alignSelf:"stretch",background:"var(--fond)",margin:"0 18px"}}/>}
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",
                textTransform:"uppercase" as const,marginBottom:4}}>{d.label}</p>
              <p title={d.valeur||undefined} style={{fontSize:12.5,fontWeight:700,
                color:d.valeur?"var(--encre)":"var(--gris)",overflow:"hidden",
                textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{d.valeur||"—"}</p>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/** La bascule d'un onglet, avec la ligne de couverture à sa droite.
 *  Elle remplace les trois ou quatre grandes cartes de compteurs : elles
 *  portaient un gros nombre, une barre et une phrase pour un geste unique —
 *  choisir —, et tant qu'on n'avait pas choisi, la page ne montrait RIEN. */
function BasculeCouverture({ children, couverture }: {
  children: React.ReactNode; couverture: React.ReactNode;
}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap" as const,marginBottom:18}}>
      {children}
      <span style={{fontSize:12,color:"var(--gris)",whiteSpace:"nowrap" as const}}>{couverture}</span>
    </div>
  );
}

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
                    <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>Aucun projet trouvé</p>
                    <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                  </div>
                ) : (
                  <>
                  <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
                    {projetsFiltres.map(p=>(
                      <CarteOpp key={p.id} onVoir={()=>setProjSel(p)}
                        aria={`Ouvrir la fiche : ${p.titre_projet}`}
                        titre={p.titre_projet} badge={p.pole_nom||null} teinte="var(--bleu)"
                        donnees={[
                          {label:"Région",valeur:p.region_nom||null},
                          {label:"Département",valeur:p.departement_nom||null},
                        ]} />
                    ))}
                  </div>
                  </>
                )}
              </>
            )}

            {/* ── Onglet Potentialités ── */}
            {onglet==="potentialites"&&(
              <>
                {potsLoad ? (
                  <SkeletonCards n={6} cols={2} height={150}/>
                ) : potsErr ? (
                  <ErreurChargement onRetry={()=>chargerPots()}/>
                ) : (()=>{
                  // UN NIVEAU EST TOUJOURS RETENU — celui qui porte des fiches,
                  // à défaut le premier. C'est ce qui supprime l'écran d'accueil
                  // où quatre cartes de compteurs tenaient lieu de contenu.
                  const defaut = NIVEAUX_POTS.find(n=>pots.some((p:any)=>p.niveau===n.key))?.key ?? NIVEAUX_POTS[0].key;
                  const niveau = selectedNiveau ?? defaut;
                  const meta = NIVEAUX_POTS.find(x=>x.key===niveau)!;
                  const items = pots.filter((p:any)=>p.niveau===niveau);
                  const total = niveau==="pole" ? poles.length
                    : niveau==="region" ? regions.length
                    : niveau==="departement" ? regions.reduce((s:number,r:any)=>s+(r.departements?.length||0),0)
                    : regions.reduce((s:number,r:any)=>s+(r.departements||[]).reduce((s2:number,d:any)=>s2+(d.arrondissements?.length||0),0),0);
                  const pct = total>0 ? Math.round(items.length/total*100) : 0;

                  // Le territoire parent, pour la colonne de rattachement.
                  const regionDuDept = (nom:string) => regions.find((r:any)=>(r.departements||[]).some((d:any)=>d.nom===nom))?.nom || null;
                  const deptDeArr = (nom:string) => {
                    for (const r of regions) for (const d of (r.departements||[])) if ((d.arrondissements||[]).some((a:any)=>a.nom===nom)) return d.nom;
                    return null;
                  };
                  const poleDeRegion = (nom:string) => poles.find((x:any)=>(x.localisation||"").includes(nom))?.pole_territoire || null;
                  const parent = (p:any): string|null => niveau==="pole" ? null
                    : niveau==="region" ? poleDeRegion(p.region_nom||"")
                    : niveau==="departement" ? (p.region_nom || regionDuDept(p.departement_nom||""))
                    : (p.departement_nom || deptDeArr(p.arrondissement_nom||""));
                  const libelleParent = niveau==="region" ? "Pôle" : niveau==="departement" ? "Région" : "Département";

                  return (
                    <>
                      <BasculeCouverture couverture={
                        <>{items.length} fiche{items.length>1?"s":""} sur {total||"—"} {meta.unit}{total>1?"s":""}{total>0?` · ${pct} %`:""}</>
                      }>
                        <Segments value={niveau} onChange={(v:string)=>setSelectedNiveau(v)}
                          accent={meta.color}
                          options={NIVEAUX_POTS.map(n=>({
                            v:n.key, l:n.label, n:pots.filter((p:any)=>p.niveau===n.key).length }))} />
                      </BasculeCouverture>

                      {items.length===0 ? (
                        <div style={{textAlign:"center",padding:"70px 24px",color:"var(--gris)"}}>
                          <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>Aucune fiche · {meta.label}</p>
                          <p style={{fontSize:14,marginTop:6}}>Choisissez un autre niveau territorial.</p>
                        </div>
                      ) : (
                        <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
                          {items.map((p:any)=>(
                            <CarteOpp key={p.id} onVoir={()=>setPotSel(p)}
                              aria={`Ouvrir la fiche : ${potTitle(p)}`}
                              titre={potTitle(p)} badge={p.niveau_nom||null} teinte={meta.color}
                              donnees={niveau==="pole"
                                ? [{label:"Activités",valeur:String((p.activite_ids||[]).length)},
                                   {label:"Secteurs",valeur:String((p.secteur_ids||[]).length)}]
                                : [{label:libelleParent,valeur:parent(p)},
                                   {label:"Activités",valeur:String((p.activite_ids||[]).length)}]} />
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {/* ── Onglet Avantages ── */}
            {onglet==="avantages"&&(
              <>
                {avgsLoad ? (
                  <SkeletonCards n={6} cols={2} height={150}/>
                ) : avgsErr ? (
                  <ErreurChargement onRetry={()=>chargerAvgs()}/>
                ) : (()=>{
                  const defaut = SECTEURS_AVGS.find(x=>avgs.some((a:any)=>(a.secteur_nom||"").toLowerCase().includes(x.key)))?.key ?? SECTEURS_AVGS[0].key;
                  const secteur = selectedSecAvg ?? defaut;
                  const meta = SECTEURS_AVGS.find(x=>x.key===secteur)!;
                  const items = avgs.filter((a:any)=>(a.secteur_nom||"").toLowerCase().includes(secteur));
                  const sec = secteurs.find((r:any)=>r.nom.toLowerCase().includes(secteur));
                  const branchIds = new Set((sec ? branches.filter((b:any)=>b.secteur_id===sec.id) : []).map((b:any)=>b.id));
                  const actCount = activites.filter((a:any)=>branchIds.has(a.branche_id)).length;
                  const pct = actCount>0 ? Math.round(items.length/actCount*100) : 0;
                  return (
                    <>
                      <BasculeCouverture couverture={
                        <>{items.length} avantage{items.length>1?"s":""} sur {actCount||"—"} activité{actCount>1?"s":""}{actCount>0?` · ${pct} %`:""}</>
                      }>
                        <Segments value={secteur} onChange={(v:string)=>setSelectedSecAvg(v)}
                          accent={meta.color}
                          options={SECTEURS_AVGS.map(x=>({
                            v:x.key, l:x.label,
                            n:avgs.filter((a:any)=>(a.secteur_nom||"").toLowerCase().includes(x.key)).length }))} />
                      </BasculeCouverture>

                      {items.length===0 ? (
                        <div style={{textAlign:"center",padding:"70px 24px",color:"var(--gris)"}}>
                          <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>Aucun avantage · {meta.label}</p>
                          <p style={{fontSize:14,marginTop:6}}>Choisissez un autre secteur.</p>
                        </div>
                      ) : (
                        <div className="charge-in" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
                          {items.map((a:any)=>{
                            const nbSel = (a.selections||[]).length;
                            return (
                              <CarteOpp key={a.id} onVoir={()=>setAvgSel(a)}
                                aria={`Ouvrir la fiche : ${a.activite_nom||"Avantage"}`}
                                titre={a.activite_nom||"Activité non précisée"}
                                badge={a.branche_nom||null} teinte={meta.color}
                                donnees={[
                                  {label:"Secteur",valeur:a.secteur_nom||null},
                                  // Un avantage se décrit par des types cochés au
                                  // référentiel OU par un texte libre : la colonne
                                  // dit celui qui est employé.
                                  {label:nbSel>1?"Avantages":"Avantage",
                                   valeur:nbSel>0?String(nbSel):(a.avantages?"Texte libre":null)},
                                ]} />
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
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
