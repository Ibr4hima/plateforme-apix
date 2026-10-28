"use client";

// Design system APIX v1 — les briques partagées de la plateforme.
// Chaque composant consomme les jetons de globals.css (couleurs
// sémantiques, espacement, rayons, ombres, motion) et gère ses états
// hover / focus / active / disabled en CSS — plus de onMouseEnter.
import { ReactNode, ButtonHTMLAttributes, CSSProperties } from "react";
import Link from "next/link";
import { fondVoile, badge as badgeStyle, badgeSurvol, type Teinte } from "@/lib/couleurs";

// ── Bouton ───────────────────────────────────────────────────────────────────
// `plein` : l'action unique d'un formulaire (« Continuer »), sur toute la largeur.
export function Bouton({ variante = "primaire", taille = "moyen", href, children, className = "", ...props }: {
  variante?: "primaire" | "accent" | "secondaire" | "fantome" | "danger";
  taille?: "petit" | "moyen" | "grand" | "plein";
  href?: string;
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = [
    "ds-bouton", `ds-bouton--${variante}`,
    taille !== "moyen" ? `ds-bouton--${taille}` : "",
    className,
  ].filter(Boolean).join(" ");
  if (href) return <Link href={href} className={classes}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}

// ── Carte ────────────────────────────────────────────────────────────────────
export function Carte({ interactive, className = "", style, children, ...props }: {
  interactive?: boolean; className?: string; style?: React.CSSProperties; children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["ds-carte", interactive ? "ds-carte--interactive" : "", className].filter(Boolean).join(" ")}
      style={style} {...props}>
      {children}
    </div>
  );
}

