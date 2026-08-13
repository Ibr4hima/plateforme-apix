"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { carteCliquable } from "@/components/shared/PanneauFiltres";
import { COMP_PALETTE } from "@/lib/couleurs";
import { X, ChevronDown, SlidersHorizontal, Search } from "lucide-react";
import { calculerKpis, fmtKpi, KPI_DEFAUT, type KpiResult } from "@/lib/ideKpis";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { useDebounced } from "@/lib/useDebounced";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardIde";
import PickerKpi, { BtnSwapKpi, STYLE_KPI_SWAP, type PickerItem } from "@/components/shared/PickerKpi";
import { CurseurPlageNace } from "@/components/shared/CurseurNace";
import { API, fmtVal, BadgePeriode, BadgeSerie, SERIES_TYPES, fmtNombre, SelecteurVueAnalyse, BtnAjoutPaysComp, SousTypeNav, useBornesCnuced, GrapheMultiPays, TopAnneesFlux, CarteTableauAnnees, CarteTableauComparatif, ModalDonnees, KPI_25_IDS, splitKpiTitre, MiniModalKpi, sortContinents, groupByContinent, splitKpiLabel, BoutonDonnees } from "./partage";
import { useDonnees } from "@/lib/donnees";
import Variation from "@/components/shared/Variation";


