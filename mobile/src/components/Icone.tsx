// Icône de l'app — Material Symbols, l'identité de la plateforme.
//
// L'app a essayé les SF Symbols sur iOS ; le choix retenu est la police
// Material Symbols partout : c'est le langage graphique du site, et une seule
// famille d'icônes garde les deux plateformes identiques.
//
// L'API conserve les deux noms (`sf` est simplement ignoré) : chaque appel
// reste documenté avec son équivalent SF, et rebasculer un jour ne demandera
// que de réactiver expo-symbols dans ce fichier — sans retoucher un seul
// point d'appel.
import { ColorValue } from "react-native";
import Symbole from "@/components/Symbole";

export type NomsIcone = { sf: string; materiel: string };

export default function Icone({ materiel, taille = 20, couleur = "#004f91" }: NomsIcone & {
  taille?: number;
  couleur?: ColorValue;
  /** Graisse (héritage SF) — sans effet avec la police Material. */
  poids?: string;
}) {
  return <Symbole nom={materiel} taille={taille} couleur={couleur} />;
}
