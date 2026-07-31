"use client";
import { useEchap } from "@/lib/useEchap";

import NavActions from "@/components/layout/NavActions";
import GrapheSignature from "@/components/shared/GrapheMultiPays";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { SkeletonKPIs, SkeletonChartGrid, SkeletonRows } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { PALETTE_COMPARAISON as PALETTE, badge_gris, badgeDe } from "@/lib/couleurs";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fmtUnite as fmt, fmtUSD, fmtCompact as fmtValGen, fmtAxe, fmtMFCFA, fmtTonnes } from "@/lib/format";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { d3, useD3Pret } from "@/lib/d3lazy";
import { ChevronDown, ChevronRight, FileSpreadsheet, Loader2, Plus, Search, SlidersHorizontal, Table, X } from "lucide-react";
import { ACCENT_BLEU, ACCENT_ORANGE, AccentNace, StylesCurseurNace, pastilleCurseur,
  varsAccent, CurseurAnneeNace as CurseurAnneeCommun, CurseurPlageNace } from "@/components/shared/CurseurNace";
import { badge_bleu, badge_orange } from "@/lib/couleurs";
import { useEtatUrl } from "@/lib/useEtatUrl";
import PickerKpi, { BtnSwapKpi, STYLE_KPI_SWAP, type PickerItem } from "@/components/shared/PickerKpi";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardStatistiques";
import { GrapheConcentration } from "@/components/charts/GrapheConcentration";
import CommerceExterieurPanel from "./commerce-exterieur";
import CommercePanel from "./flux-bilateraux";
import { API, CONT_ORDER, sortContinents, BadgePeriode, GrapheMultiPays,
  type Indicateur, type Pays, type Donnee } from "./partage";

const MAX_KPI = 4;
const KPI_DEFAUT = ["population", "superficie", "pib", "pib_hab"];

