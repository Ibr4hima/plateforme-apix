"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Pays { id: number; code_iso2: string; nom_fr: string; continent: string; }

export default function PaysSelect({
  value, onChange, onChangeId, placeholder = "Sélectionner un pays", style, excludeNoms = [],
}: {
  value:        string;
  onChange:     (nom: string) => void;
  onChangeId?:  (id: number | null) => void;
  placeholder?: string;
  style?:       any;
  excludeNoms?: string[];
}) {
  const [pays,   setPays]   = useState<Pays[]>([]);
  const [search, setSearch] = useState("");
  const [open,   setOpen]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/ref-pays`)
      .then(r => r.json()).then(setPays).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = pays.filter(p =>
    !excludeNoms.includes(p.nom_fr) &&
    (p.nom_fr.toLowerCase().includes(search.toLowerCase()) ||
    p.continent?.toLowerCase().includes(search.toLowerCase()))
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
      <div onClick={() => setOpen(o => !o)}
        style={{ ...inputBase, display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", border: `1px solid ${open ? "#004f91" : "#C5BFBB"}`, transition: "border-color 0.2s" }}>
        <span style={{ color: value ? "#1a1a2e" : "#9aa5b4" }}>{value || placeholder}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {value && (
            <button onClick={e => { e.stopPropagation(); onChange(""); if (onChangeId) onChangeId(null); setSearch(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
              <X size={13} style={{ color: "#9aa5b4" }} />
            </button>
          )}
          <ChevronDown size={14} style={{ color: "#9aa5b4", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
        </div>
      </div>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: "#fff", border: "1px solid #C5BFBB", borderRadius: 10,
          boxShadow: "var(--ombre-2)", maxHeight: 300, overflowY: "auto" }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #F2F0EF", position: "sticky", top: 0, background: "#fff" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
              <input autoFocus placeholder="Rechercher un pays..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputBase, paddingLeft: 28, fontSize: 12 }} />
            </div>
          </div>
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([continent, list]) => (
            <div key={continent}>
              <div style={{ padding: "6px 12px 3px", fontSize: 10, fontWeight: 700, color: "#9aa5b4",
                textTransform: "uppercase", letterSpacing: "0.1em", background: "#F8F7F6" }}>
                {continent}
              </div>
              {list.map(p => (
                <div key={p.id}
                  onMouseDown={e => { e.preventDefault(); onChange(p.nom_fr); if (onChangeId) onChangeId(p.id); setOpen(false); setSearch(""); }}
                  style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13,
                    color: value === p.nom_fr ? "#004f91" : "#1a1a2e",
                    background: value === p.nom_fr ? "rgba(0,79,145,0.06)" : "transparent",
                    fontWeight: value === p.nom_fr ? 600 : 400,
                    display: "flex", alignItems: "center", gap: 8, transition: "background 0.1s" }}
                  onMouseEnter={e => { if (value !== p.nom_fr) e.currentTarget.style.background = "#F8F7F6"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = value === p.nom_fr ? "rgba(0,79,145,0.06)" : "transparent"; }}>
                  {p.nom_fr}
                </div>
              ))}
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
