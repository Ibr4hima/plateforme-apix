"use client";

import { ArrowUpDown, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, Search, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useEffect, useMemo, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
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
    "vide":              { bg: "#fee2e2", color: "#dc2626" },
    "pleine":            { bg: "#dcfce7", color: "#15803d" },
    "partielle":         { bg: "#fef9c3", color: "#a16207" },
    "en attente":        { bg: "#f1f5f9", color: "#64748b" },
    "terminé":           { bg: "#f1f5f9", color: "#64748b" },
    "en cours":          { bg: "#dbeafe", color: "#1d4ed8" },
    "non démarré":       { bg: "#fef9c3", color: "#a16207" },
    "très concentrée":   { bg: "#fce7f3", color: "#be185d" },
    "très spécialisée":  { bg: "#fce7f3", color: "#be185d" },
    "concentrée":        { bg: "#fee2e2", color: "#dc2626" },
    "spécialisée":       { bg: "#fee2e2", color: "#dc2626" },
    "modérée":           { bg: "#fef9c3", color: "#a16207" },
    "diversifiée":       { bg: "#dcfce7", color: "#15803d" },
    "nouvelle":          { bg: "#dbeafe", color: "#1d4ed8" },
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
  const exportXLSX = () => {
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
      background: "#fff", width: "100%",
      borderRadius: embedded ? 0 : 14,
      border: embedded ? "none" : "1px solid #ECEAE7",
      boxShadow: embedded ? "none" : "0 1px 3px rgba(0,0,0,0.03)",
      overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <div style={{ padding: "16px 20px 14px", background: "#fff", borderBottom: "1px solid #F2F0EF" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>{titre}</h2>
            {description && <p style={{ fontSize: 11.5, color: "#9aa5b4", marginTop: 3, lineHeight: 1.45 }}>{description}</p>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <div style={{ position: "relative" as const }}>
              <Search size={12} style={{ position: "absolute" as const, left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                style={{ width: 150, paddingLeft: 27, paddingRight: 22, paddingTop: 6, paddingBottom: 6, borderRadius: 9, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 11.5, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" as const, transition: "border-color 0.15s, background 0.15s" }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,79,145,0.45)"; e.currentTarget.style.background = "#fff"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#E8E5E3"; e.currentTarget.style.background = "#F8F7F6"; }} />
              {search && <button onClick={() => setSearch("")}
                style={{ position: "absolute" as const, right: 7, top: "50%", transform: "translateY(-50%)", background: "#ECEAE8", border: "none", cursor: "pointer", padding: 2, borderRadius: "50%", display: "flex" }}>
                <X size={8} style={{ color: "#4a5568" }} />
              </button>}
            </div>
            <button onClick={exportXLSX} title={`Exporter ${sorted.length} lignes en Excel`}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                background: "#004f91", border: "none", borderRadius: 9, boxShadow: "0 3px 12px rgba(0,79,145,0.25)",
                cursor: "pointer", fontSize: 11.5, color: "#fff", fontWeight: 700, fontFamily: "var(--font-google-sans)" }}>
              <FileSpreadsheet size={12} /> Excel
            </button>
            {onClose && (
              <button onClick={onClose}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#F5F4F3"; }}>
                <X size={13} color="#4a5568" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 50, gap: 10, color: "#9aa5b4" }}>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Chargement…</span>
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center" as const }}>
            <p style={{ fontSize: 13, color: "#dc2626" }}>Erreur lors du chargement.</p>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 50, textAlign: "center" as const }}>
            <p style={{ fontSize: 13, color: "#9aa5b4" }}>
              {search ? `Aucun résultat pour "${search}"` : "Aucune donnée disponible."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
            <thead>
              <tr style={{ background: "#FAFAF9" }}>
                {columns.map(col => {
                  const { alignRight } = colMeta[col] || {};
                  const active = sortCol === col;
                  return (
                    <th key={col} onClick={() => toggleSort(col)}
                      style={{
                        padding: "11px 16px",
                        textAlign: alignRight ? "center" as const : "left" as const,
                        fontSize: 10, fontWeight: 800, color: active ? "#004f91" : "#4a5568",
                        textTransform: "uppercase" as const, letterSpacing: "0.1em",
                        whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" as const,
                        background: active ? "rgba(0,79,145,0.04)" : "#FAFAF9",
                        borderBottom: active ? "2px solid #004f91" : "1px solid #F0EEEC",
                        position: "sticky" as const, top: 0, zIndex: 1,
                        transition: "background 0.12s, color 0.12s",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5,
                        justifyContent: alignRight ? "center" as const : "flex-start" as const }}>
                        <span>{col}</span>
                        {active
                          ? (sortDir === "asc"
                            ? <ChevronUp size={11} color="#004f91" />
                            : <ChevronDown size={11} color="#004f91" />)
                          : <ArrowUpDown size={10} color="#C5BFBB" />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayed.map((row, i) => (
                <tr key={i}
                  style={{ borderBottom: "1px solid #F6F4F3", background: "#fff", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#FAFAF9")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                  {columns.map(col => {
                    const v = row[col];
                    const { isNum, isRank, isBadge, alignRight } = colMeta[col] || {};
                    const negatif = isNum && isNumeric(v) && Number(v) < 0;
                    return (
                      <td key={col} style={{
                        padding: "9px 16px",
                        textAlign: alignRight ? "center" as const : "left" as const,
                        color: negatif ? "#dc2626" : "#4a5568",
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
        <div style={{ padding: "10px 20px", borderTop: "1px solid #F2F0EF",
          display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FCFBFA" }}>
          <span style={{ fontSize: 11, color: "#9aa5b4" }}>
            {displayed.length.toLocaleString("fr-FR")} / {sorted.length.toLocaleString("fr-FR")} ligne{sorted.length !== 1 ? "s" : ""}
            {search ? ` · filtrées sur ${data.length.toLocaleString("fr-FR")}` : ""}
          </span>
          {rowsLimit !== "Tout" && sorted.length > (rowsLimit as number) && (
            <button onClick={() => setRowsLimit("Tout")}
              style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.06)",
                border: "1px solid rgba(0,79,145,0.18)", borderRadius: 999, padding: "4px 12px", cursor: "pointer",
                fontFamily: "var(--font-google-sans)", transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,79,145,0.06)"; }}>
              Voir tout ({sorted.length.toLocaleString("fr-FR")})
            </button>
          )}
          {rowsLimit === "Tout" && (
            <button onClick={() => setRowsLimit(7)}
              style={{ fontSize: 11, fontWeight: 600, color: "#4a5568", background: "#fff",
                border: "1px solid #E4E1DE", borderRadius: 999, padding: "4px 12px", cursor: "pointer",
                fontFamily: "var(--font-google-sans)" }}>
              Réduire
            </button>
          )}
        </div>
      )}
    </div>
  );
}
