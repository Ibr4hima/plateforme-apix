// Jetons côté JS — miroir des variables CSS pour ce qui ne peut pas les
// lire (d3/SVG, canvas). Palette catégorielle CONTRÔLÉE : 4 teintes
// hiérarchiques, le rouge est réservé aux alertes.
export const COULEURS = {
  primaire: "#004f91",
  accent:   "#ca631f",
  succes:   "#188038",
  alerte:   "#b45309",
  danger:   "#b91c1c",
  encre:    "#1a1a2e",
  texte:    "#4a5568",
  muet:     "#9aa5b4",
  bordure:  "#ECEAE7",
  grille:   "#EBEBEB",
} as const;

// Séries de graphes : bleu → orange → vert → violet (jamais de rouge)
export const PALETTE_SERIES = ["#004f91", "#ca631f", "#188038", "#6A1B9A"] as const;

export const DUREES = { courte: 160, moyenne: 300, longue: 480 } as const;
