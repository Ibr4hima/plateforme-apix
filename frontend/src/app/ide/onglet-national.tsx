"use client";
import { useEchap } from "@/lib/useEchap";
import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import { X, Plus, Table, ChevronDown, SlidersHorizontal, Search, FileSpreadsheet } from "lucide-react";
import { SkeletonChartGrid } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardIde";
import PickerKpi, { BtnSwapKpi, STYLE_KPI_SWAP, type PickerItem } from "@/components/shared/PickerKpi";
import { CurseurPlageNace } from "@/components/shared/CurseurNace";
import { API, BadgeSerie, GrapheMultiPays, BdefRow, BDEF_NIVEAU_STYLE, BDEF_NIVEAU_LABEL } from "./partage";


// ── BDEF (Investissements nationaux) ──────────────────────────────────────────
const BDEF_CAT_COULEURS = ["#004f91","#ca631f","#188038","#7c3aed","#0891b2","#dc2626","#d97706","#059669"];

function fmtBdef(v: number|null, unite: string, short = false): string {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  const nf1 = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  if (unite === "%")     return `${nf1(v)} %`;
  if (unite === "ratio") return v.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  if (unite === "jours") return `${Math.round(v)} j`;
  // Montants en FCFA réels (le fichier source était en millions de FCFA).
  const suf = short ? "" : " FCFA";
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf1(v/1e9)} Md${suf}`;
  if (a >= 1e6) return `${nf1(v/1e6)} M${suf}`;
  if (a >= 1e3) return `${Math.round(v/1e3).toLocaleString("fr-FR")} k${suf}`;
  return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
}

type BdefNode = { id:number; code:string; libelle:string; macro_secteur_id?:number; groupe_id?:number };
type BdefRefs = { macro_secteur:BdefNode[]; groupe:BdefNode[]; secteur:BdefNode[] };
type BdefIndic = { code:string; libelle:string; unite:string; categorie:string; valeurs:Record<string,number|null> };
type BdefSel = { niveau:"global"|"macro_secteur"|"groupe"|"secteur"; cible_id:number|null; libelle:string };

// ── Définitions simples des indicateurs BDEF (affichées au survol) ────────────
const BDEF_DEFINITIONS: Record<string,string> = {
  act_ca:           "Le chiffre d'affaires, c'est le total des ventes réalisées par les entreprises du secteur sur l'année. Autrement dit : combien d'argent le secteur a généré en vendant ses produits et services.",
  act_tx_ca:        "Mesure l'évolution du chiffre d'affaires d'une année à l'autre, en pourcentage. Un taux positif signifie que les ventes du secteur progressent ; négatif, qu'elles reculent.",
  act_production:   "Valeur de tout ce que le secteur a produit sur l'année (vendu ou mis en stock). Elle reflète l'activité réelle, au-delà des seules ventes.",
  act_tx_prod:      "Évolution de la production d'une année sur l'autre, en pourcentage. Indique si l'activité du secteur s'accélère ou ralentit.",
  act_va:           "Richesse réellement créée par le secteur : ce qui reste de la production une fois retranchés les achats de matières et de services extérieurs. C'est sa contribution à l'économie.",
  act_tx_va:        "Part de la production qui se transforme en valeur ajoutée. Plus il est élevé, plus le secteur crée de richesse par rapport à ce qu'il consomme.",
  rent_ebe:         "Ce que le secteur gagne grâce à son activité courante, avant de payer les intérêts, les impôts et l'usure du matériel. Un bon indicateur de la rentabilité « brute ».",
  rent_rex:         "Bénéfice tiré de l'activité principale, une fois prise en compte l'usure des équipements (amortissements). Il montre si le métier de base est rentable.",
  rent_eco:         "Mesure ce que rapporte l'activité par rapport aux moyens investis (l'actif). Autrement dit : l'argent mobilisé travaille-t-il efficacement ?",
  rent_fin:         "Mesure ce que l'entreprise rapporte à ses propriétaires par rapport à leur mise de départ. Répond à : « mon argent investi rapporte-t-il bien ? »",
  sf_pression_fisc: "Part de la richesse créée par le secteur qui part en impôts et taxes. Plus il est élevé, plus la charge fiscale pèse sur les entreprises.",
  sf_autonomie:     "Indique dans quelle mesure le secteur se finance par ses propres fonds plutôt que par l'endettement. Plus elle est élevée, plus les entreprises sont indépendantes des banques.",
  sf_solvabilite:   "Mesure si les entreprises sont capables de rembourser l'ensemble de leurs dettes sur le long terme. Autrement dit : « l'entreprise survivrait-elle si elle devait tout rembourser aujourd'hui ? »",
  sf_dettes_fin:    "Importance des dettes contractées auprès des banques par rapport aux ressources du secteur. Plus il est élevé, plus le secteur est endetté.",
  sf_cap_rembours:  "Indique combien d'années il faudrait au secteur pour rembourser ses dettes avec ce qu'il dégage chaque année. Plus c'est court, plus la situation est saine.",
  liq_fdr:          "Marge de sécurité financière : les ressources stables qui restent disponibles une fois les investissements financés. Un fonds de roulement positif protège contre les imprévus.",
  liq_bfr:          "Argent dont le secteur a besoin en permanence pour financer son cycle d'exploitation (stocks et délais de paiement). Plus il est élevé, plus il faut de trésorerie pour fonctionner.",
  eff_prod_travail: "Richesse créée en moyenne par chaque travailleur. Mesure l'efficacité de la main-d'œuvre du secteur.",
  eff_prod_capital: "Richesse créée pour chaque franc de capital investi dans les équipements. Mesure si les machines et installations sont bien exploitées.",
  eff_vetuste:      "Degré d'usure des équipements du secteur. Plus il est élevé, plus le matériel est ancien et proche de devoir être renouvelé.",
  eff_stock_mp:     "Nombre de jours pendant lesquels les matières premières restent en stock avant d'être utilisées. Plus c'est court, plus la gestion est efficace.",
  eff_stock_march:  "Nombre de jours pendant lesquels les marchandises restent en stock avant d'être vendues. Un délai court signale un bon écoulement.",
  eff_stock_pf:     "Nombre de jours pendant lesquels les produits finis attendent en stock avant d'être vendus. Plus c'est court, mieux le secteur écoule sa production.",
  inv_actif_immo:   "Valeur de tout ce que le secteur possède durablement pour produire : terrains, bâtiments, machines, équipements. Reflète l'effort d'investissement accumulé.",
  inv_amortiss:     "Constatation comptable de l'usure des équipements sur l'année. Représente la part de valeur que les biens perdent à force d'être utilisés.",
  inv_tx_autofin:   "Capacité du secteur à financer ses investissements par ses propres ressources, sans emprunter. Plus il est élevé, plus le secteur est autonome pour investir.",
  _raw_caf:         "Capacité d'autofinancement : l'argent que le secteur dégage réellement par son activité et qu'il peut consacrer à investir ou à rembourser ses dettes.",
};
const defBdef = (code:string, libelle:string) =>
  BDEF_DEFINITIONS[code] || `${libelle} — indicateur issu de la Banque de Données Économiques et Financières (BDEF).`;

// KPIs affichés par défaut (onglet national)
const BDEF_KPI_DEFAUT = ["act_ca", "inv_tx_autofin", "sf_pression_fisc", "rent_ebe"];
// Graphes affichés par défaut (onglet national), dans cet ordre
const BDEF_GRAPHES_DEFAUT = [
  "act_ca", "eff_vetuste", "inv_actif_immo", "inv_tx_autofin",
  "liq_fdr", "sf_pression_fisc", "sf_autonomie", "rent_ebe",
];
// Couleurs distinctes pour la comparaison macro-secteurs sur la vue globale
const BDEF_MACRO_COULEURS = ["#004f91", "#ca631f", "#188038", "#6A1B9A"];

// ── Modal tableau BDEF ────────────────────────────────────────────────────────
function ModalBdefTable({ open, onClose, blocs, annees }: {
  open:boolean; onClose:()=>void; blocs:{libelle:string; couleur:string; indicateurs:BdefIndic[]}[]; annees:number[];
}) {
  useEchap(open, onClose);
  if (!open) return null;
  const parCatDe = (indicateurs:BdefIndic[]) => {
    const parCat: {cat:string; inds:BdefIndic[]}[] = [];
    indicateurs.forEach(ind=>{ let g=parCat.find(x=>x.cat===ind.categorie); if(!g){g={cat:ind.categorie,inds:[]};parCat.push(g);} g.inds.push(ind); });
    return parCat;
  };
  const multi = blocs.length > 1;
  const nbInds = blocs.reduce((n,b)=>n+b.indicateurs.length,0);
  // Unité affichée à côté du libellé (échelle commune par indicateur) — valeurs nues dans les cellules
  const uniteEtEchelle = (ind: BdefIndic): { unite:string; scale:number } => {
    if (ind.unite==="%"||ind.unite==="ratio"||ind.unite==="jours") return { unite:ind.unite, scale:1 };
    const m = Math.max(0, ...annees.map(a=>Math.abs((ind.valeurs[a] as number)||0)));
    if (m>=1e9) return { unite:"Md FCFA", scale:1e9 };
    if (m>=1e6) return { unite:"M FCFA", scale:1e6 };
    if (m>=1e3) return { unite:"k FCFA", scale:1e3 };
    return { unite:"FCFA", scale:1 };
  };
  const fmtNu = (ind: BdefIndic, v: number, scale: number) =>
    ind.unite==="%" ? v.toLocaleString("fr-FR",{maximumFractionDigits:1})
    : ind.unite==="ratio" ? v.toLocaleString("fr-FR",{maximumFractionDigits:3})
    : ind.unite==="jours" ? String(Math.round(v))
    : (v/scale).toLocaleString("fr-FR",{maximumFractionDigits:scale>=1e6?1:0});

  const exporter = async () => {
    // SheetJS chargé à la demande (~400 Ko) : uniquement au clic Export
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    blocs.forEach((b,bi)=>{
      const header = ["Catégorie","Indicateur","Unité",...annees.map(String)];
      const rows:(string|number|null)[][] = [header];
      parCatDe(b.indicateurs).forEach(({cat,inds})=>inds.forEach(ind=>{
        rows.push([cat, ind.libelle, ind.unite, ...annees.map(a=>{ const v=ind.valeurs[a]; return v!==null&&v!==undefined?Number(v):null; })]);
      }));
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = header.map((_,ci)=>({ wch: Math.min(Math.max(...rows.map(r=>String(r[ci]??"").length))+2,50) }));
      const nomFeuille = ((multi?`${bi+1}. `:"") + b.libelle.replace(/[\\\/\?\*\[\]:]/g," ")).slice(0,31);
      XLSX.utils.book_append_sheet(wb, ws, nomFeuille);
    });
    XLSX.writeFile(wb, `BDEF_${blocs.map(b=>b.libelle.replace(/[^\w]/g,"_").slice(0,20)).join("_").slice(0,80)}.xlsx`);
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgb(var(--encre-rgb) / 0.45)", backdropFilter:"blur(8px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:1200, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"var(--bleu-action)", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid var(--bordure)", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"var(--encre)", margin:0, lineHeight:1.35, flexShrink:0 }}>Tableau de données</h2>
                {annees.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:999, background:"var(--fond-creux2)", border:"1px solid var(--bordure-forte)", fontSize:10.5, fontWeight:700, color:"var(--encre)", letterSpacing:"0.02em", flexShrink:0 }}>
                  {annees.length===1 ? `${annees[0]}` : `${annees[0]} — ${annees[annees.length-1]}`}
                </span>}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, minWidth:0 }}>
                {blocs.map(b=>{
                  const marquee = (e:React.MouseEvent, reset:boolean) => {
                    const box = e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null;
                    const sp = box?.firstElementChild as HTMLElement|null;
                    if (!box || !sp) return;
                    if (reset) { sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; return; }
                    const d = sp.scrollWidth - box.clientWidth;
                    if (d>0) { sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; }
                  };
                  return (
                    <span key={b.libelle} title={b.libelle}
                      onMouseEnter={e=>marquee(e,false)} onMouseLeave={e=>marquee(e,true)}
                      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:999, background:`${b.couleur}0D`, border:`1px solid ${b.couleur}2E`, fontSize:10.5, fontWeight:700, color:b.couleur, minWidth:0 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:b.couleur, display:"inline-block", flexShrink:0 }} />
                      <span data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const, minWidth:0 }}>
                        <span style={{ display:"inline-block" }}>{b.libelle}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width:32, height:32, borderRadius:"50%", background:"var(--champ)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="var(--fond-creux2)";}} onMouseLeave={e=>{e.currentTarget.style.background="var(--champ)";}}>
              <X size={15} color="var(--texte)" />
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div style={{ overflowY:"auto" as const, flex:1, overflowX:"auto" as const }}>
          <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
            <thead style={{ position:"sticky" as const, top:0, zIndex:2 }}>
              <tr style={{ background:"var(--carte-douce)" }}>
                <th style={{ padding:"11px 28px", textAlign:"left" as const, fontSize:10, fontWeight:800, color:"var(--texte)", letterSpacing:"0.1em", textTransform:"uppercase" as const, position:"sticky" as const, left:0, background:"var(--carte-douce)", borderRight:"1px solid var(--bordure)", borderBottom:"1px solid var(--bordure)", whiteSpace:"nowrap" as const, minWidth:200 }}>Indicateur</th>
                {annees.map(a=><th key={a} style={{ padding:"11px 12px", fontSize:10, fontWeight:800, color:"var(--texte)", letterSpacing:"0.06em", textAlign:"right" as const, minWidth:80, borderBottom:"1px solid var(--bordure)" }}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {blocs.map(b=>(
                <Fragment key={b.libelle}>
                  {multi&&(
                    <tr>
                      <td colSpan={annees.length+1} style={{ padding:"14px 28px 6px", background:"var(--carte)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ width:8, height:8, borderRadius:"50%", background:b.couleur, flexShrink:0 }} />
                          <span style={{ fontSize:12.5, fontWeight:800, color:b.couleur }}>{b.libelle}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {parCatDe(b.indicateurs).map(({cat,inds})=>(
                    <Fragment key={`${b.libelle}-${cat}`}>
                      <tr><td colSpan={annees.length+1} style={{ padding:multi?"9px 28px 4px 44px":"10px 28px 4px", fontSize:10, fontWeight:800, color:b.couleur, letterSpacing:"0.1em", textTransform:"uppercase" as const, background:"var(--carte)" }}>{cat}</td></tr>
                      {inds.map(ind=>{
                        const { unite:uAff, scale } = uniteEtEchelle(ind);
                        return (
                        <tr key={ind.code} style={{ borderBottom:"1px solid var(--filet)", background:"var(--carte)", transition:"background 0.1s" }}
                          onMouseEnter={e=>e.currentTarget.style.background="var(--carte-douce)"}
                          onMouseLeave={e=>e.currentTarget.style.background="var(--carte)"}>
                          <td style={{ padding:multi?"9px 28px 9px 58px":"9px 28px 9px 44px", position:"sticky" as const, left:0, background:"inherit", borderRight:"1px solid var(--bordure)", whiteSpace:"nowrap" as const }}>
                            <span style={{ fontSize:12, color:"var(--texte)", fontWeight:500 }}>{ind.libelle}</span> <span style={{ fontSize:10, color:"var(--gris)" }}>· {uAff}</span>
                          </td>
                          {annees.map(a=>{
                            const v = ind.valeurs[a];
                            const display = v!==null&&v!==undefined ? fmtNu(ind, v, scale) : "—";
                            const color = v===null||v===undefined ? "var(--gris)" : v<0 ? "var(--danger)" : "var(--texte)";
                            return (
                              <td key={a} style={{ padding:"9px 12px", textAlign:"right" as const, fontSize:12, color, fontWeight:v!==null&&v!==undefined?600:400, fontVariantNumeric:"tabular-nums" as const, whiteSpace:"nowrap" as const }}>{display}</td>
                            );
                          })}
                        </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid var(--bordure)", background:"var(--carte-douce)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0, gap:10 }}>
          <span style={{ fontSize:11, color:"var(--gris)" }}>
            {multi?`${blocs.length} éléments · `:""}{nbInds} indicateurs · {annees.length} année{annees.length>1?"s":""} · Source BDEF (ANSD)
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid var(--bordure-forte)", background:"var(--carte)", color:"var(--texte)", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
              Fermer
            </button>
            <button onClick={exporter}
              style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"var(--bleu-action)", color:"var(--sur-bleu)", fontSize:12.5, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.25)", fontFamily:"var(--font-google-sans)" }}>
              <FileSpreadsheet size={13}/> Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mini-modal KPI BDEF ───────────────────────────────────────────────────────
function MiniModalBdefKpi({ ind, annees, libelle, onClose }: {
  ind: BdefIndic | null; annees: number[]; libelle: string; onClose: ()=>void;
}) {
  useEchap(!!ind, onClose);
  if (!ind) return null;
  const lastA  = annees.length ? annees[annees.length - 1] : null;
  const v      = lastA !== null ? (ind.valeurs[lastA] ?? null) : null;
  const isTaux = ind.unite === "%" || ind.unite === "ratio";
  const isPos  = v !== null && v > 0;
  const isNeg  = v !== null && v < 0;
  const signalColor  = isNeg ? "#dc2626" : "#004f91";
  const signalBg     = isNeg ? "rgba(220,38,38,0.05)" : "rgba(0,79,145,0.04)";
  const signalBorder = isNeg ? "rgba(220,38,38,0.18)" : "rgba(0,79,145,0.10)";
  const definition = defBdef(ind.code, ind.libelle);
  const historique = annees.filter(a=>ind.valeurs[a]!=null).slice(-5);
  // Échelle commune de l'historique : unité affichée à côté du titre, valeurs nues dans les blocs
  const estMontant = !isTaux && ind.unite !== "jours";
  const histMax = Math.max(0, ...historique.map(a=>Math.abs(ind.valeurs[a] as number)));
  const histScale = estMontant ? (histMax>=1e9 ? 1e9 : histMax>=1e6 ? 1e6 : histMax>=1e3 ? 1e3 : 1) : 1;
  const histUnite = estMontant ? (histScale===1e9 ? "Md FCFA" : histScale===1e6 ? "M FCFA" : histScale===1e3 ? "k FCFA" : "FCFA") : ind.unite;
  const fmtHist = (val:number) =>
    ind.unite==="%" ? val.toLocaleString("fr-FR",{maximumFractionDigits:1})
    : ind.unite==="ratio" ? val.toLocaleString("fr-FR",{maximumFractionDigits:3})
    : ind.unite==="jours" ? String(Math.round(val))
    : (val/histScale).toLocaleString("fr-FR",{maximumFractionDigits:histScale>=1e6?1:0});
  const SecTitle = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize:10.5, fontWeight:700, color:"var(--bleu)", letterSpacing:"0.14em", textTransform:"uppercase" as const, marginBottom:10 }}>{children}</p>
  );

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgb(var(--encre-rgb) / 0.45)", backdropFilter:"blur(8px)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"var(--bleu-action)", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid var(--bordure)", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"var(--encre)", margin:0, lineHeight:1.35 }}>{ind.libelle}</h2>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const, marginTop:8 }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.07)", border:"1px solid rgb(var(--bleu-rgb) / 0.19)" }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:"var(--bleu-action)", display:"inline-block" }} />
                  {libelle}
                </span>
                <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"var(--texte)", background:"var(--champ)" }}>
                  {ind.categorie}
                </span>
                {lastA && (
                  <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"var(--texte)", background:"var(--champ)" }}>
                    {lastA}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width:32, height:32, borderRadius:"50%", background:"var(--champ)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="var(--fond-creux2)";}} onMouseLeave={e=>{e.currentTarget.style.background="var(--champ)";}}>
              <X size={15} color="var(--texte)" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1, display:"flex", flexDirection:"column" as const, gap:22 }}>
          <div>
            <SecTitle>Valeur</SecTitle>
            <div style={{ background:signalBg, border:`1px solid ${signalBorder}`, borderRadius:12, padding:"16px 18px", display:"flex", alignItems:"baseline", gap:10 }}>
              <span style={{ fontSize:"2.2rem", fontWeight:800, color:signalColor, lineHeight:1, letterSpacing:"-0.02em" }}>{fmtBdef(v, ind.unite)}</span>
              {lastA && <span style={{ fontSize:13, color:"var(--gris)", fontWeight:500 }}>en {lastA}</span>}
            </div>
          </div>
          {historique.length > 0 && (
            <div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:10 }}>
                <p style={{ fontSize:10.5, fontWeight:700, color:"var(--bleu)", letterSpacing:"0.14em", textTransform:"uppercase" as const, margin:0 }}>Historique récent</p>
                <span style={{ fontSize:10.5, fontWeight:600, color:"var(--gris)" }}>en {histUnite}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(historique.length,5)},1fr)`, gap:8 }}>
                {historique.map(a=>(
                  <div key={a} style={{ background:"rgb(var(--bleu-rgb) / 0.04)", border:"1px solid rgb(var(--bleu-rgb) / 0.10)", borderRadius:10, padding:"8px 11px", minWidth:0 }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"var(--bleu)", margin:"0 0 3px" }}>{a}</p>
                    <p style={{ fontSize:12, fontWeight:700, color:"var(--encre)", margin:0, whiteSpace:"nowrap" as const, overflow:"hidden", textOverflow:"ellipsis" }}>{fmtHist(ind.valeurs[a] as number)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <SecTitle>Définition</SecTitle>
            <div style={{ background:"var(--carte-douce)", border:"1px solid var(--bordure)", borderRadius:12, padding:"14px 18px" }}>
              <p style={{ fontSize:13, color:"var(--encre)", lineHeight:1.75, margin:0 }}>{definition}</p>
            </div>
          </div>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid var(--bordure)", background:"var(--carte-douce)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <span style={{ fontSize:11, color:"var(--gris)" }}>Unité : {ind.unite} · Source BDEF (ANSD)</span>
          <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid var(--bordure-forte)", background:"var(--carte)", color:"var(--texte)", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function OngletNational() {
  const [refs, setRefs]               = useState<BdefRefs|null>(null);
  const [sel, setSel]                 = useState<BdefSel>({ niveau:"global", cible_id:null, libelle:"Global des secteurs" });
  const [indicateurs, setIndicateurs] = useState<BdefIndic[]>([]);
  const [anneesData, setAnneesData]   = useState<number[]>([]);
  const [loading, setLoading]         = useState(true);

  // Vue : sectorielle | comparative
  const [sousVue, setSousVue]         = useState<"sectorielle"|"comparative">("sectorielle");
  // Analyse comparative
  const [compType, setCompType]       = useState<"macro_secteur"|"groupe"|"secteur">("macro_secteur");
  const [compSelec, setCompSelec]     = useState<number[]>([]);
  const compInit = useRef(false);
  const [compData, setCompData]       = useState<Record<number,BdefIndic[]>>({});
  const [compAnneesData, setCompAnneesData] = useState<number[]>([]);
  const [compSearch, setCompSearch]   = useState("");
  const [compCatOuverts, setCompCatOuverts] = useState<Set<string>>(new Set());
  const toggleCompCat = (k:string) => setCompCatOuverts(p=>{ const n=new Set(p); n.has(k)?n.delete(k):n.add(k); return n; });
  const [loadingComp, setLoadingComp] = useState(false);

  // Période (bornes dérivées des données)
  const [bornes, setBornes]           = useState<[number,number]>([2019,2024]);
  const [anneeMin, setAnneeMin]       = useState(2019);
  const [anneeMax, setAnneeMax]       = useState(2024);
  const [modeAnnees, setModeAnnees]   = useState<"plage"|"specifiques">("plage");
  const [anneesSpec, setAnneesSpec]   = useState<number[]>([]);
  const initBornes = useRef(false);

  // Sidebar
  const [search, setSearch]           = useState("");
  const [openMacros, setOpenMacros]   = useState<Set<number>>(new Set());
  const [openGroupes, setOpenGroupes] = useState<Set<number>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(310);
  const isResizing = useRef(false);
  const [showTable, setShowTable]     = useState(false);

  // KPIs
  const [kpisEpingles, setKpisEpingles] = useState<string[]>(BDEF_KPI_DEFAUT);
  const [kpiActif, setKpiActif]         = useState<BdefIndic | null>(null);
  // Slot (0-3) dont le picker de remplacement est ouvert ; -1 = aucun
  const [pickerSlot, setPickerSlot]     = useState(-1);
  // Données des macro-secteurs (uniquement chargées pour la vue globale)
  const [macroIndicateurs, setMacroIndicateurs] = useState<{id:number;libelle:string;inds:BdefIndic[]}[]>([]);

  // Couleur d'accent du panneau de droite = couleur du niveau sélectionné
  const couleur = (sel.niveau && BDEF_NIVEAU_STYLE[sel.niveau]?.color) || "var(--bleu)";

  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 220, 540);

  useEffect(()=>{ fetch(`${API}/bdef/secteurs`).then(r=>r.json()).then((d:BdefRefs)=>setRefs(d)).catch(()=>{}); }, []);

  // Chargement principal : en cas d'échec, état d'erreur avec relance (tick)
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);
  const charger = useCallback(async()=>{
    setLoading(true); setErreur(false);
    try {
      const qs = sel.niveau==="global" ? `niveau=global` : `niveau=${sel.niveau}&cible_id=${sel.cible_id}`;
      const d = await fetch(`${API}/bdef/valeurs?${qs}`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); });
      setIndicateurs(d?.indicateurs||[]);
      setAnneesData(d?.annees||[]);
      if (sel.niveau==="global" && refs) {
        const macros = await Promise.all(
          refs.macro_secteur.map(m=>
            fetch(`${API}/bdef/valeurs?niveau=macro_secteur&cible_id=${m.id}`)
              .then(r=>r.json())
              .then((md:any)=>({ id:m.id, libelle:m.libelle, inds:(md?.indicateurs||[]) as BdefIndic[] }))
              .catch(()=>({ id:m.id, libelle:m.libelle, inds:[] as BdefIndic[] }))
          )
        );
        setMacroIndicateurs(macros);
      } else {
        setMacroIndicateurs([]);
      }
    } catch(e){ console.error(e); setErreur(true); setIndicateurs([]); setAnneesData([]); setMacroIndicateurs([]); }
    finally { setLoading(false); }
  }, [sel, refs, tick]);
  useEffect(()=>{ charger(); }, [charger]);

  // Chargement comparatif : quand compSelec ou compType change
  useEffect(()=>{
    if (sousVue!=="comparative" || compSelec.length===0) return;
    let cancelled = false;
    (async()=>{
      setLoadingComp(true);
      const results = await Promise.all(
        compSelec.map(id=>
          fetch(`${API}/bdef/valeurs?niveau=${compType}&cible_id=${id}`)
            .then(r=>r.json())
            .then((d:any)=>({ id, inds:(d?.indicateurs||[]) as BdefIndic[], annees:(d?.annees||[]) as number[] }))
            .catch(()=>({ id, inds:[] as BdefIndic[], annees:[] as number[] }))
        )
      );
      if (!cancelled) {
        const newData: Record<number,BdefIndic[]> = {};
        let allAnnees: number[] = [];
        results.forEach(r=>{ newData[r.id]=r.inds; allAnnees=[...new Set([...allAnnees,...r.annees])].sort(); });
        setCompData(newData);
        setCompAnneesData(allAnnees);
      }
      setLoadingComp(false);
    })();
    return ()=>{ cancelled=true; };
  }, [compSelec, compType, sousVue]);

  // Sélection par défaut : les 4 macro-secteurs (une seule fois, dès que refs est chargé)
  useEffect(()=>{
    if (!compInit.current && refs?.macro_secteur?.length) {
      compInit.current = true;
      setCompSelec(refs.macro_secteur.slice(0,4).map(m=>m.id));
    }
  }, [refs]);

  // Initialiser les bornes années au 1er chargement contenant des données
  useEffect(()=>{
    if (!initBornes.current && anneesData.length) {
      initBornes.current = true;
      const mn=anneesData[0], mx=anneesData[anneesData.length-1];
      setBornes([mn,mx]); setAnneeMin(mn); setAnneeMax(mx);
    }
  }, [anneesData]);

  const anneesAffichees = (modeAnnees==="specifiques" && anneesSpec.length>0)
    ? anneesSpec.filter(a=>anneesData.includes(a))
    : anneesData.filter(a=>a>=anneeMin && a<=anneeMax);
  const anneesCompAff = (modeAnnees==="specifiques" && anneesSpec.length>0)
    ? anneesSpec.filter(a=>compAnneesData.includes(a))
    : compAnneesData.filter(a=>a>=anneeMin && a<=anneeMax);

  // Indicateurs proposés au remplacement (non épinglés) + aperçu dernière année
  const lastAnnee = anneesAffichees.length ? anneesAffichees[anneesAffichees.length-1] : null;
  const pickerItems: PickerItem[] = indicateurs.filter(ind=>!kpisEpingles.includes(ind.code)).map(ind=>({
    id: ind.code, label: ind.libelle, badge: lastAnnee ? String(lastAnnee) : null,
    valeur: fmtBdef(lastAnnee!==null ? (ind.valeurs[lastAnnee]??null) : null, ind.unite, true),
    title: defBdef(ind.code, ind.libelle), groupe: ind.categorie,
  }));
  // Remplacement en place (slot occupé) ou ajout (slot vide) du KPI choisi
  const remplacerKpi = (slot: number, code: string) => {
    setKpisEpingles(prev => slot < prev.length ? prev.map((c,i)=>i===slot?code:c) : [...prev, code]);
    setPickerSlot(-1);
  };

  // Cascade
  const groupesDe  = (mid:number) => refs?.groupe.filter(g=>g.macro_secteur_id===mid) || [];
  const secteursDe = (gid:number) => refs?.secteur.filter(s=>s.groupe_id===gid) || [];
  const toggleMacro  = (id:number) => setOpenMacros(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleGroupe = (id:number) => setOpenGroupes(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleComp   = (id:number) => setCompSelec(p=>p.includes(id)?p.filter(x=>x!==id):p.length<4?[...p,id]:p);

  const choisir = (niveau:BdefSel["niveau"], node:BdefNode|null) =>
    setSel({ niveau, cible_id: node?node.id:null, libelle: node?node.libelle:"Global des secteurs" });
  const estSel = (niveau:string, id:number|null) => sel.niveau===niveau && sel.cible_id===id;

  // Recherche : résultats à plat tous niveaux confondus
  const q = search.trim().toLowerCase();
  const resultats = q && refs ? [
    ...refs.macro_secteur.filter(m=>m.libelle.toLowerCase().includes(q)||m.code.includes(q)).map(n=>({niveau:"macro_secteur" as const,node:n})),
    ...refs.groupe.filter(g=>g.libelle.toLowerCase().includes(q)||g.code.includes(q)).map(n=>({niveau:"groupe" as const,node:n})),
    ...refs.secteur.filter(s=>s.libelle.toLowerCase().includes(q)||s.code.includes(q)).map(n=>({niveau:"secteur" as const,node:n})),
  ] : [];

  const periodeFiltree = (modeAnnees==="specifiques"&&anneesSpec.length>0) || (modeAnnees==="plage"&&(anneeMin!==bornes[0]||anneeMax!==bornes[1]));
  const hasFilter = sousVue==="comparative"
    ? compSelec.length>0 || periodeFiltree
    : sel.niveau!=="global" || periodeFiltree;
  const reinit = () => {
    if (sousVue==="comparative") { setCompSelec([]); setCompData({}); setCompType("macro_secteur"); }
    else { choisir("global",null); }
    setModeAnnees("plage"); setAnneeMin(bornes[0]); setAnneeMax(bornes[1]); setAnneesSpec([]); setSearch("");
  };
  const span = Math.max(1, bornes[1]-bornes[0]);

  return (
    <div style={{ display:"flex", alignItems:"flex-start" }}>
      {/* Sidebar */}
      <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"var(--carte)", borderRight:"1px solid var(--bordure-forte)", height:"100vh", overflowY:"auto" as const, position:"sticky" as const, top:0, display:"flex", flexDirection:"column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:var(--fond-creux2)}::-webkit-scrollbar-thumb:hover{background:var(--fond-creux2)}`}</style>
        {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent" }} onMouseEnter={e=>{e.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
        <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid var(--bordure)", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
          {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"var(--encre)", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={()=>setSidebarOpen(o=>!o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background:"rgb(var(--bleu-rgb) / 0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center" }}>
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
          {/* Sélecteur de vue */}
          <div style={{ marginBottom:14, paddingBottom:14, borderBottom:"1px solid var(--bordure)" }}>
            <p style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Vue</p>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:2 }}>
              {([{v:"sectorielle",l:"Analyse sectorielle"},{v:"comparative",l:"Analyse comparative"}] as const).map(o=>(
                <button key={o.v} onClick={()=>setSousVue(o.v)}
                  style={{ textAlign:"left" as const, padding:"7px 10px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:sousVue===o.v?700:500, background:sousVue===o.v?"rgb(var(--bleu-rgb) / 0.08)":"transparent", color:sousVue===o.v?"var(--bleu)":"var(--texte)", fontFamily:"var(--font-google-sans)" }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {sousVue==="comparative" ? (
            <>
              {/* Sélecteur de type */}
              <div style={{ marginBottom:14 }}>
                <p style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Comparer par</p>
                <div style={{ display:"flex", gap:6 }}>
                  {([{v:"macro_secteur",l:"Macro-sect."},{v:"groupe",l:"Groupes"},{v:"secteur",l:"Secteurs"}] as const).map(o=>(
                    <button key={o.v} onClick={()=>{ setCompType(o.v); setCompSelec([]); setCompData({}); }}
                      style={{ flex:1, padding:"7px 2px", borderRadius:8, border:`1px solid ${compType===o.v?"var(--bleu)":"var(--bordure-forte)"}`, cursor:"pointer", fontSize:11.5, fontWeight:compType===o.v?700:500, background:compType===o.v?"rgb(var(--bleu-rgb) / 0.08)":"var(--carte-douce)", color:compType===o.v?"var(--bleu)":"var(--texte)", fontFamily:"var(--font-google-sans)" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compteur sélection */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>Sélection</span>
                <span style={{ fontSize:11, fontWeight:600, color:compSelec.length>=4?"var(--bleu)":"var(--gris)", background:compSelec.length>=4?"rgb(var(--bleu-rgb) / 0.08)":"var(--fond)", padding:"2px 8px", borderRadius:999 }}>{compSelec.length}/4</span>
              </div>

              {/* Liste (groupée par parent, non dépliante) */}
              {(()=>{
                const matchS = (n:BdefNode)=>!compSearch||n.libelle.toLowerCase().includes(compSearch.toLowerCase())||n.code.includes(compSearch);
                const renderItem = (n:BdefNode)=>{
                  const sel = compSelec.includes(n.id);
                  const disabled = !sel && compSelec.length>=4;
                  const colIdx = compSelec.indexOf(n.id);
                  const col = colIdx>=0 ? BDEF_MACRO_COULEURS[colIdx%BDEF_MACRO_COULEURS.length] : "#004f91";
                  return (
                    <div key={n.id} onClick={()=>{ if(!disabled) toggleComp(n.id); }}
                      style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", borderRadius:6, background:"transparent", opacity:disabled?0.35:1, cursor:disabled?"not-allowed":"pointer", transition:"background 0.1s" }}
                      onMouseEnter={e=>{ if(!disabled) (e.currentTarget as HTMLElement).style.background="var(--carte-douce)"; }}
                      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="transparent"; }}>
                      <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"var(--bordure-forte)"}`, background:sel?col:"transparent", flexShrink:0 }}/>
                      <span style={{ fontSize:12, color:"var(--texte)", fontWeight:sel?700:400, lineHeight:1.3, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{n.libelle}</span>
                    </div>
                  );
                };
                const CatHeader = ({txt, open, onToggle}:{txt:string; open:boolean; onToggle:()=>void})=>(
                  <button onClick={onToggle} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"rgb(var(--bleu-rgb) / 0.04)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 8px", marginTop:6, marginBottom:3 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:"var(--bleu)", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{txt}</span>
                    <ChevronDown size={11} style={{ color:"var(--bleu)", transform:open?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
                  </button>
                );
                let sections: React.ReactNode;
                if (compType==="macro_secteur") {
                  sections = (refs?.macro_secteur||[]).filter(matchS).map(renderItem);
                } else if (compType==="groupe") {
                  sections = (refs?.macro_secteur||[]).map(macro=>{
                    const enfants = groupesDe(macro.id).filter(matchS);
                    if (!enfants.length) return null;
                    const open = compCatOuverts.has(`m${macro.id}`);
                    return <div key={macro.id}><CatHeader txt={macro.libelle} open={open} onToggle={()=>toggleCompCat(`m${macro.id}`)}/>{open&&enfants.map(renderItem)}</div>;
                  });
                } else {
                  sections = (refs?.groupe||[]).map(groupe=>{
                    const enfants = secteursDe(groupe.id).filter(matchS);
                    if (!enfants.length) return null;
                    const open = compCatOuverts.has(`g${groupe.id}`);
                    return <div key={groupe.id}><CatHeader txt={groupe.libelle} open={open} onToggle={()=>toggleCompCat(`g${groupe.id}`)}/>{open&&enfants.map(renderItem)}</div>;
                  });
                }
                return <div style={{ maxHeight:420, overflowY:"auto" as const, display:"flex", flexDirection:"column" as const, gap:1 }}>{sections}</div>;
              })()}

              <div style={{ height:1, background:"var(--fond)", margin:"18px 0" }}/>

              {/* Période */}
              <div style={{ marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
                </div>
                <div style={{ display:"flex", gap:3, background:"var(--fond)", borderRadius:9, padding:3, marginBottom:12 }}>
                  {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                    <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                      style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"var(--carte)":"transparent", color:modeAnnees===m.v?"var(--encre)":"var(--gris)", boxShadow:modeAnnees===m.v?"0 1px 4px rgb(var(--ombre-rgb) / 0.1)":"none" }}>
                      {m.l}
                    </button>
                  ))}
                </div>
                {modeAnnees==="plage" ? (
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                    <div style={{ padding:"4px 0" }}>
                      <CurseurPlageNace min={bornes[0]} max={bornes[1]} debut={anneeMin} fin={anneeMax} ecartMin={0}
                        onChange={(d,f)=>{ setAnneeMin(d); setAnneeMax(f); }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                      <span style={{ fontSize:10, color:"var(--gris)" }}>—</span>
                      <span style={{ fontSize:11, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
                    {(compAnneesData.length?compAnneesData:anneesData).map(a=>{ const s=anneesSpec.includes(a); return (
                      <button key={a} onClick={()=>setAnneesSpec(prev=>s?prev.filter(x=>x!==a):[...prev,a].sort())}
                        style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${s?"var(--bleu)":"var(--bordure-forte)"}`, cursor:"pointer", fontSize:11, fontWeight:s?700:400, textAlign:"center" as const, background:s?"var(--bleu-action)":"var(--carte-douce)", color:s?"var(--sur-bleu)":"var(--texte)" }}>{a}</button>
                    ); })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>

          {/* Recherche */}
          <div style={{ position:"relative" as const, marginBottom:16 }}>
            <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"var(--gris)" }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid var(--bordure-forte)", background:"var(--carte-douce)", fontSize:12, color:"var(--encre)", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
            {search&&<button onClick={()=>setSearch("")} aria-label="Effacer la recherche" style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"var(--gris)" }}/></button>}
          </div>

          {/* Activités */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Activités</span>
              {sel.niveau!=="global"&&(()=>{ const c=BDEF_NIVEAU_STYLE[sel.niveau]?.color||"var(--bleu)"; return <span style={{ fontSize:10, fontWeight:700, color:c, background:`${c}1a`, padding:"1px 6px", borderRadius:999 }}>1</span>; })()}
            </div>

            {/* Global */}
            <BdefRow label="Global des secteurs" selected={sel.niveau==="global"} onSelect={()=>choisir("global",null)} />
            <div style={{ height:1, background:"var(--fond)", margin:"8px 0" }}/>

            {/* Recherche → résultats à plat */}
            {q ? (
              <div style={{ maxHeight:360, overflowY:"auto" as const }}>
                {resultats.length===0 && <p style={{ fontSize:12, color:"var(--gris)", textAlign:"center" as const, padding:"8px 0" }}>Aucun résultat</p>}
                {resultats.map(({niveau,node})=>(
                  <div key={`${niveau}-${node.id}`} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <BdefRow label={node.libelle} niveau={niveau} selected={estSel(niveau,node.id)} onSelect={()=>choisir(niveau,node)} />
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, color:BDEF_NIVEAU_STYLE[niveau]?.color||"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.06em", flexShrink:0, paddingRight:4 }}>{BDEF_NIVEAU_LABEL[niveau]||""}</span>
                  </div>
                ))}
              </div>
            ) : (
              /* Cascade Macro → Groupe → Secteur (arbre avec lignes de guidage) */
              <div style={{ maxHeight:420, overflowY:"auto" as const }}>
                {(refs?.macro_secteur||[]).map(macro=>{
                  const mOpen = openMacros.has(macro.id);
                  return (
                    <div key={macro.id} style={{ marginBottom:1 }}>
                      <BdefRow label={macro.libelle} niveau="macro_secteur" selected={estSel("macro_secteur",macro.id)}
                        onSelect={()=>choisir("macro_secteur",macro)} expandable expanded={mOpen} onToggle={()=>toggleMacro(macro.id)} />
                      {mOpen && (
                        <div style={{ marginLeft:17, borderLeft:"1.5px solid var(--bordure)", paddingLeft:4, marginTop:1 }}>
                          {groupesDe(macro.id).map(groupe=>{
                            const gOpen = openGroupes.has(groupe.id);
                            return (
                              <div key={groupe.id}>
                                <BdefRow label={groupe.libelle} niveau="groupe" selected={estSel("groupe",groupe.id)}
                                  onSelect={()=>choisir("groupe",groupe)} expandable expanded={gOpen} onToggle={()=>toggleGroupe(groupe.id)} />
                                {gOpen && (
                                  <div style={{ marginLeft:17, borderLeft:"1.5px solid var(--bordure)", paddingLeft:4, marginTop:1, marginBottom:3 }}>
                                    {secteursDe(groupe.id).map(secteur=>(
                                      <BdefRow key={secteur.id} label={secteur.libelle} niveau="secteur" selected={estSel("secteur",secteur.id)}
                                        onSelect={()=>choisir("secteur",secteur)} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ height:1, background:"var(--fond)", marginBottom:18 }}/>

          {/* Période */}
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
            </div>
            <div style={{ display:"flex", gap:3, background:"var(--fond)", borderRadius:9, padding:3, marginBottom:12 }}>
              {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                  style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"var(--carte)":"transparent", color:modeAnnees===m.v?"var(--encre)":"var(--gris)", boxShadow:modeAnnees===m.v?"0 1px 4px rgb(var(--ombre-rgb) / 0.1)":"none" }}>
                  {m.l}
                </button>
              ))}
            </div>
            {modeAnnees==="plage" ? (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                <div style={{ padding:"4px 0" }}>
                  <CurseurPlageNace min={bornes[0]} max={bornes[1]} debut={anneeMin} fin={anneeMax} ecartMin={0}
                    onChange={(d,f)=>{ setAnneeMin(d); setAnneeMax(f); }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                  <span style={{ fontSize:10, color:"var(--gris)" }}>—</span>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
                {anneesData.map(a=>{ const s=anneesSpec.includes(a); return (
                  <button key={a} onClick={()=>setAnneesSpec(prev=>s?prev.filter(x=>x!==a):[...prev,a].sort())}
                    style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${s?"var(--bleu)":"var(--bordure-forte)"}`, cursor:"pointer", fontSize:11, fontWeight:s?700:400, textAlign:"center" as const, background:s?"var(--bleu-action)":"var(--carte-douce)", color:s?"var(--sur-bleu)":"var(--texte)" }}>{a}</button>
                ); })}
              </div>
            )}
          </div>

          </>)}
        </div>}
      </aside>

      {/* Zone principale */}
      <div style={{ flex:1, minWidth:0, padding:"36px 40px 80px" }}>
        {sousVue==="comparative" ? (
          /* ── Analyse comparative ── */
          (()=>{
          const compNodes = compType==="groupe" ? (refs?.groupe||[]) : compType==="secteur" ? (refs?.secteur||[]) : (refs?.macro_secteur||[]);
          const nodeDe = (id:number)=>compNodes.find(n=>n.id===id);
          const typeLabel = compType==="groupe" ? "par groupe" : compType==="secteur" ? "par secteur d'activité" : "par macro-secteur";
          const typePluriel = compType==="groupe" ? "groupes" : compType==="secteur" ? "secteurs" : "macro-secteurs";
          const anneesComp = anneesCompAff;
          return (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:compSelec.length>0?10:20, flexWrap:"wrap" as const }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" as const }}>
                <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"var(--encre)", margin:0 }}>Analyse comparative {typeLabel}</h2>
                {anneesComp.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"5px 13px", borderRadius:999, background:"var(--fond-creux2)", border:"1px solid var(--bordure-forte)", fontSize:12, fontWeight:700, color:"var(--encre)", letterSpacing:"0.02em", flexShrink:0 }}>
                  {anneesComp.length===1 ? `${anneesComp[0]}` : `${anneesComp[0]} — ${anneesComp[anneesComp.length-1]}`}
                </span>}
              </div>
              {compSelec.length>0&&!loadingComp&&<button onClick={()=>setShowTable(true)} style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:12.5, fontWeight:700, padding:"8px 16px", borderRadius:999, border:"1px solid var(--bordure-forte)", background:"var(--carte)", color:"var(--bleu)", cursor:"pointer", fontFamily:"var(--font-google-sans)" }} onMouseEnter={e=>{e.currentTarget.style.background="var(--champ)";}} onMouseLeave={e=>{e.currentTarget.style.background="var(--carte)";}}>
                <Table size={14}/> Tableau de données
              </button>}
            </div>
            {compSelec.length>0&&(
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, minWidth:0, flexWrap:"wrap" as const }}>
                {compSelec.map((id,ci)=>{
                  const node = nodeDe(id);
                  const col = BDEF_MACRO_COULEURS[ci%BDEF_MACRO_COULEURS.length];
                  return (
                    <BadgeSerie key={id} i={ci} couleur={col} title={node?.libelle}>
                      <span style={{ maxWidth:260, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{node?.libelle}</span>
                    </BadgeSerie>
                  );
                })}
              </div>
            )}

            {compSelec.length===0 ? (
              <div style={{ textAlign:"center" as const, padding:"70px 20px", color:"var(--gris)" }}>
                <p style={{ fontSize:14, lineHeight:1.7 }}>Sélectionnez jusqu'à 4 {typePluriel} dans le filtre pour comparer leurs données.</p>
              </div>
            ) : loadingComp ? (
              <SkeletonChartGrid n={8} cols={2} height={215}/>
            ) : (
              <>
                <div className="charge-in" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
                  {BDEF_GRAPHES_DEFAUT.map(code=>{
                    const fmt = (v:number|null)=>fmtBdef(v, (compData[compSelec[0]]||[]).find(i=>i.code===code)?.unite||"FCFA");
                    const compAffichees = (modeAnnees==="specifiques"&&anneesSpec.length>0)
                      ? anneesSpec.filter(a=>compAnneesData.includes(a))
                      : compAnneesData.filter(a=>a>=anneeMin && a<=anneeMax);
                    const series = compSelec.map((id,ci)=>{
                      const inds = compData[id]||[];
                      const ind = inds.find(i=>i.code===code);
                      const node = nodeDe(id);
                      return { nom:node?.libelle||String(id), couleur:BDEF_MACRO_COULEURS[ci%BDEF_MACRO_COULEURS.length], data:compAffichees.map(a=>({ annee:a, valeur:(ind?.valeurs[a]??null) as number|null })) };
                    }).filter(s=>s.data.some(d=>d.valeur!==null));
                    if (!series.length) return null;
                    return (
                      <GrapheCard key={code} titre={(compData[compSelec[0]]||[]).find(i=>i.code===code)?.libelle||code} series={series} grapheId={code} hideLegend hideSousTitre
                        fullChildren={<GrapheMultiPays series={series} height={340} type="line" fmt={fmt} lineWidth={1.6}/>}>
                        <GrapheMultiPays series={series} height={130} type="line" fmt={fmt} showDots={false} lineWidth={1.4}/>
                      </GrapheCard>
                    );
                  }).filter(Boolean)}
                </div>
              </>
            )}
          </div>
          );
          })()
        ) : (
        <>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap" as const, gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:couleur, flexShrink:0 }} />
            <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"var(--encre)", margin:0 }}>{sel.libelle}</h2>
            {BDEF_NIVEAU_LABEL[sel.niveau]&&<span style={{ display:"inline-flex", alignItems:"center", padding:"1px 7px", borderRadius:5, background:"var(--fond)", border:"1px solid var(--bordure-forte)", fontSize:9, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.05em", flexShrink:0 }}>
              {BDEF_NIVEAU_LABEL[sel.niveau]}
            </span>}
            {anneesAffichees.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"5px 13px", borderRadius:999, background:"var(--fond-creux2)", border:"1px solid var(--bordure-forte)", fontSize:12, fontWeight:700, color:"var(--encre)", letterSpacing:"0.02em", flexShrink:0 }}>
              {anneesAffichees[0]} — {anneesAffichees[anneesAffichees.length-1]}
            </span>}
          </div>
          {indicateurs.length>0&&<button onClick={()=>setShowTable(true)} style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:12.5, fontWeight:700, padding:"8px 16px", borderRadius:999, border:"1px solid var(--bordure-forte)", background:"var(--carte)", color:"var(--bleu)", cursor:"pointer", fontFamily:"var(--font-google-sans)" }} onMouseEnter={e=>{e.currentTarget.style.background="var(--champ)";}} onMouseLeave={e=>{e.currentTarget.style.background="var(--carte)";}}>
            <Table size={14}/> Tableau de données
          </button>}
        </div>

        {/* KPI cards — remplaçables via l'icône révélée au survol */}
        {kpisEpingles.length>0&&(
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
            <style>{STYLE_KPI_SWAP}</style>
            {kpisEpingles.map((code,slot)=>{
              const ind = indicateurs.find(i=>i.code===code);
              const lastA = anneesAffichees.length ? anneesAffichees[anneesAffichees.length-1] : null;
              const v = ind&&lastA!==null ? (ind.valeurs[lastA]??null) : null;
              const pickerOuvert = pickerSlot === slot;
              return (
                <div key={code} className="kpi-card" onClick={()=>ind&&setKpiActif(ind)}
                  style={{ position:"relative", background:"var(--carte)", borderRadius:14, padding:"13px 14px", border:`1px solid ${pickerOuvert?"rgb(var(--bleu-rgb) / 0.35)":"rgb(var(--encre-rgb) / 0.12)"}`, cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"none", minWidth:0, zIndex:pickerOuvert?5:undefined }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="var(--ombre-1)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor="rgb(var(--bleu-rgb) / 0.35)";}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor=pickerOuvert?"rgb(var(--bleu-rgb) / 0.35)":"rgb(var(--encre-rgb) / 0.12)";}}>
                  {/* Remplacer ce KPI — icône révélée au survol de la card */}
                  <BtnSwapKpi ouvert={pickerOuvert} onClick={()=>setPickerSlot(pickerOuvert?-1:slot)}/>
                  <p style={{ fontSize:9, fontWeight:800, color:couleur, textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:7, lineHeight:1.4, paddingRight:26 }}>{ind?.libelle??code}</p>
                  <p style={{ fontSize:"1.05rem", fontWeight:800, color:"var(--encre)", lineHeight:1.15 }}>{ind?fmtBdef(v,ind.unite,true):"—"}</p>
                  {lastA&&<p style={{ fontSize:10, color:"var(--gris)", marginTop:5, lineHeight:1 }}>en {lastA}</p>}
                  {pickerOuvert && (
                    <PickerKpi items={pickerItems} alignDroite={slot>=2}
                      onPick={c=>remplacerKpi(slot,c)} onClose={()=>setPickerSlot(-1)}/>
                  )}
                </div>
              );
            })}
            {Array.from({length:Math.max(0,4-kpisEpingles.length)}).map((_,i)=>{
              const slot = kpisEpingles.length + i;
              const pickerOuvert = pickerSlot === slot;
              return (
                <div key={`empty-${i}`} data-picker-trigger onClick={()=>setPickerSlot(pickerOuvert?-1:slot)}
                  style={{ position:"relative", background:"var(--carte)", borderRadius:14, padding:"13px 14px", border:`1.5px dashed ${pickerOuvert?"var(--bleu)":"var(--bordure-forte)"}`, display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", gap:4, minHeight:90, cursor:"pointer", transition:"border-color 0.15s", zIndex:pickerOuvert?5:undefined }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--bleu)"; }}
                  onMouseLeave={e=>{ if(!pickerOuvert) e.currentTarget.style.borderColor="var(--bordure-forte)"; }}>
                  <span style={{ fontSize:20, color:pickerOuvert?"var(--bleu)":"var(--gris)", lineHeight:1 }}>+</span>
                  <span style={{ fontSize:10, color:pickerOuvert?"var(--bleu)":"var(--gris)", textAlign:"center" as const, lineHeight:1.5 }}>Ajouter un<br/>indicateur</span>
                  {pickerOuvert && (
                    <PickerKpi items={pickerItems} alignDroite={slot>=2}
                      onPick={c=>remplacerKpi(slot,c)} onClose={()=>setPickerSlot(-1)}/>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Graphes — floutés tant qu'un picker de remplacement de KPI est ouvert */}
        <div style={{ filter: pickerSlot!==-1 ? "blur(4px)" : "none", opacity: pickerSlot!==-1 ? 0.6 : 1, pointerEvents: pickerSlot!==-1 ? "none" : "auto", transition: "filter 0.2s, opacity 0.2s" }}>
        {loading ? (
          <SkeletonChartGrid n={8} cols={2} height={215}/>
        ) : erreur ? (
          <ErreurChargement onRetry={() => setTick(t => t + 1)} />
        ) : indicateurs.length===0 ? (
          <div style={{ textAlign:"center" as const, padding:"70px 20px", color:"var(--gris)" }}>
            <p style={{ fontSize:14, lineHeight:1.7 }}>Aucune donnée pour cette sélection.<br/>Importez les fichiers BDEF dans l'administration.</p>
          </div>
        ) : (
          <div className="charge-in" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
            {BDEF_GRAPHES_DEFAUT
              .map(code=>indicateurs.find(i=>i.code===code))
              .filter((i):i is BdefIndic=>!!i)
              .map((ind)=>{
                const fmt = (v:number|null)=>fmtBdef(v,ind.unite);
                const isGlobal = sel.niveau==="global" && macroIndicateurs.length>0;
                let series;
                if (isGlobal) {
                  // Comparaison des 4 macro-secteurs (Industries en bleu)
                  series = macroIndicateurs.map((m,mi)=>{
                    const mInd = m.inds.find(i=>i.code===ind.code);
                    return { nom:m.libelle, couleur:BDEF_MACRO_COULEURS[mi%BDEF_MACRO_COULEURS.length], data:anneesAffichees.map(a=>({ annee:a, valeur:(mInd?.valeurs[a]??null) as number|null })) };
                  });
                } else {
                  series = [{ nom:ind.libelle, couleur, data:anneesAffichees.map(a=>({ annee:a, valeur:(ind.valeurs[a]??null) as number|null })) }];
                }
                return (
                  <GrapheCard key={ind.code} titre={ind.libelle} series={series} grapheId={ind.code} hideLegend hideSousTitre
                    fullChildren={<GrapheMultiPays series={series} height={340} type="line" fmt={fmt} lineWidth={isGlobal?1.6:undefined}/>}>
                    <GrapheMultiPays series={series} height={130} type="line" fmt={fmt} showDots={false} lineWidth={isGlobal?1.4:undefined}/>
                  </GrapheCard>
                );
              })}
          </div>
        )}
        </div>
        </>
        )}
      </div>

      <ModalBdefTable open={showTable} onClose={()=>setShowTable(false)}
        annees={sousVue==="comparative" ? anneesCompAff : anneesAffichees}
        blocs={sousVue==="comparative"
          ? compSelec.map((id,ci)=>{
              const nodes = compType==="groupe" ? (refs?.groupe||[]) : compType==="secteur" ? (refs?.secteur||[]) : (refs?.macro_secteur||[]);
              const n = nodes.find(x=>x.id===id);
              return { libelle:n?.libelle||String(id), couleur:BDEF_MACRO_COULEURS[ci%BDEF_MACRO_COULEURS.length], indicateurs:compData[id]||[] };
            })
          : [{ libelle:sel.libelle, couleur, indicateurs }]} />
      <MiniModalBdefKpi ind={kpiActif} annees={anneesAffichees} libelle={sel.libelle} onClose={()=>setKpiActif(null)} />
    </div>
  );
}

export default OngletNational;
