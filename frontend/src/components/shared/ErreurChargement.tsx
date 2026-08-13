"use client";

import { RefreshCw, WifiOff } from "lucide-react";

// ── État d'erreur de chargement ───────────────────────────────────────────────
// À afficher à la place du contenu quand le fetch principal d'une page ou d'un
// panneau échoue : message clair + bouton « Réessayer », au lieu d'un spinner
// infini ou d'une page vide.

export default function ErreurChargement({ onRetry, message, compact = false }: {
  onRetry: () => void;
  message?: string;
  compact?: boolean; // variante réduite pour les panneaux/modals
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: compact ? "36px 24px" : "80px 24px", textAlign: "center" }}>
      <span style={{ width: compact ? 44 : 54, height: compact ? 44 : 54, borderRadius: "50%", background: "rgb(var(--danger-rgb) / 0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <WifiOff size={compact ? 19 : 23} style={{ color: "var(--danger)" }} />
      </span>
      <div>
        <p style={{ fontSize: compact ? "var(--t-14)" : "var(--t-16)", fontWeight: 700, color: "var(--encre)", margin: 0 }}>
          {message || "Impossible de charger les données"}
        </p>
        <p style={{ fontSize: compact ? "var(--t-12)" : "var(--t-13)", color: "var(--gris)", margin: "6px 0 0" }}>
          Vérifiez votre connexion, puis réessayez.
        </p>
      </div>
      <button onClick={onRetry}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: compact ? "8px 18px" : "10px 22px", borderRadius: 10, border: "none", background: "var(--bleu-action)", color: "var(--sur-bleu)", fontSize: compact ? "var(--t-12)" : "var(--t-13)", fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px rgb(var(--ombre-rgb) / 0.25)", fontFamily: "var(--font-google-sans)", transition: "transform 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
        <RefreshCw size={13} /> Réessayer
      </button>
    </div>
  );
}
