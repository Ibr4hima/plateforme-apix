"use client";

import { ArrowUpDown, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { API_BASE as API } from "@/lib/api";
const ROWS_OPTIONS = [7, 15, 25, 50, 100, "Tout"];

// ─── Détection types de colonne ───────────────────────────────────────────────
function isNumeric(v: any) {
  return v !== null && v !== undefined && v !== "" && !isNaN(Number(v));
}

function isYear(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1900 && n <= 2100;
}

function isPercentCol(col: string) {
  return col.includes("%");
}

function isRankCol(col: string) {
  return /rang|rank/i.test(col);
}

function isBadgeCol(col: string) {
  return /statut|profil|niveau|concentration/i.test(col);
}

function isNumericCol(col: string, data: any[]) {
  return data.some(row => isNumeric(row[col]) && !isYear(row[col]) && Number(row[col]) !== 0);
}

// ─── Formatage des valeurs ────────────────────────────────────────────────────
function formatValue(v: any, col: string): string {
  if (v === null || v === undefined || v === "") return "—";
  const str = String(v);

  // Pourcentage → afficher tel quel avec %
  if (isPercentCol(col)) {
    const n = Number(v);
    return isNaN(n) ? str : `${n.toLocaleString("fr-FR")} %`;
  }

  // Année → pas de séparateur
  if (isNumeric(v) && isYear(v)) return str;

  // Nombre décimal
  if (isNumeric(v)) {
    const n = Number(v);
    if (!Number.isInteger(n)) return n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    // Entier avec séparateurs de milliers
    return n.toLocaleString("fr-FR");
  }

  return str;
}

// ─── Badge coloré ────────────────────────────────────────────────────────────
function Badge({ value }: { value: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    "vide":              { bg: "var(--danger-voile)", color: "var(--danger)" },
    "pleine":            { bg: "var(--vert-voile)", color: "var(--vert-fonce)" },
    "partielle":         { bg: "var(--alerte-voile)", color: "var(--orange)" },
    "en attente":        { bg: "var(--bleu-voile)", color: "var(--gris-fort)" },
    "terminé":           { bg: "var(--bleu-voile)", color: "var(--gris-fort)" },
    "en cours":          { bg: "var(--bleu-voile)", color: "var(--bleu)" },
    "non démarré":       { bg: "var(--alerte-voile)", color: "var(--orange)" },
    "très concentrée":   { bg: "var(--rose-voile)", color: "var(--rose)" },
    "très spécialisée":  { bg: "var(--rose-voile)", color: "var(--rose)" },
    "concentrée":        { bg: "var(--danger-voile)", color: "var(--danger)" },
    "spécialisée":       { bg: "var(--danger-voile)", color: "var(--danger)" },
    "modérée":           { bg: "var(--alerte-voile)", color: "var(--orange)" },
    "diversifiée":       { bg: "var(--vert-voile)", color: "var(--vert-fonce)" },
    "nouvelle":          { bg: "var(--bleu-voile)", color: "var(--bleu)" },
  };
  const lower = value.toLowerCase();
  const style = Object.entries(map).find(([k]) => lower.includes(k))?.[1];
  if (!style) return <span style={{ fontSize: 12 }}>{value}</span>;
  return (
    <span style={{ ...style, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

interface AnalyticTableProps {
  tableId: string;
  titre: string;
  description?: string;
  onClose?: () => void;
  embedded?: boolean;
}

export function AnalyticTable({ tableId, titre, description, onClose, embedded }: AnalyticTableProps) {
  const [data, setData]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [search, setSearch]       = useState("");
  const [sortCol, setSortCol]     = useState<string | null>(null);
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");
  const [rowsLimit, setRowsLimit] = useState<number | "Tout">(7);

  useEffect(() => {
    setLoading(true); setError(false); setSearch(""); setSortCol(null); setRowsLimit(7);
    fetch(`${API}/dashboard/tables/${tableId}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tableId]);

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  // Pré-calculer le type de chaque colonne une seule fois
  const colMeta = useMemo(() => {
    return Object.fromEntries(columns.map(col => {
      const isNum   = isNumericCol(col, data);
      const isRank  = isRankCol(col);
      const isBadge = isBadgeCol(col);
      const isPct   = isPercentCol(col);
      // Aligner à droite : nombres, rangs, pourcentages
      const alignRight = (isNum || isRank || isPct) && !isBadge;
      return [col, { isNum, isRank, isBadge, isPct, alignRight }];
    }));
  }, [columns, data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q)));
  }, [data, search]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (isNumeric(av) && isNumeric(bv))
        return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
      return sortDir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""), "fr")
        : String(bv ?? "").localeCompare(String(av ?? ""), "fr");
    });
  }, [filtered, sortCol, sortDir]);

  const displayed = rowsLimit === "Tout" ? sorted : sorted.slice(0, rowsLimit as number);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  // Export XLSX — compatible Excel Mac/Windows/Linux
  const exportXLSX = async () => {
    // SheetJS chargé à la demande (~400 Ko) : uniquement au clic Export
    const XLSX = await import("xlsx");
    // Construire les données avec les valeurs formatées pour l'affichage
    const sheetData = [
      columns, // entête
      ...sorted.map(row =>
        columns.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return "";
          // Garder les nombres comme nombres dans Excel
          if (isNumeric(v) && !isYear(v)) return Number(v);
          return String(v);
        })
      )
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Largeur auto des colonnes
    const colWidths = columns.map((col, ci) => {
      const maxLen = Math.max(
        col.length,
        ...sorted.slice(0, 50).map(row => String(row[col] ?? "").length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, titre.slice(0, 31));
    XLSX.writeFile(wb, `${tableId}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Export CSV — fallback compatible Numbers/Google Sheets
  const exportCSV = () => {
    const BOM = "\uFEFF";
    const header = columns.join(",");
    const csvRows = sorted.map(row =>
      columns.map(c => {
        const v = row[c];
        if (v === null || v === undefined) return "";
        const str = String(v);
        if (str.includes(",") || str.includes('"') || str.includes("\n"))
          return `"${str.replace(/"/g, '""')}"`; 
        return str;
      }).join(",")
    );
    const csv = BOM + [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tableId}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column" as const,
      background: "var(--carte)", width: "100%",
      borderRadius: embedded ? 0 : 14,
      border: embedded ? "none" : "1px solid var(--bordure)",
      boxShadow: embedded ? "none" : "var(--ombre-1)",
      overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <div style={{ padding: "16px 20px 14px", background: "var(--carte)", borderBottom: "1px solid var(--bordure)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: "var(--encre)", margin: 0, minWidth: 0 }}>{titre}</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <div style={{ position: "relative" as const }}>
              <Search size={12} style={{ position: "absolute" as const, left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--gris)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                style={{ width: 150, paddingLeft: 27, paddingRight: 22, paddingTop: 6, paddingBottom: 6, borderRadius: 9, border: "1px solid var(--bordure-forte)", background: "var(--carte-douce)", fontSize: 11.5, color: "var(--encre)", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const, transition: "border-color 0.15s, background 0.15s" }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgb(var(--bleu-rgb) / 0.45)"; e.currentTarget.style.background = "var(--carte)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "var(--bordure-forte)"; e.currentTarget.style.background = "var(--carte-douce)"; }} />
              {search && <button onClick={() => setSearch("")}
                style={{ position: "absolute" as const, right: 7, top: "50%", transform: "translateY(-50%)", background: "var(--fond-creux2)", border: "none", cursor: "pointer", padding: 2, borderRadius: "50%", display: "flex" }}>
                <X size={8} style={{ color: "var(--texte)" }} />
              </button>}
            </div>
            <button onClick={exportXLSX} title={`Exporter ${sorted.length} lignes en Excel`}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                background: "var(--bleu-action)", border: "none", borderRadius: 9, boxShadow: "0 3px 12px rgb(var(--ombre-rgb) / 0.25)",
                cursor: "pointer", fontSize: 11.5, color: "var(--sur-bleu)", fontWeight: 700, fontFamily: "var(--font-google-sans)" }}>
              <FileSpreadsheet size={12} /> Excel
            </button>
            {onClose && (
              <button onClick={onClose}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--champ)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--fond-creux2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--champ)"; }}>
                <X size={13} color="var(--texte)" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 50, gap: 10, color: "var(--gris)" }}>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Chargement…</span>
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center" as const }}>
            <p style={{ fontSize: 13, color: "var(--danger)" }}>Erreur lors du chargement.</p>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 50, textAlign: "center" as const }}>
            <p style={{ fontSize: 13, color: "var(--gris)" }}>
              {search ? `Aucun résultat pour "${search}"` : "Aucune donnée disponible."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
            <thead>
              <tr style={{ background: "var(--carte-douce)" }}>
                {columns.map(col => {
                  const { alignRight } = colMeta[col] || {};
                  const active = sortCol === col;
                  return (
                    <th key={col} onClick={() => toggleSort(col)}
                      style={{
                        padding: "11px 16px",
                        textAlign: alignRight ? "right" as const : "left" as const,
                        fontSize: 10, fontWeight: 800, color: active ? "var(--bleu)" : "var(--texte)",
                        textTransform: "uppercase" as const, letterSpacing: "0.1em",
                        whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" as const,
                        background: active ? "rgb(var(--bleu-rgb) / 0.04)" : "var(--carte-douce)",
                        borderBottom: active ? "2px solid var(--bleu)" : "1px solid var(--bordure)",
                        position: "sticky" as const, top: 0, zIndex: 1,
                        transition: "background 0.12s, color 0.12s",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5,
                        justifyContent: alignRight ? "flex-end" as const : "flex-start" as const }}>
                        <span>{col}</span>
                        {active
                          ? (sortDir === "asc"
                            ? <ChevronUp size={11} color="var(--bleu)" />
                            : <ChevronDown size={11} color="var(--bleu)" />)
                          : <ArrowUpDown size={10} color="var(--gris)" />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayed.map((row, i) => (
                <tr key={i}
                  style={{ borderBottom: "1px solid var(--filet)", background: "var(--carte)", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--carte-douce)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--carte)")}>
                  {columns.map(col => {
                    const v = row[col];
                    const { isNum, isRank, isBadge, alignRight } = colMeta[col] || {};
                    const negatif = isNum && isNumeric(v) && Number(v) < 0;
                    return (
                      <td key={col} style={{
                        padding: "9px 16px",
                        textAlign: alignRight ? "right" as const : "left" as const,
                        color: negatif ? "var(--danger)" : "var(--texte)",
                        fontWeight: isNum || isRank ? 600 : 500,
                        whiteSpace: "nowrap",
                        fontVariantNumeric: (isNum || isRank) ? "tabular-nums" : "normal",
                      }}>
                        {isBadge && v ? <Badge value={String(v)} /> : formatValue(v, col)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ── */}
      {!loading && !error && sorted.length > 0 && (
        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--bordure)",
          display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--carte-douce)" }}>
          <span style={{ fontSize: 11, color: "var(--gris)" }}>
            {displayed.length.toLocaleString("fr-FR")} / {sorted.length.toLocaleString("fr-FR")} ligne{sorted.length !== 1 ? "s" : ""}
            {search ? ` · filtrées sur ${data.length.toLocaleString("fr-FR")}` : ""}
          </span>
          {rowsLimit !== "Tout" && sorted.length > (rowsLimit as number) && (
            <button onClick={() => setRowsLimit("Tout")}
              style={{ fontSize: 11, fontWeight: 700, color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.06)",
                border: "1px solid rgb(var(--bleu-rgb) / 0.18)", borderRadius: 999, padding: "4px 12px", cursor: "pointer",
                fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.06)"; }}>
              Voir tout ({sorted.length.toLocaleString("fr-FR")})
            </button>
          )}
          {rowsLimit === "Tout" && (
            <button onClick={() => setRowsLimit(7)}
              style={{ fontSize: 11, fontWeight: 600, color: "var(--texte)", background: "var(--carte)",
                border: "1px solid var(--bordure-forte)", borderRadius: 999, padding: "4px 12px", cursor: "pointer",
                fontFamily: "var(--font-google-sans)" }}>
              Réduire
            </button>
          )}
        </div>
      )}
    </div>
  );
}
