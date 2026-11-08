"use client";

import PanneauFiltres, { carteCliquable } from "@/components/shared/PanneauFiltres";
import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { GRILLE_CARTES, COLONNES_CARTES } from "@/lib/grilles";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuthGate } from "@/lib/authGate";
import AccordVueModal, { computeStatut, fmtDate } from "@/components/shared/AccordVueModal";
import { dureeDepuis } from "@/lib/format";
import { useNaemaArbre } from "@/lib/referentiels";
import { useQueryClient } from "@tanstack/react-query";
import { requeteDonnees, useDonnees } from "@/lib/donnees";
import { ThematiquesCascadeFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { useFicheUrlId } from "@/lib/ficheUrl";
import { useOuvertureFiche } from "@/lib/ouvertureFiche";
import { useListePaginee, useTemoinDeFin, type PageServeur } from "@/lib/listePaginee";
import { useDebounced } from "@/lib/useDebounced";

import { API_BASE } from "@/lib/api";


// Les onglets de la bande, un par statut. « Expirés » et les accords sans
// statut (aucune date passée) n'ont d'onglet que s'il en existe : ces derniers
// se disent « Non datés », ou « Autres » si l'un d'eux a une signature prévue.
type Onglet = "en_vigueur" | "signe" | "expire" | "sans_statut";
type Compteurs = Record<Onglet, number> & { sans_statut_signes: number };
const VIDE: Record<Onglet, string> = {
  en_vigueur: "Aucun accord en vigueur", signe: "Aucun accord signé non en vigueur",
  expire: "Aucun accord expiré", sans_statut: "Aucun accord",
};

// ── Page principale ───────────────────────────────────────────────────────────
export default function AccordsPage() {
  const gate = useAuthGate();
  const [paysDistincts, setPaysDistincts] = useState<{id:number;nom:string;code_iso2:string}[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);

  const [recherche,      setRecherche]      = useState("");
  const [onglet,         setOnglet]         = useState<Onglet>("en_vigueur");
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
    const p = new URLSearchParams({ par_page: "60", statut: onglet });
    if (rechercheEnvoyee) p.set("q", rechercheEnvoyee);
    if (paysIdsFiltres.length) p.set("pays", [...paysIdsFiltres].sort((a, b) => a - b).join(","));
    if (apixFiltre) p.set("apix", "true");
    for (const [nom, ids] of Object.entries(idsChoisis))
      if (ids.length) p.set(nom, [...ids].sort((a, b) => a - b).join(","));
    return `${API_BASE}/accords/catalogue?${p}`;
  }, [rechercheEnvoyee, onglet, paysIdsFiltres, apixFiltre, idsChoisis]);
  const liste = useListePaginee<any>(urlCatalogue);
  const accords = liste.elements;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = liste;

  // La première page dit les statuts qui existent parmi tous les traités
  // publiés (statuts) et combien chacun en compte avec la recherche et les
  // filtres (par_statut). Pendant qu'un autre onglet ou un autre filtre
  // charge, la réponse précédente reste : les onglets ne clignotent pas.
  const page1 = liste.data?.pages[0] as (PageServeur<any> & { statuts?: Compteurs; par_statut?: Compteurs }) | undefined;
  const statuts = page1?.statuts, parStatut = page1?.par_statut;
  // L'onglet des expirés ou des sans-statut disparu (il n'y en a plus) :
  // retour aux traités en vigueur
  if ((onglet === "expire" || onglet === "sans_statut") && statuts && !statuts[onglet]) setOnglet("en_vigueur");

  const onglets = ([
    { v: "en_vigueur", l: "En vigueur" },
    { v: "signe", l: "Signés non en vigueur" },
    ...(statuts?.expire ? [{ v: "expire", l: "Expirés" }] : []),
    ...(statuts?.sans_statut ? [{ v: "sans_statut", l: statuts.sans_statut_signes ? "Autres" : "Non datés" }] : []),
  ] as { v: Onglet; l: string }[]).map(o => ({ ...o, count: parStatut?.[o.v] }));

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
  // Elle s'ouvre complète, documents compris — déjà là le plus souvent,
  // demandée au survol — ou, passé 0,4 s, sur les champs de sa carte, le reste
  // arrivant à sa place (lib/ouvertureFiche)
  const ficheComplete = !!qFiche.data;
  const fichePrete = useOuvertureFiche(selId, ficheComplete);
  const ficheOuverte = selId == null || !fichePrete ? null : qFiche.data ?? accords.find(a => a.id === selId) ?? null;
  useFicheUrlId(id => setSelId(Number(id)));   // ouverture directe par l'adresse « ?fiche=<id> »

  // L'onglet n'est pas un filtre : effacer les filtres le garde
  const hasFilter=!!recherche||paysIdsFiltres.length>0||apixFiltre||secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  const reinit=()=>{setRecherche("");setPaysIdsFiltres([]);setApixFiltre(false);setSecteursSel([]);setBranchesSel([]);setActivitesSel([]);};
  const nbFiltres=(recherche?1:0)+paysIdsFiltres.length+(apixFiltre?1:0)+secteursSel.length+branchesSel.length+activitesSel.length;
  // Avec des filtres, l'onglet vide dit combien les autres en comptent
  const ailleurs = onglets.filter(o => o.v !== onglet).reduce((n, o) => n + (o.count || 0), 0);

  const toggleBranche =(v:string)=>{setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setActivitesSel([]);};
  const toggleActivite=(v:string)=>setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleSecteur =(v:string)=>{setSecteursSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);setBranchesSel([]);setActivitesSel([]);};
  const togglePaysId  =(id:number)=>setPaysIdsFiltres(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const senegalId  = paysDistincts.find((p:any)=>p.nom==="Sénégal")?.id;
  const autresPays = paysDistincts.filter((p:any)=>p.nom!=="Sénégal").sort((a:any,b:any)=>a.nom.localeCompare(b.nom,"fr"));

  // Les cartes, mémorisées : ouvrir ou fermer une fiche ne les redessine pas
  const grilleCartes = useMemo(() => accords.map(a=>{
                  // Le statut se lit dans l'onglet : la carte n'a plus de badge.
                  // Au survol, son filet passe à la marque.
                  const statut = computeStatut(a);
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

                    {/* Titre + ancienneté du statut */}
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:15.5,color:txtC,lineHeight:1.35,letterSpacing:"-0.01em"}}>{a.titre}</div>
                      {(()=>{
                        const sousTitre = statut==="en_vigueur"&&a.date_entree_vigueur ? `En vigueur depuis ${dureeDepuis(a.date_entree_vigueur)}`
                          : statut==="signe"&&a.date_signature ? `Signé il y a ${dureeDepuis(a.date_signature)}`
                          : statut==="expire"&&a.date_expiration ? `Expiré depuis ${dureeDepuis(a.date_expiration)}`
                          : a.reference || null;
                        return sousTitre&&<div style={{fontSize:11,fontWeight:500,color:"var(--gris)",marginTop:3}}>{sousTitre}</div>;
                      })()}
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
                }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [accords, gate]);

  return (
    <main style={{ height:"100dvh", display:"flex", flexDirection:"column", overflow:"hidden",
      background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {/* Hero */}
      <BarreTitre titre={"Accords & Traités"} compact actions={<NavActions home flouFond/>}>
        <BarreTitreSegment options={onglets} value={onglet} onChange={setOnglet}/>
      </BarreTitre>

      {/* Layout sidebar + contenu */}
      <div style={{display:"flex",flex:1,minHeight:0}}>

          {/* Sidebar bande */}
          <PanneauFiltres nbFiltres={nbFiltres} aDesFiltres={hasFilter} onReinit={reinit}
            recherche={recherche} setRecherche={setRecherche}>
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
                <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>
                  {VIDE[onglet]}{hasFilter ? " ne correspond à vos filtres" : " pour le moment"}
                </p>
                {hasFilter&&<p style={{fontSize:14,marginTop:6}}>
                  {ailleurs>0
                    ? `${ailleurs} accord${ailleurs>1?"s":""} y correspond${ailleurs>1?"ent":""} dans les autres onglets.`
                    : "Modifiez vos filtres pour affiner la recherche."}
                </p>}
                {hasFilter&&<BoutonEffacerFiltres onClick={reinit}/>}
              </div>
            ) : (
              <>
              {/* Pendant qu'un autre filtre charge, les cartes précédentes restent, estompées */}
              <div className="charge-in" style={{...GRILLE_CARTES,opacity:liste.isPlaceholderData?0.55:1,transition:"opacity 0.15s"}}>
                {grilleCartes}
              </div>
              {/* La suite arrive au fil du défilement */}
              {hasNextPage && <div ref={temoin} style={{height:1}}/>}
              {isFetchingNextPage && <div style={{marginTop:14}}><SkeletonCards n={2} cols={COLONNES_CARTES} height={120}/></div>}
              {liste.isError && !isFetchingNextPage && <div style={{marginTop:14}}><ErreurChargement onRetry={()=>fetchNextPage()}/></div>}
              </>
            )}
          </div>
      </div>

      {ficheOuverte&&<AccordVueModal accord={ficheOuverte} complet={ficheComplete} onClose={()=>setSelId(null)}/>}
    </main>
  );
}
