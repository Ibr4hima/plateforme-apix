"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Pays { id: number; code_iso2: string; nom_fr: string; continent: string; }

export default function PaysMultiSelect({
  value, onChange, placeholder = "Sélectionner des pays", style,
  excludeNom, disabled = false, disabledHint,
}: {
  value:        string;
  onChange:     (val: string) => void;
  placeholder?: string;
  style?:       any;
  excludeNom?:  string;   // pays à griser (non sélectionnable), ex. le pays hôte
  disabled?:    boolean;  // désactive tout le sélecteur
  disabledHint?: string;  // message affiché quand désactivé
}) {
  const [pays,   setPays]   = useState<Pays[]>([]);
  const [search, setSearch] = useState("");
  const [open,   setOpen]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected: string[] = value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];

  const toggle = (nom: string) => {
    const next = selected.includes(nom) ? selected.filter(s => s !== nom) : [...selected, nom];
    onChange(next.join(", "));
  };

  useEffect(() => {
    fetch(`${API_BASE}/ref-pays`)
      .then(r => r.json()).then(setPays).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = pays.filter(p =>
    p.nom_fr.toLowerCase().includes(search.toLowerCase()) ||
    p.continent?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc, p) => {
    const r = p.continent || "Autre";
    if (!acc[r]) acc[r] = [];
    acc[r].push(p);
    return acc;
  }, {} as Record<string, Pays[]>);

  const inputBase = {
    background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 8, padding: "9px 12px", fontSize: 13,
    color: "#1a1a2e", outline: "none",
    fontFamily: "var(--font-google-sans)",
    width: "100%", boxSizing: "border-box" as const,
  };

  return (
    <div ref={ref} style={{ position: "relative", ...style }}>
      <div onClick={() => { if (disabled) return; setOpen(o => !o); }}
        style={{ ...inputBase, minHeight: 40, display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", cursor: disabled ? "not-allowed" : "pointer",
          background: disabled ? "#F5F4F3" : inputBase.background,
          border: `1px solid ${open ? "#004f91" : "#C5BFBB"}`,
          transition: "border-color 0.2s", flexWrap: "wrap", gap: 4, paddingRight: 32 }}>
        {selected.length === 0 ? (
          <span style={{ color: "#9aa5b4", lineHeight: "22px" }}>{disabled ? (disabledHint || placeholder) : placeholder}</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
            {selected.map(nom => {
              return (
                <span key={nom} style={{ display: "inline-flex", alignItems: "center", gap: 4,
                  background: "rgba(0,79,145,0.08)", color: "#004f91",
                  borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 500 }}>
                  {nom}
                  <button onClick={e => { e.stopPropagation(); toggle(nom); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#004f91", marginLeft: 2 }}>
                    <X size={11} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div style={{ position: "absolute", right: 10, top: 10, display: "flex", alignItems: "center", gap: 4 }}>
          {selected.length > 0 && (
            <button onClick={e => { e.stopPropagation(); onChange(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
              <X size={13} style={{ color: "#9aa5b4" }} />
            </button>
          )}
          <ChevronDown size={14} style={{ color: "#9aa5b4", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
        </div>
      </div>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "#fff", border: "1px solid #C5BFBB", borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxHeight: 320, overflowY: "auto" }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #F2F0EF", position: "sticky", top: 0, background: "#fff" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
              <input autoFocus placeholder="Rechercher un pays..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputBase, paddingLeft: 28, fontSize: 12 }} />
            </div>
            {selected.length > 0 && (
              <div style={{ fontSize: 11, color: "#004f91", marginTop: 5, fontWeight: 500 }}>
                {selected.length} pays sélectionné{selected.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([continent, list]) => (
            <div key={continent}>
              <div style={{ padding: "6px 12px 3px", fontSize: 10, fontWeight: 700,
                color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", background: "#F8F7F6" }}>
                {continent}
              </div>
              {list.map(p => {
                const isSelected = selected.includes(p.nom_fr);
                if (excludeNom && p.nom_fr === excludeNom) {
                  return (
                    <div key={p.id} title="Déjà choisi comme pays hôte"
                      style={{ padding: "9px 14px", cursor: "not-allowed", fontSize: 13,
                        display: "flex", alignItems: "center", gap: 10, opacity: 0.55 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: "2px solid #D8D3CF", background: "transparent" }} />
                      <span style={{ color: "#9aa5b4", fontWeight: 400 }}>{p.nom_fr}</span>
                      <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pays hôte</span>
                    </div>
                  );
                }
                return (
                  <div key={p.id}
                    onMouseDown={e => { e.preventDefault(); toggle(p.nom_fr); }}
                    style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13,
                      display: "flex", alignItems: "center", gap: 10,
                      background: isSelected ? "rgba(0,79,145,0.06)" : "transparent",
                      transition: "background 0.1s" }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#F8F7F6"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(0,79,145,0.06)" : "transparent"; }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${isSelected ? "#004f91" : "#C5BFBB"}`,
                      background: isSelected ? "#004f91" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                      {isSelected && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span style={{ color: isSelected ? "#004f91" : "#1a1a2e", fontWeight: isSelected ? 600 : 400 }}>{p.nom_fr}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "14px", fontSize: 13, color: "#9aa5b4", textAlign: "center" }}>Aucun pays trouvé</div>
          )}
        </div>
      )}
    </div>
  );
}
