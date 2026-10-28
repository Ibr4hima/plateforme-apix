"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

// ── Barre de titre commune des pages ──────────────────────────────────────────
// Écrite À MÊME LE FOND de la page, comme dans e-Voting : ni bandeau, ni aplat.
// Le logo de l'APIX dans ses couleurs, le titre de l'écran, les contrôles de la
// page à sa suite, et les commandes (accueil, menu) à l'extrême droite. Seuls
// les blocs et les tableaux sont blancs ; le bleu se réserve à ce qui se
// clique. Dans l'administration, le logo est déjà en tête de la barre
// latérale : la barre n'y porte que le titre.
//
// Un filet la ferme en bas : elle surplombe des colonnes (filtres, contenu) qui
// commencent juste dessous, et sans lui le titre semblait flotter au-dessus de
// la première d'entre elles.
//
// 64 px de haut : le plus grand de ses contenus (les ronds de commande, 36 px)
// y garde 14 px de marge de part et d'autre. Les 76 px d'e-Voting laissaient
// trop de vide au-dessus des colonnes. Dans l'administration, la barre garde
// 76 px, la hauteur de l'en-tête de la barre latérale, sur laquelle elle
// s'aligne.
export default function BarreTitre({ titre, children, droite, actions, compact, ton = "bleu" }: {
  titre: React.ReactNode;
  children?: React.ReactNode;
  droite?: React.ReactNode;
  actions?: React.ReactNode;   // cluster d'actions (accueil + menu) à l'extrême droite
  compact?: boolean;           // pas de navbar au-dessus : réduit le padding haut
  ton?: "bleu" | "orange";     // orange = espace d'administration (sans logo)
  pleineLargeur?: boolean;     // gardé pour les appels existants : la barre prend toujours toute la largeur
}) {
  const admin = ton === "orange";
  const marge = admin ? 32 : 24;
  return (
    // Toute la largeur, comme les colonnes qu'elle surplombe : la colonne des
    // filtres part du bord de la fenêtre, le logo aussi.
    <section style={{ padding: compact ? `0 ${marge}px` : `64px ${marge}px 0`, background: "var(--fond)",
      borderBottom: "1px solid var(--bordure)", flexShrink: 0 }}>
      <div style={{ minHeight: admin ? 76 : 64, display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
        {!admin && (
          <span className="barre-titre-logo" style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
            <Link href="/" aria-label="Accueil" style={{ display: "flex" }}>
              <Image src="/logo_apix.png" alt="APIX Sénégal" width={120} height={44}
                style={{ height: 34, width: "auto", objectFit: "contain" }} />
            </Link>
            <span aria-hidden style={{ width: 1, height: 26, background: "var(--bordure-forte)" }} />
          </span>
        )}
        <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--encre)", lineHeight: 1.25, margin: 0,
          whiteSpace: "nowrap", letterSpacing: "-0.02em" }}>{titre}</h1>
        {children}
        {(droite || actions) && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {droite}
            {actions && <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{actions}</div>}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Sélecteur segmenté (vues, onglets…) ───────────────────────────────────────
// Le cadre à 10 px sur le gris creusé ; l'onglet choisi est une plaque blanche,
// le mot en bleu. Le compte de l'onglet se lit dans une petite pastille.
export function BarreTitreSegment<T extends string>({ options, value, onChange }: {
  options: { v: T; l: string; count?: number; badge?: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="ds-segments" style={{ padding: 3, gap: 3, background: "var(--fond-creux)", borderColor: "var(--bordure)" }}>
      {options.map(o => {
        const actif = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} aria-pressed={actif} className="ds-segment"
            style={{ gap: 7, padding: "5px 14px", fontSize: 12.5 }}>
            {o.l}
            {o.count != null && o.count > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1, padding: "2px 7px", borderRadius: 999, fontVariantNumeric: "tabular-nums",
                background: actif ? "var(--bleu-voile)" : "rgb(var(--encre-rgb) / 0.07)", color: actif ? "var(--bleu)" : "var(--gris-fort)" }}>{o.count}</span>
            )}
            {o.badge && (
              <span style={{ fontSize: 9, fontWeight: 800, lineHeight: 1, padding: "3px 7px", borderRadius: 999, letterSpacing: "0.06em", textTransform: "uppercase",
                background: actif ? "var(--bleu-voile)" : "rgb(var(--encre-rgb) / 0.07)", color: actif ? "var(--bleu)" : "var(--gris-fort)" }}>{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Bouton bordé de la barre (ex. Prochain événement) ─────────────────────────
// Le libellé en gras, le détail en gris. `icon` remplace le point bleu quand il
// est fourni (ex. icône de tableau).
export function BarreTitreBadge({ label, detail, onClick, icon }: {
  label: string; detail?: string; onClick?: () => void; icon?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="ds-bouton ds-bouton--secondaire"
      style={{ gap: 8, minWidth: 0, maxWidth: 440, cursor: onClick ? "pointer" : "default", fontWeight: 600 }}>
      {icon
        ? <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, color: "var(--bleu)" }}>{icon}</span>
        : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--bleu)", flexShrink: 0 }} />}
      <span style={{ fontWeight: 700, color: "var(--encre)", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</span>
      {detail && <span style={{ fontWeight: 500, color: "var(--gris-fort)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{detail}</span>}
    </button>
  );
}
