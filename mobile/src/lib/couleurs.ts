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
