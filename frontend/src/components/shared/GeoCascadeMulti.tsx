"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronDown, ChevronUp, MapPin } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface GeoItem { id: number; code: string; nom: string; region_id?: number; departement_id?: number; }

function Tag({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: color + "15", color, border: `1px solid ${color}30`,
      borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600,
    }}>
      {label}
      <button
        onClick={e => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
      >
        <X size={11} style={{ color }} />
      </button>
    </span>
  );
}

function MultiDropdown({ items, selected, onToggle, placeholder, color, disabled = false }:
  { items: GeoItem[]; selected: number[]; onToggle: (id: number) => void; placeholder: string; color: string; disabled?: boolean; }
) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (disabled) return (
    <div style={{ background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "#C5BFBB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span>{placeholder}</span>
      <ChevronDown size={14} style={{ color: "#C5BFBB" }} />
    </div>
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: "#F2F0EF", border: `1px solid ${open ? color : "#C5BFBB"}`,
          borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "#1a1a2e",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", transition: "border-color 0.2s", userSelect: "none" as const,
        }}
      >
        <span style={{ color: selected.length ? "#1a1a2e" : "#9aa5b4" }}>
          {selected.length > 0
            ? <span style={{ color, fontWeight: 600 }}>{selected.length} sélectionné{selected.length > 1 ? "s" : ""}</span>
            : placeholder
          }
        </span>
        {open ? <ChevronUp size={14} style={{ color }} /> : <ChevronDown size={14} style={{ color: "#9aa5b4" }} />}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "#fff", border: `1px solid ${color}40`, borderRadius: 10,
          boxShadow: `0 8px 32px rgba(0,0,0,0.12)`,
          maxHeight: 240, overflowY: "auto",
        }}>
          {items.length === 0 ? (
            <div style={{ padding: "14px", fontSize: 13, color: "#9aa5b4", textAlign: "center" }}>Aucun élément</div>
          ) : items.map(item => {
            const isSelected = selected.includes(item.id);
            return (
              <div
                key={item.id}
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onToggle(item.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", cursor: "pointer",
                  background: isSelected ? color + "0d" : "transparent",
                  borderBottom: "1px solid #F2F0EF",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#F8F7F6"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isSelected ? color + "0d" : "transparent"; }}
              >
                <div style={{
                  width: 17, height: 17, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${isSelected ? color : "#C5BFBB"}`,
                  background: isSelected ? color : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.12s",
                }}>
                  {isSelected && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 13, color: isSelected ? "#1a1a2e" : "#4a5568", fontWeight: isSelected ? 600 : 400 }}>
                  {item.nom}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GeoCascadeMulti({
  onChange,
}: {
  onChange: (selection: { regions: string[]; departements: string[]; arrondissements: string[] }) => void;
}) {
  const [allRegions,       setAllRegions]       = useState<GeoItem[]>([]);
  const [allDepartements,  setAllDepartements]  = useState<GeoItem[]>([]);
  const [allArrondissements, setAllArrondissements] = useState<GeoItem[]>([]);

  const [selRegIds, setSelRegIds] = useState<number[]>([]);
  const [selDepIds, setSelDepIds] = useState<number[]>([]);
  const [selArrIds, setSelArrIds] = useState<number[]>([]);

  // Filtrés selon sélection parente
  const filteredDeps = allDepartements.filter(d => selRegIds.includes(d.region_id!));
  const filteredArrs = allArrondissements.filter(a => selDepIds.includes(a.departement_id!));

  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/regions`).then(r => r.json()).then(setAllRegions).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/departements`).then(r => r.json()).then(setAllDepartements).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/arrondissements`).then(r => r.json()).then(setAllArrondissements).catch(() => {});
  }, []);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const toggleReg = (id: number) => {
    const next = selRegIds.includes(id) ? selRegIds.filter(x => x !== id) : [...selRegIds, id];
    setSelRegIds(next);
    // Nettoyer départements orphelins
    const validDeps = selDepIds.filter(did => {
      const d = allDepartements.find(d => d.id === did);
      return d && next.includes(d.region_id!);
    });
    setSelDepIds(validDeps);
    // Nettoyer arrondissements orphelins
    const validArrs = selArrIds.filter(aid => {
      const a = allArrondissements.find(a => a.id === aid);
      return a && validDeps.includes(a.departement_id!);
    });
    setSelArrIds(validArrs);
  };

  const toggleDep = (id: number) => {
    const next = selDepIds.includes(id) ? selDepIds.filter(x => x !== id) : [...selDepIds, id];
    setSelDepIds(next);
    const validArrs = selArrIds.filter(aid => {
      const a = allArrondissements.find(a => a.id === aid);
      return a && next.includes(a.departement_id!);
    });
    setSelArrIds(validArrs);
  };

  const toggleArr = (id: number) => {
    setSelArrIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const appliquer = () => {
    const toNom = (ids: number[], list: GeoItem[]) =>
      ids.map(id => list.find(i => i.id === id)?.nom || "").filter(Boolean);
    onChangeRef.current({
      regions:        toNom(selRegIds, allRegions),
      departements:   toNom(selDepIds, allDepartements),
      arrondissements:toNom(selArrIds, allArrondissements),
    });
  };

  const reinitialiser = () => {
    setSelRegIds([]); setSelDepIds([]); setSelArrIds([]);
    onChangeRef.current({ regions: [], departements: [], arrondissements: [] });
  };

  const total = selRegIds.length + selDepIds.length + selArrIds.length;
  const COLORS = { reg: "#ca631f", dep: "#004f91", arr: "#059669" };

  return (
    <div style={{ border: "1px solid #E8E5E3", borderRadius: 12, padding: 16, background: "#FAFAF9" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <MapPin size={13} style={{ color: "#ca631f" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Filtrer par localisation
          </span>
          {total > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", background: "rgba(202,99,31,0.12)", padding: "2px 8px", borderRadius: 999 }}>
              {total} filtre{total > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {total > 0 && (
          <button onClick={reinitialiser} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Réinitialiser
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Régions */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, display: "block" }}>
            Région(s)
          </label>
          <MultiDropdown
            items={allRegions} selected={selRegIds} onToggle={toggleReg}
            placeholder="Toutes les régions" color={COLORS.reg}
          />
          {selRegIds.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
              {selRegIds.map(id => {
                const r = allRegions.find(x => x.id === id);
                return r ? <Tag key={id} label={r.nom} color={COLORS.reg} onRemove={() => toggleReg(id)} /> : null;
              })}
            </div>
          )}
        </div>

        {/* Départements — visible si région sélectionnée */}
        {selRegIds.length > 0 && filteredDeps.length > 0 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, display: "block" }}>
              Département(s)
            </label>
            <MultiDropdown
              items={filteredDeps} selected={selDepIds} onToggle={toggleDep}
              placeholder="Tous les départements" color={COLORS.dep}
            />
            {selDepIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                {selDepIds.map(id => {
                  const d = allDepartements.find(x => x.id === id);
                  return d ? <Tag key={id} label={d.nom} color={COLORS.dep} onRemove={() => toggleDep(id)} /> : null;
                })}
              </div>
            )}
          </div>
        )}

        {/* Arrondissements — visible si département sélectionné */}
        {selDepIds.length > 0 && filteredArrs.length > 0 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, display: "block" }}>
              Arrondissement(s)
            </label>
            <MultiDropdown
              items={filteredArrs} selected={selArrIds} onToggle={toggleArr}
              placeholder="Tous les arrondissements" color={COLORS.arr}
            />
            {selArrIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                {selArrIds.map(id => {
                  const a = allArrondissements.find(x => x.id === id);
                  return a ? <Tag key={id} label={a.nom} color={COLORS.arr} onRemove={() => toggleArr(id)} /> : null;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bouton Appliquer */}
      {total > 0 && (
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={appliquer}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "linear-gradient(135deg, #ca631f, #a84e18)",
              color: "#fff", fontWeight: 600, fontSize: 13,
              padding: "9px 20px", borderRadius: 10, border: "none", cursor: "pointer",
              boxShadow: "0 4px 12px rgba(202,99,31,0.3)",
            }}
          >
            <MapPin size={13} /> Appliquer
          </button>
        </div>
      )}
    </div>
  );
}
