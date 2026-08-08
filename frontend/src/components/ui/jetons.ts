// Jetons côté JS — les noms de la plateforme, adossés aux variables CSS.
//
// Ce module ne porte plus de valeurs : chaque entrée renvoie au jeton
// correspondant de globals.css et suit donc l'apparence sans que ses points
// d'appel changent. Palette catégorielle CONTRÔLÉE : 4 teintes hiérarchiques,
// le rouge est réservé aux alertes.
export const COULEURS = {
  primaire: "var(--bleu)",
  accent:   "var(--orange)",
  succes:   "var(--vert)",
  alerte:   "var(--alerte)",
  danger:   "var(--danger)",
  encre:    "var(--encre)",
  texte:    "var(--texte)",
  muet:     "var(--gris)",
  bordure:  "var(--bordure)",
  grille:   "var(--grille)",
} as const;

// Séries de graphes : bleu → orange → vert → violet (jamais de rouge)
export const PALETTE_SERIES = ["var(--bleu)", "var(--orange)", "var(--vert)", "var(--violet)"] as const;

export const DUREES = { courte: 160, moyenne: 300, longue: 480 } as const;
