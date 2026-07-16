"use client";

import React from "react";

// Panneau « bleu nuit » derrière les bandes de chiffres clés : une zone sombre
// qui donne de la profondeur aux pages de données, dans la continuité du hero
// bleu (même trame fine et halos que BarreTitre). Les tuiles posées dessus
// utilisent les couleurs NUIT ci-dessous (verre dépoli, texte blanc).

export const NUIT = {
  tuile:          "rgba(255,255,255,0.07)",
  tuileBord:      "rgba(255,255,255,0.14)",
  tuileBordHover: "rgba(255,255,255,0.34)",
  label:          "rgba(255,255,255,0.72)",
  sousLabel:      "rgba(255,255,255,0.50)",
  valeur:         "#fff",
  indicatif:      "rgba(255,255,255,0.55)",
  negatif:        "#FF9A8D",
  videBord:       "rgba(255,255,255,0.22)",
  videTexte:      "rgba(255,255,255,0.45)",
  ombreHover:     "0 12px 28px rgba(0,0,0,0.28)",
};

export default function PanneauNuit({ children, style }: {
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section style={{ position: "relative", overflow: "hidden", borderRadius: 18, background: "linear-gradient(135deg,#0A1F38 0%,#0D3060 58%,#0A2745 100%)", boxShadow: "0 14px 40px rgba(2,20,38,0.18)", padding: 16, ...style }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5 }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse at 80% 0%,rgba(0,0,0,0.8) 0%,transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at 80% 0%,rgba(0,0,0,0.8) 0%,transparent 70%)" }} />
        <div style={{ position: "absolute", top: -220, right: -80, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(120,180,255,0.14) 0%,transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: -260, left: -120, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,79,145,0.5) 0%,transparent 65%)" }} />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </section>
  );
}