function OngletPays({ paysDispo, showTable, setShowTable, sousOnglet, setSousOnglet, sousType, setSousType, vueP, setVueP }: { paysDispo: any[]; showTable: boolean; setShowTable: (v:boolean)=>void; sousOnglet: string; setSousOnglet: (v:"pays"|"comparative"|"monde")=>void; sousType: string; setSousType: (v:"fluxstock"|"greenfield"|"fusion")=>void; vueP: string; setVueP: (v:"pays"|"secteurs")=>void }) {
  const [paysSelec,   setPaysSelec]   = useState<string>("Sénégal");
  // Pays ajoutés via le « + » de l'en-tête (3 max) : dès qu'il y en a un, la
  // vue bascule en analyse comparative (graphes multi-séries, KPIs masqués)
  const [paysComp,    setPaysComp]    = useState<string[]>([]);
  // Popover d'ajout ouvert → le contenu (KPIs + graphes) est flouté derrière
  const [compOpen,    setCompOpen]    = useState(false);
  const [borneMin, borneMax] = useBornesCnuced(sousType);
  const [anneeMin,    setAnneeMin]    = useState(borneMin);
  const [anneeMax,    setAnneeMax]    = useState(borneMax);
  const [modeAnnees,  setModeAnnees]  = useState<"plage"|"specifiques">("plage");
  const [anneesSpec,  setAnneesSpec]  = useState<number[]>([]);
  // Période stabilisée : le fetch attend la fin du drag des sliders
  const anneeMinD   = useDebounced(anneeMin, 300);
  const anneeMaxD   = useDebounced(anneeMax, 300);
  const anneesSpecD = useDebounced(anneesSpec, 300);
  // Alignement sur les bornes réelles dès qu'elles sont connues
  useEffect(() => { setAnneeMin(borneMin); setAnneeMax(borneMax); }, [borneMin, borneMax]);
  const [kpisEpingles, setKpisEpingles] = useState<string[]>(KPI_DEFAUT);
  const [kpiActif,     setKpiActif]     = useState<KpiResult|null>(null);
  // Slot (0-3) dont le picker de remplacement est ouvert ; -1 = aucun
  const [pickerSlot,   setPickerSlot]   = useState(-1);
  const [searchPays,   setSearchPays]   = useState("");
  const [openConts,    setOpenConts]    = useState<Set<string>>(new Set());
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 520);

  const couleur = "var(--bleu)";

  // Données CNUCED en cache React Query, clé = pays + période : re-choisir un
  // pays ou une plage déjà vus raffiche sans squelette ; pendant une nouvelle
  // requête, l'écran garde les données précédentes (garder) au lieu de
  // clignoter.
  const urlCnuced = (() => {
    const params = new URLSearchParams({ pays_list: [paysSelec, ...paysComp].join(",") });
    if (modeAnnees==="specifiques" && anneesSpecD.length>0) params.set("annees", anneesSpecD.join(","));
    else { params.set("annee_min", String(anneeMinD)); params.set("annee_max", String(anneeMaxD)); }
    return `${API}/ide/cnuced?${params}`;
  })();
  const qCnuced = useDonnees<any[]>(urlCnuced, { garder: true });
  const donnees = useMemo(() => (qCnuced.data ?? []) as any[], [qCnuced.data]);
  const loading = qCnuced.isPending, erreur = qCnuced.isError;

  // Mode comparatif : au moins un pays ajouté via le « + » de l'en-tête
  const estComparatif = paysComp.length > 0;
  const paysAvecCouleur = [paysSelec, ...paysComp].map((nom, i) => ({ nom, couleur: COMP_PALETTE[i] ?? COMP_PALETTE[COMP_PALETTE.length - 1] }));
  // KPIs toujours calculés sur le seul pays de référence (les données chargées
  // peuvent contenir plusieurs pays en mode comparatif)
  const donneesRef = estComparatif ? donnees.filter((d: any) => d.pays === paysSelec) : donnees;

  const tousKpis    = calculerKpis(donneesRef);
  const kpisCards   = kpisEpingles.map(id=>tousKpis.find(k=>k.id===id)).filter(Boolean) as KpiResult[];
  // KPIs proposés au remplacement : les 25 canoniques non épinglés
  const kpisDispo   = KPI_25_IDS.filter(id=>!kpisEpingles.includes(id)).map(id=>tousKpis.find(k=>k.id===id)).filter(Boolean) as KpiResult[];
  const dernAnnee   = modeAnnees==="specifiques"&&anneesSpec.length>0?anneesSpec[anneesSpec.length-1]:anneeMax;
  const pickerItems: PickerItem[] = kpisDispo.map(k => {
    const { main, badge } = splitKpiLabel(k.label, dernAnnee);
    return { id: k.id, label: main, badge, valeur: fmtKpi(k), title: k.description };
  });
  // Remplacement en place (slot occupé) ou ajout (slot vide) du KPI choisi
  const remplacerKpi = (slot: number, id: string) => {
    setKpisEpingles(prev => slot < prev.length ? prev.map((k,i)=>i===slot?id:k) : [...prev, id]);
    setPickerSlot(-1);
  };

  const filteredPays = searchPays ? paysDispo.filter(p=>p.nom.toLowerCase().includes(searchPays.toLowerCase())) : paysDispo;
  const groupedPays  = groupByContinent(filteredPays);
  const toggleCont   = (c: string) => setOpenConts(prev => { const n=new Set(prev); n.has(c)?n.delete(c):n.add(c); return n; });

  // Une série par pays sélectionné (1 seule en mode simple, jusqu'à 4 en comparatif)
  const buildSerie = (dir: string, ind: string) => paysAvecCouleur.map(p => ({
    nom: p.nom, couleur: p.couleur,
    data: donnees.filter(d => d.pays === p.nom && d.direction === dir && d.indicateur === ind),
  }));

  // Sous-type actif (greenfield / fusion) : graphes et KPIs basculent dessus
  const stActif = sousType !== "fluxstock" && SERIES_TYPES[sousType] ? SERIES_TYPES[sousType] : null;

  // Période réellement couverte par le sous-type (ex. greenfield : 2003+)
  const stBornes = (() => {
    if (!stActif) return null;
    const inds = new Set(stActif.map(s => s.ind));
    const ys = donnees.filter((d: any) => inds.has(d.indicateur) && d.valeur !== null).map((d: any) => d.annee);
    return ys.length ? [Math.min(...ys), Math.max(...ys)] as [number, number] : null;
  })();
  const perMin = stBornes ? Math.max(anneeMin, stBornes[0]) : anneeMin;
  const perMax = stBornes ? Math.min(anneeMax, stBornes[1]) : anneeMax;

  const GRAPHES_PAYS = (stActif || SERIES_TYPES.fluxstock).map((s, i) => ({
    id: `${sousType}-${i}`, titre: s.label, unite: s.unite,
    series: buildSerie(s.dir, s.ind),
  }));

  // Graphes d'analyse (vue Pays, flux & stocks, hors comparatif) : soldes nets
  // des flux et des stocks, et top 10 des années dans les deux sens — pays de
  // référence.
  const grapheExtras = (!stActif && !estComparatif) ? (() => {
    const serieDe = (dir: string, ind: string) => donneesRef
      .filter((d: any) => d.direction === dir && d.indicateur === ind && d.valeur !== null)
      .sort((a: any, b: any) => a.annee - b.annee) as { annee: number; valeur: number }[];
    // Un solde n'a de sens que sur les années où les DEUX sens sont connus :
    // soustraire une valeur manquante reviendrait à la compter pour zéro.
    const solde = (entrant: { annee: number; valeur: number }[], sortant: { annee: number; valeur: number }[]) => {
      const parAnnee = new Map(sortant.map(r => [r.annee, r.valeur]));
      return entrant.filter(r => parAnnee.has(r.annee))
        .map(r => ({ annee: r.annee, valeur: r.valeur - (parAnnee.get(r.annee) as number) }));
    };
    const rowsE = serieDe("entrant", "flux"), rowsS = serieDe("sortant", "flux");
    const stockE = serieDe("entrant", "stock"), stockS = serieDe("sortant", "stock");
    if (!rowsE.length) return null;

    const serieNet = [{ nom: "Flux nets", couleur: "var(--bleu)", data: solde(rowsE, rowsS) }];
    const soldeStock = solde(stockE, stockS);
    const serieStockNet = soldeStock.length
      ? [{ nom: "Stocks nets", couleur: "var(--bleu)", data: soldeStock }] : null;

    const dixPremieres = (rs: { annee: number; valeur: number }[]) =>
      [...rs].sort((a, b) => b.valeur - a.valeur).slice(0, 10);
    const top10 = dixPremieres(rowsE);
    const serieTop = [{ nom: "Flux entrants", couleur: "var(--bleu)", data: top10 }];
    const top10S = rowsS.length ? dixPremieres(rowsS) : null;
    const serieTopS = top10S ? [{ nom: "Flux sortants", couleur: "var(--bleu)", data: top10S }] : null;

    return { serieNet, serieStockNet, top10, serieTop, top10S, serieTopS };
  })() : null;

  // KPIs dédiés greenfield / M&A (les 25 KPIs épinglables ne concernent que
  // flux & stocks) — même gabarit que les KPIs annuels : année en pastille +
  // variation ▲/▼ % vs la valeur disponible précédente.
  const stCards = (() => {
    if (!stActif) return null;
    const serie = (dir: string, ind: string) => donneesRef
      .filter((d: any) => d.direction === dir && d.indicateur === ind && d.valeur !== null)
      .sort((a: any, b: any) => a.annee - b.annee);
    // Dernier point + précédent + Δ % (null si non calculable)
    const pt = (rs: any[]) => {
      const l = rs.length ? rs[rs.length - 1] : null, p = rs.length > 1 ? rs[rs.length - 2] : null;
      const delta = l && p && p.valeur ? ((l.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
      return { l, delta, ref: l && p ? p.annee : null };
    };
    const sE = serie("entrant", stActif[0].ind), sS = serie("sortant", stActif[1].ind), sN = serie("entrant", stActif[2].ind);
    const vE = pt(sE), vS = pt(sS), nE = pt(sN);
    // Solde net (reçus − émis) : série des années communes → dernier + Δ
    const parAnneeS = new Map(sS.map((r: any) => [r.annee, r.valeur]));
    const sSolde = sE.filter((r: any) => parAnneeS.has(r.annee)).map((r: any) => ({ annee: r.annee, valeur: r.valeur - (parAnneeS.get(r.annee) as number) }));
    const solde = pt(sSolde);
    const gf = sousType === "greenfield";
    return [
      { label: gf ? "Inv. greenfield reçus" : "Rachats d'entreprises locales", val: vE.l ? fmtVal(vE.l.valeur) : "N/A", annee: vE.l?.annee ?? null, delta: vE.delta, ref: vE.ref, ind: null as string | null },
      { label: gf ? "Inv. greenfield émis" : "Acquisitions à l'étranger", val: vS.l ? fmtVal(vS.l.valeur) : "N/A", annee: vS.l?.annee ?? null, delta: vS.delta, ref: vS.ref, ind: null },
      { label: gf ? "Nombre de projets reçus" : "Nombre de rachats locaux", val: nE.l ? fmtNombre(nE.l.valeur) : "N/A", annee: nE.l?.annee ?? null, delta: nE.delta, ref: nE.ref, ind: null },
      { label: gf ? "Solde net · reçus − émis" : "Solde net · rachats − acquisitions", val: solde.l !== null ? `${solde.l.valeur > 0 ? "+" : ""}${fmtVal(solde.l.valeur)}` : "N/A", annee: solde.l?.annee ?? null, delta: solde.delta, ref: solde.ref, ind: null },
    ];
  })();

  // Variation ▲/▼ % du KPI vs sa valeur de l'année précédente : on recalcule le
  // même KPI sur les données tronquées avant son année de référence.
  const getVariation = (k: KpiResult): { delta: number | null; ref: number | null } => {
    if (k.annee == null || k.valeur == null) return { delta: null, ref: null };
    const prev = calculerKpis(donneesRef.filter((d) => d.annee < (k.annee as number))).find((p) => p.id === k.id);
    if (!prev || prev.valeur == null || prev.valeur === 0 || prev.annee == null) return { delta: null, ref: null };
    return { delta: ((k.valeur - prev.valeur) / Math.abs(prev.valeur)) * 100, ref: prev.annee };
  };

  // Indicatif grisé sous la valeur
  const getIndicatif = (k: KpiResult): string | null => {
    if (k.annee) return `en ${k.annee}`;
    if (k.id.includes("vs_moy")) return "vs moyenne hist.";
    if (k.id.includes("5_fe")||k.id.includes("5_fs")) return "5 dernières années";
    if (k.id.includes("10_fe")||k.id.includes("10_fs")) return "10 dernières années";
    if (k.id.includes("cagr")) return "période complète";
    if (k.id.includes("mom")) return "5 ans glissants";
    if (k.id.includes("n_pos")||k.id.includes("cur_streak")) return "sur la période";
    if (k.id.includes("dist_max")) return "vs pic historique";
    if (k.id.includes("regularite")) return "% années positives";
    return null;
  };

  const hasFilter = paysSelec!=="Sénégal" || paysComp.length>0 || (modeAnnees==="specifiques"&&anneesSpec.length>0) || (modeAnnees==="plage"&&(anneeMin!==borneMin||anneeMax!==borneMax));
  const nbFiltres = (paysSelec!=="Sénégal"||paysComp.length>0?1:0) + ((modeAnnees==="specifiques"&&anneesSpec.length>0)||(modeAnnees==="plage"&&(anneeMin!==borneMin||anneeMax!==borneMax))?1:0);
  const reinit = () => { setPaysSelec("Sénégal"); setPaysComp([]); setModeAnnees("plage"); setAnneeMin(borneMin); setAnneeMax(borneMax); setAnneesSpec([]); setKpisEpingles(KPI_DEFAUT); };

  return (
    <div style={{ display:"flex", flex:1, minHeight:0 }}>

        {/* Sidebar bande */}
        <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"var(--carte)", borderRight:"1px solid var(--bordure-forte)", height:"100%", overflowY:"auto" as const, overscrollBehavior:"contain" as const, display:"flex", flexDirection:"column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:var(--fond-creux2)}::-webkit-scrollbar-thumb:hover{background:var(--fond-creux2)}`}</style>
          {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent", transition:"background 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
          <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid var(--bordure)", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
            {sidebarOpen&&<span style={{ fontSize: "var(--t-12)", fontWeight:700, color:"var(--encre)", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <button onClick={()=>setSidebarOpen(o=>!o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background:"rgb(var(--bleu-rgb) / 0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
                <SlidersHorizontal size={14} style={{ color:"var(--bleu)" }}/>
                {sidebarOpen&&nbFiltres>0&&<span style={{ fontSize: "var(--t-10)", fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.15)", borderRadius:999, padding:"1px 5px" }}>{nbFiltres}</span>}
              </button>
              {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser" style={{ background:"rgb(var(--danger-rgb) / 0.08)", border:"1px solid rgb(var(--danger-rgb) / 0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgb(var(--danger-rgb) / 0.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgb(var(--danger-rgb) / 0.08)";}}>
                <span className="material-symbols-outlined" style={{ fontSize: "var(--t-15)", color:"var(--danger)", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
              </button>}
            </div>
          </div>
          {sidebarOpen&&<div style={{ padding:"16px", overflowY:"auto" as const, flex:1 }}>
              {/* Sélecteurs Vue + Type d'analyse */}
              <SelecteurVueAnalyse vueP={vueP} setVueP={setVueP} typeAnalyse={sousOnglet} setTypeAnalyse={setSousOnglet}/>
              <div style={{ position:"relative" as const, marginBottom:18 }}>
                <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"var(--gris)" }}/>
                <input value={searchPays} onChange={e=>setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
                  style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid var(--bordure-forte)", background:"var(--carte-douce)", fontSize: "var(--t-12)", color:"var(--encre)", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
                {searchPays&&<button onClick={()=>setSearchPays("")} aria-label="Effacer la recherche" style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"var(--gris)" }}/></button>}
              </div>
              <div style={{ height:1, background:"var(--fond)", marginBottom:18 }}/>
              {/* Pays */}
              <div style={{ marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                  <span style={{ fontSize: "var(--t-11)", fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Pays</span>
                  <span style={{ fontSize: "var(--t-10)", fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.18)", padding:"1px 6px", borderRadius:999 }}>1</span>
                </div>
                {/* Sénégal épinglé */}
                {(()=>{
                  const sel = paysSelec==="Sénégal";
                  const col = "var(--bleu-action)";
                  return (
                    <div style={{ marginBottom:8, marginLeft:6 }}>
                      <button onClick={()=>{ setPaysSelec("Sénégal"); setPaysComp(prev=>prev.filter(n=>n!=="Sénégal")); }}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:"pointer", background:"transparent", textAlign:"left" as const, width:"100%" }}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="var(--carte-douce)";}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                        <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`, background:sel?"var(--bleu-action)":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          
                        </div>
                        <span style={{ fontSize: "var(--t-12)", color:"var(--texte)", fontWeight:sel?700:400 }}>Sénégal</span>
                        <span style={{ marginLeft:"auto", fontSize: "var(--t-9)", color:"var(--gris)", fontWeight:600, background:"var(--fond)", padding:"1px 5px", borderRadius:4 }}>Réf.</span>
                      </button>
                    </div>
                  );
                })()}
                <div style={{ height:1, background:"var(--fond)", marginBottom:8 }}/>
                <div style={{ maxHeight:200, overflowY:"auto" as const }}>
                  {sortContinents(Object.keys(groupedPays)).map(continent => {
                    const isOpen = openConts.has(continent);
                    const zones  = groupedPays[continent];
                    return (
                      <div key={continent} style={{ marginBottom:6 }}>
                        <button onClick={()=>toggleCont(continent)}
                          style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 8px", borderRadius:7, background:"rgb(var(--bleu-rgb) / 0.04)", border:"none", cursor:"pointer", marginBottom:3 }}>
                          <span style={{ fontSize: "var(--t-10)", fontWeight:700, color:"var(--bleu)", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{continent}</span>
                          <ChevronDown size={11} style={{ color:"var(--bleu)", transform:isOpen?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
                        </button>
                        {isOpen&&Object.entries(zones).sort(([a],[b])=>a.localeCompare(b,"fr")).map(([zone,paysInZone]) => (
                          <div key={zone} style={{ marginLeft:6, marginBottom:4 }}>
                            <p style={{ fontSize: "var(--t-9)", fontWeight:600, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em", padding:"2px 8px", marginBottom:2 }}>{zone}</p>
                            {(paysInZone as any[]).map((p:any) => {
                              const sel = paysSelec === p.nom;
                              if (p.nom==="Sénégal") return (
                                <div key={p.nom} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, width:"100%", opacity:0.35, cursor:"not-allowed" as const }}>
                                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`, background:sel?"var(--bleu-action)":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    
                                  </div>
                                  <span style={{ fontSize: "var(--t-12)", color:"var(--texte)", fontWeight:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.nom}</span>
                                  <span style={{ marginLeft:"auto", fontSize: "var(--t-9)", color:"var(--gris)" }}>Réf.</span>
                                </div>
                              );
                              return (
                                <button key={p.nom} onClick={()=>{ setPaysSelec(p.nom); setPaysComp(prev=>prev.filter(n=>n!==p.nom)); }}
                                  style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:"pointer", background:"transparent", textAlign:"left" as const, width:"100%" }}
                                  onMouseEnter={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background="var(--carte-douce)";}}
                                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`, background:sel?"var(--bleu-action)":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    
                                  </div>
                                  <span style={{ fontSize: "var(--t-12)", color:"var(--texte)", fontWeight:sel?700:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.nom}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {Object.keys(groupedPays).length===0&&<p style={{ fontSize: "var(--t-12)", color:"var(--gris)", textAlign:"center" as const, padding:"8px 0" }}>Aucun pays trouvé</p>}
                </div>
              </div>
              <div style={{ height:1, background:"var(--fond)", marginBottom:18 }}/>
              {/* Période */}
              <div style={{ marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                  <span style={{ fontSize: "var(--t-11)", fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
                </div>
                <div style={{ display:"flex", gap:3, background:"var(--fond)", borderRadius:9, padding:3, marginBottom:12 }}>
                  {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                    <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                      style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize: "var(--t-12)", fontWeight:600, background:modeAnnees===m.v?"var(--carte)":"transparent", color:modeAnnees===m.v?"var(--encre)":"var(--gris)", boxShadow:modeAnnees===m.v?"0 1px 4px rgb(var(--ombre-rgb) / 0.1)":"none", transition:"all 0.15s" }}>
                      {m.l}
                    </button>
                  ))}
                </div>
                {modeAnnees==="plage" ? (
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                    <div style={{ padding:"4px 0" }}>
                      <CurseurPlageNace min={borneMin} max={borneMax} debut={anneeMin} fin={anneeMax} ecartMin={1}
                        onChange={(d,f)=>{ setAnneeMin(d); setAnneeMax(f); }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize: "var(--t-11)", fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                      <span style={{ fontSize: "var(--t-10)", color:"var(--gris)" }}>—</span>
                      <span style={{ fontSize: "var(--t-11)", fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                    </div>
                    <p style={{ fontSize: "var(--t-11)", color:"var(--gris)", textAlign:"center" as const }}>{anneeMax-anneeMin+1} année{anneeMax-anneeMin+1>1?"s":""}</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:8 }}>
                      {Array.from({length:borneMax-borneMin+1},(_,i)=>borneMin+i).map(a=>{
                        const sel=anneesSpec.includes(a);
                        return (
                          <button key={a} onClick={()=>setAnneesSpec(prev=>sel?prev.filter(x=>x!==a):[...prev,a].sort())}
                            style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`, cursor:"pointer", fontSize: "var(--t-10)", fontWeight:sel?700:400, textAlign:"center" as const, background:sel?"var(--bleu-action)":"var(--carte-douce)", color:sel?"var(--sur-bleu)":"var(--texte)", transition:"all 0.1s" }}>
                            {a}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize: "var(--t-11)", color:"var(--texte)" }}>{anneesSpec.length>0?`${anneesSpec.length} année${anneesSpec.length>1?"s":""}`:""}</span>
                      {anneesSpec.length>0&&<button onClick={()=>setAnneesSpec([])} style={{ fontSize: "var(--t-11)", color:"var(--gris)", background:"none", border:"none", cursor:"pointer" }}>Effacer</button>}
                    </div>
                  </div>
                )}
              </div>
          </div>}
        </aside>

        {/* Zone principale */}
        <div style={{ flex:1, minWidth:0, overflowY:"auto" as const, overscrollBehavior:"contain" as const, padding:"36px 40px 80px" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:22 }}>
            <SousTypeNav value={sousType} onChange={setSousType}/>
            <BoutonDonnees onClick={()=>setShowTable(true)} dep={paysSelec}/>
          </div>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {(()=>{
                // Retrait d'un pays (✕) — il en reste toujours au moins un :
                // retirer le pays de référence promeut le premier comparé.
                const retirer = (nom: string) => {
                  if (nom === paysSelec) {
                    if (paysComp.length === 0) return;
                    setPaysSelec(paysComp[0]);
                    setPaysComp(prev => prev.slice(1));
                  } else {
                    setPaysComp(prev => prev.filter(n => n !== nom));
                  }
                };
                const BoutonX = ({ nom }: { nom: string }) => (
                  <button onClick={()=>retirer(nom)} aria-label={`Retirer ${nom}`}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", color:"inherit" }}>
                    <X size={11}/>
                  </button>
                );
                return estComparatif ? (
                  <>
                    {/* Tous les pays en pastilles badge, référence comprise */}
                    {paysAvecCouleur.map((p, i) => (
                      <BadgeSerie key={p.nom} i={i} couleur={p.couleur}>
                        {p.nom}
                        <BoutonX nom={p.nom}/>
                      </BadgeSerie>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:couleur, flexShrink:0 }} />
                    <h2 style={{ fontWeight:800, fontSize: "var(--t-r130)", color:"var(--encre)" }}>{paysSelec}</h2>
                  </>
                );
              })()}
              <BtnAjoutPaysComp
                paysDispo={paysDispo}
                exclus={[paysSelec, ...paysComp]}
                plein={paysComp.length>=3}
                onPick={nom=>setPaysComp(prev=>prev.includes(nom)||prev.length>=3?prev:[...prev,nom])}
                onOpenChange={setCompOpen}
              />
              <BadgePeriode>
                {modeAnnees==="specifiques"&&anneesSpec.length>0
                  ? `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length-1]}`
                  : `${perMin} — ${perMax}`}
              </BadgePeriode>
            </div>
          </div>

          {/* KPIs + graphes — floutés tant que le popover d'ajout de pays est ouvert */}
          <div style={{ filter: compOpen ? "blur(4px)" : "none", opacity: compOpen ? 0.6 : 1, pointerEvents: compOpen ? "none" : "auto", transition: "filter 0.2s, opacity 0.2s" }}>
          {/* KPI cards — 4 colonnes ; masquées en mode comparatif (les KPIs
              ne concernent que le pays de référence) */}
          {!estComparatif && <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
            {stCards ? stCards.map(c=>(
              <div key={c.label}
                style={{ background:"var(--carte)", borderRadius:14, padding:"13px 14px", border:"1px solid rgb(var(--encre-rgb) / 0.12)", boxShadow:"none", transition:"border-color 0.18s", minWidth:0 }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="rgb(var(--bleu-rgb) / 0.35)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgb(var(--encre-rgb) / 0.12)"; }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7, flexWrap:"wrap" as const }}>
                  <p style={{ fontSize: "var(--t-9)", fontWeight:800, letterSpacing:"0.1em", color:"var(--bleu)", textTransform:"uppercase" as const, lineHeight:1.4 }}>{c.label}</p>
                  {c.annee != null && <span style={{ fontSize: "var(--t-85)", fontWeight:700, color:"var(--gris)", background:"var(--bleu-voile)", padding:"1px 7px", borderRadius:4, lineHeight:1.5, flexShrink:0 }}>{c.annee}</span>}
                </div>
                <p style={{ fontSize: "var(--t-r110)", fontWeight:800, color:"var(--encre)", lineHeight:1 }}>{c.val}</p>
                <div style={{ marginTop:5, minHeight:12, display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" as const }}>
                  {c.delta != null && c.ref != null ? (
                    <Variation valeur={c.delta} annee={c.ref} taille={10} />
                  ) : (c.ind ? <p style={{ fontSize: "var(--t-10)", color:"var(--gris)", lineHeight:1 }}>{c.ind}</p> : null)}
                </div>
              </div>
            )) : <>
            <style>{STYLE_KPI_SWAP}</style>
            {kpisCards.map((k,slot)=>{
              const indicatif = getIndicatif(k);
              const { delta, ref } = getVariation(k);
              const pickerOuvert = pickerSlot === slot;
              return (
                <div key={k.id} className="kpi-card" {...carteCliquable(()=>setKpiActif(k))}
                  style={{ position:"relative", background:"var(--carte)", borderRadius:14, padding:"13px 14px", border:`1px solid ${pickerOuvert?"rgb(var(--bleu-rgb) / 0.35)":"rgb(var(--encre-rgb) / 0.12)"}`, cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"none", minWidth:0, zIndex:pickerOuvert?5:undefined }}
                  onMouseEnter={e=>{ e.currentTarget.style.boxShadow="var(--ombre-1)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.borderColor="rgb(var(--bleu-rgb) / 0.35)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor=pickerOuvert?"rgb(var(--bleu-rgb) / 0.35)":"rgb(var(--encre-rgb) / 0.12)"; }}>
                  {/* Remplacer ce KPI — icône révélée au survol de la card */}
                  <BtnSwapKpi ouvert={pickerOuvert} onClick={()=>setPickerSlot(pickerOuvert?-1:slot)}/>
                  {(()=>{ const { main, suffix } = splitKpiTitre(k.label); return (
                    <div style={{ marginBottom:7, paddingRight:26 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" as const }}>
                        <p style={{ fontSize: "var(--t-9)", fontWeight:800, letterSpacing:"0.1em", color:"var(--bleu)", textTransform:"uppercase" as const, lineHeight:1.4 }}>{main}</p>
                        {k.annee != null && <span style={{ fontSize: "var(--t-85)", fontWeight:700, color:"var(--gris)", background:"var(--bleu-voile)", padding:"1px 7px", borderRadius:4, lineHeight:1.5, flexShrink:0 }}>{k.annee}</span>}
                      </div>
                      {k.annee == null && suffix && <p style={{ fontSize: "var(--t-85)", fontWeight:600, letterSpacing:"0.06em", color:"var(--gris)", textTransform:"uppercase" as const, marginTop:2, lineHeight:1.3 }}>{suffix}</p>}
                    </div>
                  ); })()}
                  <p style={{ fontSize: "var(--t-r110)", fontWeight:800, color:"var(--encre)", lineHeight:1 }}>{fmtKpi(k)}</p>
                  <div style={{ marginTop:5, minHeight:12, display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" as const }}>
                    {delta != null && ref != null ? (
                    <Variation valeur={delta} annee={ref} taille={10} />
                  ) : (k.annee == null && indicatif ? <p style={{ fontSize: "var(--t-10)", color:"var(--gris)", lineHeight:1 }}>{indicatif}</p> : null)}
                  </div>
                  {pickerOuvert && (
                    <PickerKpi items={pickerItems} alignDroite={slot>=2}
                      onPick={id=>remplacerKpi(slot,id)} onClose={()=>setPickerSlot(-1)}/>
                  )}
                </div>
              );
            })}
            {Array.from({length:Math.max(0,4-kpisCards.length)}).map((_,i)=>{
              const slot = kpisCards.length + i;
              const pickerOuvert = pickerSlot === slot;
              return (
                <div key={`empty-${i}`} data-picker-trigger {...carteCliquable(()=>setPickerSlot(pickerOuvert?-1:slot), "Ajouter un indicateur")}
                  style={{ position:"relative", background:"var(--carte)", borderRadius:14, padding:"13px 14px", border:`1.5px dashed ${pickerOuvert?"var(--bleu)":"var(--bordure-forte)"}`, display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", gap:4, minHeight:90, cursor:"pointer", transition:"border-color 0.15s", zIndex:pickerOuvert?5:undefined }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--bleu)"; }}
                  onMouseLeave={e=>{ if(!pickerOuvert) e.currentTarget.style.borderColor="var(--bordure-forte)"; }}>
                  <span style={{ fontSize: "var(--t-20)", color:pickerOuvert?"var(--bleu)":"var(--gris)", lineHeight:1 }}>+</span>
                  <span style={{ fontSize: "var(--t-10)", color:pickerOuvert?"var(--bleu)":"var(--gris)", textAlign:"center" as const, lineHeight:1.5 }}>Ajouter un<br/>indicateur</span>
                  {pickerOuvert && (
                    <PickerKpi items={pickerItems} alignDroite={slot>=2}
                      onPick={id=>remplacerKpi(slot,id)} onClose={()=>setPickerSlot(-1)}/>
                  )}
                </div>
              );
            })}
            </>}
          </div>}

          {/* Graphes — multi-séries dès qu'un pays est ajouté à la comparaison ;
              floutés tant qu'un picker de remplacement de KPI est ouvert */}
          <div style={{ filter: pickerSlot!==-1 ? "blur(4px)" : "none", opacity: pickerSlot!==-1 ? 0.6 : 1, pointerEvents: pickerSlot!==-1 ? "none" : "auto", transition: "filter 0.2s, opacity 0.2s" }}>
          {loading ? (
            <SkeletonChartGrid n={4} cols={2} height={230}/>
          ) : erreur ? (
            <ErreurChargement onRetry={() => qCnuced.refetch()} />
          ) : (
            <div className="charge-in" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
              {GRAPHES_PAYS.map(g=>{
                // Greenfield / M&A hors comparatif : les « nombres de projets »
                // s'affichent en tableau explorable (curseur + épinglage)
                if (stActif && g.unite === "nombre" && !estComparatif)
                  return <CarteTableauAnnees key={`${g.id}-${paysSelec}`} titre={g.titre}
                    rows={(g.series[0]?.data || []).map((d: any) => ({ annee: d.annee, valeur: d.valeur }))}/>;
                // En comparatif : tableau par pays (Cumul ⇆ année au curseur)
                if (stActif && g.unite === "nombre" && estComparatif)
                  return <CarteTableauComparatif key={`${g.id}-${paysAvecCouleur.map(p=>p.nom).join(",")}`} titre={g.titre} series={g.series}/>;
                return (
                <GrapheCard key={g.id} titre={g.titre} unite={g.unite==="nombre"?"Nombre":"M$ USD"} source="CNUCED" series={g.series} grapheId={g.id} hideLegend hideSousTitre
                  fullChildren={<GrapheMultiPays series={g.series} height={340} type={g.unite==="nombre"?"bar":"line"} titre={g.id} lineWidth={estComparatif?1.6:undefined} fmt={g.unite==="nombre"?fmtNombre:undefined}/>}>
                  <GrapheMultiPays series={g.series} height={145} type={g.unite==="nombre"?"bar":"line"} titre={g.id} showDots={!estComparatif} lineWidth={estComparatif?1.4:undefined} fmt={g.unite==="nombre"?fmtNombre:undefined}/>
                </GrapheCard>
                );
              })}
              {grapheExtras && <>
                {/* Soldes nets : entrants − sortants, pour les flux puis les stocks */}
                <GrapheCard titre="Flux nets des IDE" unite="M$ USD" source="CNUCED" series={grapheExtras.serieNet} grapheId="fluxstock-net" hideLegend hideSousTitre
                  fullChildren={<GrapheMultiPays series={grapheExtras.serieNet} height={340}/>}>
                  <GrapheMultiPays series={grapheExtras.serieNet} height={145}/>
                </GrapheCard>
                {grapheExtras.serieStockNet && (
                  <GrapheCard titre="Stocks nets des IDE" unite="M$ USD" source="CNUCED" series={grapheExtras.serieStockNet} grapheId="fluxstock-stocknet" hideLegend hideSousTitre
                    fullChildren={<GrapheMultiPays series={grapheExtras.serieStockNet} height={340}/>}>
                    <GrapheMultiPays series={grapheExtras.serieStockNet} height={145}/>
                  </GrapheCard>
                )}
                {/* Top 10 des années par flux entrants */}
                <GrapheCard titre="Top 10 des années · flux entrants" unite="M$ USD" source="CNUCED" series={grapheExtras.serieTop} grapheId="fluxstock-top10" hideLegend hideSousTitre
                  fullChildren={<TopAnneesFlux rows={grapheExtras.top10} grand/>}>
                  <TopAnneesFlux rows={grapheExtras.top10}/>
                </GrapheCard>
                {grapheExtras.top10S && (
                  <GrapheCard titre="Top 10 des années · flux sortants" unite="M$ USD" source="CNUCED" series={grapheExtras.serieTopS} grapheId="fluxstock-top10-sortants" hideLegend hideSousTitre
                    fullChildren={<TopAnneesFlux rows={grapheExtras.top10S} grand/>}>
                    <TopAnneesFlux rows={grapheExtras.top10S}/>
                  </GrapheCard>
                )}
              </>}
            </div>
          )}
          </div>
          </div>
        </div>
      </div>

      <ModalDonnees open={showTable} onClose={()=>setShowTable(false)} donnees={donnees} paysSelectionnes={paysAvecCouleur} sousType={sousType} />
      <MiniModalKpi kpi={kpiActif} pays={paysSelec} couleur={couleur} onClose={()=>setKpiActif(null)} />
    </div>
  );
}

export default OngletPays;
