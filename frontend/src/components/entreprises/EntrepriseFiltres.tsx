"use client";

import { useCallback } from "react";
import { Search, X } from "lucide-react";
import { NaemaCascadeMulti } from "@/components/shared/NaemaSelects";

interface Filtres {
  search:    string;
  statut:    string;
  secteurs:  string[];
  branches:  string[];
  activites: string[];
  region:    string;
  pays:      string;
}

export default function EntrepriseFiltres({
  filtres, onChange, total,
}: {
  filtres:  Filtres;
  onChange: (f: Filtres) => void;
  total:    number;
}) {
  const update = (key: keyof Filtres, val: any) => onChange({ ...filtres, [key]: val });
  const hasFilter = filtres.search || filtres.statut || filtres.region || filtres.pays
    || filtres.secteurs.length > 0 || filtres.branches.length > 0 || filtres.activites.length > 0;

  // ← useCallback : même référence de fonction entre les renders
  const handleNaema = useCallback(({ secteurs, branches, activites }: { secteurs: string[]; branches: string[]; activites: string[] }) => {
    onChange({ ...filtres, secteurs, branches, activites });
  }, []);  // ← dépendances vides : la fonction ne change jamais

  const inputStyle = {
    background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 10, padding: "9px 12px", fontSize: 13,
    color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)",
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)",
      border: "1px solid #C5BFBB", borderRadius: 16,
      padding: "20px", marginBottom: 28,
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
          <input
            placeholder="Rechercher une entreprise..."
            value={filtres.search}
            onChange={e => update("search", e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingLeft: 34, boxSizing: "border-box" as const }}
          />
        </div>
        <select value={filtres.statut} onChange={e => update("statut", e.target.value)} style={{ ...inputStyle, cursor: "pointer", minWidth: 140 }}>
          <option value="">Tous les statuts</option>
          <option value="actif">Active</option>
          <option value="inactif">Inactive</option>
        </select>
        <input placeholder="Région..." value={filtres.region} onChange={e => update("region", e.target.value)} style={{ ...inputStyle, minWidth: 120 }} />
        <input placeholder="Pays..." value={filtres.pays} onChange={e => update("pays", e.target.value)} style={{ ...inputStyle, minWidth: 100 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <span style={{ fontSize: 13, color: "#9aa5b4", whiteSpace: "nowrap" }}>
            <strong style={{ color: "#1a1a2e" }}>{total}</strong> entreprise{total > 1 ? "s" : ""}
          </span>
          {hasFilter && (
            <button
              onClick={() => onChange({ search: "", statut: "", secteurs: [], branches: [], activites: [], region: "", pays: "" })}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              <X size={12} /> Effacer
            </button>
          )}
        </div>
      </div>

      <NaemaCascadeMulti onChange={handleNaema} />
    </div>
  );
}
