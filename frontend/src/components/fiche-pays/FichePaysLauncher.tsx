"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronDown, FileText, Landmark, Scale, Search, X } from "lucide-react";
import { SkeletonRows } from "@/components/shared/Skeleton";
import { useModalA11y } from "@/lib/useModalA11y";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Palette de couleurs par pays (analyse comparative / fiche)
const PALETTE = ["#004f91", "#ca631f", "#188038", "#6A1B9A", "#0891b2", "#b91c1c", "#a16207", "#4338ca"];

type Indicateur = { code: string; libelle: string; unite: string; categorie: string; ordre: number; derive: boolean };
type Pays = { id: number; nom: string; code_iso3: string; continent: string; region_geo: string | null };

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

const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];
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
  const dlgRef = useModalA11y(onClose); // accessibilité : Échap, piège de focus, restauration
  const [data, setData] = useState<any>(null);
  const [ideFlux, setIdeFlux] = useState<any>(null);
  const [bilat, setBilat] = useState<any>(null);
  useEffect(() => {
    fetch(`${API}/statistiques/comparaison?pays=${paysIds.join(",")}`).then(r => r.json()).then(setData).catch(() => {});
    fetch(`${API}/statistiques/ide_flux?pays=${paysIds.join(",")}`).then(r => r.json()).then(setIdeFlux).catch(() => setIdeFlux({}));
    setBilat(null);
    if (paysIds.length === 2) {
      fetch(`${API}/statistiques/commerce/bilateral?pays_a=${paysIds[0]}&pays_b=${paysIds[1]}`).then(r => r.json()).then(setBilat).catch(() => setBilat(null));
    }
  }, [paysIds]);
  const cols = data?.pays || [];
  // Indicateurs macro + flux d'IDE entrant/sortant (source CNUCED)
  const inds: Indicateur[] = [
    ...(data?.indicateurs || []),
    { code: "__ide_entrant", libelle: "Flux d'IDE entrants", unite: "USD", categorie: "Investissements directs étrangers" } as any,
    { code: "__ide_sortant", libelle: "Flux d'IDE sortants", unite: "USD", categorie: "Investissements directs étrangers" } as any,
  ];
  // Regroupement par catégorie (ordre de première apparition)
  const cats: string[] = [];
  const parCat: Record<string, Indicateur[]> = {};
  inds.forEach(ind => { const c = (ind as any).categorie || "Autres"; if (!parCat[c]) { parCat[c] = []; cats.push(c); } parCat[c].push(ind); });
  const getCell = (cid: number, code: string): { valeur: number | null; annee?: number } | null => {
    if (code === "__ide_entrant") return ideFlux?.[String(cid)]?.entrant || null;
    if (code === "__ide_sortant") return ideFlux?.[String(cid)]?.sortant || null;
    return data?.valeurs?.[String(cid)]?.[code] || null;
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div ref={dlgRef} role="dialog" aria-modal="true" aria-label="Fiche Pays" onClick={e => e.stopPropagation()} style={{ position: "relative", background: "#fff", borderRadius: 20, width: "100%", maxWidth: 920, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "#004f91", flexShrink: 0 }} />
        <button onClick={onClose} data-no-pdf aria-label="Fermer" style={{ position: "absolute", top: 16, right: 18, width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>
          <X size={15} color="#4a5568" />
        </button>
        <div style={{ overflowY: "auto", flex: 1 }}>
          <div style={{ background: "#fff", padding: "26px 30px 30px" }}>
            {/* En-tête premium */}
            <div style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid #ECEAE7" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.55rem", color: "#1a1a2e", margin: 0, letterSpacing: "-0.01em" }}>Fiche Pays</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {cols.map((c: any, i: number) => (
                  <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: PALETTE[i % PALETTE.length], background: `${PALETTE[i % PALETTE.length]}12`, border: `1px solid ${PALETTE[i % PALETTE.length]}2E`, padding: "5px 13px", borderRadius: 999 }}>
                    {c.code_iso2
                      ? <img src={`https://flagcdn.com/w40/${String(c.code_iso2).toLowerCase()}.png`} alt="" width={20} height={14} style={{ borderRadius: 2, objectFit: "cover", boxShadow: "0 0 0 1px rgba(0,0,0,0.10)", flexShrink: 0 }} onError={e => { e.currentTarget.style.display = "none"; }} />
                      : <span style={{ width: 7, height: 7, borderRadius: "50%", background: PALETTE[i % PALETTE.length] }} />}
                    {c.nom}{c.code_iso3 ? <span style={{ color: "#6b7684", fontWeight: 600 }}>· {c.code_iso3}</span> : null}
                  </span>
                ))}
              </div>
            </div>
            {/* Contexte relationnel (2 pays) : appartenances communes + accords */}
            {cols.length === 2 && bilat && (bilat.groupements_communs?.length > 0 || bilat.accords?.length > 0) && (
              <div style={{ marginBottom: 22 }}>
                {bilat.groupements_communs && bilat.groupements_communs.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10, padding: "12px 16px", background: "#fff", border: "1px solid #ECEAE7", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,30,60,0.04)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 9.5, fontWeight: 800, color: "#004f91", letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>
                      <Landmark size={13} /> Appartenances communes
                    </span>
                    {bilat.groupements_communs.map((g: any) => (
                      <span key={g.code} title={g.nom} style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, color: "#4a5568", background: "#F5F4F3", border: "1px solid #E8E5E2", padding: "4px 11px", borderRadius: 999 }}>{g.code || g.nom}</span>
                    ))}
                  </div>
                )}
                {bilat.accords && bilat.accords.length > 0 && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 10, padding: "12px 16px", background: "#fff", border: "1px solid #ECEAE7", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,30,60,0.04)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 9.5, fontWeight: 800, color: "#004f91", letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0, paddingTop: 4 }}>
                      <FileText size={13} /> {bilat.accords.length > 1 ? "Accords signés" : "Accord signé"}
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {bilat.accords.map((ac: any, i: number) => {
                        const an = ac.date_signature ? ac.date_signature.slice(0, 4) : null;
                        return (
                          <span key={i} title={ac.reference || ac.titre} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#4a5568", background: "#F5F4F3", border: "1px solid #E8E5E2", padding: "4px 11px", borderRadius: 999 }}>
                            {ac.titre}{an ? <span style={{ color: "#6b7684", fontWeight: 500 }}>· {an}</span> : null}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!data ? (
              <SkeletonRows n={10} h={34} />
            ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ECEAE7" }}>
                  <th style={{ padding: "0 12px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#6b7684", textTransform: "uppercase", letterSpacing: "0.08em" }}>Indicateur</th>
                  {cols.map((c: any, i: number) => (
                    <th key={c.id} style={{ padding: "0 12px 12px", textAlign: "right", fontSize: 12.5, fontWeight: 800, color: PALETTE[i % PALETTE.length] }}>{c.nom}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cats.map(cat => (
                  <Fragment key={cat}>
                    <tr>
                      <td colSpan={cols.length + 1} style={{ padding: "18px 12px 6px", fontSize: 10.5, fontWeight: 800, color: "#004f91", textTransform: "uppercase", letterSpacing: "0.1em" }}>{cat}</td>
                    </tr>
                    {parCat[cat].map(ind => {
                      return (
                        <tr key={ind.code} style={{ borderBottom: "1px solid #F5F4F3" }}>
                          <td style={{ padding: "11px 12px" }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1a1a2e" }}>{ind.libelle}</div>
                            <div style={{ fontSize: 10.5, color: "#6b7684" }}>{ind.unite}</div>
                          </td>
                          {cols.map((c: any) => {
                            const cell = getCell(c.id, ind.code);
                            const v = cell?.valeur;
                            return (
                              <td key={c.id} style={{ padding: "11px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: v === null || v === undefined ? "#C5BFBB" : "#1a1a2e" }}>
                                  {fmt(v, ind.unite)}
                                </span>
                                {cell?.annee && <span style={{ display: "block", fontSize: 9.5, color: "#C5BFBB" }}>{cell.annee}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
          </div>
          {/* Échanges bilatéraux (2 pays) */}
          {cols.length === 2 && bilat && (bilat.a_vers_b > 0 || bilat.b_vers_a > 0) && (
          <div style={{ background: "#fff", padding: "10px 30px 30px" }}>{(() => {
            const a = cols[0], b = cols[1];
            const ab = bilat.a_vers_b || 0, ba = bilat.b_vers_a || 0;
            const diff = ab - ba;
            const gagnant = diff >= 0 ? a : b;
            const perdant = diff >= 0 ? b : a;
            const colA = PALETTE[0], colB = PALETTE[1];
            const periode = bilat.annee_min ? `${bilat.annee_min}–${bilat.annee_max}` : "";
            const BlocDir = ({ de, vers, col, val, res, dep }: any) => {
              const maxR = res && res.length ? res[0].valeur : 1;
              const hasRes = res && res.length > 0;
              return (
                <div style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,30,60,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderBottom: hasRes ? "1px solid #F4F2F0" : "none" }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>
                        <span style={{ fontWeight: 800, color: col }}>{de}</span>
                        <ArrowRight size={13} style={{ color: "#c5bfbb", flexShrink: 0 }} />
                        <span>{vers}</span>
                      </span>
                      {dep != null && dep > 0 && <span style={{ fontSize: 11, color: "#6b7684", marginTop: 3, display: "block" }}>soit <strong style={{ color: "#6b7684" }}>{(dep * 100).toFixed(1)} %</strong> des importations de {vers}</span>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: col, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmtUSD(val)}</div>
                      <div style={{ fontSize: 8.5, fontWeight: 700, color: "#c5bfbb", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>Total exporté</div>
                    </div>
                  </div>
                  {hasRes && (
                    <div style={{ padding: "13px 16px", display: "grid", gap: 12 }}>
                      {res.map((r: any) => {
                        const pct = val > 0 ? r.valeur / val * 100 : 0;
                        return (
                          <div key={r.ressource}>
                            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 5 }}>
                              <span style={{ fontSize: 11.5, color: "#4a5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={r.ressource}>{r.ressource}</span>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#2d3540", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtUSD(r.valeur)} <span style={{ color: "#b0aaa4", fontWeight: 600 }}>· {pct.toFixed(0)} %</span></span>
                            </div>
                            <div style={{ height: 6, background: "#F0EEEC", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.max(4, Math.sqrt(r.valeur / maxR) * 100)}%`, background: col, borderRadius: 99 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            };
            return (
              <div style={{ marginTop: 22 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Échanges bilatéraux{periode ? ` · ${periode}` : ""}</p>
                <div style={{ display: "grid", gap: 8 }}>
                  <BlocDir de={a.nom} vers={b.nom} col={colA} val={ab} res={bilat.a_vers_b_ressources} dep={bilat.a_vers_b_dependance} />
                  <BlocDir de={b.nom} vers={a.nom} col={colB} val={ba} res={bilat.b_vers_a_ressources} dep={bilat.b_vers_a_dependance} />
                </div>
                <div style={{ marginTop: 12, padding: "14px 18px", borderRadius: 12, background: "linear-gradient(180deg,rgba(0,79,145,0.08),rgba(0,79,145,0.035))", border: "1px solid rgba(0,79,145,0.20)", display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(0,79,145,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Scale size={19} color="#004f91" />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: "#004f91", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 3 }}>Balance commerciale</div>
                    <div style={{ fontSize: 12.5, color: "#4a5568", lineHeight: 1.45 }}>
                      {diff === 0
                        ? <>Échanges <strong style={{ color: "#1a1a2e" }}>équilibrés</strong> entre {a.nom} et {b.nom}.</>
                        : <>Excédentaire en faveur de <strong style={{ color: diff >= 0 ? colA : colB }}>{gagnant.nom}</strong>, déficitaire pour {perdant.nom}.</>}
                    </div>
                  </div>
                  {diff !== 0 && (
                    <span style={{ fontSize: 17, fontWeight: 800, color: diff >= 0 ? colA : colB, fontVariantNumeric: "tabular-nums", flexShrink: 0, whiteSpace: "nowrap" }}>
                      +{fmtUSD(Math.abs(diff))}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}</div>)}
        </div>
        <div data-no-pdf style={{ padding: "14px 28px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 10 }}>
          <span style={{ fontSize: 11, color: "#6b7684" }}>Dernière année disponible pour chaque indicateur</span>
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

// ── Sélecteur de pays (Fiche Pays) ────────────────────────────────────────────
function FichePaysPicker({ pays, senId, initial, onValider, onClose }: {
  pays: Pays[]; senId: number | null; initial: number[]; onValider: (ids: number[]) => void; onClose: () => void;
}) {
  const MAX = 2;
  const dlgRef = useModalA11y(onClose); // accessibilité : Échap, piège de focus, restauration
  const [sel, setSel] = useState<number[]>(initial.length ? initial.slice(0, MAX) : (senId ? [senId] : []));
  const [search, setSearch] = useState("");
  const [openConts, setOpenConts] = useState<Set<string>>(new Set());
  const couleur = (id: number) => PALETTE[sel.indexOf(id) % PALETTE.length];

  const grouped = useMemo(() => {
    const g: Record<string, Record<string, Pays[]>> = {};
    pays.filter(p => !search || p.nom.toLowerCase().includes(search.toLowerCase()))
      .forEach(p => { const c = p.continent || "Autre"; const z = p.region_geo || "Autre"; ((g[c] ||= {})[z] ||= []).push(p); });
    for (const c of Object.keys(g)) for (const z of Object.keys(g[c]))
      g[c][z].sort((a, b) => { if (a.nom === "Sénégal") return -1; if (b.nom === "Sénégal") return 1; return a.nom.localeCompare(b.nom, "fr"); });
    return g;
  }, [pays, search]);
  useEffect(() => { if (search) setOpenConts(new Set(Object.keys(grouped))); }, [search, grouped]);

  const toggleCont = (c: string) => setOpenConts(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const clickPays = (id: number) => setSel(prev => prev.includes(id)
    ? (prev.length > 1 ? prev.filter(x => x !== id) : prev)
    : (prev.length >= MAX ? prev : [...prev, id]));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div ref={dlgRef} role="dialog" aria-modal="true" aria-label="Sélection des pays" onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 400, maxHeight: "84vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "#004f91", flexShrink: 0 }} />
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid #F2F0EF", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e", margin: 0 }}>Fiche Pays</h2>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.12)", padding: "2px 8px", borderRadius: 999 }}>{sel.length}/{MAX}</span>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width: 30, height: 30, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8"; }} onMouseLeave={e => { e.currentTarget.style.background = "#F5F4F3"; }}>
              <X size={14} color="#4a5568" />
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#6b7684" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un pays…" autoFocus
              style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 9, paddingBottom: 9, borderRadius: 9, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12.5, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
            {search && <button onClick={() => setSearch("")} aria-label="Effacer la recherche" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#6b7684" }} /></button>}
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 18px" }}>
          {/* Sénégal épinglé (référence) */}
          {senId !== null && (() => {
            const on = sel.includes(senId);
            const col = on ? couleur(senId) : "#C5BFBB";
            const removable = on && sel.length > 1;
            const canAdd = !on && sel.length < MAX;
            return (
              <div style={{ marginBottom: 8, marginLeft: 6 }}>
                <button onClick={() => { if (removable) setSel(prev => prev.filter(x => x !== senId)); else if (canAdd) setSel(prev => [...prev, senId]); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left", width: "100%" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${on ? col : "#C5BFBB"}`, background: on ? col : "transparent", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#4a5568", fontWeight: on ? 700 : 400 }}>Sénégal</span>
                  <span style={{ marginLeft: "auto", fontSize: 9, color: "#6b7684", fontWeight: 600, background: "#F2F0EF", padding: "1px 5px", borderRadius: 4 }}>Réf.</span>
                </button>
              </div>
            );
          })()}
          <div style={{ height: 1, background: "#F2F0EF", marginBottom: 8 }} />
          {sortContinents(Object.keys(grouped)).map(continent => {
            const isOpen = openConts.has(continent);
            const zones = grouped[continent];
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
                      const on = sel.includes(p.id);
                      const col = on ? couleur(p.id) : "#C5BFBB";
                      const disabled = !on && sel.length >= MAX;
                      if (p.id === senId) return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, width: "100%", opacity: 0.35, cursor: "not-allowed" }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${on ? col : "#C5BFBB"}`, background: on ? col : "transparent", flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                          <span style={{ marginLeft: "auto", fontSize: 9, color: "#6b7684" }}>Réf.</span>
                        </div>
                      );
                      return (
                        <button key={p.id} onClick={() => clickPays(p.id)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: disabled ? "not-allowed" : "pointer", background: "transparent", textAlign: "left", width: "100%", opacity: disabled ? 0.4 : 1 }}
                          onMouseEnter={e => { if (!disabled && !on) e.currentTarget.style.background = "#F8F7F6"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${on ? col : "#C5BFBB"}`, background: on ? col : "transparent", flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#4a5568", fontWeight: on ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
          {Object.keys(grouped).length === 0 && <p style={{ fontSize: 12, color: "#6b7684", textAlign: "center", padding: "8px 0" }}>Aucun pays trouvé</p>}
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 10 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {sel.map(id => { const p = pays.find(x => x.id === id); const canRemove = sel.length > 1; return p ? (
              <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: couleur(id), background: `${couleur(id)}12`, padding: "3px 5px 3px 9px", borderRadius: 999 }}>
                {p.nom}
                <button onClick={() => canRemove && setSel(prev => prev.filter(x => x !== id))} disabled={!canRemove} aria-label={`Retirer ${p.nom}`} title={canRemove ? `Retirer ${p.nom}` : "Au moins un pays requis"}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", border: "none", padding: 0, background: "transparent", color: couleur(id), cursor: canRemove ? "pointer" : "not-allowed", opacity: canRemove ? 1 : 0.35 }}
                  onMouseEnter={e => { if (canRemove) e.currentTarget.style.background = `${couleur(id)}22`; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <X size={10} strokeWidth={2.6} />
                </button>
              </span>
            ) : null; })}
          </div>
          <button onClick={() => sel.length && onValider(sel)} disabled={!sel.length}
            style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: sel.length ? "pointer" : "not-allowed", opacity: sel.length ? 1 : 0.4, boxShadow: "0 3px 12px rgba(0,79,145,0.25)", fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap", flexShrink: 0 }}>
            Générer la fiche
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lanceur « Fiche Pays » (navbar) ───────────────────────────────────────────
export default function FichePaysLauncher({ textColor, textHover }: { textColor: string; textHover: string }) {
  const [pays, setPays] = useState<Pays[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [ficheOpen, setFicheOpen] = useState(false);
  // La navbar applique un backdrop-filter → elle devient le bloc conteneur des
  // éléments position:fixed. On rend donc les overlays via un portail sur
  // document.body pour qu'ils couvrent tout l'écran (fond flouté inclus).
  const [monte, setMonte] = useState(false);
  useEffect(() => { setMonte(true); }, []);
  useEffect(() => { fetch(`${API}/statistiques/pays`).then(r => r.json()).then(setPays).catch(() => {}); }, []);
  const senId = useMemo(() => pays.find(p => p.code_iso3 === "SEN")?.id ?? null, [pays]);
  return (
    <>
      <button onClick={() => setPickerOpen(true)}
        style={{ display: "flex", alignItems: "center", height: 36, padding: "0 14px", borderRadius: 10, color: textColor, background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-google-sans)", transition: "all 0.15s", letterSpacing: "-0.01em" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.07)"; e.currentTarget.style.color = textHover; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = textColor; }}>
        Fiche Pays
      </button>
      {monte && pickerOpen && createPortal(
        <FichePaysPicker pays={pays} senId={senId} initial={sel.length ? sel : (senId ? [senId] : [])}
          onValider={(ids: number[]) => { setSel(ids); setPickerOpen(false); setFicheOpen(true); }}
          onClose={() => setPickerOpen(false)} />,
        document.body)}
      {monte && ficheOpen && sel.length > 0 && createPortal(
        <FicheComparaison paysIds={sel} pays={pays} onClose={() => setFicheOpen(false)} />,
        document.body)}
    </>
  );
}
