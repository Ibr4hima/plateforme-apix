"use client";

import { Search, X } from "lucide-react";

const TYPES = [
  { value: "",                   label: "Tous les types"  },
  { value: "salon",              label: "Salon"           },
  { value: "forum",              label: "Forum"           },
  { value: "conference",         label: "Conférence"      },
  { value: "mission_prospection",label: "Mission"         },
  { value: "roadshow",           label: "Roadshow"        },
  { value: "b2b",                label: "B2B"             },
  { value: "webinaire",          label: "Webinaire"       },
  { value: "autre",              label: "Autre"           },
];

const STATUTS = [
  { value: "",         label: "Tous les statuts" },
  { value: "planifie", label: "Planifié"         },
  { value: "en_cours", label: "En cours"         },
  { value: "termine",  label: "Terminé"          },
  { value: "annule",   label: "Annulé"           },
  { value: "reporte",  label: "Reporté"          },
];

interface Filtres {
  search:         string;
  type_evenement: string;
  statut:         string;
  pays_nom:       string;
}

export default function FiltresEvenements({
  filtres, onChange, total,
}: {
  filtres:  Filtres;
  onChange: (f: Filtres) => void;
  total:    number;
}) {
  const update = (key: keyof Filtres, val: string) => onChange({ ...filtres, [key]: val });
  const hasFilter = filtres.search || filtres.type_evenement || filtres.statut || filtres.pays_nom;

  const selectStyle = {
    background: "rgba(255,255,255,0.85)", border: "1px solid #C5BFBB",
    borderRadius: 10, padding: "9px 14px", fontSize: 13,
    color: "#1a1a2e", cursor: "pointer", outline: "none",
    fontFamily: "var(--font-body)", minWidth: 150,
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)",
      border: "1px solid #C5BFBB", borderRadius: 16,
      padding: "16px 20px", marginBottom: 28,
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
    }}>

      {/* Search */}
      <div style={{ position: "relative", flex: "1 1 220px" }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
        <input
          placeholder="Rechercher un événement..."
          value={filtres.search}
          onChange={e => update("search", e.target.value)}
          style={{
            width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
            background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 10,
            fontSize: 13, color: "#1a1a2e", outline: "none",
            fontFamily: "var(--font-body)", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Type */}
      <select value={filtres.type_evenement} onChange={e => update("type_evenement", e.target.value)} style={selectStyle}>
        {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {/* Statut */}
      <select value={filtres.statut} onChange={e => update("statut", e.target.value)} style={selectStyle}>
        {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      {/* Pays */}
      <input
        placeholder="Pays..."
        value={filtres.pays_nom}
        onChange={e => update("pays_nom", e.target.value)}
        style={{ ...selectStyle, minWidth: 120 }}
      />

      {/* Total + reset */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
        <span style={{ fontSize: 13, color: "#9aa5b4", whiteSpace: "nowrap" }}>
          <strong style={{ color: "#1a1a2e" }}>{total}</strong> événement{total > 1 ? "s" : ""}
        </span>
        {hasFilter && (
          <button onClick={() => onChange({ search: "", type_evenement: "", statut: "", pays_nom: "" })}
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
