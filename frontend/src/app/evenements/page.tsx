"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import EvenementCard from "@/components/evenements/EvenementCard";
import EvenementModal from "@/components/evenements/EvenementModal";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";
import { api } from "@/lib/api";
import { CalendarDays, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Drapeau depuis code ISO2 ──────────────────────────────────────────────────
function flag(code: string) {
  try { return String.fromCodePoint(...code.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0))); }
  catch { return "🌍"; }
}

// ── Dropdown multi-sélection générique ───────────────────────────────────────
function MultiDropdownFilter({
  label, placeholder, selected, onToggle, color, items,
}: {
  label:       string;
  placeholder: string;
  selected:    string[];
  onToggle:    (val: string) => void;
  color:       string;
  items:       { value: string; label: string; flag?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const base = {
    background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8,
    padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none",
    fontFamily: "var(--font-google-sans)", width: "100%", boxSizing: "border-box" as const,
  };

  const selectedLabels = items.filter(i => selected.includes(i.value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 }}>
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: selected.length > 0 ? color : "#C5BFBB", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: selected.length > 0 ? color : "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
          {label}
        </span>
        {selected.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "15", padding: "1px 6px", borderRadius: 999 }}>
            {selected.length}
          </span>
        )}
      </div>

      <div ref={ref} style={{ position: "relative" }}>
        {/* Trigger */}
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            ...base, display: "flex", alignItems: "center",
            justifyContent: "space-between", cursor: "pointer",
            border: `1px solid ${open ? color : "#C5BFBB"}`,
            transition: "border-color 0.2s",
          }}
        >
          <span style={{ color: selected.length > 0 ? color : "#9aa5b4", fontWeight: selected.length > 0 ? 600 : 400 }}>
            {selected.length > 0 ? `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}` : placeholder}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {selected.length > 0 && (
              <button
                onClick={e => { e.stopPropagation(); selected.slice().forEach(v => onToggle(v)); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
              >
                <X size={12} style={{ color: "#9aa5b4" }} />
              </button>
            )}
            {open ? <ChevronUp size={14} style={{ color, flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "#9aa5b4", flexShrink: 0 }} />}
          </div>
        </div>

        {/* Dropdown */}
        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
            background: "#fff", border: `1px solid ${color}40`, borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto",
          }}>
            {items.map(item => {
              const isSel = selected.includes(item.value);
              return (
                <div
                  key={item.value}
                  onMouseDown={e => { e.preventDefault(); onToggle(item.value); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", cursor: "pointer",
                    background: isSel ? color + "0d" : "transparent",
                    borderBottom: "1px solid #F8F7F6", transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F8F7F6"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSel ? color + "0d" : "transparent"; }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${isSel ? color : "#C5BFBB"}`,
                    background: isSel ? color : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.12s",
                  }}>
                    {isSel && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  {item.flag && <span style={{ fontSize: 16 }}>{item.flag}</span>}
                  <span style={{ fontSize: 13, color: isSel ? "#1a1a2e" : "#4a5568", fontWeight: isSel ? 600 : 400 }}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tags des sélections */}
      {selectedLabels.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selectedLabels.map(item => (
            <span key={item.value} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: color + "15", color, border: `1px solid ${color}30`,
              borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600,
            }}>
              {item.flag && <span>{item.flag}</span>}
              {item.label}
              <button
                onClick={() => onToggle(item.value)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
              >
                <X size={10} style={{ color }} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [evenements,   setEvenements]   = useState<any[]>([]);
  const [stats,        setStats]        = useState<{ a_venir: number; en_cours: number; total: number }>({ a_venir: 0, en_cours: 0, total: 0 });
  const [loading,      setLoading]      = useState(true);
  const [eventSelec,   setEventSelec]   = useState<any>(null);
  const [paysHotes,    setPaysHotes]    = useState<{ nom: string; code_iso2: string }[]>([]);
  const [nomsSecteursRef, setNomsSecteursRef] = useState<string[]>([]);

  // Filtres
  const [statutFiltre, setStatutFiltre] = useState("");
  const [typeFiltres,  setTypeFiltres]  = useState<string[]>([]);
  const [paysFiltres,  setPaysFiltres]  = useState<string[]>([]);
  const [thematiques,  setThematiques]  = useState("");

  useEffect(() => {
    // Charger les pays hôtes distincts + la ref pays pour avoir les codes ISO2
    Promise.all([
      fetch(`${API_BASE}/evenements/pays-hotes`).then(r => r.json()),
      fetch(`${API_BASE}/entreprises/ref/pays`).then(r => r.json()),
    ]).then(([hotes, refPays]: [string[], any[]]) => {
      const enrichis = hotes.map((nom: string) => {
        const ref = refPays.find((p: any) => p.nom_fr === nom);
        return { nom, code_iso2: ref?.code_iso2 || "" };
      });
      setPaysHotes(enrichis);
    }).catch(() => {});
    fetch(`${API_BASE}/evenements/stats`)
      .then(r => r.json()).then(setStats).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/secteurs`)
      .then(r => r.json()).then((data: any[]) => setNomsSecteursRef(data.map(s => s.nom))).catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statutFiltre) params.append("statut_calcule", statutFiltre);
      typeFiltres.forEach(t => params.append("type_evenement", t));
      paysFiltres.forEach(p => params.append("pays_nom", p));
      if (thematiques) {
        thematiques.split(",").map((t: string) => t.trim()).filter(Boolean)
          .forEach((t: string) => params.append("thematique", t));
      }
      params.append("per_page", "100");

      const liste = await api.evenements.liste(params.toString());
      setEvenements(liste.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [typeFiltres, statutFiltre, paysFiltres, thematiques]);

  useEffect(() => { charger(); }, [charger]);

  const hasFilter = typeFiltres.length > 0 || statutFiltre || paysFiltres.length > 0 || thematiques;

  const reinitialiser = () => {
    setTypeFiltres([]); setStatutFiltre(""); setPaysFiltres([]); setThematiques("");
  };

  const toggleType = (val: string) =>
    setTypeFiltres(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const togglePays = (val: string) =>
    setPaysFiltres(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const inputStyle = {
    background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 10, padding: "9px 12px", fontSize: 13,
    color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)",
  };

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

          {/* Filtres */}
          <div style={{
            background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)",
            border: "1px solid #C5BFBB", borderRadius: 16,
            padding: "20px", marginBottom: 28,
          }}>
            {/* Grille filtres — 3 colonnes alignées */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start", marginBottom: 16 }}>

              {/* Colonne 1 : Statut */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: statutFiltre ? "#4a5568" : "#C5BFBB" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: statutFiltre ? "#4a5568" : "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Statut</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {STATUT_BADGES.map(b => (
                    <button
                      key={b.value}
                      onClick={() => setStatutFiltre(b.value)}
                      style={{
                        padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
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
              </div>

              {/* Colonne 2 : Type */}
              <MultiDropdownFilter
                label="Type d'événement"
                placeholder="Sélectionner"
                selected={typeFiltres}
                onToggle={toggleType}
                color="#004f91"
                items={TYPES.filter(t => t.value !== "").map(t => ({ value: t.value, label: t.label }))}
              />

              {/* Colonne 3 : Pays hôte */}
              <MultiDropdownFilter
                label="Pays hôte"
                placeholder="Sélectionner"
                selected={paysFiltres}
                onToggle={togglePays}
                color="#ca631f"
                items={paysHotes.map(p => ({
                  value: p.nom,
                  label: p.nom,
                  flag: p.code_iso2 ? flag(p.code_iso2) : undefined,
                }))}
              />
            </div>

            {/* Bouton effacer */}
            {hasFilter && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                <button onClick={reinitialiser} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <X size={12} /> Effacer tout
                </button>
              </div>
            )}

            {/* Ligne 5 : Thématiques cascade horizontale */}
            <ThematiquesNaema
              value={thematiques}
              onChange={val => setThematiques(val)}
            />
          </div>

          {/* Grille */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 14 }}>Chargement des événements...</span>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : evenements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <CalendarDays size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucun événement trouvé</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Modifiez vos filtres pour affiner la recherche.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {evenements.map(e => (
                <EvenementCard key={e.id} event={e} onClick={() => setEventSelec(e)} nomsSecteursRef={nomsSecteursRef} />
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
