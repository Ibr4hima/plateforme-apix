"use client";

import React from "react";

// ── Barre de titre commune des pages publiques ────────────────────────────────
// Bleu APIX, décor discret (trame, halos, liseré lumineux), point pulsant blanc,
// emplacement pour des contrôles à côté du titre et des actions à droite.

export default function BarreTitre({ titre, children, droite }: {
  titre: React.ReactNode;
  children?: React.ReactNode;
  droite?: React.ReactNode;
}) {
  return (
    <section style={{ padding: "82px 40px 18px", background: "#004f91", position: "relative", overflow: "hidden" }}>
      <style>{`@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
@keyframes pulseDotC{0%{box-shadow:0 0 0 0 var(--pc)}70%{box-shadow:0 0 0 6px transparent}100%{box-shadow:0 0 0 0 transparent}}`}</style>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5 }}>
        {/* Trame fine estompée */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse at 75% 0%,rgba(0,0,0,0.9) 0%,transparent 72%)", WebkitMaskImage: "radial-gradient(ellipse at 75% 0%,rgba(0,0,0,0.9) 0%,transparent 72%)" }} />
        {/* Halos lumineux */}
        <div style={{ position: "absolute", top: "-140%", right: "-6%", width: 580, height: 580, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: "-160%", left: "-8%", width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(26,106,176,0.45) 0%,transparent 65%)" }} />
        {/* Liseré lumineux en bas */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.30) 50%,transparent 100%)" }} />
      </div>
      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "pulseDot 1.6s ease-out infinite", flexShrink: 0 }} />
        <h1 style={{ fontWeight: 800, fontSize: "1.3rem", color: "#fff", lineHeight: 1.2, margin: 0, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{titre}</h1>
        {children}
        {droite && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>{droite}</div>}
      </div>
    </section>
  );
}

// ── Sélecteur segmenté en verre dépoli (vues, onglets…) ───────────────────────
export function BarreTitreSegment<T extends string>({ options, value, onChange }: {
  options: { v: T; l: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 999, padding: 3, gap: 3 }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          style={{ padding: "5px 15px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: value === o.v ? "#fff" : "transparent", color: value === o.v ? "#004f91" : "rgba(255,255,255,0.85)", fontFamily: "var(--font-google-sans)", transition: "all 0.15s", whiteSpace: "nowrap" }}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ── Badge d'action en verre dépoli avec point pulsant (ex. Prochain événement) ─
export function BarreTitreBadge({ label, detail, onClick }: {
  label: string; detail?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.10)", cursor: onClick ? "pointer" : "default", minWidth: 0, maxWidth: 440, transition: "background 0.15s", fontFamily: "var(--font-google-sans)" }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = "rgba(255,255,255,0.18)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "pulseDot 1.6s ease-out infinite", flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</span>
      {detail && <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{detail}</span>}
    </button>
  );
}
