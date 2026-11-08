"use client";

// Légende commune des graphes : pour chaque série, une clé de son dessin — un
// trait pour une courbe, un carré pour des barres — et son nom, à l'encre.
// L'identité ne repose jamais sur la couleur seule, et un nom n'est jamais
// écrit dans la couleur de sa série : les teintes claires (le jaune) ne se
// lisent pas en texte. Classes .graphe-legende* de globals.css.

import React from "react";

export type SerieLegende = { nom: string; couleur: string };

export default function LegendeGraphe({ series, forme = "ligne", style }: {
  series: SerieLegende[];
  forme?: "ligne" | "barre";
  /** Conservé pour les appels existants : la clé suit désormais `forme`. */
  point?: boolean;
  style?: React.CSSProperties;
}) {
  if (!series || series.length === 0) return null;
  return (
    <div className="graphe-legende" style={style}>
      {series.map(s => (
        <span key={s.nom} className="graphe-legende-item">
          <span aria-hidden className={`graphe-legende-cle${forme === "barre" ? " est-barre" : ""}`} style={{ background: s.couleur }} />
          {s.nom}
        </span>
      ))}
    </div>
  );
}
