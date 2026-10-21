// Icône de l'app — SF Symbols sur iOS, Material Symbols sur Android.
//
// CHAQUE SYSTÈME A SES ICÔNES, et l'œil les reconnaît avant de les lire. Sur
// iPhone et iPad : SF Symbols, le dessin de chaque écran du système, à la
// graisse voulue. Ailleurs : Material Symbols, le langage graphique du site
// et de Google. (L'app avait d'abord retenu Material partout, pour rester
// identique d'un système à l'autre ; elle vise désormais l'inverse — être
// chez elle sur chacun.)
//
// Chaque appel porte les deux noms. Le nom SF est vérifié à la compilation :
// un symbole qui n'existe pas ne passerait pas tsc, au lieu de laisser un
// vide à l'écran.
import { SymbolView, type SFSymbol, type SymbolWeight } from "expo-symbols";
import type { ColorValue } from "react-native";
import Symbole from "@/components/Symbole";
import { IOS } from "@/lib/plateforme";

export type NomsIcone = { sf: SFSymbol; materiel: string };

export default function Icone({ sf, materiel, taille = 20, couleur = "#004f91", poids }: NomsIcone & {
  taille?: number;
  couleur?: ColorValue;
  /** Graisse du symbole SF — sans effet sur les icônes Material. */
  poids?: SymbolWeight;
}) {
  if (IOS) {
    return (
      <SymbolView name={sf} size={taille} tintColor={couleur} weight={poids ?? "regular"}
        fallback={<Symbole nom={materiel} taille={taille} couleur={couleur} />} />
    );
  }
  return <Symbole nom={materiel} taille={taille} couleur={couleur} />;
}
