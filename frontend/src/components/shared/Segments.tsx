"use client";

// Bascule segmentée — le contrôle de navigation interne de la plateforme.
//
// IL VIT DANS `shared` ET NON DANS `admin` parce que les deux espaces s'en
// servent : l'administration pour choisir un sous-module ou un type, la page
// publique pour choisir un niveau territorial ou un secteur. Il était défini
// côté administration ; le recopier côté public aurait donné deux bascules
// presque identiques, donc deux qui divergent au premier ajustement.

import { voile } from "@/lib/couleurs";

// ── Bascule segmentée ─────────────────────────────────────────────────────────
// `n` affiche un compteur dans l'option : on voit ce que vaut un filtre avant
// de le poser (« Passés 1 » évite de cliquer pour découvrir une liste vide).
export function Segments<T extends string>({ options, value, onChange, accent = "var(--bleu)" }: {
  options: readonly { v: T; l: string; n?: number }[]; value: T; onChange: (v: T) => void; accent?: string;
}) {
  return (
    <div style={{ display: "inline-flex", background: "var(--fond)", borderRadius: 999, padding: 3, gap: 3 }}>
      {options.map(o => {
        const actif = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} aria-pressed={actif}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: o.n != null ? "6px 11px 6px 14px" : "6px 15px",
              borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
              background: actif ? "var(--carte)" : "transparent", color: actif ? accent : "var(--gris)",
              boxShadow: actif ? "0 1px 4px rgb(var(--ombre-rgb) / 0.10)" : "none", fontFamily: "var(--font-google-sans)", transition: "all 0.15s" }}>
            {o.l}
            {o.n != null && (
              <span style={{ fontSize: 10, fontWeight: 800, lineHeight: 1, padding: "3px 6px", borderRadius: 999,
                background: actif ? `${voile(accent, 8)}` : "rgb(var(--gris-rgb) / 0.16)", color: actif ? accent : "var(--gris)" }}>{o.n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
