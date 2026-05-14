"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import AccordCard from "@/components/accords/AccordCard";
import AccordModal from "@/components/accords/AccordModal";
import AccordFiltres from "@/components/accords/AccordFiltres";
import { api } from "@/lib/api";
import { Loader2, FileText } from "lucide-react";

export default function AccordsPage() {
  const [accords,     setAccords]     = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [accordSelec, setAccordSelec] = useState<any>(null);
  const [filtres,     setFiltres]     = useState({
    search: "", statut: "", type_accord: "", secteur_activite: "", pays_signataires: "",
  });

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtres.search)           params.append("search",           filtres.search);
      if (filtres.statut)           params.append("statut",           filtres.statut);
      if (filtres.type_accord)      params.append("type_accord",      filtres.type_accord);
      if (filtres.secteur_activite) params.append("secteur_activite", filtres.secteur_activite);
      if (filtres.pays_signataires) params.append("pays_signataires", filtres.pays_signataires);
      params.append("per_page", "50");

      const res = await api.accords.liste(params.toString());
      setAccords(res.data);
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
          <p style={{ fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
            Module 7
          </p>
          <h1 style={{
            fontFamily: "var(--font-google-sans)", fontWeight: 800,
            fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1a1a2e",
            lineHeight: 1.1, marginBottom: 12,
          }}>
            Accords & Traités
          </h1>
          <p style={{ color: "#4a5568", fontSize: 15, maxWidth: 520, lineHeight: 1.7 }}>
            Accords internationaux de coopération économique et traités bilatéraux
            d'investissement signés par le Sénégal.
          </p>
        </div>
      </section>

      {/* Contenu */}
      <section style={{ padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          <AccordFiltres filtres={filtres} onChange={setFiltres} total={total} />

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 14 }}>Chargement des accords...</span>
              <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
            </div>
          ) : accords.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <FileText size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucun accord trouvé</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Modifiez vos filtres pour affiner la recherche.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {accords.map(a => (
                <AccordCard key={a.id} accord={a} onClick={() => setAccordSelec(a)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {accordSelec && <AccordModal accord={accordSelec} onClose={() => setAccordSelec(null)} />}
    </main>
  );
}
