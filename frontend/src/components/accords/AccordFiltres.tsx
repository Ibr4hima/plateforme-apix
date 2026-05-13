"use client";

import { Search, X } from "lucide-react";

const STATUTS = [
  { value: "",                 label: "Tous les statuts"     },
  { value: "en_vigueur",       label: "En vigueur"           },
  { value: "signe_non_ratifie",label: "Signé non ratifié"    },
  { value: "expire",           label: "Expiré"               },
  { value: "suspendu",         label: "Suspendu"             },
  { value: "negocie",          label: "En négociation"       },
];

interface Filtres {
  search:          string;
  statut:          string;
  type_accord:     string;
  secteur_activite:string;
  pays_signataires:string;
}

export default function AccordFiltres({
  filtres, onChange, total,
}: {
  filtres:  Filtres;
  onChange: (f: Filtres) => void;
  total:    number;
}) {
  const update = (key: keyof Filtres, val: string) => onChange({ ...filtres, [key]: val });
  const hasFilter = Object.values(filtres).some(v => v !== "");

  const inputStyle = {
    background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 10, padding: "9px 12px", fontSize: 13,
    color: "#1a1a2e", outline: "none", fontFamily: "var(--font-body)",
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)",
      border: "1px solid #C5BFBB", borderRadius: 16,
      padding: "16px 20px", marginBottom: 28,
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
    }}>

      {/* Recherche */}
      <div style={{ position: "relative", flex: "1 1 220px" }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
        <input
          placeholder="Rechercher un accord..."
          value={filtres.search}
          onChange={e => update("search", e.target.value)}
          style={{ ...inputStyle, width: "100%", paddingLeft: 34, boxSizing: "border-box" as const }}
        />
      </div>

      {/* Statut */}
      <select value={filtres.statut} onChange={e => update("statut", e.target.value)} style={{ ...inputStyle, cursor: "pointer", minWidth: 160 }}>
        {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      {/* Type */}
      <input
        placeholder="Type d'accord..."
        value={filtres.type_accord}
        onChange={e => update("type_accord", e.target.value)}
        style={{ ...inputStyle, minWidth: 140 }}
      />

      {/* Secteur */}
      <input
        placeholder="Secteur..."
        value={filtres.secteur_activite}
        onChange={e => update("secteur_activite", e.target.value)}
        style={{ ...inputStyle, minWidth: 120 }}
      />

      {/* Pays */}
      <input
        placeholder="Pays signataire..."
        value={filtres.pays_signataires}
        onChange={e => update("pays_signataires", e.target.value)}
        style={{ ...inputStyle, minWidth: 140 }}
      />

      {/* Total + reset */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
        <span style={{ fontSize: 13, color: "#9aa5b4", whiteSpace: "nowrap" }}>
          <strong style={{ color: "#1a1a2e" }}>{total}</strong> accord{total > 1 ? "s" : ""}
        </span>
        {hasFilter && (
          <button
            onClick={() => onChange({ search: "", statut: "", type_accord: "", secteur_activite: "", pays_signataires: "" })}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "#fee2e2", color: "#dc2626",
              border: "none", borderRadius: 8, padding: "6px 10px",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
            <X size={12} /> Effacer
          </button>
        )}
      </div>
    </div>
  );
}
