"use client";

// Tooltip commun à tous les graphes D3 (#d3-tooltip). Monté une seule fois
// globalement (Providers) — avant, il était redéclaré à l'identique dans 3
// pages seulement, donc les graphes des autres pages n'avaient pas de tooltip.
// Les helpers showD3Tooltip/hideD3Tooltip (charts/outilsTooltip.ts) le ciblent.

export default function D3Tooltip() {
  return (
    <div
      id="d3-tooltip"
      style={{
        position: "fixed",
        pointerEvents: "none",
        background: "rgba(16,26,46,0.94)",
        color: "#fff",
        borderRadius: 10,
        padding: "9px 13px",
        fontSize: 12,
        lineHeight: 1.55,
        opacity: 0,
        zIndex: 9999,
        boxShadow: "var(--ombre-2)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        transition: "opacity 0.12s ease",
        fontFamily: "var(--font-google-sans)",
        maxWidth: 280,
      }}
    />
  );
}
