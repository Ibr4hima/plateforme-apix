"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Kit de formulaire APIX — design unique pour tous les modals de saisie du site.
// Palette : #004f91 (principal) · #ca631f (accent) · #188038 (succès) · #6A1B9A.
// Principe : le corps du modal est un fond doux, chaque FSection est une carte
// blanche à filet fin — les groupes de champs sont bornés, pas d'espaces morts.
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
import { useDialogue } from "@/lib/dialogue";
import { AlertCircle, Check, Loader2, X } from "lucide-react";

export const FORM_COLORS = { primary: "var(--bleu)", accent: "var(--orange)", success: "var(--vert)", extra: "var(--violet)" };

// ── Styles de base (exportés pour les cas particuliers) ──────────────────────
export const fuiInput: React.CSSProperties = {
  // Bordure en propriétés séparées (pas le raccourci `border`) : les appelants
  // surchargent borderColor conditionnellement, et React interdit de mélanger
  // raccourci et propriété détaillée sur la même valeur entre deux rendus.
  width: "100%", background: "var(--carte)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--bordure-forte)", borderRadius: 8,
  padding: "10px 13px", fontSize: 13.5, color: "var(--encre)", outline: "none",
  fontFamily: "var(--font-google-sans)", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
};
export const fuiLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "var(--texte)", marginBottom: 5, display: "block",
};

// ── Champs ────────────────────────────────────────────────────────────────────
export function FInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`fui-input ${props.className || ""}`} style={{ ...fuiInput, ...props.style }} />;
}

export function FSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`fui-input ${props.className || ""}`} style={{ ...fuiInput, cursor: "pointer", ...props.style }} />;
}

export function FLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <label style={fuiLabel}>{children}{hint && <span style={{ fontWeight: 400, color: "var(--gris)" }}> {hint}</span>}</label>;
}

// ── Structure ─────────────────────────────────────────────────────────────────
// Chaque section est une carte blanche : titre en overline + contenu borné.
export function FSection({ title, extra, children, style }: {
  title: string; extra?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section style={{ background: "var(--carte)", border: "1px solid var(--filet-carte)", borderRadius: 8, boxShadow: "var(--ombre-1)", padding: "16px 18px 18px", ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, minHeight: 20 }}>
        <p style={{ fontSize: 10.5, fontWeight: 800, color: FORM_COLORS.primary, letterSpacing: "0.14em", textTransform: "uppercase" as const, margin: 0 }}>{title}</p>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function FGrid({ cols = 2, gap = 14, children, style }: {
  cols?: number | string; gap?: number; children: React.ReactNode; style?: React.CSSProperties;
}) {
  // .fui-grid : passe en 1 colonne sous 640px (media query dans FModal)
  return <div className="fui-grid" style={{ display: "grid", gridTemplateColumns: typeof cols === "number" ? `repeat(${cols},minmax(0,1fr))` : cols, gap, ...style }}>{children}</div>;
}

// Encadré doux (sous-formulaires conditionnels, ex. récurrence)
export function FPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "var(--carte-douce)", border: "1px solid var(--bordure)", borderRadius: 8, padding: 16, ...style }}>{children}</div>;
}

// Filet de séparation à l'intérieur d'une carte (sous-groupes d'une section)
export function FDivider({ label, style }: { label?: string; style?: React.CSSProperties }) {
  if (!label) return <div style={{ height: 1, background: "rgb(var(--encre-rgb) / 0.07)", margin: "14px 0", ...style }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0", ...style }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gris)", letterSpacing: "0.1em", textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "rgb(var(--encre-rgb) / 0.07)" }} />
    </div>
  );
}

// ── Contrôles ─────────────────────────────────────────────────────────────────
export function FSegmented<T>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="ds-segments" style={{ padding: 3, gap: 3 }}>
      {options.map(o => (
        <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
          aria-pressed={value === o.value} className="ds-segment" style={{ padding: "6px 15px" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FToggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "var(--texte)", userSelect: "none" }} onClick={onChange}>
      <span style={{ width: 36, height: 20, borderRadius: 999, background: checked ? FORM_COLORS.primary : "var(--bordure-forte)", position: "relative", transition: "background 0.2s", flexShrink: 0, display: "inline-block" }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "var(--carte)", transition: "left 0.2s", boxShadow: "0 1px 3px rgb(var(--ombre-rgb) / 0.2)" }} />
      </span>
      {label && <span style={{ fontWeight: checked ? 600 : 400 }}>{label}</span>}
    </span>
  );
}

