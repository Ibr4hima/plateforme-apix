"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface GeoItem { id: number; nom: string; region_id?: number; departement_id?: number; }

// ── Colonne dropdown multi-sélection (réutilisée depuis ThematiquesNaema) ─────
function ColDropdown({
  title, items, selected, onToggle, color, disabled = false, placeholder, groupBy,
}: {
  title:       string;
  items:       GeoItem[];
  selected:    number[];
  onToggle:    (id: number) => void;
  color:       string;
  disabled?:   boolean;
  placeholder: string;
  groupBy?:    { id: number; nom: string }[];
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => { if (disabled) { setOpen(false); setSearch(""); } }, [disabled]);

  const filtered = items.filter(i => i.nom.toLowerCase().includes(search.toLowerCase()));

  const renderItem = (item: GeoItem) => {
    const isSel = selected.includes(item.id);
    return (
      <div key={item.id} onMouseDown={e => { e.preventDefault(); onToggle(item.id); }}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer",
          background: isSel ? color + "0d" : "transparent", borderBottom: "1px solid #F8F7F6", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F8F7F6"; }}
        onMouseLeave={e => { e.currentTarget.style.background = isSel ? color + "0d" : "transparent"; }}
      >
        <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0,
          border: `2px solid ${isSel ? color : "#C5BFBB"}`, background: isSel ? color : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}>
          {isSel && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        <span style={{ fontSize: 12, color: isSel ? "#1a1a2e" : "#4a5568", fontWeight: isSel ? 600 : 400 }}>{item.nom}</span>
      </div>
    );
  };

  const renderList = () => {
    if (!groupBy || groupBy.length === 0) return filtered.map(renderItem);
    const parentKey = items[0]?.region_id !== undefined ? "region_id" : "departement_id";
    return groupBy.map(group => {
      const groupItems = filtered.filter(i => (i as any)[parentKey] === group.id);
      if (groupItems.length === 0) return null;
      return (
        <div key={group.id}>
          <div style={{ padding: "6px 12px 3px", fontSize: 10, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: "0.1em", background: color + "08", borderBottom: `1px solid ${color}20` }}>
            {group.nom}
          </div>
          {groupItems.map(renderItem)}
        </div>
      );
    });
  };

  const base = {
    background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8,
    padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none",
    fontFamily: "var(--font-google-sans)", width: "100%", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: disabled ? "#C5BFBB" : color }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: disabled ? "#C5BFBB" : "#4a5568", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
          {title}
        </span>
        {selected.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "15", padding: "1px 6px", borderRadius: 999 }}>{selected.length}</span>
        )}
      </div>

      <div ref={ref} style={{ position: "relative" }}>
        <div onClick={() => { if (!disabled) setOpen(o => !o); }} style={{
          ...base, display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
          border: `1px solid ${open ? color : "#C5BFBB"}`, transition: "border-color 0.2s",
        }}>
          <span style={{ color: selected.length > 0 ? color : "#9aa5b4", fontWeight: selected.length > 0 ? 600 : 400 }}>
            {disabled ? placeholder : selected.length > 0 ? `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}` : placeholder}
          </span>
          {open ? <ChevronUp size={14} style={{ color, flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "#9aa5b4", flexShrink: 0 }} />}
        </div>

        {open && !disabled && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
            background: "#fff", border: `1px solid ${color}40`, borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.13)", maxHeight: 280, overflowY: "auto" }}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #F2F0EF", position: "sticky", top: 0, background: "#fff" }}>
              <input autoFocus placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...base, fontSize: 12, padding: "7px 10px" }} />
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px", fontSize: 12, color: "#9aa5b4", textAlign: "center" }}>Aucun résultat</div>
            ) : renderList()}
          </div>
        )}
      </div>

      {/* Tags */}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map(id => {
            const item = items.find(i => i.id === id);
            return item ? (
              <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4,
                background: color + "15", color, border: `1px solid ${color}30`,
                borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                {item.nom}
                <button onClick={() => onToggle(id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                  <X size={10} style={{ color }} />
                </button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function LocalisationCascade({
  value, onChange,
}: {
  value:    { regions: number[]; departements: number[]; arrondissements: number[] };
  onChange: (val: { regions: number[]; departements: number[]; arrondissements: number[]; regionNoms: string[]; departementNoms: string[]; arrondissementNoms: string[] }) => void;
}) {
  const [allRegions,       setAllRegions]       = useState<GeoItem[]>([]);
  const [allDepartements,  setAllDepartements]  = useState<GeoItem[]>([]);
  const [allArrondissements, setAllArrondissements] = useState<GeoItem[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/regions`).then(r => r.json()).then(setAllRegions).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/departements`).then(r => r.json()).then(setAllDepartements).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/arrondissements`).then(r => r.json()).then(setAllArrondissements).catch(() => {});
  }, []);

  const filteredDeps  = allDepartements.filter(d => value.regions.includes(d.region_id!));
  const filteredArros = allArrondissements.filter(a => value.departements.includes(a.departement_id!));

  const emit = (regions: number[], departements: number[], arrondissements: number[]) => {
    const toNom = (ids: number[], list: GeoItem[]) => ids.map(id => list.find(i => i.id === id)?.nom || "").filter(Boolean);
    onChange({
      regions, departements, arrondissements,
      regionNoms:        toNom(regions,        allRegions),
      departementNoms:   toNom(departements,   allDepartements),
      arrondissementNoms:toNom(arrondissements, allArrondissements),
    });
  };

  const toggleReg = (id: number) => {
    const next = value.regions.includes(id) ? value.regions.filter(x => x !== id) : [...value.regions, id];
    const validDeps  = value.departements.filter(did => { const d = allDepartements.find(d => d.id === did); return d && next.includes(d.region_id!); });
    const validArros = value.arrondissements.filter(aid => { const a = allArrondissements.find(a => a.id === aid); return a && validDeps.includes(a.departement_id!); });
    emit(next, validDeps, validArros);
  };

  const toggleDep = (id: number) => {
    const next = value.departements.includes(id) ? value.departements.filter(x => x !== id) : [...value.departements, id];
    const validArros = value.arrondissements.filter(aid => { const a = allArrondissements.find(a => a.id === aid); return a && next.includes(a.departement_id!); });
    emit(value.regions, next, validArros);
  };

  const toggleArro = (id: number) => {
    const next = value.arrondissements.includes(id) ? value.arrondissements.filter(x => x !== id) : [...value.arrondissements, id];
    emit(value.regions, value.departements, next);
  };

  const COLORS = { reg: "#004f91", dep: "#7c3aed", arro: "#059669" };

  return (
    <div style={{ border: "1px solid #E8E5E3", borderRadius: 12, padding: 16, background: "#FAFAF9" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "start" }}>
        <ColDropdown title="Région" items={allRegions} selected={value.regions} onToggle={toggleReg}
          color={COLORS.reg} placeholder="Sélectionner" />
        <ColDropdown title="Département" items={filteredDeps} selected={value.departements} onToggle={toggleDep}
          color={COLORS.dep} disabled={value.regions.length === 0}
          placeholder={value.regions.length === 0 ? "Choisir une région d'abord" : "Sélectionner"}
          groupBy={allRegions.filter(r => value.regions.includes(r.id)).map(r => ({ id: r.id, nom: r.nom }))} />
        <ColDropdown title="Arrondissement" items={filteredArros} selected={value.arrondissements} onToggle={toggleArro}
          color={COLORS.arro} disabled={value.departements.length === 0}
          placeholder={value.departements.length === 0 ? "Choisir un département d'abord" : "Sélectionner"}
          groupBy={allDepartements.filter(d => value.departements.includes(d.id)).map(d => ({ id: d.id, nom: d.nom }))} />
      </div>
    </div>
  );
}
