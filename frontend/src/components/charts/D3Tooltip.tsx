"use client";

// Infobulle commune à tous les graphes D3 (#d3-tooltip). Montée une seule fois
// globalement (Providers) ; les helpers showD3Tooltip / hideD3Tooltip
// (charts/outilsTooltip.ts) la ciblent.
//
// Sombre, comme celle de la vedette de l'accueil : sur un graphe clair, elle
// se détache sans ombre lourde ni filet, et la valeur s'y lit en blanc. Son
// contenu s'habille des classes .gt-* de globals.css (rubrique « Graphes »).

export default function D3Tooltip() {
  return (
    <div
      id="d3-tooltip"
      role="presentation"
      style={{
        position: "fixed",
        pointerEvents: "none",
        background: "var(--encre)",
        color: "#fff",
        borderRadius: 8,
        padding: "8px 11px",
        fontSize: 12,
        lineHeight: 1.45,
        opacity: 0,
        zIndex: 9999,
        boxShadow: "0 8px 24px rgb(var(--ombre-rgb) / 0.22)",
        transition: "opacity 0.12s ease",
        fontFamily: "var(--font-google-sans)",
        maxWidth: 340,
      }}
    />
  );
}
