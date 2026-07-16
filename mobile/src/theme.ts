// Jetons de design APIX — portés du site web pour que l'app et la plateforme
// parlent exactement le même langage visuel.

export const T = {
  bleu:        "#004f91",
  orange:      "#ca631f",
  vert:        "#188038",
  encre:       "#1a1a2e",
  texte:       "#4a5568",
  gris:        "#9aa5b4",
  grisClair:   "#C5BFBB",
  fond:        "#F6F5F3",
  carte:       "#fff",
  bordure:     "#ECEAE7",
  filet:       "#F2F0EF",
  rayonCarte:  16,
} as const;

export const BADGE = {
  en_vigueur: { label: "En vigueur",            c: "#188038", bg: "rgba(24,128,56,0.08)" },
  signe:      { label: "Signé non en vigueur",  c: "#004f91", bg: "rgba(0,79,145,0.07)" },
  expire:     { label: "Expiré",                c: "#b45309", bg: "rgba(202,99,31,0.10)" },
} as const;
