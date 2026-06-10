"use client";

import { ArrowUpDown, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, X } from "lucide-react";
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
      borderRadius: embedded ? 0 : 20,
      border: embedded ? "none" : "1px solid #e2e8f0",
      boxShadow: embedded ? "none" : "0 8px 32px rgba(0,0,0,0.12)",
      overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <div style={{ padding: "18px 20px 14px", background: "#fff", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{titre}</h2>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <button onClick={exportXLSX} title={`Exporter ${sorted.length} lignes en Excel`}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8,
                cursor: "pointer", fontSize: 11, color: "#15803d", fontWeight: 600 }}>
              <FileSpreadsheet size={11} /> Excel
            </button>
            {onClose && (
              <button onClick={onClose}
                style={{ background: "#f1f5f9", border: "none", cursor: "pointer", borderRadius: 8, padding: 7 }}>
                <X size={13} color="#64748b" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 50, gap: 10, color: "#94a3b8" }}>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Chargement…</span>
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center" as const }}>
            <p style={{ fontSize: 13, color: "#dc2626" }}>Erreur lors du chargement.</p>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 50, textAlign: "center" as const }}>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>
              {search ? `Aucun résultat pour "${search}"` : "Aucune donnée disponible."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {columns.map(col => {
                  const { alignRight } = colMeta[col] || {};
                  return (
                    <th key={col} onClick={() => toggleSort(col)}
                      style={{
                        padding: "10px 16px",
                        // Aligner header selon type de colonne
                        textAlign: alignRight ? "center" as const : "left" as const,
                        fontSize: 11, fontWeight: 700, color: "#64748b",
                        textTransform: "uppercase" as const, letterSpacing: "0.05em",
                        whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" as const,
                        background: sortCol === col ? "#f0f7ff" : "#f8fafc",
                        borderBottom: sortCol === col ? "2px solid #004f91" : "2px solid #e2e8f0",
                        position: "sticky" as const, top: 0, zIndex: 1,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5,
                        justifyContent: alignRight ? "center" as const : "flex-start" as const }}>
                        <span>{col}</span>
                        {sortCol === col
                          ? (sortDir === "asc"
                            ? <ChevronUp size={11} color="#004f91" />
                            : <ChevronDown size={11} color="#004f91" />)
                          : <ArrowUpDown size={10} color="#cbd5e1" />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayed.map((row, i) => (
                <tr key={i}
                  style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f0f7ff")}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafbfc")}>
                  {columns.map((col, ci) => {
                    const v = row[col];
                    const { isNum, isRank, isBadge, alignRight } = colMeta[col] || {};
                    return (
                      <td key={col} style={{
                        padding: "9px 16px",
                        textAlign: alignRight ? "center" as const : "left" as const,
                        color: isNum ? "#004f91" : isRank ? "#334155" : "#334155",
                        fontWeight: isNum || isRank ? 700 : 400,
                        whiteSpace: "nowrap",
                        borderLeft: ci === 0 ? "3px solid transparent" : "none",
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
        <div style={{ padding: "10px 20px", borderTop: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafbfc" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {displayed.length.toLocaleString("fr-FR")} / {sorted.length.toLocaleString("fr-FR")} ligne{sorted.length !== 1 ? "s" : ""}
            {search ? ` · filtrées sur ${data.length.toLocaleString("fr-FR")}` : ""}
          </span>
          {rowsLimit !== "Tout" && sorted.length > (rowsLimit as number) && (
            <button onClick={() => setRowsLimit("Tout")}
              style={{ fontSize: 11, fontWeight: 600, color: "#004f91",
                background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Voir tout ({sorted.length.toLocaleString("fr-FR")})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
