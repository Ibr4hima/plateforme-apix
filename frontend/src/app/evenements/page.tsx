"use client";

import PanneauFiltres, { carteCliquable } from "@/components/shared/PanneauFiltres";
import NavActions from "@/components/layout/NavActions";
import BarreTitre, { BarreTitreBadge, BarreTitreSegment } from "@/components/shared/BarreTitre";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { SkeletonCards } from "@/components/shared/Skeleton";
import { GRILLE_CARTES, COLONNES_CARTES } from "@/lib/grilles";
import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuthGate } from "@/lib/authGate";
import { useNaemaArbre, useRefPays } from "@/lib/referentiels";
import { useQueryClient } from "@tanstack/react-query";
import { requeteDonnees, useDonnees } from "@/lib/donnees";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { useDebounced } from "@/lib/useDebounced";
import { fmtDate } from "@/lib/format";
import { voile } from "@/lib/couleurs";
import { SideFilter, ThematiquesCascadeFilter, BoutonEffacerFiltres } from "@/components/shared/FiltresLateraux";
import { computeStatutEvenement } from "@/lib/statuts";
import EvenementVueModal, { MOIS, ordinal } from "@/components/shared/EvenementVueModal";
import { useFicheUrlId } from "@/lib/ficheUrl";
import { useListePaginee, useTemoinDeFin, type PageServeur } from "@/lib/listePaginee";

import { API_BASE } from "@/lib/api";

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

// Une page de l'agenda : ses cartes, et sur la première le prochain événement,
// celui du filtre (mis en avant) et celui de l'agence (le bandeau)
type PageAgenda = PageServeur<any> & {
  prochain_id?: number | null;
  prochain?: { id: number; nom_event: string; date_debut: string | null } | null;
};

