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
import PickerKpi, { BtnSwapKpi, STYLE_KPI_SWAP, type PickerItem } from "@/components/shared/PickerKpi";
import { HBarChart } from "@/components/charts/HBarChart";
import { DivergingBars } from "@/components/charts/DivergingBars";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Couleurs par pays ─────────────────────────────────────────────────────────
const PAYS_COLORS: Record<string,string> = {
  "Sénégal":  "#188038",
  "Cameroun": "#3b6bcc",
};
const PALETTE = ["#188038","#3b6bcc","#e07a2e","#7c3aed","#0891b2","#dc2626","#d97706","#059669"];
function getPaysColor(nom: string, index: number): string {
  return PAYS_COLORS[nom] || PALETTE[index % PALETTE.length];
}

// Valeurs CNUCED en millions USD → formatteur partagé (fr-FR, « Md $ / M $ »)
const fmtVal = fmtMillionsUSD;

// ── Pastilles d'en-tête (période + séries) — styles badge_* de la plateforme ──
// Les 4 premières séries suivent les 4 teintes canoniques ; au-delà, badgeDe().
const BADGES_4 = [badge_bleu, badge_orange, badge_vert, badge_violet];
function BadgePeriode({ children }: { children: React.ReactNode }) {
  return <span style={{ ...badge_gris, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" as const }}>{children}</span>;
}
function BadgeSerie({ i, couleur, title, children }: { i: number; couleur: string; title?: string; children: React.ReactNode }) {
  return (
    <span title={title} style={{ ...(BADGES_4[i] ?? badgeDe(couleur)), fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" as const }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: couleur, display: "inline-block", flexShrink: 0 }} />
      {children}
    </span>
  );
}

// Séries par sous-type de données IDE (graphes, tableau de données, export).
// entrant = destination/ventes, sortant = source/achats selon la catégorie.
const SERIES_TYPES: Record<string, { dir: string; ind: string; label: string; unite: "musd" | "nombre" }[]> = {
  fluxstock: [
    { dir: "entrant", ind: "flux",  label: "Flux entrants", unite: "musd" },
    { dir: "sortant", ind: "flux",  label: "Flux sortants", unite: "musd" },
    { dir: "entrant", ind: "stock", label: "Stock entrant", unite: "musd" },
    { dir: "sortant", ind: "stock", label: "Stock sortant", unite: "musd" },
  ],
  greenfield: [
    { dir: "entrant", ind: "greenfield_valeur", label: "Valeur des investissements greenfield reçus",             unite: "musd" },
    { dir: "sortant", ind: "greenfield_valeur", label: "Investissements greenfield émis à l'étranger", unite: "musd" },
    { dir: "entrant", ind: "greenfield_nombre", label: "Nombre de projets greenfield reçus",                      unite: "nombre" },
    { dir: "sortant", ind: "greenfield_nombre", label: "Nombre de projets greenfield émis à l'étranger",          unite: "nombre" },
  ],
  fusion: [
    { dir: "entrant", ind: "ma_valeur", label: "Valeur des rachats d'entreprises locales", unite: "musd" },
    { dir: "sortant", ind: "ma_valeur", label: "Valeur des acquisitions à l'étranger",     unite: "musd" },
    { dir: "entrant", ind: "ma_nombre", label: "Nombre de rachats d'entreprises locales",  unite: "nombre" },
    { dir: "sortant", ind: "ma_nombre", label: "Nombre d'acquisitions à l'étranger",       unite: "nombre" },
  ],
  // Vue Secteurs — greenfield sans direction (« total »), M&A ventes / achats
  secteur_greenfield: [
    { dir: "total", ind: "greenfield_valeur", label: "Valeur des projets annoncés", unite: "musd" },
    { dir: "total", ind: "greenfield_nombre", label: "Nombre de projets annoncés",  unite: "nombre" },
  ],
  secteur_fusion: [
    { dir: "entrant", ind: "ma_valeur", label: "Valeur des ventes nettes",  unite: "musd" },
    { dir: "sortant", ind: "ma_valeur", label: "Valeur des achats nets",    unite: "musd" },
    { dir: "entrant", ind: "ma_nombre", label: "Nombre de ventes",          unite: "nombre" },
    { dir: "sortant", ind: "ma_nombre", label: "Nombre d'achats",           unite: "nombre" },
  ],
};
const fmtNombre = (v: number | null) => v === null || v === undefined ? "N/A" : Math.round(v).toLocaleString("fr-FR");

// ── Navigation entre catégories d'investissement ──────────────────────────────
// Sélecteur principal de la zone de contenu : Flux & Stocks / Greenfield / M&A.
const SOUS_TYPE_NAV = [
  { v: "fluxstock",  l: "Flux & Stocks" },
  { v: "greenfield", l: "Greenfield" },
  { v: "fusion",     l: "Fusion & Acquisition" },
] as const;

// ── Sélecteur VUE (Pays / Secteurs) + TYPE D'ANALYSE (barre de filtre) ────────
function SelecteurVueAnalyse({ vueP, setVueP, typeAnalyse, setTypeAnalyse, allerAnalyse }: {
  vueP: string; setVueP: (v: "pays"|"secteurs") => void;
  typeAnalyse: string; setTypeAnalyse: (v: any) => void;
  // Depuis la vue Secteurs, aller à Pays/Monde règle le sousOnglet du parent
  allerAnalyse?: (v: "pays"|"monde") => void;
}) {
  // VUE unifiée : Pays · Monde · Secteurs. Le « Type d'analyse » dédié a
  // disparu (la comparaison Pays se fait via le « + » de l'en-tête) ; seule la
  // vue Secteurs garde sa bascule Analyse sectorielle / comparative.
  const vueActive = vueP === "secteurs" ? "secteurs" : typeAnalyse; // "pays" | "monde" | "secteurs"
  const choisir = (v: "pays"|"monde"|"secteurs") => {
    if (v === "secteurs") { setVueP("secteurs"); return; }
    setVueP("pays");
    if (vueP === "secteurs") allerAnalyse?.(v);
    else setTypeAnalyse(v); // ici typeAnalyse EST le sousOnglet (pays/monde)
  };
  const btn = (actif: boolean): React.CSSProperties => ({
    textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12,
    fontWeight: actif ? 700 : 500, background: actif ? "rgba(0,79,145,0.08)" : "transparent",
    color: actif ? "#004f91" : "#4a5568", fontFamily: "var(--font-google-sans)",
  });
  return (
    <>
      <div style={{ marginBottom:16, paddingBottom:14, borderBottom:"1px solid #F2F0EF" }}>
        <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Vue</p>
        <div style={{ display:"flex", flexDirection:"column" as const, gap:2 }}>
          {([{ v:"pays", l:"Pays" }, { v:"monde", l:"Monde" }, { v:"secteurs", l:"Secteurs" }] as const).map(o => (
            <button key={o.v} onClick={() => choisir(o.v)} style={btn(vueActive === o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
      {vueP === "secteurs" && (
        <div style={{ marginBottom:16, paddingBottom:14, borderBottom:"1px solid #F2F0EF" }}>
          <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Type d&apos;analyse</p>
          <div style={{ display:"flex", flexDirection:"column" as const, gap:2 }}>
            {[{ v: "secteur", l: "Analyse sectorielle" }, { v: "comparative", l: "Analyse comparative" }].map(o => (
              <button key={o.v} onClick={() => setTypeAnalyse(o.v)} style={btn(typeAnalyse === o.v)}>{o.l}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Bouton « + » d'ajout de pays à comparer (vue Pays) ───────────────────────
// Rond en pointillés à côté du pays de référence : popover avec recherche et
// liste groupée par continent ; jusqu'à 3 pays en plus (4 séries max). Le
// popover reste ouvert pour enchaîner les ajouts.
function BtnAjoutPaysComp({ paysDispo, exclus, plein, onPick, onOpenChange }: {
  paysDispo: any[]; exclus: string[]; plein: boolean; onPick: (nom: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(""); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  // Le parent floute le contenu derrière le popover
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  // Sélection au complet (4 pays) : fermeture automatique
  useEffect(() => { if (plein && open) { setOpen(false); setQ(""); } }, [plein, open]);

  const dispo = paysDispo.filter((p: any) => !exclus.includes(p.nom)
    && (!q || p.nom.toLowerCase().includes(q.toLowerCase())));
  const groupes = Object.entries(
    dispo.reduce((acc: any, p: any) => { const c = p.continent || "Autre"; (acc[c] ||= []).push(p); return acc; }, {})
  ).sort(([a], [b]) => (a as string).localeCompare(b as string));

  return (
    <div ref={ref} style={{ position:"relative", display:"inline-flex" }}>
      <button onClick={() => !plein && setOpen(o => !o)} disabled={plein}
        aria-label="Comparer avec d'autres pays" title={plein ? "4 pays maximum" : "Comparer avec d'autres pays"}
        style={{ width:28, height:28, borderRadius:999, border:`1.5px dashed ${plein ? "#D8D4D0" : open ? "#004f91" : "rgba(0,79,145,0.35)"}`,
          background: open ? "rgba(0,79,145,0.08)" : "rgba(255,255,255,0.7)", color: plein ? "#C5BFBB" : "#004f91",
          cursor: plein ? "not-allowed" : "pointer",
          display:"inline-flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s", flexShrink:0 }}
        onMouseEnter={e => { if (!plein) { e.currentTarget.style.borderColor = "#004f91"; e.currentTarget.style.background = "rgba(0,79,145,0.08)"; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = plein ? "#D8D4D0" : "rgba(0,79,145,0.35)"; e.currentTarget.style.background = "rgba(255,255,255,0.7)"; } }}>
        <Plus size={14}/>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:60, width:300,
          border:"1px solid #E4E1DE", borderRadius:12, background:"#fff", boxShadow:"var(--ombre-2)", overflow:"hidden" }}>
          <div style={{ padding:8, borderBottom:"1px solid #F2F0EF" }}>
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un pays…"
              style={{ width:"100%", boxSizing:"border-box" as const, background:"#FCFCFB", borderWidth:1, borderStyle:"solid", borderColor:"#E2E1DE", borderRadius:9, padding:"8px 11px", fontSize:12.5, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)" }} />
          </div>
          <div style={{ maxHeight:240, overflowY:"auto" as const }}>
            {groupes.map(([continent, pays]: any) => (
              <div key={continent}>
                <div style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.04)", padding:"5px 12px", letterSpacing:"0.1em", textTransform:"uppercase" as const, position:"sticky" as const, top:0 }}>{continent}</div>
                {pays.map((p: any) => (
                  <button key={p.nom} onClick={() => { onPick(p.nom); setQ(""); inputRef.current?.focus(); }}
                    style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"7px 14px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left" as const, borderBottom:"1px solid #F2F0EF", transition:"background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,79,145,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize:12, color:"#1a1a2e", fontWeight:500 }}>{p.nom}</span>
                  </button>
                ))}
              </div>
            ))}
            {dispo.length === 0 && <p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center" as const, padding:"14px 0" }}>Aucun pays trouvé</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function SousTypeNav({ value, onChange, options }: { value: string; onChange: (v: "fluxstock"|"greenfield"|"fusion") => void; options?: readonly { v: "fluxstock"|"greenfield"|"fusion"; l: string }[] }) {
  return (
    <div style={{ display:"inline-flex", background:"#fff", border:"1px solid #ECEAE7", borderRadius:999, padding:3, gap:3, boxShadow:"var(--ombre-1)" }}>
      {(options ?? SOUS_TYPE_NAV).map(o => {
        const actif = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)}
            style={{ padding:"6px 18px", borderRadius:999, border:"none", cursor:"pointer", fontSize:12.5, fontWeight:700, whiteSpace:"nowrap" as const,
              background: actif ? "#004f91" : "transparent",
              color: actif ? "#fff" : "#4a5568",
              boxShadow: actif ? "0 2px 8px rgba(0,79,145,0.30), inset 0 1px 0 rgba(255,255,255,0.12)" : "none",
              transition:"background 0.18s, box-shadow 0.18s, color 0.18s", fontFamily:"var(--font-google-sans)" }}
            onMouseEnter={e => { if (!actif) e.currentTarget.style.background = "#F6F5F3"; }}
            onMouseLeave={e => { if (!actif) e.currentTarget.style.background = "transparent"; }}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

// Bornes de période des séries CNUCED — valeurs de repli avant la réponse API
const ANNEE_MIN = 1990;
const ANNEE_MAX = 2025;

// Bornes réelles depuis l'API, par catégorie de données (fluxstock /
// greenfield / fusion) : sliders et pastilles s'alignent sur la couverture du
// sous-type actif, et s'étendent automatiquement à chaque nouvel import.
function useBornesCnuced(sousType: string = "fluxstock"): [number, number] {
  const [annees, setAnnees] = useState<any>(null);
  useEffect(() => {
    fetch(`${API}/ide/cnuced/annees`).then(r => r.json()).then(setAnnees).catch(() => {});
  }, []);
  const cat = annees?.categories?.[sousType];
  return [
    cat?.annee_min ?? annees?.annee_min ?? ANNEE_MIN,
    cat?.annee_max ?? annees?.annee_max ?? ANNEE_MAX,
  ];
}

// ── Graphe D3 multi-pays ──────────────────────────────────────────────────────
function GrapheMultiPays(props: {
  series: { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] }[];
  height?: number; type?: "line" | "bar"; titre?: string;
  fmt?: (v: number | null) => string; showDots?: boolean; lineWidth?: number;
}) {
  return <GrapheSignature {...props} fmt={props.fmt || fmtVal} />;
}

// ── Top 10 des années par flux entrants — barres classées ─────────────────────
function TopAnneesFlux({ rows, grand }: { rows: { annee: number; valeur: number }[]; grand?: boolean }) {
  const max = rows.length ? rows[0].valeur : 1;
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: grand ? 8 : 4.5, padding: grand ? "4px 2px" : "2px 2px 0" }}>
      {rows.map((r, i) => (
        <div key={r.annee} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 16, fontSize: grand ? 11 : 9.5, fontWeight: 800, color: i < 3 ? "#004f91" : "#C5BFBB", textAlign: "right" as const, flexShrink: 0 }}>{i + 1}</span>
          <span style={{ width: 32, fontSize: grand ? 12 : 10.5, fontWeight: 700, color: "#1a1a2e", flexShrink: 0 }}>{r.annee}</span>
          <div style={{ flex: 1, height: grand ? 12 : 8, background: "#F2F0EF", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(2, r.valeur / max * 100)}%`, borderRadius: 99,
              background: i === 0 ? "linear-gradient(90deg,#004f91,#2e7cc0)" : "#004f91", opacity: i === 0 ? 1 : Math.max(0.35, 1 - i * 0.08) }} />
          </div>
          <span style={{ width: grand ? 86 : 68, fontSize: grand ? 11.5 : 10, fontWeight: 700, color: "#004f91", textAlign: "right" as const, flexShrink: 0, whiteSpace: "nowrap" as const }}>{fmtVal(r.valeur)}</span>
        </div>
      ))}
      {rows.length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center" as const, padding: "20px 0" }}>Aucune donnée</p>}
    </div>
  );
}

// ── Card tableau des nombres de projets (greenfield / M&A, vue Pays) ──────────
// Les 7 dernières années non nulles en tableau (année · nombre · Δ vs N-1 ·
// barre). Le curseur « Explorer » montre en direct l'année visée (valeur et
// variation dans la barre) sans toucher au tableau ; l'épinglage — depuis le
// curseur ou au survol d'une ligne — fige des années en tête (triées) pour
// les comparer, avec bilan dès 2 épingles. L'année record est signalée.
function CarteTableauAnnees({ titre, rows }: { titre: string; rows: { annee: number; valeur: number | null }[] }) {
  const [epingles, setEpingles] = useState<number[]>([]);
  // Position flottante du curseur : le pouce glisse en continu, l'année
  // affichée est l'arrondi — le glissement reste parfaitement fluide.
  const [posCurseur, setPosCurseur] = useState<number | null>(null);

  const valides = rows.filter(r => r.valeur !== null).sort((a, b) => a.annee - b.annee) as { annee: number; valeur: number }[];
  const valMap = new Map(valides.map(r => [r.annee, r.valeur]));
  const nonNulles = valides.filter(r => r.valeur !== 0);
  const base7 = [...nonNulles.slice(-7)].reverse();
  const maxVal = Math.max(1, ...nonNulles.map(r => r.valeur));
  const anneeRecord = nonNulles.length ? nonNulles.reduce((m, r) => r.valeur > m.valeur ? r : m).annee : null;
  const anMin = valides.length ? valides[0].annee : 0;
  const anMax = valides.length ? valides[valides.length - 1].annee : 0;
  const anCurseur = Math.round(posCurseur ?? anMax);

  // Variation vs l'année précédente disposant d'une valeur
  const deltaDe = (annee: number): number | null => {
    const v = valMap.get(annee);
    if (v === undefined) return null;
    const avant = valides.filter(r => r.annee < annee);
    if (!avant.length) return null;
    const prec = avant[avant.length - 1];
    return prec.valeur === 0 ? null : (v - prec.valeur) / Math.abs(prec.valeur) * 100;
  };

  const togglePin = (annee: number) =>
    setEpingles(prev => prev.includes(annee) ? prev.filter(a => a !== annee) : [...prev, annee]);

  // Tableau : années épinglées en tête (triées, hors fenêtre comprises),
  // puis la fenêtre des 7 dernières non nulles
  const lignesPin = [...epingles].sort((a, b) => b - a);
  const lignesBase = base7.filter(r => !epingles.includes(r.annee)).map(r => r.annee);

  // Bilan de comparaison : plus ancienne → plus récente des années épinglées valorisées
  const bilan = (() => {
    const avecVal = [...epingles].filter(a => valMap.has(a)).sort((a, b) => a - b);
    if (avecVal.length < 2) return null;
    const de = avecVal[0], vers = avecVal[avecVal.length - 1];
    const v0 = valMap.get(de)!, v1 = valMap.get(vers)!;
    return { de, vers, v0, v1, diff: v1 - v0, pct: v0 !== 0 ? (v1 - v0) / Math.abs(v0) * 100 : null };
  })();

  const Delta = ({ delta, taille = 9.5 }: { delta: number | null; taille?: number }) => (
    <span style={{ fontSize: taille, fontWeight: 700, whiteSpace: "nowrap" as const,
      color: delta === null ? "#C5BFBB" : delta > 0 ? "#188038" : delta < 0 ? "#dc2626" : "#9aa5b4" }}>
      {delta === null ? "—" : `${delta > 0 ? "▲" : delta < 0 ? "▼" : "="} ${Math.abs(delta).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`}
    </span>
  );

  const Ligne = ({ annee, epinglee }: { annee: number; epinglee: boolean }) => {
    const v = valMap.get(annee);
    return (
      <div className="ligne-annee" style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 8, background: epinglee ? "rgba(0,79,145,0.06)" : "transparent", transition: "background 0.12s" }}>
        {/* Épingle : pleine sur les lignes figées, fantôme au survol des autres */}
        <button className={epinglee ? undefined : "pin-fantome"} onClick={() => togglePin(annee)}
          aria-label={epinglee ? `Désépingler ${annee}` : `Épingler ${annee}`} title={epinglee ? "Désépingler" : "Épingler cette année"}
          style={{ width: 14, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: epinglee ? "#004f91" : "#C5BFBB", flexShrink: 0 }}>
          <Pin size={11} fill={epinglee ? "#004f91" : "none"} />
        </button>
        <span style={{ width: 34, fontSize: 11, fontWeight: epinglee ? 800 : 600, color: "#1a1a2e", flexShrink: 0 }}>{annee}</span>
        <span style={{ width: 34, fontSize: 11, fontWeight: 800, color: v === undefined ? "#C5BFBB" : "#004f91", textAlign: "right" as const, flexShrink: 0 }}>{v === undefined ? "—" : fmtNombre(v)}</span>
        <span style={{ width: 58, textAlign: "right" as const, flexShrink: 0 }}><Delta delta={deltaDe(annee)} /></span>
        <div style={{ flex: 1, height: 7, background: "#F2F0EF", borderRadius: 99, overflow: "hidden" }}>
          {v !== undefined && v > 0 && <div style={{ height: "100%", width: `${Math.max(2, v / maxVal * 100)}%`, borderRadius: 99, background: "#004f91", opacity: epinglee ? 1 : 0.55 }} />}
        </div>
        {annee === anneeRecord
          ? <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: "0.08em", color: "#ca631f", background: "rgba(202,99,31,0.10)", padding: "2px 6px", borderRadius: 999, flexShrink: 0 }}>RECORD</span>
          : <span style={{ width: 46, flexShrink: 0 }} />}
      </div>
    );
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(16,26,46,0.12)", padding: "16px 18px", minWidth: 0, display: "flex", flexDirection: "column" as const, gap: 10 }}>
      <style>{`.ligne-annee .pin-fantome{opacity:0;transition:opacity .12s}
.ligne-annee:hover{background:rgba(0,79,145,0.03)}
.ligne-annee:hover .pin-fantome{opacity:1}`}</style>
      <h3 style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{titre}</h3>
      {valides.length === 0 ? (
        <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center" as const, padding: "26px 0" }}>Aucune donnée</p>
      ) : (
        <>
          {/* Curseur d'exploration : l'année visée s'affiche ici (valeur + Δ), l'épingle la fige dans le tableau */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FAFAF9", border: "1px solid #F0EEEC", borderRadius: 10, padding: "7px 11px" }}>
            <input type="range" min={anMin} max={anMax} step="any" defaultValue={anMax}
              onInput={e => setPosCurseur(Number((e.target as HTMLInputElement).value))}
              aria-label="Explorer une année"
              style={{ flex: 1, accentColor: "#004f91", cursor: "pointer", minWidth: 0 }} />
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "2px 9px", borderRadius: 999, flexShrink: 0 }}>{anCurseur}</span>
            <button onClick={() => togglePin(anCurseur)}
              title={epingles.includes(anCurseur) ? "Désépingler" : "Épingler cette année dans le tableau"}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
                background: epingles.includes(anCurseur) ? "#004f91" : "rgba(0,79,145,0.08)", color: epingles.includes(anCurseur) ? "#fff" : "#004f91", fontFamily: "var(--font-google-sans)" }}>
              <Pin size={10} fill={epingles.includes(anCurseur) ? "#fff" : "none"} />
              {epingles.includes(anCurseur) ? "Épinglée" : "Épingler"}
            </button>
          </div>

          {/* En-tête du tableau */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
            <span style={{ width: 14, flexShrink: 0 }} />
            <span style={{ width: 34, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase" as const, flexShrink: 0 }}>Année</span>
            <span style={{ width: 34, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>Nb</span>
            <span style={{ width: 58, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>vs N-1</span>
            <span style={{ flex: 1 }} />
            <span style={{ width: 46, flexShrink: 0 }} />
          </div>

          {/* Années épinglées (triées) puis fenêtre des 7 dernières non nulles */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
            {lignesPin.map(a => <Ligne key={`p${a}`} annee={a} epinglee />)}
            {lignesPin.length > 0 && lignesBase.length > 0 && <div style={{ height: 1, background: "#F2F0EF", margin: "3px 8px" }} />}
            {lignesBase.map(a => <Ligne key={a} annee={a} epinglee={false} />)}
          </div>

          {/* Bilan de comparaison entre années épinglées */}
          {bilan && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.14)", borderRadius: 10, padding: "6px 11px", fontSize: 10.5, flexWrap: "wrap" as const }}>
              <span style={{ fontWeight: 800, color: "#004f91" }}>{bilan.de}</span>
              <span style={{ color: "#9aa5b4" }}>({fmtNombre(bilan.v0)})</span>
              <span style={{ color: "#9aa5b4" }}>→</span>
              <span style={{ fontWeight: 800, color: "#004f91" }}>{bilan.vers}</span>
              <span style={{ color: "#9aa5b4" }}>({fmtNombre(bilan.v1)})</span>
              <span style={{ marginLeft: "auto", fontWeight: 800, color: bilan.diff > 0 ? "#188038" : bilan.diff < 0 ? "#dc2626" : "#9aa5b4" }}>
                {bilan.diff > 0 ? "▲" : bilan.diff < 0 ? "▼" : "="} {bilan.diff > 0 ? "+" : ""}{fmtNombre(bilan.diff)}
                {bilan.pct !== null && ` (${bilan.pct > 0 ? "+" : ""}${bilan.pct.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %)`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ── Card tableau comparatif des nombres de projets (vue Pays, comparatif) ─────
// Une ligne par pays (pastille couleur · nombre · Δ vs N-1 · part · barre),
// triées par valeur. Le curseur bascule entre le Cumul de la période (tout à
// droite) et chaque année en glissant vers la gauche — sans requête, tout est
// déjà chargé.
function CarteTableauComparatif({ titre, series }: {
  titre: string;
  series: { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] }[];
}) {
  const [annee, setAnnee] = useState<number | null>(null);

  const annees = [...new Set(series.flatMap(s => s.data.filter(d => d.valeur !== null).map(d => d.annee)))].sort((a, b) => a - b);
  const n = annees.length;
  // Valeur d'un pays : somme de la période (Cumul) ou valeur de l'année
  const valeurDe = (s: typeof series[number]): number | null => {
    if (annee === null) {
      const vs = s.data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[];
      return vs.length ? vs.reduce((t, d) => t + d.valeur, 0) : null;
    }
    return s.data.find(d => d.annee === annee)?.valeur ?? null;
  };
  const deltaDe = (s: typeof series[number]): number | null => {
    if (annee === null) return null;
    const v = s.data.find(d => d.annee === annee)?.valeur;
    if (v === null || v === undefined) return null;
    const avant = s.data.filter(d => d.valeur !== null && d.annee < annee) as { annee: number; valeur: number }[];
    if (!avant.length) return null;
    const prec = avant[avant.length - 1];
    return prec.valeur === 0 ? null : (v - prec.valeur) / Math.abs(prec.valeur) * 100;
  };
  const lignes = series.map(s => ({ ...s, valeur: valeurDe(s), delta: deltaDe(s) }))
    .sort((a, b) => (b.valeur ?? -1) - (a.valeur ?? -1));
  const total = lignes.reduce((t, l) => t + Math.max(0, l.valeur ?? 0), 0);
  const max = Math.max(1e-9, ...lignes.map(l => l.valeur ?? 0));

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(16,26,46,0.12)", padding: "16px 18px", minWidth: 0, display: "flex", flexDirection: "column" as const, gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
        <h3 style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{titre}</h3>
        {n >= 2 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <input type="range" min={0} max={n} step="any" defaultValue={n}
              onInput={e => { const i = Math.round(Number((e.target as HTMLInputElement).value)); setAnnee(i >= n ? null : annees[i]); }}
              aria-label="Cumul ou année"
              style={{ width: 150, accentColor: "#004f91", cursor: "pointer" }} />
            <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 11px", borderRadius: 999, background: "#004f91", color: "#fff", flexShrink: 0, minWidth: 44, textAlign: "center" as const }}>
              {annee ?? "Cumul"}
            </span>
          </span>
        )}
      </div>

      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
        <span style={{ flex: 1, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase" as const }}>Pays</span>
        <span style={{ width: 44, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>Nb</span>
        <span style={{ width: 56, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>vs N-1</span>
        <span style={{ width: 44, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>Part</span>
        <span style={{ width: "30%", flexShrink: 0 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
        {lignes.map((l, i) => {
          const zebre = i % 2 === 1;
          return (
            <div key={l.nom} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: zebre ? "#F8F9FB" : "transparent", transition: "background 0.12s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = zebre ? "#F8F9FB" : "transparent"; }}>
              <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.couleur, flexShrink: 0 }} />
                <span title={l.nom} style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{l.nom}</span>
              </span>
              <span style={{ width: 44, fontSize: 11.5, fontWeight: 800, color: l.valeur === null ? "#C5BFBB" : "#004f91", textAlign: "right" as const, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{l.valeur === null ? "—" : fmtNombre(l.valeur)}</span>
              <span style={{ width: 56, fontSize: 9.5, fontWeight: 700, textAlign: "right" as const, flexShrink: 0, whiteSpace: "nowrap" as const,
                color: l.delta === null ? "#C5BFBB" : l.delta > 0 ? "#188038" : l.delta < 0 ? "#dc2626" : "#9aa5b4" }}>
                {l.delta === null ? "—" : `${l.delta > 0 ? "▲" : l.delta < 0 ? "▼" : "="} ${Math.abs(l.delta).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`}
              </span>
              <span style={{ width: 44, fontSize: 10, fontWeight: 700, color: "#4a5568", textAlign: "right" as const, flexShrink: 0 }}>
                {l.valeur !== null && total > 0 ? `${(Math.max(0, l.valeur) / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %` : "—"}
              </span>
              <div style={{ width: "30%", height: 8, background: "#F2F0EF", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
                {l.valeur !== null && l.valeur > 0 && <div style={{ height: "100%", width: `${Math.max(2, l.valeur / max * 100)}%`, borderRadius: 99, background: l.couleur, opacity: 0.85 }} />}
              </div>
            </div>
          );
        })}
      </div>
      {annees.length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center" as const, padding: "16px 0" }}>Aucune donnée</p>}
    </div>
  );
}


// ── Export Excel (XLSX) ───────────────────────────────────────────────────────
async function exportXLSX(donnees: any[], paysSelectionnes: any[], periode: string, sousType: string = "fluxstock") {
  // SheetJS chargé à la demande (~400 Ko) : uniquement au clic Export
  const XLSX = await import("xlsx");
  const annees = [...new Set(donnees.map((d:any)=>d.annee))].sort() as number[];
  const series = (SERIES_TYPES[sousType] || SERIES_TYPES.fluxstock).map(s => ({
    dir: s.dir, ind: s.ind, label: s.unite === "musd" ? `${s.label} (M$ USD)` : s.label,
  }));

  const wb = XLSX.utils.book_new();

  paysSelectionnes.forEach((p:any) => {
    // En-tête : Indicateur | 1990 | 1991 | ...
    const header = ["Indicateur", ...annees.map(String)];
    const rows: (string|number|null)[][] = [header];

    series.forEach(s => {
      const row: (string|number|null)[] = [s.label];
      annees.forEach(a => {
        const r = donnees.find((d:any)=>d.pays===p.nom&&d.direction===s.dir&&d.indicateur===s.ind&&d.annee===a);
        const v = r?.valeur;
        row.push(v !== null && v !== undefined ? Number(v.toFixed(2)) : null);
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Largeur auto des colonnes
    const colWidths = rows[0].map((_:any, ci:number) => {
      const maxLen = Math.max(...rows.map(r => String(r[ci] ?? "").length));
      return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
    });
    ws["!cols"] = colWidths;

    // Nom de feuille = nom du pays (max 31 chars)
    XLSX.utils.book_append_sheet(wb, ws, p.nom.slice(0, 31));
  });

  XLSX.writeFile(wb, `IDE_CNUCED_${paysSelectionnes.map((p:any)=>p.nom.replace(/\s/g,"_")).join("_")}_${periode}.xlsx`);
}

// ── Modal données ─────────────────────────────────────────────────────────────
function ModalDonnees({ open, onClose, donnees, paysSelectionnes, sousType = "fluxstock", entite = "pays" }: any) {
  if (!open) return null;
  const annees = [...new Set(donnees.map((d:any)=>d.annee))].sort() as number[];
  const periode = annees.length ? `${annees[0]}_${annees[annees.length-1]}` : "all";
  const SERIES = (SERIES_TYPES[sousType] || SERIES_TYPES.fluxstock).map(s => ({ dir: s.dir, ind: s.ind, label: s.label, unite: s.unite }));

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:1200, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"#004f91", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", margin:0, lineHeight:1.35, flexShrink:0 }}>Tableau de données</h2>
                {annees.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:999, background:"#ECEAE8", border:"1px solid #DFDBD7", fontSize:10.5, fontWeight:700, color:"#3a4452", letterSpacing:"0.02em", flexShrink:0 }}>
                  {annees[0]} — {annees[annees.length-1]}
                </span>}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, minWidth:0 }}>
                {paysSelectionnes.map((p:any)=>{
                  const marquee = (e:React.MouseEvent, reset:boolean) => {
                    const box = e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null;
                    const sp = box?.firstElementChild as HTMLElement|null;
                    if (!box || !sp) return;
                    if (reset) { sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; return; }
                    const d = sp.scrollWidth - box.clientWidth;
                    if (d>0) { sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; }
                  };
                  return (
                    <span key={p.nom} title={p.label||p.nom}
                      onMouseEnter={e=>marquee(e,false)} onMouseLeave={e=>marquee(e,true)}
                      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:999, background:`${p.couleur}0D`, border:`1px solid ${p.couleur}2E`, fontSize:10.5, fontWeight:700, color:p.couleur, minWidth:0 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:p.couleur, display:"inline-block", flexShrink:0 }} />
                      <span data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const, minWidth:0 }}>
                        <span style={{ display:"inline-block" }}>{p.abrege||p.nom}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width:32, height:32, borderRadius:"50%", background:"#F5F4F3", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="#ECEAE8";}} onMouseLeave={e=>{e.currentTarget.style.background="#F5F4F3";}}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div style={{ overflowY:"auto" as const, flex:1, overflowX:"auto" as const }}>
          <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
            <thead style={{ position:"sticky" as const, top:0, zIndex:2 }}>
              <tr style={{ background:"#FAFAF9" }}>
                <th style={{ padding:"11px 28px", textAlign:"left" as const, fontSize:10, fontWeight:800, color:"#4a5568", letterSpacing:"0.1em", textTransform:"uppercase" as const, position:"sticky" as const, left:0, background:"#FAFAF9", borderRight:"1px solid #F0EEEC", borderBottom:"1px solid #F0EEEC", whiteSpace:"nowrap" as const, minWidth:170 }}>Indicateur</th>
                {annees.map(a=><th key={a} style={{ padding:"11px 12px", fontSize:10, fontWeight:800, color:"#4a5568", letterSpacing:"0.06em", textAlign:"right" as const, minWidth:80, borderBottom:"1px solid #F0EEEC" }}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {paysSelectionnes.map((pays:any) => (
                <Fragment key={pays.nom}>
                  <tr>
                    <td colSpan={annees.length+1} style={{ padding:"12px 28px 6px", background:"#fff" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", background:pays.couleur, flexShrink:0 }} />
                        <span style={{ fontSize:12.5, fontWeight:800, color:pays.couleur }}>{pays.abrege||pays.nom}</span>
                      </div>
                    </td>
                  </tr>
                  {SERIES.map((s,si)=>(
                    <tr key={`${pays.nom}-${s.dir}-${s.ind}`}
                      style={{ borderBottom: si===SERIES.length-1?"1px solid #ECEAE7":"1px solid #F6F4F3", background:"#fff", transition:"background 0.1s" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#FAFAF9"}
                      onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                      <td style={{ padding:"9px 28px 9px 44px", position:"sticky" as const, left:0, background:"inherit", borderRight:"1px solid #F0EEEC", whiteSpace:"nowrap" as const }}>
                        <span style={{ fontSize:12, color:"#4a5568", fontWeight:500 }}>{s.label}</span>
                      </td>
                      {annees.map(a=>{
                        const r = donnees.find((d:any)=>d.pays===pays.nom&&d.direction===s.dir&&d.indicateur===s.ind&&d.annee===a);
                        const v = r?.valeur;
                        const display = v!==null&&v!==undefined ? (s.unite==="nombre" ? fmtNombre(v) : fmtVal(v)) : "—";
                        const color = v===null||v===undefined ? "#C5BFBB" : v<0 ? "#dc2626" : "#4a5568";
                        return (
                          <td key={a} style={{ padding:"9px 12px", textAlign:"right" as const, fontSize:12, color, fontWeight:v!==null&&v!==undefined?600:400, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" as const }}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0, gap:10 }}>
          <span style={{ fontSize:11, color:"#9aa5b4" }}>
            {paysSelectionnes.length} {entite} · {annees.length} années · {sousType === "fluxstock" ? "valeurs en M$ USD" : "valeurs en M$ USD, nombres en absolu"} · Source CNUCED
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
              Fermer
            </button>
            <button onClick={()=>exportXLSX(donnees,paysSelectionnes,periode,sousType)}
              style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"#004f91", color:"#fff", fontSize:12.5, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, boxShadow:"0 3px 12px rgba(0,79,145,0.25)", fontFamily:"var(--font-google-sans)" }}>
              <FileSpreadsheet size={13}/> Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 25 KPIs fixes ─────────────────────────────────────────────────────────────
const KPI_25_IDS = [
  "fe_last","fs_last","fn_last","se_last","ss_last","sn_last",
  "g_fe","g_se","cagr_fe","mom_fe",
  "moy_fe","med_fe","max_fe","min_fe","std_fe",
  "trend_fe","accel_fe","tv5_fe","tv10_fe",
  "r_fe_fs","dist_max_fe","regularite_fe","vs_moy_fe",
  "n_pos_fe","cur_streak_fe"
];

// ── Interprétation contextuelle d'un KPI ─────────────────────────────────────
function interpreterKpi(k: KpiResult, pays: string, couleur: string): string {
  if (k.valeur === null || k.valeur === undefined || isNaN(k.valeur)) return "Données insuffisantes pour interpréter cet indicateur.";
  const v = k.valeur;
  const fmt = fmtKpi(k);
  switch(k.id) {
    case "fe_last": return v>0?`En ${k.annee}, ${pays} a attiré ${fmt} d'IDE entrants. ${v>1000?"C'est un niveau significatif, reflétant une attractivité forte pour les investisseurs étrangers.":v>100?"C'est un flux modéré, cohérent avec une économie en développement.":"Ce flux relativement faible peut refléter un manque d'attractivité ou des conditions conjoncturelles défavorables."}`:`En ${k.annee}, les flux entrants sont négatifs (${fmt}), ce qui signifie que les investisseurs étrangers ont rapatrié plus de capital qu'ils n'en ont investi — un signal de désinvestissement.`;
    case "fs_last": return `En ${k.annee}, ${pays} a investi ${fmt} à l'étranger. ${v>0?v>500?"C'est un niveau élevé, indiquant que le pays est lui-même un exportateur significatif de capitaux.":"Cela reflète une capacité à investir au-delà des frontières, signe d'entreprises dynamiques.":"Un flux sortant négatif signifie un rapatriement de capitaux investis à l'étranger."}`;
    case "fn_last": return v>0?`Le flux net de ${fmt} est positif : ${pays} reçoit plus d'IDE qu'il n'en envoie. Le pays est en position d'attractivité nette.`:`Le flux net de ${fmt} est négatif : ${pays} exporte plus de capitaux qu'il n'en reçoit. Le pays investit davantage à l'étranger qu'il n'attire.`;
    case "se_last": return `Le stock d'IDE entrant est de ${fmt} en ${k.annee}. ${v>5000?"Ce stock élevé témoigne d'une présence importante et durable des investisseurs étrangers.":v>1000?"C'est un stock intermédiaire qui reflète une accumulation progressive des investissements étrangers.":"Ce stock encore limité indique que l'accumulation d'IDE reste à consolider."}`;
    case "ss_last": return `Le stock d'IDE sortant est de ${fmt} en ${k.annee}, représentant le cumul des investissements de ${pays} à l'étranger.`;
    case "sn_last": return v>0?`Avec un stock net de ${fmt}, ${pays} est un récepteur net d'IDE : il accueille plus de capital étranger qu'il n'en détient à l'étranger.`:`Avec un stock net négatif de ${fmt}, ${pays} possède davantage d'actifs à l'étranger qu'il n'en reçoit — profil atypique pour un pays en développement.`;
    case "g_fe": return v>0?`Les flux entrants ont augmenté de ${fmt} en ${k.annee} par rapport à l'année précédente. ${v>50?"Hausse très significative, probablement liée à un grand projet ou une réforme favorable.":v>20?"Croissance solide, signe d'une attractivité en amélioration.":"Légère progression positive."}`:`Les flux entrants ont baissé de ${fmt} en ${k.annee}. ${v<-50?"Chute sévère, probablement liée à une crise ou un retrait d'investisseurs majeurs.":v<-20?"Recul notable qui mérite attention.":"Légère contraction."}`;
    case "g_se": return v>0?`Le stock entrant a progressé de ${fmt}, confirmant l'accumulation continue d'IDE.`:`Le stock entrant a diminué de ${fmt}, ce qui peut indiquer des cessions ou dépréciations d'actifs étrangers.`;
    case "cagr_fe": return v>0?`Le CAGR de ${fmt} signifie qu'en moyenne, les flux entrants ont cru de ${fmt} par an sur la période. ${v>10?"C'est une croissance composée excellente.":v>5?"Croissance soutenue sur le long terme.":"Progression modeste mais régulière."}`:`Un CAGR négatif de ${fmt} indique une tendance à la baisse des flux entrants sur la période analysée.`;
    case "mom_fe": return v>0?`Sur les 5 dernières années, les flux entrants ont progressé de ${fmt}. La dynamique récente est positive.`:`Sur les 5 dernières années, les flux entrants ont reculé de ${fmt}. La tendance récente est préoccupante.`;
    case "moy_fe": return `La moyenne des flux entrants sur la période est de ${fmt} par an. C'est la valeur de référence pour évaluer si une année donnée est exceptionnelle ou en dessous de la normale.`;
    case "med_fe": return `La médiane des flux entrants est de ${fmt}. Elle est moins sensible aux valeurs extrêmes que la moyenne — si médiane < moyenne, cela suggère quelques grandes années tirent la moyenne vers le haut.`;
    case "max_fe": return `Le pic historique des flux entrants est de ${fmt}, atteint en ${k.annee}. Toute valeur récente proche de ce niveau est remarquable.`;
    case "min_fe": return `Le minimum historique est de ${fmt} en ${k.annee}. ${v<0?"Ce minimum négatif représente une phase de désinvestissement.":"C'est le plancher de référence pour contextualiser les flux faibles."}`;
    case "std_fe": return `L'écart-type de ${fmt} mesure la volatilité des flux entrants. ${v>500?"Forte variabilité — les flux sont très irréguliers d'une année à l'autre.":v>100?"Variabilité modérée.":"Flux relativement stables dans le temps."}`;
    case "trend_fe": return v>0?`La tendance linéaire de +${fmt}/an indique une progression structurelle des flux entrants sur la période. Le pays gagne en attractivité sur le long terme.`:`La tendance de ${fmt}/an révèle une érosion structurelle des flux entrants. Sans redressement, la trajectoire est préoccupante.`;
    case "accel_fe": return v>0?`L'accélération positive (${fmt}) montre que la 2e moitié de la période a été meilleure que la 1ère — la dynamique s'améliore.`:`L'accélération négative (${fmt}) indique que la tendance ralentit — la 2e moitié est moins bonne que la 1ère.`;
    case "tv5_fe": return v>0?`Sur 5 ans, le taux de croissance annuel des flux entrants est de ${fmt}. ${v>15?"Dynamique très forte.":v>5?"Croissance soutenue.":"Progression modeste."}`:`Taux de variation négatif sur 5 ans (${fmt}) — déclin récent des flux entrants.`;
    case "tv10_fe": return v>0?`Sur 10 ans, le taux annuel moyen est de ${fmt}. Cela confirme une trajectoire de fond ${v>10?"très positive":"positive"}.`:`Sur 10 ans, tendance négative (${fmt}). Déclin structurel sur la décennie.`;
    case "r_fe_fs": return v>1?`Avec un ratio de ${fmt}, ${pays} reçoit ${fmt} fois plus d'IDE qu'il n'en envoie. Position nette de récepteur.`:v<1?`Le ratio de ${fmt} indique que ${pays} investit davantage à l'étranger qu'il n'en reçoit — profil d'exportateur net de capitaux.`:`Équilibre parfait entre flux entrants et sortants.`;
    case "dist_max_fe": return v>=0?`Les flux entrants actuels sont au niveau de leur pic historique — performance maximale.`:`${Math.abs(v).toLocaleString("fr-FR",{maximumFractionDigits:1})} % en dessous du pic historique. ${Math.abs(v)<20?"Proche du sommet.":Math.abs(v)<50?"Récupération partielle.":"Loin du pic — fort potentiel de rebond."}`;
    case "regularite_fe": return `${fmt} des années ont connu des flux entrants positifs. ${v>80?"Très grande régularité — le pays attire des IDE de manière continue.":v>60?"Bonne régularité malgré quelques années de désinvestissement.":"Flux entrants irréguliers — forte dépendance à des cycles ou projets ponctuels."}`;
    case "vs_moy_fe": return v>0?`La dernière valeur est ${fmt} au-dessus de la moyenne historique. Performance récente supérieure à la norme.`:`La dernière valeur est ${fmt} en dessous de la moyenne historique. Performance récente inférieure à la normale.`;
    case "n_pos_fe": return `Sur la période, ${fmt} années ont connu une croissance des flux entrants. ${+fmt>20?"Majorité d'années positives — trajectoire haussière dominante.":"Autant ou plus d'années de baisse que de hausse."}`;
    case "cur_streak_fe": return +fmt>0?`${pays} enchaîne actuellement ${fmt} année${+fmt>1?"s":""} consécutive${+fmt>1?"s":""} de croissance des flux entrants. ${+fmt>=5?"Série impressionnante — momentum fort.":+fmt>=3?"Dynamique positive en cours.":"Début d'un cycle haussier."}`:(`${pays} n'est pas en série de croissance actuellement. La dernière année a vu les flux baisser.`);
    default: return `Cet indicateur mesure : ${k.description}`;
  }
}

// ── Découpe du libellé KPI : titre principal + précision (« dernière année », « période »…)
function splitKpiTitre(label: string): { main: string; suffix: string | null } {
  const dashMatch = label.match(/^(.+?)\s*—\s*(.+)$/);
  if (dashMatch) return { main: dashMatch[1], suffix: dashMatch[2] };
  const parenMatch = label.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenMatch) return { main: parenMatch[1], suffix: parenMatch[2] };
  return { main: label, suffix: null };
}

// ── Mini modal KPI ────────────────────────────────────────────────────────────
function MiniModalKpi({ kpi, pays, couleur, onClose }: { kpi: KpiResult|null; pays: string; couleur: string; onClose: ()=>void }) {
  if (!kpi) return null;
  const interp = interpreterKpi(kpi, pays, couleur);
  const isTrend = ["g_fe","g_se","cagr_fe","mom_fe","trend_fe","vs_moy_fe","accel_fe","tv5_fe","tv10_fe"].includes(kpi.id);
  const isPos = kpi.valeur !== null && kpi.valeur > 0;
  const isNeg = kpi.valeur !== null && kpi.valeur < 0;
  const signalColor = isTrend ? (isPos?"#188038":isNeg?"#dc2626":"#9aa5b4") : couleur;
  const signalBg    = isTrend ? (isPos?"rgba(24,128,56,0.06)":isNeg?"rgba(220,38,38,0.05)":"#FAFAF9") : "rgba(0,79,145,0.04)";
  const signalBorder= isTrend ? (isPos?"rgba(24,128,56,0.18)":isNeg?"rgba(220,38,38,0.18)":"#F0EEEC") : "rgba(0,79,145,0.10)";
  const trendLabel  = isTrend ? (isPos?"Positif":isNeg?"Négatif":"Neutre") : null;
  const { main: titreMain, suffix: titreSuffix } = splitKpiTitre(kpi.label);
  const SecTitle = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize:10.5, fontWeight:700, color:"#004f91", letterSpacing:"0.14em", textTransform:"uppercase" as const, marginBottom:10 }}>{children}</p>
  );

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"#004f91", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", margin:0, lineHeight:1.35 }}>{titreMain}</h2>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const, marginTop:8 }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:couleur, background:`${couleur}12`, border:`1px solid ${couleur}30` }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:couleur, display:"inline-block" }} />
                  {pays}
                </span>
                {titreSuffix && (
                  <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"#4a5568", background:"#F5F4F3" }}>
                    {titreSuffix}
                  </span>
                )}
                {trendLabel && (
                  <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:signalColor, background:signalBg, border:`1px solid ${signalBorder}` }}>
                    {trendLabel}
                  </span>
                )}
                {kpi.annee && (
                  <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"#4a5568", background:"#F5F4F3" }}>
                    {kpi.annee}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width:32, height:32, borderRadius:"50%", background:"#F5F4F3", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="#ECEAE8";}} onMouseLeave={e=>{e.currentTarget.style.background="#F5F4F3";}}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1, display:"flex", flexDirection:"column" as const, gap:22 }}>
          <div>
            <SecTitle>Valeur</SecTitle>
            <div style={{ background:signalBg, border:`1px solid ${signalBorder}`, borderRadius:12, padding:"16px 18px", display:"flex", alignItems:"baseline", gap:10 }}>
              <span style={{ fontSize:"2.2rem", fontWeight:800, color:signalColor, lineHeight:1, letterSpacing:"-0.02em" }}>{fmtKpi(kpi)}</span>
              {kpi.annee && <span style={{ fontSize:13, color:"#9aa5b4", fontWeight:500 }}>en {kpi.annee}</span>}
            </div>
          </div>
          <div>
            <SecTitle>Interprétation</SecTitle>
            <div style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"14px 18px" }}>
              <p style={{ fontSize:13, color:"#1a1a2e", lineHeight:1.75 }}>{interp}</p>
            </div>
          </div>
          <div>
            <SecTitle>Définition</SecTitle>
            <p style={{ fontSize:12, color:"#9aa5b4", lineHeight:1.65 }}>{kpi.description}</p>
          </div>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", display:"flex", justifyContent:"flex-end", flexShrink:0 }}>
          <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers pays groupés ──────────────────────────────────────────────────────
const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];
function sortContinents(conts: string[]) {
  return [...conts].sort((a, b) => {
    const ia = CONT_ORDER.indexOf(a), ib = CONT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });
}
function groupByContinent(pays: any[]): Record<string, Record<string, any[]>> {
  const g: Record<string, Record<string, any[]>> = {};
  for (const p of pays) {
    const cont = p.continent || "Autre";
    const zone = p.region_geo || "Autre";
    if (!g[cont]) g[cont] = {};
    if (!g[cont][zone]) g[cont][zone] = [];
    g[cont][zone].push(p);
  }
  for (const cont of Object.keys(g))
    for (const zone of Object.keys(g[cont]))
      g[cont][zone].sort((a, b) => { if (a.nom === "Sénégal") return -1; if (b.nom === "Sénégal") return 1; return a.nom.localeCompare(b.nom, "fr"); });
  return g;
}

// ── Onglet Pays — analyse individuelle ────────────────────────────────────────
function splitKpiLabel(label: string, dernAnnee: number): { main: string; badge: string | null } {
  const lastYearMatch = label.match(/^(.+?)\s*—\s*dernière année$/);
  if (lastYearMatch) return { main: lastYearMatch[1], badge: String(dernAnnee) };
  const parenMatch = label.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenMatch) return { main: parenMatch[1], badge: parenMatch[2] };
  return { main: label, badge: null };
}

// ── Bouton « Tableau de données » responsive (plein → « Données » → icône) ─────
function BoutonDonnees({ onClick, dep }: { onClick: () => void; dep?: any }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<"full" | "court" | "icone">("full");
  useEffect(() => {
    const btn = ref.current; const parent = btn?.parentElement;
    if (!btn || !parent) return;
    const calc = () => {
      let used = 0;
      Array.from(parent.children).forEach(ch => { if (ch !== btn) used += (ch as HTMLElement).offsetWidth + 8; });
      const avail = parent.clientWidth - used;
      setMode(avail >= 185 ? "full" : avail >= 112 ? "court" : "icone");
    };
    const raf = requestAnimationFrame(calc);
    const ro = new ResizeObserver(calc); ro.observe(parent);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [dep]);
  return (
    <button ref={ref} onClick={onClick} title="Tableau de données"
      style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap: mode==="icone"?0:7, padding: mode==="icone"?"8px 10px":"8px 16px", borderRadius:999, border:"1px solid #E4E1DE", background:"#fff", color:"#004f91", fontSize:12.5, fontWeight:700, cursor:"pointer", fontFamily:"var(--font-google-sans)", flexShrink:0, whiteSpace:"nowrap" as const }}
      onMouseEnter={e=>{e.currentTarget.style.background="#F5F4F3";}} onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>
      <Table size={14} />{mode!=="icone" && <span>{mode==="full"?"Tableau de données":"Données"}</span>}
    </button>
  );
}

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
                    <div style={{ position:"relative" as const, height:24, marginBottom:2 }}>
                      <div style={{ position:"absolute" as const, top:"50%", left:0, right:0, height:4, background:"#E8E5E3", borderRadius:2, transform:"translateY(-50%)" }}/>
                      <div style={{ position:"absolute" as const, top:"50%", left:`${((anneeMin-borneMin)/(borneMax-borneMin))*100}%`, width:`${Math.max(0,((anneeMax-borneMin)/(borneMax-borneMin))*100-((anneeMin-borneMin)/(borneMax-borneMin))*100)}%`, height:4, background:"#004f91", borderRadius:2, transform:"translateY(-50%)" }}/>
                      <input type="range" min={borneMin} max={borneMax} value={anneeMin}
                        onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax-1))}
                        className="drs-thumb"
                        style={{zIndex:anneeMin>=anneeMax-1?4:2} as React.CSSProperties}/>
                      <input type="range" min={borneMin} max={borneMax} value={anneeMax}
                        onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin+1))}
                        className="drs-thumb"
                        style={{zIndex:3} as React.CSSProperties}/>
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
  const accent = niveauSel === "branche" ? "#ca631f" : "#004f91";
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
      <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"#fff", borderRight:"1px solid #E8E5E3", height:"100vh", overflowY:"auto" as const, position:"sticky" as const, top:0, display:"flex", flexDirection:"column" as const }}>
        <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
        {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent", transition:"background 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
        <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid #F2F0EF", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
          {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={()=>setSidebarOpen(o=>!o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
              <SlidersHorizontal size={14} style={{ color:"#004f91" }}/>
            </button>
            {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser" style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
              <span className="material-symbols-outlined" style={{ fontSize:15, color:"#dc2626", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
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
              <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Secteurs</span>
              {selecIds[0]!==0&&<span style={{ fontSize:10, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.18)", padding:"1px 6px", borderRadius:999 }}>1</span>}
            </div>

            <BdefRow label="Global des secteurs" selected={selecIds[0]===0} onSelect={()=>setSelecIds([0])} />
            <div style={{ height:1, background:"#F2F0EF", margin:"8px 0" }}/>

            <div style={{ maxHeight:380, overflowY:"auto" as const }}>
              {refSecteurs.map((s: any) => {
                const isOpen = openSecs.has(s.id);
                return (
                  <div key={s.id} style={{ marginBottom:1 }}>
                    <BdefRow label={s.nom_fr} niveau="macro_secteur" selected={selecIds.includes(s.id)}
                      onSelect={()=>toggleSecteur(s.id)} expandable={(s.branches||[]).length>0} expanded={isOpen} onToggle={()=>toggleOpen(s.id)} />
                    {isOpen&&(
                      <div style={{ marginLeft:17, borderLeft:"1.5px solid #EDEAE6", paddingLeft:4, marginTop:1, marginBottom:3 }}>
                        {(s.branches||[]).map((b: any) => (
                          <BdefRow key={b.id} label={b.nom_fr} niveau="groupe" selected={selecIds.includes(b.id)} onSelect={()=>toggleSecteur(b.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {refSecteurs.length===0&&!loading&&<p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center" as const, padding:"8px 0" }}>Référentiel indisponible</p>}
            </div>
          </div>
          ) : (
          /* Comparative — choix du niveau comparé puis sélection (max 4),
             même présentation que la comparative des Investissements nationaux */
          <div style={{ marginBottom:18 }}>
            <div style={{ marginBottom:14 }}>
              <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Comparer par</p>
              <div style={{ display:"flex", gap:6 }}>
                {([{v:"secteur",l:"Secteurs"},{v:"branche",l:"Branches"}] as const).map(o=>(
                  <button key={o.v} onClick={()=>{ setCompNiveau(o.v); setSelecIds(o.v==="secteur"?[1,2,3]:[]); }}
                    style={{ flex:1, padding:"7px 2px", borderRadius:8, border:`1px solid ${compNiveau===o.v?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:11.5, fontWeight:compNiveau===o.v?700:500, background:compNiveau===o.v?"rgba(0,79,145,0.08)":"#F8F7F6", color:compNiveau===o.v?"#004f91":"#4a5568", fontFamily:"var(--font-google-sans)" }}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>Sélection</span>
              <span style={{ fontSize:11, fontWeight:600, color:selecIds.length>=4?"#004f91":"#9aa5b4", background:selecIds.length>=4?"rgba(0,79,145,0.08)":"#F2F0EF", padding:"2px 8px", borderRadius:999 }}>{selecIds.length}/4</span>
            </div>

            {(()=>{
              const renderItem = (id: number, nom: string) => {
                const sel = selecIds.includes(id);
                const disabled = !sel && selecIds.length >= 4;
                const colIdx = selecIds.indexOf(id);
                const col = colIdx >= 0 ? COMP_PALETTE[colIdx % COMP_PALETTE.length] : "#004f91";
                return (
                  <div key={id} onClick={()=>{ if(!disabled) toggleSecteur(id); }}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", borderRadius:6, background:"transparent", opacity:disabled?0.35:1, cursor:disabled?"not-allowed":"pointer", transition:"background 0.1s" }}
                    onMouseEnter={e=>{ if(!disabled) (e.currentTarget as HTMLElement).style.background="#F8F7F6"; }}
                    onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="transparent"; }}>
                    <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"#C5BFBB"}`, background:sel?col:"transparent", flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:"#4a5568", fontWeight:sel?700:400, lineHeight:1.3, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{nom}</span>
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
                      <button onClick={()=>toggleCompCat(s.id)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"rgba(0,79,145,0.04)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 8px", marginTop:6, marginBottom:3 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:"#004f91", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{s.nom_fr}</span>
                        <ChevronDown size={11} style={{ color:"#004f91", transform:open?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
                      </button>
                      {open&&(s.branches||[]).map((b: any) => renderItem(b.id, b.nom_fr))}
                    </div>
                  );
                })}
              </div>;
            })()}
            {refSecteurs.length===0&&!loading&&<p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center" as const, padding:"8px 0" }}>Référentiel indisponible</p>}
          </div>
          )}
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
                <div style={{ position:"relative" as const, height:24, marginBottom:2 }}>
                  <div style={{ position:"absolute" as const, top:"50%", left:0, right:0, height:4, background:"#E8E5E3", borderRadius:2, transform:"translateY(-50%)" }}/>
                  <div style={{ position:"absolute" as const, top:"50%", left:`${((anneeMin-borneMin)/(borneMax-borneMin||1))*100}%`, width:`${Math.max(0,((anneeMax-borneMin)/(borneMax-borneMin||1))*100-((anneeMin-borneMin)/(borneMax-borneMin||1))*100)}%`, height:4, background:"#004f91", borderRadius:2, transform:"translateY(-50%)" }}/>
                  <input type="range" min={borneMin} max={borneMax} value={anneeMin}
                    onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax-1))}
                    className="drs-thumb"
                    style={{zIndex:anneeMin>=anneeMax-1?4:2} as React.CSSProperties}/>
                  <input type="range" min={borneMin} max={borneMax} value={anneeMax}
                    onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin+1))}
                    className="drs-thumb"
                    style={{zIndex:3} as React.CSSProperties}/>
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
              <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"#1a1a2e" }}>{selecIds.length ? nomById.get(selecIds[0]) : "Secteur"}</h2>
              {niveauSel!=="global"&&<span style={{ display:"inline-flex", alignItems:"center", padding:"1px 7px", borderRadius:5, background:"#F2F0EF", border:"1px solid #E8E5E3", fontSize:9, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.05em", flexShrink:0 }}>
                {niveauSel==="secteur"?"Secteur":"Branche d'activité"}
              </span>}
              {badgePeriode}
            </div>
          ) : (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" as const }}>
                <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"#1a1a2e" }}>Analyse comparative par {compNiveau==="secteur"?"secteur":"branche d'activité"}</h2>
                {badgePeriode}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10, flexWrap:"wrap" as const }}>
                {selecIds.map((id, i) => (
                  <BadgeSerie key={id} i={i} couleur={couleurDe(i)}>{nomById.get(id)}</BadgeSerie>
                ))}
                {selecIds.length===0&&<span style={{ fontSize:12, color:"#9aa5b4" }}>Sélectionnez jusqu&apos;à 4 {compNiveau==="secteur"?"secteurs":"branches"} dans le filtre</span>}
              </div>
            </div>
          );
        })()}

        {/* KPI cards (analyse par secteur) — 4 colonnes */}
        {stCards && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
            {stCards.map(c=>(
              <div key={c.label}
                style={{ background:"#fff", borderRadius:14, padding:"13px 14px", border:"1px solid rgba(16,26,46,0.12)", boxShadow:"none", transition:"border-color 0.18s", minWidth:0 }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="rgba(0,79,145,0.35)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgba(16,26,46,0.12)"; }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7, flexWrap:"wrap" as const }}>
                  <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:accent, textTransform:"uppercase" as const, lineHeight:1.4 }}>{c.label}</p>
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
            ))}
          </div>
        )}

        {/* Graphes */}
        {loading ? (
          <SkeletonChartGrid n={SERIES.length} cols={2} height={230}/>
        ) : erreur ? (
          <ErreurChargement onRetry={() => setTick(t => t + 1)} />
        ) : !aDesDonnees ? (
          <div style={{ textAlign:"center" as const, padding:"90px 24px", color:"#9aa5b4" }}>
            <p style={{ fontSize:16, fontWeight:600, color:"#4a5568" }}>Aucune donnée sectorielle</p>
            <p style={{ fontSize:14, marginTop:6 }}>Les Annex tables sectorielles ({st === "greenfield" ? "15 et 18" : "09 à 12"}) n&apos;ont pas encore été importées dans l&apos;administration.</p>
          </div>
        ) : (
          <div className="charge-in" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
            {GRAPHES.map(g=>{
              // Analyse sectorielle (sélection unique) : les « nombres » en
              // tableau explorable (curseur + épinglage), comme en vue Pays
              if (typeAnalyse === "secteur" && g.unite === "nombre")
                return <CarteTableauAnnees key={`${g.id}-${selecIds[0]}`} titre={g.titre}
                  rows={(g.series[0]?.data || []).map((d: any) => ({ annee: d.annee, valeur: d.valeur }))}/>;
              return (
              <GrapheCard key={g.id} titre={g.titre} sous_titre={`${g.unite==="nombre"?"Nombre":"M$ USD"} · CNUCED · ${perMin}–${perMax}`} series={g.series} grapheId={g.id} hideLegend hideSousTitre
                fullChildren={<GrapheMultiPays series={g.series} height={340} type={g.unite==="nombre"?"bar":"line"} titre={g.id} fmt={g.unite==="nombre"?fmtNombre:undefined}/>}>
                <GrapheMultiPays series={g.series} height={SERIES.length===2?220:145} type={g.unite==="nombre"?"bar":"line"} titre={g.id} fmt={g.unite==="nombre"?fmtNombre:undefined}/>
              </GrapheCard>
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

// ── Onglet Monde ──────────────────────────────────────────────────────────────

function OngletMonde({ showTable, setShowTable, sousOnglet, setSousOnglet, sousType, setSousType, vueP, setVueP }: { showTable: boolean; setShowTable: (v:boolean)=>void; sousOnglet: string; setSousOnglet: (v:"pays"|"comparative"|"monde")=>void; sousType: string; setSousType: (v:"fluxstock"|"greenfield"|"fusion")=>void; vueP: string; setVueP: (v:"pays"|"secteurs")=>void }) {
  const [donnees,     setDonnees]    = useState<any[]>([]);
  const [loading,     setLoading]    = useState(false);
  const [borneMin, borneMax] = useBornesCnuced(sousType);
  const [anneeMin,    setAnneeMin]   = useState(borneMin);
  const [anneeMax,    setAnneeMax]   = useState(borneMax);
  const [anneesSpec,  setAnneesSpec] = useState<number[]>([]);
  const [modeAnnees,  setModeAnnees] = useState<"plage"|"specifiques">("plage");
  // Période stabilisée : le fetch attend la fin du drag des sliders
  const anneeMinD   = useDebounced(anneeMin, 300);
  const anneeMaxD   = useDebounced(anneeMax, 300);
  const anneesSpecD = useDebounced(anneesSpec, 300);
  // Alignement sur les bornes réelles dès qu'elles sont connues
  useEffect(() => { setAnneeMin(borneMin); setAnneeMax(borneMax); }, [borneMin, borneMax]);
  const [sidebarOpen, setSidebarOpen]= useState(true);
  const [sidebarWidth,setSidebarWidth]=useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 520);

  const [groupements, setGroupements] = useState<{code:string; nom_fr:string; categorie:string}[]>([]);
  const [grpSelec,    setGrpSelec]    = useState<string[]>([]);
  const [searchGrp,   setSearchGrp]   = useState("");
  const [contExpanded,setContExpanded]= useState<Record<string,boolean>>({});
  const mondeInit = useRef(false);

  useEffect(() => {
    fetch(`${API}/ide/monde/groupements`).then(r=>r.json()).then(d=>setGroupements(d||[])).catch(()=>{});
  }, []);

  useEffect(() => {
    if (mondeInit.current || !groupements.length) return;
    const defaultNames = ["Afrique","Amérique","Asie","Europe"];
    const codes = groupements
      .filter(g => g.categorie === "continent" && defaultNames.includes(g.nom_fr))
      .slice(0, 4)
      .map(g => g.code);
    if (codes.length > 0) { mondeInit.current = true; setGrpSelec(codes); }
  }, [groupements]);

  const grpAvecCouleur = grpSelec.map((code, i) => {
    const g = groupements.find(x => x.code === code);
    return { nom: code, label: g?.nom_fr || code, abrege: code.replace(/_/g, " "), couleur: COMP_PALETTE[i] ?? COMP_PALETTE[4] };
  });

  // Chargement principal : en cas d'échec, état d'erreur avec relance (tick)
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);
  const charger = useCallback(async () => {
    if (!grpSelec.length) { setDonnees([]); return; }
    setLoading(true); setErreur(false);
    try {
      const params = new URLSearchParams();
      params.set("codes_list", grpSelec.join(","));
      if (modeAnnees==="specifiques"&&anneesSpecD.length>0) params.set("annees", anneesSpecD.join(","));
      else { params.set("annee_min", String(anneeMinD)); params.set("annee_max", String(anneeMaxD)); }
      const raw: any[] = await fetch(`${API}/ide/monde?${params}`).then(r=>{ if(!r.ok) throw new Error(); return r.json(); });
      setDonnees((raw||[]).map(d => ({
        pays: d.code, direction: d.direction, indicateur: d.indicateur, annee: d.annee, valeur: d.somme,
      })));
    } catch(e){ console.error(e); setErreur(true); }
    finally { setLoading(false); }
  }, [grpSelec, anneeMinD, anneeMaxD, anneesSpecD, modeAnnees, tick]);

  useEffect(() => { charger(); }, [charger]);

  const buildSeries = (dir:string, ind:string) =>
    grpAvecCouleur.map(g => ({ nom:g.abrege, couleur:g.couleur, data:donnees.filter(d=>d.pays===g.nom&&d.direction===dir&&d.indicateur===ind) }));

  // Graphes selon le sous-type actif (Flux & Stocks / Greenfield / M&A)
  const stActif = sousType !== "fluxstock" && SERIES_TYPES[sousType] ? SERIES_TYPES[sousType] : null;
  const GRAPHES = stActif
    ? stActif.map((s, i) => ({ id:`${sousType}-${i}`, titre:s.label, unite:s.unite, series: buildSeries(s.dir, s.ind) }))
    : [
      { id:"fe", titre:"Flux d'IDE entrants",  unite:"musd" as const, series: buildSeries("entrant","flux") },
      { id:"fs", titre:"Flux d'IDE sortants",  unite:"musd" as const, series: buildSeries("sortant","flux") },
      { id:"se", titre:"Stock d'IDE entrant",  unite:"musd" as const, series: buildSeries("entrant","stock") },
      { id:"ss", titre:"Stock d'IDE sortant",  unite:"musd" as const, series: buildSeries("sortant","stock") },
    ];

  // Période réellement couverte par le sous-type (ex. greenfield : 2003+)
  const stBornes = (() => {
    if (!stActif) return null;
    const inds = new Set(stActif.map(s => s.ind));
    const ys = donnees.filter((d: any) => inds.has(d.indicateur) && d.valeur !== null).map((d: any) => d.annee);
    return ys.length ? [Math.min(...ys), Math.max(...ys)] as [number, number] : null;
  })();
  const perMin = stBornes ? Math.max(anneeMin, stBornes[0]) : anneeMin;
  const perMax = stBornes ? Math.min(anneeMax, stBornes[1]) : anneeMax;

  const [donneesDetail, setDonneesDetail] = useState<any[]>([]);
  const modeDetail = grpSelec.length === 1;

  useEffect(() => {
    if (!modeDetail) { setDonneesDetail([]); return; }
    const params = new URLSearchParams({ code: grpSelec[0] });
    if (modeAnnees==="specifiques"&&anneesSpecD.length>0) params.set("annees_spec", anneesSpecD.join(","));
    else { params.set("annee_min", String(anneeMinD)); params.set("annee_max", String(anneeMaxD)); }
    fetch(`${API}/ide/monde/details?${params}`).then(r=>r.json()).then(d=>setDonneesDetail(d||[])).catch(()=>{});
  }, [modeDetail, grpSelec, anneeMinD, anneeMaxD, anneesSpecD, modeAnnees]);

  const q = searchGrp.toLowerCase();
  const matchGrp = (g: {code:string; nom_fr:string}) => !q || g.nom_fr.toLowerCase().includes(q) || g.code.toLowerCase().includes(q);
  const continents = groupements.filter(g => g.categorie === 'continent');
  const groupes    = groupements.filter(g => g.categorie === 'groupe');
  const revenus    = groupements.filter(g => g.categorie === 'revenu');
  const regionsDe  = (cont: string) => groupements.filter(g => g.categorie === cont);
  const toggle = (code: string) => {
    if (grpSelec.includes(code)) setGrpSelec(p => p.filter(c => c !== code));
    else if (grpSelec.length < 4) setGrpSelec(p => [...p, code]);
  };
  const hasFilter = grpSelec.length>0||(modeAnnees==="specifiques"&&anneesSpec.length>0)||(modeAnnees==="plage"&&(anneeMin!==borneMin||anneeMax!==borneMax));
  const nbFiltres = (grpSelec.length>0?1:0)+((modeAnnees==="specifiques"&&anneesSpec.length>0)||(modeAnnees==="plage"&&(anneeMin!==borneMin||anneeMax!==borneMax))?1:0);
  const reinit = () => { setGrpSelec([]); setModeAnnees("plage"); setAnneeMin(borneMin); setAnneeMax(borneMax); setAnneesSpec([]); };

  return (
    <div style={{ display:"flex", alignItems:"flex-start" }}>
      {/* Sidebar */}
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

          {/* Recherche */}
          <div style={{ position:"relative" as const, marginBottom:18 }}>
            <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }}/>
            <input value={searchGrp} onChange={e=>setSearchGrp(e.target.value)} placeholder="Rechercher un groupement…"
              style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", fontSize:12, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
            {searchGrp&&<button onClick={()=>setSearchGrp("")} aria-label="Effacer la recherche" style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"#9aa5b4" }}/></button>}
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
                <div style={{ position:"relative" as const, height:24, marginBottom:2 }}>
                  <div style={{ position:"absolute" as const, top:"50%", left:0, right:0, height:4, background:"#E8E5E3", borderRadius:2, transform:"translateY(-50%)" }}/>
                  <div style={{ position:"absolute" as const, top:"50%", left:`${((anneeMin-borneMin)/(borneMax-borneMin))*100}%`, width:`${Math.max(0,((anneeMax-borneMin)/(borneMax-borneMin))*100-((anneeMin-borneMin)/(borneMax-borneMin))*100)}%`, height:4, background:"#004f91", borderRadius:2, transform:"translateY(-50%)" }}/>
                  <input type="range" min={borneMin} max={borneMax} value={anneeMin} onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax-1))} className="drs-thumb" style={{zIndex:anneeMin>=anneeMax-1?4:2} as React.CSSProperties}/>
                  <input type="range" min={borneMin} max={borneMax} value={anneeMax} onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin+1))} className="drs-thumb" style={{zIndex:3} as React.CSSProperties}/>
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
          <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>

          {/* compteur global */}
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:grpSelec.length>=4?"#004f91":"#9aa5b4", background:grpSelec.length>=4?"rgba(0,79,145,0.08)":"#F2F0EF", padding:"2px 8px", borderRadius:999 }}>{grpSelec.length}/4</span>
          </div>

          {groupements.length===0&&<div style={{ padding:"8px 0" }}><SkeletonRows n={8} h={26}/></div>}

          {/* Helper render d'un item */}
          {(() => {
            const Item = ({ g }: { g: {code:string; nom_fr:string}; }) => {
              const sel = grpSelec.includes(g.code);
              const col = sel ? COMP_PALETTE[grpSelec.indexOf(g.code)] : "#C5BFBB";
              const disabled = !sel && grpSelec.length >= 4;
              return (
                <button key={g.code} onClick={()=>toggle(g.code)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:disabled?"not-allowed":"pointer", background:"transparent", textAlign:"left" as const, width:"100%", opacity:disabled?0.4:1, marginBottom:1 }}
                  onMouseEnter={e=>{
                    if(!disabled&&!sel)(e.currentTarget as HTMLElement).style.background="#F8F7F6";
                    const box=e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null; const sp=box?.firstElementChild as HTMLElement|null;
                    if(box&&sp){ const d=sp.scrollWidth-box.clientWidth; if(d>0){ sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; } }
                  }}
                  onMouseLeave={e=>{
                    (e.currentTarget as HTMLElement).style.background="transparent";
                    const box=e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null; const sp=box?.firstElementChild as HTMLElement|null;
                    if(box&&sp){ sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; }
                  }}>
                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"#C5BFBB"}`, background:sel?col:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>

                  </div>
                  <span data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const, minWidth:0, flex:1 }}>
                    <span style={{ display:"inline-block", fontSize:12, color:"#4a5568", fontWeight:sel?700:400 }}>{g.nom_fr}</span>
                  </span>
                </button>
              );
            };

            const SectionTitle = ({ label }: { label: string }) => (
              <div style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:6, marginTop:2 }}>{label}</div>
            );

            const filtCont  = continents.filter(matchGrp);
            const filtGrp   = groupes.filter(matchGrp);
            const filtRev   = revenus.filter(matchGrp);

            const showContSection = filtCont.length > 0 || continents.some(c => regionsDe(c.nom_fr).some(matchGrp));
            const showGrpSection  = filtGrp.length > 0;
            const showRevSection  = filtRev.length > 0;

            return (
              <>
                {/* ── Continents & Régions ───────────────── */}
                {showContSection && <>
                  <SectionTitle label="Continents & Régions"/>
                  {continents.map(cont => {
                    const regions  = regionsDe(cont.nom_fr);
                    const visRegs  = regions.filter(matchGrp);
                    const contMatch= matchGrp(cont);
                    if (!contMatch && visRegs.length === 0) return null;
                    const expanded = q ? true : (contExpanded[cont.code] ?? false);
                    return (
                      <div key={cont.code} style={{ marginBottom:2 }}>
                        {/* Ligne continent */}
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <button onClick={()=>setContExpanded(p=>({...p,[cont.code]:!expanded}))} aria-label={expanded ? "Replier" : "Déplier"}
                            style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 2px", flexShrink:0, color:"#9aa5b4", display:"flex", alignItems:"center" }}>
                            {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                          </button>
                          {contMatch ? <div style={{ flex:1 }}><Item g={cont}/></div>
                            : <span style={{ fontSize:12, fontWeight:600, color:"#4a5568", padding:"5px 4px", flex:1 }}>{cont.nom_fr}</span>}
                        </div>
                        {/* Régions du continent */}
                        {expanded && visRegs.length > 0 && (
                          <div style={{ paddingLeft:20, borderLeft:"2px solid #F2F0EF", marginLeft:8, marginBottom:4 }}>
                            {visRegs.map(r => <Item key={r.code} g={r}/>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ height:1, background:"#F2F0EF", margin:"12px 0" }}/>
                </>}

                {/* ── Groupements ───────────────────────── */}
                {showGrpSection && <>
                  <SectionTitle label="Groupements"/>
                  {filtGrp.map(g => <Item key={g.code} g={g}/>)}
                  <div style={{ height:1, background:"#F2F0EF", margin:"12px 0" }}/>
                </>}

                {/* ── Niveau de revenu ──────────────────── */}
                {showRevSection && <>
                  <SectionTitle label="Niveau de revenu"/>
                  {filtRev.map(g => <Item key={g.code} g={g}/>)}
                  <div style={{ height:1, background:"#F2F0EF", margin:"12px 0" }}/>
                </>}

                {!showContSection && !showGrpSection && !showRevSection && q &&
                  <p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center" as const, padding:"8px 0" }}>Aucun résultat</p>}
              </>
            );
          })()}


        </div>}
      </aside>

      {/* Zone graphes */}
      <div style={{ flex:1, minWidth:0, padding:"36px 40px 80px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:22 }}>
          <SousTypeNav value={sousType} onChange={setSousType}/>
          {grpSelec.length>0 && <BoutonDonnees onClick={()=>setShowTable(true)} dep={grpSelec.join(",")}/>}
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" as const }}>
            <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"#1a1a2e", margin:0 }}>Vue Monde</h2>
            <BadgePeriode>
              {modeAnnees==="specifiques"&&anneesSpec.length>0
                ? anneesSpec.length===1?`${anneesSpec[0]}`:`${anneesSpec[0]} — ${anneesSpec[anneesSpec.length-1]}`
                : `${perMin} — ${perMax}`}
            </BadgePeriode>
          </div>
          {grpAvecCouleur.length>0 && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10, flexWrap:"wrap" as const }}>
              {grpAvecCouleur.map((g,i)=>(
                <BadgeSerie key={g.nom} i={i} couleur={g.couleur} title={g.label}>{g.abrege}</BadgeSerie>
              ))}
            </div>
          )}
        </div>

        {grpSelec.length===0 ? (
          <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", height:300, gap:12, color:"#9aa5b4" }}>
            <span style={{ fontSize:32 }}>🌍</span>
            <p style={{ fontSize:14, fontWeight:600, color:"#4a5568" }}>Sélectionnez un ou plusieurs groupements</p>
            <p style={{ fontSize:13 }}>Les statistiques agrégées s'afficheront ici.</p>
          </div>
        ) : loading ? (
          <SkeletonChartGrid n={4} cols={2} height={230}/>
        ) : erreur ? (
          <ErreurChargement onRetry={() => setTick(t => t + 1)} />
        ) : (
          <div className="charge-in">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
            {GRAPHES.map(g=>(
              <GrapheCard key={g.id} titre={g.titre} sous_titre={`${g.unite==="nombre"?"Nombre":"M$ USD"} · Somme pays membres · CNUCED`} series={g.series} grapheId={g.id} hideLegend hideSousTitre
                fullChildren={<GrapheMultiPays series={g.series} height={340} type={g.unite==="nombre"?"bar":"line"} titre={g.id} lineWidth={1.6} fmt={g.unite==="nombre"?fmtNombre:undefined}/>}>
                <GrapheMultiPays series={g.series} height={145} type={g.unite==="nombre"?"bar":"line"} titre={g.id} showDots={false} lineWidth={1.4} fmt={g.unite==="nombre"?fmtNombre:undefined}/>
              </GrapheCard>
            ))}
          </div>

          {modeDetail && !stActif && (
            <div style={{ marginTop:28, display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
              <GrapheCard titre={`Flux entrant — Top 10 · ${grpAvecCouleur[0]?.abrege ?? ''}`} sous_titre="Flux IDE entrant · dernière année · M$ USD" grapheId="hbar" hideSousTitre
                fullChildren={<HBarChart donnees={donneesDetail}/>}>
                <HBarChart donnees={donneesDetail} mini/>
              </GrapheCard>
              <GrapheCard titre={`Ent. vs Sort. — Top 10 · ${grpAvecCouleur[0]?.abrege ?? ''}`} sous_titre="Top 10 · net entrant − sortant · vert positif / rouge négatif" grapheId="divbar" hideSousTitre
                fullChildren={<DivergingBars donnees={donneesDetail}/>}>
                <DivergingBars donnees={donneesDetail} mini/>
              </GrapheCard>
            </div>
          )}
          </div>
        )}
      </div>
      <ModalDonnees open={showTable} onClose={()=>setShowTable(false)} donnees={donnees} paysSelectionnes={grpAvecCouleur} sousType={sousType} />
    </div>
  );
}

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

// ── Case à cocher (sélection unique) ──────────────────────────────────────────
const BDEF_NIVEAU_STYLE: Record<string,{color:string;fs:number;fw:number;base:string}> = {
  macro_secteur: { color:"#004f91", fs:13,   fw:700, base:"#1a1a2e" },
  groupe:        { color:"#ca631f", fs:12.5, fw:600, base:"#3a4452" },
  secteur:       { color:"#188038", fs:12,   fw:500, base:"#5a6472" },
};
const BDEF_NIVEAU_LABEL: Record<string,string> = {
  macro_secteur:"Macro-secteur", groupe:"Groupe", secteur:"Secteur",
};

function BdefRow({ label, niveau, selected, onSelect, expandable, expanded, onToggle }: {
  label:string; niveau?:string; selected:boolean;
  onSelect:()=>void; expandable?:boolean; expanded?:boolean; onToggle?:()=>void;
}) {
  const st = (niveau && BDEF_NIVEAU_STYLE[niveau]) || { color:"#004f91", fs:12.5, fw:600, base:"#1a1a2e" };
  const selBg = `${st.color}10`;
  const dotColor = niveau ? st.color : "#C5BFBB";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      {expandable ? (
        <button onClick={onToggle} aria-label={expanded ? "Replier" : "Déplier"} style={{ background:"none", border:"none", cursor:"pointer", padding:2, display:"flex", flexShrink:0 }}>
          <ChevronDown size={12} style={{ color:"#9aa5b4", transform:expanded?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
        </button>
      ) : <span style={{ width:16, flexShrink:0 }}/>}
      <button onClick={onSelect}
        style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 9px", borderRadius:8, border:"none", cursor:"pointer", background:(selected&&!niveau)?selBg:"transparent", textAlign:"left" as const, width:"100%" }}
        onMouseEnter={e=>{if(!(selected&&!niveau))(e.currentTarget as HTMLElement).style.background="#F6F5F4";}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=(selected&&!niveau)?selBg:"transparent";}}>
        <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${selected?st.color:dotColor+"99"}`, background:selected?st.color:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s" }}>
          {selected&&!niveau&&<div style={{ width:3, height:3, borderRadius:"50%", background:"#fff" }}/>}
        </div>
        <span style={{ fontSize:st.fs, color:"#4a5568", fontWeight:selected?700:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, letterSpacing:niveau==="macro_secteur"?"-0.01em":"0" }}>{label}</span>
      </button>
    </div>
  );
}

// ── Modal tableau BDEF ────────────────────────────────────────────────────────
function ModalBdefTable({ open, onClose, blocs, annees }: {
  open:boolean; onClose:()=>void; blocs:{libelle:string; couleur:string; indicateurs:BdefIndic[]}[]; annees:number[];
}) {
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
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:1200, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"#004f91", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", margin:0, lineHeight:1.35, flexShrink:0 }}>Tableau de données</h2>
                {annees.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:999, background:"#ECEAE8", border:"1px solid #DFDBD7", fontSize:10.5, fontWeight:700, color:"#3a4452", letterSpacing:"0.02em", flexShrink:0 }}>
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
            <button onClick={onClose} aria-label="Fermer" style={{ width:32, height:32, borderRadius:"50%", background:"#F5F4F3", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="#ECEAE8";}} onMouseLeave={e=>{e.currentTarget.style.background="#F5F4F3";}}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div style={{ overflowY:"auto" as const, flex:1, overflowX:"auto" as const }}>
          <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
            <thead style={{ position:"sticky" as const, top:0, zIndex:2 }}>
              <tr style={{ background:"#FAFAF9" }}>
                <th style={{ padding:"11px 28px", textAlign:"left" as const, fontSize:10, fontWeight:800, color:"#4a5568", letterSpacing:"0.1em", textTransform:"uppercase" as const, position:"sticky" as const, left:0, background:"#FAFAF9", borderRight:"1px solid #F0EEEC", borderBottom:"1px solid #F0EEEC", whiteSpace:"nowrap" as const, minWidth:200 }}>Indicateur</th>
                {annees.map(a=><th key={a} style={{ padding:"11px 12px", fontSize:10, fontWeight:800, color:"#4a5568", letterSpacing:"0.06em", textAlign:"right" as const, minWidth:80, borderBottom:"1px solid #F0EEEC" }}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {blocs.map(b=>(
                <Fragment key={b.libelle}>
                  {multi&&(
                    <tr>
                      <td colSpan={annees.length+1} style={{ padding:"14px 28px 6px", background:"#fff" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ width:8, height:8, borderRadius:"50%", background:b.couleur, flexShrink:0 }} />
                          <span style={{ fontSize:12.5, fontWeight:800, color:b.couleur }}>{b.libelle}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {parCatDe(b.indicateurs).map(({cat,inds})=>(
                    <Fragment key={`${b.libelle}-${cat}`}>
                      <tr><td colSpan={annees.length+1} style={{ padding:multi?"9px 28px 4px 44px":"10px 28px 4px", fontSize:10, fontWeight:800, color:b.couleur, letterSpacing:"0.1em", textTransform:"uppercase" as const, background:"#fff" }}>{cat}</td></tr>
                      {inds.map(ind=>{
                        const { unite:uAff, scale } = uniteEtEchelle(ind);
                        return (
                        <tr key={ind.code} style={{ borderBottom:"1px solid #F6F4F3", background:"#fff", transition:"background 0.1s" }}
                          onMouseEnter={e=>e.currentTarget.style.background="#FAFAF9"}
                          onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                          <td style={{ padding:multi?"9px 28px 9px 58px":"9px 28px 9px 44px", position:"sticky" as const, left:0, background:"inherit", borderRight:"1px solid #F0EEEC", whiteSpace:"nowrap" as const }}>
                            <span style={{ fontSize:12, color:"#4a5568", fontWeight:500 }}>{ind.libelle}</span> <span style={{ fontSize:10, color:"#C5BFBB" }}>· {uAff}</span>
                          </td>
                          {annees.map(a=>{
                            const v = ind.valeurs[a];
                            const display = v!==null&&v!==undefined ? fmtNu(ind, v, scale) : "—";
                            const color = v===null||v===undefined ? "#C5BFBB" : v<0 ? "#dc2626" : "#4a5568";
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
        <div style={{ padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0, gap:10 }}>
          <span style={{ fontSize:11, color:"#9aa5b4" }}>
            {multi?`${blocs.length} éléments · `:""}{nbInds} indicateurs · {annees.length} année{annees.length>1?"s":""} · Source BDEF (ANSD)
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
              Fermer
            </button>
            <button onClick={exporter}
              style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"#004f91", color:"#fff", fontSize:12.5, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, boxShadow:"0 3px 12px rgba(0,79,145,0.25)", fontFamily:"var(--font-google-sans)" }}>
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
    <p style={{ fontSize:10.5, fontWeight:700, color:"#004f91", letterSpacing:"0.14em", textTransform:"uppercase" as const, marginBottom:10 }}>{children}</p>
  );

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(2,20,38,0.45)", backdropFilter:"blur(8px)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>
        <div style={{ height:4, background:"#004f91", flexShrink:0 }} />

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1a1a2e", margin:0, lineHeight:1.35 }}>{ind.libelle}</h2>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const, marginTop:8 }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"#004f91", background:"rgba(0,79,145,0.07)", border:"1px solid rgba(0,79,145,0.19)" }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:"#004f91", display:"inline-block" }} />
                  {libelle}
                </span>
                <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"#4a5568", background:"#F5F4F3" }}>
                  {ind.categorie}
                </span>
                {lastA && (
                  <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"#4a5568", background:"#F5F4F3" }}>
                    {lastA}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width:32, height:32, borderRadius:"50%", background:"#F5F4F3", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="#ECEAE8";}} onMouseLeave={e=>{e.currentTarget.style.background="#F5F4F3";}}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1, display:"flex", flexDirection:"column" as const, gap:22 }}>
          <div>
            <SecTitle>Valeur</SecTitle>
            <div style={{ background:signalBg, border:`1px solid ${signalBorder}`, borderRadius:12, padding:"16px 18px", display:"flex", alignItems:"baseline", gap:10 }}>
              <span style={{ fontSize:"2.2rem", fontWeight:800, color:signalColor, lineHeight:1, letterSpacing:"-0.02em" }}>{fmtBdef(v, ind.unite)}</span>
              {lastA && <span style={{ fontSize:13, color:"#9aa5b4", fontWeight:500 }}>en {lastA}</span>}
            </div>
          </div>
          {historique.length > 0 && (
            <div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:10 }}>
                <p style={{ fontSize:10.5, fontWeight:700, color:"#004f91", letterSpacing:"0.14em", textTransform:"uppercase" as const, margin:0 }}>Historique récent</p>
                <span style={{ fontSize:10.5, fontWeight:600, color:"#9aa5b4" }}>en {histUnite}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(historique.length,5)},1fr)`, gap:8 }}>
                {historique.map(a=>(
                  <div key={a} style={{ background:"rgba(0,79,145,0.04)", border:"1px solid rgba(0,79,145,0.10)", borderRadius:10, padding:"8px 11px", minWidth:0 }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"#004f91", margin:"0 0 3px" }}>{a}</p>
                    <p style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", margin:0, whiteSpace:"nowrap" as const, overflow:"hidden", textOverflow:"ellipsis" }}>{fmtHist(ind.valeurs[a] as number)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <SecTitle>Définition</SecTitle>
            <div style={{ background:"#FAFAF9", border:"1px solid #F0EEEC", borderRadius:12, padding:"14px 18px" }}>
              <p style={{ fontSize:13, color:"#1a1a2e", lineHeight:1.75, margin:0 }}>{definition}</p>
            </div>
          </div>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid #F2F0EF", background:"#FCFBFA", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <span style={{ fontSize:11, color:"#9aa5b4" }}>Unité : {ind.unite} · Source BDEF (ANSD)</span>
          <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid #E4E1DE", background:"#fff", color:"#4a5568", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
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
  const couleur = (sel.niveau && BDEF_NIVEAU_STYLE[sel.niveau]?.color) || "#004f91";

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
      <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"#fff", borderRight:"1px solid #E8E5E3", height:"100vh", overflowY:"auto" as const, position:"sticky" as const, top:0, display:"flex", flexDirection:"column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
        {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,79,145,0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
        <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid #F2F0EF", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
          {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"#1a1a2e", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={()=>setSidebarOpen(o=>!o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background:"rgba(0,79,145,0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center" }}>
              <SlidersHorizontal size={14} style={{ color:"#004f91" }}/>
            </button>
            {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser" style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,0.08)";}}>
              <span className="material-symbols-outlined" style={{ fontSize:15, color:"#dc2626", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
            </button>}
          </div>
        </div>

        {sidebarOpen&&<div style={{ padding:"16px", overflowY:"auto" as const, flex:1 }}>
          {/* Sélecteur de vue */}
          <div style={{ marginBottom:14, paddingBottom:14, borderBottom:"1px solid #F2F0EF" }}>
            <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Vue</p>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:2 }}>
              {([{v:"sectorielle",l:"Analyse sectorielle"},{v:"comparative",l:"Analyse comparative"}] as const).map(o=>(
                <button key={o.v} onClick={()=>setSousVue(o.v)}
                  style={{ textAlign:"left" as const, padding:"7px 10px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:sousVue===o.v?700:500, background:sousVue===o.v?"rgba(0,79,145,0.08)":"transparent", color:sousVue===o.v?"#004f91":"#4a5568", fontFamily:"var(--font-google-sans)" }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {sousVue==="comparative" ? (
            <>
              {/* Sélecteur de type */}
              <div style={{ marginBottom:14 }}>
                <p style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Comparer par</p>
                <div style={{ display:"flex", gap:6 }}>
                  {([{v:"macro_secteur",l:"Macro-sect."},{v:"groupe",l:"Groupes"},{v:"secteur",l:"Secteurs"}] as const).map(o=>(
                    <button key={o.v} onClick={()=>{ setCompType(o.v); setCompSelec([]); setCompData({}); }}
                      style={{ flex:1, padding:"7px 2px", borderRadius:8, border:`1px solid ${compType===o.v?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:11.5, fontWeight:compType===o.v?700:500, background:compType===o.v?"rgba(0,79,145,0.08)":"#F8F7F6", color:compType===o.v?"#004f91":"#4a5568", fontFamily:"var(--font-google-sans)" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compteur sélection */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>Sélection</span>
                <span style={{ fontSize:11, fontWeight:600, color:compSelec.length>=4?"#004f91":"#9aa5b4", background:compSelec.length>=4?"rgba(0,79,145,0.08)":"#F2F0EF", padding:"2px 8px", borderRadius:999 }}>{compSelec.length}/4</span>
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
                      onMouseEnter={e=>{ if(!disabled) (e.currentTarget as HTMLElement).style.background="#F8F7F6"; }}
                      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="transparent"; }}>
                      <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"#C5BFBB"}`, background:sel?col:"transparent", flexShrink:0 }}/>
                      <span style={{ fontSize:12, color:"#4a5568", fontWeight:sel?700:400, lineHeight:1.3, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{n.libelle}</span>
                    </div>
                  );
                };
                const CatHeader = ({txt, open, onToggle}:{txt:string; open:boolean; onToggle:()=>void})=>(
                  <button onClick={onToggle} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"rgba(0,79,145,0.04)", border:"none", cursor:"pointer", borderRadius:7, padding:"5px 8px", marginTop:6, marginBottom:3 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:"#004f91", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{txt}</span>
                    <ChevronDown size={11} style={{ color:"#004f91", transform:open?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
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

              <div style={{ height:1, background:"#F2F0EF", margin:"18px 0" }}/>

              {/* Période */}
              <div style={{ marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
                </div>
                <div style={{ display:"flex", gap:3, background:"#F2F0EF", borderRadius:9, padding:3, marginBottom:12 }}>
                  {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                    <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                      style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"#fff":"transparent", color:modeAnnees===m.v?"#1a1a2e":"#9aa5b4", boxShadow:modeAnnees===m.v?"0 1px 4px rgba(0,0,0,0.1)":"none" }}>
                      {m.l}
                    </button>
                  ))}
                </div>
                {modeAnnees==="plage" ? (
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                    <div style={{ position:"relative" as const, height:24, marginBottom:2 }}>
                      <div style={{ position:"absolute" as const, top:"50%", left:0, right:0, height:4, background:"#E8E5E3", borderRadius:2, transform:"translateY(-50%)" }}/>
                      <div style={{ position:"absolute" as const, top:"50%", left:`${((anneeMin-bornes[0])/span)*100}%`, width:`${Math.max(0,((anneeMax-bornes[0])/span)*100-((anneeMin-bornes[0])/span)*100)}%`, height:4, background:"#004f91", borderRadius:2, transform:"translateY(-50%)" }}/>
                      <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMin} onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax))} className="drs-thumb" style={{zIndex:anneeMin>=anneeMax?4:2} as React.CSSProperties}/>
                      <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMax} onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin))} className="drs-thumb" style={{zIndex:3} as React.CSSProperties}/>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                      <span style={{ fontSize:10, color:"#9aa5b4" }}>—</span>
                      <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
                    {(compAnneesData.length?compAnneesData:anneesData).map(a=>{ const s=anneesSpec.includes(a); return (
                      <button key={a} onClick={()=>setAnneesSpec(prev=>s?prev.filter(x=>x!==a):[...prev,a].sort())}
                        style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${s?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:11, fontWeight:s?700:400, textAlign:"center" as const, background:s?"#004f91":"#F8F7F6", color:s?"#fff":"#4a5568" }}>{a}</button>
                    ); })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>

          {/* Recherche */}
          <div style={{ position:"relative" as const, marginBottom:16 }}>
            <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid #E8E5E3", background:"#F8F7F6", fontSize:12, color:"#1a1a2e", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
            {search&&<button onClick={()=>setSearch("")} aria-label="Effacer la recherche" style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"#9aa5b4" }}/></button>}
          </div>

          {/* Activités */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Activités</span>
              {sel.niveau!=="global"&&(()=>{ const c=BDEF_NIVEAU_STYLE[sel.niveau]?.color||"#004f91"; return <span style={{ fontSize:10, fontWeight:700, color:c, background:`${c}1a`, padding:"1px 6px", borderRadius:999 }}>1</span>; })()}
            </div>

            {/* Global */}
            <BdefRow label="Global des secteurs" selected={sel.niveau==="global"} onSelect={()=>choisir("global",null)} />
            <div style={{ height:1, background:"#F2F0EF", margin:"8px 0" }}/>

            {/* Recherche → résultats à plat */}
            {q ? (
              <div style={{ maxHeight:360, overflowY:"auto" as const }}>
                {resultats.length===0 && <p style={{ fontSize:12, color:"#9aa5b4", textAlign:"center" as const, padding:"8px 0" }}>Aucun résultat</p>}
                {resultats.map(({niveau,node})=>(
                  <div key={`${niveau}-${node.id}`} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <BdefRow label={node.libelle} niveau={niveau} selected={estSel(niveau,node.id)} onSelect={()=>choisir(niveau,node)} />
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, color:BDEF_NIVEAU_STYLE[niveau]?.color||"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.06em", flexShrink:0, paddingRight:4 }}>{BDEF_NIVEAU_LABEL[niveau]||""}</span>
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
                        <div style={{ marginLeft:17, borderLeft:"1.5px solid #EDEAE6", paddingLeft:4, marginTop:1 }}>
                          {groupesDe(macro.id).map(groupe=>{
                            const gOpen = openGroupes.has(groupe.id);
                            return (
                              <div key={groupe.id}>
                                <BdefRow label={groupe.libelle} niveau="groupe" selected={estSel("groupe",groupe.id)}
                                  onSelect={()=>choisir("groupe",groupe)} expandable expanded={gOpen} onToggle={()=>toggleGroupe(groupe.id)} />
                                {gOpen && (
                                  <div style={{ marginLeft:17, borderLeft:"1.5px solid #EDEAE6", paddingLeft:4, marginTop:1, marginBottom:3 }}>
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

          <div style={{ height:1, background:"#F2F0EF", marginBottom:18 }}/>

          {/* Période */}
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
            </div>
            <div style={{ display:"flex", gap:3, background:"#F2F0EF", borderRadius:9, padding:3, marginBottom:12 }}>
              {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                  style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"#fff":"transparent", color:modeAnnees===m.v?"#1a1a2e":"#9aa5b4", boxShadow:modeAnnees===m.v?"0 1px 4px rgba(0,0,0,0.1)":"none" }}>
                  {m.l}
                </button>
              ))}
            </div>
            {modeAnnees==="plage" ? (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                <div style={{ position:"relative" as const, height:24, marginBottom:2 }}>
                  <div style={{ position:"absolute" as const, top:"50%", left:0, right:0, height:4, background:"#E8E5E3", borderRadius:2, transform:"translateY(-50%)" }}/>
                  <div style={{ position:"absolute" as const, top:"50%", left:`${((anneeMin-bornes[0])/span)*100}%`, width:`${Math.max(0,((anneeMax-bornes[0])/span)*100-((anneeMin-bornes[0])/span)*100)}%`, height:4, background:"#004f91", borderRadius:2, transform:"translateY(-50%)" }}/>
                  <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMin} onChange={e=>setAnneeMin(Math.min(+e.target.value,anneeMax))} className="drs-thumb" style={{zIndex:anneeMin>=anneeMax?4:2} as React.CSSProperties}/>
                  <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMax} onChange={e=>setAnneeMax(Math.max(+e.target.value,anneeMin))} className="drs-thumb" style={{zIndex:3} as React.CSSProperties}/>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                  <span style={{ fontSize:10, color:"#9aa5b4" }}>—</span>
                  <span style={{ fontSize:11, fontWeight:700, color:"#004f91", background:"rgba(0,79,145,0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
                {anneesData.map(a=>{ const s=anneesSpec.includes(a); return (
                  <button key={a} onClick={()=>setAnneesSpec(prev=>s?prev.filter(x=>x!==a):[...prev,a].sort())}
                    style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${s?"#004f91":"#E8E5E3"}`, cursor:"pointer", fontSize:11, fontWeight:s?700:400, textAlign:"center" as const, background:s?"#004f91":"#F8F7F6", color:s?"#fff":"#4a5568" }}>{a}</button>
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
                <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"#1a1a2e", margin:0 }}>Analyse comparative {typeLabel}</h2>
                {anneesComp.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"5px 13px", borderRadius:999, background:"#ECEAE8", border:"1px solid #DFDBD7", fontSize:12, fontWeight:700, color:"#3a4452", letterSpacing:"0.02em", flexShrink:0 }}>
                  {anneesComp.length===1 ? `${anneesComp[0]}` : `${anneesComp[0]} — ${anneesComp[anneesComp.length-1]}`}
                </span>}
              </div>
              {compSelec.length>0&&!loadingComp&&<button onClick={()=>setShowTable(true)} style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:12.5, fontWeight:700, padding:"8px 16px", borderRadius:999, border:"1px solid #E4E1DE", background:"#fff", color:"#004f91", cursor:"pointer", fontFamily:"var(--font-google-sans)" }} onMouseEnter={e=>{e.currentTarget.style.background="#F5F4F3";}} onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>
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
              <div style={{ textAlign:"center" as const, padding:"70px 20px", color:"#9aa5b4" }}>
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
            <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"#1a1a2e", margin:0 }}>{sel.libelle}</h2>
            {BDEF_NIVEAU_LABEL[sel.niveau]&&<span style={{ display:"inline-flex", alignItems:"center", padding:"1px 7px", borderRadius:5, background:"#F2F0EF", border:"1px solid #E8E5E3", fontSize:9, fontWeight:700, color:"#9aa5b4", textTransform:"uppercase" as const, letterSpacing:"0.05em", flexShrink:0 }}>
              {BDEF_NIVEAU_LABEL[sel.niveau]}
            </span>}
            {anneesAffichees.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"5px 13px", borderRadius:999, background:"#ECEAE8", border:"1px solid #DFDBD7", fontSize:12, fontWeight:700, color:"#3a4452", letterSpacing:"0.02em", flexShrink:0 }}>
              {anneesAffichees[0]} — {anneesAffichees[anneesAffichees.length-1]}
            </span>}
          </div>
          {indicateurs.length>0&&<button onClick={()=>setShowTable(true)} style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:12.5, fontWeight:700, padding:"8px 16px", borderRadius:999, border:"1px solid #E4E1DE", background:"#fff", color:"#004f91", cursor:"pointer", fontFamily:"var(--font-google-sans)" }} onMouseEnter={e=>{e.currentTarget.style.background="#F5F4F3";}} onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>
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
                  style={{ position:"relative", background:"#fff", borderRadius:14, padding:"13px 14px", border:`1px solid ${pickerOuvert?"rgba(0,79,145,0.35)":"rgba(16,26,46,0.12)"}`, cursor:"pointer", transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow:"none", minWidth:0, zIndex:pickerOuvert?5:undefined }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="var(--ombre-1)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor="rgba(0,79,145,0.35)";}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor=pickerOuvert?"rgba(0,79,145,0.35)":"rgba(16,26,46,0.12)";}}>
                  {/* Remplacer ce KPI — icône révélée au survol de la card */}
                  <BtnSwapKpi ouvert={pickerOuvert} onClick={()=>setPickerSlot(pickerOuvert?-1:slot)}/>
                  <p style={{ fontSize:9, fontWeight:800, color:couleur, textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:7, lineHeight:1.4, paddingRight:26 }}>{ind?.libelle??code}</p>
                  <p style={{ fontSize:"1.05rem", fontWeight:800, color:"#1a1a2e", lineHeight:1.15 }}>{ind?fmtBdef(v,ind.unite,true):"—"}</p>
                  {lastA&&<p style={{ fontSize:10, color:"#9aa5b4", marginTop:5, lineHeight:1 }}>en {lastA}</p>}
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
                  style={{ position:"relative", background:"#fff", borderRadius:14, padding:"13px 14px", border:`1.5px dashed ${pickerOuvert?"#004f91":"#E8E5E3"}`, display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", gap:4, minHeight:90, cursor:"pointer", transition:"border-color 0.15s", zIndex:pickerOuvert?5:undefined }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="#004f91"; }}
                  onMouseLeave={e=>{ if(!pickerOuvert) e.currentTarget.style.borderColor="#E8E5E3"; }}>
                  <span style={{ fontSize:20, color:pickerOuvert?"#004f91":"#C5BFBB", lineHeight:1 }}>+</span>
                  <span style={{ fontSize:10, color:pickerOuvert?"#004f91":"#C5BFBB", textAlign:"center" as const, lineHeight:1.5 }}>Ajouter un<br/>indicateur</span>
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
          <div style={{ textAlign:"center" as const, padding:"70px 20px", color:"#9aa5b4" }}>
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

// ── Page principale ───────────────────────────────────────────────────────────
export default function IdePage() {
  // Navigation de la page dans l'URL : vues partageables par lien, F5 conserve l'état
  const [ongletPrincipal, setOngletPrincipal] = useEtatUrl<"ide"|"national">("onglet", "ide", ["ide","national"]);
  const [section,    setSection]    = useEtatUrl<"realises"|"projetes">("section", "realises", ["realises","projetes"]);
  const [sousOnglet, setSousOnglet] = useEtatUrl<"pays"|"comparative"|"monde">("analyse", "pays", ["pays","comparative","monde"]);
  const [vueP, setVueP] = useEtatUrl<"pays"|"secteurs">("vue", "pays", ["pays","secteurs"]);
  const [typeSecteurs, setTypeSecteurs] = useEtatUrl<"secteur"|"comparative">("typesec", "secteur", ["secteur","comparative"]);
  const [sousType,   setSousType]   = useEtatUrl<"fluxstock"|"greenfield"|"fusion">("categorie", "fluxstock", ["fluxstock","greenfield","fusion"]);
  const [paysDispo,  setPaysDispo]  = useState<any[]>([]);
  const [showTable,  setShowTable]  = useState(false);

  useEffect(() => {
    fetch(`${API}/ide/cnuced/pays-disponibles`).then(r=>r.json()).then(d=>setPaysDispo(d||[])).catch(()=>{});
  }, []);

  useEffect(() => { setShowTable(false); }, [sousOnglet, section, vueP, typeSecteurs]);

  // d3 est chargé dans un chunk séparé : on attend qu'il soit prêt avant de
  // rendre quoi que ce soit qui dessine (les données, elles, se chargent en parallèle)
  const d3Pret = useD3Pret();
  if (!d3Pret) return <div style={{ minHeight:"100vh", background:"#F6F5F3" }}/>;

  return (
    <div style={{ minHeight:"100vh", background:"#F6F5F3", fontFamily:"var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.drs-thumb{-webkit-appearance:none;appearance:none;background:transparent;height:24px;margin:0;padding:0;position:absolute;top:0;left:0;width:100%;pointer-events:none}
.drs-thumb::-webkit-slider-runnable-track{background:transparent;height:4px}
.drs-thumb::-moz-range-track{background:transparent;height:4px}
.drs-thumb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all;margin-top:-6px}
.drs-thumb::-moz-range-thumb{background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all}`}</style>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <BarreTitre titre="Investissements Privés" compact actions={<NavActions onDark home flouFond/>}>
        <BarreTitreSegment options={[{v:"ide",l:"Investissements Directs Étrangers"},{v:"national",l:"Investissements nationaux"}]} value={ongletPrincipal} onChange={setOngletPrincipal}/>
      </BarreTitre>

      {/* ── Onglets ──────────────────────────────────────────────────────────── */}
      {ongletPrincipal === "ide" && (
        <div style={{ background:"#fff", position:"sticky" as const, top:0, zIndex:10, flexShrink:0, borderBottom:"1px solid #ECEAE7" }}>
          <div style={{ maxWidth:1400, margin:"0 auto", padding:"10px 40px" }}>

            {/* Niveau 1 : Réalisés / Projetés — segmented control du site */}
            <div style={{ display:"inline-flex", background:"#F2F0EF", borderRadius:999, padding:3, gap:3 }}>
              {([
                {v:"realises", l:"Investissements réalisés"},
                {v:"projetes", l:"Investissements projetés"},
              ] as const).map(s=>(
                <button key={s.v} onClick={()=>setSection(s.v)}
                  style={{ padding:"6px 16px", borderRadius:999, border:"none", cursor:"pointer", fontSize:12.5, fontWeight:700, background:section===s.v?"#fff":"transparent", color:section===s.v?"#004f91":"#9aa5b4", boxShadow:section===s.v?"0 1px 4px rgba(0,0,0,0.10)":"none", fontFamily:"var(--font-google-sans)", transition:"all 0.15s", whiteSpace:"nowrap" as const }}>
                  {s.l}
                </button>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ── Contenu — IDE ────────────────────────────────────────────────────── */}
      {ongletPrincipal === "ide" && (
        <>
          {/* Investissements réalisés (CNUCED) */}
          {section === "realises" && vueP === "pays" && (
            <>
              {/* « comparative » (anciennes URLs) est absorbé par la vue Pays :
                  la comparaison se déclenche via le « + » de l'en-tête */}
              {sousOnglet !== "monde"       && <OngletPays paysDispo={paysDispo} showTable={showTable} setShowTable={setShowTable} sousOnglet="pays" setSousOnglet={setSousOnglet} sousType={sousType} setSousType={setSousType} vueP={vueP} setVueP={setVueP}/>}
              {sousOnglet === "monde"       && <OngletMonde showTable={showTable} setShowTable={setShowTable} sousOnglet={sousOnglet} setSousOnglet={setSousOnglet} sousType={sousType} setSousType={setSousType} vueP={vueP} setVueP={setVueP}/>}
            </>
          )}
          {section === "realises" && vueP === "secteurs" && (
            <OngletSecteurs showTable={showTable} setShowTable={setShowTable} sousType={sousType} setSousType={setSousType} vueP={vueP} setVueP={setVueP} typeAnalyse={typeSecteurs} setTypeAnalyse={setTypeSecteurs} setSousOnglet={setSousOnglet}/>
          )}
          {/* Investissements projetés (FDI Markets) */}
          {section === "projetes" && (
            <div style={{ maxWidth:1400, margin:"0 auto", padding:"80px 40px", textAlign:"center" as const }}>
              <div style={{ display:"inline-flex", flexDirection:"column" as const, alignItems:"center", gap:16 }}>
                <div style={{ width:64, height:64, borderRadius:16, background:"rgba(0,79,145,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:32 }}>📈</span>
                </div>
                <h2 style={{ fontWeight:800, fontSize:"1.4rem", color:"#1a1a2e" }}>FDI Markets</h2>
                <p style={{ fontSize:14, color:"#9aa5b4", maxWidth:380, lineHeight:1.7 }}>Les données FDI Markets seront disponibles prochainement.</p>
                <div style={{ background:"rgba(0,79,145,0.07)", border:"1px solid rgba(0,79,145,0.2)", borderRadius:10, padding:"10px 20px" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#004f91" }}>Disponible prochainement</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Contenu — Investissements nationaux ──────────────────────────────── */}
      {ongletPrincipal === "national" && <OngletNational />}
    </div>
  );
}
