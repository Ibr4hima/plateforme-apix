"use client";

import Chronogramme from "@/components/evenements/Chronogramme";
import EvenementCard from "@/components/evenements/EvenementCard";
import EvenementModal from "@/components/evenements/EvenementModal";
import FiltresEvenements from "@/components/evenements/FiltresEvenements";
import Navbar from "@/components/layout/Navbar";
import { api } from "@/lib/api";
import { CalendarDays, LayoutGrid, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Vue = "grille" | "chronogramme";

export default function EvenementsPage() {
  const [vue,         setVue]         = useState<Vue>("chronogramme");
  const [evenements,  setEvenements]  = useState<any[]>([]);
  const [chronoData,  setChronoData]  = useState<Record<string, any[]>>({});
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [eventSelec,  setEventSelec]  = useState<any>(null);
  const [annee,       setAnnee]       = useState(new Date().getFullYear());
  const [typeFilter,  setTypeFilter]  = useState("");
  const [filtres,     setFiltres]     = useState({
    search: "", type_evenement: "", statut: "", pays_nom: "",
  });

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtres.search)         params.append("search",         filtres.search);
      if (filtres.type_evenement) params.append("type_evenement", filtres.type_evenement);
      if (filtres.statut)         params.append("statut",         filtres.statut);
      if (filtres.pays_nom)       params.append("pays_nom",       filtres.pays_nom);
      params.append("per_page", "100");

      const [liste, chrono] = await Promise.all([
        api.evenements.liste(params.toString()),
        api.evenements.chronogramme(annee),
      ]);

      setEvenements(liste.data);
      setTotal(liste.total);
      setChronoData(chrono.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filtres, annee]);

  useEffect(() => { charger(); }, [charger]);

  const btnVue = (v: Vue, icon: React.ReactNode, label: string) => (
    <button onClick={() => setVue(v)} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
      fontSize: 13, fontWeight: 600,
      background: vue === v ? "#1a1a2e" : "transparent",
      color:      vue === v ? "#fff"    : "#4a5568",
      transition: "all 0.2s",
    }}>
      {icon} {label}
    </button>
  );

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
            Module 8
          </p>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1a1a2e",
            lineHeight: 1.1, marginBottom: 12,
          }}>
            Événements & Promotion
          </h1>
          <p style={{ color: "#4a5568", fontSize: 15, maxWidth: 520, lineHeight: 1.7 }}>
            Forums, salons, missions de prospection et rencontres B2B — suivez l'agenda
            mondial de la promotion des investissements au Sénégal.
          </p>
        </div>
      </section>

      {/* Contenu */}
      <section style={{ padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Toggle vue */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div style={{
              display: "flex", background: "rgba(255,255,255,0.8)",
              border: "1px solid #C5BFBB", borderRadius: 12, padding: 4, gap: 2,
            }}>
              {btnVue("chronogramme", <CalendarDays size={15} />, "Frise")}
              {btnVue("grille",       <LayoutGrid   size={15} />, "Grille")}
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 14 }}>Chargement des événements...</span>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : vue === "chronogramme" ? (
            <Chronogramme
              data={chronoData}
              annee={annee}
              typeFilter={typeFilter}
              onAnneChange={(a) => setAnnee(a)}
              onTypeChange={(t) => setTypeFilter(t)}
            />
          ) : (
            <>
              <FiltresEvenements filtres={filtres} onChange={setFiltres} total={total} />
              {evenements.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
                  <CalendarDays size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
                  <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucun événement trouvé</p>
                  <p style={{ fontSize: 14, marginTop: 6 }}>Modifiez vos filtres ou ajoutez des événements depuis l'espace admin.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {evenements.map(e => (
                    <EvenementCard key={e.id} event={e} onClick={() => setEventSelec(e)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {eventSelec && (
        <EvenementModal event={eventSelec} onClose={() => setEventSelec(null)} />
      )}
    </main>
  );
}
