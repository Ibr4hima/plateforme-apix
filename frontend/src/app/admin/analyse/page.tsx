"use client";

import Sidebar from "@/components/admin/Sidebar";
import { TrendingUp } from "lucide-react";

export default function AnalyseDonneesPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--carte-douce)" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "40px 48px" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgb(var(--vert-rgb) / 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={20} color="var(--vert)" />
            </div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--encre)" }}>Analyse de données</h1>
          </div>
          <p style={{ fontSize: 14, color: "var(--gris)" }}>Tableaux de bord analytiques et indicateurs avancés.</p>
        </div>

        <div style={{ background: "var(--carte)", borderRadius: 16, border: "1px solid var(--bleu-voile)", padding: "60px 40px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgb(var(--vert-rgb) / 0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <TrendingUp size={28} color="var(--vert)" />
          </div>
          <h2 style={{ fontWeight: 700, fontSize: "1.2rem", color: "var(--encre)", marginBottom: 10 }}>Module en cours de développement</h2>
          <p style={{ fontSize: 14, color: "var(--gris)", maxWidth: 420, margin: "0 auto", lineHeight: 1.7 }}>
            Cette section regroupera les outils d'analyse avancée des données de la plateforme.
          </p>
        </div>
      </main>
    </div>
  );
}
