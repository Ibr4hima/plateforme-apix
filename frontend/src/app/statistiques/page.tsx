"use client";

import Navbar from "@/components/layout/Navbar";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { ChevronDown, ChevronUp, Loader2, Maximize2, Search, SlidersHorizontal, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Palette de couleurs par pays (analyse comparative / fiche)
const PALETTE = ["#004f91", "#ca631f", "#188038", "#6A1B9A", "#0891b2", "#b91c1c", "#a16207", "#4338ca"];

type Indicateur = { code: string; libelle: string; unite: string; categorie: string; ordre: number; derive: boolean };
type Pays = { id: number; nom: string; code_iso3: string; continent: string };
type Donnee = { pays_id: number; pays: string; annee: number; indicateur: string; valeur: number | null };

// ── Formatage des valeurs par unité ───────────────────────────────────────────
function fmt(valeur: number | null | undefined, unite: string): string {
  if (valeur === null || valeur === undefined || isNaN(valeur)) return "—";
  const v = valeur;
  if (unite === "%") return `${v > 0 ? "+" : ""}${v.toFixed(1)} %`;
  if (unite === "Md USD") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md $`;
  if (unite === "USD") return `${Math.round(v).toLocaleString("fr-FR")} $`;
  if (unite === "hab/km²") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} hab/km²`;
  if (unite === "km²") return `${Math.round(v).toLocaleString("fr-FR")} km²`;
  if (unite === "habitants") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M hab.`;
    return `${Math.round(v).toLocaleString("fr-FR")} hab.`;
  }
  return v.toLocaleString("fr-FR");
}
function fmtCourt(valeur: number | null | undefined, unite: string): string {
  if (valeur === null || valeur === undefined || isNaN(valeur)) return "—";
  const v = valeur;
  if (unite === "habitants") return v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : `${Math.round(v / 1e3)} k`;
  if (unite === "km²") return v >= 1e6 ? `${(v / 1e6).toFixed(2)} M` : `${Math.round(v / 1e3)} k`;
  if (unite === "USD") return v >= 1e3 ? `${(v / 1e3).toFixed(1)} k` : `${Math.round(v)}`;
  if (unite === "%") return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

// ── Petit graphe linéaire multi-séries (D3) ───────────────────────────────────
function LineChart({ series, unite, height = 220 }: {
  series: { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] }[];
  unite: string; height?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!ref.current) return;
    const el = ref.current;
    d3.select(el).selectAll("*").remove();
    const W = el.parentElement?.clientWidth || 600;
    const H = height;
    const all = series.flatMap(s => s.data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[]);
    if (!all.length) return;
    const M = { top: 12, right: 16, bottom: 28, left: 52 };
    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
    const annees = [...new Set(all.map(d => d.annee))].sort((a, b) => a - b);
    const x = d3.scaleLinear().domain([annees[0], annees[annees.length - 1]]).range([M.left, W - M.right]);
    const mn = d3.min(all, d => d.valeur)!, mx = d3.max(all, d => d.valeur)!;
    const pad = (mx - mn) * 0.1 || Math.abs(mx) * 0.1 || 1;
    const y = d3.scaleLinear().domain([Math.min(mn - pad, unite === "%" ? mn - pad : Math.min(0, mn)), mx + pad]).nice().range([H - M.bottom, M.top]);
    // grille
    svg.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1", M.left).attr("x2", W - M.right).attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "#EBEBEB").attr("stroke-width", 1);
    // axes
    const fmtY = (v: d3.NumberValue) => { const n = +v; const a = Math.abs(n); return a >= 1e9 ? `${(n / 1e9).toFixed(0)}Md` : a >= 1e6 ? `${(n / 1e6).toFixed(0)}M` : a >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : `${n}`; };
    svg.append("g").attr("transform", `translate(${M.left},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(fmtY))
      .call(g => g.select(".domain").remove()).call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));
    svg.append("g").attr("transform", `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).tickValues(annees).tickFormat(d3.format("d")).tickSizeOuter(0))
      .call(g => g.select(".domain").attr("stroke", "#E8E5E3")).call(g => g.selectAll("line").remove())
      .call(g => g.selectAll("text").style("fill", "#9aa5b4").style("font-size", "10px"));
    // séries
    series.forEach(s => {
      const valid = s.data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[];
      if (!valid.length) return;
      svg.append("path").datum(valid).attr("fill", "none").attr("stroke", s.couleur).attr("stroke-width", 2.2)
        .attr("d", d3.line<{ annee: number; valeur: number }>().x(d => x(d.annee)).y(d => y(d.valeur)).curve(d3.curveMonotoneX));
      svg.selectAll(null).data(valid).enter().append("circle")
        .attr("cx", d => x(d.annee)).attr("cy", d => y(d.valeur)).attr("r", 2.5)
        .attr("fill", "#fff").attr("stroke", s.couleur).attr("stroke-width", 1.5);
    });
  }, [series, height, unite]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  return <div ref={wrapRef} style={{ position: "relative" }}><svg ref={ref} style={{ width: "100%", height, display: "block" }} /></div>;
}

// ── Sidebar de sélection des pays ─────────────────────────────────────────────
function SidebarPays({ pays, selection, onToggle, multi, open, setOpen, width }: {
  pays: Pays[]; selection: number[]; onToggle: (id: number) => void; multi: boolean;
  open: boolean; setOpen: (v: boolean) => void; width: number;
}) {
  const [search, setSearch] = useState("");
  const [openConts, setOpenConts] = useState<Set<string>>(new Set());
  const parCont = useMemo(() => {
    const m: Record<string, Pays[]> = {};
    pays.filter(p => !search || p.nom.toLowerCase().includes(search.toLowerCase()))
      .forEach(p => { const c = p.continent || "Autres"; (m[c] ||= []).push(p); });
    return m;
  }, [pays, search]);
  useEffect(() => { if (search) setOpenConts(new Set(Object.keys(parCont))); }, [search, parCont]);

  return (
    <aside style={{ width: open ? width : 52, flexShrink: 0, transition: "width 0.25s", background: "#fff", borderRight: "1px solid #E8E5E3", height: "calc(100vh - 64px)", overflowY: "auto", position: "sticky", top: 64, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: open ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF", display: "flex", alignItems: "center", justifyContent: open ? "space-between" : "center", flexShrink: 0 }}>
        {open && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" }}>Pays</span>}
        <button onClick={() => setOpen(!open)} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
          <SlidersHorizontal size={14} style={{ color: "#004f91" }} />
          {open && selection.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.15)", borderRadius: 999, padding: "1px 5px" }}>{selection.length}</span>}
        </button>
      </div>
      {open && (
        <div style={{ padding: "14px 14px", overflowY: "auto", flex: 1 }}>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un pays…"
              style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
          </div>
          {Object.keys(parCont).sort().map(cont => {
            const ouvert = openConts.has(cont);
            const liste = parCont[cont];
            const nbSel = liste.filter(p => selection.includes(p.id)).length;
            return (
              <div key={cont} style={{ marginBottom: 6 }}>
                <button onClick={() => setOpenConts(s => { const n = new Set(s); n.has(cont) ? n.delete(cont) : n.add(cont); return n; })}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "5px 4px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#4a5568" }}>{cont}</span>
                    {nbSel > 0 && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.1)", padding: "1px 6px", borderRadius: 999 }}>{nbSel}</span>}
                  </span>
                  {ouvert ? <ChevronUp size={13} style={{ color: "#9aa5b4" }} /> : <ChevronDown size={13} style={{ color: "#9aa5b4" }} />}
                </button>
                {ouvert && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
                    {liste.map(p => {
                      const sel = selection.includes(p.id);
                      return (
                        <button key={p.id} onClick={() => onToggle(p.id)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: sel ? "rgba(0,79,145,0.06)" : "transparent", textAlign: "left" }}
                          onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#F8F7F6"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = sel ? "rgba(0,79,145,0.06)" : "transparent"; }}>
                          <span style={{ width: 13, height: 13, borderRadius: multi ? 4 : "50%", border: `2px solid ${sel ? "#004f91" : "#C5BFBB"}`, background: sel ? "#004f91" : "transparent", flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, color: sel ? "#004f91" : "#4a5568", fontWeight: sel ? 700 : 400 }}>{p.nom}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StatistiquesPage() {
  const [onglet, setOnglet] = useState<"pays" | "comparative" | "fiche">("pays");
  const [pays, setPays] = useState<Pays[]>([]);
  const [indicateurs, setIndicateurs] = useState<Indicateur[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [donnees, setDonnees] = useState<Donnee[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ficheOuverte, setFicheOuverte] = useState(false);

  const multi = onglet !== "pays";

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

  useEffect(() => {
    if (!selection.length) { setDonnees([]); return; }
    fetch(`${API}/statistiques/donnees?pays=${selection.join(",")}`).then(r => r.json()).then(setDonnees).catch(() => {});
  }, [selection]);

  const toggle = (id: number) => {
    setSelection(sel => {
      if (multi) return sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
      return [id];
    });
  };
  // en passant de comparative→pays, ne garder qu'un pays
  useEffect(() => { if (!multi && selection.length > 1) setSelection(selection.slice(0, 1)); }, [multi]);

  const paysNom = (id: number) => pays.find(p => p.id === id)?.nom || "";
  const couleurPays = (id: number) => PALETTE[selection.indexOf(id) % PALETTE.length];
  const annees = useMemo(() => [...new Set(donnees.map(d => d.annee))].sort((a, b) => a - b), [donnees]);
  const derniereAnnee = annees[annees.length - 1];

  // Valeur pour un pays/indicateur à une année (avec dérivés déjà présents dans donnees)
  const valeur = (paysId: number, code: string, annee: number) =>
    donnees.find(d => d.pays_id === paysId && d.indicateur === code && d.annee === annee)?.valeur ?? null;

  return (
    <main style={{ minHeight: "100vh", background: "#F6F5F3", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Navbar />
      <BarreTitre titre="Statistiques">
        <BarreTitreSegment options={[
          { v: "pays", l: "Analyse par pays" },
          { v: "comparative", l: "Analyse comparative" },
          { v: "fiche", l: "Fiche de comparaison" },
        ]} value={onglet} onChange={setOnglet} />
      </BarreTitre>

      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <SidebarPays pays={pays} selection={selection} onToggle={toggle} multi={multi} open={sidebarOpen} setOpen={setSidebarOpen} width={280} />

        <div style={{ flex: 1, minWidth: 0, padding: "32px 40px 80px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /><span style={{ fontSize: 14 }}>Chargement…</span>
            </div>
          ) : !selection.length ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Sélectionnez un pays</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Choisissez un ou plusieurs pays dans la barre latérale pour explorer leurs statistiques.</p>
            </div>
          ) : (
            <>
              {/* ── Onglet Analyse par pays ── */}
              {onglet === "pays" && (
                <>
                  {/* KPI cards : dernière valeur de chaque indicateur */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 26 }}>
                    {indicateurs.map(ind => {
                      const v = valeur(selection[0], ind.code, derniereAnnee);
                      return (
                        <div key={ind.code} style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", marginBottom: 3 }}>{ind.libelle}</p>
                          <p style={{ fontSize: 10, color: "#9aa5b4", marginBottom: 8 }}>{ind.unite} · {derniereAnnee}</p>
                          <p style={{ fontSize: 22, fontWeight: 800, color: ind.unite === "%" && v !== null && v < 0 ? "#dc2626" : "#1a1a2e", letterSpacing: "-0.01em" }}>{fmt(v, ind.unite)}</p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Graphes : évolution par indicateur non dérivé */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
                    {indicateurs.filter(i => i.code !== "superficie").map(ind => {
                      const serie = [{ nom: paysNom(selection[0]), couleur: "#004f91", data: annees.map(a => ({ annee: a, valeur: valeur(selection[0], ind.code, a) })) }];
                      return (
                        <div key={ind.code} style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                          <h3 style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", margin: "0 0 2px" }}>{ind.libelle}</h3>
                          <p style={{ fontSize: 11, color: "#9aa5b4", margin: "0 0 8px" }}>{ind.unite} · {annees[0]}–{derniereAnnee}</p>
                          <LineChart series={serie} unite={ind.unite} />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── Onglet Analyse comparative ── */}
              {onglet === "comparative" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
                    {indicateurs.filter(i => i.code !== "superficie").map(ind => {
                      const series = selection.map(id => ({ nom: paysNom(id), couleur: couleurPays(id), data: annees.map(a => ({ annee: a, valeur: valeur(id, ind.code, a) })) }));
                      return (
                        <div key={ind.code} style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                          <h3 style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", margin: "0 0 6px" }}>{ind.libelle} <span style={{ fontWeight: 500, color: "#9aa5b4", fontSize: 11 }}>· {ind.unite}</span></h3>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                            {selection.map(id => (
                              <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: couleurPays(id), background: `${couleurPays(id)}12`, padding: "2px 8px", borderRadius: 999 }}>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: couleurPays(id) }} />{paysNom(id)}
                              </span>
                            ))}
                          </div>
                          <LineChart series={series} unite={ind.unite} />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── Onglet Fiche de comparaison ── */}
              {onglet === "fiche" && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "28px 32px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", textAlign: "center" }}>
                  <Maximize2 size={30} style={{ color: "#004f91", opacity: 0.5, marginBottom: 12 }} />
                  <h3 style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e", margin: "0 0 6px" }}>Générer une fiche de comparaison</h3>
                  <p style={{ fontSize: 13.5, color: "#9aa5b4", maxWidth: 460, margin: "0 auto 18px", lineHeight: 1.6 }}>
                    Sélectionnez au moins deux pays dans la barre latérale, puis générez une fiche comparant tous leurs indicateurs côte à côte.
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

      {ficheOuverte && <FicheComparaison paysIds={selection} pays={pays} onClose={() => setFicheOuverte(false)} />}
    </main>
  );
}
