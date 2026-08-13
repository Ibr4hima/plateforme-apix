"use client";

import { useState, useEffect } from "react";

import { API_BASE } from "@/lib/api";

const SELECT_STYLE = {
  width: "100%", background: "var(--fond)", border: "1px solid var(--bordure-forte)",
  borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--encre)",
  outline: "none", fontFamily: "var(--font-google-sans)",
  cursor: "pointer", boxSizing: "border-box" as const,
};

// value = ID (number | "") — onChange retourne (id, nom)
// filterIds : si fourni, affiche seulement les régions dans cette liste
// disabledIds : entrées affichées mais grisées et non sélectionnables (« déjà défini »)
export function RegionSelect({ value, onChange, required, filterIds, disabledIds }: {
  value: number | string;
  onChange: (id: number | null, nom: string) => void;
  required?: boolean;
  filterIds?: number[];
  disabledIds?: number[];
}) {
  const [regions, setRegions] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/regions`)
      .then(r => r.json()).then(setRegions).catch(() => {});
  }, []);

  const displayed = filterIds && filterIds.length > 0
    ? regions.filter(r => filterIds.includes(r.id))
    : regions;

  return (
    <select
      value={value || ""}
      required={required}
      onChange={e => {
        const sel = regions.find(r => r.id === parseInt(e.target.value));
        onChange(sel?.id || null, sel?.nom || "");
      }}
      style={{ ...SELECT_STYLE, borderColor: required && !value ? "var(--danger)" : "var(--bordure-forte)" }}
    >
      <option value="">{filterIds && filterIds.length > 0 ? `— ${filterIds.length} région${filterIds.length>1?"s":""} disponible${filterIds.length>1?"s":""} —` : "— Sélectionner —"}</option>
      {displayed.map(r => {
        const off = (disabledIds || []).includes(r.id);
        return <option key={r.id} value={r.id} disabled={off}>{r.nom}{off ? " (déjà défini)" : ""}</option>;
      })}
    </select>
  );
}

export function DepartementSelect({ regionId, value, onChange, required, disabledIds }: {
  regionId: number | null;
  value:    number | string;
  onChange: (id: number | null, nom: string) => void;
  required?: boolean;
  disabledIds?: number[];
}) {
  const [departements, setDepartements] = useState<any[]>([]);
  useEffect(() => {
    if (regionId) {
      fetch(`${API_BASE}/entreprises/ref/departements?region_id=${regionId}`)
        .then(r => r.json()).then(setDepartements).catch(() => {});
    } else { setDepartements([]); }
  }, [regionId]);
  return (
    <select
      value={value || ""}
      required={required}
      disabled={!departements.length}
      onChange={e => {
        const sel = departements.find(d => d.id === parseInt(e.target.value));
        onChange(sel?.id || null, sel?.nom || "");
      }}
      style={{ ...SELECT_STYLE, opacity: departements.length ? 1 : 0.5, cursor: departements.length ? "pointer" : "not-allowed", borderColor: required && !value && regionId ? "var(--danger)" : "var(--bordure-forte)" }}
    >
      <option value="">— Sélectionner —</option>
      {departements.map(d => {
        const off = (disabledIds || []).includes(d.id);
        return <option key={d.id} value={d.id} disabled={off}>{d.nom}{off ? " (déjà défini)" : ""}</option>;
      })}
    </select>
  );
}

export function ArrondissementSelect({ departementId, value, onChange, required, disabledIds }: {
  departementId: number | null;
  value:         number | string;
  onChange:      (id: number | null, nom: string) => void;
  required?:     boolean;
  disabledIds?:  number[];
}) {
  const [arrondissements, setArrondissements] = useState<any[]>([]);
  useEffect(() => {
    if (departementId) {
      fetch(`${API_BASE}/entreprises/ref/arrondissements?departement_id=${departementId}`)
        .then(r => r.json()).then(setArrondissements).catch(() => {});
    } else { setArrondissements([]); }
  }, [departementId]);
  return (
    <select
      value={value || ""}
      required={required}
      disabled={!arrondissements.length}
      onChange={e => {
        const sel = arrondissements.find(a => a.id === parseInt(e.target.value));
        onChange(sel?.id || null, sel?.nom || "");
      }}
      style={{ ...SELECT_STYLE, opacity: arrondissements.length ? 1 : 0.5, cursor: arrondissements.length ? "pointer" : "not-allowed" }}
    >
      <option value="">— Sélectionner —</option>
      {arrondissements.map(a => {
        const off = (disabledIds || []).includes(a.id);
        return <option key={a.id} value={a.id} disabled={off}>{a.nom}{off ? " (déjà défini)" : ""}</option>;
      })}
    </select>
  );
}
