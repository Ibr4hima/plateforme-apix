"use client";

// Design system APIX v1 — les briques partagées de la plateforme.
// Chaque composant consomme les jetons de globals.css (couleurs
// sémantiques, espacement, rayons, ombres, motion) et gère ses états
// hover / focus / active / disabled en CSS — plus de onMouseEnter.
import { ReactNode, ButtonHTMLAttributes } from "react";
import Link from "next/link";

// ── Bouton ───────────────────────────────────────────────────────────────────
export function Bouton({ variante = "primaire", taille = "moyen", href, children, className = "", ...props }: {
  variante?: "primaire" | "accent" | "secondaire" | "fantome";
  taille?: "petit" | "moyen" | "grand";
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
    <Carte style={{ padding: "var(--esp-4)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 16, right: 16, top: 0, height: 2.5, borderRadius: 2,
        background: accent ? "rgba(202,99,31,0.4)" : "rgba(0,79,145,0.18)" }} />
      <p style={{ font: "var(--typo-micro)", color: "var(--text-muted)", letterSpacing: "0.09em", textTransform: "uppercase" }}>{label}</p>
      <p className="ds-donnee" style={{ font: "700 24px/1.2 var(--font-display)", color: "var(--ds-primaire)", marginTop: 8 }}>{valeur}</p>
      {note ? <p className="ds-donnee" style={{ font: "var(--typo-legende)", color: "var(--text-muted)", marginTop: 6 }}>{note}</p> : null}
    </Carte>
  );
}

// ── Badge de statut ──────────────────────────────────────────────────────────
export function Badge({ ton = "neutre", children }: {
  ton?: "neutre" | "succes" | "alerte" | "danger" | "primaire"; children: ReactNode;
}) {
  const c = { neutre: "var(--text-secondary)", succes: "var(--ds-succes)", alerte: "var(--ds-alerte)",
              danger: "var(--ds-danger)", primaire: "var(--ds-primaire)" }[ton];
  const bg = { neutre: "var(--ds-filet)", succes: "rgba(24,128,56,0.08)", alerte: "rgba(202,99,31,0.10)",
               danger: "rgba(185,28,28,0.08)", primaire: "var(--ds-voile-bleu)" }[ton];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", background: bg, color: c,
      font: "700 11px/1 var(--font-body)", borderRadius: "var(--rayon-pilule)", padding: "4px 12px" }}>
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

// ── Segments (onglets pilule) ────────────────────────────────────────────────
export function Segments({ options, valeur, onChange }: {
  options: readonly { cle: string; label: string }[];
  valeur: string; onChange: (cle: string) => void;
}) {
  return (
    <div role="tablist" style={{ display: "inline-flex", gap: 4, padding: 4,
      background: "var(--ds-filet)", borderRadius: "var(--rayon-pilule)" }}>
      {options.map(o => (
        <button key={o.cle} type="button" role="tab" aria-selected={valeur === o.cle}
          className="ds-chip" onClick={() => onChange(o.cle)}
          style={valeur === o.cle
            ? { background: "var(--ds-carte)", borderColor: "transparent", color: "var(--ds-primaire)", fontWeight: 700, boxShadow: "var(--ombre-subtile)" }
            : { background: "transparent", borderColor: "transparent" }}>
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.2"
        strokeLinecap="round" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} aria-hidden>
        <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
      <input value={valeur} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        aria-label={placeholder}
        style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: "var(--rayon-sm)",
          border: "1px solid var(--ds-bordure)", background: "var(--ds-champ)",
          font: "var(--typo-corps)", color: "var(--text-primary)", outline: "none" }}
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
      <div style={{ width: 52, height: 52, borderRadius: "var(--rayon-lg)", background: "var(--ds-filet)",
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