function BadgeSerie({ couleur, children }: { couleur: string; children: React.ReactNode }) {
  return (
    <span style={{ ...badgeDe(couleur), fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" as const }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: couleur, display: "inline-block", flexShrink: 0 }} />
      {children}
    </span>
  );
}

// Bouton « + » rond en pointillés → popover de sélection de pays (par continent,
// recherche à focus auto, reste ouvert pour ajouter plusieurs pays d'affilée).
function BtnAjoutPays({ pays, exclus, plein, onPick, onOpenChange }: {
  pays: Pays[]; exclus: number[]; plein: boolean; onPick: (id: number) => void;
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
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  useEffect(() => { if (plein && open) { setOpen(false); setQ(""); } }, [plein, open]);

  const dispo = pays.filter(p => !exclus.includes(p.id)
    && (!q || p.nom.toLowerCase().includes(q.toLowerCase())));
  const groupes = sortContinents([...new Set(dispo.map(p => p.continent || "Autre"))])
    .map(c => [c, dispo.filter(p => (p.continent || "Autre") === c).sort((a, b) => a.nom.localeCompare(b.nom, "fr"))] as [string, Pays[]]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button onClick={() => !plein && setOpen(o => !o)} disabled={plein}
        aria-label="Comparer avec d'autres pays" title={plein ? "4 pays maximum" : "Comparer avec d'autres pays"}
        style={{ width: 28, height: 28, borderRadius: 999, border: `1.5px dashed ${plein ? "#D8D4D0" : open ? "#004f91" : "rgba(0,79,145,0.35)"}`,
          background: open ? "rgba(0,79,145,0.08)" : "rgba(255,255,255,0.7)", color: plein ? "#C5BFBB" : "#004f91",
          cursor: plein ? "not-allowed" : "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}
        onMouseEnter={e => { if (!plein) { e.currentTarget.style.borderColor = "#004f91"; e.currentTarget.style.background = "rgba(0,79,145,0.08)"; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = plein ? "#D8D4D0" : "rgba(0,79,145,0.35)"; e.currentTarget.style.background = "rgba(255,255,255,0.7)"; } }}>
        <Plus size={14} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, width: 300,
          border: "1px solid #E4E1DE", borderRadius: 12, background: "#fff", boxShadow: "var(--ombre-2)", overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: "1px solid #F2F0EF" }}>
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un pays…"
              style={{ width: "100%", boxSizing: "border-box" as const, background: "#FCFCFB", borderWidth: 1, borderStyle: "solid", borderColor: "#E2E1DE", borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)" }} />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" as const }}>
            {groupes.map(([continent, liste]) => (
              <div key={continent}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.04)", padding: "5px 12px", letterSpacing: "0.1em", textTransform: "uppercase" as const, position: "sticky" as const, top: 0 }}>{continent}</div>
                {liste.map(p => (
                  <button key={p.id} onClick={() => { onPick(p.id); setQ(""); inputRef.current?.focus(); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" as const, borderBottom: "1px solid #F2F0EF", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,79,145,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize: 12, color: "#1a1a2e", fontWeight: 500 }}>{p.nom}</span>
                  </button>
                ))}
              </div>
            ))}
            {dispo.length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center" as const, padding: "14px 0" }}>Aucun pays trouvé</p>}
          </div>
        </div>
      )}
    </div>
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
  useEchap(!!kpi, onClose);
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
    const pct = `${variation > 0 ? "+" : ""}${variation.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
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
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>
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
            <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
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
async function exportXLSXStat(donnees: Donnee[], indicateurs: Indicateur[], paysSelectionnes: { id: number; nom: string }[], annees: number[], periode: string) {
  // SheetJS chargé à la demande (~400 Ko) : uniquement au clic Export
  const XLSX = await import("xlsx");
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
  useEchap(open, onClose);
  if (!open) return null;
  const periode = annees.length ? `${annees[0]}_${annees[annees.length - 1]}` : "all";
  const val = (pid: number, code: string, a: number) =>
    donnees.find(d => d.pays_id === pid && d.indicateur === code && d.annee === a)?.valeur ?? null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 1200, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>
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
            <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
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
      style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: mode === "icone" ? 0 : 7, padding: mode === "icone" ? "8px 10px" : "8px 16px", borderRadius: 999, border: "1px solid #E4E1DE", background: "#fff", color: "#004f91", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)", flexShrink: 0, whiteSpace: "nowrap" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#F5F4F3"; }} onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}>
      <Table size={14} />{mode !== "icone" && <span>{mode === "full" ? "Tableau de données" : "Données"}</span>}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StatistiquesPage() {
  const [mode, setMode] = useEtatUrl<"indicateurs" | "commerce" | "exterieur">("mode", "indicateurs", ["indicateurs","commerce","exterieur"]);
  const [pays, setPays] = useState<Pays[]>([]);
  const [indicateurs, setIndicateurs] = useState<Indicateur[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [donnees, setDonnees] = useState<Donnee[]>([]);
  const [loading, setLoading] = useState(true);
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
  // Slot (0-3) dont le picker de remplacement est ouvert ; -1 = aucun
  const [pickerSlot, setPickerSlot] = useState(-1);
  // Popover d'ajout de pays ouvert → floute la zone KPIs + graphes derrière lui
  const [popoverOpen, setPopoverOpen] = useState(false);

  const MAX_SEL = 4; // 4 pays au plus en comparaison (comme la page IDE)
  // La vue bascule d'elle-même en comparatif dès qu'un 2ᵉ pays est ajouté.
  const estComparatif = selection.length > 1;
  const senId = useMemo(() => pays.find(p => p.code_iso3 === "SEN")?.id ?? null, [pays]);

  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 220, 520);

  // Chargement principal : en cas d'échec, état d'erreur avec relance (tick)
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setLoading(true); setErreur(false);
    Promise.all([
      fetch(`${API}/statistiques/pays`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${API}/statistiques/indicateurs`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    ]).then(([p, i]) => {
      setPays(p || []); setIndicateurs(i || []);
      const sen = (p || []).find((x: Pays) => x.code_iso3 === "SEN");
      if (sen) setSelection([sen.id]);
    }).catch(() => setErreur(true)).finally(() => setLoading(false));
  }, [tick]);

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

  const toggleCont = (c: string) => setOpenConts(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  // Remplacement en place (slot occupé) ou ajout (slot vide) du KPI choisi
  const remplacerKpi = (slot: number, code: string) => {
    setKpisEpingles(prev => slot < prev.length ? prev.map((c, i) => i === slot ? code : c) : [...prev, code]);
    setPickerSlot(-1);
  };

  // Ajout/retrait d'un pays : bascule automatiquement en comparatif au 2ᵉ pays ;
  // il en reste toujours au moins un ; plafond à MAX_SEL séries.
  const clickPays = (id: number) => {
    setSelection(prev => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter(x => x !== id) : prev;
      if (prev.length >= MAX_SEL) return prev;
      return [...prev, id];
    });
  };
  const retirerPays = (id: number) => setSelection(prev => prev.length > 1 ? prev.filter(x => x !== id) : prev);

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
  const indicateursAffiches = kpisEpingles.map(c => indicateurs.find(i => i.code === c)).filter(Boolean) as Indicateur[];

  const valeur = (paysId: number, code: string, annee: number) =>
    donnees.find(d => d.pays_id === paysId && d.indicateur === code && d.annee === annee)?.valeur ?? null;

  // Indicateurs proposés au remplacement (non épinglés), liste à plat
  const pickerItems: PickerItem[] = indicateurs.filter(i => !kpisEpingles.includes(i.code)).map(i => ({
    id: i.code, label: i.libelle, badge: refAnnee ? String(refAnnee) : null,
    valeur: fmt(selection.length ? valeur(selection[0], i.code, refAnnee) : null, i.unite),
    title: i.libelle,
  }));

  // État des filtres (pour badge + réinitialisation)
  const paysChange = selection.length > 1 || selection[0] !== senId;
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

  // d3 est chargé dans un chunk séparé : on attend qu'il soit prêt avant de
  // rendre quoi que ce soit qui dessine (les données, elles, se chargent en parallèle)
  const d3Pret = useD3Pret();
  if (!d3Pret) return <main style={{ minHeight: "100vh", background: "#F6F5F3" }}/>;

  return (
    <main style={{ minHeight: "100vh", background: "#F6F5F3", fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.drs-thumb{-webkit-appearance:none;appearance:none;background:transparent;height:24px;margin:0;padding:0;position:absolute;top:0;left:0;width:100%;pointer-events:none}
.drs-thumb::-webkit-slider-runnable-track{background:transparent;height:4px}
.drs-thumb::-moz-range-track{background:transparent;height:4px}
.drs-thumb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all;margin-top:-6px}
.drs-thumb::-moz-range-thumb{background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all}`}</style>
      <BarreTitre titre="Échanges commerciaux" compact actions={<NavActions onDark home flouFond/>}>
        <BarreTitreSegment options={[
          { v: "indicateurs", l: "Indicateurs économiques" },
          { v: "commerce", l: "Flux bilatéraux" },
          { v: "exterieur", l: "Commerce extérieur", badge: "SEN" },
        ]} value={mode} onChange={setMode} />
      </BarreTitre>

      {mode === "exterieur" ? (
        <CommerceExterieurPanel />
      ) : mode === "commerce" ? (
        <CommercePanel />
      ) : (
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {/* ── Barre de filtre ── */}
        <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s", background: "#fff", borderRight: "1px solid #E8E5E3", height: "100vh", overflowY: "auto", position: "sticky", top: 0, display: "flex", flexDirection: "column" }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
          {sidebarOpen && <div onMouseDown={startResize} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.5)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
          <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
            {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" }}>Filtres</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setSidebarOpen(o => !o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
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
            {/* Recherche pays */}
            <div style={{ position: "relative", marginBottom: 18 }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
              <input value={searchPays} onChange={e => setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
                style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
              {searchPays && <button onClick={() => setSearchPays("")} aria-label="Effacer la recherche" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
            </div>
            <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
            {/* Pays */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={LBL}>Pays</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.18)", padding: "1px 6px", borderRadius: 999 }}>{`${selection.length}/${MAX_SEL}`}</span>
              </div>
              {/* Sénégal épinglé (référence) */}
              {senId !== null && (() => {
                const sel = selection.includes(senId);
                const col = sel ? couleurPays(senId) : "#C5BFBB";
                return (
                  <div style={{ marginBottom: 8, marginLeft: 6 }}>
                    <button onClick={() => clickPays(senId)}
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
                            const disabled = !sel && selection.length >= MAX_SEL;
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
          </div>}
        </aside>

        {/* Zone principale */}
        <div style={{ flex: 1, minWidth: 0, padding: "32px 40px 80px" }}>
          {loading ? (
            <div style={{ display: "grid", gap: 18 }}>
              <SkeletonKPIs n={5} />
              <SkeletonChartGrid n={2} cols={2} height={320} />
            </div>
          ) : erreur ? (
            <ErreurChargement onRetry={() => setTick(t => t + 1)} />
          ) : !selection.length ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Sélectionnez un pays</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Choisissez un ou plusieurs pays dans la barre de filtre pour explorer leurs statistiques.</p>
            </div>
          ) : (
            <div className="charge-in">
              {(() => {
                const perLabel = modeAnnees === "specifiques" && anneesSpec.length > 0
                  ? (anneesSpec.length === 1 ? `${anneesSpec[0]}` : `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length - 1]}`)
                  : `${anneeMin} — ${anneeMax}`;
                // Graphes : jeu fixe, indépendant des KPIs épinglés — indicateurs
                // par défaut (hors superficie) + densité de population et les 4
                // flux de commerce extérieur dès qu'un pays sélectionné a des données.
                const TRADE_CODES = ["importations_marchandises", "exportations_marchandises", "importations_services", "exportations_services"];
                const GRAPHES_SUP = ["densite", ...TRADE_CODES];
                const aDesDonnees = (code: string) => selection.some(id => anneesActives.some(a => valeur(id, code, a) !== null));
                const baseCodes = KPI_DEFAUT.filter(c => c !== "superficie");
                const codesGraphes = [...baseCodes, ...GRAPHES_SUP.filter(c => !baseCodes.includes(c) && aDesDonnees(c))];
                const graphIndics = codesGraphes.map(c => indicateurs.find(i => i.code === c)).filter(Boolean) as Indicateur[];
                return (
                <>
                  {/* Header : pays (ou pastilles en comparatif) → « + » → période */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" as const }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const, minWidth: 0 }}>
                      {estComparatif ? (
                        selection.map(id => (
                          <BadgeSerie key={id} couleur={couleurPays(id)}>
                            {paysNom(id)}
                            <button onClick={() => retirerPays(id)} aria-label={`Retirer ${paysNom(id)}`}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "inherit" }}>
                              <X size={11} />
                            </button>
                          </BadgeSerie>
                        ))
                      ) : (
                        <>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#004f91", flexShrink: 0 }} />
                          <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "#1a1a2e", margin: 0 }}>{paysNom(selection[0])}</h2>
                        </>
                      )}
                      <BtnAjoutPays pays={pays} exclus={selection} plein={selection.length >= MAX_SEL} onPick={clickPays} onOpenChange={setPopoverOpen} />
                      <BadgePeriode>{perLabel}</BadgePeriode>
                    </div>
                    <BoutonDonnees onClick={() => setShowTable(true)} dep={selection.join(",")} />
                  </div>

                  {/* KPIs + graphes — floutés tant que le popover d'ajout de pays est ouvert */}
                  <div style={{ filter: popoverOpen ? "blur(4px)" : "none", opacity: popoverOpen ? 0.6 : 1, pointerEvents: popoverOpen ? "none" : "auto", transition: "filter 0.2s, opacity 0.2s" }}>
                    {/* KPI cards — uniquement en vue pays (les KPIs ne concernent que le pays de référence),
                        remplaçables via l'icône révélée au survol */}
                    {!estComparatif && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
                        <style>{STYLE_KPI_SWAP}</style>
                        {indicateursAffiches.map((ind, slot) => {
                          const v = valeur(selection[0], ind.code, refAnnee);
                          const prec = valeur(selection[0], ind.code, refAnnee - 1);
                          const pickerOuvert = pickerSlot === slot;
                          return (
                            <div key={ind.code} className="kpi-card" onClick={() => setKpiActif({ ind, valeur: v, annee: refAnnee, precedent: prec })}
                              style={{ position: "relative", background: "#fff", borderRadius: 14, padding: "13px 14px", border: `1px solid ${pickerOuvert ? "rgba(0,79,145,0.35)" : "rgba(16,26,46,0.12)"}`, cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "none", minWidth: 0, zIndex: pickerOuvert ? 5 : undefined }}
                              onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--ombre-1)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(0,79,145,0.35)"; }}
                              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = pickerOuvert ? "rgba(0,79,145,0.35)" : "rgba(16,26,46,0.12)"; }}>
                              <BtnSwapKpi ouvert={pickerOuvert} onClick={() => setPickerSlot(pickerOuvert ? -1 : slot)} />
                              <div style={{ marginBottom: 7, paddingRight: 26 }}>
                                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", lineHeight: 1.4 }}>{ind.libelle}</p>
                                <p style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.06em", color: "#9aa5b4", textTransform: "uppercase", marginTop: 2, lineHeight: 1.3 }}>Dernière année</p>
                              </div>
                              <p style={{ fontSize: "1.15rem", fontWeight: 800, color: ind.unite === "%" && v !== null && v < 0 ? "#dc2626" : "#1a1a2e", lineHeight: 1 }}>{fmt(v, ind.unite)}</p>
                              <p style={{ fontSize: 10, color: "#9aa5b4", marginTop: 5, lineHeight: 1 }}>en {refAnnee}</p>
                              {pickerOuvert && (
                                <PickerKpi items={pickerItems} alignDroite={slot >= 2}
                                  onPick={c => remplacerKpi(slot, c)} onClose={() => setPickerSlot(-1)} />
                              )}
                            </div>
                          );
                        })}
                        {Array.from({ length: Math.max(0, MAX_KPI - indicateursAffiches.length) }).map((_, i) => {
                          const slot = indicateursAffiches.length + i;
                          const pickerOuvert = pickerSlot === slot;
                          return (
                            <div key={`empty-${i}`} data-picker-trigger onClick={() => setPickerSlot(pickerOuvert ? -1 : slot)}
                              style={{ position: "relative", background: "#fff", borderRadius: 14, padding: "13px 14px", border: `1.5px dashed ${pickerOuvert ? "#004f91" : "#E8E5E3"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 90, cursor: "pointer", transition: "border-color 0.15s", zIndex: pickerOuvert ? 5 : undefined }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = "#004f91"; }}
                              onMouseLeave={e => { if (!pickerOuvert) e.currentTarget.style.borderColor = "#E8E5E3"; }}>
                              <span style={{ fontSize: 20, color: pickerOuvert ? "#004f91" : "#C5BFBB", lineHeight: 1 }}>+</span>
                              <span style={{ fontSize: 10, color: pickerOuvert ? "#004f91" : "#C5BFBB", textAlign: "center", lineHeight: 1.5 }}>Ajouter un<br />indicateur</span>
                              {pickerOuvert && (
                                <PickerKpi items={pickerItems} alignDroite={slot >= 2}
                                  onPick={c => remplacerKpi(slot, c)} onClose={() => setPickerSlot(-1)} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Graphes — floutés tant qu'un picker de remplacement de KPI est ouvert */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, filter: pickerSlot !== -1 ? "blur(4px)" : "none", opacity: pickerSlot !== -1 ? 0.6 : 1, pointerEvents: pickerSlot !== -1 ? "none" : "auto", transition: "filter 0.2s, opacity 0.2s" }}>
                      {graphIndics.map(ind => {
                        const series = selection.map(id => ({ nom: paysNom(id), couleur: couleurPays(id), data: anneesActives.map(a => ({ annee: a, valeur: valeur(id, ind.code, a) })) }));
                        return (
                          <GrapheCard key={ind.code} titre={ind.libelle} series={series} grapheId={`stat_${estComparatif ? "cmp_" : ""}${ind.code}`} hideLegend hideSousTitre
                            fullChildren={<GrapheMultiPays series={series} height={340} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} lineWidth={estComparatif ? 1.6 : undefined} />}>
                            <GrapheMultiPays series={series} height={145} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} showDots={!estComparatif} lineWidth={estComparatif ? 1.4 : undefined} />
                          </GrapheCard>
                        );
                      })}
                    </div>
                  </div>
                </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      )}

      <MiniModalKpi kpi={kpiActif} pays={kpiActif ? paysNom(selection[0]) : ""} couleur="#004f91" onClose={() => setKpiActif(null)} />
      <ModalDonnees open={showTable} onClose={() => setShowTable(false)} donnees={donnees} indicateurs={indicateurs}
        paysSelectionnes={selection.map(id => ({ id, nom: paysNom(id), couleur: couleurPays(id) }))} annees={anneesActives} />
    </main>
  );
}