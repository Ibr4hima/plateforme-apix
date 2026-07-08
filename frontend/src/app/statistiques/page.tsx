"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreBadge, BarreTitreSegment } from "@/components/shared/BarreTitre";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { ChevronDown, ChevronUp, FileSpreadsheet, Loader2, Maximize2, Search, SlidersHorizontal, Table, X } from "lucide-react";
import * as XLSX from "xlsx";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Palette de couleurs par pays (analyse comparative / fiche)
const PALETTE = ["#004f91", "#ca631f", "#188038", "#6A1B9A", "#0891b2", "#b91c1c", "#a16207", "#4338ca"];

type Indicateur = { code: string; libelle: string; unite: string; categorie: string; ordre: number; derive: boolean };
type Pays = { id: number; nom: string; code_iso3: string; continent: string; region_geo: string | null };
type Donnee = { pays_id: number; pays: string; annee: number; indicateur: string; valeur: number | null };

// ── Formatage des valeurs par unité ───────────────────────────────────────────
function fmt(valeur: number | null | undefined, unite: string): string {
  if (valeur === null || valeur === undefined || isNaN(valeur)) return "—";
  const v = valeur;
  if (unite === "%") return `${v > 0 ? "+" : ""}${v.toFixed(1)} %`;
  if (unite === "USD") {
    const a = Math.abs(v);
    if (a >= 1e9) return `${(v / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md $`;
    if (a >= 1e6) return `${(v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M $`;
    return `${Math.round(v).toLocaleString("fr-FR")} $`;
  }
  if (unite === "Md USD") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md $`;
  if (unite === "hab/km²") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} hab/km²`;
  if (unite === "km²") return `${Math.round(v).toLocaleString("fr-FR")} km²`;
  if (unite === "habitants") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M hab.`;
    return `${Math.round(v).toLocaleString("fr-FR")} hab.`;
  }
  return v.toLocaleString("fr-FR");
}

// ── Regroupement des pays par continent ───────────────────────────────────────
const VUES: { v: "pays" | "comparative" | "fiche"; l: string }[] = [
  { v: "pays", l: "Pays" },
  { v: "comparative", l: "Analyse comparative" },
  { v: "fiche", l: "Fiche de comparaison" },
];
const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];
const MAX_KPI = 5;
const KPI_DEFAUT = ["population", "superficie", "densite", "pib", "pib_hab"];
function sortContinents(conts: string[]) {
  return [...conts].sort((a, b) => {
    const ia = CONT_ORDER.indexOf(a), ib = CONT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });
}

// ── Fiche de comparaison (modal) ──────────────────────────────────────────────
function FicheComparaison({ paysIds, pays, onClose }: { paysIds: number[]; pays: Pays[]; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`${API}/statistiques/comparaison?pays=${paysIds.join(",")}`).then(r => r.json()).then(setData).catch(() => {});
  }, [paysIds]);
  const cols = data?.pays || [];
  const inds: Indicateur[] = data?.indicateurs || [];
  // « mieux disant » par indicateur (max, sauf densité qui reste neutre)
  const meilleur = (code: string): number | null => {
    const vals = cols.map((c: any) => data.valeurs[String(c.id)]?.[code]?.valeur).filter((v: any) => v !== null && v !== undefined);
    if (!vals.length || code === "densite" || code === "superficie") return null;
    return Math.max(...vals);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 880, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "#004f91", flexShrink: 0 }} />
        <div style={{ padding: "18px 28px 16px", borderBottom: "1px solid #F2F0EF", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a2e", margin: 0 }}>Fiche de comparaison</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {cols.map((c: any, i: number) => (
                <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: PALETTE[i % PALETTE.length], background: `${PALETTE[i % PALETTE.length]}12`, padding: "3px 10px", borderRadius: 999 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: PALETTE[i % PALETTE.length] }} />{c.nom}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={15} color="#4a5568" />
          </button>
        </div>
        <div style={{ padding: "6px 28px 22px", overflowY: "auto", flex: 1 }}>
          {!data ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={24} style={{ color: "#9aa5b4", animation: "spin 1s linear infinite" }} /></div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ECEAE7" }}>
                  <th style={{ padding: "14px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>Indicateur</th>
                  {cols.map((c: any, i: number) => (
                    <th key={c.id} style={{ padding: "14px 12px", textAlign: "right", fontSize: 11.5, fontWeight: 800, color: PALETTE[i % PALETTE.length] }}>{c.nom}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inds.map(ind => {
                  const best = meilleur(ind.code);
                  return (
                    <tr key={ind.code} style={{ borderBottom: "1px solid #F5F4F3" }}>
                      <td style={{ padding: "11px 12px" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1a1a2e" }}>{ind.libelle}</div>
                        <div style={{ fontSize: 10.5, color: "#9aa5b4" }}>{ind.unite}</div>
                      </td>
                      {cols.map((c: any) => {
                        const cell = data.valeurs[String(c.id)]?.[ind.code];
                        const v = cell?.valeur;
                        const estBest = best !== null && v === best && cols.length > 1;
                        return (
                          <td key={c.id} style={{ padding: "11px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ fontSize: 13, fontWeight: estBest ? 800 : 600, color: estBest ? "#188038" : v === null || v === undefined ? "#C5BFBB" : "#1a1a2e" }}>
                              {fmt(v, ind.unite)}
                            </span>
                            {cell?.annee && <span style={{ display: "block", fontSize: 9.5, color: "#C5BFBB" }}>{cell.annee}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: "14px 28px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "#9aa5b4" }}>Valeur en vert = plus élevée · dernière année disponible</span>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #E4E1DE", background: "#fff", color: "#4a5568", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ── Formatage monétaire commerce (USD) ────────────────────────────────────────
function fmtUSD(v: number | null): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Md $`;
  if (a >= 1e6) return `${(v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M $`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k $`;
  return `${Math.round(v).toLocaleString("fr-FR")} $`;
}

// ── Panneau Flux bilatéraux (données commerciales) ────────────────────────────
type OptionPaysCom = { id: number; nom: string; code_iso3: string | null; continent: string | null; region_geo: string | null };
const VUES_COM: { v: "exportateur" | "importateur"; l: string }[] = [
  { v: "exportateur", l: "Exportateur" },
  { v: "importateur", l: "Importateur" },
];
function CommercePanel() {
  const [vue, setVue] = useState<"exportateur" | "importateur">("exportateur");
  const [annees, setAnnees] = useState<number[]>([]);
  const [ressources, setRessources] = useState<{ nom_en: string; libelle: string }[]>([]);
  const [paysOpts, setPaysOpts] = useState<OptionPaysCom[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Barre latérale
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [searchPays, setSearchPays] = useState("");
  const [openConts, setOpenConts] = useState<Set<string>>(new Set());
  // Période
  const [modeAnnees, setModeAnnees] = useState<"plage" | "specifiques">("plage");
  const [bornes, setBornes] = useState<[number, number]>([2020, 2024]);
  const [anneeMin, setAnneeMin] = useState(2020);
  const [anneeMax, setAnneeMax] = useState(2024);
  const [anneesSpec, setAnneesSpec] = useState<number[]>([]);
  const [periodeTouchee, setPeriodeTouchee] = useState(false);
  // Ressources sélectionnées (nom_en)
  const [ressSel, setRessSel] = useState<string[]>([]);
  const [qRess, setQRess] = useState("");
  // Table
  const [lignes, setLignes] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [chargTable, setChargTable] = useState(false);
  const [kpis, setKpis] = useState<any>(null);
  const [chargKpis, setChargKpis] = useState(false);
  const [balance, setBalance] = useState<{ annee: number; exportations: number; importations: number; balance: number }[]>([]);
  const [tops, setTops] = useState<{ partenaires: { nom: string; valeur: number }[]; ressources: { ressource: string; valeur: number }[]; total: number } | null>(null);
  const [conc, setConc] = useState<{ points: { rang: number; nom: string; part_cumulee: number }[]; total_partenaires: number } | null>(null);
  const TAILLE = 50;

  const isResizing = useRef(false);
  const startResize = (e: any) => {
    isResizing.current = true;
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(220, Math.min(520, startW + ev.clientX - startX))); };
    const onUp = () => { isResizing.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    fetch(`${API}/statistiques/commerce/filtres`).then(r => r.json()).then(d => {
      const ann: number[] = (d.annees || []).slice().sort((a: number, b: number) => a - b);
      setAnnees(ann); setRessources(d.ressources || []); setPaysOpts(d.pays || []);
      setRessSel((d.ressources || []).map((r: any) => r.nom_en));
      if (ann.length) { setBornes([ann[0], ann[ann.length - 1]]); setAnneeMin(ann[0]); setAnneeMax(ann[ann.length - 1]); }
      const sen = (d.pays || []).find((p: any) => p.code_iso3 === "SEN");
      setSelId(sen ? sen.id : (d.pays && d.pays[0] ? d.pays[0].id : null));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // KPIs agrégés (période + ressources, hors recherche texte)
  useEffect(() => {
    if (!selId) { setKpis(null); return; }
    setChargKpis(true);
    const p = new URLSearchParams({ pays_id: String(selId), direction: vue });
    if (modeAnnees === "specifiques") { if (anneesSpec.length) p.set("annees", anneesSpec.join(",")); }
    else { p.set("annee_min", String(anneeMin)); p.set("annee_max", String(anneeMax)); }
    if (ressources.length && ressSel.length && ressSel.length < ressources.length) p.set("ressources", ressSel.join(","));
    fetch(`${API}/statistiques/commerce/kpis?${p.toString()}`)
      .then(r => r.json()).then(setKpis).catch(() => setKpis(null))
      .finally(() => setChargKpis(false));
  }, [vue, selId, modeAnnees, anneeMin, anneeMax, anneesSpec, ressSel, ressources.length]);

  // Balance commerciale (exp − imp) — indépendante de la vue
  useEffect(() => {
    if (!selId) { setBalance([]); return; }
    const p = new URLSearchParams({ pays_id: String(selId) });
    if (modeAnnees === "specifiques") { if (anneesSpec.length) p.set("annees", anneesSpec.join(",")); }
    else { p.set("annee_min", String(anneeMin)); p.set("annee_max", String(anneeMax)); }
    if (ressources.length && ressSel.length && ressSel.length < ressources.length) p.set("ressources", ressSel.join(","));
    fetch(`${API}/statistiques/commerce/balance?${p.toString()}`)
      .then(r => r.json()).then(d => setBalance(Array.isArray(d) ? d : [])).catch(() => setBalance([]));
  }, [selId, modeAnnees, anneeMin, anneeMax, anneesSpec, ressSel, ressources.length]);

  // Tops (débouchés / ressources) — dépend de la direction (vue)
  useEffect(() => {
    if (!selId) { setTops(null); return; }
    const p = new URLSearchParams({ pays_id: String(selId), direction: vue });
    if (modeAnnees === "specifiques") { if (anneesSpec.length) p.set("annees", anneesSpec.join(",")); }
    else { p.set("annee_min", String(anneeMin)); p.set("annee_max", String(anneeMax)); }
    if (ressources.length && ressSel.length && ressSel.length < ressources.length) p.set("ressources", ressSel.join(","));
    fetch(`${API}/statistiques/commerce/tops?${p.toString()}`)
      .then(r => r.json()).then(setTops).catch(() => setTops(null));
    fetch(`${API}/statistiques/commerce/concentration?${p.toString()}`)
      .then(r => r.json()).then(setConc).catch(() => setConc(null));
  }, [vue, selId, modeAnnees, anneeMin, anneeMax, anneesSpec, ressSel, ressources.length]);

  const span = Math.max(1, bornes[1] - bornes[0]);
  const nbPages = Math.max(1, Math.ceil(total / TAILLE));
  const senId = useMemo(() => paysOpts.find(p => p.code_iso3 === "SEN")?.id ?? null, [paysOpts]);
  const selPays = paysOpts.find(p => p.id === selId);

  const groupedPays = useMemo(() => {
    const g: Record<string, Record<string, OptionPaysCom[]>> = {};
    paysOpts.filter(p => !searchPays || p.nom.toLowerCase().includes(searchPays.toLowerCase()))
      .forEach(p => {
        const c = p.continent || "Autre";
        const z = p.region_geo || "Autre";
        ((g[c] ||= {})[z] ||= []).push(p);
      });
    for (const c of Object.keys(g))
      for (const z of Object.keys(g[c]))
        g[c][z].sort((a, b) => { if (a.code_iso3 === "SEN") return -1; if (b.code_iso3 === "SEN") return 1; return a.nom.localeCompare(b.nom, "fr"); });
    return g;
  }, [paysOpts, searchPays]);
  useEffect(() => { if (searchPays) setOpenConts(new Set(Object.keys(groupedPays))); }, [searchPays, groupedPays]);

  const toggleCont = (c: string) => setOpenConts(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const toggleRess = (code: string) => setRessSel(prev => prev.includes(code) ? (prev.length > 1 ? prev.filter(c => c !== code) : prev) : [...prev, code]);

  const perLabel = modeAnnees === "specifiques" && anneesSpec.length > 0
    ? (anneesSpec.length === 1 ? `${anneesSpec[0]}` : `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;
  const paysChange = selId !== senId;
  const periodeChange = modeAnnees === "specifiques" ? anneesSpec.length > 0 : (anneeMin !== bornes[0] || anneeMax !== bornes[1]);
  const ressChange = ressources.length > 0 && ressSel.length !== ressources.length;
  const nbFiltres = (paysChange ? 1 : 0) + (periodeChange ? 1 : 0) + (ressChange ? 1 : 0);
  const reinit = () => {
    setSelId(senId); setModeAnnees("plage"); setAnneeMin(bornes[0]); setAnneeMax(bornes[1]);
    setAnneesSpec([]); setPeriodeTouchee(false); setRessSel(ressources.map(r => r.nom_en));
  };

  const LBL: any = { fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em" };
  const TH: any = { padding: "11px 16px", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6b7684", whiteSpace: "nowrap" };
  const TD: any = { padding: "10px 16px", verticalAlign: "middle" };
  const ressFiltrees = ressources.filter(r => !qRess || (r.libelle || r.nom_en).toLowerCase().includes(qRess.toLowerCase()));

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 260, gap: 12, color: "#9aa5b4" }}>
      <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /><span style={{ fontSize: 14 }}>Chargement…</span>
    </div>
  );
  if (!annees.length) return (
    <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucune donnée commerciale</p>
      <p style={{ fontSize: 14, marginTop: 6 }}>Les flux bilatéraux seront disponibles après import dans l&apos;administration.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {/* ── Barre de filtre ── */}
      <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s", background: "#fff", borderRight: "1px solid #E8E5E3", height: "calc(100vh - 64px)", overflowY: "auto", position: "sticky", top: 64, display: "flex", flexDirection: "column" }}>
        {sidebarOpen && <div onMouseDown={startResize} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.5)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
        <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
          {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" }}>Filtres</span>}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
              <SlidersHorizontal size={14} style={{ color: "#004f91" }} />
              {sidebarOpen && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
            </button>
            {sidebarOpen && nbFiltres > 0 && <button onClick={reinit} title="Tout réinitialiser" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.20)", cursor: "pointer", borderRadius: 999, padding: "5px", display: "flex", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; }}>
              <X size={13} style={{ color: "#dc2626" }} />
            </button>}
          </div>
        </div>
        {sidebarOpen && <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
          {/* Vue */}
          <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #F2F0EF" }}>
            <p style={{ ...LBL, marginBottom: 8 }}>Vue</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {VUES_COM.map(o => (
                <button key={o.v} onClick={() => setVue(o.v)}
                  style={{ textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: vue === o.v ? 700 : 500, background: vue === o.v ? "rgba(0,79,145,0.08)" : "transparent", color: vue === o.v ? "#004f91" : "#4a5568", fontFamily: "var(--font-google-sans)" }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          {/* Recherche pays */}
          <div style={{ position: "relative", marginBottom: 18 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
            <input value={searchPays} onChange={e => setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
              style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
            {searchPays && <button onClick={() => setSearchPays("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
          </div>
          <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
          {/* Pays */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={LBL}>Pays</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.18)", padding: "1px 6px", borderRadius: 999 }}>1</span>
            </div>
            {/* Sénégal épinglé (référence) */}
            {senId !== null && (() => {
              const sel = selId === senId;
              return (
                <div style={{ marginBottom: 8, marginLeft: 6 }}>
                  <button onClick={() => setSelId(senId)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left", width: "100%" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? "#004f91" : "#C5BFBB"}`, background: sel ? "#004f91" : "transparent", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#4a5568", fontWeight: sel ? 700 : 400 }}>Sénégal</span>
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "#9aa5b4", fontWeight: 600, background: "#F2F0EF", padding: "1px 5px", borderRadius: 4 }}>Réf.</span>
                  </button>
                </div>
              );
            })()}
            <div style={{ height: 1, background: "#F2F0EF", marginBottom: 8 }} />
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {sortContinents(Object.keys(groupedPays)).map(continent => {
                const isOpen = openConts.has(continent);
                const zones = groupedPays[continent];
                return (
                  <div key={continent} style={{ marginBottom: 6 }}>
                    <button onClick={() => toggleCont(continent)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: 7, background: "rgba(0,79,145,0.04)", border: "none", cursor: "pointer", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", letterSpacing: "0.1em", textTransform: "uppercase" }}>{continent}</span>
                      <ChevronDown size={11} style={{ color: "#004f91", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                    </button>
                    {isOpen && Object.entries(zones).sort(([a], [b]) => a.localeCompare(b, "fr")).map(([zone, paysInZone]) => (
                      <div key={zone} style={{ marginLeft: 6, marginBottom: 4 }}>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#C5BFBB", textTransform: "uppercase", letterSpacing: "0.1em", padding: "2px 8px", marginBottom: 2 }}>{zone}</p>
                        {paysInZone.map(p => {
                          const sel = selId === p.id;
                          if (p.id === senId) return (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, width: "100%", opacity: 0.35, cursor: "not-allowed" }}>
                              <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? "#004f91" : "#C5BFBB"}`, background: sel ? "#004f91" : "transparent", flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                              <span style={{ marginLeft: "auto", fontSize: 9, color: "#9aa5b4" }}>Réf.</span>
                            </div>
                          );
                          return (
                            <button key={p.id} onClick={() => setSelId(p.id)}
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left", width: "100%" }}
                              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#F8F7F6"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                              <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? "#004f91" : "#C5BFBB"}`, background: sel ? "#004f91" : "transparent", flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "#4a5568", fontWeight: sel ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
              {Object.keys(groupedPays).length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center", padding: "8px 0" }}>Aucun pays trouvé</p>}
            </div>
          </div>
          <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
          {/* Période */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={LBL}>Période</span>
            </div>
            <div style={{ display: "flex", gap: 3, background: "#F2F0EF", borderRadius: 9, padding: 3, marginBottom: 12 }}>
              {[{ v: "plage", l: "Plage" }, { v: "specifiques", l: "Années" }].map(m => (
                <button key={m.v} onClick={() => setModeAnnees(m.v as "plage" | "specifiques")}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: modeAnnees === m.v ? "#fff" : "transparent", color: modeAnnees === m.v ? "#1a1a2e" : "#9aa5b4", boxShadow: modeAnnees === m.v ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
                  {m.l}
                </button>
              ))}
            </div>
            {modeAnnees === "plage" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ position: "relative", height: 24, marginBottom: 2 }}>
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 4, background: "#E8E5E3", borderRadius: 2, transform: "translateY(-50%)" }} />
                  <div style={{ position: "absolute", top: "50%", left: `${((anneeMin - bornes[0]) / span) * 100}%`, width: `${Math.max(0, ((anneeMax - bornes[0]) / span) * 100 - ((anneeMin - bornes[0]) / span) * 100)}%`, height: 4, background: "#004f91", borderRadius: 2, transform: "translateY(-50%)" }} />
                  <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMin}
                    onChange={e => { setPeriodeTouchee(true); setAnneeMin(Math.min(+e.target.value, anneeMax)); }}
                    className="drs-thumb" style={{ zIndex: anneeMin >= anneeMax ? 4 : 2 } as any} />
                  <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMax}
                    onChange={e => { setPeriodeTouchee(true); setAnneeMax(Math.max(+e.target.value, anneeMin)); }}
                    className="drs-thumb" style={{ zIndex: 3 } as any} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "2px 8px", borderRadius: 6 }}>{anneeMin}</span>
                  <span style={{ fontSize: 10, color: "#9aa5b4" }}>—</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "2px 8px", borderRadius: 6 }}>{anneeMax}</span>
                </div>
                <p style={{ fontSize: 11, color: "#9aa5b4", textAlign: "center" }}>{anneeMax - anneeMin + 1} année{anneeMax - anneeMin + 1 > 1 ? "s" : ""}</p>
              </div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3, marginBottom: 8 }}>
                  {Array.from({ length: span + 1 }, (_, i) => bornes[0] + i).map(a => {
                    const sel = anneesSpec.includes(a);
                    return (
                      <button key={a} onClick={() => { setPeriodeTouchee(true); setAnneesSpec(prev => sel ? prev.filter(x => x !== a) : [...prev, a].sort()); }}
                        style={{ padding: "5px 0", borderRadius: 5, border: `1px solid ${sel ? "#004f91" : "#E8E5E3"}`, cursor: "pointer", fontSize: 10, fontWeight: sel ? 700 : 400, textAlign: "center", background: sel ? "#004f91" : "#F8F7F6", color: sel ? "#fff" : "#4a5568", transition: "all 0.1s" }}>
                        {a}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#4a5568" }}>{anneesSpec.length > 0 ? `${anneesSpec.length} année${anneesSpec.length > 1 ? "s" : ""}` : ""}</span>
                  {anneesSpec.length > 0 && <button onClick={() => setAnneesSpec([])} style={{ fontSize: 11, color: "#9aa5b4", background: "none", border: "none", cursor: "pointer" }}>Effacer</button>}
                </div>
              </div>
            )}
          </div>
          <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
          {/* Ressources */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={LBL}>Ressources</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "2px 8px", borderRadius: 999 }}>{ressSel.length}/{ressources.length}</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <button onClick={() => setRessSel(ressources.map(r => r.nom_en))} style={{ fontSize: 11, color: "#004f91", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}>Tout</button>
              <button onClick={() => setRessSel(ressources.length ? [ressources[0].nom_en] : [])} style={{ fontSize: 11, color: "#9aa5b4", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Réduire</button>
            </div>
            {ressources.length > 8 && (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
                <input value={qRess} onChange={e => setQRess(e.target.value)} placeholder="Filtrer les ressources…"
                  style={{ width: "100%", paddingLeft: 28, paddingRight: 8, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 11.5, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 260, overflowY: "auto" }}>
              {ressFiltrees.map(r => {
                const on = ressSel.includes(r.nom_en);
                const disabled = on && ressSel.length <= 1;
                return (
                  <div key={r.nom_en} title={r.libelle || r.nom_en}
                    onClick={() => { if (!disabled) toggleRess(r.nom_en); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, background: "transparent", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = "#F8F7F6"; }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; }}>
                    <div style={{ width: 9, height: 9, borderRadius: 3, border: `2px solid ${on ? "#004f91" : "#C5BFBB"}`, background: on ? "#004f91" : "transparent", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#4a5568", flex: 1, minWidth: 0, lineHeight: 1.35, fontWeight: on ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.libelle || r.nom_en}</span>
                  </div>
                );
              })}
              {ressFiltrees.length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center", padding: "8px 0" }}>Aucune ressource</p>}
            </div>
          </div>
        </div>}
      </aside>

      {/* ── Zone principale ── */}
      <div style={{ flex: 1, minWidth: 0, padding: "32px 40px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#004f91", flexShrink: 0 }} />
          <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "#1a1a2e", margin: 0 }}>{selPays?.nom || "—"}</h2>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, background: "rgba(0,79,145,0.08)", fontSize: 12, fontWeight: 700, color: "#004f91", flexShrink: 0 }}>{vue === "exportateur" ? "Exportations" : "Importations"}</span>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, background: "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.02em", flexShrink: 0 }}>{perLabel}</span>
        </div>

        {/* KPI cards — valeurs de la dernière année sélectionnée (sauf « Année record ») */}
        {(() => {
          const expDir = vue === "exportateur";
          const ref = kpis?.annee_ref;
          const enRef = ref ? `en ${ref}` : "";
          const cards = [
            { label: expDir ? "Total exportations" : "Total importations", sub: "Dernière année", value: fmtUSD(kpis?.total ?? null), indicatif: enRef, text: false },
            { label: "Année record", sub: "", value: kpis?.annee_record ? String(kpis.annee_record.annee) : "—", indicatif: kpis?.annee_record ? fmtUSD(kpis.annee_record.valeur) : "", text: false },
            { label: expDir ? `1er client · ${ref ?? "—"}` : `1er fournisseur · ${ref ?? "—"}`, sub: "", value: kpis?.top_partenaire?.nom || "—", indicatif: kpis?.top_partenaire ? `${fmtUSD(kpis.top_partenaire.valeur)} ${enRef}` : "", text: true },
            { label: `1re ressource · ${ref ?? "—"}`, sub: "", value: kpis?.top_ressource?.ressource || "—", indicatif: kpis?.top_ressource ? `${fmtUSD(kpis.top_ressource.valeur)} ${enRef}` : "", text: true },
            { label: expDir ? "Part du 1er débouché" : "Part du 1er fournisseur", sub: `Concentration · ${ref ?? "—"}`, value: kpis?.part_top_partenaire != null ? `${kpis.part_top_partenaire.toFixed(1)} %` : "—", indicatif: kpis?.top_partenaire?.nom ? `${expDir ? "vers" : "depuis"} ${kpis.top_partenaire.nom}` : "", text: false },
          ];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20, opacity: chargKpis ? 0.5 : 1, transition: "opacity 0.15s" }}>
              {cards.map((c, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "13px 14px", border: "1px solid #ECEAE7", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", minWidth: 0 }}>
                  <div style={{ marginBottom: 7 }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", color: "#004f91", textTransform: "uppercase", lineHeight: 1.4 }}>{c.label}</p>
                    {c.sub && <p style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.06em", color: "#9aa5b4", textTransform: "uppercase", marginTop: 2, lineHeight: 1.3 }}>{c.sub}</p>}
                  </div>
                  <p title={c.text ? c.value : undefined} style={{ fontSize: c.text ? "0.95rem" : "1.15rem", fontWeight: 800, color: "#1a1a2e", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: c.text ? "normal" : "nowrap", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{c.value}</p>
                  {c.indicatif && <p style={{ fontSize: 10, color: "#9aa5b4", marginTop: 5, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.indicatif}</p>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Graphes */}
        {balance.length > 0 && (() => {
          const expDir = vue === "exportateur";
          const a0 = balance[0].annee, a1 = balance[balance.length - 1].annee;
          const balSerie = [{ nom: "Balance commerciale", couleur: "#004f91", data: balance.map(b => ({ annee: b.annee, valeur: b.balance })) }];
          const fluxSerie = [{ nom: expDir ? "Exportations" : "Importations", couleur: "#004f91", data: balance.map(b => ({ annee: b.annee, valeur: expDir ? b.exportations : b.importations })) }];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 20 }}>
              {/* 1. Évolution du total exporté / importé */}
              <GrapheCard titre={expDir ? "Évolution des exportations" : "Évolution des importations"} sous_titre={`Total · ${a0}–${a1}`} series={fluxSerie} grapheId={`stat_flux_${vue}_${selId}`} hideLegend
                fullChildren={<GrapheMultiPays series={fluxSerie} height={340} type="line" fmt={(v: number | null) => fmtUSD(v)} />}>
                <GrapheMultiPays series={fluxSerie} height={160} type="line" fmt={(v: number | null) => fmtUSD(v)} />
              </GrapheCard>
              {/* Balance commerciale (partagée) */}
              <GrapheCard titre="Balance commerciale" sous_titre={`Exportations − importations · ${a0}–${a1}`} series={balSerie} grapheId={`stat_balance_${selId}`} hideLegend
                fullChildren={<GrapheMultiPays series={balSerie} height={340} type="line" fmt={(v: number | null) => fmtUSD(v)} />}>
                <GrapheMultiPays series={balSerie} height={160} type="line" fmt={(v: number | null) => fmtUSD(v)} />
              </GrapheCard>
            </div>
          );
        })()}

        {/* 2 & 3. Top débouchés / origines & Top ressources */}
        {tops && (tops.partenaires.length > 0 || tops.ressources.length > 0) && (() => {
          const expDir = vue === "exportateur";
          const dataPart = tops.partenaires.map(p => ({ label: p.nom, valeur: p.valeur }));
          const dataRes = tops.ressources.map(r => ({ label: r.ressource, valeur: r.valeur }));
          const periode = modeAnnees === "specifiques" && anneesSpec.length > 0
            ? `${anneesSpec[0]}–${anneesSpec[anneesSpec.length - 1]}` : `${anneeMin}–${anneeMax}`;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 20 }}>
              <GrapheCard titre={expDir ? "Répartition des exportations par pays de destination" : "Répartition des importations par pays d'origine"} grapheId={`stat_top_part_${vue}_${selId}`} hideLegend
                fullChildren={<GrapheBarresH data={dataPart} fmt={(v) => fmtUSD(v)} rowH={40} />}>
                <GrapheBarresH data={dataPart.slice(0, 5)} fmt={(v) => fmtUSD(v)} />
              </GrapheCard>
              <GrapheCard titre={expDir ? "Classement des ressources exportées" : "Classement des ressources importées"} grapheId={`stat_top_res_${vue}_${selId}`} hideLegend
                fullChildren={<GrapheBarresH data={dataRes} fmt={(v) => fmtUSD(v)} rowH={40} />}>
                <GrapheBarresH data={dataRes.slice(0, 5)} fmt={(v) => fmtUSD(v)} />
              </GrapheCard>
            </div>
          );
        })()}

        {/* 4 & 5. Poids des ressources & Concentration */}
        {(() => {
          const expDir = vue === "exportateur";
          const periode = modeAnnees === "specifiques" && anneesSpec.length > 0
            ? `${anneesSpec[0]}–${anneesSpec[anneesSpec.length - 1]}` : `${anneeMin}–${anneeMax}`;
          // Poids des ressources : top 8 + « Autres »
          let donutData: { label: string; valeur: number }[] = [];
          if (tops && tops.ressources.length) {
            const top8 = tops.ressources.slice(0, 8);
            donutData = top8.map(r => ({ label: r.ressource, valeur: r.valeur }));
            const autres = (tops.total || 0) - top8.reduce((s, r) => s + r.valeur, 0);
            if (autres > 0.0001 && tops.ressources.length > 8) donutData.push({ label: "Autres", valeur: autres });
          }
          const concPoints = conc?.points || [];
          if (!donutData.length && !concPoints.length) return null;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 20 }}>
              {donutData.length > 0 && (
                <GrapheCard titre={expDir ? "Poids des ressources exportées" : "Poids des ressources importées"} grapheId={`stat_poids_res_${vue}_${selId}`} hideLegend
                  fullChildren={<GrapheDonut data={donutData} fmt={(v) => fmtUSD(v)} />}>
                  <GrapheDonut data={donutData} fmt={(v) => fmtUSD(v)} />
                </GrapheCard>
              )}
              {concPoints.length > 0 && (
                <GrapheCard titre={expDir ? "Concentration des exportations" : "Concentration des importations"} sous_titre={`Part cumulée des ${expDir ? "débouchés" : "origines"} · ${periode}`} grapheId={`stat_conc_${vue}_${selId}`} hideLegend
                  fullChildren={<GrapheConcentration points={concPoints} height={340} />}>
                  <GrapheConcentration points={concPoints} height={200} />
                </GrapheCard>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Graphe D3 (repris de la page IDE) ─────────────────────────────────────────
function fmtValGen(v: number | null) {
  if (v === null || v === undefined) return "N/A";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)} Md`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)} M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)} k`;
  return `${v.toFixed(0)}`;
}
function showD3Tooltip(tooltip: any, e: MouseEvent, html?: string) {
  if (html !== undefined) tooltip.html(html);
  tooltip.style("opacity", 1);
  const node = tooltip.node() as HTMLElement | null;
  const tw = node?.offsetWidth || 120, th = node?.offsetHeight || 44;
  let x = e.clientX + 14, y = e.clientY - th - 14;
  if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 14;
  if (y < 8) y = e.clientY + 18;
  if (y + th > window.innerHeight - 8) y = window.innerHeight - th - 8;
  tooltip.style("left", x + "px").style("top", y + "px");
}
function hideD3Tooltip(tooltip: any) { tooltip.style("opacity", 0); }

function downloadPNG(svgEl: SVGSVGElement, filename: string, opts?: { titre?: string; annees?: string; legende?: { nom: string; couleur: string }[] }) {
  const SCALE = 3;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const W = svgEl.viewBox.baseVal.width || 800;
  const H = svgEl.viewBox.baseVal.height || 400;
  clone.removeAttribute("style");
  clone.setAttribute("width", String(W * SCALE));
  clone.setAttribute("height", String(H * SCALE));
  clone.setAttribute("font-family", "'Google Sans','Product Sans',Arial,sans-serif");
  const blob = new Blob([clone.outerHTML], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const PAD = 26;
    const FONT = "'Google Sans','Product Sans',Arial,sans-serif";
    const titre = opts?.titre || "";
    const annees = opts?.annees || "";
    const legende = opts?.legende || [];
    const mctx = document.createElement("canvas").getContext("2d")!;
    let headerH = 0;
    const legLines: { nom: string; couleur: string; w: number }[][] = [];
    if (titre || legende.length) {
      headerH = PAD + 26;
      if (legende.length) {
        mctx.font = `700 11px ${FONT}`;
        const maxW = W - PAD * 2;
        let line: { nom: string; couleur: string; w: number }[] = []; let x = 0;
        legende.forEach(l => {
          const w = Math.ceil(mctx.measureText(l.nom).width) + 22;
          if (x + w > maxW && line.length) { legLines.push(line); line = []; x = 0; }
          line.push({ ...l, w }); x += w + 8;
        });
        if (line.length) legLines.push(line);
        headerH += 6 + legLines.length * 26;
      }
      headerH += 10;
    }
    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE; canvas.height = (H + headerH) * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SCALE, SCALE);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H + headerH);
    if (headerH) {
      ctx.textBaseline = "middle";
      const ty = PAD + 12;
      ctx.font = `700 11px ${FONT}`;
      const badgeW = annees ? Math.ceil(ctx.measureText(annees).width) + 20 : 0;
      ctx.font = `700 16px ${FONT}`; ctx.fillStyle = "#1a1a2e";
      let t = titre;
      const maxTitre = W - PAD * 2 - (badgeW ? badgeW + 10 : 0);
      while (t && ctx.measureText(t).width > maxTitre) t = t.slice(0, -2);
      if (t !== titre) t += "…";
      ctx.fillText(t, PAD, ty);
      if (annees) {
        const bx = PAD + ctx.measureText(t).width + 10;
        ctx.fillStyle = "#ECEAE8";
        ctx.beginPath(); ctx.roundRect(bx, ty - 10, badgeW, 20, 999); ctx.fill();
        ctx.font = `700 11px ${FONT}`; ctx.fillStyle = "#4a5568";
        ctx.fillText(annees, bx + 10, ty + 0.5);
      }
      let ly = PAD + 26 + 6 + 13;
      ctx.font = `700 11px ${FONT}`;
      legLines.forEach(line => {
        let lx = PAD;
        line.forEach(l => {
          ctx.fillStyle = l.couleur + "1F";
          ctx.beginPath(); ctx.roundRect(lx, ly - 10, l.w, 20, 999); ctx.fill();
          ctx.fillStyle = l.couleur;
          ctx.fillText(l.nom, lx + 11, ly + 0.5);
          lx += l.w + 8;
        });
        ly += 26;
      });
    }
    ctx.drawImage(img, 0, headerH, W, H);
    const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = `${filename}.png`; a.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function GrapheMultiPays({ series, height = 280, type = "line", titre = "", fmt, showDots = true, lineWidth }: {
  series: { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] }[];
  height?: number; type?: "line" | "bar"; titre?: string; fmt?: (v: number | null) => string; showDots?: boolean; lineWidth?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fmtV = fmt || fmtValGen;
  const draw = useCallback(() => {
    if (!ref.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    if (!series.length) return;
    const W = el.parentElement?.clientWidth || el.clientWidth || 700;
    const H = height;
    const allData = series.flatMap(s => s.data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[]);
    if (!allData.length) return;
    const serieRanges = series.map(s => {
      const vals = s.data.filter(d => d.valeur !== null).map(d => d.valeur as number);
      const mn = d3.min(vals) ?? 0; const mx = d3.max(vals) ?? 1;
      return { mn, mx, span: mx - mn };
    });
    const spanRatio = Math.max(...serieRanges.map(r => r.span)) / Math.max(1, Math.min(...serieRanges.map(r => r.span)));
    const useDual = type === "line" && series.length >= 2 && spanRatio > 4;
    const M = { top: 12, right: useDual ? 58 : 20, bottom: 34, left: 64 };
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const allAnnees = [...new Set(allData.map(d => d.annee))].sort();
    const buildScale = (mn: number, mx: number, forBar: boolean) => {
      const pad = (mx - mn) * 0.08;
      const lo = forBar ? Math.min(0, mn) : mn - pad;
      return d3.scaleLinear().domain([lo, mx * 1.08]).nice().range([H - M.bottom, M.top]);
    };
    const yScales = useDual
      ? series.map((_, i) => buildScale(serieRanges[i].mn, serieRanges[i].mx, false))
      : (() => {
          const rawMin = d3.min(allData, d => d.valeur)!;
          const maxVal = d3.max(allData, d => d.valeur)!;
          const shared = buildScale(rawMin, maxVal, type === "bar");
          return series.map(() => shared);
        })();
    const y = yScales[0];
    const xBand = d3.scaleBand().domain(allAnnees.map(String)).range([M.left, W - M.right]).padding(0.18);
    const xLin = d3.scaleLinear().domain([allAnnees[0], allAnnees[allAnnees.length - 1]]).range([M.left, W - M.right]);
    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1", M.left).attr("x2", W - M.right).attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "#EBEBEB").attr("stroke-width", 1);
    if (y.domain()[0] < 0)
      svg.append("line").attr("x1", M.left).attr("x2", W - M.right).attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "#C5BFBB").attr("stroke-width", 1.2).attr("stroke-dasharray", "4,3");
    const tooltip = d3.select("#d3-tooltip") as any;
    const fmtAxis = (v: d3.NumberValue) => {
      const n = +v; const a = Math.abs(n);
      return a >= 1e9 ? `${(n / 1e9).toFixed(1)}Md` : a >= 1e6 ? `${(n / 1e6).toFixed(0)}M` : a >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : `${n.toFixed(0)}`;
    };
    if (type === "bar") {
      const nbSeries = series.length;
      const xGroup = nbSeries > 1
        ? d3.scaleBand().domain(series.map(s => s.nom)).range([0, xBand.bandwidth()]).padding(0.06)
        : null;
      series.forEach((s) => {
        const ys = yScales[0];
        const valid = s.data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[];
        if (!valid.length) return;
        const getX = (d: { annee: number }) => { const base = xBand(String(d.annee))!; return xGroup ? base + xGroup(s.nom)! : base; };
        const getW = () => xGroup ? xGroup.bandwidth() : xBand.bandwidth();
        svg.selectAll(`.b${s.nom.replace(/\W/g, "")}`)
          .data(valid).enter().append("rect")
          .attr("x", d => getX(d)).attr("width", getW())
          .attr("y", d => d.valeur >= 0 ? ys(d.valeur) : ys(0))
          .attr("height", d => Math.abs(ys(d.valeur) - ys(0)))
          .attr("fill", s.couleur).attr("rx", 3).style("cursor", "pointer")
          .on("mouseover", (e, d) => {
            d3.select(e.currentTarget as SVGRectElement).attr("opacity", 0.75);
            showD3Tooltip(tooltip, e, `<strong>${d.annee}${nbSeries > 1 ? " — " + s.nom : ""}</strong><br/>${fmtV(d.valeur)}`);
          })
          .on("mousemove", (e) => showD3Tooltip(tooltip, e))
          .on("mouseout", (e) => { d3.select(e.currentTarget as SVGRectElement).attr("opacity", 1); hideD3Tooltip(tooltip); });
      });
      const maxTicks = Math.floor((W - M.left - M.right) / 28);
      const step = Math.ceil(allAnnees.length / maxTicks);
      const tickVals = allAnnees.filter((_, i) => i % step === 0).map(String);
      svg.append("g").attr("transform", `translate(0,${H - M.bottom})`)
        .call(d3.axisBottom(xBand).tickValues(tickVals).tickSizeOuter(0))
        .call(g => g.select(".domain").attr("stroke", "#E8E5E3"))
        .call(g => g.selectAll("line").remove())
        .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));
    } else {
      series.forEach((s, si) => {
        const ys = yScales[si];
        const valid = s.data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[];
        if (!valid.length) return;
        const areaBase = ys(Math.max(ys.domain()[0], 0));
        const gid = `sg${s.nom.replace(/\W/g, "")}${si}`;
        const defs = svg.append("defs");
        const grad = defs.append("linearGradient").attr("id", gid).attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
        grad.append("stop").attr("offset", "0%").attr("stop-color", s.couleur).attr("stop-opacity", 0.1);
        grad.append("stop").attr("offset", "100%").attr("stop-color", s.couleur).attr("stop-opacity", 0);
        svg.append("path").datum(valid).attr("fill", `url(#${gid})`)
          .attr("d", d3.area<{ annee: number; valeur: number }>().x(d => xLin(d.annee)).y0(areaBase).y1(d => ys(d.valeur)).curve(d3.curveMonotoneX));
        svg.append("path").datum(valid).attr("fill", "none").attr("stroke", s.couleur).attr("stroke-width", lineWidth ?? 2.2)
          .attr("d", d3.line<{ annee: number; valeur: number }>().x(d => xLin(d.annee)).y(d => ys(d.valeur)).curve(d3.curveMonotoneX));
        const nb = valid.length;
        const rBase = nb > 25 ? 0 : nb > 18 ? 1.5 : nb > 10 ? 2 : 2.5;
        let dots: any = null;
        if (showDots && rBase > 0) {
          dots = svg.selectAll(`.p${s.nom.replace(/\W/g, "")}${si}`)
            .data(valid).enter().append("circle")
            .attr("cx", d => xLin(d.annee)).attr("cy", d => ys(d.valeur)).attr("r", rBase)
            .attr("fill", "#fff").attr("stroke", s.couleur).attr("stroke-width", 1.5)
            .style("pointer-events", "none");
        }
        svg.selectAll(`.ph${s.nom.replace(/\W/g, "")}${si}`)
          .data(valid).enter().append("circle")
          .attr("cx", d => xLin(d.annee)).attr("cy", d => ys(d.valeur)).attr("r", Math.max(10, rBase + 6))
          .attr("fill", "transparent").attr("stroke", "none").style("cursor", "pointer")
          .on("mouseover", (e, d) => {
            if (dots) dots.filter((p: any) => p === d).attr("r", rBase + 2);
            showD3Tooltip(tooltip, e, `<strong>${d.annee} — ${s.nom}</strong><br/>${fmtV(d.valeur)}`);
          })
          .on("mousemove", (e) => showD3Tooltip(tooltip, e))
          .on("mouseout", (e, d) => { if (dots) dots.filter((p: any) => p === d).attr("r", rBase); hideD3Tooltip(tooltip); });
      });
      const maxTicksLine = Math.max(2, Math.min(7, Math.floor((W - M.left - M.right) / 42)));
      let tickAnnees = allAnnees;
      if (allAnnees.length > maxTicksLine) {
        const stepA = Math.ceil((allAnnees.length - 1) / (maxTicksLine - 1));
        tickAnnees = allAnnees.filter((_, i) => i % stepA === 0);
        const last = allAnnees[allAnnees.length - 1];
        if (tickAnnees[tickAnnees.length - 1] !== last) tickAnnees.push(last);
      }
      svg.append("g").attr("transform", `translate(0,${H - M.bottom})`)
        .call(d3.axisBottom(xLin).tickValues(tickAnnees).tickFormat(d3.format("d")).tickSizeOuter(0))
        .call(g => g.select(".domain").attr("stroke", "#E8E5E3"))
        .call(g => g.selectAll("line").remove())
        .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));
    }
    svg.append("g").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(fmtAxis))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", useDual ? series[0].couleur : "#9aa5b4").style("font-size", "10px").style("font-weight", useDual ? "600" : "400"));
    if (useDual) {
      svg.append("g").attr("transform", `translate(${W - M.right},0)`)
        .call(d3.axisRight(yScales[1]).ticks(4).tickFormat(fmtAxis))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").remove())
        .call(g => g.selectAll("text").style("fill", series[1].couleur).style("font-size", "10px").style("font-weight", "600"));
    }
  }, [series, type, height, fmtV]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);
  useEffect(() => { draw(); }, [draw]);
  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <svg ref={ref} style={{ width: "100%", height, display: "block" }} />
    </div>
  );
}

// ── Barres horizontales (top N) ───────────────────────────────────────────────
function GrapheBarresH({ data, fmt, couleur = "#004f91", rowH = 34, exposant = 0.5 }: {
  data: { label: string; valeur: number }[]; fmt?: (v: number | null) => string; couleur?: string; rowH?: number; exposant?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fmtV = fmt || fmtValGen;
  const draw = useCallback(() => {
    if (!ref.current || !wrapRef.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    if (!data.length) return;
    const W = wrapRef.current.clientWidth || el.parentElement?.clientWidth || 600;
    const longest = Math.max(...data.map(d => d.label.length));
    const M = { top: 6, right: 78, bottom: 6, left: Math.min(230, Math.max(90, Math.round(longest * 6.2) + 14)) };
    const H = data.length * rowH + M.top + M.bottom;
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const maxVal = d3.max(data, d => d.valeur) || 1;
    // Échelle en puissance (racine carrée par défaut) : rééquilibre les barres
    // quand les valeurs sont très dispersées, sans changer les valeurs affichées.
    const x = d3.scalePow().exponent(exposant).domain([0, maxVal]).range([M.left, W - M.right]);
    const y = d3.scaleBand().domain(data.map(d => d.label)).range([M.top, H - M.bottom]).padding(0.28);
    const tooltip = d3.select("#d3-tooltip") as any;

    svg.selectAll("rect.bar").data(data).enter().append("rect")
      .attr("x", M.left).attr("y", d => y(d.label)!).attr("height", y.bandwidth())
      .attr("width", d => Math.max(2, x(d.valeur) - M.left)).attr("fill", couleur)
      .style("cursor", "pointer")
      .on("mouseover", (e, d) => { d3.select(e.currentTarget as any).attr("opacity", 0.8); showD3Tooltip(tooltip, e, `<strong>${d.label}</strong><br/>${fmtV(d.valeur)}`); })
      .on("mousemove", (e) => showD3Tooltip(tooltip, e))
      .on("mouseout", (e) => { d3.select(e.currentTarget as any).attr("opacity", 1); hideD3Tooltip(tooltip); });

    svg.selectAll("text.lbl").data(data).enter().append("text")
      .attr("x", M.left - 8).attr("y", d => y(d.label)! + y.bandwidth() / 2).attr("dy", "0.35em")
      .attr("text-anchor", "end").style("font-size", "11px").style("fill", "#4a5568").text(d => d.label);

    svg.selectAll("text.val").data(data).enter().append("text")
      .attr("x", d => x(d.valeur) + 6).attr("y", d => y(d.label)! + y.bandwidth() / 2).attr("dy", "0.35em")
      .style("font-size", "10.5px").style("fill", "#9aa5b4").style("font-weight", "700").text(d => fmtV(d.valeur));
  }, [data, fmtV, couleur, rowH]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);
  useEffect(() => { draw(); }, [draw]);
  return <div ref={wrapRef} style={{ position: "relative" }}><svg ref={ref} style={{ width: "100%", display: "block" }} /></div>;
}


// ── Anneau de composition (style tableau de bord, légende latérale) ────────────
// Rampe bleue #003468 (part la plus élevée) → #EDF4FB (la plus faible).
function GrapheDonut({ data, fmt }: { data: { label: string; valeur: number }[]; fmt?: (v: number | null) => string }) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fmtV = fmt || fmtValGen;
  const draw = useCallback(() => {
    if (!ref.current || !wrapRef.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    const positifs = data.filter(d => d.valeur > 0);
    const total = d3.sum(positifs, d => d.valeur);
    // On masque les parts qui arrondissent à 0,0 % (invisibles sur l'anneau).
    const items = total > 0 ? positifs.filter(d => d.valeur / total * 100 >= 0.05) : [];
    if (!items.length) return;
    const n = items.length;
    const couleur = (i: number) => d3.interpolateRgb("#003468", "#EDF4FB")(n > 1 ? i / (n - 1) : 0) as string;

    const W = wrapRef.current.clientWidth || el.parentElement?.clientWidth || 600;
    const H = Math.max(230, n * 22 + 44);
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const R = Math.min(H - 20, W * 0.42) / 2;
    const cx = R + 12, cy = H / 2;
    // Angles pondérés en racine carrée pour rendre visibles les petites parts ;
    // le total au centre et les % de la légende restent les vraies proportions.
    const pie = d3.pie<any>().value(d => Math.sqrt(d.valeur)).sort(null);
    const arc = d3.arc<any>().innerRadius(R * 0.58).outerRadius(R);
    const arcH = d3.arc<any>().innerRadius(R * 0.58).outerRadius(R + 5);
    const tooltip = d3.select("#d3-tooltip") as any;
    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    g.selectAll("path").data(pie(items)).enter().append("path")
      .attr("d", arc as any).attr("fill", (_d, i) => couleur(i)).attr("opacity", 0.9)
      .style("cursor", "pointer")
      .on("mouseover", function (e, d: any) { d3.select(this).attr("d", arcH(d) as string).attr("opacity", 1); showD3Tooltip(tooltip, e, `<strong>${d.data.label}</strong><br/>${fmtV(d.data.valeur)} · ${(d.data.valeur / total * 100).toFixed(1)}%`); })
      .on("mousemove", (e) => showD3Tooltip(tooltip, e))
      .on("mouseout", function (_e, d: any) { d3.select(this).attr("d", arc(d) as string).attr("opacity", 0.9); hideD3Tooltip(tooltip); });

    // Total au centre
    g.append("text").attr("text-anchor", "middle").attr("dy", "-.05em").style("font-size", "15px").style("font-weight", "800").style("fill", "#1a1a2e").text(fmtV(total));
    g.append("text").attr("text-anchor", "middle").attr("dy", "1.5em").style("font-size", "9.5px").style("fill", "#9aa5b4").text("total");

    // Légende (part la plus forte en haut, couleur assortie)
    const lx = cx + R + 20;
    let ly = cy - (n * 20) / 2 + 10;
    const legend = svg.append("g");
    const maxc = Math.max(8, Math.floor((W - lx - 66) / 6.3));
    items.forEach((d, i) => {
      const pct = (d.valeur / total * 100).toFixed(1);
      let lbl = d.label; if (lbl.length > maxc) lbl = lbl.slice(0, maxc - 1) + "…";
      const row = legend.append("g").attr("transform", `translate(${lx},${ly})`);
      row.append("rect").attr("x", 0).attr("y", -8).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", couleur(i)).attr("stroke", "#E8E5E3").attr("stroke-width", 0.5);
      row.append("text").attr("x", 16).attr("y", 0).attr("dy", "0.02em").style("font-size", "11px").style("fill", "#4a5568").text(lbl);
      row.append("text").attr("x", W - lx - 4).attr("y", 0).attr("text-anchor", "end").style("font-size", "11px").style("font-weight", "700").style("fill", "#1a1a2e").text(`${pct}%`);
      ly += 20;
    });
  }, [data, fmtV]);
  useEffect(() => { if (!wrapRef.current) return; const ro = new ResizeObserver(() => draw()); ro.observe(wrapRef.current); return () => ro.disconnect(); }, [draw]);
  useEffect(() => { draw(); }, [draw]);
  return <div ref={wrapRef} style={{ position: "relative" }}><svg ref={ref} style={{ width: "100%", display: "block" }} /></div>;
}

// ── Courbe de concentration (Pareto) ──────────────────────────────────────────
function GrapheConcentration({ points, height = 200 }: { points: { rang: number; nom: string; part_cumulee: number }[]; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const draw = useCallback(() => {
    if (!ref.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    if (!points.length) return;
    const W = el.parentElement?.clientWidth || 600;
    const H = height;
    const M = { top: 12, right: 18, bottom: 28, left: 44 };
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const pts = [{ rang: 0, nom: "", part_cumulee: 0 }, ...points];
    const maxRang = points[points.length - 1].rang;
    const x = d3.scaleLinear().domain([0, maxRang]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain([0, 100]).range([H - M.bottom, M.top]);
    const tooltip = d3.select("#d3-tooltip") as any;
    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1", M.left).attr("x2", W - M.right).attr("y1", d => y(d)).attr("y2", d => y(d)).attr("stroke", "#EBEBEB").attr("stroke-width", 1);
    const gid = "concGrad";
    const grad = svg.append("defs").append("linearGradient").attr("id", gid).attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#004f91").attr("stop-opacity", 0.12);
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#004f91").attr("stop-opacity", 0);
    svg.append("path").datum(pts).attr("fill", `url(#${gid})`)
      .attr("d", d3.area<any>().x(d => x(d.rang)).y0(y(0)).y1(d => y(d.part_cumulee)).curve(d3.curveMonotoneX));
    svg.append("path").datum(pts).attr("fill", "none").attr("stroke", "#004f91").attr("stroke-width", 2.2)
      .attr("d", d3.line<any>().x(d => x(d.rang)).y(d => y(d.part_cumulee)).curve(d3.curveMonotoneX));
    svg.selectAll("circle.pt").data(points).enter().append("circle")
      .attr("cx", d => x(d.rang)).attr("cy", d => y(d.part_cumulee)).attr("r", points.length > 20 ? 0 : 2.5)
      .attr("fill", "#fff").attr("stroke", "#004f91").attr("stroke-width", 1.5).style("pointer-events", "none");
    svg.selectAll("circle.hit").data(points).enter().append("circle")
      .attr("cx", d => x(d.rang)).attr("cy", d => y(d.part_cumulee)).attr("r", 9).attr("fill", "transparent").style("cursor", "pointer")
      .on("mouseover", (e, d) => showD3Tooltip(tooltip, e, `<strong>Top ${d.rang} — ${d.nom}</strong><br/>${d.part_cumulee.toFixed(1)}% du total cumulé`))
      .on("mousemove", (e) => showD3Tooltip(tooltip, e))
      .on("mouseout", () => hideD3Tooltip(tooltip));
    svg.append("g").attr("transform", `translate(${M.left},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(d => `${d}%`))
      .call(g => g.select(".domain").remove()).call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));
    const xticks = x.ticks(Math.min(maxRang, 6)).filter(t => Number.isInteger(t) && t >= 1);
    svg.append("g").attr("transform", `translate(0,${H - M.bottom})`).call(d3.axisBottom(x).tickValues(xticks).tickFormat(d3.format("d")).tickSizeOuter(0))
      .call(g => g.select(".domain").attr("stroke", "#E8E5E3")).call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));
  }, [points, height]);
  useEffect(() => { if (!wrapRef.current) return; const ro = new ResizeObserver(() => draw()); ro.observe(wrapRef.current); return () => ro.disconnect(); }, [draw]);
  useEffect(() => { draw(); }, [draw]);
  return <div ref={wrapRef} style={{ position: "relative" }}><svg ref={ref} style={{ width: "100%", height, display: "block" }} /></div>;
}

function GrapheModal({ open, onClose, titre, sous_titre, children, series, grapheId }: any) {
  const modalRef = useRef<HTMLDivElement>(null);
  const getSvg = () => modalRef.current?.querySelector("svg") as SVGSVGElement | null;
  const anneesRange = (() => {
    const as: number[] = (series || []).flatMap((s: any) => s.data.filter((d: any) => d.valeur !== null).map((d: any) => d.annee));
    if (!as.length) return "";
    const mn = Math.min(...as), mx = Math.max(...as);
    return mn === mx ? String(mn) : `${mn} – ${mx}`;
  })();
  const legendeExport = (series || [])
    .filter((s: any) => s.data.some((d: any) => d.valeur !== null))
    .map((s: any) => ({ nom: s.nom, couleur: s.couleur }));
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 1100, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "#004f91", flexShrink: 0 }} />
        <div style={{ padding: "18px 28px 16px", borderBottom: "1px solid #F2F0EF", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a2e", margin: 0, lineHeight: 1.35, minWidth: 0 }}>{titre}</h2>
                {anneesRange && (
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#4a5568", background: "#ECEAE8", padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{anneesRange}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {series?.length > 0 && series.filter((s: any) => s.data.some((d: any) => d.valeur !== null)).map((s: any) => (
                  <span key={s.nom} style={{ display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: s.couleur, background: `${s.couleur}12`, border: `1px solid ${s.couleur}30` }}>{s.nom}</span>
                ))}
                {sous_titre && <span style={{ fontSize: 11.5, color: "#9aa5b4", fontWeight: 500 }}>{sous_titre}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8"; }} onMouseLeave={e => { e.currentTarget.style.background = "#F5F4F3"; }}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>
        <div style={{ padding: "22px 28px", overflowY: "auto", flex: 1 }}>
          <div ref={modalRef}>{children}</div>
        </div>
        <div style={{ padding: "14px 28px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #E4E1DE", background: "#fff", color: "#4a5568", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Fermer</button>
          <button onClick={() => { const svg = getSvg(); if (svg) downloadPNG(svg, grapheId || titre || "graphe", { titre, annees: anneesRange, legende: legendeExport }); }}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 3px 12px rgba(0,79,145,0.25)", fontFamily: "var(--font-google-sans)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Télécharger
          </button>
        </div>
      </div>
    </div>
  );
}

function GrapheCard({ titre, sous_titre, children, fullChildren, series, grapheId, hideLegend, hideSousTitre }: any) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div onClick={() => setOpen(true)}
        style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "16px 18px", cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", minWidth: 0 }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,30,60,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(0,79,145,0.25)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "#ECEAE7"; }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <h3 style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", margin: 0, display: "inline-block" }}>{titre}</h3>
            </div>
            {!hideLegend && series?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                {series.filter((s: any) => s.data.some((d: any) => d.valeur !== null)).map((s: any) => (
                  <span key={s.nom} style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: s.couleur, background: `${s.couleur}12` }}>{s.nom}</span>
                ))}
              </div>
            )}
            {!hideSousTitre && sous_titre && <p style={{ fontSize: 10.5, color: "#9aa5b4", marginTop: 4 }}>{sous_titre}</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: "#F5F4F3", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Maximize2 size={11} style={{ color: "#9aa5b4" }} />
            </span>
          </div>
        </div>
        <div style={{ pointerEvents: "none" }}>{children}</div>
      </div>
      <GrapheModal open={open} onClose={() => setOpen(false)} titre={titre} sous_titre={sous_titre} series={series} grapheId={grapheId}>
        {fullChildren || children}
      </GrapheModal>
    </>
  );
}

// ── Définitions & interprétations des indicateurs ─────────────────────────────
const DEF_INDICATEUR: Record<string, string> = {
  population: "Nombre total d'habitants du pays au 1er juillet de l'année considérée.",
  superficie: "Superficie terrestre totale du pays, exprimée en kilomètres carrés.",
  densite: "Nombre moyen d'habitants par kilomètre carré (population ÷ superficie).",
  pib: "Produit intérieur brut : valeur totale des biens et services produits sur une année, en dollars courants.",
  pib_hab: "PIB rapporté au nombre d'habitants (PIB ÷ population), en dollars courants.",
  croissance_pib: "Taux de croissance annuel du PIB réel, en pourcentage.",
  importations_marchandises: "Valeur totale des marchandises importées sur l'année, en dollars.",
  exportations_marchandises: "Valeur totale des marchandises exportées sur l'année, en dollars.",
  importations_services: "Valeur totale des services importés sur l'année, en dollars.",
  exportations_services: "Valeur totale des services exportés sur l'année, en dollars.",
  balance_marchandises: "Solde du commerce de marchandises (exportations − importations).",
  balance_services: "Solde du commerce de services (exportations − importations).",
};

function MiniModalKpi({ kpi, pays, couleur, onClose }: { kpi: { ind: Indicateur; valeur: number | null; annee: number; precedent: number | null } | null; pays: string; couleur: string; onClose: () => void }) {
  if (!kpi) return null;
  const { ind, valeur, annee, precedent } = kpi;
  const def = DEF_INDICATEUR[ind.code] || `${ind.libelle} — ${ind.unite}.`;
  let variation: number | null = null;
  if (valeur !== null && precedent !== null && precedent !== 0) variation = ((valeur - precedent) / Math.abs(precedent)) * 100;
  const isPos = variation !== null && variation > 0.05;
  const isNeg = variation !== null && variation < -0.05;
  const signalColor = couleur;
  const interpret = (() => {
    if (valeur === null) return "Donnée non disponible pour cet indicateur sur la période sélectionnée.";
    const val = fmt(valeur, ind.unite);
    if (variation === null) return `En ${annee}, ${pays} affiche ${val} pour l'indicateur « ${ind.libelle} ».`;
    const sens = isPos ? "en hausse" : isNeg ? "en baisse" : "stable";
    const pct = `${variation > 0 ? "+" : ""}${variation.toFixed(1)} %`;
    return `En ${annee}, ${pays} affiche ${val} (${sens} de ${pct} par rapport à l'année précédente) pour l'indicateur « ${ind.libelle} ».`;
  })();
  const trendColor = isPos ? "#188038" : isNeg ? "#dc2626" : "#9aa5b4";
  const trendBg = isPos ? "rgba(24,128,56,0.06)" : isNeg ? "rgba(220,38,38,0.05)" : "#FAFAF9";
  const trendBorder = isPos ? "rgba(24,128,56,0.18)" : isNeg ? "rgba(220,38,38,0.18)" : "#F0EEEC";
  const SecTitle = ({ children }: { children: any }) => (
    <p style={{ fontSize: 10.5, fontWeight: 700, color: "#004f91", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{children}</p>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "#004f91", flexShrink: 0 }} />
        <div style={{ padding: "18px 28px 16px", borderBottom: "1px solid #F2F0EF", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a2e", margin: 0, lineHeight: 1.35 }}>{ind.libelle}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: couleur, background: `${couleur}12`, border: `1px solid ${couleur}30` }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: couleur, display: "inline-block" }} />{pays}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "#4a5568", background: "#F5F4F3" }}>{ind.unite}</span>
                {variation !== null && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: trendColor, background: trendBg, border: `1px solid ${trendBorder}` }}>{isPos ? "Positif" : isNeg ? "Négatif" : "Stable"}</span>
                )}
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "#4a5568", background: "#F5F4F3" }}>{annee}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8"; }} onMouseLeave={e => { e.currentTarget.style.background = "#F5F4F3"; }}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>
        <div style={{ padding: "22px 28px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <SecTitle>Valeur</SecTitle>
            <div style={{ background: trendBg, border: `1px solid ${trendBorder}`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: "2.2rem", fontWeight: 800, color: signalColor, lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(valeur, ind.unite)}</span>
              <span style={{ fontSize: 13, color: "#9aa5b4", fontWeight: 500 }}>en {annee}</span>
            </div>
          </div>
          <div>
            <SecTitle>Interprétation</SecTitle>
            <div style={{ background: "#FAFAF9", border: "1px solid #F0EEEC", borderRadius: 12, padding: "14px 18px" }}>
              <p style={{ fontSize: 13, color: "#1a1a2e", lineHeight: 1.75 }}>{interpret}</p>
            </div>
          </div>
          <div>
            <SecTitle>Définition</SecTitle>
            <p style={{ fontSize: 12, color: "#9aa5b4", lineHeight: 1.65 }}>{def}</p>
          </div>
        </div>
        <div style={{ padding: "14px 28px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #E4E1DE", background: "#fff", color: "#4a5568", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ── Export Excel du tableau de données ────────────────────────────────────────
function exportXLSXStat(donnees: Donnee[], indicateurs: Indicateur[], paysSelectionnes: { id: number; nom: string }[], annees: number[], periode: string) {
  const wb = XLSX.utils.book_new();
  const val = (pid: number, code: string, a: number) =>
    donnees.find(d => d.pays_id === pid && d.indicateur === code && d.annee === a)?.valeur ?? null;
  paysSelectionnes.forEach(p => {
    const header = ["Indicateur", "Unité", ...annees.map(String)];
    const rows: (string | number | null)[][] = [header];
    indicateurs.forEach(ind => {
      const row: (string | number | null)[] = [ind.libelle, ind.unite];
      annees.forEach(a => { const v = val(p.id, ind.code, a); row.push(v !== null && v !== undefined ? Number(v) : null); });
      rows.push(row);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = rows[0].map((_, ci) => { const maxLen = Math.max(...rows.map(r => String(r[ci] ?? "").length)); return { wch: Math.min(Math.max(maxLen + 2, 12), 50) }; });
    XLSX.utils.book_append_sheet(wb, ws, p.nom.slice(0, 31));
  });
  XLSX.writeFile(wb, `Statistiques_${paysSelectionnes.map(p => p.nom.replace(/\s/g, "_")).join("_")}_${periode}.xlsx`);
}

// ── Modal « Tableau de données » ──────────────────────────────────────────────
function ModalDonnees({ open, onClose, donnees, indicateurs, paysSelectionnes, annees }: {
  open: boolean; onClose: () => void; donnees: Donnee[]; indicateurs: Indicateur[];
  paysSelectionnes: { id: number; nom: string; couleur: string }[]; annees: number[];
}) {
  if (!open) return null;
  const periode = annees.length ? `${annees[0]}_${annees[annees.length - 1]}` : "all";
  const val = (pid: number, code: string, a: number) =>
    donnees.find(d => d.pays_id === pid && d.indicateur === code && d.annee === a)?.valeur ?? null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 1200, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "#004f91", flexShrink: 0 }} />
        <div style={{ padding: "18px 28px 16px", borderBottom: "1px solid #F2F0EF", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a2e", margin: 0, lineHeight: 1.35, flexShrink: 0 }}>Tableau de données</h2>
                {annees.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, background: "#ECEAE8", border: "1px solid #DFDBD7", fontSize: 10.5, fontWeight: 700, color: "#3a4452", letterSpacing: "0.02em", flexShrink: 0 }}>{annees[0]} — {annees[annees.length - 1]}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap", minWidth: 0 }}>
                {paysSelectionnes.map(p => (
                  <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: `${p.couleur}0D`, border: `1px solid ${p.couleur}2E`, fontSize: 10.5, fontWeight: 700, color: p.couleur }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.couleur, display: "inline-block", flexShrink: 0 }} />{p.nom}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8"; }} onMouseLeave={e => { e.currentTarget.style.background = "#F5F4F3"; }}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ background: "#FAFAF9" }}>
                <th style={{ padding: "11px 28px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#4a5568", letterSpacing: "0.1em", textTransform: "uppercase", position: "sticky", left: 0, background: "#FAFAF9", borderRight: "1px solid #F0EEEC", borderBottom: "1px solid #F0EEEC", whiteSpace: "nowrap", minWidth: 200 }}>Indicateur</th>
                {annees.map(a => <th key={a} style={{ padding: "11px 12px", fontSize: 10, fontWeight: 800, color: "#4a5568", letterSpacing: "0.06em", textAlign: "right", minWidth: 90, borderBottom: "1px solid #F0EEEC" }}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {paysSelectionnes.map(pays => (
                <Fragment key={pays.id}>
                  <tr>
                    <td colSpan={annees.length + 1} style={{ padding: "12px 28px 6px", background: "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: pays.couleur, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: pays.couleur }}>{pays.nom}</span>
                      </div>
                    </td>
                  </tr>
                  {indicateurs.map((ind, si) => (
                    <tr key={`${pays.id}-${ind.code}`}
                      style={{ borderBottom: si === indicateurs.length - 1 ? "1px solid #ECEAE7" : "1px solid #F6F4F3", background: "#fff", transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#FAFAF9"}
                      onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                      <td style={{ padding: "9px 28px 9px 44px", position: "sticky", left: 0, background: "inherit", borderRight: "1px solid #F0EEEC", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 500 }}>{ind.libelle} <span style={{ color: "#9aa5b4", fontSize: 11 }}>· {ind.unite}</span></span>
                      </td>
                      {annees.map(a => {
                        const v = val(pays.id, ind.code, a);
                        const display = v !== null && v !== undefined ? fmt(v, ind.unite) : "—";
                        const color = v === null || v === undefined ? "#C5BFBB" : (ind.unite === "%" && v < 0) ? "#dc2626" : "#4a5568";
                        return (
                          <td key={a} style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, color, fontWeight: v !== null && v !== undefined ? 600 : 400, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{display}</td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "14px 28px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 10 }}>
          <span style={{ fontSize: 11, color: "#9aa5b4" }}>{paysSelectionnes.length} pays · {indicateurs.length} indicateurs · {annees.length} années</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #E4E1DE", background: "#fff", color: "#4a5568", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Fermer</button>
            <button onClick={() => exportXLSXStat(donnees, indicateurs, paysSelectionnes, annees, periode)}
              style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 3px 12px rgba(0,79,145,0.25)", fontFamily: "var(--font-google-sans)" }}>
              <FileSpreadsheet size={13} /> Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StatistiquesPage() {
  const [mode, setMode] = useState<"indicateurs" | "commerce">("indicateurs");
  const [vue, setVue] = useState<"pays" | "comparative" | "fiche">("pays");
  const [pays, setPays] = useState<Pays[]>([]);
  const [indicateurs, setIndicateurs] = useState<Indicateur[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [donnees, setDonnees] = useState<Donnee[]>([]);
  const [loading, setLoading] = useState(true);
  const [ficheOuverte, setFicheOuverte] = useState(false);
  const [kpiActif, setKpiActif] = useState<{ ind: Indicateur; valeur: number | null; annee: number; precedent: number | null } | null>(null);
  const [showTable, setShowTable] = useState(false);
  // Barre latérale
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [searchPays, setSearchPays] = useState("");
  const [openConts, setOpenConts] = useState<Set<string>>(new Set());
  // Période
  const [modeAnnees, setModeAnnees] = useState<"plage" | "specifiques">("plage");
  const [bornes, setBornes] = useState<[number, number]>([2019, 2023]);
  const [anneeMin, setAnneeMin] = useState(2019);
  const [anneeMax, setAnneeMax] = useState(2023);
  const [anneesSpec, setAnneesSpec] = useState<number[]>([]);
  const [periodeTouchee, setPeriodeTouchee] = useState(false);
  // KPI (indicateurs épinglés)
  const [kpisEpingles, setKpisEpingles] = useState<string[]>([]);

  const MAX_SEL = 4; // 4 pays au plus en comparaison (comme la page IDE)
  const multi = vue !== "pays";
  const senId = useMemo(() => pays.find(p => p.code_iso3 === "SEN")?.id ?? null, [pays]);

  const isResizing = useRef(false);
  const startResize = (e: any) => {
    isResizing.current = true;
    const startX = e.clientX, startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => { if (!isResizing.current) return; setSidebarWidth(Math.max(220, Math.min(520, startW + ev.clientX - startX))); };
    const onUp = () => { isResizing.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/statistiques/pays`).then(r => r.json()),
      fetch(`${API}/statistiques/indicateurs`).then(r => r.json()),
    ]).then(([p, i]) => {
      setPays(p || []); setIndicateurs(i || []);
      const sen = (p || []).find((x: Pays) => x.code_iso3 === "SEN");
      if (sen) setSelection([sen.id]);
    }).finally(() => setLoading(false));
  }, []);

  // Par défaut : Population, Superficie, Densité, PIB, PIB/hab (dans la limite de 5)
  useEffect(() => {
    if (!indicateurs.length) return;
    const codes = indicateurs.map(i => i.code);
    const def = KPI_DEFAUT.filter(c => codes.includes(c)).slice(0, MAX_KPI);
    setKpisEpingles(def.length ? def : codes.slice(0, MAX_KPI));
  }, [indicateurs]);

  useEffect(() => {
    if (!selection.length) { setDonnees([]); return; }
    fetch(`${API}/statistiques/donnees?pays=${selection.join(",")}`).then(r => r.json()).then(setDonnees).catch(() => {});
  }, [selection]);

  // Bornes d'années d'après les données réellement disponibles
  const anneesDispo = useMemo(() => [...new Set(donnees.map(d => d.annee))].filter(a => a > 0).sort((a, b) => a - b), [donnees]);
  useEffect(() => {
    if (!anneesDispo.length) return;
    const mn = anneesDispo[0], mx = anneesDispo[anneesDispo.length - 1];
    setBornes([mn, mx]);
    if (!periodeTouchee) { setAnneeMin(mn); setAnneeMax(mx); }
  }, [anneesDispo, periodeTouchee]);

  // en passant de comparative→pays, ne garder qu'un pays (Sénégal en priorité)
  useEffect(() => {
    if (!multi && selection.length > 1) setSelection([selection.includes(senId as number) ? (senId as number) : selection[0]]);
  }, [multi]);

  const toggleCont = (c: string) => setOpenConts(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const toggleEpingle = (code: string) => setKpisEpingles(prev => prev.includes(code) ? prev.filter(c => c !== code) : (prev.length >= MAX_KPI ? prev : [...prev, code]));

  const clickPays = (id: number) => {
    if (!multi) { setSelection([id]); return; }
    setSelection(prev => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter(x => x !== id) : prev;
      if (prev.length >= MAX_SEL) return prev;
      return [...prev, id];
    });
  };

  const groupedPays = useMemo(() => {
    const g: Record<string, Record<string, Pays[]>> = {};
    pays.filter(p => !searchPays || p.nom.toLowerCase().includes(searchPays.toLowerCase()))
      .forEach(p => {
        const c = p.continent || "Autre";
        const z = p.region_geo || "Autre";
        ((g[c] ||= {})[z] ||= []).push(p);
      });
    for (const c of Object.keys(g))
      for (const z of Object.keys(g[c]))
        g[c][z].sort((a, b) => { if (a.nom === "Sénégal") return -1; if (b.nom === "Sénégal") return 1; return a.nom.localeCompare(b.nom, "fr"); });
    return g;
  }, [pays, searchPays]);
  useEffect(() => { if (searchPays) setOpenConts(new Set(Object.keys(groupedPays))); }, [searchPays, groupedPays]);

  const paysNom = (id: number) => pays.find(p => p.id === id)?.nom || "";
  const couleurPays = (id: number) => PALETTE[selection.indexOf(id) % PALETTE.length];
  const span = Math.max(1, bornes[1] - bornes[0]);
  const anneesActives = useMemo(() => (
    modeAnnees === "specifiques"
      ? anneesDispo.filter(a => anneesSpec.includes(a))
      : anneesDispo.filter(a => a >= anneeMin && a <= anneeMax)
  ), [anneesDispo, modeAnnees, anneesSpec, anneeMin, anneeMax]);
  const refAnnee = anneesActives[anneesActives.length - 1] ?? anneeMax;
  const indicateursAffiches = indicateurs.filter(i => kpisEpingles.includes(i.code));

  const valeur = (paysId: number, code: string, annee: number) =>
    donnees.find(d => d.pays_id === paysId && d.indicateur === code && d.annee === annee)?.valeur ?? null;

  // État des filtres (pour badge + réinitialisation)
  const paysChange = multi ? (selection.length > 1 || selection[0] !== senId) : selection[0] !== senId;
  const periodeChange = modeAnnees === "specifiques" ? anneesSpec.length > 0 : (anneeMin !== bornes[0] || anneeMax !== bornes[1]);
  const kpiDefautSet = KPI_DEFAUT.filter(c => indicateurs.some(i => i.code === c)).slice(0, MAX_KPI);
  const kpiChange = kpisEpingles.length !== kpiDefautSet.length || kpisEpingles.some(c => !kpiDefautSet.includes(c));
  const nbFiltres = (paysChange ? 1 : 0) + (periodeChange ? 1 : 0) + (kpiChange ? 1 : 0);
  const hasFilter = nbFiltres > 0;
  const reinit = () => {
    setSelection(senId ? [senId] : []); setModeAnnees("plage");
    setAnneeMin(bornes[0]); setAnneeMax(bornes[1]); setAnneesSpec([]);
    setPeriodeTouchee(false); setKpisEpingles(kpiDefautSet.length ? kpiDefautSet : indicateurs.map(i => i.code).slice(0, MAX_KPI));
  };

  const LBL: any = { fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em" };

  return (
    <main style={{ minHeight: "100vh", background: "#F6F5F3", fontFamily: "var(--font-google-sans)" }}>
      <div id="d3-tooltip" style={{ position: "fixed", pointerEvents: "none", background: "rgba(26,26,46,0.92)", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, lineHeight: 1.5, opacity: 0, zIndex: 9999, backdropFilter: "blur(4px)" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.drs-thumb{-webkit-appearance:none;appearance:none;background:transparent;height:24px;margin:0;padding:0;position:absolute;top:0;left:0;width:100%;pointer-events:none}
.drs-thumb::-webkit-slider-runnable-track{background:transparent;height:4px}
.drs-thumb::-moz-range-track{background:transparent;height:4px}
.drs-thumb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all;margin-top:-6px}
.drs-thumb::-moz-range-thumb{background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all}`}</style>
      <Navbar />
      <BarreTitre titre="Statistiques"
        droite={mode === "indicateurs" && (vue === "pays" || vue === "comparative")
          ? <BarreTitreBadge label="Tableau de données" icon={<Table size={13} style={{ color: "#fff" }} />} onClick={() => setShowTable(true)} />
          : null}>
        <BarreTitreSegment options={[
          { v: "indicateurs", l: "Indicateurs économiques" },
          { v: "commerce", l: "Flux bilatéraux" },
        ]} value={mode} onChange={setMode} />
      </BarreTitre>

      {mode === "commerce" ? (
        <CommercePanel />
      ) : (
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {/* ── Barre de filtre ── */}
        <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s", background: "#fff", borderRight: "1px solid #E8E5E3", height: "calc(100vh - 64px)", overflowY: "auto", position: "sticky", top: 64, display: "flex", flexDirection: "column" }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
          {sidebarOpen && <div onMouseDown={startResize} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.5)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
          <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
            {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" }}>Filtres</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
                <SlidersHorizontal size={14} style={{ color: "#004f91" }} />
                {sidebarOpen && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
              </button>
              {sidebarOpen && hasFilter && <button onClick={reinit} title="Tout réinitialiser" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.20)", cursor: "pointer", borderRadius: 999, padding: "5px", display: "flex", alignItems: "center" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; }}>
                <X size={13} style={{ color: "#dc2626" }} />
              </button>}
            </div>
          </div>
          {sidebarOpen && <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
            {/* Vue */}
            <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #F2F0EF" }}>
              <p style={{ ...LBL, marginBottom: 8 }}>Vue</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {VUES.map(o => (
                  <button key={o.v} onClick={() => setVue(o.v)}
                    style={{ textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: vue === o.v ? 700 : 500, background: vue === o.v ? "rgba(0,79,145,0.08)" : "transparent", color: vue === o.v ? "#004f91" : "#4a5568", fontFamily: "var(--font-google-sans)" }}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            {/* Recherche pays */}
            <div style={{ position: "relative", marginBottom: 18 }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
              <input value={searchPays} onChange={e => setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
                style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
              {searchPays && <button onClick={() => setSearchPays("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
            </div>
            <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
            {/* Pays */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={LBL}>Pays</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: multi && selection.length >= MAX_SEL ? "#004f91" : "#004f91", background: "rgba(0,79,145,0.18)", padding: "1px 6px", borderRadius: 999 }}>{multi ? `${selection.length}/${MAX_SEL}` : "1"}</span>
              </div>
              {/* Sénégal épinglé (référence) */}
              {senId !== null && (() => {
                const sel = selection.includes(senId);
                const col = sel ? couleurPays(senId) : "#C5BFBB";
                const removable = multi && sel && selection.length > 1;
                const canAdd = multi && !sel && selection.length < MAX_SEL;
                return (
                  <div style={{ marginBottom: 8, marginLeft: 6 }}>
                    <button onClick={() => { if (!multi) setSelection([senId]); else if (removable) setSelection(prev => prev.filter(x => x !== senId)); else if (canAdd) setSelection(prev => [...prev, senId]); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left", width: "100%" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? col : "#C5BFBB"}`, background: sel ? col : "transparent", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#4a5568", fontWeight: sel ? 700 : 400 }}>Sénégal</span>
                      <span style={{ marginLeft: "auto", fontSize: 9, color: "#9aa5b4", fontWeight: 600, background: "#F2F0EF", padding: "1px 5px", borderRadius: 4 }}>Réf.</span>
                    </button>
                  </div>
                );
              })()}
              <div style={{ height: 1, background: "#F2F0EF", marginBottom: 8 }} />
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {sortContinents(Object.keys(groupedPays)).map(continent => {
                  const isOpen = openConts.has(continent);
                  const zones = groupedPays[continent];
                  return (
                    <div key={continent} style={{ marginBottom: 6 }}>
                      <button onClick={() => toggleCont(continent)}
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: 7, background: "rgba(0,79,145,0.04)", border: "none", cursor: "pointer", marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", letterSpacing: "0.1em", textTransform: "uppercase" }}>{continent}</span>
                        <ChevronDown size={11} style={{ color: "#004f91", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                      </button>
                      {isOpen && Object.entries(zones).sort(([a], [b]) => a.localeCompare(b, "fr")).map(([zone, paysInZone]) => (
                        <div key={zone} style={{ marginLeft: 6, marginBottom: 4 }}>
                          <p style={{ fontSize: 9, fontWeight: 600, color: "#C5BFBB", textTransform: "uppercase", letterSpacing: "0.1em", padding: "2px 8px", marginBottom: 2 }}>{zone}</p>
                          {paysInZone.map(p => {
                            const sel = selection.includes(p.id);
                            const col = sel ? couleurPays(p.id) : "#C5BFBB";
                            const disabled = multi && !sel && selection.length >= MAX_SEL;
                            if (p.id === senId) return (
                              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, width: "100%", opacity: 0.35, cursor: "not-allowed" }}>
                                <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? col : "#C5BFBB"}`, background: sel ? col : "transparent", flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                                <span style={{ marginLeft: "auto", fontSize: 9, color: "#9aa5b4" }}>Réf.</span>
                              </div>
                            );
                            return (
                              <button key={p.id} onClick={() => clickPays(p.id)}
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: disabled ? "not-allowed" : "pointer", background: "transparent", textAlign: "left", width: "100%", opacity: disabled ? 0.4 : 1 }}
                                onMouseEnter={e => { if (!disabled && !sel) e.currentTarget.style.background = "#F8F7F6"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? col : "#C5BFBB"}`, background: sel ? col : "transparent", flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: "#4a5568", fontWeight: sel ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {Object.keys(groupedPays).length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center", padding: "8px 0" }}>Aucun pays trouvé</p>}
              </div>
            </div>
            <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
            {/* Période */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <span style={LBL}>Période</span>
              </div>
              <div style={{ display: "flex", gap: 3, background: "#F2F0EF", borderRadius: 9, padding: 3, marginBottom: 12 }}>
                {[{ v: "plage", l: "Plage" }, { v: "specifiques", l: "Années" }].map(m => (
                  <button key={m.v} onClick={() => setModeAnnees(m.v as "plage" | "specifiques")}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: modeAnnees === m.v ? "#fff" : "transparent", color: modeAnnees === m.v ? "#1a1a2e" : "#9aa5b4", boxShadow: modeAnnees === m.v ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
                    {m.l}
                  </button>
                ))}
              </div>
              {modeAnnees === "plage" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ position: "relative", height: 24, marginBottom: 2 }}>
                    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 4, background: "#E8E5E3", borderRadius: 2, transform: "translateY(-50%)" }} />
                    <div style={{ position: "absolute", top: "50%", left: `${((anneeMin - bornes[0]) / span) * 100}%`, width: `${Math.max(0, ((anneeMax - bornes[0]) / span) * 100 - ((anneeMin - bornes[0]) / span) * 100)}%`, height: 4, background: "#004f91", borderRadius: 2, transform: "translateY(-50%)" }} />
                    <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMin}
                      onChange={e => { setPeriodeTouchee(true); setAnneeMin(Math.min(+e.target.value, anneeMax)); }}
                      className="drs-thumb" style={{ zIndex: anneeMin >= anneeMax ? 4 : 2 } as any} />
                    <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMax}
                      onChange={e => { setPeriodeTouchee(true); setAnneeMax(Math.max(+e.target.value, anneeMin)); }}
                      className="drs-thumb" style={{ zIndex: 3 } as any} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "2px 8px", borderRadius: 6 }}>{anneeMin}</span>
                    <span style={{ fontSize: 10, color: "#9aa5b4" }}>—</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "2px 8px", borderRadius: 6 }}>{anneeMax}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#9aa5b4", textAlign: "center" }}>{anneeMax - anneeMin + 1} année{anneeMax - anneeMin + 1 > 1 ? "s" : ""}</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3, marginBottom: 8 }}>
                    {Array.from({ length: span + 1 }, (_, i) => bornes[0] + i).map(a => {
                      const sel = anneesSpec.includes(a);
                      return (
                        <button key={a} onClick={() => { setPeriodeTouchee(true); setAnneesSpec(prev => sel ? prev.filter(x => x !== a) : [...prev, a].sort()); }}
                          style={{ padding: "5px 0", borderRadius: 5, border: `1px solid ${sel ? "#004f91" : "#E8E5E3"}`, cursor: "pointer", fontSize: 10, fontWeight: sel ? 700 : 400, textAlign: "center", background: sel ? "#004f91" : "#F8F7F6", color: sel ? "#fff" : "#4a5568", transition: "all 0.1s" }}>
                          {a}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#4a5568" }}>{anneesSpec.length > 0 ? `${anneesSpec.length} année${anneesSpec.length > 1 ? "s" : ""}` : ""}</span>
                    {anneesSpec.length > 0 && <button onClick={() => setAnneesSpec([])} style={{ fontSize: 11, color: "#9aa5b4", background: "none", border: "none", cursor: "pointer" }}>Effacer</button>}
                  </div>
                </div>
              )}
            </div>
            <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
            {/* KPI */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={LBL}>Key Performance Indicators</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: kpisEpingles.length >= MAX_KPI ? "#004f91" : "#9aa5b4", background: kpisEpingles.length >= MAX_KPI ? "rgba(0,79,145,0.08)" : "#F2F0EF", padding: "2px 8px", borderRadius: 999 }}>{kpisEpingles.length}/{MAX_KPI}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 240, overflowY: "auto" }}>
                {indicateurs.map(ind => {
                  const epingle = kpisEpingles.includes(ind.code);
                  const disabled = !epingle && kpisEpingles.length >= MAX_KPI;
                  return (
                    <div key={ind.code} title={ind.libelle}
                      onClick={() => { if (!disabled) toggleEpingle(ind.code); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, background: "transparent", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.3 : 1, transition: "background 0.1s" }}
                      onMouseEnter={ev => { ev.currentTarget.style.background = "#F8F7F6"; }}
                      onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${epingle ? "#004f91" : "#C5BFBB"}`, background: epingle ? "#004f91" : "transparent", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#4a5568", flex: 1, minWidth: 0, lineHeight: 1.35, fontWeight: epingle ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ind.libelle}</span>
                      {refAnnee ? <span style={{ fontSize: 9, color: "#9aa5b4", fontWeight: 600, background: "#F2F0EF", padding: "1px 5px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0 }}>{refAnnee}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>}
        </aside>

        {/* Zone principale */}
        <div style={{ flex: 1, minWidth: 0, padding: "32px 40px 80px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /><span style={{ fontSize: 14 }}>Chargement…</span>
            </div>
          ) : !selection.length ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Sélectionnez un pays</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Choisissez un ou plusieurs pays dans la barre de filtre pour explorer leurs statistiques.</p>
            </div>
          ) : (
            <>
              {/* ── Analyse par pays ── */}
              {vue === "pays" && (() => {
                const perLabel = modeAnnees === "specifiques" && anneesSpec.length > 0
                  ? `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length - 1]}`
                  : `${anneeMin} — ${anneeMax}`;
                // Graphes : indicateurs épinglés (hors superficie) + les 4 flux de
                // commerce extérieur, toujours présents s'ils ont des données.
                const TRADE_CODES = ["importations_marchandises", "exportations_marchandises", "importations_services", "exportations_services"];
                const aDesDonnees = (code: string) => anneesActives.some(a => valeur(selection[0], code, a) !== null);
                const baseCodes = indicateursAffiches.filter(i => i.code !== "superficie").map(i => i.code);
                const codesGraphes = [...baseCodes, ...TRADE_CODES.filter(c => !baseCodes.includes(c) && aDesDonnees(c))];
                const graphIndics = codesGraphes.map(c => indicateurs.find(i => i.code === c)).filter(Boolean) as Indicateur[];
                return (
                <>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#004f91", flexShrink: 0 }} />
                      <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "#1a1a2e" }}>{paysNom(selection[0])}</h2>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, background: "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.02em", flexShrink: 0 }}>{perLabel}</span>
                    </div>
                  </div>

                  {/* KPI cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
                    {indicateursAffiches.map(ind => {
                      const v = valeur(selection[0], ind.code, refAnnee);
                      const prec = valeur(selection[0], ind.code, refAnnee - 1);
                      return (
                        <div key={ind.code} onClick={() => setKpiActif({ ind, valeur: v, annee: refAnnee, precedent: prec })}
                          style={{ background: "#fff", borderRadius: 14, padding: "13px 14px", border: "1px solid #ECEAE7", cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", minWidth: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,30,60,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(0,79,145,0.25)"; }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "#ECEAE7"; }}>
                          <div style={{ marginBottom: 7 }}>
                            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", lineHeight: 1.4 }}>{ind.libelle}</p>
                            <p style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.06em", color: "#9aa5b4", textTransform: "uppercase", marginTop: 2, lineHeight: 1.3 }}>Dernière année</p>
                          </div>
                          <p style={{ fontSize: "1.15rem", fontWeight: 800, color: ind.unite === "%" && v !== null && v < 0 ? "#dc2626" : "#1a1a2e", lineHeight: 1 }}>{fmt(v, ind.unite)}</p>
                          <p style={{ fontSize: 10, color: "#9aa5b4", marginTop: 5, lineHeight: 1 }}>en {refAnnee}</p>
                        </div>
                      );
                    })}
                    {Array.from({ length: Math.max(0, MAX_KPI - indicateursAffiches.length) }).map((_, i) => (
                      <div key={`empty-${i}`} style={{ background: "#fff", borderRadius: 14, padding: "13px 14px", border: "1.5px dashed #E8E5E3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 90 }}>
                        <span style={{ fontSize: 20, color: "#C5BFBB", lineHeight: 1 }}>+</span>
                        <span style={{ fontSize: 10, color: "#C5BFBB", textAlign: "center", lineHeight: 1.5 }}>Choisir dans<br />le filtre</span>
                      </div>
                    ))}
                  </div>

                  {/* Graphes */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                    {graphIndics.map(ind => {
                      const serie = [{ nom: paysNom(selection[0]), couleur: "#004f91", data: anneesActives.map(a => ({ annee: a, valeur: valeur(selection[0], ind.code, a) })) }];
                      return (
                        <GrapheCard key={ind.code} titre={ind.libelle} sous_titre={`${ind.unite} · ${anneesActives[0] ?? anneeMin}–${refAnnee}`} series={serie} grapheId={`stat_${ind.code}`}
                          fullChildren={<GrapheMultiPays series={serie} height={340} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} />}>
                          <GrapheMultiPays series={serie} height={145} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} />
                        </GrapheCard>
                      );
                    })}
                  </div>
                </>
                );
              })()}

              {/* ── Analyse comparative ── */}
              {vue === "comparative" && (() => {
                const perLabel = modeAnnees === "specifiques" && anneesSpec.length > 0
                  ? (anneesSpec.length === 1 ? `${anneesSpec[0]}` : `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length - 1]}`)
                  : `${anneeMin} — ${anneeMax}`;
                // Mêmes graphes que la vue Pays : indicateurs épinglés (hors superficie)
                // + les 4 flux de commerce extérieur, dès qu'un pays sélectionné a des données.
                const TRADE_CODES = ["importations_marchandises", "exportations_marchandises", "importations_services", "exportations_services"];
                const aDesDonnees = (code: string) => selection.some(id => anneesActives.some(a => valeur(id, code, a) !== null));
                const baseCodes = indicateursAffiches.filter(i => i.code !== "superficie").map(i => i.code);
                const codesGraphes = [...baseCodes, ...TRADE_CODES.filter(c => !baseCodes.includes(c) && aDesDonnees(c))];
                const graphIndics = codesGraphes.map(c => indicateurs.find(i => i.code === c)).filter(Boolean) as Indicateur[];
                return (
                <>
                  {/* Header : période + pastilles pays */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 13px", borderRadius: 999, background: "#ECEAE8", border: "1px solid #DFDBD7", fontSize: 12, fontWeight: 700, color: "#3a4452", letterSpacing: "0.02em", flexShrink: 0 }}>{perLabel}</span>
                    {selection.map(id => (
                      <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 999, background: `${couleurPays(id)}0D`, border: `1px solid ${couleurPays(id)}2E`, fontSize: 12, fontWeight: 700, color: couleurPays(id) }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: couleurPays(id), display: "inline-block" }} />{paysNom(id)}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                    {graphIndics.map(ind => {
                      const series = selection.map(id => ({ nom: paysNom(id), couleur: couleurPays(id), data: anneesActives.map(a => ({ annee: a, valeur: valeur(id, ind.code, a) })) }));
                      return (
                        <GrapheCard key={ind.code} titre={ind.libelle} sous_titre={`${ind.unite} · ${anneesActives[0] ?? anneeMin}–${refAnnee}`} series={series} grapheId={`stat_cmp_${ind.code}`} hideLegend
                          fullChildren={<GrapheMultiPays series={series} height={340} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} lineWidth={1.6} />}>
                          <GrapheMultiPays series={series} height={145} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} showDots={false} lineWidth={1.4} />
                        </GrapheCard>
                      );
                    })}
                  </div>
                </>
                );
              })()}

              {/* ── Fiche de comparaison ── */}
              {vue === "fiche" && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "28px 32px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", textAlign: "center" }}>
                  <Maximize2 size={30} style={{ color: "#004f91", opacity: 0.5, marginBottom: 12 }} />
                  <h3 style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e", margin: "0 0 6px" }}>Générer une fiche de comparaison</h3>
                  <p style={{ fontSize: 13.5, color: "#9aa5b4", maxWidth: 460, margin: "0 auto 18px", lineHeight: 1.6 }}>
                    Sélectionnez au moins deux pays dans la barre de filtre, puis générez une fiche comparant tous leurs indicateurs côte à côte.
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 20 }}>
                    {selection.map((id, i) => (
                      <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: PALETTE[i % PALETTE.length], background: `${PALETTE[i % PALETTE.length]}12`, padding: "5px 12px", borderRadius: 999 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: PALETTE[i % PALETTE.length] }} />{paysNom(id)}
                      </span>
                    ))}
                  </div>
                  <button onClick={() => setFicheOuverte(true)} disabled={selection.length < 2}
                    style={{ padding: "11px 26px", borderRadius: 12, border: "none", cursor: selection.length < 2 ? "not-allowed" : "pointer", opacity: selection.length < 2 ? 0.4 : 1, background: "#004f91", color: "#fff", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 18px rgba(0,79,145,0.35)", fontFamily: "var(--font-google-sans)" }}>
                    Générer la fiche ({selection.length} pays)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {ficheOuverte && <FicheComparaison paysIds={selection} pays={pays} onClose={() => setFicheOuverte(false)} />}
      <MiniModalKpi kpi={kpiActif} pays={kpiActif ? paysNom(selection[0]) : ""} couleur="#004f91" onClose={() => setKpiActif(null)} />
      <ModalDonnees open={showTable} onClose={() => setShowTable(false)} donnees={donnees} indicateurs={indicateurs}
        paysSelectionnes={selection.map(id => ({ id, nom: paysNom(id), couleur: couleurPays(id) }))} annees={anneesActives} />
    </main>
  );
}