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
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--bordure-forte)", borderRadius: 10,
  padding: "10px 13px", fontSize: "var(--t-135)", color: "var(--encre)", outline: "none",
  fontFamily: "var(--font-google-sans)", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
};
export const fuiLabel: React.CSSProperties = {
  fontSize: "var(--t-12)", fontWeight: 600, color: "var(--texte)", marginBottom: 5, display: "block",
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
    <section style={{ background: "var(--carte)", border: "1px solid rgb(var(--encre-rgb) / 0.10)", borderRadius: 14, padding: "16px 18px 18px", ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, minHeight: 20 }}>
        <p style={{ fontSize: "var(--t-105)", fontWeight: 800, color: FORM_COLORS.primary, letterSpacing: "0.14em", textTransform: "uppercase" as const, margin: 0 }}>{title}</p>
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
  return <div style={{ background: "var(--carte-douce)", border: "1px solid var(--bordure)", borderRadius: 12, padding: 16, ...style }}>{children}</div>;
}

// Filet de séparation à l'intérieur d'une carte (sous-groupes d'une section)
export function FDivider({ label, style }: { label?: string; style?: React.CSSProperties }) {
  if (!label) return <div style={{ height: 1, background: "rgb(var(--encre-rgb) / 0.07)", margin: "14px 0", ...style }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0", ...style }}>
      <span style={{ fontSize: "var(--t-10)", fontWeight: 700, color: "var(--gris)", letterSpacing: "0.1em", textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "rgb(var(--encre-rgb) / 0.07)" }} />
    </div>
  );
}

// ── Contrôles ─────────────────────────────────────────────────────────────────
export function FSegmented<T>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 3, background: "var(--fond)", borderRadius: 10, padding: 3 }}>
      {options.map(o => {
        const actif = value === o.value;
        return (
          <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: "var(--t-125)", fontWeight: 600, fontFamily: "var(--font-google-sans)",
              background: actif ? "var(--carte)" : "transparent", color: actif ? FORM_COLORS.primary : "var(--gris)",
              boxShadow: actif ? "0 1px 4px rgb(var(--ombre-rgb) / 0.08)" : "none", transition: "all 0.15s" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FToggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "var(--t-13)", color: "var(--texte)", userSelect: "none" }} onClick={onChange}>
      <span style={{ width: 36, height: 20, borderRadius: 999, background: checked ? FORM_COLORS.primary : "var(--bordure-forte)", position: "relative", transition: "background 0.2s", flexShrink: 0, display: "inline-block" }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "var(--carte)", transition: "left 0.2s", boxShadow: "0 1px 3px rgb(var(--ombre-rgb) / 0.2)" }} />
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
        background: success ? "rgb(var(--vert-rgb) / 0.12)" : FORM_COLORS.primary,
        color: success ? FORM_COLORS.success : "var(--sur-bleu)", fontSize: "var(--t-13)", fontWeight: 700,
        cursor: disabled ? "default" : "pointer", opacity: disabled && !success && !loading ? 0.6 : 1,
        fontFamily: "var(--font-google-sans)", boxShadow: success ? "none" : "0 3px 12px rgb(var(--ombre-rgb) / 0.25)",
        transition: "all 0.15s", ...style }}>
      {success ? <Check size={14} /> : loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
      {children}
    </button>
  );
}

export function FButtonGhost({ children, style, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest}
      style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--bordure-forte)", background: "var(--carte)", color: "var(--texte)",
        fontSize: "var(--t-13)", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)", transition: "all 0.15s", ...style }}>
      {children}
    </button>
  );
}

// ── Bandeaux ──────────────────────────────────────────────────────────────────
export function FError({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgb(var(--danger-rgb) / 0.07)", border: "1px solid rgb(var(--danger-rgb) / 0.22)", color: "var(--danger)", padding: "9px 13px", borderRadius: 10, fontSize: "var(--t-125)", lineHeight: 1.5, ...style }}>
      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

export function FInfo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "var(--t-125)", color: FORM_COLORS.primary, background: "rgb(var(--bleu-rgb) / 0.05)", border: "1px solid rgb(var(--bleu-rgb) / 0.15)", borderRadius: 10, padding: "9px 13px", lineHeight: 1.55 }}>
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
        .fui-input:focus{border-color:${FORM_COLORS.primary} !important; box-shadow:0 0 0 3px rgb(var(--ombre-rgb) / 0.10); background:var(--carte);}
        .fui-input:hover:not(:focus){border-color:var(--bordure-forte);}
        .fui-input::placeholder{color:var(--bordure-forte);}
        @media (max-width:640px){ .fui-grid{ grid-template-columns:1fr !important; } }
        @keyframes fuiIn{from{opacity:0; transform:translateY(10px) scale(0.985);}to{opacity:1; transform:none;}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
      <div {...dial} aria-label={typeof title === "string" ? title : "Fenêtre de dialogue"} style={{ background: "var(--carte)", borderRadius: 20, width: "100%", maxWidth, maxHeight: "92vh", display: "flex", flexDirection: "column" as const, overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "fuiIn 0.22s ease" }}>
        {/* Liseré d'accent */}
        <div style={{ height: 4, background: "var(--degrade-filet)", flexShrink: 0 }} />

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 28px", borderBottom: "1px solid var(--bordure)", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: "var(--t-r105)", color: "var(--encre)", lineHeight: 1.3 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: "var(--t-12)", color: "var(--gris)", marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer"
            style={{ background: "var(--champ)", border: "none", cursor: "pointer", borderRadius: 99, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--fond-creux2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--champ)")}>
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
