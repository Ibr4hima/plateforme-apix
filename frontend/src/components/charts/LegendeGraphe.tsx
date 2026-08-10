"use client";

// Légende commune des graphes : une rangée de pastilles (point coloré + libellé)
// qui portent l'identité des séries — jamais la couleur seule (accessibilité).
// Style unique, aligné sur les jetons du design system.

import React from "react";
import { badgeDe } from "@/lib/couleurs";

export type SerieLegende = { nom: string; couleur: string };

export function LegendeChip({ couleur, nom, point = true }: { couleur: string; nom: string; point?: boolean }) {
  // Le badge de la palette (badgeDe), et non un habillage local : pour une
  // série bleue, la pastille est alors exactement le badge_bleu du reste de la
  // plateforme. La couleur, elle, reste celle de la SÉRIE — c'est ce qui relie
  // la pastille à sa courbe, et une comparaison multi-pays s'écroulerait si
  // toutes les pastilles étaient bleues.
  return (
    <span style={{
      ...badgeDe(couleur),
      gap: point ? 6 : 0,
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
