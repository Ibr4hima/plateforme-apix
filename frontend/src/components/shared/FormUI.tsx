"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Kit de formulaire APIX — design unique pour tous les modals de saisie du site.
// Palette : #004f91 (principal) · #ca631f (accent) · #188038 (succès) · #6A1B9A.
// Usage :
//   <FModal open onClose title="…" subtitle="…" footer={<><FButtonGhost/><FButton/></>}>
//     <FSection title="Identification">
//       <FGrid cols={2}>
//         <div><FLabel>Nom *</FLabel><FInput …/></div>
//       </FGrid>
//     </FSection>
//   </FModal>
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { Check, Loader2, X } from "lucide-react";

export const FORM_COLORS = { primary: "#004f91", accent: "#ca631f", success: "#188038", extra: "#6A1B9A" };

// ── Styles de base (exportés pour les cas particuliers) ──────────────────────
export const fuiInput: React.CSSProperties = {
  // Bordure en propriétés séparées (pas le raccourci `border`) : les appelants
  // surchargent borderColor conditionnellement, et React interdit de mélanger
  // raccourci et propriété détaillée sur la même valeur entre deux rendus.
  width: "100%", background: "#fff",
  borderWidth: 1, borderStyle: "solid", borderColor: "#E4E1DE", borderRadius: 10,
  padding: "10px 13px", fontSize: 13.5, color: "#1a1a2e", outline: "none",
  fontFamily: "var(--font-google-sans)", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};
export const fuiLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 5, display: "block",
};

// ── Champs ────────────────────────────────────────────────────────────────────
export function FInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`fui-input ${props.className || ""}`} style={{ ...fuiInput, ...props.style }} />;
}

export function FSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`fui-input ${props.className || ""}`} style={{ ...fuiInput, cursor: "pointer", ...props.style }} />;
}

export function FLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <label style={fuiLabel}>{children}{hint && <span style={{ fontWeight: 400, color: "#9aa5b4" }}> {hint}</span>}</label>;
}

// ── Structure ─────────────────────────────────────────────────────────────────
export function FSection({ title, extra, children, style }: {
  title: string; extra?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section style={style}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: FORM_COLORS.primary, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>{title}</p>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function FGrid({ cols = 2, gap = 14, children, style }: {
  cols?: number | string; gap?: number; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return <div style={{ display: "grid", gridTemplateColumns: typeof cols === "number" ? `repeat(${cols},1fr)` : cols, gap, ...style }}>{children}</div>;
}

// Encadré doux (sous-formulaires conditionnels, ex. récurrence)
export function FPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#FAFAF9", border: "1px solid #F0EEEC", borderRadius: 12, padding: 16, ...style }}>{children}</div>;
}

// ── Contrôles ─────────────────────────────────────────────────────────────────
export function FSegmented<T>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 3, background: "#F2F0EF", borderRadius: 10, padding: 3 }}>
      {options.map(o => {
        const actif = value === o.value;
        return (
          <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-google-sans)",
              background: actif ? "#fff" : "transparent", color: actif ? FORM_COLORS.primary : "#9aa5b4",
              boxShadow: actif ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FToggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#4a5568", userSelect: "none" }} onClick={onChange}>
      <span style={{ width: 36, height: 20, borderRadius: 999, background: checked ? FORM_COLORS.primary : "#D8D4D0", position: "relative", transition: "background 0.2s", flexShrink: 0, display: "inline-block" }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </span>
      {label && <span style={{ fontWeight: checked ? 600 : 400 }}>{label}</span>}
    </span>
  );
}

// ── Boutons ───────────────────────────────────────────────────────────────────
export function FButton({ children, loading, success, style, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean; success?: boolean;
}) {
  return (
    <button {...rest} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 10, border: "none",
        background: success ? "rgba(24,128,56,0.12)" : FORM_COLORS.primary,
        color: success ? FORM_COLORS.success : "#fff", fontSize: 13, fontWeight: 700,
        cursor: disabled ? "default" : "pointer", opacity: disabled && !success && !loading ? 0.6 : 1,
        fontFamily: "var(--font-google-sans)", boxShadow: success ? "none" : "0 3px 12px rgba(0,79,145,0.25)",
        transition: "all 0.15s", ...style }}>
      {success ? <Check size={14} /> : loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
      {children}
    </button>
  );
}

export function FButtonGhost({ children, style, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest}
      style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #E4E1DE", background: "#fff", color: "#4a5568",
        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)", transition: "all 0.15s", ...style }}>
      {children}
    </button>
  );
}

// ── Bandeaux ──────────────────────────────────────────────────────────────────
export function FError({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>{children}</div>;
}

export function FInfo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, color: FORM_COLORS.primary, background: "rgba(0,79,145,0.05)", border: "1px solid rgba(0,79,145,0.15)", borderRadius: 10, padding: "9px 13px", lineHeight: 1.55 }}>
      {children}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function FModal({ open, onClose, title, subtitle, children, footer, maxWidth = 760 }: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode;
  children: React.ReactNode; footer?: React.ReactNode; maxWidth?: number;
}) {
  // Accessibilité : fermeture à la touche Échap + verrouillage du scroll du body
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`
        .fui-input:focus{border-color:${FORM_COLORS.primary} !important; box-shadow:0 0 0 3px rgba(0,79,145,0.10);}
        .fui-input::placeholder{color:#b3bcc9;}
        @keyframes fuiIn{from{opacity:0; transform:translateY(10px) scale(0.985);}to{opacity:1; transform:none;}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
      <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Fenêtre de dialogue"} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth, maxHeight: "92vh", display: "flex", flexDirection: "column" as const, overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "fuiIn 0.22s ease" }}>
        {/* Liseré d'accent */}
        <div style={{ height: 4, background: FORM_COLORS.primary, flexShrink: 0 }} />

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 28px", borderBottom: "1px solid #F2F0EF", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e", lineHeight: 1.3 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer"
            style={{ background: "#F5F4F3", border: "none", cursor: "pointer", borderRadius: 99, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#ECEAE8")}
            onMouseLeave={e => (e.currentTarget.style.background = "#F5F4F3")}>
            <X size={15} color="#4a5568" />
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: "24px 28px", overflowY: "auto" as const, flex: 1, display: "flex", flexDirection: "column" as const, gap: 24 }}>
          {children}
        </div>

        {/* Pied */}
        {footer && (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 28px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
