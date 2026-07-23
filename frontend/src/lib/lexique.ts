// Lexique de l'investissement — types et couleurs. Les termes sont désormais
// stockés en base et éditables depuis l'admin (/admin/lexique), servis par
// l'API GET /lexique. Ce fichier ne garde que le typage et l'habillage.

export type Categorie =
  | "Investissement"
  | "Commerce extérieur"
  | "Fiscalité & douane"
  | "Juridique"
  | "Zones & aménagement"
  | "Finance"
  | "Macro-économie";

// Terme tel que servi par l'API
export type Terme = {
  id: number;
  terme: string;
  categorie: string;
  definition: string;
  ordre?: number;
  actif?: boolean;
};

// Couleur d'accent par catégorie (pastilles)
export const CAT_COULEUR: Record<string, string> = {
  "Investissement": "#004f91",
  "Commerce extérieur": "#ca631f",
  "Fiscalité & douane": "#188038",
  "Juridique": "#6A1B9A",
  "Zones & aménagement": "#0e7490",
  "Finance": "#be185d",
  "Macro-économie": "#4338ca",
};

// Liste ordonnée des catégories (pour les sélecteurs de l'admin)
export const CATEGORIES: Categorie[] = [
  "Investissement",
  "Commerce extérieur",
  "Fiscalité & douane",
  "Juridique",
  "Zones & aménagement",
  "Finance",
  "Macro-économie",
];
