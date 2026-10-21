// Icône par son nom Material — la police Material Symbols Outlined, la même
// que la plateforme web (rendu par ligature : le nom devient le glyphe).
//
// SUR iOS, le nom Material est traduit en SF Symbol quand l'app en connaît
// l'équivalent : les écrans qui passent un nom d'icône en donnée (l'état vide,
// les boutons d'un module, une tendance) prennent ainsi l'icône du système
// sans rien savoir de la plateforme. Un nom sans équivalent reste en Material.
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Text, type ColorValue, type TextStyle } from "react-native";
import { IOS } from "@/lib/plateforme";

/** Les icônes Material de l'app, et leur équivalent SF Symbols. */
const SF_DE_MATERIEL: Record<string, SFSymbol> = {
  arrow_back: "chevron.left",
  arrow_forward: "arrow.right",
  arrow_right_alt: "arrow.right",
  autorenew: "arrow.triangle.2.circlepath",
  call: "phone",
  check: "checkmark",
  check_circle: "checkmark.circle.fill",
  chevron_right: "chevron.right",
  close: "xmark",
  cloud_off: "icloud.slash",
  currency_exchange: "arrow.left.arrow.right",
  dark_mode: "moon",
  description: "doc.text",
  expand_less: "chevron.up",
  expand_more: "chevron.down",
  finance_mode: "chart.line.uptrend.xyaxis",
  home: "house",
  language: "globe",
  light_mode: "sun.max",
  mail: "envelope",
  more_horiz: "ellipsis",
  north_east: "arrow.up.right",
  refresh: "arrow.clockwise",
  search: "magnifyingglass",
  search_off: "magnifyingglass",
  signature: "signature",
  south_east: "arrow.down.right",
  trending_down: "arrow.down.right",
  trending_flat: "arrow.right",
  trending_up: "arrow.up.right",
  tune: "slider.horizontal.3",
};

export default function Symbole({ nom, taille = 20, couleur = "#004f91", style }: {
  nom: string; taille?: number; couleur?: ColorValue; style?: TextStyle;
}) {
  const materiel = (
    <Text style={[{ fontFamily: "MaterialSymbols", fontSize: taille, color: couleur, lineHeight: taille * 1.15 }, style]}>
      {nom}
    </Text>
  );
  const sf = IOS ? SF_DE_MATERIEL[nom] : undefined;
  if (!sf) return materiel;
  return <SymbolView name={sf} size={taille} tintColor={couleur} fallback={materiel} />;
}
