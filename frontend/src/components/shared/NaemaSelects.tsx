"use client";

import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Types ─────────────────────────────────────────────────────────────────────
interface NaemaItem { id: number; code: string; nom: string; }

// ── Tag ───────────────────────────────────────────────────────────────────────
function Tag({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: color + "15", color, border: `1px solid ${color}30`,
      borderRadius: 999, padding: "3px 10px 3px 10px", fontSize: 12, fontWeight: 600,
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
      >
        <X size={11} style={{ color }} />
      </button>
    </span>
  );
}

// ── Dropdown multi-select ─────────────────────────────────────────────────────
function MultiDropdown({
  items, selected, onToggle, placeholder, color, disabled = false,
}: {
  items:       NaemaItem[];
  selected:    number[];
  onToggle:    (id: number, nom: string) => void;
  placeholder: string;
  color:       string;
  disabled?:   boolean;
}) {
  const [open, setOpen] = useState(false);

  if (disabled) return (
    <div style={{
      background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 10,
      padding: "9px 14px", fontSize: 13, color: "#C5BFBB",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span>{placeholder}</span>
      <ChevronDown size={14} style={{ color: "#C5BFBB" }} />
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: "#F2F0EF", border: `1px solid ${open ? color : "#C5BFBB"}`,
          borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "#1a1a2e",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", transition: "border-color 0.2s",
        }}
      >
        <span style={{ color: selected.length ? "#1a1a2e" : "#9aa5b4" }}>
          {selected.length > 0 ? `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}` : placeholder}
        </span>
        {open ? <ChevronUp size={14} style={{ color }} /> : <ChevronDown size={14} style={{ color: "#9aa5b4" }} />}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "#fff", border: "1px solid #C5BFBB", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto",
        }}>
          {items.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "#9aa5b4" }}>Aucun élément</div>
          ) : (
            items.map(item => {
              const isSelected = selected.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => { onToggle(item.id, item.nom); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", cursor: "pointer",
                    background: isSelected ? color + "08" : "transparent",
                    borderBottom: "1px solid #F2F0EF",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#F8F7F6"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${isSelected ? color : "#C5BFBB"}`,
                    background: isSelected ? color : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isSelected && <X size={9} style={{ color: "#fff" }} />}
                  </div>
                  <span style={{ fontSize: 12, color: "#9aa5b4", minWidth: 60 }}>{item.code}</span>
                  <span style={{ fontSize: 13, color: "#1a1a2e", lineHeight: 1.3 }}>{item.nom}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Composant principal NaemaCascadeMulti ─────────────────────────────────────
export function NaemaCascadeMulti({
  onChange,
  initialSecteurs = [],
  initialBranches = [],
  initialActivites = [],
}: {
  onChange: (selection: { secteurs: string[]; branches: string[]; activites: string[] }) => void;
  initialSecteurs?:  string[];
  initialBranches?:  string[];
  initialActivites?: string[];
}) {
  // Data
  const [allSecteurs,  setAllSecteurs]  = useState<NaemaItem[]>([]);
  const [allBranches,  setAllBranches]  = useState<NaemaItem[]>([]);
  const [allActivites, setAllActivites] = useState<NaemaItem[]>([]);

  // Sélections (IDs)
  const [selSecIds, setSelSecIds] = useState<number[]>([]);
  const [selBraIds, setSelBraIds] = useState<number[]>([]);
  const [selActIds, setSelActIds] = useState<number[]>([]);

  // Branches/activités filtrées selon sélection
  const [filteredBranches,  setFilteredBranches]  = useState<NaemaItem[]>([]);
  const [filteredActivites, setFilteredActivites] = useState<NaemaItem[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/secteurs`)
      .then(r => r.json()).then(setAllSecteurs).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/branches`)
      .then(r => r.json()).then(setAllBranches).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/activites`)
      .then(r => r.json()).then(setAllActivites).catch(() => {});
  }, []);

  // Filtrer branches selon secteurs sélectionnés
  useEffect(() => {
    if (selSecIds.length > 0) {
      setFilteredBranches(allBranches.filter(b => selSecIds.includes(b.secteur_id)));
    } else {
      setFilteredBranches([]);
      setSelBraIds([]);
    }
  }, [selSecIds, allBranches]);

  // Filtrer activités selon branches sélectionnées
  useEffect(() => {
    if (selBraIds.length > 0) {
      setFilteredActivites(allActivites.filter(a => selBraIds.includes(a.branche_id)));
    } else {
      setFilteredActivites([]);
      setSelActIds([]);
    }
  }, [selBraIds, allActivites]);

  // Notifier parent
  useEffect(() => {
    const toNom = (ids: number[], list: NaemaItem[]) =>
      ids.map(id => list.find(i => i.id === id)?.nom || "").filter(Boolean);
    onChange({
      secteurs:  toNom(selSecIds, allSecteurs),
      branches:  toNom(selBraIds, allBranches),
      activites: toNom(selActIds, allActivites),
    });
  }, [selSecIds, selBraIds, selActIds]);

  const toggleSec = (id: number) =>
    setSelSecIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleBra = (id: number) =>
    setSelBraIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAct = (id: number) =>
    setSelActIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const COLORS = { sec: "#ca631f", bra: "#004f91", act: "#059669" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Secteurs */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 6, display: "block" }}>
          Secteur(s) d'activité
        </label>
        <MultiDropdown
          items={allSecteurs}
          selected={selSecIds}
          onToggle={toggleSec}
          placeholder="Sélectionner un ou plusieurs secteurs"
          color={COLORS.sec}
        />
        {selSecIds.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {selSecIds.map(id => {
              const s = allSecteurs.find(x => x.id === id);
              if (!s) return null;
              return <Tag key={id} label={s.nom} color={COLORS.sec} onRemove={() => toggleSec(id)} />;
            })}
          </div>
        )}
      </div>

      {/* Branches */}
      {selSecIds.length > 0 && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 6, display: "block" }}>
            Branche(s) d'activité
          </label>
          <MultiDropdown
            items={filteredBranches}
            selected={selBraIds}
            onToggle={toggleBra}
            placeholder="Sélectionner une ou plusieurs branches"
            color={COLORS.bra}
          />
          {selBraIds.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {selBraIds.map(id => {
                const b = allBranches.find(x => x.id === id);
                if (!b) return null;
                return <Tag key={id} label={b.nom} color={COLORS.bra} onRemove={() => toggleBra(id)} />;
              })}
            </div>
          )}
        </div>
      )}

      {/* Activités */}
      {selBraIds.length > 0 && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 6, display: "block" }}>
            Activité(s)
          </label>
          <MultiDropdown
            items={filteredActivites}
            selected={selActIds}
            onToggle={toggleAct}
            placeholder="Sélectionner une ou plusieurs activités"
            color={COLORS.act}
          />
          {selActIds.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {selActIds.map(id => {
                const a = allActivites.find(x => x.id === id);
                if (!a) return null;
                return <Tag key={id} label={a.nom} color={COLORS.act} onRemove={() => toggleAct(id)} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Version simple (select unique cascade) pour les formulaires admin ─────────
export function NaemaCascade({
  secteurVal, brancheVal, activiteVal,
  onSecteurChange, onBrancheChange, onActiviteChange,
  labelStyle, fieldStyle,
}: {
  secteurVal:       string | number;
  brancheVal:       string | number;
  activiteVal:      string | number;
  onSecteurChange:  (val: string, id?: number) => void;
  onBrancheChange:  (val: string, id?: number) => void;
  onActiviteChange: (val: string, id?: number) => void;
  labelStyle?: any;
  fieldStyle?: any;
}) {
  const [secteurs,  setSecteurs]  = useState<any[]>([]);
  const [branches,  setBranches]  = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);
  const [secteurId, setSecteurId] = useState<number|null>(null);
  const [brancheId, setBrancheId] = useState<number|null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/secteurs`)
      .then(r => r.json()).then(setSecteurs).catch(() => {});
  }, []);

  useEffect(() => {
    if (secteurId) {
      fetch(`${API_BASE}/entreprises/ref/branches?secteur_id=${secteurId}`)
        .then(r => r.json()).then(setBranches).catch(() => {});
    } else { setBranches([]); }
  }, [secteurId]);

  useEffect(() => {
    if (brancheId) {
      fetch(`${API_BASE}/entreprises/ref/activites?branche_id=${brancheId}`)
        .then(r => r.json()).then(setActivites).catch(() => {});
    } else { setActivites([]); }
  }, [brancheId]);

  const inputStyle = {
    width: "100%", background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e",
    outline: "none", fontFamily: "var(--font-google-sans)",
    cursor: "pointer", boxSizing: "border-box" as const,
  };
  const defLabel = { fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 4, display: "block" };
  const defField = { display: "flex", flexDirection: "column" as const, gap: 3 };

  return (
    <>
      <div style={fieldStyle || defField}>
        <label style={labelStyle || defLabel}>Secteur d'activité</label>
        <select
          value={secteurVal}
          onChange={e => {
            const sel = secteurs.find(s => s.nom === e.target.value);
            setSecteurId(sel?.id || null);
            setBrancheId(null);
            onSecteurChange(e.target.value, sel?.id);
            onBrancheChange("", undefined);
            onActiviteChange("", undefined);
          }}
          style={inputStyle}
        >
          <option value="">— Sélectionner —</option>
          {secteurs.map(s => <option key={s.id} value={s.nom}>{s.nom}</option>)}
        </select>
      </div>
      <div style={fieldStyle || defField}>
        <label style={labelStyle || defLabel}>Branche d'activité</label>
        <select
          value={brancheVal}
          onChange={e => {
            const sel = branches.find(b => b.nom === e.target.value);
            setBrancheId(sel?.id || null);
            onBrancheChange(e.target.value, sel?.id);
            onActiviteChange("", undefined);
          }}
          disabled={!branches.length}
          style={{ ...inputStyle, opacity: branches.length ? 1 : 0.5, cursor: branches.length ? "pointer" : "not-allowed" }}
        >
          <option value="">— Sélectionner —</option>
          {branches.map(b => <option key={b.id} value={b.nom}>{b.nom}</option>)}
        </select>
      </div>
      <div style={fieldStyle || defField}>
        <label style={labelStyle || defLabel}>Activité</label>
        <select
          value={activiteVal}
          onChange={e => {
            const sel = activites.find(a => a.nom === e.target.value);
            onActiviteChange(e.target.value, sel?.id);
          }}
          disabled={!activites.length}
          style={{ ...inputStyle, opacity: activites.length ? 1 : 0.5, cursor: activites.length ? "pointer" : "not-allowed" }}
        >
          <option value="">— Sélectionner —</option>
          {activites.map(a => <option key={a.id} value={a.nom}>{a.nom}</option>)}
        </select>
      </div>
    </>
  );
}
