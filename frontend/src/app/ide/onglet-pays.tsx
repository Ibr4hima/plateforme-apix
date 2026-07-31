"use client";

import NavActions from "@/components/layout/NavActions";
import GrapheSignature from "@/components/shared/GrapheMultiPays";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import { d3, useD3Pret } from "@/lib/d3lazy";
import { COMP_PALETTE, badge_bleu, badge_orange, badge_vert, badge_violet, badge_gris, badgeDe } from "@/lib/couleurs";
import { X, Plus, Table, ChevronDown, ChevronUp, ChevronRight, SlidersHorizontal, Search, FileSpreadsheet, Pin } from "lucide-react";
import { calculerKpis, fmtKpi, KPI_DEFAUT, type KpiResult } from "@/lib/ideKpis";
import { SkeletonChartGrid, SkeletonRows } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fmtMillionsUSD, fmtAxe } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardIde";
import PickerKpi, { BtnSwapKpi, IconeCached, STYLE_KPI_SWAP, type PickerItem } from "@/components/shared/PickerKpi";
import { HBarChart } from "@/components/charts/HBarChart";
import { DivergingBars } from "@/components/charts/DivergingBars";
import { ACCENT_BLEU, AccentNace, accentDe, CurseurAnneeNace, CurseurPlageNace,
  StylesCurseurNace, pastilleCurseur, varsAccent } from "@/components/shared/CurseurNace";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { API, PAYS_COLORS, PALETTE, getPaysColor, fmtVal, BADGES_4, BadgePeriode, BadgeSerie, SERIES_TYPES, fmtNombre, SOUS_TYPE_NAV, SelecteurVueAnalyse, BtnAjoutPaysComp, BtnAjoutGroupement, SousTypeNav, ANNEE_MIN, ANNEE_MAX, useBornesCnuced, GrapheMultiPays, TopAnneesFlux, CarteTableauAnnees, CarteTableauComparatif, ModalDonnees, KPI_25_IDS, interpreterKpi, splitKpiTitre, MiniModalKpi, CONT_ORDER, sortContinents, groupByContinent, splitKpiLabel, BoutonDonnees, BdefRow, BDEF_NIVEAU_STYLE, BDEF_NIVEAU_LABEL } from "./partage";

