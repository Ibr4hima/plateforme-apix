"use client";

import PanneauFiltres, { carteCliquable } from "@/components/shared/PanneauFiltres";
import NavActions from "@/components/layout/NavActions";
import BarreTitre from "@/components/shared/BarreTitre";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { GRILLE_CARTES, COLONNES_CARTES } from "@/lib/grilles";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuthGate } from "@/lib/authGate";
import AccordVueModal, { computeStatut, fmtDate } from "@/components/shared/AccordVueModal";
import { useNaemaArbre } from "@/lib/referentiels";
import { useQueryClient } from "@tanstack/react-query";
import { requeteDonnees, useDonnees } from "@/lib/donnees";
import { badge_vert, badge_bleu, badge_gris } from "@/lib/couleurs";
import { ThematiquesCascadeFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { useFicheUrlId } from "@/lib/ficheUrl";
import { useListePaginee, useTemoinDeFin } from "@/lib/listePaginee";
import { useDebounced } from "@/lib/useDebounced";

import { API_BASE } from "@/lib/api";

// Durée écoulée depuis une date : « 3 ans », « 1 an », « 7 mois »…
const dureeDepuis = (dstr:string): string => {
  const d = new Date(dstr+"T00:00:00"), now = new Date();
  let mois = (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth());
  if (now.getDate() < d.getDate()) mois -= 1;
  if (mois < 1) return "moins d'un mois";
  const ans = Math.floor(mois/12);
  if (ans >= 1) return `${ans} an${ans>1?"s":""}`;
  return `${mois} mois`;
};

// ── Page principale ───────────────────────────────────────────────────────────
export default function AccordsPage() {
  const gate = useAuthGate();
  const [paysDistincts, setPaysDistincts] = useState<{id:number;nom:string;code_iso2:string}[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);

  const [recherche,      setRecherche]      = useState("");
  const [statutFiltre,   setStatutFiltre]   = useState("");
  const [paysIdsFiltres, setPaysIdsFiltres] = useState<number[]>([]);
  const [secteursSel,    setSecteursSel]    = useState<string[]>([]);
  const [branchesSel,    setBranchesSel]    = useState<string[]>([]);
  const [activitesSel,   setActivitesSel]   = useState<string[]>([]);
  const [apixFiltre,     setApixFiltre]     = useState(false);
  const [partiesOpen,    setPartiesOpen]    = useState(true);

  // Référentiels servis par le cache partagé ; parties-distinctes reste métier
  const { arbre: naemaArbre } = useNaemaArbre();
  useEffect(()=>{ setSecteurs(naemaArbre); },[naemaArbre]);
  const { data: partiesData } = useDonnees(`${API_BASE}/accords/parties-distinctes`);
  useEffect(()=>{ setPaysDistincts(partiesData?.pays||[]); },[partiesData]);

  // Les thématiques cochées, par leur nom dans le filtre, reportées sur leurs
  // identifiants : les accords portent les identifiants, pas les noms
  const idsChoisis = useMemo(() => {
    const ids = (noms: string[], liste: any[]) =>
      noms.map(nom => liste.find((x: any) => x.nom === nom)?.id).filter(Boolean) as number[];
    const branches = secteurs.flatMap((s: any) => s.branches || []);
    const activites = branches.flatMap((b: any) => b.activites || []);
    return { secteurs: ids(secteursSel, secteurs), branches: ids(branchesSel, branches), activites: ids(activitesSel, activites) };
  }, [secteurs, secteursSel, branchesSel, activitesSel]);

  // Les traités, soixante cartes à la fois, les suivants au fil du défilement.
  // Ils arrivaient tous (0,6 Mo pour 2 500 traités) puis se filtraient et se
  // triaient ici ; le serveur applique désormais les filtres et l'ordre de la
  // page : les accords actifs d'abord, celui qui expire le plus tôt en tête,
  // puis les expirés, du plus récemment expiré au plus ancien. La recherche
  // (titre, référence, tous les signataires) part un quart de seconde après la
  // dernière touche.
  const rechercheEnvoyee = useDebounced(recherche.trim(), 250);
  const urlCatalogue = useMemo(() => {
    const p = new URLSearchParams({ par_page: "60" });
    if (rechercheEnvoyee) p.set("q", rechercheEnvoyee);
    if (statutFiltre) p.set("statut", statutFiltre);
    if (paysIdsFiltres.length) p.set("pays", [...paysIdsFiltres].sort((a, b) => a - b).join(","));
    if (apixFiltre) p.set("apix", "true");
    for (const [nom, ids] of Object.entries(idsChoisis))
      if (ids.length) p.set(nom, [...ids].sort((a, b) => a - b).join(","));
    return `${API_BASE}/accords/catalogue?${p}`;
  }, [rechercheEnvoyee, statutFiltre, paysIdsFiltres, apixFiltre, idsChoisis]);
  const liste = useListePaginee<any>(urlCatalogue);
  const accords = liste.elements;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = liste;

  // Le panneau qui défile porte le témoin de bas de liste ; un autre filtre
  // repart du haut
  const [panneau, setPanneau] = useState<HTMLDivElement | null>(null);
  useEffect(() => { panneau?.scrollTo({ top: 0 }); }, [urlCatalogue, panneau]);
  const temoin = useTemoinDeFin(() => { if (!isFetchingNextPage) fetchNextPage(); }, !!hasNextPage, panneau);

  // La fiche complète se demande à l'ouverture, et dès le survol de la carte ;
  // elle s'ouvre aussitôt sur les champs de la carte
  const queryClient = useQueryClient();
  const urlFiche = (id: number) => `${API_BASE}/accords/${id}`;
  const prechargerFiche = (id: number) => { queryClient.prefetchQuery(requeteDonnees(urlFiche(id))); };
  const [selId, setSelId] = useState<number | null>(null);
  const qFiche = useDonnees<Record<string, unknown>>(selId != null ? urlFiche(selId) : null);
  const ficheOuverte = selId == null ? null : qFiche.data ?? accords.find(a => a.id === selId) ?? null;
  useFicheUrlId(id => setSelId(Number(id)));   // ouverture directe par l'adresse « ?fiche=<id> »

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
    <main style={{ height:"100dvh", display:"flex", flexDirection:"column", overflow:"hidden",
      background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {/* Hero */}
      <BarreTitre titre={"Accords & Traités"} compact actions={<NavActions home flouFond/>} />

      {/* Layout sidebar + contenu */}
      <div style={{display:"flex",flex:1,minHeight:0}}>

          {/* Sidebar bande */}
          <PanneauFiltres nbFiltres={nbFiltres} aDesFiltres={hasFilter} onReinit={reinit}
            recherche={recherche} setRecherche={setRecherche}>
                {/* Statut */}
                <div style={{marginBottom:18}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--gris)",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Statut</span>
                    {statutFiltre&&<span style={{fontSize:10,fontWeight:700,color:"var(--bleu)",background:"rgb(var(--bleu-rgb) / 0.1)",padding:"1px 6px",borderRadius:999}}>1</span>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                    {[
                      {v:"",           l:"Tous"},
                      {v:"en_vigueur", l:"En vigueur"},
                      {v:"signe",      l:"Signés non en vigueur"},
                      {v:"expire",     l:"Expirés"},
                    ].map(o=>{const sel=statutFiltre===o.v; return (
                      <button key={o.v} onClick={()=>setStatutFiltre(o.v)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const,width:"100%"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="var(--carte-douce)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`,background:sel?"var(--bleu-action)":"transparent",flexShrink:0}}/>
                        <span style={{fontSize:12,color:"var(--texte)",fontWeight:sel?700:400}}>{o.l}</span>
                      </button>
                    );})}
                  </div>
                </div>
                <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
                {/* Parties signataires — section personnalisée */}
                <div style={{marginBottom:18}}>
                  <button onClick={()=>setPartiesOpen(o=>!o)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:partiesOpen?8:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,fontWeight:700,color:"var(--gris)",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Parties signataires</span>
                      {(paysIdsFiltres.length>0||apixFiltre)&&<span style={{fontSize:10,fontWeight:700,color:"var(--bleu)",background:"rgb(var(--bleu-rgb) / 0.1)",padding:"1px 6px",borderRadius:999}}>{paysIdsFiltres.length+(apixFiltre?1:0)}</span>}
                    </div>
                    <span style={{width:20,height:20,borderRadius:"50%",background:"var(--champ)",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {partiesOpen?<ChevronUp size={11} style={{color:"var(--texte)"}}/>:<ChevronDown size={11} style={{color:"var(--texte)"}}/>}
        </span>
                  </button>
                  {partiesOpen&&<div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                    {/* Sénégal */}
                    {senegalId!==undefined&&(()=>{const sel=paysIdsFiltres.includes(senegalId); return (
                      <button onClick={()=>togglePaysId(senegalId)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const,width:"100%"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="var(--carte-douce)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`,background:sel?"var(--bleu-action)":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                                  </div>
                        <span style={{fontSize:12,color:"var(--texte)",fontWeight:sel?700:400}}>Sénégal</span>
                      </button>
                    );})()}
                    {/* APIX S.A */}
                    {(()=>{const sel=apixFiltre; return (
                      <button onClick={()=>setApixFiltre(f=>!f)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const,width:"100%"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="var(--carte-douce)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                        <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`,background:sel?"var(--bleu-action)":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                                  </div>
                        <span style={{fontSize:12,color:"var(--texte)",fontWeight:sel?700:400}}>APIX S.A</span>
                      </button>
                    );})()}
                    {/* Sous-section Pays */}
                    {autresPays.length>0&&<>
                      <p style={{fontSize:10,fontWeight:700,color:"var(--gris)",textTransform:"uppercase" as const,letterSpacing:"0.08em",margin:"8px 0 2px",padding:"0 8px"}}>Pays</p>
                      <div style={{maxHeight:160,overflowY:"auto" as const}}>
                        {autresPays.map((p:any)=>{const sel=paysIdsFiltres.includes(p.id); return (
                          <button key={p.id} onClick={()=>togglePaysId(p.id)}
                            style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const,width:"100%"}}
                            onMouseEnter={e=>{e.currentTarget.style.background="var(--carte-douce)";}}
                            onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                            <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`,background:sel?"var(--bleu-action)":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                                          </div>
                            <span style={{fontSize:12,color:"var(--texte)",fontWeight:sel?700:400}}>{p.nom}</span>
                          </button>
                        );})}
                      </div>
                    </>}
                  </div>}
                </div>
                <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs}
                  secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel}
                  onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite} marginBottom={0}/>
          </PanneauFiltres>

          {/* Grille accords */}
          <div ref={setPanneau} style={{flex:1,minWidth:0,overflowY:"auto",overscrollBehavior:"contain",padding:"36px 40px 80px"}}>
            {liste.isPending ? (
              <SkeletonCards n={6} cols={COLONNES_CARTES} height={200}/>
            ) : liste.isError && accords.length===0 ? (
              <ErreurChargement onRetry={()=>liste.refetch()}/>
            ) : accords.length===0 ? (
              <div style={{textAlign:"center",padding:"80px 24px",color:"var(--gris)"}}>
                <FileText size={48} style={{margin:"0 auto 16px",opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>Aucun accord trouvé</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<BoutonEffacerFiltres onClick={reinit}/>}
              </div>
            ) : (
              <>
              {/* Pendant qu'un autre filtre charge, les cartes précédentes restent, estompées */}
              <div className="charge-in" style={{...GRILLE_CARTES,opacity:liste.isPlaceholderData?0.55:1,transition:"opacity 0.15s"}}>
                {accords.map(a=>{
                  const statut = computeStatut(a);
                  // Badges du design system : en vigueur vert, signé bleu,
                  // expiré gris ; au survol, le filet de la carte passe à la marque
                  const ST: any = {
                    en_vigueur: { label:"En vigueur",            badge:badge_vert },
                    signe:      { label:"Signé non en vigueur",  badge:badge_bleu },
                    expire:     { label:"Expiré",                badge:badge_gris },
                  };
                  const st = statut ? ST[statut] : null;
                  const estExpire = statut==="expire";
                  const txtC = estExpire ? "var(--texte)" : "var(--encre)";
                  // Date secondaire : expiration si renseignée, sinon entrée en vigueur
                  const dateSec = a.date_expiration
                    ? { label:"Expiration", val:fmtDate(a.date_expiration), vide:false }
                    : { label:"Entrée en vigueur", val:a.date_entree_vigueur?fmtDate(a.date_entree_vigueur):"Non définie", vide:!a.date_entree_vigueur };
                  return (
                  <div key={a.id} {...carteCliquable(()=>gate(()=>setSelId(a.id)))}
                    style={{background:estExpire?"var(--carte-douce)":"var(--carte)",border:"1px solid var(--filet-carte)",borderRadius:8,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"var(--ombre-1)",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:13}}
                    onMouseEnter={ev=>{prechargerFiche(a.id);ev.currentTarget.style.boxShadow="var(--ombre-survol)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor="var(--filet-carte-survol)";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="var(--filet-carte)";}}>

                    {/* Titre + ancienneté du statut | badge pastel à droite */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontWeight:800,fontSize:15.5,color:txtC,lineHeight:1.35,letterSpacing:"-0.01em"}}>{a.titre}</div>
                        {(()=>{
                          const sousTitre = statut==="en_vigueur"&&a.date_entree_vigueur ? `En vigueur depuis ${dureeDepuis(a.date_entree_vigueur)}`
                            : statut==="signe"&&a.date_signature ? `Signé il y a ${dureeDepuis(a.date_signature)}`
                            : statut==="expire"&&a.date_expiration ? `Expiré depuis ${dureeDepuis(a.date_expiration)}`
                            : a.reference || null;
                          return sousTitre&&<div style={{fontSize:11,fontWeight:500,color:"var(--gris)",marginTop:3}}>{sousTitre}</div>;
                        })()}
                      </div>
                      {st&&(
                        <span style={{...st.badge, whiteSpace:"nowrap" as const, flexShrink:0}}>
                          {st.label}
                        </span>
                      )}
                    </div>

                    {/* Dates en rangée épurée + flèche d'action */}
                    <div style={{display:"flex",alignItems:"center",borderTop:"1px solid var(--bordure)",paddingTop:13,marginTop:"auto"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Signature</p>
                        <p style={{fontSize:12.5,fontWeight:700,color:a.date_signature?txtC:"var(--gris)",fontVariantNumeric:"tabular-nums"}}>{a.date_signature?fmtDate(a.date_signature):"—"}</p>
                      </div>
                      <div style={{width:1,alignSelf:"stretch",background:"var(--fond)",margin:"0 18px"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>{dateSec.label}</p>
                        <p style={{fontSize:12.5,fontWeight:700,color:dateSec.vide?"var(--gris)":txtC,fontVariantNumeric:"tabular-nums"}}>{dateSec.val}</p>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              {/* La suite arrive au fil du défilement */}
              {hasNextPage && <div ref={temoin} style={{height:1}}/>}
              {isFetchingNextPage && <div style={{marginTop:14}}><SkeletonCards n={2} cols={COLONNES_CARTES} height={120}/></div>}
              {liste.isError && !isFetchingNextPage && <div style={{marginTop:14}}><ErreurChargement onRetry={()=>fetchNextPage()}/></div>}
              </>
            )}
          </div>
      </div>

      {ficheOuverte&&<AccordVueModal accord={ficheOuverte} onClose={()=>setSelId(null)}/>}
    </main>
  );
}
