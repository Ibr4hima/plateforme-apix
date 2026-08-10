"use client";
import { useEffect, useRef, useState } from "react";
import { COMP_PALETTE } from "@/lib/couleurs";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardIde";
import { CurseurPlageNace } from "@/components/shared/CurseurNace";
import { API, fmtVal, BadgePeriode, BadgeSerie, SERIES_TYPES, fmtNombre, SelecteurVueAnalyse, SousTypeNav, ANNEE_MIN, ANNEE_MAX, GrapheMultiPays, CarteTableauAnnees, CarteTableauComparatif, ModalDonnees, BoutonDonnees, BdefRow } from "./partage";
import Variation from "@/components/shared/Variation";


// ── Vue Secteurs (analyse sectorielle CNUCED) ─────────────────────────────────
// Greenfield (Annex 15/18, direction « total ») et M&A (Annex 09-12, ventes /
// achats) par secteur ou branche. Les données sont chargées en une fois puis
// filtrées côté client (référentiel : ~65 lignes, séries : quelques milliers).
const SECTEUR_NAV = [
  { v: "greenfield", l: "Greenfield" },
  { v: "fusion",     l: "Fusion & Acquisition" },
] as const;

function OngletSecteurs({ showTable, setShowTable, sousType, setSousType, vueP, setVueP, typeAnalyse, setTypeAnalyse, setSousOnglet }: {
  showTable: boolean; setShowTable: (v:boolean)=>void;
  sousType: string; setSousType: (v:"fluxstock"|"greenfield"|"fusion")=>void;
  vueP: string; setVueP: (v:"pays"|"secteurs")=>void;
  typeAnalyse: string; setTypeAnalyse: (v:"secteur"|"comparative")=>void;
  setSousOnglet: (v:"pays"|"comparative"|"monde")=>void;
}) {
  // Flux & Stocks n'existe pas par secteur : la vue force greenfield par défaut
  const st = sousType === "fusion" ? "fusion" : "greenfield";
  useEffect(() => { if (sousType === "fluxstock") setSousType("greenfield"); }, [sousType, setSousType]);

  const [refSecteurs, setRefSecteurs] = useState<any[]>([]);
  const [donnees,     setDonnees]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [erreur,      setErreur]      = useState(false);
  const [tick,        setTick]        = useState(0);
  // id 0 = « Global des secteurs » (agrégat des 3 grands secteurs)
  const [selecIds,    setSelecIds]    = useState<number[]>([0]);
  const [openSecs,    setOpenSecs]    = useState<Set<number>>(new Set());
  // Comparative : niveau comparé (secteurs entre eux ou branches entre elles)
  const [compNiveau,  setCompNiveau]  = useState<"secteur"|"branche">("secteur");
  const [compCatOuverts, setCompCatOuverts] = useState<Set<number>>(new Set());
  const toggleCompCat = (id: number) => setCompCatOuverts(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [modeAnnees,  setModeAnnees]  = useState<"plage"|"specifiques">("plage");
  const [anneesSpec,  setAnneesSpec]  = useState<number[]>([]);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 520);

  // Référentiel + séries en un seul chargement (filtrage ensuite côté client)
  useEffect(() => {
    let actif = true;
    (async () => {
      setLoading(true); setErreur(false);
      try {
        const [ref, rows] = await Promise.all([
          fetch(`${API}/ide/secteurs`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
          fetch(`${API}/ide/cnuced-secteurs`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        ]);
        if (!actif) return;
        setRefSecteurs(ref || []);
        setDonnees(rows || []);
      } catch (e) { console.error(e); if (actif) setErreur(true); }
      finally { if (actif) setLoading(false); }
    })();
    return () => { actif = false; };
  }, [tick]);

  // Analyse par secteur = sélection unique (Global par défaut) ;
  // comparative = jusqu'à 4 secteurs/branches (les 3 grands secteurs par défaut)
  useEffect(() => {
    if (typeAnalyse === "secteur") setSelecIds(prev => prev.length > 1 ? [prev[0]] : prev);
    else { setCompNiveau("secteur"); setSelecIds(prev => prev.includes(0) ? [1, 2, 3] : prev); }
  }, [typeAnalyse]);
  const toggleSecteur = (id: number) => {
    if (typeAnalyse === "secteur") { setSelecIds([id]); return; }
    setSelecIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 4 ? prev : [...prev, id]);
  };
  const toggleOpen = (id: number) => setOpenSecs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const nomById = new Map<number, string>();
  nomById.set(0, "Global des secteurs");
  refSecteurs.forEach((s: any) => { nomById.set(s.id, s.nom_fr); (s.branches || []).forEach((b: any) => nomById.set(b.id, b.nom_fr)); });

  // Niveau sélectionné (analyse par secteur) : l'accent du panneau de droite
  // suit la couleur de la puce (secteur = bleu, branche = orange)
  const topIds = new Set(refSecteurs.map((s: any) => s.id));
  const niveauSel = selecIds[0] === 0 ? "global" : topIds.has(selecIds[0]) ? "secteur" : "branche";
  const accent = niveauSel === "branche" ? "var(--orange)" : "var(--bleu)";
  const couleurDe = (i: number) => typeAnalyse === "secteur" ? accent : COMP_PALETTE[i % COMP_PALETTE.length];

  // Bornes réelles de la catégorie active (greenfield : ~2003+, M&A : 1990+)
  const prefix  = st === "greenfield" ? "greenfield" : "ma_";
  const rowsCat = donnees.filter((d: any) => d.indicateur.startsWith(prefix) && d.valeur !== null);
  let borneMin = ANNEE_MIN, borneMax = ANNEE_MAX;
  if (rowsCat.length) {
    borneMin = rowsCat[0].annee; borneMax = rowsCat[0].annee;
    rowsCat.forEach((d: any) => { if (d.annee < borneMin) borneMin = d.annee; if (d.annee > borneMax) borneMax = d.annee; });
  }
  const [anneeMin, setAnneeMin] = useState(borneMin);
  const [anneeMax, setAnneeMax] = useState(borneMax);
  useEffect(() => { setAnneeMin(borneMin); setAnneeMax(borneMax); }, [borneMin, borneMax]);

  const enPeriode = (a: number) => modeAnnees === "specifiques" && anneesSpec.length > 0 ? anneesSpec.includes(a) : a >= anneeMin && a <= anneeMax;
  // Lignes d'un id sélectionné — le Global (id 0) agrège les 3 grands secteurs
  const rowsPour = (id: number) => {
    if (id !== 0) return rowsCat.filter((d: any) => d.secteur_id === id && enPeriode(d.annee));
    const agg = new Map<string, any>();
    rowsCat.forEach((d: any) => {
      if (![1, 2, 3].includes(d.secteur_id) || !enPeriode(d.annee)) return;
      const k = `${d.annee}|${d.direction}|${d.indicateur}`;
      const cur = agg.get(k);
      if (cur) cur.valeur += d.valeur;
      else agg.set(k, { secteur_id: 0, secteur: "Global des secteurs", annee: d.annee, direction: d.direction, indicateur: d.indicateur, valeur: d.valeur });
    });
    return [...agg.values()];
  };
  const rowsSel = selecIds.flatMap(rowsPour);

  // Période réellement couverte par la sélection (pastille grise)
  let perMin = anneeMin, perMax = anneeMax;
  if (rowsSel.length) {
    perMin = rowsSel[0].annee; perMax = rowsSel[0].annee;
    rowsSel.forEach((d: any) => { if (d.annee < perMin) perMin = d.annee; if (d.annee > perMax) perMax = d.annee; });
  }

  const SERIES = SERIES_TYPES[`secteur_${st}`];
  const GRAPHES = SERIES.map((s, i) => ({
    id: `secteur-${st}-${i}`, titre: s.label, unite: s.unite,
    series: selecIds.map((id, ci) => ({
      nom: nomById.get(id) || "?", couleur: couleurDe(ci),
      data: rowsSel
        .filter((d: any) => d.secteur_id === id && d.direction === s.dir && d.indicateur === s.ind)
        .map((d: any) => ({ annee: d.annee, valeur: d.valeur }))
        .sort((a: any, b: any) => a.annee - b.annee),
    })),
  }));

  // KPIs (analyse par secteur) — part du total = poids dans la somme des 3
  // grands secteurs (Primaire + Manufacturier + Services) la même année
  const stCards = (() => {
    if (typeAnalyse !== "secteur" || !selecIds.length) return null;
    const sid = selecIds[0];
    const serie = (dir: string, ind: string) => rowsSel
      .filter((d: any) => d.secteur_id === sid && d.direction === dir && d.indicateur === ind)
      .sort((a: any, b: any) => a.annee - b.annee);
    const last = (rs: any[]) => rs.length ? rs[rs.length - 1] : null;
    // Δ % du dernier point vs le précédent de la même série
    const deltaDe = (rs: any[]) => {
      const l = last(rs), p = rs.length > 1 ? rs[rs.length - 2] : null;
      return l && p && p.valeur ? { delta: ((l.valeur - p.valeur) / Math.abs(p.valeur)) * 100, ref: p.annee } : { delta: null, ref: null };
    };
    const dirV = st === "greenfield" ? "total" : "entrant";
    const indV = st === "greenfield" ? "greenfield_valeur" : "ma_valeur";
    const indN = st === "greenfield" ? "greenfield_nombre" : "ma_nombre";
    const sV = serie(dirV, indV);
    const vD = last(sV);
    const nD = last(serie(dirV, indN));
    const part = (() => {
      if (!vD || sid === 0) return null;
      let total = 0, trouve = false;
      rowsCat.forEach((d: any) => {
        if ([1, 2, 3].includes(d.secteur_id) && d.annee === vD.annee && d.direction === dirV && d.indicateur === indV) { total += d.valeur; trouve = true; }
      });
      return trouve && total !== 0 ? (vD.valeur / total) * 100 : null;
    })();
    // Vue globale : le poids dans le total n'a pas de sens → secteur dominant
    const dominant = (() => {
      if (sid !== 0 || !vD) return null;
      const NOMS_COURTS: Record<number, string> = { 1: "Primaire", 2: "Manufacturier", 3: "Services" };
      let best: { id: number; v: number } | null = null, total = 0;
      rowsCat.forEach((d: any) => {
        if (![1, 2, 3].includes(d.secteur_id) || d.annee !== vD.annee || d.direction !== dirV || d.indicateur !== indV) return;
        total += d.valeur;
        if (!best || d.valeur > best.v) best = { id: d.secteur_id, v: d.valeur };
      });
      if (!best) return null;
      const b = best as { id: number; v: number };
      return { nom: NOMS_COURTS[b.id], part: total !== 0 ? (b.v / total) * 100 : null, annee: vD.annee };
    })();
    const gf = st === "greenfield";
    const vSf = !gf ? last(rowsSel.filter((d: any) => d.secteur_id === sid && d.direction === "sortant" && d.indicateur === "ma_valeur").sort((a: any, b: any) => a.annee - b.annee)) : null;
    const moy5 = (() => {
      const rs = sV.slice(-5);
      return rs.length ? rs.reduce((acc: number, r: any) => acc + r.valeur, 0) / rs.length : null;
    })();
    const sN = serie(dirV, indN);
    const sSf = !gf ? rowsSel.filter((d: any) => d.secteur_id === sid && d.direction === "sortant" && d.indicateur === "ma_valeur").sort((a: any, b: any) => a.annee - b.annee) : [];
    const dV = deltaDe(sV), dN = deltaDe(sN), dSf = deltaDe(sSf);
    return [
      { label: gf ? "Valeur des projets annoncés" : "Ventes nettes", val: vD ? fmtVal(vD.valeur) : "N/A", annee: vD?.annee ?? null, delta: dV.delta, ref: dV.ref, ind: null as string | null },
      gf
        ? { label: "Nombre de projets annoncés", val: nD ? fmtNombre(nD.valeur) : "N/A", annee: nD?.annee ?? null, delta: dN.delta, ref: dN.ref, ind: null }
        : { label: "Achats nets", val: vSf ? fmtVal(vSf.valeur) : "N/A", annee: vSf?.annee ?? null, delta: dSf.delta, ref: dSf.ref, ind: null },
      gf
        ? { label: "Moyenne 5 ans · valeur", val: moy5 !== null ? fmtVal(moy5) : "N/A", annee: null, delta: null, ref: null, ind: "5 dernières années" }
        : { label: "Nombre de ventes", val: nD ? fmtNombre(nD.valeur) : "N/A", annee: nD?.annee ?? null, delta: dN.delta, ref: dN.ref, ind: null },
      sid === 0
        ? { label: "Secteur dominant", val: dominant ? dominant.nom : "N/A", annee: dominant?.annee ?? null, delta: null, ref: null, ind: dominant && dominant.part !== null ? `${dominant.part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % du total` : null }
        : { label: gf ? "Part du total · valeur" : "Part du total · ventes", val: part !== null ? `${part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "N/A", annee: vD?.annee ?? null, delta: null, ref: null, ind: null },
    ];
  })();

  const aDesDonnees = rowsCat.length > 0;
  const periodeFiltree = modeAnnees === "specifiques" ? anneesSpec.length > 0 : (anneeMin !== borneMin || anneeMax !== borneMax);
  const hasFilter   = periodeFiltree || (typeAnalyse === "secteur" && selecIds[0] !== 0);
  const reinit      = () => { setSelecIds(typeAnalyse === "secteur" ? [0] : [1, 2, 3]); setCompNiveau("secteur"); setModeAnnees("plage"); setAnneeMin(borneMin); setAnneeMax(borneMax); setAnneesSpec([]); };

  return (
    <div style={{ display:"flex", alignItems:"flex-start" }}>

      {/* Sidebar bande */}
      <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"var(--carte)", borderRight:"1px solid var(--bordure-forte)", height:"100vh", overflowY:"auto" as const, position:"sticky" as const, top:0, display:"flex", flexDirection:"column" as const }}>
        <style>{`::-webkit-scrollbar-thumb{background:var(--fond-creux2)}::-webkit-scrollbar-thumb:hover{background:var(--fond-creux2)}`}</style>
        {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent", transition:"background 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
        <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid var(--bordure)", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
          {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"var(--encre)", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={()=>setSidebarOpen(o=>!o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background:"rgb(var(--bleu-rgb) / 0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
              <SlidersHorizontal size={14} style={{ color:"var(--bleu)" }}/>
            </button>
            {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser" style={{ background:"rgb(var(--danger-rgb) / 0.08)", border:"1px solid rgb(var(--danger-rgb) / 0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgb(var(--danger-rgb) / 0.15)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgb(var(--danger-rgb) / 0.08)";}}>
              <span className="material-symbols-outlined" style={{ fontSize:15, color:"var(--danger)", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
            </button>}
          </div>
        </div>
        {sidebarOpen&&<div style={{ padding:"16px", overflowY:"auto" as const, flex:1 }}>
          <SelecteurVueAnalyse vueP={vueP} setVueP={setVueP} typeAnalyse={typeAnalyse} setTypeAnalyse={setTypeAnalyse} allerAnalyse={v=>setSousOnglet(v)}/>
          {typeAnalyse==="secteur" ? (
          /* Secteurs / branches — même présentation que l'analyse sectorielle
             des Investissements nationaux (BdefRow : secteurs en bleu,
             branches en orange, « Global des secteurs » surligné) */
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Secteurs</span>
              {selecIds[0]!==0&&<span style={{ fontSize:10, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.18)", padding:"1px 6px", borderRadius:999 }}>1</span>}
            </div>

            <BdefRow label="Global des secteurs" selected={selecIds[0]===0} onSelect={()=>setSelecIds([0])} />
            <div style={{ height:1, background:"var(--fond)", margin:"8px 0" }}/>

            <div style={{ maxHeight:380, overflowY:"auto" as const }}>
              {refSecteurs.map((s: any) => {
                const isOpen = openSecs.has(s.id);
                return (
                  <div key={s.id} style={{ marginBottom:1 }}>
                    <BdefRow label={s.nom_fr} niveau="macro_secteur" selected={selecIds.includes(s.id)}
                      onSelect={()=>toggleSecteur(s.id)} expandable={(s.branches||[]).length>0} expanded={isOpen} onToggle={()=>toggleOpen(s.id)} />
                    {isOpen&&(
                      <div style={{ marginLeft:17, borderLeft:"1.5px solid var(--bordure)", paddingLeft:4, marginTop:1, marginBottom:3 }}>
                        {(s.branches||[]).map((b: any) => (
                          <BdefRow key={b.id} label={b.nom_fr} niveau="groupe" selected={selecIds.includes(b.id)} onSelect={()=>toggleSecteur(b.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {refSecteurs.length===0&&!loading&&<p style={{ fontSize:12, color:"var(--gris)", textAlign:"center" as const, padding:"8px 0" }}>Référentiel indisponible</p>}
            </div>
          </div>
          ) : (
          /* Comparative — choix du niveau comparé puis sélection (max 4),
             même présentation que la comparative des Investissements nationaux */
          <div style={{ marginBottom:18 }}>
            <div style={{ marginBottom:14 }}>
              <p style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Comparer par</p>
              <div style={{ display:"flex", gap:6 }}>
                {([{v:"secteur",l:"Secteurs"},{v:"branche",l:"Branches"}] as const).map(o=>(
                  <button key={o.v} onClick={()=>{ setCompNiveau(o.v); setSelecIds(o.v==="secteur"?[1,2,3]:[]); }}
                    style={{ flex:1, padding:"7px 2px", borderRadius:8, border:`1px solid ${compNiveau===o.v?"var(--bleu)":"var(--bordure-forte)"}`, cursor:"pointer", fontSize:11.5, fontWeight:compNiveau===o.v?700:500, background:compNiveau===o.v?"rgb(var(--bleu-rgb) / 0.08)":"var(--carte-douce)", color:compNiveau===o.v?"var(--bleu)":"var(--texte)", fontFamily:"var(--font-google-sans)" }}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>Sélection</span>
              <span style={{ fontSize:11, fontWeight:600, color:selecIds.length>=4?"var(--bleu)":"var(--gris)", background:selecIds.length>=4?"rgb(var(--bleu-rgb) / 0.08)":"var(--fond)", padding:"2px 8px", borderRadius:999 }}>{selecIds.length}/4</span>
            </div>

            {(()=>{
              const renderItem = (id: number, nom: string) => {
                const sel = selecIds.includes(id);
                const disabled = !sel && selecIds.length >= 4;
                const colIdx = selecIds.indexOf(id);
                const col = colIdx >= 0 ? COMP_PALETTE[colIdx % COMP_PALETTE.length] : "var(--bleu)";
                return (
                  <div key={id} onClick={()=>{ if(!disabled) toggleSecteur(id); }}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", borderRadius:6, background:"transparent", opacity:disabled?0.35:1, cursor:disabled?"not-allowed":"pointer", transition:"background 0.1s" }}
                    onMouseEnter={e=>{ if(!disabled) (e.currentTarget as HTMLElement).style.background="var(--carte-douce)"; }}
                    onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="transparent"; }}>
                    <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"var(--bordure-forte)"}`, background:sel?col:"transparent", flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:"var(--texte)", fontWeight:sel?700:400, lineHeight:1.3, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{nom}</span>
                  </div>
                );
              };
              if (compNiveau === "secteur") {
                return <div style={{ maxHeight:380, overflowY:"auto" as const, display:"flex", flexDirection:"column" as const, gap:1 }}>
                  {refSecteurs.map((s: any) => renderItem(s.id, s.nom_fr))}
                </div>;
              }
              return <div style={{ maxHeight:380, overflowY:"auto" as const, display:"flex", flexDirection:"column" as const, gap:1 }}>
                {refSecteurs.map((s: any) => {
                  const open = compCatOuverts.has(s.id);
                  if (!(s.branches||[]).length) return null;
                  return (
                    <div key={s.id}>
                      <button onClick={()=>toggleCompCat(s.id)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"rgb(var(--bleu-rgb) / 0.04)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 8px", marginTop:6, marginBottom:3 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:"var(--bleu)", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{s.nom_fr}</span>
                        <ChevronDown size={11} style={{ color:"var(--bleu)", transform:open?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
                      </button>
                      {open&&(s.branches||[]).map((b: any) => renderItem(b.id, b.nom_fr))}
                    </div>
                  );
                })}
              </div>;
            })()}
            {refSecteurs.length===0&&!loading&&<p style={{ fontSize:12, color:"var(--gris)", textAlign:"center" as const, padding:"8px 0" }}>Référentiel indisponible</p>}
          </div>
          )}
          <div style={{ height:1, background:"var(--fond)", marginBottom:18 }}/>
          {/* Période */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
            </div>
            <div style={{ display:"flex", gap:3, background:"var(--fond)", borderRadius:9, padding:3, marginBottom:12 }}>
              {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                  style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"var(--carte)":"transparent", color:modeAnnees===m.v?"var(--encre)":"var(--gris)", boxShadow:modeAnnees===m.v?"0 1px 4px rgb(var(--ombre-rgb) / 0.1)":"none", transition:"all 0.15s" }}>
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
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                  <span style={{ fontSize:10, color:"var(--gris)" }}>—</span>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                </div>
                <p style={{ fontSize:11, color:"var(--gris)", textAlign:"center" as const }}>{anneeMax-anneeMin+1} année{anneeMax-anneeMin+1>1?"s":""}</p>
              </div>
            ) : (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:8 }}>
                  {Array.from({length:borneMax-borneMin+1},(_,i)=>borneMin+i).map(a=>{
                    const sel=anneesSpec.includes(a);
                    return (
                      <button key={a} onClick={()=>setAnneesSpec(prev=>sel?prev.filter(x=>x!==a):[...prev,a].sort())}
                        style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`, cursor:"pointer", fontSize:10, fontWeight:sel?700:400, textAlign:"center" as const, background:sel?"var(--bleu-action)":"var(--carte-douce)", color:sel?"var(--sur-bleu)":"var(--texte)", transition:"all 0.1s" }}>
                        {a}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, color:"var(--texte)" }}>{anneesSpec.length>0?`${anneesSpec.length} année${anneesSpec.length>1?"s":""}`:""}</span>
                  {anneesSpec.length>0&&<button onClick={()=>setAnneesSpec([])} style={{ fontSize:11, color:"var(--gris)", background:"none", border:"none", cursor:"pointer" }}>Effacer</button>}
                </div>
              </div>
            )}
          </div>
        </div>}
      </aside>

      {/* Zone principale */}
      <div style={{ flex:1, minWidth:0, padding:"36px 40px 80px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:22 }}>
          <SousTypeNav value={st} onChange={setSousType} options={SECTEUR_NAV}/>
          <BoutonDonnees onClick={()=>setShowTable(true)} dep={selecIds.join(",")}/>
        </div>

        {/* Header */}
        {(() => {
          const badgePeriode = (
            <BadgePeriode>
              {modeAnnees==="specifiques"&&anneesSpec.length>0
                ? `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length-1]}`
                : `${perMin} — ${perMax}`}
            </BadgePeriode>
          );
          return typeAnalyse === "secteur" ? (
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" as const }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:accent, flexShrink:0 }} />
              <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"var(--encre)" }}>{selecIds.length ? nomById.get(selecIds[0]) : "Secteur"}</h2>
              {niveauSel!=="global"&&<span style={{ display:"inline-flex", alignItems:"center", padding:"1px 7px", borderRadius:5, background:"var(--fond)", border:"1px solid var(--bordure-forte)", fontSize:9, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.05em", flexShrink:0 }}>
                {niveauSel==="secteur"?"Secteur":"Branche d'activité"}
              </span>}
              {badgePeriode}
            </div>
          ) : (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" as const }}>
                <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"var(--encre)" }}>Analyse comparative par {compNiveau==="secteur"?"secteur":"branche d'activité"}</h2>
                {badgePeriode}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10, flexWrap:"wrap" as const }}>
                {selecIds.map((id, i) => (
                  <BadgeSerie key={id} i={i} couleur={couleurDe(i)}>{nomById.get(id)}</BadgeSerie>
                ))}
                {selecIds.length===0&&<span style={{ fontSize:12, color:"var(--gris)" }}>Sélectionnez jusqu&apos;à 4 {compNiveau==="secteur"?"secteurs":"branches"} dans le filtre</span>}
              </div>
            </div>
          );
        })()}

        {/* KPI cards (analyse par secteur) — 4 colonnes */}
        {stCards && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
            {stCards.map(c=>(
              <div key={c.label}
                style={{ background:"var(--carte)", borderRadius:14, padding:"13px 14px", border:"1px solid rgb(var(--encre-rgb) / 0.12)", boxShadow:"none", transition:"border-color 0.18s", minWidth:0 }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="rgb(var(--bleu-rgb) / 0.35)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgb(var(--encre-rgb) / 0.12)"; }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7, flexWrap:"wrap" as const }}>
                  <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:accent, textTransform:"uppercase" as const, lineHeight:1.4 }}>{c.label}</p>
                  {c.annee != null && <span style={{ fontSize:8.5, fontWeight:700, color:"var(--gris)", background:"var(--bleu-voile)", padding:"1px 7px", borderRadius:4, lineHeight:1.5, flexShrink:0 }}>{c.annee}</span>}
                </div>
                <p style={{ fontSize:"1.15rem", fontWeight:800, color:"var(--encre)", lineHeight:1 }}>{c.val}</p>
                <div style={{ marginTop:5, minHeight:12, display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" as const }}>
                  {c.delta != null && c.ref != null ? (
                  <Variation valeur={c.delta} annee={c.ref} taille={10} />
                ) : (c.ind ? <p style={{ fontSize:10, color:"var(--gris)", lineHeight:1 }}>{c.ind}</p> : null)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Graphes */}
        {loading ? (
          <SkeletonChartGrid n={SERIES.length} cols={2} height={230}/>
        ) : erreur ? (
          <ErreurChargement onRetry={() => setTick(t => t + 1)} />
        ) : !aDesDonnees ? (
          <div style={{ textAlign:"center" as const, padding:"90px 24px", color:"var(--gris)" }}>
            <p style={{ fontSize:16, fontWeight:600, color:"var(--texte)" }}>Aucune donnée sectorielle</p>
            <p style={{ fontSize:14, marginTop:6 }}>Les Annex tables sectorielles ({st === "greenfield" ? "15 et 18" : "09 à 12"}) n&apos;ont pas encore été importées dans l&apos;administration.</p>
          </div>
        ) : (
          <div className="charge-in" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
            {GRAPHES.map(g=>{
              // Analyse sectorielle (sélection unique) : les « nombres » en
              // tableau explorable (curseur + épinglage), comme en vue Pays
              if (typeAnalyse === "secteur" && g.unite === "nombre")
                return <CarteTableauAnnees key={`${g.id}-${selecIds[0]}`} titre={g.titre} accent={accent}
                  rows={(g.series[0]?.data || []).map((d: any) => ({ annee: d.annee, valeur: d.valeur }))}/>;
              // Analyse comparative : tableau par secteur (Cumul ⇆ année au curseur)
              if (typeAnalyse === "comparative" && g.unite === "nombre")
                return <CarteTableauComparatif key={`${g.id}-${selecIds.join(",")}`} titre={g.titre}
                  series={g.series} libelleLigne="Secteur"/>;
              // Seul graphe de valeur de la grille (greenfield comparatif :
              // le nombre est en tableau pleine largeur) → pleine largeur aussi
              const seulGrapheValeur = typeAnalyse === "comparative" && SERIES.filter(x => x.unite !== "nombre").length === 1;
              return (
              <div key={g.id} style={seulGrapheValeur ? { gridColumn: "1 / -1" } : undefined}>
              <GrapheCard titre={g.titre} unite={g.unite==="nombre"?"Nombre":"M$ USD"} source="CNUCED" series={g.series} grapheId={g.id} hideLegend hideSousTitre
                fullChildren={<GrapheMultiPays series={g.series} height={340} type={g.unite==="nombre"?"bar":"line"} titre={g.id} fmt={g.unite==="nombre"?fmtNombre:undefined}/>}>
                <GrapheMultiPays series={g.series} height={seulGrapheValeur?260:SERIES.length===2?220:145} type={g.unite==="nombre"?"bar":"line"} titre={g.id} fmt={g.unite==="nombre"?fmtNombre:undefined}/>
              </GrapheCard>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalDonnees open={showTable} onClose={()=>setShowTable(false)}
        donnees={rowsSel.map((d: any) => ({ ...d, pays: d.secteur }))}
        paysSelectionnes={selecIds.map((id, i) => ({ nom: nomById.get(id) || "?", couleur: couleurDe(i) }))}
        sousType={`secteur_${st}`} entite={selecIds.length > 1 ? "secteurs" : "secteur"} />
    </div>
  );
}

export default OngletSecteurs;
