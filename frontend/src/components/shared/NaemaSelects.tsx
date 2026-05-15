"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronDown, ChevronUp, Filter } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface NaemaItem { id: number; code: string; nom: string; secteur_id?: number; branche_id?: number; }

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
  { items: NaemaItem[]; selected: number[]; onToggle: (id: number) => void; placeholder: string; color: string; disabled?: boolean; }
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
          boxShadow: `0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px ${color}15`,
          maxHeight: 260, overflowY: "auto",
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
                <span style={{ fontSize: 11, color: "#9aa5b4", minWidth: 55, flexShrink: 0 }}>{item.code}</span>
                <span style={{ fontSize: 13, color: isSelected ? "#1a1a2e" : "#4a5568", lineHeight: 1.3, fontWeight: isSelected ? 600 : 400 }}>{item.nom}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── NaemaCascadeMulti — état interne complet, onChange sur bouton Appliquer ───
export function NaemaCascadeMulti({
  onChange,
}: {
  onChange: (selection: { secteurs: string[]; branches: string[]; activites: string[] }) => void;
}) {
  const [allSecteurs,  setAllSecteurs]  = useState<NaemaItem[]>([]);
  const [allBranches,  setAllBranches]  = useState<NaemaItem[]>([]);
  const [allActivites, setAllActivites] = useState<NaemaItem[]>([]);

  // États internes — JAMAIS réinitialisés par le parent
  const [selSecIds, setSelSecIds] = useState<number[]>([]);
  const [selBraIds, setSelBraIds] = useState<number[]>([]);
  const [selActIds, setSelActIds] = useState<number[]>([]);

  const filteredBranches  = allBranches.filter(b => selSecIds.includes(b.secteur_id!));
  const filteredActivites = allActivites.filter(a => selBraIds.includes(a.branche_id!));

  useEffect(() => {
    fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r => r.json()).then(setAllSecteurs).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/branches`).then(r => r.json()).then(setAllBranches).catch(() => {});
    fetch(`${API_BASE}/entreprises/ref/activites`).then(r => r.json()).then(setAllActivites).catch(() => {});
  }, []);

  const toggleSec = (id: number) => {
    const next = selSecIds.includes(id) ? selSecIds.filter(x => x !== id) : [...selSecIds, id];
    setSelSecIds(next);
    // Nettoyer branches/activités orphelines
    const validBra = selBraIds.filter(bid => {
      const b = allBranches.find(b => b.id === bid);
      return b && next.includes(b.secteur_id!);
    });
    setSelBraIds(validBra);
    const validAct = selActIds.filter(aid => {
      const a = allActivites.find(a => a.id === aid);
      return a && validBra.includes(a.branche_id!);
    });
    setSelActIds(validAct);
  };

  const toggleBra = (id: number) => {
    const next = selBraIds.includes(id) ? selBraIds.filter(x => x !== id) : [...selBraIds, id];
    setSelBraIds(next);
    const validAct = selActIds.filter(aid => {
      const a = allActivites.find(a => a.id === aid);
      return a && next.includes(a.branche_id!);
    });
    setSelActIds(validAct);
  };

  const toggleAct = (id: number) => {
    setSelActIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const appliquer = () => {
    const toNom = (ids: number[], list: NaemaItem[]) =>
      ids.map(id => list.find(i => i.id === id)?.nom || "").filter(Boolean);
    onChange({
      secteurs:  toNom(selSecIds, allSecteurs),
      branches:  toNom(selBraIds, allBranches),
      activites: toNom(selActIds, allActivites),
    });
  };

  const reinitialiser = () => {
    setSelSecIds([]); setSelBraIds([]); setSelActIds([]);
    onChange({ secteurs: [], branches: [], activites: [] });
  };

  const totalSelection = selSecIds.length + selBraIds.length + selActIds.length;
  const COLORS = { sec: "#ca631f", bra: "#004f91", act: "#059669" };

  return (
    <div style={{ border: "1px solid #E8E5E3", borderRadius: 12, padding: 16, background: "#FAFAF9" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Filter size={13} style={{ color: "#ca631f" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Filtrer par activité NAEMA
          </span>
          {totalSelection > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ca631f", background: "rgba(202,99,31,0.12)", padding: "2px 8px", borderRadius: 999 }}>
              {totalSelection} filtre{totalSelection > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {totalSelection > 0 && (
          <button onClick={reinitialiser} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Réinitialiser
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Secteurs */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, display: "block" }}>
            Secteur(s)
          </label>
          <MultiDropdown
            items={allSecteurs} selected={selSecIds} onToggle={toggleSec}
            placeholder="Tous les secteurs" color={COLORS.sec}
          />
          {selSecIds.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
              {selSecIds.map(id => {
                const s = allSecteurs.find(x => x.id === id);
                return s ? <Tag key={id} label={s.nom} color={COLORS.sec} onRemove={() => toggleSec(id)} /> : null;
              })}
            </div>
          )}
        </div>

        {/* Branches */}
        {selSecIds.length > 0 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, display: "block" }}>
              Branche(s)
            </label>
            <MultiDropdown
              items={filteredBranches} selected={selBraIds} onToggle={toggleBra}
              placeholder="Toutes les branches" color={COLORS.bra}
            />
            {selBraIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                {selBraIds.map(id => {
                  const b = allBranches.find(x => x.id === id);
                  return b ? <Tag key={id} label={b.nom} color={COLORS.bra} onRemove={() => toggleBra(id)} /> : null;
                })}
              </div>
            )}
          </div>
        )}

        {/* Activités */}
        {selBraIds.length > 0 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, display: "block" }}>
              Activité(s)
            </label>
            <MultiDropdown
              items={filteredActivites} selected={selActIds} onToggle={toggleAct}
              placeholder="Toutes les activités" color={COLORS.act}
            />
            {selActIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                {selActIds.map(id => {
                  const a = allActivites.find(x => x.id === id);
                  return a ? <Tag key={id} label={a.nom} color={COLORS.act} onRemove={() => toggleAct(id)} /> : null;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bouton Appliquer */}
      {totalSelection > 0 && (
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
            <Filter size={13} /> Appliquer les filtres
          </button>
        </div>
      )}
    </div>
  );
}

// ── NaemaCascade — sélection unique pour formulaires admin ────────────────────
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
    fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r => r.json()).then(data => {
      setSecteurs(data);
      // Initialiser secteurId si une valeur existe déjà
      if (secteurVal) {
        const sel = data.find((s: any) => s.nom === secteurVal);
        if (sel) setSecteurId(sel.id);
      }
    }).catch(() => {});
  }, []);

  // Initialiser brancheId quand secteurId est connu et brancheVal existe
  useEffect(() => {
    if (secteurId && brancheVal && branches.length > 0) {
      const sel = branches.find((b: any) => b.nom === brancheVal);
      if (sel) setBrancheId(sel.id);
    }
  }, [secteurId, branches, brancheVal]);
  useEffect(() => {
    if (secteurId) fetch(`${API_BASE}/entreprises/ref/branches?secteur_id=${secteurId}`).then(r => r.json()).then(setBranches).catch(() => {});
    else setBranches([]);
  }, [secteurId]);
  useEffect(() => {
    if (brancheId) fetch(`${API_BASE}/entreprises/ref/activites?branche_id=${brancheId}`).then(r => r.json()).then(setActivites).catch(() => {});
    else setActivites([]);
  }, [brancheId]);

  const s = { width: "100%", background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", cursor: "pointer", boxSizing: "border-box" as const };
  const dL = { fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 4, display: "block" };
  const dF = { display: "flex", flexDirection: "column" as const, gap: 3 };

  return (
    <>
      <div style={fieldStyle || dF}>
        <label style={labelStyle || dL}>Secteur d'activité</label>
        <select value={secteurVal} onChange={e => { const sel = secteurs.find(x => x.nom === e.target.value); setSecteurId(sel?.id||null); setBrancheId(null); onSecteurChange(e.target.value, sel?.id); onBrancheChange(""); onActiviteChange(""); }} style={s}>
          <option value="">— Sélectionner —</option>
          {secteurs.map(x => <option key={x.id} value={x.nom}>{x.nom}</option>)}
        </select>
      </div>
      <div style={fieldStyle || dF}>
        <label style={labelStyle || dL}>Branche d'activité</label>
        <select value={brancheVal} onChange={e => { const sel = branches.find(x => x.nom === e.target.value); setBrancheId(sel?.id||null); onBrancheChange(e.target.value, sel?.id); onActiviteChange(""); }} disabled={!branches.length} style={{ ...s, opacity: branches.length ? 1 : 0.5, cursor: branches.length ? "pointer" : "not-allowed" }}>
          <option value="">— Sélectionner —</option>
          {branches.map(x => <option key={x.id} value={x.nom}>{x.nom}</option>)}
        </select>
      </div>
      <div style={fieldStyle || dF}>
        <label style={labelStyle || dL}>Activité</label>
        <select value={activiteVal} onChange={e => { const sel = activites.find(x => x.nom === e.target.value); onActiviteChange(e.target.value, sel?.id); }} disabled={!activites.length} style={{ ...s, opacity: activites.length ? 1 : 0.5, cursor: activites.length ? "pointer" : "not-allowed" }}>
          <option value="">— Sélectionner —</option>
          {activites.map(x => <option key={x.id} value={x.nom}>{x.nom}</option>)}
        </select>
      </div>
    </>
  );
}
