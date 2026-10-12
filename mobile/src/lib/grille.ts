// La grille des listes sur grand écran.
//
// Une colonne au téléphone ; deux sur une tablette en portrait, trois en
// paysage. Le contenu se plafonne et se centre : une carte de 1 000 pt ne se
// lit pas mieux qu'une de 360, et une ligne trop longue perd l'œil.
import { useWindowDimensions } from "react-native";

export const MARGE = 16;
export const GOUTTIERE = 12;

export function useGrille() {
  const { width } = useWindowDimensions();
  const colonnes = width >= 1100 ? 3 : width >= 700 ? 2 : 1;
  const plafond = colonnes === 3 ? 1240 : colonnes === 2 ? 940 : null;
  const cap = plafond ? { width: "100%" as const, maxWidth: plafond, alignSelf: "center" as const } : null;
  // La largeur EXACTE d'une cellule : en grille, une dernière rangée
  // incomplète s'étirerait sinon sur toute la largeur
  const largeur = (Math.min(width, plafond ?? width) - 2 * MARGE - (colonnes - 1) * GOUTTIERE) / colonnes;
  return { colonnes, cap, largeur };
}
