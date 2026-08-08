"use client";

// Briques d'interface communes aux pages d'administration « données » :
// cartes, tableaux propres, champs de recherche, compteurs, zone de dépôt.
// Une seule source pour garder Statistiques, IDE (et les suivantes) alignés.

import { useRef, useState } from "react";
import { CheckCircle, Search, UploadCloud, X } from "lucide-react";

// ── Jetons ────────────────────────────────────────────────────────────────────
export const CARTE: React.CSSProperties = { background: "var(--carte)", border: "1px solid rgb(var(--encre-rgb) / 0.12)", borderRadius: 16, boxShadow: "none" };
export const IS: React.CSSProperties = { background: "var(--carte)", border: "1px solid var(--bordure-forte)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "var(--encre)", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };
// Tableaux : en-tête discret sur fond ivoire, lignes séparées par un filet fin
export const TH: React.CSSProperties = { padding: "11px 14px", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gris)", background: "var(--carte-douce)", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid var(--bordure)", position: "sticky", top: 0, zIndex: 1 };
export const TD: React.CSSProperties = { padding: "11px 14px", fontSize: 12.5, color: "var(--encre)", verticalAlign: "middle", borderTop: "1px solid var(--bordure)" };
export const NUM: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

export const btnPrincipal = (actif: boolean, couleur = "var(--bleu)"): React.CSSProperties => ({
  background: actif ? couleur : "var(--bordure-forte)", color: "var(--sur-bleu)", border: "none", borderRadius: 999,
  padding: "11px 24px", fontSize: 13, fontWeight: 700, cursor: actif ? "pointer" : "not-allowed",
  display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-google-sans)",
  boxShadow: actif && couleur === "var(--bleu)" ? "0 3px 12px rgb(var(--bleu-rgb) / 0.25)" : "none", transition: "background 0.15s",
});
export const btnDanger: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, background: "rgb(var(--danger-rgb) / 0.07)",
  border: "1px solid rgb(var(--danger-rgb) / 0.2)", color: "var(--danger)", borderRadius: 999, padding: "9px 16px",
  fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap",
};
export const btnSecondaire: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, background: "var(--carte)", border: "1px solid var(--bordure-forte)",
  borderRadius: 999, padding: "9px 16px", fontSize: 12.5, fontWeight: 600, color: "var(--encre)",
  cursor: "pointer", fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap",
};

// ── Carte de section ──────────────────────────────────────────────────────────
export function Carte({ titre, aide, extra, children, accent, style }: {
  titre?: string; aide?: React.ReactNode; extra?: React.ReactNode; children: React.ReactNode; accent?: string; style?: React.CSSProperties;
}) {
  const c = accent || "var(--bleu)";
  return (
    <div style={{ ...CARTE, borderColor: accent ? `${accent}55` : (CARTE.border as string), padding: "22px 26px", ...style }}>
      {titre && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: aide ? 6 : 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: c, letterSpacing: "0.14em", textTransform: "uppercase" }}>{titre}</span>
          {extra}
        </div>
      )}
      {aide && <p style={{ fontSize: 12.5, color: "var(--gris)", lineHeight: 1.6, marginBottom: 16 }}>{aide}</p>}
      {children}
    </div>
  );
}

// Pluriel automatique, sauf mots déjà invariables (« pays »)
export const Compteur = ({ n, mot, couleur = "var(--bleu)" }: { n: number; mot: string; couleur?: string }) => (
  <span style={{ fontSize: 11.5, fontWeight: 700, color: couleur, background: `${couleur}12`, padding: "3px 11px", borderRadius: 999, whiteSpace: "nowrap" }}>
    {n.toLocaleString("fr-FR")} {mot}{n > 1 && !mot.endsWith("s") ? "s" : ""}
  </span>
);

// ── Tableau : filet fin, coins arrondis, défilement interne ───────────────────
export function Tableau({ children, hauteurMax }: { children: React.ReactNode; hauteurMax?: number }) {
  return (
    <div style={{ border: "1px solid rgb(var(--encre-rgb) / 0.10)", borderRadius: 14, overflow: "hidden", background: "var(--carte)" }}>
      <div style={{ overflowX: "auto", overflowY: hauteurMax ? "auto" : undefined, maxHeight: hauteurMax }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
      </div>
    </div>
  );
}
export const Ligne = ({ children, fond, style }: { children: React.ReactNode; fond?: string; style?: React.CSSProperties }) => (
  <tr style={{ transition: "background 0.12s", background: fond || "transparent", ...style }}
    onMouseEnter={e => (e.currentTarget.style.background = fond || "var(--carte-douce)")}
    onMouseLeave={e => (e.currentTarget.style.background = fond || "transparent")}>
    {children}
  </tr>
);
export const LigneVide = ({ colSpan, texte }: { colSpan: number; texte: string }) => (
  <tr><td colSpan={colSpan} style={{ ...TD, textAlign: "center", color: "var(--gris)", padding: "34px 14px" }}>{texte}</td></tr>
);

// ── Champ de recherche compact ────────────────────────────────────────────────
export function ChampRecherche({ value, onChange, placeholder, style }: {
  value: string; onChange: (v: string) => void; placeholder: string; style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: "relative", ...style }}>
      <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--gris)" }} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...IS, paddingLeft: 32, paddingRight: value ? 30 : 12 }} />
      {value && (
        <button onClick={() => onChange("")} aria-label="Effacer" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          <X size={12} style={{ color: "var(--gris)" }} />
        </button>
      )}
    </div>
  );
}

