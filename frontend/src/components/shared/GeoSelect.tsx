"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const SELECT_STYLE = {
  width: "100%", background: "#F2F0EF", border: "1px solid #C5BFBB",
  borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e",
  outline: "none", fontFamily: "var(--font-google-sans)",
  cursor: "pointer", boxSizing: "border-box" as const,
};

export function RegionSelect({ value, onChange, required }: {
  value: string; onChange: (nom: string, id: number | null) => void; required?: boolean;
}) {
  const [regions, setRegions] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/regions`)
      .then(r => r.json()).then(setRegions).catch(() => {});
  }, []);
  return (
    <select
      value={value}
      required={required}
      onChange={e => {
        const sel = regions.find(r => r.nom === e.target.value);
        onChange(e.target.value, sel?.id || null);
      }}
      style={{ ...SELECT_STYLE, borderColor: required && !value ? "#dc2626" : "#C5BFBB" }}
    >
      <option value="">— Sélectionner —</option>
      {regions.map(r => <option key={r.id} value={r.nom}>{r.nom}</option>)}
    </select>
  );
}

export function DepartementSelect({ regionId, value, onChange, required }: {
  regionId: number | null; value: string; onChange: (nom: string, id: number | null) => void; required?: boolean;
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
      value={value}
      required={required}
      disabled={!departements.length}
      onChange={e => {
        const sel = departements.find(d => d.nom === e.target.value);
        onChange(e.target.value, sel?.id || null);
      }}
      style={{ ...SELECT_STYLE, opacity: departements.length ? 1 : 0.5, cursor: departements.length ? "pointer" : "not-allowed", borderColor: required && !value && regionId ? "#dc2626" : "#C5BFBB" }}
    >
      <option value="">— Sélectionner —</option>
      {departements.map(d => <option key={d.id} value={d.nom}>{d.nom}</option>)}
    </select>
  );
}

export function ArrondissementSelect({ departementId, value, onChange, required }: {
  departementId: number | null; value: string; onChange: (nom: string) => void; required?: boolean;
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
      value={value}
      required={required}
      disabled={!arrondissements.length}
      onChange={e => onChange(e.target.value)}
      style={{ ...SELECT_STYLE, opacity: arrondissements.length ? 1 : 0.5, cursor: arrondissements.length ? "pointer" : "not-allowed" }}
    >
      <option value="">— Sélectionner —</option>
      {arrondissements.map(a => <option key={a.id} value={a.nom}>{a.nom}</option>)}
    </select>
  );
}
