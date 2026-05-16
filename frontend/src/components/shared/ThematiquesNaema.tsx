"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface NaemaItem { id: number; code: string; nom: string; secteur_id?: number; branche_id?: number; }

// ── Petit tag coloré ──────────────────────────────────────────────────────────
function Tag({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: color + "15", color, border: `1px solid ${color}30`,
      borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600,
      maxWidth: "100%",
    }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{label}</span>
      <button
        onClick={e => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}
      >
        <X size={10} style={{ color }} />
      </button>
    </span>
  );
}

// ── Dropdown multi-sélection avec cases à cocher ──────────────────────────────
function ColDropdown({
  title, items, selected, onToggle, color, disabled = false, placeholder, groupBy,
}: {
  title:       string;
  items:       NaemaItem[];
  selected:    number[];
  onToggle:    (id: number) => void;
  color:       string;
  disabled?:   boolean;
  placeholder: string;
  // groupBy : liste des groupes parents { id, nom } pour afficher un header par groupe
  groupBy?:    { id: number; nom: string }[];
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fermer quand disabled
  useEffect(() => { if (disabled) { setOpen(false); setSearch(""); } }, [disabled]);

  const filtered = items.filter(i =>
    i.nom.toLowerCase().includes(search.toLowerCase()) ||
    i.code?.toLowerCase().includes(search.toLowerCase())
  );

  // Construire les groupes si groupBy est fourni
  const renderList = () => {
    if (!groupBy || groupBy.length === 0) {
      // Pas de groupement — liste plate
      return filtered.map(item => renderItem(item));
    }

    // Grouper les items filtrés par parent (secteur_id ou branche_id)
    return groupBy.map(group => {
      const parentKey = items[0]?.secteur_id !== undefined ? "secteur_id" : "branche_id";
      const groupItems = filtered.filter(i => (i as any)[parentKey] === group.id);
      if (groupItems.length === 0) return null;
      return (
        <div key={group.id}>
          {/* Header du groupe */}
          <div style={{
            padding: "6px 12px 3px",
            fontSize: 10, fontWeight: 700,
            color: color, textTransform: "uppercase" as const,
            letterSpacing: "0.1em", background: color + "08",
            borderBottom: `1px solid ${color}20`,
          }}>
            {group.nom}
          </div>
          {groupItems.map(item => renderItem(item))}
        </div>
      );
    });
  };

  const renderItem = (item: NaemaItem) => {
    const isSel = selected.includes(item.id);
    return (
      <div
        key={item.id}
        onMouseDown={e => { e.preventDefault(); onToggle(item.id); }}
        style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "9px 12px", cursor: "pointer",
          background: isSel ? color + "0d" : "transparent",
          borderBottom: "1px solid #F8F7F6",
          transition: "background 0.1s",
        }}
        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F8F7F6"; }}
        onMouseLeave={e => { e.currentTarget.style.background = isSel ? color + "0d" : "transparent"; }}
      >
        {/* Checkbox */}
        <div style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
          border: `2px solid ${isSel ? color : "#C5BFBB"}`,
          background: isSel ? color : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.12s",
        }}>
          {isSel && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div>
          {item.code && (
            <div style={{ fontSize: 10, color: "#9aa5b4", fontWeight: 600, marginBottom: 1 }}>{item.code}</div>
          )}
          <div style={{ fontSize: 12, color: isSel ? "#1a1a2e" : "#4a5568", fontWeight: isSel ? 600 : 400, lineHeight: 1.3 }}>
            {item.nom}
          </div>
        </div>
      </div>
    );
  };

  const base = {
    background: "#F2F0EF", border: "1px solid #C5BFBB",
    borderRadius: 8, padding: "9px 12px", fontSize: 13,
    color: "#1a1a2e", outline: "none",
    fontFamily: "var(--font-google-sans)",
    width: "100%", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
      {/* Label colonne */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: disabled ? "#C5BFBB" : color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: disabled ? "#C5BFBB" : "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {title}
        </span>
        {selected.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "15", padding: "1px 6px", borderRadius: 999 }}>
            {selected.length}
          </span>
        )}
      </div>

      {/* Trigger */}
      <div ref={ref} style={{ position: "relative" }}>
        <div
          onClick={() => { if (!disabled) setOpen(o => !o); }}
          style={{
            ...base,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            border: `1px solid ${open ? color : "#C5BFBB"}`,
            transition: "border-color 0.2s",
          }}
        >
          <span style={{ color: selected.length > 0 ? color : "#9aa5b4", fontWeight: selected.length > 0 ? 600 : 400 }}>
            {disabled
              ? placeholder
              : selected.length > 0
                ? `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}`
                : placeholder
            }
          </span>
          {open
            ? <ChevronUp size={14} style={{ color, flexShrink: 0 }} />
            : <ChevronDown size={14} style={{ color: "#9aa5b4", flexShrink: 0 }} />
          }
        </div>

        {/* Dropdown */}
        {open && !disabled && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
            background: "#fff", border: `1px solid ${color}40`, borderRadius: 10,
            boxShadow: `0 8px 32px rgba(0,0,0,0.13)`,
            maxHeight: 280, overflowY: "auto",
          }}>
            {/* Recherche */}
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #F2F0EF", position: "sticky", top: 0, background: "#fff" }}>
              <input
                autoFocus
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...base, fontSize: 12, padding: "7px 10px" }}
              />
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: "12px", fontSize: 12, color: "#9aa5b4", textAlign: "center" }}>Aucun résultat</div>
            ) : renderList()}
          </div>
        )}
      </div>

      {/* Tags des sélections sous la colonne */}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map(id => {
            const item = items.find(i => i.id === id);
            return item ? (
              <Tag key={id} label={item.nom} color={color} onRemove={() => onToggle(id)} />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

// ── Composant principal — 3 colonnes horizontales ─────────────────────────────
export default function ThematiquesNaema({
  value,
  onChange,
}: {
  value:    string;                  // stocké en base : "Secteur1, Branche1, Activité1, ..."
  onChange: (val: string) => void;
}) {
  const [allSecteurs,  setAllSecteurs]  = useState<NaemaItem[]>([]);
  const [allBranches,  setAllBranches]  = useState<NaemaItem[]>([]);
  const [allActivites, setAllActivites] = useState<NaemaItem[]>([]);

  const [selSecIds, setSelSecIds] = useState<number[]>([]);
  const [selBraIds, setSelBraIds] = useState<number[]>([]);
  const [selActIds, setSelActIds] = useState<number[]>([]);

  const [loaded, setLoaded] = useState(false);

  // Charger les données
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/entreprises/ref/secteurs`).then(r => r.json()),
      fetch(`${API_BASE}/entreprises/ref/branches`).then(r => r.json()),
      fetch(`${API_BASE}/entreprises/ref/activites`).then(r => r.json()),
    ]).then(([sec, bra, act]) => {
      setAllSecteurs(sec);
      setAllBranches(bra);
      setAllActivites(act);
      setLoaded(true);
    }).catch(() => {});
  }, []);

  // Initialiser depuis la valeur existante (mode édition)
  useEffect(() => {
    if (!loaded || !value) return;
    const items = value.split(",").map(s => s.trim()).filter(Boolean);
    // Support ancien format (sans préfixe) et nouveau format (avec préfixe sec:/bra:/act:)
    const secNoms = items.filter(s => s.startsWith("sec:")).map(s => s.slice(4));
    const braNoms = items.filter(s => s.startsWith("bra:")).map(s => s.slice(4));
    const actNoms = items.filter(s => s.startsWith("act:")).map(s => s.slice(4));
    // Fallback ancien format : essayer de matcher dans les 3 listes
    const noPrefix = items.filter(s => !s.startsWith("sec:") && !s.startsWith("bra:") && !s.startsWith("act:"));
    const secIds = allSecteurs.filter(s => secNoms.includes(s.nom) || noPrefix.includes(s.nom)).map(s => s.id);
    const braIds = allBranches.filter(b => braNoms.includes(b.nom) || noPrefix.includes(b.nom)).map(b => b.id);
    const actIds = allActivites.filter(a => actNoms.includes(a.nom) || noPrefix.includes(a.nom)).map(a => a.id);
    setSelSecIds(secIds);
    setSelBraIds(braIds);
    setSelActIds(actIds);
  }, [loaded]);

  // Branches et activités filtrées selon la sélection parent
  const filteredBranches  = allBranches.filter(b => selSecIds.includes(b.secteur_id!));
  const filteredActivites = allActivites.filter(a => selBraIds.includes(a.branche_id!));

  // Mettre à jour onChange à chaque changement
  const emitChange = (secIds: number[], braIds: number[], actIds: number[]) => {
    const toNom = (ids: number[], list: NaemaItem[], prefix: string) =>
      ids.map(id => list.find(i => i.id === id)?.nom || "").filter(Boolean).map(n => `${prefix}${n}`);
    const tous = [
      ...toNom(secIds, allSecteurs, "sec:"),
      ...toNom(braIds, allBranches, "bra:"),
      ...toNom(actIds, allActivites, "act:"),
    ];
    onChange(tous.join(", "));
  };

  const toggleSec = (id: number) => {
    const next = selSecIds.includes(id) ? selSecIds.filter(x => x !== id) : [...selSecIds, id];
    // Nettoyer branches orphelines
    const validBra = selBraIds.filter(bid => {
      const b = allBranches.find(b => b.id === bid);
      return b && next.includes(b.secteur_id!);
    });
    // Nettoyer activités orphelines
    const validAct = selActIds.filter(aid => {
      const a = allActivites.find(a => a.id === aid);
      return a && validBra.includes(a.branche_id!);
    });
    setSelSecIds(next);
    setSelBraIds(validBra);
    setSelActIds(validAct);
    emitChange(next, validBra, validAct);
  };

  const toggleBra = (id: number) => {
    const next = selBraIds.includes(id) ? selBraIds.filter(x => x !== id) : [...selBraIds, id];
    const validAct = selActIds.filter(aid => {
      const a = allActivites.find(a => a.id === aid);
      return a && next.includes(a.branche_id!);
    });
    setSelBraIds(next);
    setSelActIds(validAct);
    emitChange(selSecIds, next, validAct);
  };

  const toggleAct = (id: number) => {
    const next = selActIds.includes(id) ? selActIds.filter(x => x !== id) : [...selActIds, id];
    setSelActIds(next);
    emitChange(selSecIds, selBraIds, next);
  };

  const COLORS = { sec: "#ca631f", bra: "#004f91", act: "#059669" };

  return (
    <div style={{
      border: "1px solid #E8E5E3", borderRadius: 12,
      padding: 16, background: "#FAFAF9",
    }}>
      {/* 3 colonnes horizontales */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "start" }}>

        <ColDropdown
          title="Secteurs"
          items={allSecteurs}
          selected={selSecIds}
          onToggle={toggleSec}
          color={COLORS.sec}
          placeholder="Sélectionner"
        />

        <ColDropdown
          title="Branches"
          items={filteredBranches}
          selected={selBraIds}
          onToggle={toggleBra}
          color={COLORS.bra}
          disabled={selSecIds.length === 0}
          placeholder={selSecIds.length === 0 ? "Choisir un secteur d'abord" : "Sélectionner"}
          groupBy={allSecteurs.filter(s => selSecIds.includes(s.id)).map(s => ({ id: s.id, nom: s.nom }))}
        />

        <ColDropdown
          title="Activités"
          items={filteredActivites}
          selected={selActIds}
          onToggle={toggleAct}
          color={COLORS.act}
          disabled={selBraIds.length === 0}
          placeholder={selBraIds.length === 0 ? "Choisir une branche d'abord" : "Sélectionner"}
          groupBy={allBranches.filter(b => selBraIds.includes(b.id)).map(b => ({ id: b.id, nom: b.nom }))}
        />

      </div>
    </div>
  );
}
