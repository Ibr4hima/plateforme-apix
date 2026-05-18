"use client";

import { Layers } from "lucide-react";

export default function GestionZonesPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F2F0EF", fontFamily: "var(--font-google-sans)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 480, padding: "0 24px" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(14,116,144,0.1)", border: "2px solid rgba(14,116,144,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <Layers size={32} style={{ color: "#0e7490" }} />
        </div>
        <h1 style={{ fontWeight: 800, fontSize: "1.75rem", color: "#1a1a2e", marginBottom: 12 }}>
          Gestion des zones et des pôles
        </h1>
        <p style={{ fontSize: 15, color: "#9aa5b4", lineHeight: 1.7, marginBottom: 32 }}>
          Ce module est en cours de développement.<br />
          Il permettra de gérer l'ensemble des zones économiques et des pôles d'investissement du Sénégal.
        </p>
        <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: "#0e7490", background: "rgba(14,116,144,0.1)", padding: "6px 16px", borderRadius: 999, border: "1px solid rgba(14,116,144,0.2)" }}>
          Bientôt disponible
        </span>
      </div>
    </div>
  );
}
