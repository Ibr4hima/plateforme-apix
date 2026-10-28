"use client";

// Tooltip commun à tous les graphes D3 (#d3-tooltip). Monté une seule fois
// globalement (Providers) — avant, il était redéclaré à l'identique dans 3
// pages seulement, donc les graphes des autres pages n'avaient pas de tooltip.
// Les helpers showD3Tooltip/hideD3Tooltip (charts/outilsTooltip.ts) le ciblent.
//
// Le tooltip est une surface de l'interface comme les autres : fond de carte,
// filet, encre. Il se détache du graphe par son ombre et son filet plutôt que
// par une inversion de contraste.

export default function D3Tooltip() {
  return (
    <div
      id="d3-tooltip"
      style={{
        position: "fixed",
        pointerEvents: "none",
        background: "var(--carte)",
        color: "var(--encre)",
        border: "1px solid var(--bordure)",
        borderRadius: 8,
        padding: "9px 12px",
        fontSize: 12,
        lineHeight: 1.5,
        opacity: 0,
        zIndex: 9999,
        boxShadow: "var(--ombre-2)",
        transition: "opacity 0.12s ease",
        fontFamily: "var(--font-google-sans)",
        maxWidth: 280,
      }}
    />
  );
}
