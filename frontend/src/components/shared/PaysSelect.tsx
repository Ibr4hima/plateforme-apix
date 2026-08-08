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
    background: "var(--fond)", border: "1px solid var(--bordure-forte)",
    borderRadius: 8, padding: "9px 12px", fontSize: 13,
    color: "var(--encre)", outline: "none",
    fontFamily: "var(--font-google-sans)",
    width: "100%", boxSizing: "border-box" as const,
  };

  return (
    <div ref={ref} style={{ position: "relative", ...style }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ ...inputBase, display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", border: `1px solid ${open ? "var(--bleu)" : "var(--bordure-forte)"}`, transition: "border-color 0.2s" }}>
        <span style={{ color: value ? "var(--encre)" : "var(--gris)" }}>{value || placeholder}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {value && (
            <button onClick={e => { e.stopPropagation(); onChange(""); if (onChangeId) onChangeId(null); setSearch(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
              <X size={13} style={{ color: "var(--gris)" }} />
            </button>
          )}
          <ChevronDown size={14} style={{ color: "var(--gris)", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
        </div>
      </div>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: "var(--carte)", border: "1px solid var(--bordure-forte)", borderRadius: 10,
          boxShadow: "var(--ombre-2)", maxHeight: 300, overflowY: "auto" }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--bordure)", position: "sticky", top: 0, background: "var(--carte)" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--gris)" }} />
              <input autoFocus placeholder="Rechercher un pays..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputBase, paddingLeft: 28, fontSize: 12 }} />
            </div>
          </div>
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([continent, list]) => (
            <div key={continent}>
              <div style={{ padding: "6px 12px 3px", fontSize: 10, fontWeight: 700, color: "var(--gris)",
                textTransform: "uppercase", letterSpacing: "0.1em", background: "var(--carte-douce)" }}>
                {continent}
              </div>
              {list.map(p => (
                <div key={p.id}
                  onMouseDown={e => { e.preventDefault(); onChange(p.nom_fr); if (onChangeId) onChangeId(p.id); setOpen(false); setSearch(""); }}
                  style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13,
                    color: value === p.nom_fr ? "var(--bleu)" : "var(--encre)",
                    background: value === p.nom_fr ? "rgb(var(--bleu-rgb) / 0.06)" : "transparent",
                    fontWeight: value === p.nom_fr ? 600 : 400,
                    display: "flex", alignItems: "center", gap: 8, transition: "background 0.1s" }}
                  onMouseEnter={e => { if (value !== p.nom_fr) e.currentTarget.style.background = "var(--carte-douce)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = value === p.nom_fr ? "rgb(var(--bleu-rgb) / 0.06)" : "transparent"; }}>
                  {p.nom_fr}
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "14px", fontSize: 13, color: "var(--gris)", textAlign: "center" }}>Aucun pays trouvé</div>
          )}
        </div>
      )}
    </div>
  );
}
