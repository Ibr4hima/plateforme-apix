"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import EntrepriseCard from "@/components/entreprises/EntrepriseCard";
import EntrepriseModal from "@/components/entreprises/EntrepriseModal";
import { NaemaCascadeMulti } from "@/components/shared/NaemaSelects";
import { GeoCascadeMulti } from "@/components/shared/GeoCascadeMulti";
import { api } from "@/lib/api";
import { Loader2, Building2, Search, X, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
    <div ref={ref} style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
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
        {hasVal && (
          <button
            onMouseDown={e => { e.preventDefault(); onSearch(""); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
          >
            <X size={13} style={{ color: "#9aa5b4" }} />
          </button>
        )}
        {!hasVal && (
          <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4", pointerEvents: "none" }} />
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: "#fff", border: "1px solid rgba(202,99,31,0.4)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 240, overflowY: "auto",
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "#9aa5b4" }}>Aucune entreprise trouvée</div>
          ) : filtered.map(opt => {
            const isSel = selected.includes(opt);
            return (
              <div
                key={opt}
                onMouseDown={e => { e.preventDefault(); onToggle(opt); setOpen(false); onSearch(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                  cursor: "pointer", background: isSel ? "rgba(202,99,31,0.06)" : "transparent",
                  borderBottom: "1px solid #F2F0EF", fontSize: 13,
                  color: isSel ? "#1a1a2e" : "#4a5568", fontWeight: isSel ? 600 : 400,
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F8F7F6"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isSel ? "rgba(202,99,31,0.06)" : "transparent"; }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${isSel ? "#ca631f" : "#C5BFBB"}`,
                  background: isSel ? "#ca631f" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isSel && <svg width="8" height="6" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Dropdown multi-select générique pour formes juridiques
function MultiSelectDropdown({
  options, selected, onToggle, placeholder, color = "#ca631f",
}: {
  options: string[]; selected: string[]; onToggle: (v: string) => void;
  placeholder: string; color?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const inputStyle = {
    background: "#F2F0EF", border: `1px solid ${open ? color : "#C5BFBB"}`,
    borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#1a1a2e",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    cursor: "pointer", transition: "border-color 0.2s", userSelect: "none" as const,
    minWidth: 160,
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen(o => !o)} style={inputStyle}>
        <span style={{ color: selected.length ? color : "#9aa5b4", fontWeight: selected.length ? 600 : 400 }}>
          {selected.length > 0 ? `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}` : placeholder}
        </span>
        {open ? <ChevronUp size={13} style={{ color }} /> : <ChevronDown size={13} style={{ color: "#9aa5b4" }} />}
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "100%", zIndex: 100,
          background: "#fff", border: `1px solid ${color}40`, borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto",
        }}>
          {options.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "#9aa5b4" }}>Aucune option</div>
          ) : options.map(opt => {
            const isSel = selected.includes(opt);
            return (
              <div
                key={opt}
                onMouseDown={e => { e.preventDefault(); onToggle(opt); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                  cursor: "pointer", background: isSel ? color + "0d" : "transparent",
                  borderBottom: "1px solid #F2F0EF", fontSize: 13,
                  color: isSel ? "#1a1a2e" : "#4a5568", fontWeight: isSel ? 600 : 400,
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F8F7F6"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isSel ? color + "0d" : "transparent"; }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${isSel ? color : "#C5BFBB"}`,
                  background: isSel ? color : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isSel && <svg width="8" height="6" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>{opt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "rgba(202,99,31,0.1)", color: "#ca631f",
      border: "1px solid rgba(202,99,31,0.2)", borderRadius: 999,
      padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {label}
      <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
        <X size={10} style={{ color: "#ca631f" }} />
      </button>
    </span>
  );
}

export default function EntreprisesPage() {
  const [entreprises,    setEntreprises]    = useState<any[]>([]);
  const [total,          setTotal]          = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [selected,       setSelected]       = useState<any>(null);
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [nomOptions,     setNomOptions]     = useState<string[]>([]);
  const [formeOptions,   setFormeOptions]   = useState<string[]>([]);

  // Filtres
  const [search,          setSearch]          = useState("");
  const [selectedNoms,    setSelectedNoms]    = useState<string[]>([]);
  const [selectedFormes,  setSelectedFormes]  = useState<string[]>([]);
  const [naema,           setNaema]           = useState<{ secteurs: string[]; branches: string[]; activites: string[] }>({ secteurs: [], branches: [], activites: [] });
  const [geo,             setGeo]             = useState<{ regions: string[]; departements: string[]; arrondissements: string[] }>({ regions: [], departements: [], arrondissements: [] });

  // Charger les options depuis la BDD
  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/formes-juridiques`)
      .then(r => r.json()).then(d => setFormeOptions(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Charger noms d'entreprises pour le multi-select
  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/noms`)
      .then(r => r.json())
      .then(d => setNomOptions(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)                      params.append("search",              search);
      if (selectedNoms.length)         selectedNoms.forEach(n => params.append("search", n));
      if (selectedFormes.length)       params.append("forme_juridique",     selectedFormes.join(","));
      if (naema.secteurs.length)       params.append("secteur_nom",         naema.secteurs.join(","));
      if (naema.branches.length)       params.append("branche_nom",         naema.branches.join(","));
      if (naema.activites.length)      params.append("activite_nom",        naema.activites.join(","));
      if (geo.regions.length)          params.append("region_noms",         geo.regions.join(","));
      if (geo.departements.length)     params.append("departement_noms",    geo.departements.join(","));
      if (geo.arrondissements.length)  params.append("arrondissement_noms", geo.arrondissements.join(","));
      params.append("per_page", "50");

      const res = await api.entreprises.liste(params.toString());
      setEntreprises(res.data);
      setTotal(res.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, selectedNoms, selectedFormes, naema, geo]);

  useEffect(() => { charger(); }, [charger]);

  const toggleNom   = (v: string) => setSelectedNoms(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleForme = (v: string) => setSelectedFormes(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const allTags = [
    ...selectedNoms.map(n    => ({ label: n,    onRemove: () => toggleNom(n)   })),
    ...selectedFormes.map(f  => ({ label: f.split("(")[0].trim(), onRemove: () => toggleForme(f) })),
    ...naema.secteurs.map(s  => ({ label: s,    onRemove: () => setNaema(p => ({ ...p, secteurs:  p.secteurs.filter(x => x !== s)  })) })),
    ...naema.branches.map(b  => ({ label: b,    onRemove: () => setNaema(p => ({ ...p, branches:  p.branches.filter(x => x !== b)  })) })),
    ...naema.activites.map(a => ({ label: a,    onRemove: () => setNaema(p => ({ ...p, activites: p.activites.filter(x => x !== a) })) })),
    ...geo.regions.map(r     => ({ label: r,    onRemove: () => setGeo(p => ({ ...p, regions:        p.regions.filter(x => x !== r)        })) })),
    ...geo.departements.map(d => ({ label: d,   onRemove: () => setGeo(p => ({ ...p, departements:   p.departements.filter(x => x !== d)   })) })),
    ...geo.arrondissements.map(a => ({ label: a,onRemove: () => setGeo(p => ({ ...p, arrondissements:p.arrondissements.filter(x => x !== a) })) })),
  ];

  const reinitialiser = () => {
    setSearch(""); setSelectedNoms([]); setSelectedFormes([]);
    setNaema({ secteurs: [], branches: [], activites: [] });
    setGeo({ regions: [], departements: [], arrondissements: [] });
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
            Module 4
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{
              fontFamily: "var(--font-google-sans)", fontWeight: 800,
              fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1a1a2e", lineHeight: 1.1,
            }}>
              Entreprises Installées
            </h1>
            {total > 0 && (
              <span style={{
                fontFamily: "var(--font-google-sans)", fontWeight: 800,
                fontSize: "clamp(2rem, 4vw, 3rem)", color: "#ca631f", lineHeight: 1.1,
              }}>
                {total}
              </span>
            )}
          </div>
          <p style={{ color: "#4a5568", fontSize: 15, maxWidth: 520, lineHeight: 1.7, marginTop: 12 }}>
            Cartographie des entreprises formalisées au Sénégal.
          </p>
        </div>
      </section>

      <section style={{ padding: "32px 24px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Barre de filtres compacte */}
          <div style={{
            background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
            border: "1px solid #C5BFBB", borderRadius: 16,
            padding: "14px 16px", marginBottom: 16,
          }}>
            {/* Ligne principale */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {/* Recherche avec dropdown entreprises */}
              <SearchEntrepriseDropdown
                options={nomOptions}
                selected={selectedNoms}
                onToggle={toggleNom}
                search={search}
                onSearch={setSearch}
              />

              {/* Forme juridique */}
              <MultiSelectDropdown
                options={formeOptions}
                selected={selectedFormes}
                onToggle={toggleForme}
                placeholder="Forme juridique"
                color="#004f91"
              />

              {/* Bouton filtres avancés */}
              <button
                onClick={() => setShowAdvanced(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: showAdvanced ? "#1a1a2e" : "#F2F0EF",
                  color: showAdvanced ? "#fff" : "#4a5568",
                  border: "1px solid #C5BFBB", borderRadius: 10,
                  padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <SlidersHorizontal size={13} />
                Filtres avancés
                {(naema.secteurs.length + naema.branches.length + naema.activites.length + geo.regions.length + geo.departements.length + geo.arrondissements.length) > 0 && (
                  <span style={{ background: "#ca631f", color: "#fff", borderRadius: 999, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                    {naema.secteurs.length + naema.branches.length + naema.activites.length + geo.regions.length + geo.departements.length + geo.arrondissements.length}
                  </span>
                )}
              </button>

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                {allTags.length > 0 && (
                  <button onClick={reinitialiser} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    <X size={11} /> Effacer
                  </button>
                )}
              </div>
            </div>

            {/* Tags actifs */}
            {allTags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                {allTags.map((t, i) => <Tag key={i} label={t.label} onRemove={t.onRemove} />)}
              </div>
            )}

            {/* Filtres avancés — Localisation + NAEMA */}
            {showAdvanced && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid #E8E5E3", paddingTop: 14 }}>
                <GeoCascadeMulti onChange={setGeo} />
                <NaemaCascadeMulti onChange={setNaema} />
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