// ── Bascule segmentée ─────────────────────────────────────────────────────────
// `n` affiche un compteur dans l'option : on voit ce que vaut un filtre avant
// de le poser (« Passés 1 » évite de cliquer pour découvrir une liste vide).
export function Segments<T extends string>({ options, value, onChange, accent = "var(--bleu)" }: {
  options: readonly { v: T; l: string; n?: number }[]; value: T; onChange: (v: T) => void; accent?: string;
}) {
  return (
    <div style={{ display: "inline-flex", background: "var(--fond)", borderRadius: 999, padding: 3, gap: 3 }}>
      {options.map(o => {
        const actif = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} aria-pressed={actif}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: o.n != null ? "6px 11px 6px 14px" : "6px 15px",
              borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
              background: actif ? "var(--carte)" : "transparent", color: actif ? accent : "var(--gris)",
              boxShadow: actif ? "0 1px 4px rgb(var(--ombre-rgb) / 0.10)" : "none", fontFamily: "var(--font-google-sans)", transition: "all 0.15s" }}>
            {o.l}
            {o.n != null && (
              <span style={{ fontSize: 10, fontWeight: 800, lineHeight: 1, padding: "3px 6px", borderRadius: 999,
                background: actif ? `${accent}14` : "rgb(var(--gris-rgb) / 0.16)", color: actif ? accent : "var(--gris)" }}>{o.n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Bandeau de résultat ───────────────────────────────────────────────────────
export const Avis = ({ ton, children }: { ton: "ok" | "erreur" | "info"; children: React.ReactNode }) => {
  const c = ton === "ok" ? "var(--vert)" : ton === "erreur" ? "var(--danger)" : "var(--bleu)";
  return (
    <div style={{ padding: "11px 15px", borderRadius: 12, background: `${c}0F`, border: `1px solid ${c}33`, fontSize: 12.5, color: c, lineHeight: 1.6 }}>
      {children}
    </div>
  );
};

// ── Zone de dépôt de fichiers ─────────────────────────────────────────────────
export function FileZone({ files, onChange, label, hint, compact }: {
  files: File[]; onChange: (f: File[]) => void; label?: string; hint: string; compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const addFiles = (nf: FileList | null) => { if (nf) onChange([...files, ...Array.from(nf).filter(f => !files.some(e => e.name === f.name))]); };
  const actif = drag || files.length > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        style={{ border: `1.5px dashed ${actif ? "var(--bleu)" : "var(--bordure-forte)"}`, borderRadius: 14, padding: compact ? "16px 14px" : "28px 16px", textAlign: "center", cursor: "pointer", background: drag ? "rgb(var(--bleu-rgb) / 0.06)" : actif ? "rgb(var(--bleu-rgb) / 0.03)" : "var(--carte)", transition: "all .15s" }}>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" multiple style={{ display: "none" }} onChange={e => addFiles(e.target.files)} />
        <UploadCloud size={compact ? 18 : 22} color={actif ? "var(--bleu)" : "var(--gris)"} style={{ marginBottom: compact ? 5 : 7 }} />
        <div style={{ fontSize: compact ? 12.5 : 13, fontWeight: 700, color: actif ? "var(--bleu)" : "var(--texte)" }}>{label || "Déposez le ou les fichiers Excel / CSV"}</div>
        <div style={{ fontSize: 11.5, color: "var(--gris)", marginTop: 3, lineHeight: 1.5 }}>{hint}</div>
      </div>
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {files.map((f, i) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgb(var(--bleu-rgb) / 0.04)", border: "1px solid rgb(var(--bleu-rgb) / 0.12)", borderRadius: 10, padding: "6px 11px", fontSize: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <CheckCircle size={12} color="var(--bleu)" style={{ flexShrink: 0 }} />
                <span style={{ color: "var(--encre)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <span style={{ color: "var(--gris)", flexShrink: 0 }}>({(f.size / 1024).toFixed(0)} Ko)</span>
              </span>
              <button onClick={() => onChange(files.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gris)", padding: 0, display: "flex" }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Case à cocher ─────────────────────────────────────────────────────────────
export function Case({ checked, indeterminate, onChange, disabled, titre }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void; disabled?: boolean; titre?: string;
}) {
  return (
    <button onClick={e => { e.stopPropagation(); if (!disabled) onChange(); }} disabled={disabled} title={titre} aria-checked={checked} role="checkbox"
      style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0, cursor: disabled ? "not-allowed" : "pointer", padding: 0,
        border: `1.5px solid ${checked || indeterminate ? "var(--bleu)" : "var(--bordure-forte)"}`,
        background: checked || indeterminate ? "var(--bleu-action)" : "var(--carte)",
        opacity: disabled ? 0.35 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
      {indeterminate
        ? <span style={{ width: 8, height: 2, borderRadius: 1, background: "var(--carte)" }} />
        : checked
        ? <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4L3.6 6.5L9 1" stroke="var(--carte)" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        : null}
    </button>
  );
}
