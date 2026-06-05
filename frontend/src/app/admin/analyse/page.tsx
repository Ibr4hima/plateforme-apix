"use client";

import Sidebar from "@/components/admin/Sidebar";
import { TrendingUp } from "lucide-react";

export default function AnalyseDonneesPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "40px 48px" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(24,128,56,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={20} color="#188038" />
            </div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1a1a2e" }}>Analyse de données</h1>
          </div>
          <p style={{ fontSize: 14, color: "#9aa5b4" }}>Tableaux de bord analytiques et indicateurs avancés.</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "60px 40px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(24,128,56,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <TrendingUp size={28} color="#188038" />
          </div>
          <h2 style={{ fontWeight: 700, fontSize: "1.2rem", color: "#1a1a2e", marginBottom: 10 }}>Module en cours de développement</h2>
          <p style={{ fontSize: 14, color: "#9aa5b4", maxWidth: 420, margin: "0 auto", lineHeight: 1.7 }}>
            Cette section regroupera les outils d'analyse avancée des données de la plateforme.
          </p>
        </div>
      </main>
    </div>
  );
}
