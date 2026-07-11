"use client";

import React from "react";

// ── Squelettes de chargement ──────────────────────────────────────────────────
// Placeholders gris pulsants aux dimensions du contenu final : pas de spinner,
// pas de décalage de mise en page quand les données arrivent.

const PULSE_CSS = `@keyframes skPulse{0%,100%{opacity:1}50%{opacity:0.45}}`;

// Bloc de base — dimensions libres
export function Skeleton({ w, h, r = 8, style }: {
  w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties;
}) {
  return (
    <>
      <style>{PULSE_CSS}</style>
      <div style={{ width: w ?? "100%", height: h ?? 14, borderRadius: r, background: "#ECEAE7", animation: "skPulse 1.4s ease-in-out infinite", ...style }} />
    </>
  );
}

// Rangée de cartes KPI (mêmes proportions que les cartes réelles)
export function SkeletonKPIs({ n = 5, height = 96 }: { n?: number; height?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${n},1fr)`, gap: 12 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 14, padding: "14px 16px", height, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <Skeleton w="60%" h={9} r={4} />
          <Skeleton w="80%" h={20} r={6} />
          <Skeleton w="45%" h={8} r={4} />
        </div>
      ))}
    </div>
  );
}

// Carte graphe (en-tête + zone de tracé)
export function SkeletonChart({ height = 300 }: { height?: number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 14, padding: "16px 18px", boxSizing: "border-box" }}>
      <Skeleton w={180} h={11} r={4} style={{ marginBottom: 8 }} />
      <Skeleton w={120} h={8} r={4} style={{ marginBottom: 16 }} />
      <Skeleton w="100%" h={height - 80} r={10} />
    </div>
  );
}

// Grille de cartes graphes
export function SkeletonChartGrid({ n = 2, cols = 2, height = 300 }: { n?: number; cols?: number; height?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 14 }}>
      {Array.from({ length: n }).map((_, i) => <SkeletonChart key={i} height={height} />)}
    </div>
  );
}

// Lignes de tableau
export function SkeletonRows({ n = 8, h = 38 }: { n?: number; h?: number }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} h={h} r={8} />)}
    </div>
  );
}

// Grille de cartes (listes publiques : événements, accords, zones…)
export function SkeletonCards({ n = 6, cols = 3, height = 190 }: { n?: number; cols?: number; height?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 16 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #ECEAE7", borderRadius: 14, padding: 18, height, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton w="55%" h={12} r={5} />
          <Skeleton w="85%" h={9} r={4} />
          <Skeleton w="70%" h={9} r={4} />
          <div style={{ flex: 1 }} />
          <Skeleton w="40%" h={9} r={4} />
        </div>
      ))}
    </div>
  );
}
