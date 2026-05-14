"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import EntrepriseCard from "@/components/entreprises/EntrepriseCard";
import EntrepriseModal from "@/components/entreprises/EntrepriseModal";
import EntrepriseFiltres from "@/components/entreprises/EntrepriseFiltres";
import { api } from "@/lib/api";
import { Loader2, Building2 } from "lucide-react";

export default function EntreprisesPage() {
  const [entreprises,   setEntreprises]   = useState<any[]>([]);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState<any>(null);
  const [filtres,       setFiltres]       = useState({
    search: "", statut: "", secteur_id: "", branche_id: "", region: "", pays: "",
  });

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtres.search)     params.append("search",     filtres.search);
      if (filtres.statut)     params.append("statut",     filtres.statut);
      if (filtres.secteur_id) params.append("secteur_id", filtres.secteur_id);
      if (filtres.branche_id) params.append("branche_id", filtres.branche_id);
      if (filtres.region)     params.append("region",     filtres.region);
      if (filtres.pays)       params.append("pays",       filtres.pays);
      params.append("per_page", "50");

      const res = await api.entreprises.liste(params.toString());
      setEntreprises(res.data);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filtres]);

  useEffect(() => { charger(); }, [charger]);

  return (
    <main style={{ minHeight: "100vh", background: "#F2F0EF" }}>
      <Navbar />

      {/* Hero */}
      <section style={{
        padding: "100px 24px 48px",
        background: "linear-gradient(180deg, #E8E5E3 0%, #F2F0EF 100%)",
        borderBottom: "1px solid #C5BFBB",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
            Module 4
          </p>
          <h1 style={{
            fontFamily: "var(--font-google-sans)", fontWeight: 800,
            fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1a1a2e",
            lineHeight: 1.1, marginBottom: 12,
          }}>
            Entreprises Installées
          </h1>
          <p style={{ color: "#4a5568", fontSize: 15, maxWidth: 520, lineHeight: 1.7 }}>
            Cartographie des entreprises formalisées au Sénégal — localisez, filtrez
            et explorez le tissu entrepreneurial par secteur, région et activité.
          </p>
        </div>
      </section>

      {/* Contenu */}
      <section style={{ padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          <EntrepriseFiltres filtres={filtres} onChange={setFiltres} total={total} />

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 14 }}>Chargement des entreprises...</span>
              <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
            </div>
          ) : entreprises.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <Building2 size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucune entreprise trouvée</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Modifiez vos filtres pour affiner la recherche.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {entreprises.map(e => (
                <EntrepriseCard key={e.id} entreprise={e} onClick={() => setSelected(e)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {selected && <EntrepriseModal entreprise={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
