import type { CSSProperties } from "react";

// Échelle « display » des chiffres clés — les KPI se lisent de loin.
// tabular-nums : chiffres à chasse fixe, les valeurs restent alignées quand
// elles changent (filtres, années) et les grilles de tuiles ne « dansent » pas.

// Valeur d'une tuile KPI (grilles 5 colonnes des pages IDE, Statistiques,
// Tableau de bord…). Écraser `color` au besoin (négatif en rouge, etc.).
export const CHIFFRE_KPI: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#1a1a2e",
  lineHeight: 1,
  letterSpacing: "-0.02em",
  fontVariantNumeric: "tabular-nums",
};

// Grand chiffre de hero (accueil, modals de détail KPI).
export const CHIFFRE_HERO: CSSProperties = {
  fontSize: 34,
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: "-0.02em",
  fontVariantNumeric: "tabular-nums",
};
