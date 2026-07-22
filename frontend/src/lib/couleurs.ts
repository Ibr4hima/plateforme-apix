// Couleurs partagées de la plateforme — source unique de vérité pour les
// palettes et les dérivations, à la place des copies locales par page.

// Palette des vues comparatives (jusqu'à 4 séries : IDE, BDEF, opportunités…)
export const COMP_PALETTE = ["#004f91", "#ca631f", "#188038", "#6A1B9A"] as const;

// Palette longue des comparaisons multi-pays (fiche pays, statistiques)
export const PALETTE_COMPARAISON = ["#004f91", "#ca631f", "#188038", "#6A1B9A", "#0891b2", "#b91c1c", "#a16207", "#4338ca"] as const;

// Couleurs des pôles territoriaux (par nom normalisé) — alignées sur la carte
export const POLE_COULEURS: Record<string, string> = {
  "dakar": "#9DC3E6",          // bleu clair
  "thies": "#9DD3DE",          // bleu-teal
  "diourbel louga": "#9DDEC2", // menthe
  "centre": "#B4DE9D",         // vert tendre
  "nord": "#D2DE9D",           // vert-jaune
  "nord est": "#E6DE9D",       // jaune doux
  "sud": "#E6C79D",            // pêche
  "sud est": "#E6AC9D",        // corail clair
};

export const normPole = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/pole/g, "").replace(/-/g, " ").replace(/\s+/g, " ").trim();

// Version foncée et saturée d'un pastel — texte lisible sur fond `${pastel}40`
export const foncerPastel = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const mn = Math.min(r, g, b);
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, ((v - mn) * 2 + mn * 0.22) * 0.85)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

// ── Les 4 couleurs canoniques + fonds voilés et badges dérivés ────────────────
// Une seule source pour les habillages « bloc voilé » (fond dégradé + bordure)
// et « badge » (pastille) déclinés dans les 4 teintes de la plateforme.
import type { CSSProperties } from "react";

export const COULEURS_4 = {
  bleu: "#004f91",
  orange: "#ca631f",
  vert: "#188038",
  violet: "#6A1B9A",
} as const;
export type Teinte = keyof typeof COULEURS_4;

// hex (#RRGGBB) → « r, g, b » pour composer des rgba() à opacité variable
const rgbDe = (hex: string) =>
  `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;

// Fond voilé en dégradé (comme la carte « Balance commerciale ») : à étaler
// sur une carte via  style={{ ...fond_bleu, padding: … }}  ou className ds-carte.
export const fondVoile = (teinte: Teinte): CSSProperties => {
  const rgb = rgbDe(COULEURS_4[teinte]);
  return {
    background: `linear-gradient(180deg, rgba(${rgb},0.06), rgba(${rgb},0.02))`,
    border: `1px solid rgba(${rgb},0.16)`,
  };
};

// Badge / pastille (comme les accords et entreprises de la Fiche Pays) :
// pastille blanche translucide à bordure teintée, texte de la couleur.
export const badge = (teinte: Teinte): CSSProperties => {
  const c = COULEURS_4[teinte], rgb = rgbDe(c);
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: 11, fontWeight: 600, color: c,
    background: "rgba(255,255,255,0.7)", border: `1px solid rgba(${rgb},0.20)`,
    padding: "4px 11px", borderRadius: 999,
  };
};

// Constantes nommées prêtes à l'emploi
export const fond_bleu = fondVoile("bleu");
export const fond_orange = fondVoile("orange");
export const fond_vert = fondVoile("vert");
export const fond_violet = fondVoile("violet");

export const badge_bleu = badge("bleu");
export const badge_orange = badge("orange");
export const badge_vert = badge("vert");
export const badge_violet = badge("violet");

// Badge neutre (états inactifs / expirés) : gris, même gabarit que les autres
const GRIS = "108, 117, 125";  // #6b7280
export const badge_gris: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  fontSize: 11, fontWeight: 600, color: "#6b7280",
  background: "rgba(255,255,255,0.7)", border: `1px solid rgba(${GRIS},0.28)`,
  padding: "4px 11px", borderRadius: 999,
};
export const fond_gris: CSSProperties = {
  background: `linear-gradient(180deg, rgba(${GRIS},0.06), rgba(${GRIS},0.02))`,
  border: `1px solid rgba(${GRIS},0.16)`,
};

// Fond survolé d'un badge cliquable (bordure et fond renforcés) — à appliquer
// dans onMouseEnter/Leave, ou via le composant <Badge> ci-dessous.
export const badgeSurvol = (teinte: Teinte) => {
  const rgb = rgbDe(COULEURS_4[teinte]);
  return { background: `rgba(${rgb},0.10)`, borderColor: `rgba(${rgb},0.35)` };
};