// ── KpiCarte : étiquette / valeur / note, chiffres tabulaires ────────────────
export function KpiCarte({ label, valeur, note, accent }: {
  label: string; valeur: string; note?: string | null; accent?: boolean;
}) {
  return (
    <Carte style={{ padding: "14px 16px 16px" }}>
      <p style={{ font: "700 10px/1.3 var(--font-body)", color: "var(--gris-fort)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</p>
      <p className="ds-donnee" style={{ font: "700 26px/1.1 var(--font-display)", letterSpacing: "-0.02em", color: accent ? "var(--orange)" : "var(--encre)", marginTop: 10 }}>{valeur}</p>
      {note ? <p className="ds-donnee" style={{ font: "var(--typo-legende)", color: "var(--text-muted)", marginTop: 6 }}>{note}</p> : null}
    </Carte>
  );
}

// ── Badge de statut ──────────────────────────────────────────────────────────
// Fond blanc, le mot dans sa couleur, un liseré de la même couleur en plus
// clair : le liseré dessine la forme, le mot porte le sens. Hauteur fixe, pour
// qu'une colonne de badges s'aligne au pixel.
export function Badge({ ton = "neutre", children }: {
  ton?: "neutre" | "succes" | "alerte" | "danger" | "primaire"; children: ReactNode;
}) {
  const c = { neutre: "var(--gris-fort)", succes: "var(--ds-succes)", alerte: "var(--ds-alerte)",
              danger: "var(--ds-danger)", primaire: "var(--ds-primaire)" }[ton];
  const lisere = { neutre: "rgb(var(--gris-rgb) / 0.4)", succes: "rgb(var(--vert-rgb) / 0.4)", alerte: "rgb(var(--alerte-rgb) / 0.4)",
                   danger: "rgb(var(--danger-rgb) / 0.4)", primaire: "rgb(var(--bleu-rgb) / 0.35)" }[ton];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 10px",
      background: "var(--carte)", color: c, border: `1px solid ${lisere}`,
      font: "600 11.5px/1 var(--font-body)", borderRadius: "var(--rayon-pilule)", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// ── Chip (filtre, segment) ───────────────────────────────────────────────────
export function Chip({ actif, onClick, children }: {
  actif?: boolean; onClick?: () => void; children: ReactNode;
}) {
  return (
    <button type="button" className="ds-chip" aria-pressed={!!actif} onClick={onClick}>
      {children}
    </button>
  );
}

// ── Chips des filtres actifs + Réinitialiser ─────────────────────────────────
export function ChipsFiltres({ actifs, onRetirer, onReinitialiser }: {
  actifs: { cle: string; label: string }[];
  onRetirer: (cle: string) => void;
  onReinitialiser: () => void;
}) {
  if (!actifs.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--esp-2)", alignItems: "center" }}>
      {actifs.map(f => (
        <button key={f.cle} type="button" className="ds-chip ds-chip--actif"
          aria-label={`Retirer le filtre ${f.label}`} onClick={() => onRetirer(f.cle)}>
          {f.label}<span aria-hidden style={{ opacity: 0.75 }}>×</span>
        </button>
      ))}
      <Bouton variante="fantome" taille="petit" onClick={onReinitialiser}>Réinitialiser tout</Bouton>
    </div>
  );
}

// ── Segments (choix exclusif) ────────────────────────────────────────────────
export function Segments({ options, valeur, onChange }: {
  options: readonly { cle: string; label: string }[];
  valeur: string; onChange: (cle: string) => void;
}) {
  return (
    <div role="tablist" className="ds-segments">
      {options.map(o => (
        <button key={o.cle} type="button" role="tab" aria-selected={valeur === o.cle}
          className="ds-segment" onClick={() => onChange(o.cle)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Champ de recherche ───────────────────────────────────────────────────────
export function ChampRecherche({ valeur, onChange, placeholder = "Rechercher…", ...props }: {
  valeur: string; onChange: (v: string) => void; placeholder?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div style={{ position: "relative" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gris-fort)" strokeWidth="2.2"
        strokeLinecap="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden>
        <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
      <input value={valeur} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        aria-label={placeholder} className="ds-champ"
        style={{ height: 36, paddingLeft: 35, fontSize: 13 }}
        {...props} />
    </div>
  );
}

// ── État vide illustré ───────────────────────────────────────────────────────
export function EtatVide({ titre, sous, action }: {
  titre: string; sous?: string; action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ textAlign: "center", padding: "var(--esp-8) var(--esp-5)", color: "var(--text-muted)" }}>
      <div style={{ width: 52, height: 52, borderRadius: "var(--rayon-bloc)", background: "var(--fond-creux)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "var(--esp-4)" }} aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>
      <p style={{ font: "600 15px/1.4 var(--font-body)", color: "var(--text-secondary)" }}>{titre}</p>
      {sous ? <p style={{ font: "var(--typo-legende)", marginTop: 6 }}>{sous}</p> : null}
      {action ? <div style={{ marginTop: "var(--esp-4)" }}><Bouton variante="secondaire" taille="petit" onClick={action.onClick}>{action.label}</Bouton></div> : null}
    </div>
  );
}

// ── Fond voilé (carte au dégradé teinté) ─────────────────────────────────────
// <Voile couleur="vert" style={{ padding: 20 }}>…</Voile> — teinte parmi
// bleu · orange · vert · violet ; s'appuie sur la carte du design system.
export function Voile({ couleur = "bleu", style, className = "", children, ...props }: {
  couleur?: Teinte; children?: ReactNode; className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ds-carte ${className}`} style={{ ...fondVoile(couleur), ...style }} {...props}>
      {children}
    </div>
  );
}

// ── Pastille (badge teinté 4 couleurs, style Fiche Pays) ─────────────────────
// <Pastille couleur="orange">UEMOA</Pastille> ; cliquable (onClick) → survol
// renforcé. Distincte du <Badge> de statut (sémantique succès/alerte/danger).
export function Pastille({ couleur = "bleu", onClick, style, children, title }: {
  couleur?: Teinte; onClick?: () => void; style?: CSSProperties; children: ReactNode; title?: string;
}) {
  const base = badgeStyle(couleur);
  return (
    <span title={title} onClick={onClick} role={onClick ? "button" : undefined}
      style={{ ...base, cursor: onClick ? "pointer" : "default", transition: "background 0.15s, border-color 0.15s", ...style }}
      onMouseEnter={onClick ? e => { const s = badgeSurvol(couleur); e.currentTarget.style.background = s.background; e.currentTarget.style.borderColor = s.borderColor; } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.background = base.background as string; e.currentTarget.style.border = base.border as string; } : undefined}>
      {children}
    </span>
  );
}
