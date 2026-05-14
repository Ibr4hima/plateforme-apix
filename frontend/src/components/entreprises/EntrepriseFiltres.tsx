"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";

interface Filtres {
  search:     string;
  statut:     string;
  secteur_id: string;
  branche_id: string;
  region:     string;
  pays:       string;
}

export default function EntrepriseFiltres({
  filtres, onChange, total,
}: {
  filtres:  Filtres;
  onChange: (f: Filtres) => void;
  total:    number;
}) {
  const [secteurs, setSecteurs] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    api.ref.secteurs().then(setSecteurs).catch(() => {});
  }, []);

  useEffect(() => {
    if (filtres.secteur_id) {
      api.ref.branches(parseInt(filtres.secteur_id)).then(setBranches).catch(() => {});
    } else {
      setBranches([]);
      onChange({ ...filtres, branche_id: "" });
    }
  }, [filtres.secteur_id]);

  const update = (key: keyof Filtres, val: string) => onChange({ ...filtres, [key]: val });
  const hasFilter = Object.values(filtres).some(v => v !== "");

  const inputStyle = {
    background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 10, padding: "9px 12px", fontSize: 13,
    color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)",
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
          placeholder="Rechercher une entreprise..."
          value={filtres.search}
          onChange={e => update("search", e.target.value)}
          style={{ ...inputStyle, width: "100%", paddingLeft: 34, boxSizing: "border-box" as const }}
        />
      </div>

      {/* Statut */}
      <select value={filtres.statut} onChange={e => update("statut", e.target.value)} style={{ ...inputStyle, cursor: "pointer", minWidth: 140 }}>
        <option value="">Tous les statuts</option>
        <option value="actif">Active</option>
        <option value="inactif">Inactive</option>
      </select>

      {/* Secteur */}
      <select
        value={filtres.secteur_id}
        onChange={e => update("secteur_id", e.target.value)}
        style={{ ...inputStyle, cursor: "pointer", minWidth: 160 }}
      >
        <option value="">Tous les secteurs</option>
        {secteurs.map((s: any) => (
          <option key={s.id} value={s.id}>{s.nom}</option>
        ))}
      </select>

      {/* Branche */}
      {branches.length > 0 && (
        <select
          value={filtres.branche_id}
          onChange={e => update("branche_id", e.target.value)}
          style={{ ...inputStyle, cursor: "pointer", minWidth: 160 }}
        >
          <option value="">Toutes les branches</option>
          {branches.map((b: any) => (
            <option key={b.id} value={b.id}>{b.nom}</option>
          ))}
        </select>
      )}

      {/* Région */}
      <input
        placeholder="Région..."
        value={filtres.region}
        onChange={e => update("region", e.target.value)}
        style={{ ...inputStyle, minWidth: 120 }}
      />

      {/* Pays */}
      <input
        placeholder="Pays..."
        value={filtres.pays}
        onChange={e => update("pays", e.target.value)}
        style={{ ...inputStyle, minWidth: 100 }}
      />

      {/* Total + reset */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
        <span style={{ fontSize: 13, color: "#9aa5b4", whiteSpace: "nowrap" }}>
          <strong style={{ color: "#1a1a2e" }}>{total}</strong> entreprise{total > 1 ? "s" : ""}
        </span>
        {hasFilter && (
          <button
            onClick={() => onChange({ search: "", statut: "", secteur_id: "", branche_id: "", region: "", pays: "" })}
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