// ── Boutons ───────────────────────────────────────────────────────────────────
// Les boutons d'e-Voting (cf. .ds-bouton) : 36 px, coins de 8, plein ou bordé,
// une ombre fine dessous.
export function FButton({ children, loading, success, style, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean; success?: boolean;
}) {
  return (
    <button {...rest} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 36, padding: "0 16px", borderRadius: 8,
        border: "1px solid transparent",
        background: success ? "rgb(var(--vert-rgb) / 0.12)" : "var(--bleu-action)",
        color: success ? FORM_COLORS.success : "var(--sur-bleu)", fontSize: 13, fontWeight: 600,
        cursor: disabled ? "default" : "pointer", opacity: disabled && !success && !loading ? 0.5 : 1,
        fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap", boxShadow: success ? "none" : "var(--ombre-bouton)",
        transition: "background-color 0.15s ease-out, opacity 0.15s ease-out", ...style }}>
      {success ? <Check size={14} /> : loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
      {children}
    </button>
  );
}

export function FButtonGhost({ children, style, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 36, padding: "0 16px", borderRadius: 8,
        border: "1px solid var(--bordure-forte)", background: "var(--carte)", color: "var(--encre)", boxShadow: "var(--ombre-bouton-borde)",
        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap",
        transition: "background-color 0.15s ease-out", ...style }}>
      {children}
    </button>
  );
}

// ── Bandeaux ──────────────────────────────────────────────────────────────────
export function FError({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgb(var(--danger-rgb) / 0.07)", border: "1px solid rgb(var(--danger-rgb) / 0.22)", color: "var(--danger)", padding: "9px 13px", borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, ...style }}>
      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

export function FInfo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, color: FORM_COLORS.primary, background: "rgb(var(--bleu-rgb) / 0.05)", border: "1px solid rgb(var(--bleu-rgb) / 0.15)", borderRadius: 8, padding: "9px 13px", lineHeight: 1.55 }}>
      {children}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function FModal({ open, onClose, title, subtitle, children, footer, maxWidth = 760 }: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode;
  children: React.ReactNode; footer?: React.ReactNode; maxWidth?: number;
}) {
  // Fermeture à Échap. Le gel du défilement, lui, est passé dans useDialogue
  // (lib/dialogue) : il est commun à toutes les surfaces modales, et son
  // compteur gère le cas des fiches superposées — deux verrous locaux
  // indépendants se seraient marchés dessus.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Robustesse : ne fermer sur le fond que si le CLIC A COMMENCÉ dessus.
  // (Sélectionner du texte dans un champ puis relâcher hors du modal ne doit
  // pas fermer et perdre la saisie.)
  const downSurFond = React.useRef(false);
  // Contrat clavier : piège de Tab, focus pris puis restitué au déclencheur.
  const dial = useDialogue(open);

  if (!open) return null;
  return (
    <div
      onMouseDown={e => { downSurFond.current = e.target === e.currentTarget; }}
      onMouseUp={e => { if (downSurFond.current && e.target === e.currentTarget) onClose(); downSurFond.current = false; }}
      style={{ position: "fixed", inset: 0, background: "rgb(var(--encre-rgb) / 0.45)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`
        .fui-input:focus{border-color:${FORM_COLORS.primary} !important; box-shadow:0 0 0 3px rgb(var(--bleu-rgb) / 0.14); background:var(--carte);}
        .fui-input:hover:not(:focus){border-color:var(--gris);}
        .fui-input::placeholder{color:var(--gris);}
        @media (max-width:640px){ .fui-grid{ grid-template-columns:1fr !important; } }
        @keyframes fuiIn{from{opacity:0; transform:translateY(10px) scale(0.985);}to{opacity:1; transform:none;}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
      <div {...dial} aria-label={typeof title === "string" ? title : "Fenêtre de dialogue"} style={{ background: "var(--carte)", borderRadius: 8, width: "100%", maxWidth, maxHeight: "92vh", display: "flex", flexDirection: "column" as const, overflow: "hidden", border: "1px solid var(--filet-carte)", boxShadow: "var(--ombre-2)", animation: "fuiIn 0.22s ease" }}>

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 28px", borderBottom: "1px solid var(--bordure)", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--encre)", lineHeight: 1.3 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: "var(--gris)", marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer"
            style={{ background: "transparent", border: "none", cursor: "pointer", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--fond-creux)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            <X size={15} color="var(--texte)" />
          </button>
        </div>

        {/* Corps — fond doux, les FSection sont des cartes blanches */}
        <div style={{ padding: "18px 22px 22px", overflowY: "auto" as const, flex: 1, display: "flex", flexDirection: "column" as const, gap: 12, background: "var(--champ)" }}>
          {children}
        </div>

        {/* Pied */}
        {footer && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--bordure)", background: "var(--carte)", flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
