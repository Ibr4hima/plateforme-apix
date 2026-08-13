"use client";

import PanneauFiltres, { carteCliquable } from "@/components/shared/PanneauFiltres";
import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { grilleCartes, COLONNES_OUVERT, COLONNES_REPLIE } from "@/lib/grilles";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthGate } from "@/lib/authGate";
import AccordVueModal, { computeStatut, fmtDate } from "@/components/shared/AccordVueModal";
import { useNaemaArbre, useRefPays } from "@/lib/referentiels";
import { useDonnees, useTous, VIDE } from "@/lib/donnees";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { badge_vert, badge_bleu, badge_gris } from "@/lib/couleurs";
import { ThematiquesCascadeFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { useFicheUrl } from "@/lib/ficheUrl";

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
  // Le contenu vient du cache React Query : revenir sur la page déjà visitée
  // est instantané, le rafraîchissement se fait en arrière-plan (lib/donnees).
  const { data: tousData, isPending: loading, isError: erreur, refetch: charger } = useTous(`${API_BASE}/accords`);
  const tous = (tousData ?? VIDE) as any[];
  // Barre de filtres repliée : la grille prend une colonne de plus.
  const [filtresOuverts, setFiltresOuverts] = useState(true);
  const [selec,       setSelec]       = useState<any>(null);
  useFicheUrl(tous, setSelec);   // ouverture directe depuis la recherche globale (⌘K)

  const [paysDistincts, setPaysDistincts] = useState<{id:number;nom:string;code_iso2:string}[]>([]);
  const [secteurs,    setSecteurs]    = useState<any[]>([]);
  const [allPays,     setAllPays]     = useState<any[]>([]);

  const [recherche,      setRecherche]      = useState("");
  const [statutFiltre,   setStatutFiltre]   = useState("");
  // Type de traité (onglet hero) : bilatéraux d'investissement / internationaux (à venir)
  const [typeTraite,     setTypeTraite]     = useEtatUrl<"tbi"|"inter">("type", "tbi", ["tbi","inter"]);
  const [paysIdsFiltres, setPaysIdsFiltres] = useState<number[]>([]);
  const [secteursSel,    setSecteursSel]    = useState<string[]>([]);
  const [branchesSel,    setBranchesSel]    = useState<string[]>([]);
  const [activitesSel,   setActivitesSel]   = useState<string[]>([]);
  const [apixFiltre,     setApixFiltre]     = useState(false);
  const [partiesOpen,    setPartiesOpen]    = useState(true);

  // Référentiels servis par le cache partagé ; parties-distinctes reste métier
  const { arbre: naemaArbre } = useNaemaArbre();
  const { data: paysData } = useRefPays();
  useEffect(()=>{ setSecteurs(naemaArbre); },[naemaArbre]);
  useEffect(()=>{ setAllPays((paysData as any[])||[]); },[paysData]);
  const { data: partiesData } = useDonnees(`${API_BASE}/accords/parties-distinctes`);
  useEffect(()=>{ setPaysDistincts(partiesData?.pays||[]); },[partiesData]);


  const getPaysNoms = (a:any, max=2): string => {
    let noms: string[] = [];
    if (a.parties_pays_ids?.length>0) {
      noms = (a.parties_pays_ids as number[])
        .map((id:number)=>allPays.find((r:any)=>r.id===id)?.nom_fr)
        .filter(Boolean) as string[];
    } else if (a.parties_signataires) {
      noms = a.parties_signataires.split(", ").filter(Boolean);
    }
    if (max && noms.length > max) return noms.slice(0, max).join(", ") + `, +${noms.length - max}`;
    return noms.join(", ");
  };

  const accords = useMemo(() => tous.filter(a=>{
    // Onglet actif = Traités Bilatéraux d'Investissement (l'existant sans type est bilatéral)
    if ((a.type_accord || "tbi") !== "tbi") return false;
    if (recherche) {
      const q=recherche.toLowerCase();
      // max=0 : la recherche porte sur la liste COMPLÈTE des signataires — la
      // chaîne d'affichage tronquée (« France, Italie, +3 ») rendait
      // introuvable tout accord par son 3e pays et au-delà.
      const paysStr=getPaysNoms(a, 0).toLowerCase();
      if (!a.titre?.toLowerCase().includes(q)&&!a.reference?.toLowerCase().includes(q)&&!paysStr.includes(q)) return false;
    }
    if (statutFiltre&&computeStatut(a)!==statutFiltre) return false;
    const hasPartiesFilter = paysIdsFiltres.length>0||apixFiltre;
    if (hasPartiesFilter) {
      const matchesPays = paysIdsFiltres.length>0&&paysIdsFiltres.some(id=>(a.parties_pays_ids||[]).includes(id));
      const matchesApix = apixFiltre&&!!(a.parties_signataires?.toLowerCase().includes("apix"));
      if (!matchesPays&&!matchesApix) return false;
    }
    if (secteursSel.length>0) {
      const secIds=secteursSel.map((nom:string)=>secteurs.find((s:any)=>s.nom===nom)?.id).filter(Boolean);
      if (!secIds.some((id:number)=>(a.secteur_ids||[]).includes(id))) return false;
    }
    if (branchesSel.length>0) {
      const braIds=branchesSel.map((nom:string)=>secteurs.flatMap((s:any)=>s.branches||[]).find((b:any)=>b.nom===nom)?.id).filter(Boolean);
      if (!braIds.some((id:number)=>(a.branche_ids||[]).includes(id))) return false;
    }
    if (activitesSel.length>0) {
      const actIds=activitesSel.map((nom:string)=>secteurs.flatMap((s:any)=>s.branches||[]).flatMap((b:any)=>b.activites||[]).find((ac:any)=>ac.nom===nom)?.id).filter(Boolean);
      if (!actIds.some((id:number)=>(a.activite_ids||[]).includes(id))) return false;
    }
    return true;
  }).sort((a:any,b:any)=>{
    // Les accords ACTIFS d'abord, classés par échéance croissante — celui qui
    // expire le plus tôt en tête, c'est lui qui réclame l'attention. Les
    // expirés vont en fin de liste (du plus récemment expiré au plus ancien).
    // L'ancien tri, échéance croissante brute, ouvrait la page sur les
    // accords déjà expirés depuis le plus longtemps.
    const exp = (x:any) => computeStatut(x)==="expire";
    if (exp(a) !== exp(b)) return exp(a) ? 1 : -1;
    if (!a.date_expiration && !b.date_expiration) return 0;
    if (!a.date_expiration) return 1;
    if (!b.date_expiration) return -1;
    const c = a.date_expiration.localeCompare(b.date_expiration);
    return exp(a) ? -c : c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tous, recherche, statutFiltre, paysIdsFiltres, apixFiltre, secteursSel, branchesSel, activitesSel, secteurs, allPays]);

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
      <BarreTitre titre={"Accords & Traités"} compact actions={<NavActions onDark home flouFond/>}>
        <BarreTitreSegment options={[
          {v:"tbi",   l:"Traités Bilatéraux d'Investissement", count: accords.length},
          {v:"inter", l:"Traités Internationaux", badge:"Bientôt"},
        ]} value={typeTraite} onChange={setTypeTraite}/>
      </BarreTitre>

      {typeTraite === "inter" ? (
      /* Traités internationaux — à venir */
      <div style={{flex:1,minHeight:0,overflowY:"auto",overscrollBehavior:"contain",
          maxWidth:1400,margin:"0 auto",padding:"80px 40px",textAlign:"center" as const,width:"100%"}}>
        <div style={{display:"inline-flex",flexDirection:"column" as const,alignItems:"center",gap:16}}>
          <div style={{width:64,height:64,borderRadius:16,background:"rgb(var(--bleu-rgb) / 0.08)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <FileText size={28} style={{color:"var(--bleu)"}}/>
          </div>
          <h2 style={{fontWeight:800,fontSize: "var(--t-r140)",color:"var(--encre)"}}>Traités Internationaux</h2>
          <p style={{fontSize: "var(--t-14)",color:"var(--gris)",maxWidth:380,lineHeight:1.7}}>Les traités internationaux seront disponibles prochainement.</p>
          <div style={{background:"rgb(var(--bleu-rgb) / 0.07)",border:"1px solid rgb(var(--bleu-rgb) / 0.2)",borderRadius:10,padding:"10px 20px"}}>
            <span style={{fontSize: "var(--t-12)",fontWeight:700,color:"var(--bleu)"}}>Disponible prochainement</span>
          </div>
        </div>
      </div>
      ) : (
      /* Layout sidebar + contenu */
      <div style={{display:"flex",flex:1,minHeight:0}}>

          {/* Sidebar bande */}
          <PanneauFiltres onPli={setFiltresOuverts} nbFiltres={nbFiltres} aDesFiltres={hasFilter} onReinit={reinit}
            recherche={recherche} setRecherche={setRecherche}>
                {/* Statut */}
                <div style={{marginBottom:18}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <span style={{fontSize: "var(--t-11)",fontWeight:700,color:"var(--gris)",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Statut</span>
                    {statutFiltre&&<span style={{fontSize: "var(--t-10)",fontWeight:700,color:"var(--bleu)",background:"rgb(var(--bleu-rgb) / 0.1)",padding:"1px 6px",borderRadius:999}}>1</span>}
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
                        <span style={{fontSize: "var(--t-12)",color:"var(--texte)",fontWeight:sel?700:400}}>{o.l}</span>
                      </button>
                    );})}
                  </div>
                </div>
                <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
                {/* Parties signataires — section personnalisée */}
                <div style={{marginBottom:18}}>
                  <button onClick={()=>setPartiesOpen(o=>!o)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:partiesOpen?8:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize: "var(--t-11)",fontWeight:700,color:"var(--gris)",textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>Parties signataires</span>
                      {(paysIdsFiltres.length>0||apixFiltre)&&<span style={{fontSize: "var(--t-10)",fontWeight:700,color:"var(--bleu)",background:"rgb(var(--bleu-rgb) / 0.1)",padding:"1px 6px",borderRadius:999}}>{paysIdsFiltres.length+(apixFiltre?1:0)}</span>}
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
                        <span style={{fontSize: "var(--t-12)",color:"var(--texte)",fontWeight:sel?700:400}}>Sénégal</span>
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
                        <span style={{fontSize: "var(--t-12)",color:"var(--texte)",fontWeight:sel?700:400}}>APIX S.A</span>
                      </button>
                    );})()}
                    {/* Sous-section Pays */}
                    {autresPays.length>0&&<>
                      <p style={{fontSize: "var(--t-10)",fontWeight:700,color:"var(--gris)",textTransform:"uppercase" as const,letterSpacing:"0.08em",margin:"8px 0 2px",padding:"0 8px"}}>Pays</p>
                      <div style={{maxHeight:160,overflowY:"auto" as const}}>
                        {autresPays.map((p:any)=>{const sel=paysIdsFiltres.includes(p.id); return (
                          <button key={p.id} onClick={()=>togglePaysId(p.id)}
                            style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:7,border:"none",cursor:"pointer",background:"transparent",textAlign:"left" as const,width:"100%"}}
                            onMouseEnter={e=>{e.currentTarget.style.background="var(--carte-douce)";}}
                            onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                            <div style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`,background:sel?"var(--bleu-action)":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                                          </div>
                            <span style={{fontSize: "var(--t-12)",color:"var(--texte)",fontWeight:sel?700:400}}>{p.nom}</span>
                          </button>
                        );})}
                      </div>
                    </>}
                  </div>}
                </div>
                <div style={{height:1,background:"var(--fond)",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs}
                  secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel}
                  onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite} marginBottom={0}/>
          </PanneauFiltres>

          {/* Grille accords */}
          <div style={{flex:1,minWidth:0,overflowY:"auto",overscrollBehavior:"contain",padding:"36px 40px 80px"}}>
            {loading ? (
              <SkeletonCards n={6} cols={filtresOuverts ? COLONNES_OUVERT : COLONNES_REPLIE} height={200}/>
            ) : erreur ? (
              <ErreurChargement onRetry={()=>charger()}/>
            ) : accords.length===0 ? (
              <div style={{textAlign:"center",padding:"80px 24px",color:"var(--gris)"}}>
                <FileText size={48} style={{marginBottom:16,opacity:0.3}}/>
                <p style={{fontSize: "var(--t-16)",fontWeight:600,color:"var(--texte)"}}>Aucun accord trouvé</p>
                <p style={{fontSize: "var(--t-14)",marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<BoutonEffacerFiltres onClick={reinit}/>}
              </div>
            ) : (
              <>
              <div className="charge-in" style={grilleCartes(filtresOuverts)}>
                {accords.map(a=>{
                  const statut = computeStatut(a);
                  // Badges du design system : en vigueur vert, signé bleu,
                  // expiré gris ; l'accent de survol suit la couleur du statut
                  const ST: any = {
                    en_vigueur: { label:"En vigueur",            badge:badge_vert, accent:"var(--vert)" },
                    signe:      { label:"Signé non en vigueur",  badge:badge_bleu, accent:"var(--bleu)" },
                    expire:     { label:"Expiré",                badge:badge_gris, accent:"var(--gris)" },
                  };
                  const st = statut ? ST[statut] : null;
                  const estExpire = statut==="expire";
                  const txtC = estExpire ? "var(--texte)" : "var(--encre)";
                  // Date secondaire : expiration si renseignée, sinon entrée en vigueur
                  const dateSec = a.date_expiration
                    ? { label:"Expiration", val:fmtDate(a.date_expiration), vide:false }
                    : { label:"Entrée en vigueur", val:a.date_entree_vigueur?fmtDate(a.date_entree_vigueur):"Non définie", vide:!a.date_entree_vigueur };
                  // Accent du survol = couleur du statut
                  const accent = st ? st.accent : "var(--gris)";
                  return (
                  <div key={a.id} {...carteCliquable(()=>gate(()=>setSelec(a)))}
                    style={{background:estExpire?"var(--carte-douce)":"var(--carte)",border:"1px solid rgb(var(--encre-rgb) / 0.12)",borderRadius:16,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"none",padding:"18px 20px 16px",display:"flex",flexDirection:"column" as const,gap:13}}
                    onMouseEnter={ev=>{ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=accent;}}
                    onMouseLeave={ev=>{ev.currentTarget.style.boxShadow="none";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor="rgb(var(--encre-rgb) / 0.12)";}}>

                    {/* Titre + ancienneté du statut | badge pastel à droite */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontWeight:800,fontSize: "var(--t-15)",color:txtC,lineHeight:1.35,letterSpacing:"-0.01em"}}>{a.titre}</div>
                        {(()=>{
                          const sousTitre = statut==="en_vigueur"&&a.date_entree_vigueur ? `En vigueur depuis ${dureeDepuis(a.date_entree_vigueur)}`
                            : statut==="signe"&&a.date_signature ? `Signé il y a ${dureeDepuis(a.date_signature)}`
                            : statut==="expire"&&a.date_expiration ? `Expiré depuis ${dureeDepuis(a.date_expiration)}`
                            : a.reference || null;
                          return sousTitre&&<div style={{fontSize: "var(--t-11)",fontWeight:500,color:"var(--gris)",marginTop:3}}>{sousTitre}</div>;
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
                        <p style={{fontSize: "var(--t-9)",fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>Signature</p>
                        <p style={{fontSize: "var(--t-125)",fontWeight:700,color:a.date_signature?txtC:"var(--gris)",fontVariantNumeric:"tabular-nums"}}>{a.date_signature?fmtDate(a.date_signature):"—"}</p>
                      </div>
                      <div style={{width:1,alignSelf:"stretch",background:"var(--fond)",margin:"0 18px"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize: "var(--t-9)",fontWeight:800,letterSpacing:"0.12em",color:"var(--gris)",textTransform:"uppercase" as const,marginBottom:4}}>{dateSec.label}</p>
                        <p style={{fontSize: "var(--t-125)",fontWeight:700,color:dateSec.vide?"var(--gris)":txtC,fontVariantNumeric:"tabular-nums"}}>{dateSec.val}</p>
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
      )}

      {selec&&<AccordVueModal accord={selec} onClose={()=>setSelec(null)}/>}
    </main>
  );
}
