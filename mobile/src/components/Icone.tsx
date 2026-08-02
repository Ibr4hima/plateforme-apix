// Icône de l'app — SF Symbols sur iOS, Material Symbols ailleurs.
//
// Sur iOS, une icône n'est pas un dessin : c'est un caractère du système.
// Les SF Symbols s'alignent sur la typographie, portent les graisses et les
// variantes d'Apple, et sont ce que l'œil d'un utilisateur iPhone attend.
// Ailleurs, on garde la police Material Symbols de la plateforme.
//
// Chaque appel fournit les DEUX noms : le SF (typé SFSymbol — un nom invalide
// casse à la compilation, pas dans la main de l'utilisateur) et la ligature
// Material. Le composant choisit selon la plateforme via le `fallback` natif
// de SymbolView.
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { ColorValue } from "react-native";
import Symbole from "@/components/Symbole";

export type NomsIcone = { sf: SymbolViewProps["name"]; materiel: string };

export default function Icone({ sf, materiel, taille = 20, couleur = "#004f91", poids = "medium" }: NomsIcone & {
  taille?: number;
  couleur?: ColorValue;
  /** Graisse SF (iOS seulement) — `medium` par défaut, comme le texte courant. */
  poids?: SymbolViewProps["weight"];
}) {
  return (
    <SymbolView
      name={sf} size={taille} tintColor={couleur} weight={poids}
      fallback={<Symbole nom={materiel} taille={taille} couleur={couleur} />}
    />
  );
}
