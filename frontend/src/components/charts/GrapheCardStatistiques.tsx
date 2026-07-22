"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { GrapheModal } from "@/components/charts/GrapheModalStatistiques";
import LegendeGraphe from "@/components/charts/LegendeGraphe";

// ── Card graphe miniature (page Statistiques) ─────────────────────────────────
export function GrapheCard({ titre, sous_titre, children, fullChildren, series, grapheId, hideLegend, hideSousTitre }: any) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div onClick={() => setOpen(true)}
        style={{ background: "#fff", borderRadius: 14, border: "1px solid #ECEAE7", padding: "16px 18px", cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "var(--ombre-1)", minWidth: 0 }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--ombre-2)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(0,79,145,0.25)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--ombre-1)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "#ECEAE7"; }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <h3 style={{ fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", margin: 0, display: "inline-block" }}>{titre}</h3>
            </div>
            {!hideLegend && series?.length > 0 && (
              <LegendeGraphe series={series.filter((s: any) => s.data.some((d: any) => d.valeur !== null))} style={{ marginTop: 5 }} />
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
