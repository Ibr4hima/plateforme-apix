"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import AccordCard from "@/components/accords/AccordCard";
import AccordModal from "@/components/accords/AccordModal";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";
import PaysMultiSelect from "@/components/shared/PaysMultiSelect";
import { api } from "@/lib/api";
import { Loader2, FileText, X, ChevronDown, ChevronUp } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUT_BADGES = [
  { value: "",           label: "Tous",        bg: "#E8E5E3", text: "#4a5568" },
  { value: "en_vigueur", label: "En vigueur",  bg: "#dcfce7", text: "#15803d" },
  { value: "expire",     label: "Expirés",     bg: "#f3f4f6", text: "#6b7280" },
];

function flag(code: string) {
  try { return String.fromCodePoint(...code.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0))); }
  catch { return "🌍"; }
}

// ── Dropdown multi-sélection pays avec drapeaux ───────────────────────────────
function PaysDropdown({ selected, onToggle, color, pays }: {
  selected: string[];
  onToggle: (val: string) => void;
  color:    string;
  pays:     { nom: string; code_iso2: string }[];
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

  const selectedItems = pays.filter(p => selected.includes(p.nom));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 180 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: selected.length > 0 ? color : "#C5BFBB" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: selected.length > 0 ? color : "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
          Pays signataire
        </span>
        {selected.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "15", padding: "1px 6px", borderRadius: 999 }}>
            {selected.length}
          </span>
        )}
      </div>
      <div ref={ref} style={{ position: "relative" }}>
        <div onClick={() => setOpen(o => !o)} style={{
          ...base, display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", border: `1px solid ${open ? color : "#C5BFBB"}`, transition: "border-color 0.2s",
        }}>
          <span style={{ color: selected.length > 0 ? color : "#9aa5b4", fontWeight: selected.length > 0 ? 600 : 400 }}>
            {selected.length > 0 ? `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}` : "Sélectionner"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {selected.length > 0 && (
              <button onClick={e => { e.stopPropagation(); selected.slice().forEach(v => onToggle(v)); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <X size={12} style={{ color: "#9aa5b4" }} />
              </button>
            )}
            {open ? <ChevronUp size={14} style={{ color, flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "#9aa5b4", flexShrink: 0 }} />}
          </div>
        </div>
        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
            background: "#fff", border: `1px solid ${color}40`, borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto",
          }}>
            {pays.map(p => {
              const isSel = selected.includes(p.nom);
              return (
                <div key={p.nom} onMouseDown={e => { e.preventDefault(); onToggle(p.nom); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer",
                    background: isSel ? color + "0d" : "transparent", borderBottom: "1px solid #F8F7F6", transition: "background 0.1s" }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F8F7F6"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSel ? color + "0d" : "transparent"; }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${isSel ? color : "#C5BFBB"}`, background: isSel ? color : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isSel && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  {p.code_iso2 && <span style={{ fontSize: 16 }}>{flag(p.code_iso2)}</span>}
                  <span style={{ fontSize: 13, color: isSel ? "#1a1a2e" : "#4a5568", fontWeight: isSel ? 600 : 400 }}>{p.nom}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {selectedItems.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selectedItems.map(p => (
            <span key={p.nom} style={{ display: "inline-flex", alignItems: "center", gap: 4,
              background: color + "15", color, border: `1px solid ${color}30`,
              borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
              {p.code_iso2 && flag(p.code_iso2)} {p.nom}
              <button onClick={() => onToggle(p.nom)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <X size={10} style={{ color }} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccordsPage() {
  const [accords,      setAccords]      = useState<any[]>([]);
  const [stats,        setStats]        = useState<{ total: number; en_vigueur: number; expire: number }>({ total: 0, en_vigueur: 0, expire: 0 });
  const [loading,      setLoading]      = useState(true);
  const [accordSelec,  setAccordSelec]  = useState<any>(null);
  const [paysRef,      setPaysRef]      = useState<{ nom: string; code_iso2: string }[]>([]);
  const [nomsSecteursRef, setNomsSecteursRef] = useState<string[]>([]);

  // Filtres
  const [statutFiltre,  setStatutFiltre]  = useState("");
  const [paysFiltres,   setPaysFiltres]   = useState<string[]>([]);
  const [thematiques,   setThematiques]   = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/pays`).then(r => r.json())
      .then((data: any[]) => setPaysRef(data.map(p => ({ nom: p.nom_fr, code_iso2: p.code_iso2 })))).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r => r.json())
      .then((data: any[]) => setNomsSecteursRef(data.map(s => s.nom))).catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statutFiltre) params.append("statut", statutFiltre);
      paysFiltres.forEach(p => params.append("pays_signataires", p));

      // Thématiques — séparer par groupe pour OR intra / ET inter
      if (thematiques) {
        const items = thematiques.split(",").map((t: string) => t.trim()).filter(Boolean);
        items.filter(t => t.startsWith("sec:")).map(t => t.slice(4))
          .forEach(t => params.append("secteur", t));
        items.filter(t => t.startsWith("bra:")).map(t => t.slice(4))
          .forEach(t => params.append("branche", t));
        items.filter(t => t.startsWith("act:")).map(t => t.slice(4))
          .forEach(t => params.append("activite", t));
      }
      params.append("per_page", "100");

      const res = await api.accords.liste(params.toString());
      setAccords(res.data);
      const data = res.data as any[];
      setStats({
        total:      res.total,
        en_vigueur: data.filter(a => a.statut === "en_vigueur").length,
        expire:     data.filter(a => a.statut === "expire").length,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statutFiltre, paysFiltres, thematiques]);

  useEffect(() => { charger(); }, [charger]);

  const togglePays = (val: string) =>
    setPaysFiltres(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const hasFilter = statutFiltre || paysFiltres.length > 0 || thematiques;
  const reinitialiser = () => { setStatutFiltre(""); setPaysFiltres([]); setThematiques(""); };

  const inputStyle = {
    background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 10,
    padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none",
    fontFamily: "var(--font-google-sans)",
  };

  return (
    <main style={{ minHeight: "100vh", background: "#F2F0EF" }}>
      <Navbar />

      {/* Hero */}
      <section style={{ padding: "100px 24px 48px", background: "linear-gradient(180deg, #E8E5E3 0%, #F2F0EF 100%)", borderBottom: "1px solid #C5BFBB" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
            Module 7
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1a1a2e", lineHeight: 1.1 }}>
              Accords & Traités
            </h1>
            {stats.total > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                {stats.en_vigueur > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "4px 12px", borderRadius: 999, border: "1px solid #bbf7d0" }}>
                    {stats.en_vigueur} en vigueur
                  </span>
                )}
              </div>
            )}
          </div>
          <p style={{ color: "#4a5568", fontSize: 15, maxWidth: 520, lineHeight: 1.7, marginTop: 12 }}>
            Accords internationaux de coopération économique et traités bilatéraux d'investissement signés par le Sénégal.
          </p>
        </div>
      </section>

      {/* Contenu */}
      <section style={{ padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Filtres */}
          <div style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", border: "1px solid #C5BFBB", borderRadius: 16, padding: "20px", marginBottom: 28 }}>

            {/* Grille 3 colonnes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start", marginBottom: 16 }}>

              {/* Statut */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: statutFiltre ? "#4a5568" : "#C5BFBB" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: statutFiltre ? "#4a5568" : "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Statut</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {STATUT_BADGES.map(b => (
                    <button key={b.value} onClick={() => setStatutFiltre(b.value)} style={{
                      padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                      border: `1px solid ${statutFiltre === b.value ? b.text : "transparent"}`,
                      background: statutFiltre === b.value ? b.bg : "rgba(255,255,255,0.5)",
                      color: statutFiltre === b.value ? b.text : "#9aa5b4",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>{b.label}</button>
                  ))}
                </div>
              </div>

              {/* Pays signataire */}
              <PaysDropdown
                selected={paysFiltres}
                onToggle={togglePays}
                color="#004f91"
                pays={paysRef}
              />

              {/* Placeholder 3e colonne vide pour aligner avec ThematiquesNaema */}
              <div />
            </div>

            {/* Thématiques */}
            <ThematiquesNaema value={thematiques} onChange={setThematiques} />

            {/* Bouton effacer */}
            {hasFilter && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button onClick={reinitialiser} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <X size={12} /> Effacer tout
                </button>
              </div>
            )}
          </div>

          {/* Grille */}
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
                <AccordCard key={a.id} accord={a} onClick={() => setAccordSelec(a)} nomsSecteursRef={nomsSecteursRef} />
              ))}
            </div>
          )}
        </div>
      </section>

      {accordSelec && <AccordModal accord={accordSelec} onClose={() => setAccordSelec(null)} />}
    </main>
  );
}