// ── Frise chronologique des événements ────────────────────────────────────────
// `complet` : tout l'agenda filtré est arrivé — les rendez-vous sans date
// fixée, derniers de la frise, peuvent alors la fermer
function FriseChronologique({ evenements, onOpen, onSurvol, prochainId, complet }: { evenements:any[]; onOpen:(e:any)=>void; onSurvol:(id:number)=>void; prochainId:number|null; complet:boolean }) {
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
  // Le serveur les envoie déjà du plus récent au plus ancien. Le tri, stable,
  // ne range que les cartes de la liste, affichées le temps que la frise arrive.
  avecDate.sort((a,b)=>b.d.getTime()-a.d.getTime());
  const parAnnee: {annee:number; items:{e:any;d:Date}[]}[] = [];
  avecDate.forEach(x=>{ const y=x.d.getFullYear(); let g=parAnnee.find(p=>p.annee===y); if(!g){g={annee:y,items:[]};parAnnee.push(g);} g.items.push(x); });

  const hoverIn = (ev:React.MouseEvent<HTMLDivElement>) => {
    ev.currentTarget.style.boxShadow="var(--ombre-survol)"; ev.currentTarget.style.transform="translateY(-2px)"; ev.currentTarget.style.borderColor="var(--filet-carte-survol)";
    ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
      const span = box.firstElementChild as HTMLElement|null;
      if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d/40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
    });
  };
  const hoverOut = (ev:React.MouseEvent<HTMLDivElement>) => {
    ev.currentTarget.style.boxShadow="var(--ombre-1)"; ev.currentTarget.style.transform="none"; ev.currentTarget.style.borderColor="var(--filet-carte)";
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
      ? { c:"var(--bleu)", label:"Prochain événement", b:"rgb(var(--bleu-rgb) / 0.45)", b2:"rgb(var(--bleu-rgb) / 0.6)" }
      : estEnCours
      ? { c:"var(--vert)", label:"Événement en cours", b:"rgb(var(--vert-rgb) / 0.45)", b2:"rgb(var(--vert-rgb) / 0.6)" }
      : null;
    const dateStr = e.date_debut
      ? (e.date_debut===e.date_fin||!e.date_fin ? fmtDate(e.date_debut) : `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}`)
      : e.prochain_mois||e.prochain_annee ? `${e.prochain_jour?e.prochain_jour+" ":""}${e.prochain_mois?MOIS[(e.prochain_mois||1)-1]+" ":""}${e.prochain_annee||""}`.trim() : null;
    const lieu = [e.ville,e.pays_hote_nom].filter(Boolean).join(", ");
    const txtC  = estPasse ? "var(--texte)" : "var(--encre)";
    return (
      <div {...carteCliquable(()=>onOpen(e))}
        onMouseEnter={ev=>{ hoverIn(ev); if(accent){ ev.currentTarget.style.borderColor=accent.b2; } onSurvol(e.id); }}
        onMouseLeave={ev=>{ hoverOut(ev); if(accent){ ev.currentTarget.style.borderColor=accent.b; } }}
        style={{background:estPasse?"var(--carte-douce)":"var(--carte)",border:accent?`1px solid ${accent.b}`:"1px solid var(--filet-carte)",borderRadius:8,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"var(--ombre-1)",overflow:"hidden",minWidth:0,display:"flex",flexDirection:"column" as const}}>
        {/* Bandeau d'état en aplat, le mot seul : événement en cours (vert) et prochain événement (bleu) */}
        {accent&&(
          <div style={{display:"flex",alignItems:"center",gap:7,background:accent.c,padding:"6px 16px",flexShrink:0}}>
            <span style={{fontSize:10,fontWeight:800,color:"var(--sur-bleu)",letterSpacing:"0.12em",textTransform:"uppercase" as const}}>{accent.label}</span>
          </div>
        )}
        <div style={{padding:"16px 18px 14px",flex:1,display:"flex",flexDirection:"column" as const,gap:12}}>
          {/* Titre + édition. Le statut se lit sur la bande et les dates ; le rôle de l'APIX, dans la fiche. */}
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
        <div style={{position:"absolute" as const,top:8,bottom:8,left:"50%",width:2,transform:"translateX(-1px)",background:"rgb(var(--bleu-rgb) / 0.15)",borderRadius:2}}/>

        {parAnnee.map(({annee,items})=>(
          <div key={annee}>
            {/* Jalon année */}
            <div style={{display:"flex",justifyContent:"center",padding:"6px 0 20px",position:"relative" as const,zIndex:1}}>
              <span style={{background:"var(--bleu-action)",color:"var(--sur-bleu)",fontWeight:800,fontSize:13,letterSpacing:"0.06em",padding:"7px 22px",borderRadius:999,boxShadow: "var(--ombre-bouton)"}}>{annee}</span>
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
      {complet&&sansDate.length>0&&(
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
  // Les pays hôtes proposés au filtre, avec leur drapeau
  const { data: hotesData } = useDonnees<string[]>(`${API_BASE}/evenements/pays-hotes`);
  const paysHotes = useMemo(() => {
    const refPays = (refPaysData as any[]) || [];
    return (Array.isArray(hotesData) ? hotesData : []).map((nom: string) => ({
      nom, code_iso2: refPays.find((p: any) => p.nom_fr === nom)?.code_iso2 || "",
    }));
  }, [hotesData, refPaysData]);


  // Les thématiques cochées, par leur nom dans le filtre, reportées sur leurs
  // identifiants : les événements portent les identifiants, pas les noms
  const idsChoisis = useMemo(() => {
    const secteursIds: number[] = [], branchesIds: number[] = [], activitesIds: number[] = [];
    for (const sec of secteurs) {
      if (secteursSel.includes(sec.nom)) secteursIds.push(sec.id);
      for (const bra of sec.branches || []) {
        if (branchesSel.includes(bra.nom)) branchesIds.push(bra.id);
        for (const act of bra.activites || []) if (activitesSel.includes(act.nom)) activitesIds.push(act.id);
      }
    }
    return { secteurs: secteursIds, branches: branchesIds, activites: activitesIds };
  }, [secteurs, secteursSel, branchesSel, activitesSel]);

  // L'agenda, soixante cartes à la fois, les suivantes au fil du défilement.
  // Il arrivait entier (1 Mo pour 2 700 événements) puis se filtrait ici ; le
  // serveur applique désormais les filtres, l'ordre de la vue (la liste par
  // date de début, la frise du plus récent au plus ancien) et trouve le
  // prochain événement. La recherche part un quart de seconde après la
  // dernière touche.
  const rechercheEnvoyee = useDebounced(recherche.trim(), 250);
  const urlAgenda = useMemo(() => {
    const p = new URLSearchParams({ ordre: vueMode === "frise" ? "frise" : "agenda", par_page: "60" });
    if (rechercheEnvoyee) p.set("q", rechercheEnvoyee);
    if (statutFiltre) p.set("statut", statutFiltre);
    for (const nom of [...paysFiltres].sort()) p.append("pays", nom);
    for (const [nom, ids] of Object.entries(idsChoisis))
      if (ids.length) p.set(nom, [...ids].sort((a, b) => a - b).join(","));
    return `${API_BASE}/evenements/agenda?${p}`;
  }, [vueMode, rechercheEnvoyee, statutFiltre, paysFiltres, idsChoisis]);
  const liste = useListePaginee<any>(urlAgenda);
  const evenements = liste.elements;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = liste;
  // Le prochain événement, deux portées, deux rôles : celui du filtre, la
  // carte mise en avant dans la vue ; celui de l'agence, le badge du bandeau —
  // filtrer sur un secteur ne doit pas faire proclamer au bandeau un « prochain
  // événement » qui n'est pas le vrai
  const premiere = liste.data?.pages[0] as PageAgenda | undefined;
  const prochainId: number | null = premiere?.prochain_id ?? null;
  const prochainAgence = premiere?.prochain ?? null;

  // Le panneau qui défile porte le témoin de bas de liste ; un autre filtre,
  // une autre vue repartent du haut
  const [panneau, setPanneau] = useState<HTMLDivElement | null>(null);
  useEffect(() => { panneau?.scrollTo({ top: 0 }); }, [urlAgenda, panneau]);
  const temoin = useTemoinDeFin(() => { if (!isFetchingNextPage) fetchNextPage(); }, !!hasNextPage, panneau);

  // La fiche complète (description, thématiques, pays invités, fichiers) se
  // demande à l'ouverture, et dès le survol de sa carte. La fiche s'ouvre sans
  // attendre sur les champs de la carte, le reste la complète à son arrivée.
  const queryClient = useQueryClient();
  const urlFiche = (id: number) => `${API_BASE}/evenements/${id}`;
  const prechargerFiche = (id: number) => { queryClient.prefetchQuery(requeteDonnees(urlFiche(id))); };
  const [selId, setSelId] = useState<number | null>(null);
  const qFiche = useDonnees<Record<string, unknown>>(selId != null ? urlFiche(selId) : null);
  const ficheOuverte = selId == null ? null : qFiche.data ?? evenements.find(e => e.id === selId) ?? null;
  useFicheUrlId(id => setSelId(Number(id)));   // ouverture directe par l'adresse « ?fiche=<id> »

  const hasFilter = !!recherche||!!statutFiltre||paysFiltres.length>0||secteursSel.length>0||branchesSel.length>0||activitesSel.length>0;
  const reinit = ()=>{ setRecherche(""); setStatutFiltre(""); setPaysFiltres([]); setSecteursSel([]); setBranchesSel([]); setActivitesSel([]); };
  const nbFiltres = (recherche?1:0)+(statutFiltre?1:0)+paysFiltres.length+secteursSel.length+branchesSel.length+activitesSel.length;

  // Le bas de la liste et de la frise : le témoin qui demande la suite, la
  // suite en chargement, ou son échec
  const suite = (
    <>
      {hasNextPage && <div ref={temoin} style={{height:1}}/>}
      {isFetchingNextPage && <div style={{marginTop:14}}><SkeletonCards n={2} cols={COLONNES_CARTES} height={120}/></div>}
      {liste.isError && !isFetchingNextPage && <div style={{marginTop:14}}><ErreurChargement onRetry={()=>fetchNextPage()}/></div>}
    </>
  );

  const togglePays     = (v:string) => setPaysFiltres(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleSecteur  = (v:string) => { setSecteursSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setBranchesSel([]); setActivitesSel([]); };
  const toggleBranche  = (v:string) => { setBranchesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]); setActivitesSel([]); };
  const toggleActivite = (v:string) => setActivitesSel(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);

  return (
    <main style={{ height:"100dvh", display:"flex", flexDirection:"column", overflow:"hidden",
      background:"var(--champ)", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}
@keyframes pulseHalo{0%{box-shadow:0 0 0 0 rgb(var(--ombre-rgb) / 0.45)}70%{box-shadow:0 0 0 9px rgb(var(--ombre-rgb) / 0)}100%{box-shadow:0 0 0 0 rgb(var(--ombre-rgb) / 0)}}
@keyframes pulseHaloVert{0%{box-shadow:0 0 0 0 rgb(var(--ombre-rgb) / 0.45)}70%{box-shadow:0 0 0 9px rgb(var(--ombre-rgb) / 0)}100%{box-shadow:0 0 0 0 rgb(var(--ombre-rgb) / 0)}}`}</style>
      {/* Barre de titre */}
      <BarreTitre titre="Événements" compact actions={<NavActions home flouFond/>}
        droite={(()=>{
          const prochain = prochainAgence;
          if (!prochain) return null;
          return <BarreTitreBadge label="Prochain événement" detail={`${prochain.nom_event}${prochain.date_debut?` · ${fmtDate(prochain.date_debut)}`:""}`} onClick={()=>gate(()=>setSelId(prochain.id))}
            icon={<span className="material-symbols-outlined" style={{fontSize:16,fontVariationSettings:"'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20",lineHeight:1}}>event</span>}/>;
        })()}>
        <BarreTitreSegment options={[{v:"liste",l:"Liste",count:liste.data?liste.total:undefined},{v:"frise",l:"Frise chronologique"}]} value={vueMode} onChange={setVueMode}/>
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
                <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
                <SideFilter label="Pays hôte" color="var(--bleu)" marginBottom={20} selected={paysFiltres} onToggle={togglePays}
                  items={paysHotes.map(p=>({value:p.nom,label:p.nom}))}/>
                <div style={{height:1,background:"var(--filet)",marginBottom:18}}/>
                <ThematiquesCascadeFilter secteurs={secteurs} secteursSel={secteursSel} branchesSel={branchesSel} activitesSel={activitesSel} onSecteur={toggleSecteur} onBranche={toggleBranche} onActivite={toggleActivite}/>
          </PanneauFiltres>

          {/* Grille */}
          <div ref={setPanneau} style={{flex:1,minWidth:0,overflowY:"auto",overscrollBehavior:"contain",padding:"36px 40px 80px"}}>
            {liste.isPending?(
              <SkeletonCards n={6} cols={COLONNES_CARTES} height={220}/>
            ):liste.isError&&evenements.length===0?(
              <ErreurChargement onRetry={()=>liste.refetch()}/>
            ):evenements.length===0?(
              <div style={{textAlign:"center",padding:"80px 24px",color:"var(--gris)"}}>
                <CalendarDays size={48} style={{margin:"0 auto 16px",opacity:0.3}}/>
                <p style={{fontSize:16,fontWeight:600,color:"var(--texte)"}}>Aucun événement trouvé</p>
                <p style={{fontSize:14,marginTop:6}}>Modifiez vos filtres pour affiner la recherche.</p>
                {hasFilter&&<BoutonEffacerFiltres onClick={reinit}/>}
              </div>
            ):vueMode==="frise"?(
              <>
                {/* Pendant qu'un autre filtre charge, la frise précédente reste, estompée */}
                <div style={{opacity:liste.isPlaceholderData?0.55:1,transition:"opacity 0.15s"}}>
                  <FriseChronologique evenements={evenements} complet={!hasNextPage} onOpen={(e:any)=>gate(()=>setSelId(e.id))} onSurvol={prechargerFiche} prochainId={prochainId}/>
                </div>
                {suite}
              </>
            ):(
              <>
                <div className="charge-in" style={{...GRILLE_CARTES,opacity:liste.isPlaceholderData?0.55:1,transition:"opacity 0.15s"}}>
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
                      ? { c:"var(--bleu)", label:"Prochain événement", b:"rgb(var(--bleu-rgb) / 0.45)", b2:"rgb(var(--bleu-rgb) / 0.6)" }
                      : estEnCours
                      ? { c:"var(--vert)", label:"Événement en cours", b:"rgb(var(--vert-rgb) / 0.45)", b2:"rgb(var(--vert-rgb) / 0.6)" }
                      : null;
                    const txtC   = estPasse ? "var(--texte)" : "var(--encre)";
                    return (
                      <div key={e.id} {...carteCliquable(()=>gate(()=>setSelId(e.id)))}
                        style={{background:estPasse?"var(--carte-douce)":"var(--carte)",border:accent?`1px solid ${accent.b}`:"1px solid var(--filet-carte)",borderRadius:8,cursor:"pointer",transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",boxShadow:"var(--ombre-1)",display:"flex",flexDirection:"column" as const,overflow:"hidden"}}
                        onMouseEnter={ev=>{
                          prechargerFiche(e.id);
                          ev.currentTarget.style.boxShadow="var(--ombre-survol)";ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.borderColor=accent?accent.b2:"var(--filet-carte-survol)";
                          // Contenus trop longs : glissent pour révéler la fin
                          ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                            const span = box.firstElementChild as HTMLElement | null;
                            if (span) { const d = span.scrollWidth - (box as HTMLElement).clientWidth; if (d > 0) { span.style.transition = `transform ${Math.max(0.6, d / 40)}s ease`; span.style.transform = `translateX(-${d}px)`; } }
                          });
                        }}
                        onMouseLeave={ev=>{
                          ev.currentTarget.style.boxShadow="var(--ombre-1)";ev.currentTarget.style.transform="none";ev.currentTarget.style.borderColor=accent?accent.b:"var(--filet-carte)";
                          ev.currentTarget.querySelectorAll("[data-marquee]").forEach(box=>{
                            const span = box.firstElementChild as HTMLElement | null;
                            if (span) { span.style.transition = "transform 0.4s ease"; span.style.transform = "translateX(0)"; }
                          });
                        }}>

                        {/* Bandeau d'état en aplat, le mot seul (comme la frise) :
                            événement en cours (vert) et prochain événement (bleu) */}
                        {accent&&(
                          <div style={{display:"flex",alignItems:"center",gap:7,background:accent.c,padding:"6px 16px",flexShrink:0}}>
                            <span style={{fontSize:10,fontWeight:800,color:"var(--sur-bleu)",letterSpacing:"0.12em",textTransform:"uppercase" as const}}>{accent.label}</span>
                          </div>
                        )}
                        <div style={{padding:"18px 20px 16px",flex:1,display:"flex",flexDirection:"column" as const,gap:13}}>
                          {/* Titre + édition. Le statut se lit sur la bande et les dates ; le rôle de l'APIX, dans la fiche. */}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                            <div style={{minWidth:0,flex:1}}>
                              <div style={{fontWeight:800,fontSize:15.5,color:txtC,lineHeight:1.35,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{e.nom_event}</div>
                              {(()=>{
                                const sousTitre = statutAff==="a_venir" ? (dansCombien(e) ?? (e.edition!=null?ordinal(e.edition):null)) : (e.edition!=null?ordinal(e.edition):null);
                                return sousTitre&&<div style={{fontSize:11,fontWeight:500,color:"var(--gris)",marginTop:3}}>{sousTitre}</div>;
                              })()}
                            </div>
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
                {suite}
              </>
            )}
          </div>
      </div>

      <EvenementVueModal ev={ficheOuverte} onClose={()=>setSelId(null)}/>
    </main>
  );
}
