"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import EntrepriseCard from "@/components/entreprises/EntrepriseCard";
import EntrepriseModal from "@/components/entreprises/EntrepriseModal";
import ThematiquesNaema from "@/components/shared/ThematiquesNaema";
import LocalisationCascade from "@/components/shared/LocalisationCascade";
import { api } from "@/lib/api";
import { Loader2, Building2, Search, X, ChevronDown, ChevronUp } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Recherche/choix entreprise ────────────────────────────────────────────────
function SearchEntrepriseDropdown({ options, selected, onToggle, search, onSearch }: {
  options: string[]; selected: string[]; onToggle: (v: string) => void;
  search: string; onSearch: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const hasVal   = search || selected.length > 0;

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div style={{ position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4", zIndex: 1 }} />
        <input
          placeholder="Rechercher ou choisir une entreprise..."
          value={search}
          onChange={e => { onSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          style={{
            background: "#F2F0EF", border: `1px solid ${open ? "#ca631f" : "#C5BFBB"}`,
            borderRadius: 10, padding: "8px 32px 8px 30px", fontSize: 13, color: "#1a1a2e",
            outline: "none", width: "100%", boxSizing: "border-box" as const,
            fontFamily: "var(--font-google-sans)", transition: "border-color 0.2s",
          }}
        />
        {hasVal
          ? <button onMouseDown={e => { e.preventDefault(); onSearch(""); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}><X size={13} style={{ color: "#9aa5b4" }} /></button>
          : <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4", pointerEvents: "none" }} />
        }
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
          background: "#fff", border: "1px solid rgba(202,99,31,0.4)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 240, overflowY: "auto" }}>
          {filtered.length === 0
            ? <div style={{ padding: "12px 14px", fontSize: 13, color: "#9aa5b4" }}>Aucune entreprise trouvée</div>
            : filtered.map(opt => {
                const isSel = selected.includes(opt);
                return (
                  <div key={opt} onMouseDown={e => { e.preventDefault(); onToggle(opt); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                      cursor: "pointer", background: isSel ? "rgba(202,99,31,0.06)" : "transparent",
                      borderBottom: "1px solid #F2F0EF", fontSize: 13, color: isSel ? "#1a1a2e" : "#4a5568", fontWeight: isSel ? 600 : 400 }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F8F7F6"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSel ? "rgba(202,99,31,0.06)" : "transparent"; }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${isSel ? "#ca631f" : "#C5BFBB"}`, background: isSel ? "#ca631f" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isSel && <svg width="8" height="6" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    {opt}
                  </div>
                );
              })
          }
        </div>
      )}
      {/* Tags sélections */}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {selected.map(nom => (
            <span key={nom} style={{ display: "inline-flex", alignItems: "center", gap: 4,
              background: "rgba(202,99,31,0.1)", color: "#ca631f", border: "1px solid rgba(202,99,31,0.2)",
              borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
              {nom}
              <button onClick={() => onToggle(nom)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={10} style={{ color: "#ca631f" }} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dropdown formes juridiques ─────────────────────────────────────────────────
function FormesDropdown({ options, selected, onToggle }: {
  options: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const color = "#004f91";

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const base = { background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", width: "100%", boxSizing: "border-box" as const };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: selected.length > 0 ? color : "#C5BFBB" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: selected.length > 0 ? color : "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Forme juridique</span>
        {selected.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "15", padding: "1px 6px", borderRadius: 999 }}>{selected.length}</span>}
      </div>
      <div ref={ref} style={{ position: "relative" }}>
        <div onClick={() => setOpen(o => !o)} style={{ ...base, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", border: `1px solid ${open ? color : "#C5BFBB"}`, transition: "border-color 0.2s" }}>
          <span style={{ color: selected.length > 0 ? color : "#9aa5b4", fontWeight: selected.length > 0 ? 600 : 400 }}>
            {selected.length > 0 ? `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}` : "Sélectionner"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {selected.length > 0 && <button onClick={e => { e.stopPropagation(); selected.slice().forEach(v => onToggle(v)); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={12} style={{ color: "#9aa5b4" }} /></button>}
            {open ? <ChevronUp size={14} style={{ color, flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "#9aa5b4", flexShrink: 0 }} />}
          </div>
        </div>
        {open && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
            background: "#fff", border: `1px solid ${color}40`, borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto" }}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #F2F0EF", position: "sticky", top: 0, background: "#fff" }}>
              <input autoFocus placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...base, fontSize: 12, padding: "7px 10px" }} />
            </div>
            {filtered.map(opt => {
              const isSel = selected.includes(opt);
              return (
                <div key={opt} onMouseDown={e => { e.preventDefault(); onToggle(opt); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer",
                    background: isSel ? color + "0d" : "transparent", borderBottom: "1px solid #F8F7F6", transition: "background 0.1s" }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F8F7F6"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSel ? color + "0d" : "transparent"; }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${isSel ? color : "#C5BFBB"}`, background: isSel ? color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}>
                    {isSel && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{ fontSize: 12, color: isSel ? "#1a1a2e" : "#4a5568", fontWeight: isSel ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opt}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map(f => (
            <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: color + "15", color, border: `1px solid ${color}30`, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
              {f.split("(")[0].trim()}
              <button onClick={() => onToggle(f)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={10} style={{ color }} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EntreprisesPage() {
  const [entreprises, setEntreprises] = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<any>(null);
  const [nomOptions,  setNomOptions]  = useState<string[]>([]);
  const [formeOptions,setFormeOptions]= useState<string[]>([]);

  // Filtres
  const [search,         setSearch]         = useState("");
  const [selectedNoms,   setSelectedNoms]   = useState<string[]>([]);
  const [selectedFormes, setSelectedFormes] = useState<string[]>([]);
  const [thematiques,    setThematiques]    = useState("");
  const [localisation,   setLocalisation]   = useState({
    regions: [] as number[], departements: [] as number[], arrondissements: [] as number[],
    regionNoms: [] as string[], departementNoms: [] as string[], arrondissementNoms: [] as string[],
  });

  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/formes-juridiques`).then(r => r.json()).then(d => setFormeOptions(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/noms`).then(r => r.json()).then(d => setNomOptions(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)                                  params.append("search", search);
      selectedNoms.forEach(n               =>      params.append("nom_list", n));
      selectedFormes.forEach(f             =>      params.append("forme_juridique", f));
      localisation.regionNoms.forEach(r    =>      params.append("region_noms", r));
      localisation.departementNoms.forEach(d =>    params.append("departement_noms", d));
      localisation.arrondissementNoms.forEach(a => params.append("arrondissement_noms", a));

      // Thématiques — OR intra-groupe, ET inter-groupes
      if (thematiques) {
        const items = thematiques.split(",").map((t: string) => t.trim()).filter(Boolean);
        items.filter(t => t.startsWith("sec:")).map(t => t.slice(4)).forEach(t => params.append("secteur_nom", t));
        items.filter(t => t.startsWith("bra:")).map(t => t.slice(4)).forEach(t => params.append("branche_nom", t));
        items.filter(t => t.startsWith("act:")).map(t => t.slice(4)).forEach(t => params.append("activite_nom", t));
      }
      params.append("per_page", "100");

      const res = await api.entreprises.liste(params.toString());
      setEntreprises(res.data);
      setTotal(res.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, selectedNoms, selectedFormes, thematiques, localisation]);

  useEffect(() => { charger(); }, [charger]);

  const toggleNom   = (v: string) => setSelectedNoms(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleForme = (v: string) => setSelectedFormes(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const hasFilter = search || selectedNoms.length > 0 || selectedFormes.length > 0 || thematiques ||
    localisation.regionNoms.length > 0 || localisation.departementNoms.length > 0 || localisation.arrondissementNoms.length > 0;

  const reinitialiser = () => {
    setSearch(""); setSelectedNoms([]); setSelectedFormes([]); setThematiques("");
    setLocalisation({ regions: [], departements: [], arrondissements: [], regionNoms: [], departementNoms: [], arrondissementNoms: [] });
  };

  return (
    <main style={{ minHeight: "100vh", background: "#F2F0EF" }}>
      <Navbar />

      {/* Hero */}
      <section style={{ padding: "100px 24px 48px", background: "linear-gradient(180deg, #E8E5E3 0%, #F2F0EF 100%)", borderBottom: "1px solid #C5BFBB" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>Module 4</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1a1a2e", lineHeight: 1.1 }}>
              Entreprises Installées
            </h1>
            {total > 0 && <span style={{ fontFamily: "var(--font-google-sans)", fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", color: "#ca631f", lineHeight: 1.1 }}>{total}</span>}
          </div>
          <p style={{ color: "#4a5568", fontSize: 15, maxWidth: 520, lineHeight: 1.7, marginTop: 12 }}>
            Cartographie des entreprises formalisées au Sénégal.
          </p>
        </div>
      </section>

      <section style={{ padding: "32px 24px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Filtres */}
          <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", border: "1px solid #C5BFBB", borderRadius: 16, padding: "20px", marginBottom: 20 }}>

            {/* Ligne 1 : Recherche + Forme juridique */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: (search || selectedNoms.length > 0) ? "#ca631f" : "#C5BFBB" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: (search || selectedNoms.length > 0) ? "#ca631f" : "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                    Entreprise(s)
                  </span>
                  {selectedNoms.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#ca631f", background: "rgba(202,99,31,0.1)", padding: "1px 6px", borderRadius: 999 }}>{selectedNoms.length}</span>
                  )}
                </div>
                <SearchEntrepriseDropdown options={nomOptions} selected={selectedNoms} onToggle={toggleNom} search={search} onSearch={setSearch} />
              </div>
              <FormesDropdown options={formeOptions} selected={selectedFormes} onToggle={toggleForme} />
            </div>

            {/* Thématiques */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: thematiques ? "#ca631f" : "#C5BFBB", display: "inline-block" }} />
                  Thématiques
                </span>
              </p>
              <ThematiquesNaema value={thematiques} onChange={setThematiques} />
            </div>

            {/* Localisation */}
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: localisation.regionNoms.length > 0 ? "#004f91" : "#C5BFBB", display: "inline-block" }} />
                  Localisation
                </span>
              </p>
              <LocalisationCascade value={localisation} onChange={setLocalisation} />
            </div>

            {/* Bouton effacer */}
            {hasFilter && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button onClick={reinitialiser} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <X size={12} /> Effacer tout
                </button>
              </div>
            )}
          </div>

          {/* Résultats */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, gap: 12, color: "#9aa5b4" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
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
