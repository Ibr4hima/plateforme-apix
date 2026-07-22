"use client";

// Mini-tendance (sparkline) pour les cartes KPI : une courbe compacte à côté
// du chiffre, sans axes ni légende. Décoratif — la valeur et le delta portent
// l'information ; ici on ne montre que la forme de l'évolution.
//
// SVG pur (pas de dépendance). La couleur suit le sens : dernière variation
// positive → succès, négative → danger ; sinon la teinte passée en `couleur`.

import React from "react";

export default function Sparkline({
  data, couleur = "#004f91", largeur = 72, hauteur = 24, remplissage = true, sens = true, strokeWidth = 1.6,
}: {
  data: (number | null | undefined)[];
  couleur?: string;
  largeur?: number;
  hauteur?: number;
  remplissage?: boolean;
  sens?: boolean;        // colore selon la tendance (dernier vs premier point)
  strokeWidth?: number;
}) {
  const pts = data.filter((v): v is number => v != null && isFinite(v));
  if (pts.length < 2) return <span style={{ display: "inline-block", width: largeur, height: hauteur }} />;

  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const pad = strokeWidth + 1;
  const w = largeur, h = hauteur;
  const x = (i: number) => (pts.length === 1 ? w / 2 : (i / (pts.length - 1)) * (w - pad * 2) + pad);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);

  const trace = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const aire = `${trace} L ${x(pts.length - 1).toFixed(1)} ${h} L ${x(0).toFixed(1)} ${h} Z`;

  // Couleur selon le sens de la tendance
  const delta = pts[pts.length - 1] - pts[0];
  const col = sens ? (delta > 0 ? "#188038" : delta < 0 ? "#dc2626" : couleur) : couleur;
  const gid = `spark-${col.replace("#", "")}-${largeur}x${hauteur}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      {remplissage && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={col} stopOpacity="0.18" />
              <stop offset="100%" stopColor={col} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={aire} fill={`url(#${gid})`} />
        </>
      )}
      <path d={trace} fill="none" stroke={col} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r={strokeWidth + 0.8} fill={col} />
    </svg>
  );
}
