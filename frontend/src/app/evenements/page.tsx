"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Chronogramme from "@/components/evenements/Chronogramme";
import EvenementCard from "@/components/evenements/EvenementCard";
import EvenementModal from "@/components/evenements/EvenementModal";
import { NaemaCascadeMulti } from "@/components/shared/NaemaSelects";
import { api } from "@/lib/api";
import { LayoutGrid, CalendarDays, Loader2, Search, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Vue = "grille" | "chronogramme";

const STATUT_BADGES = [
  { value: "",         label: "Tous",      bg: "#E8E5E3", text: "#4a5568"  },
  { value: "en_cours", label: "En cours",  bg: "#dcfce7", text: "#15803d"  },
  { value: "a_venir",  label: "À venir",   bg: "#dbeafe", text: "#1d4ed8"  },
  { value: "termine",  label: "Terminés",  bg: "#f3f4f6", text: "#6b7280"  },
];

const TYPES = [
  { value: "",                    label: "Tous les types"       },
  { value: "salon",               label: "Salon"                },
  { value: "forum",               label: "Forum"                },
  { value: "conference",          label: "Conférence"           },
  { value: "mission_prospection", label: "Mission"              },
  { value: "roadshow",            label: "Roadshow"             },
  { value: "b2b",                 label: "B2B"                  },
  { value: "webinaire",           label: "Webinaire"            },
  { value: "autre",               label: "Autre"                },
];

export default function EvenementsPage() {
  const [vue,          setVue]          = useState<Vue>("chronogramme");
  const [evenements,   setEvenements]   = useState<any[]>([]);
  const [chronoData,   setChronoData]   = useState<Record<string, any[]>>({});
  const [total,        setTotal]        = useState(0);
  const [stats,        setStats]        = useState<{ a_venir: number; en_cours: number; total: number }>({ a_venir: 0, en_cours: 0, total: 0 });
  const [loading,      setLoading]      = useState(true);
  const [eventSelec,   setEventSelec]   = useState<any>(null);
  const [paysHotes,    setPaysHotes]    = useState<string[]>([]);

  // Filtres
  const [search,         setSearch]         = useState("");
  const [statutFiltre,   setStatutFiltre]   = useState("");
  const [typeFiltre,     setTypeFiltre]     = useState("");
  const [paysFiltre,     setPaysFiltre]     = useState("");
  const [thematiques,    setThematiques]    = useState<string[]>([]);
  const annee = new Date().getFullYear();

  // Charger pays hôtes distincts
  useEffect(() => {
    fetch(`${API_BASE}/evenements/pays-hotes`)
      .then(r => r.json()).then(setPaysHotes).catch(() => {});
    fetch(`${API_BASE}/evenements/stats`)
      .then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)       params.append("search",         search);
      if (typeFiltre)   params.append("type_evenement", typeFiltre);
      if (statutFiltre) params.append("statut_calcule", statutFiltre);
      if (paysFiltre)   params.append("pays_nom",       paysFiltre);
      if (thematiques.length > 0) {
        thematiques.forEach(t => params.append("thematique", t));
      }
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
  }, [search, typeFiltre, statutFiltre, paysFiltre, thematiques, annee]);

  useEffect(() => { charger(); }, [charger]);

  const hasFilter = search || typeFiltre || statutFiltre || paysFiltre || thematiques.length > 0;

  const reinitialiser = () => {
    setSearch(""); setTypeFiltre(""); setStatutFiltre(""); setPaysFiltre(""); setThematiques([]);
  };

  const inputStyle = {
    background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 10, padding: "9px 12px", fontSize: 13,
    color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)",
  };

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
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "var(--font-google-sans)", fontWeight: 800,
              fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1a1a2e",
              lineHeight: 1.1,
            }}>
              Événements
            </h1>
            {/* Badge total à venir + en cours */}
            {stats.total > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {stats.en_cours > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "4px 12px", borderRadius: 999, border: "1px solid #bbf7d0" }}>
                    {stats.en_cours} en cours
                  </span>
                )}
                {stats.a_venir > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", background: "#dbeafe", padding: "4px 12px", borderRadius: 999, border: "1px solid #bfdbfe" }}>
                    {stats.a_venir} à venir
                  </span>
                )}
              </div>
            )}
          </div>
          <p style={{ color: "#4a5568", fontSize: 15, maxWidth: 520, lineHeight: 1.7, marginTop: 12 }}>
            Forums, salons, missions de prospection et rencontres B2B — agenda mondial de la promotion des investissements.
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

          {/* Filtres — seulement en vue grille */}
          {vue === "grille" && (
            <div style={{
              background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)",
              border: "1px solid #C5BFBB", borderRadius: 16,
              padding: "20px", marginBottom: 28,
            }}>
              {/* Ligne 1 : search + type + pays hôte + reset */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ position: "relative", flex: "1 1 220px" }}>
                  <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
                  <input
                    placeholder="Rechercher un événement..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ ...inputStyle, width: "100%", paddingLeft: 34, boxSizing: "border-box" as const }}
                  />
                </div>

                <select value={typeFiltre} onChange={e => setTypeFiltre(e.target.value)} style={{ ...inputStyle, cursor: "pointer", minWidth: 150 }}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                {/* Pays hôte — uniquement les pays présents en BDD */}
                <select value={paysFiltre} onChange={e => setPaysFiltre(e.target.value)} style={{ ...inputStyle, cursor: "pointer", minWidth: 150 }}>
                  <option value="">Pays hôte</option>
                  {paysHotes.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                {hasFilter && (
                  <button onClick={reinitialiser} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    <X size={12} /> Effacer
                  </button>
                )}
              </div>

              {/* Ligne 2 : badges statut calculé */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {STATUT_BADGES.map(b => (
                  <button
                    key={b.value}
                    onClick={() => setStatutFiltre(b.value)}
                    style={{
                      padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                      border: `1px solid ${statutFiltre === b.value ? b.text : "transparent"}`,
                      background: statutFiltre === b.value ? b.bg : "rgba(255,255,255,0.5)",
                      color: statutFiltre === b.value ? b.text : "#9aa5b4",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {/* Ligne 3 : thématiques NAEMA */}
              <NaemaCascadeMulti
                onChange={({ secteurs, branches, activites }) => {
                  setThematiques([...secteurs, ...branches, ...activites]);
                }}
              />
            </div>
          )}

          {/* Contenu */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 14 }}>Chargement des événements...</span>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : evenements.length === 0 && vue === "grille" ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <CalendarDays size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucun événement trouvé</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Modifiez vos filtres pour affiner la recherche.</p>
            </div>
          ) : vue === "chronogramme" ? (
            <Chronogramme
              data={chronoData}
              annee={annee}
              typeFilter={typeFiltre}
              onAnneChange={() => {}}
              onTypeChange={setTypeFiltre}
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {evenements.map(e => (
                <EvenementCard key={e.id} event={e} onClick={() => setEventSelec(e)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {eventSelec && (
        <EvenementModal event={eventSelec} onClose={() => setEventSelec(null)} />
      )}
    </main>
  );
}
