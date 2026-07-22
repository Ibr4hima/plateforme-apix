"use client";

// Légende commune des graphes : une rangée de pastilles (point coloré + libellé)
// qui portent l'identité des séries — jamais la couleur seule (accessibilité).
// Style unique, aligné sur les jetons du design system.

import React from "react";

export type SerieLegende = { nom: string; couleur: string };

export function LegendeChip({ couleur, nom, point = true }: { couleur: string; nom: string; point?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700,
      padding: point ? "2px 9px 2px 7px" : "2px 9px", borderRadius: 999,
      color: couleur, background: `${couleur}12`, border: `1px solid ${couleur}30`,
      whiteSpace: "nowrap", lineHeight: 1.4,
    }}>
      {point && <span style={{ width: 7, height: 7, borderRadius: "50%", background: couleur, flexShrink: 0 }} />}
      {nom}
    </span>
  );
}

export default function LegendeGraphe({ series, point = true, style }: {
  series: SerieLegende[]; point?: boolean; style?: React.CSSProperties;
}) {
  if (!series || series.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", ...style }}>
      {series.map((s) => <LegendeChip key={s.nom} couleur={s.couleur} nom={s.nom} point={point} />)}
    </div>
  );
}
