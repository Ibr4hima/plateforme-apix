// Icône Material Symbols Outlined — la même police d'icônes que la
// plateforme web (rendu par ligature : le nom de l'icône devient le glyphe).
import { ColorValue, Text, TextStyle } from "react-native";

export default function Symbole({ nom, taille = 20, couleur = "#004f91", style }: {
  nom: string; taille?: number; couleur?: ColorValue; style?: TextStyle;
}) {
  return (
    <Text style={[{ fontFamily: "MaterialSymbols", fontSize: taille, color: couleur, lineHeight: taille * 1.15 }, style]}>
      {nom}
    </Text>
  );
}