function OngletPays({ paysDispo, showTable, setShowTable, sousOnglet, setSousOnglet, sousType, setSousType, vueP, setVueP }: { paysDispo: any[]; showTable: boolean; setShowTable: (v:boolean)=>void; sousOnglet: string; setSousOnglet: (v:"pays"|"comparative"|"monde")=>void; sousType: string; setSousType: (v:"fluxstock"|"greenfield"|"fusion")=>void; vueP: string; setVueP: (v:"pays"|"secteurs")=>void }) {
  const [paysSelec,   setPaysSelec]   = useState<string>("Sénégal");
  // Pays ajoutés via le « + » de l'en-tête (3 max) : dès qu'il y en a un, la
  // vue bascule en analyse comparative (graphes multi-séries, KPIs masqués)
  const [paysComp,    setPaysComp]    = useState<string[]>([]);
  // Popover d'ajout ouvert → le contenu (KPIs + graphes) est flouté derrière
  const [compOpen,    setCompOpen]    = useState(false);
  const [donnees,     setDonnees]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
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

  const couleur = "#004f91";

  // Chargement principal : en cas d'échec, état d'erreur avec relance (tick)
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);
  const charger = useCallback(async () => {
    setLoading(true); setErreur(false);
    try {
      const params = new URLSearchParams({ pays_list: [paysSelec, ...paysComp].join(",") });
      if (modeAnnees==="specifiques" && anneesSpecD.length>0) params.set("annees", anneesSpecD.join(","));
      else { params.set("annee_min", String(anneeMinD)); params.set("annee_max", String(anneeMaxD)); }
      const dataR = await fetch(`${API}/ide/cnuced?${params}`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); });
      setDonnees(dataR||[]);
    } catch(e){ console.error(e); setErreur(true); }
    finally { setLoading(false); }
  }, [paysSelec, paysComp, anneeMinD, anneeMaxD, anneesSpecD, modeAnnees, tick]);

  useEffect(() => { charger(); }, [charger]);

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

  // Graphes d'analyse des flux (vue Pays, flux & stocks, hors comparatif) :
  // flux nets et top 10 des années par flux entrants — pays de référence.
  const grapheExtras = (!stActif && !estComparatif) ? (() => {
    const fluxDe = (dir: string) => donneesRef
      .filter((d: any) => d.direction === dir && d.indicateur === "flux" && d.valeur !== null)
      .sort((a: any, b: any) => a.annee - b.annee) as { annee: number; valeur: number }[];
    const rowsE = fluxDe("entrant"), rowsS = fluxDe("sortant");
    if (!rowsE.length) return null;
    const parAnneeS = new Map(rowsS.map(r => [r.annee, r.valeur]));
    const net = rowsE.filter(r => parAnneeS.has(r.annee))
      .map(r => ({ annee: r.annee, valeur: r.valeur - (parAnneeS.get(r.annee) as number) }));
    const serieNet = [{ nom: "Flux nets", couleur: "#004f91", data: net }];
    const top10 = [...rowsE].sort((a, b) => b.valeur - a.valeur).slice(0, 10);
    const serieTop = [{ nom: "Flux entrants", couleur: "#004f91", data: top10 }];
    return { serieNet, top10, serieTop };
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
    <div style={{ display:"flex", alignItems:"flex-start" }}>

        {/* Sidebar bande */}
        <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"#fff", borderRight:"1px solid #E8E5E3", height:"100vh", overflowY:"auto" as const, position:"sticky" as const, top:0, display:"flex", flexDirection:"column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
          {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent", transition:"background 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
          <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid #F2F0EF", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
            {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <button onClick={()=>setSidebarOpen(o=>!o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
                <SlidersHorizontal size={14} style={{ color:"#004f91" }}/>
                {sidebarOpen&&nbFiltres>0&&<span style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.15)", borderRadius:999, padding:"1px 5px" }}>{nbFiltres}</span>}
              </button>
              {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser" style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
                <span className="material-symbols-outlined" style={{ fontSize:15, color:"#dc2626", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
              </button>}
            </div>
          </div>
          {sidebarOpen&&<div style={{ padding:"16px", overflowY:"auto" as const, flex:1 }}>
              {/* Sélecteurs Vue + Type d'analyse */}
              <SelecteurVueAnalyse vueP={vueP} setVueP={setVueP} typeAnalyse={sousOnglet} setTypeAnalyse={setSousOnglet}/>
              <div style={{ position:"relative" as const, marginBottom:18 }}>
                <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }}/>
                <input value={searchPays} onChange={e=>setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
                  style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", fontSize:12, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
                {searchPays&&<button onClick={()=>setSearchPays("")} aria-label="Effacer la recherche" style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"#9aa5b4" }}/></button>}
              </div>
              <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
              {/* Pays */}
              <div style={{ marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Pays</span>
                  <span style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.18)", padding:"1px 6px", borderRadius:999 }}>1</span>
                </div>
                {/* Sénégal épinglé */}
                {(()=>{
                  const sel = paysSelec==="Sénégal";
                  const col = "#004f91";
                  return (
                    <div style={{ marginBottom:8, marginLeft:6 }}>
                      <button onClick={()=>{ setPaysSelec("Sénégal"); setPaysComp(prev=>prev.filter(n=>n!=="Sénégal")); }}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:"pointer", background:"transparent", textAlign:"left" as const, width:"100%" }}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#F8F7F6";}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                        <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?"#004f91":"#C5BFBB"}`, background:sel?"#004f91":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          
                        </div>
                        <span style={{ fontSize:12, color:"#4a5568", fontWeight:sel?700:400 }}>Sénégal</span>
                        <span style={{ marginLeft:"auto", fontSize:9, color:"#9aa5b4", fontWeight:600, background:"#F2F0EF", padding:"1px 5px", borderRadius:4 }}>Réf.</span>
                      </button>
                    </div>
                  );
                })()}
                <div style={{ height:1, background:"#F2F0EF", marginBottom:8 }}/>
                <div style={{ maxHeight:200, overflowY:"auto" as const }}>
                  {sortContinents(Object.keys(groupedPays)).map(continent => {
                    const isOpen = openConts.has(continent);
                    const zones  = groupedPays[continent];
                    return (
                      <div key={continent} style={{ marginBottom:6 }}>
                        <button onClick={()=>toggleCont(continent)}
                          style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 8px", borderRadius:7, background:"rgba(0,79,145,0.04)", border:"none", cursor:"pointer", marginBottom:3 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:"#004f91", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{continent}</span>
                          <ChevronDown size={11} style={{ color:"#004f91", transform:isOpen?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
                        </button>
                        {isOpen&&Object.entries(zones).sort(([a],[b])=>a.localeCompare(b,"fr")).map(([zone,paysInZone]) => (
                          <div key={zone} style={{ marginLeft:6, marginBottom:4 }}>
                            <p style={{ fontSize:9, fontWeight:600, color:"#C5BFBB", textTransform:"uppercase" as const, letterSpacing:"0.1em", padding:"2px 8px", marginBottom:2 }}>{zone}</p>
                            {(paysInZone as any[]).map((p:any) => {
                              const sel = paysSelec === p.nom;
                              if (p.nom==="Sénégal") return (
                                <div key={p.nom} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, width:"100%", opacity:0.35, cursor:"not-allowed" as const }}>
                                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?"#004f91":"#C5BFBB"}`, background:sel?"#004f91":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    
                                  </div>
                                  <span style={{ fontSize:12, color:"#4a5568", fontWeight:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.nom}</span>
                                  <span style={{ marginLeft:"auto", fontSize:9, color:"#9aa5b4" }}>Réf.</span>
                                </div>
                              );
                              return (
                                <button key={p.nom} onClick={()=>{ setPaysSelec(p.nom); setPaysComp(prev=>prev.filter(n=>n!==p.nom)); }}
                                  style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:"pointer", background:"transparent", textAlign:"left" as const, width:"100%" }}
                                  onMouseEnter={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background="#F8F7F6";}}
                                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?"#004f91":"#C5BFBB"}`, background:sel?"#004f91":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    
                                  </div>
                                  <span style={{ fontSize:12, color:"#4a5568", fontWeight:sel?700:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{p.nom}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {Object.keys(groupedPays).length===0&&<p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center" as const, padding:"8px 0" }}>Aucun pays trouvé</p>}
                </div>
              </div>
              <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>
              {/* Période */}
              <div style={{ marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
                </div>
                <div style={{ display:"flex", gap:3, background:"#F2F0EF", borderRadius:9, padding:3, marginBottom:12 }}>
                  {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                    <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                      style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"#fff":"transparent", color:modeAnnees===m.v?"#1a1a2e":"#9aa5b4", boxShadow:modeAnnees===m.v?"0 1px 4px rgba(0,0,0,0.1)":"none", transition:"all 0.15s" }}>
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
                      <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                      <span style={{ fontSize:10, color:"#9aa5b4" }}>—</span>
                      <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                    </div>
                    <p style={{ fontSize:11, color:"#9aa5b4", textAlign:"center" as const }}>{anneeMax-anneeMin+1} année{anneeMax-anneeMin+1>1?"s":""}</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:8 }}>
                      {Array.from({length:borneMax-borneMin+1},(_,i)=>borneMin+i).map(a=>{
                        const sel=anneesSpec.includes(a);
                        return (
                          <button key={a} onClick={()=>setAnneesSpec(prev=>sel?prev.filter(x=>x!==a):[...prev,a].sort())}
                            style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${sel?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:10, fontWeight:sel?700:400, textAlign:"center" as const, background:sel?"#004f91":"#F8F7F6", color:sel?"#fff":"#4a5568", transition:"all 0.1s" }}>
                            {a}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:11, color:"#4a5568" }}>{anneesSpec.length>0?`${anneesSpec.length} année${anneesSpec.length>1?"s":""}`:""}</span>
                      {anneesSpec.length>0&&<button onClick={()=>setAnneesSpec([])} style={{ fontSize:11, color:"#9aa5b4", background:"none", border:"none", cursor:"pointer" }}>Effacer</button>}
                    </div>
                  </div>
                )}
              </div>
          </div>}
        </aside>

        {/* Zone principale */}
        <div style={{ flex:1, minWidth:0, padding:"36px 40px 80px" }}>
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
                    <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"#1a1a2e" }}>{paysSelec}</h2>
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
                style={{ background:"#fff", borderRadius:14, padding:"13px 14px", border:"1px solid rgba(16,26,46,0.12)", boxShadow:"none", transition:"border-color 0.18s", minWidth:0 }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="rgba(0,79,145,0.35)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgba(16,26,46,0.12)"; }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7, flexWrap:"wrap" as const }}>
                  <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"#004f91", textTransform:"uppercase" as const, lineHeight:1.4 }}>{c.label}</p>
                  {c.annee != null && <span style={{ fontSize:8.5, fontWeight:700, color:"#8a93a3", background:"#EEF1F6", padding:"1px 7px", borderRadius:4, lineHeight:1.5, flexShrink:0 }}>{c.annee}</span>}
                </div>
                <p style={{ fontSize:"1.15rem", fontWeight:800, color:"#1a1a2e", lineHeight:1 }}>{c.val}</p>
                <div style={{ marginTop:5, minHeight:12, display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" as const }}>
                  {c.delta != null && c.ref != null ? (<>
                    <span style={{ fontSize:10, fontWeight:800, color:c.delta>0?"#188038":c.delta<0?"#dc2626":"#9aa5b4", whiteSpace:"nowrap" as const }}>{c.delta>0?"▲":c.delta<0?"▼":"="}&nbsp;{Math.abs(c.delta).toLocaleString("fr-FR",{maximumFractionDigits:1})}&nbsp;%</span>
                    <span style={{ fontSize:9.5, color:"#9aa5b4", whiteSpace:"nowrap" as const }}>par rapport à {c.ref}</span>
                  </>) : (c.ind ? <p style={{ fontSize:10, color:"#9aa5b4", lineHeight:1 }}>{c.ind}</p> : null)}
                </div>
              </div>
            )) : <>
            <style>{STYLE_KPI_SWAP}</style>
            {kpisCards.map((k,slot)=>{
              const indicatif = getIndicatif(k);
              const { delta, ref } = getVariation(k);
              const pickerOuvert = pickerSlot === slot;
              return (
                <div key={k.id} className="kpi-card" onClick={()=>setKpiActif(k)}
                  style={{ position:"relative", background:"#fff", borderRadius:14, padding:"13px 14px", border:`1px solid ${pickerOuvert?"rgba(0,79,145,0.35)":"rgba(16,26,46,0.12)"}`, cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"none", minWidth:0, zIndex:pickerOuvert?5:undefined }}
                  onMouseEnter={e=>{ e.currentTarget.style.boxShadow="var(--ombre-1)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.borderColor="rgba(0,79,145,0.35)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor=pickerOuvert?"rgba(0,79,145,0.35)":"rgba(16,26,46,0.12)"; }}>
                  {/* Remplacer ce KPI — icône révélée au survol de la card */}
                  <BtnSwapKpi ouvert={pickerOuvert} onClick={()=>setPickerSlot(pickerOuvert?-1:slot)}/>
                  {(()=>{ const { main, suffix } = splitKpiTitre(k.label); return (
                    <div style={{ marginBottom:7, paddingRight:26 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" as const }}>
                        <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"#004f91", textTransform:"uppercase" as const, lineHeight:1.4 }}>{main}</p>
                        {k.annee != null && <span style={{ fontSize:8.5, fontWeight:700, color:"#8a93a3", background:"#EEF1F6", padding:"1px 7px", borderRadius:4, lineHeight:1.5, flexShrink:0 }}>{k.annee}</span>}
                      </div>
                      {k.annee == null && suffix && <p style={{ fontSize:8.5, fontWeight:600, letterSpacing:"0.06em", color:"#9aa5b4", textTransform:"uppercase" as const, marginTop:2, lineHeight:1.3 }}>{suffix}</p>}
                    </div>
                  ); })()}
                  <p style={{ fontSize:"1.15rem", fontWeight:800, color:"#1a1a2e", lineHeight:1 }}>{fmtKpi(k)}</p>
                  <div style={{ marginTop:5, minHeight:12, display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" as const }}>
                    {delta != null && ref != null ? (<>
                      <span style={{ fontSize:10, fontWeight:800, color:delta>0?"#188038":delta<0?"#dc2626":"#9aa5b4", whiteSpace:"nowrap" as const }}>{delta>0?"▲":delta<0?"▼":"="}&nbsp;{Math.abs(delta).toLocaleString("fr-FR",{maximumFractionDigits:1})}&nbsp;%</span>
                      <span style={{ fontSize:9.5, color:"#9aa5b4", whiteSpace:"nowrap" as const }}>par rapport à {ref}</span>
                    </>) : (k.annee == null && indicatif ? <p style={{ fontSize:10, color:"#9aa5b4", lineHeight:1 }}>{indicatif}</p> : null)}
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
                <div key={`empty-${i}`} data-picker-trigger onClick={()=>setPickerSlot(pickerOuvert?-1:slot)}
                  style={{ position:"relative", background:"#fff", borderRadius:14, padding:"13px 14px", border:`1.5px dashed ${pickerOuvert?"#004f91":"#E8E5E3"}`, display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", gap:4, minHeight:90, cursor:"pointer", transition:"border-color 0.15s", zIndex:pickerOuvert?5:undefined }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="#004f91"; }}
                  onMouseLeave={e=>{ if(!pickerOuvert) e.currentTarget.style.borderColor="#E8E5E3"; }}>
                  <span style={{ fontSize:20, color:pickerOuvert?"#004f91":"#C5BFBB", lineHeight:1 }}>+</span>
                  <span style={{ fontSize:10, color:pickerOuvert?"#004f91":"#C5BFBB", textAlign:"center" as const, lineHeight:1.5 }}>Ajouter un<br/>indicateur</span>
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
            <ErreurChargement onRetry={() => setTick(t => t + 1)} />
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
                <GrapheCard key={g.id} titre={g.titre} sous_titre={`${g.unite==="nombre"?"Nombre":"M$ USD"} · CNUCED · ${perMin}–${perMax}`} series={g.series} grapheId={g.id} hideLegend hideSousTitre
                  fullChildren={<GrapheMultiPays series={g.series} height={340} type={g.unite==="nombre"?"bar":"line"} titre={g.id} lineWidth={estComparatif?1.6:undefined} fmt={g.unite==="nombre"?fmtNombre:undefined}/>}>
                  <GrapheMultiPays series={g.series} height={145} type={g.unite==="nombre"?"bar":"line"} titre={g.id} showDots={!estComparatif} lineWidth={estComparatif?1.4:undefined} fmt={g.unite==="nombre"?fmtNombre:undefined}/>
                </GrapheCard>
                );
              })}
              {grapheExtras && <>
                {/* Flux nets = entrants − sortants */}
                <GrapheCard titre="Flux nets des IDE · entrants − sortants" sous_titre={`M$ USD · CNUCED · ${perMin}–${perMax}`} series={grapheExtras.serieNet} grapheId="fluxstock-net" hideLegend hideSousTitre
                  fullChildren={<GrapheMultiPays series={grapheExtras.serieNet} height={340}/>}>
                  <GrapheMultiPays series={grapheExtras.serieNet} height={145}/>
                </GrapheCard>
                {/* Top 10 des années par flux entrants */}
                <GrapheCard titre="Top 10 des années · flux entrants" sous_titre={`M$ USD · CNUCED · ${perMin}–${perMax}`} series={grapheExtras.serieTop} grapheId="fluxstock-top10" hideLegend hideSousTitre
                  fullChildren={<TopAnneesFlux rows={grapheExtras.top10} grand/>}>
                  <TopAnneesFlux rows={grapheExtras.top10}/>
                </GrapheCard>
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
