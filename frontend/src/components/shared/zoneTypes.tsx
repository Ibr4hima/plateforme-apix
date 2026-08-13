import React from "react";

// ── Métadonnées couleur par type de zone ──────────────────────────────────────
// Source unique de vérité pour les couleurs des zones d'investissement.
// Réutilisée partout (cards, badges, modals, graphes…).
export type ZoneTypeMeta = { label: string; color: string; bg: string; border: string };

export const ZONE_TYPE_META: Record<string, ZoneTypeMeta> = {
  ZES: { label: "Zones Économiques Spéciales",           color: "var(--bleu)", bg: "rgb(var(--bleu-rgb) / 0.06)",   border: "rgb(var(--bleu-rgb) / 0.2)" },
  ZAI: { label: "Zones Aménagées pour l'Investissement", color: "var(--orange)", bg: "rgb(var(--orange-rgb) / 0.06)",  border: "rgb(var(--orange-rgb) / 0.2)" },
  ZFI: { label: "Zones Franches Industrielles",          color: "var(--vert)", bg: "rgb(var(--vert-rgb) / 0.06)",  border: "rgb(var(--vert-rgb) / 0.2)" },
};

// Ordre d'affichage canonique des types de zones.
export const ZONE_TYPE_ORDER = ["ZES", "ZAI", "ZFI"];

// Fallback gris pour un type inconnu.
export const zoneTypeMeta = (type?: string): ZoneTypeMeta =>
  (type && ZONE_TYPE_META[type]) ||
  { label: type || "", color: "var(--gris-fort)", bg: "rgb(var(--gris-rgb) / 0.06)", border: "rgb(var(--gris-rgb) / 0.2)" };

// ── Badge acronyme carré (ZES / ZAI / ZFI) ────────────────────────────────────
export function ZoneTypeBadge({ type, size = 46, radius = 12, fontSize = 11 }: {
  type: string; size?: number; radius?: number; fontSize?: number;
}) {
  const m = zoneTypeMeta(type);
  return (
    <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: m.bg, border: `1px solid ${m.border}` }}>
      <span style={{ fontSize, fontWeight: 800, letterSpacing: "0.02em", color: m.color }}>{type}</span>
    </div>
  );
}

// ── Pastille colorée selon le type (pôle, étiquette…) ─────────────────────────
export function ZonePill({ type, children, style }: {
  type?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const m = zoneTypeMeta(type);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--t-115)", fontWeight: 600, color: m.color, background: m.bg, border: `1px solid ${m.border}`, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", ...style }}>
      {children}
    </span>
  );
}
