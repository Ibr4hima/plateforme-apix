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
function fmtCourt(valeur: number | null | undefined, unite: string): string {
  if (valeur === null || valeur === undefined || isNaN(valeur)) return "—";
  const v = valeur;
  if (unite === "habitants") return v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : `${Math.round(v / 1e3)} k`;
  if (unite === "km²") return v >= 1e6 ? `${(v / 1e6).toFixed(2)} M` : `${Math.round(v / 1e3)} k`;
  if (unite === "USD") { const a = Math.abs(v); return a >= 1e9 ? `${(v / 1e9).toFixed(1)}Md` : a >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : a >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : `${Math.round(v)}`; }
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

// ── Panneau Données commerciales (flux bilatéraux) ────────────────────────────
type OptionPays = { id: number; nom: string; code_iso3: string | null };
function CommercePanel() {
  const [annees, setAnnees] = useState<number[]>([]);
  const [ressources, setRessources] = useState<{ nom_en: string; libelle: string }[]>([]);
  const [paysOpts, setPaysOpts] = useState<OptionPays[]>([]);
  const [lignes, setLignes] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fAnnee, setFAnnee] = useState("");
  const [fRessource, setFRessource] = useState("");
  const [fExp, setFExp] = useState("");
  const [fImp, setFImp] = useState("");
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [loading, setLoading] = useState(true);
  const [chargTable, setChargTable] = useState(false);
  const TAILLE = 50;

  useEffect(() => {
    fetch(`${API}/statistiques/commerce/filtres`).then(r => r.json()).then(d => {
      setAnnees(d.annees || []); setRessources(d.ressources || []); setPaysOpts(d.pays || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { const t = setTimeout(() => { setQDeb(q); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [fAnnee, fRessource, fExp, fImp]);

  useEffect(() => {
    setChargTable(true);
    const p = new URLSearchParams({ page: String(page), taille: String(TAILLE) });
    if (fAnnee) p.set("annee", fAnnee);
    if (fRessource) p.set("ressource", fRessource);
    if (fExp) p.set("exportateur_id", fExp);
    if (fImp) p.set("importateur_id", fImp);
    if (qDeb.trim()) p.set("recherche", qDeb.trim());
    fetch(`${API}/statistiques/commerce/transactions?${p.toString()}`)
      .then(r => r.json())
      .then(d => { setLignes(d.lignes || []); setTotal(d.total || 0); })
      .catch(() => { setLignes([]); setTotal(0); })
      .finally(() => setChargTable(false));
  }, [page, fAnnee, fRessource, fExp, fImp, qDeb]);

  const nbPages = Math.max(1, Math.ceil(total / TAILLE));
  const IS: any = { background: "#F8F7F6", border: "1px solid #E8E5E3", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" };
  const TH: any = { padding: "11px 16px", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6b7684", whiteSpace: "nowrap" };
  const TD: any = { padding: "10px 16px", verticalAlign: "middle" };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 260, gap: 12, color: "#9aa5b4" }}>
      <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /><span style={{ fontSize: 14 }}>Chargement…</span>
    </div>
  );
  if (!annees.length) return (
    <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucune donnée commerciale</p>
      <p style={{ fontSize: 14, marginTop: 6 }}>Les flux commerciaux bilatéraux seront disponibles après import dans l&apos;administration.</p>
    </div>
  );

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #ECEAE7", padding: "24px 28px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h2 style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e", margin: 0 }}>Flux commerciaux bilatéraux</h2>
        <span style={{ fontSize: 12.5, color: "#9aa5b4", fontWeight: 600 }}>{total.toLocaleString("fr-FR")} flux</span>
      </div>
      <p style={{ fontSize: 12.5, color: "#9aa5b4", margin: "0 0 18px" }}>Valeur des échanges par ressource entre pays exportateur et importateur (source resourcetrade.earth).</p>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un pays, une ressource…" style={{ ...IS, width: "100%", paddingLeft: 30 }} />
        </div>
        <select value={fAnnee} onChange={e => setFAnnee(e.target.value)} style={{ ...IS, cursor: "pointer" }}>
          <option value="">Toutes les années</option>
          {annees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={fRessource} onChange={e => setFRessource(e.target.value)} style={{ ...IS, cursor: "pointer", maxWidth: 240 }}>
          <option value="">Toutes les ressources</option>
          {ressources.map(rr => <option key={rr.nom_en} value={rr.nom_en}>{rr.libelle}</option>)}
        </select>
        <select value={fExp} onChange={e => setFExp(e.target.value)} style={{ ...IS, cursor: "pointer", maxWidth: 220 }}>
          <option value="">Tous les exportateurs</option>
          {paysOpts.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <select value={fImp} onChange={e => setFImp(e.target.value)} style={{ ...IS, cursor: "pointer", maxWidth: 220 }}>
          <option value="">Tous les importateurs</option>
          {paysOpts.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #F0EEEC", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#FAF9F8", textAlign: "left" }}>
              <th style={TH}>Exportateur</th>
              <th style={TH}>Importateur</th>
              <th style={{ ...TH, width: 70 }}>Année</th>
              <th style={TH}>Ressource</th>
              <th style={{ ...TH, textAlign: "right" }}>Valeur</th>
            </tr>
          </thead>
          <tbody>
            {chargTable ? (
              <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: "#9aa5b4", padding: "32px" }}><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /></td></tr>
            ) : lignes.length === 0 ? (
              <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: "#9aa5b4", padding: "32px" }}>Aucun flux ne correspond aux filtres.</td></tr>
            ) : lignes.map(l => (
              <tr key={l.id} style={{ borderTop: "1px solid #F4F2F0" }}>
                <td style={{ ...TD, fontWeight: 600, color: "#2d3540" }}>{l.exportateur}</td>
                <td style={{ ...TD, fontWeight: 600, color: "#2d3540" }}>{l.importateur}</td>
                <td style={TD}>{l.annee}</td>
                <td style={{ ...TD, color: "#4a5568" }}>{l.ressource}</td>
                <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#004f91" }} title={l.valeur != null ? l.valeur.toLocaleString("fr-FR") + " $" : ""}>{fmtUSD(l.valeur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > TAILLE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 12.5, color: "#9aa5b4" }}>Page {page} / {nbPages}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ background: "#F8F7F6", border: "1px solid #E8E5E3", borderRadius: 9, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#2d3540", fontFamily: "var(--font-google-sans)", opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}>Précédent</button>
            <button onClick={() => setPage(p => Math.min(nbPages, p + 1))} disabled={page >= nbPages}
              style={{ background: "#F8F7F6", border: "1px solid #E8E5E3", borderRadius: 9, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#2d3540", fontFamily: "var(--font-google-sans)", opacity: page >= nbPages ? 0.4 : 1, cursor: page >= nbPages ? "not-allowed" : "pointer" }}>Suivant</button>
          </div>
        </div>
      )}
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

  const MAX_SEL = PALETTE.length;
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
      <BarreTitre titre="Statistiques">
        <BarreTitreSegment options={[
          { v: "indicateurs", l: "Indicateurs économiques" },
          { v: "commerce", l: "Données commerciales" },
        ]} value={mode} onChange={setMode} />
      </BarreTitre>

      {mode === "commerce" ? (
        <div style={{ padding: "32px 40px 80px" }}>
          <CommercePanel />
        </div>
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
              {vue === "comparative" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
                  {indicateursAffiches.filter(i => i.code !== "superficie").map(ind => {
                    const series = selection.map(id => ({ nom: paysNom(id), couleur: couleurPays(id), data: anneesActives.map(a => ({ annee: a, valeur: valeur(id, ind.code, a) })) }));
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
              )}

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
    </main>
  );
}