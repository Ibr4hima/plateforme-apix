"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { downloadPNG } from "@/components/charts/outilsExport";
import LegendeGraphe from "@/components/charts/LegendeGraphe";

// ── Modal graphe plein écran (page Statistiques) ──────────────────────────────
export function GrapheModal({ open, onClose, titre, sous_titre, children, series, grapheId }: any) {
  const modalRef = useRef<HTMLDivElement>(null);
  const getSvg = () => modalRef.current?.querySelector("svg") as SVGSVGElement | null;

  // Accessibilité : fermeture à la touche Échap + verrouillage du scroll du body
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

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
      <div role="dialog" aria-modal="true" aria-label={titre} onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 1100, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>
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
                {series?.length > 0 && <LegendeGraphe series={series.filter((s: any) => s.data.some((d: any) => d.valeur !== null))} />}
                {sous_titre && <span style={{ fontSize: 11.5, color: "#9aa5b4", fontWeight: 500 }}>{sous_titre}</span>}
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
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
