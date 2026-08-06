// Un titre trop long pour sa place ne se coupe plus : il défile.
//
// Le remplacement direct d'un `<Text numberOfLines={1}>` — mêmes styles,
// même encombrement. Tant que le texte tient, RIEN ne bouge : le composant
// se comporte alors exactement comme le Text qu'il remplace. Dès qu'il
// déborde, il part doucement vers la gauche, marque un temps sur la fin,
// puis revient. Aller-retour plutôt que boucle sans fin : on lit le début
// d'un titre bien plus souvent que sa fin, et un texte qui repart de zéro
// en permanence fatigue l'œil.
//
// La mesure passe par une ScrollView horizontale figée : c'est le seul
// moyen, en React Native, de connaître la largeur NATURELLE d'un texte —
// dans le flux ordinaire il reçoit la largeur du parent et s'y coupe.
// Réservé aux TITRES et aux ÉTIQUETTES, jamais aux valeurs : une ScrollView
// par cellule de tableau coûterait cher pour un texte qui ne déborde pas.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet } from "react-native";

// Ce qui relève du PLACEMENT part sur la boîte, ce qui relève du TEXTE reste
// au texte. Sans ce partage, un titre en `flex: 1` perdait sa part de la
// rangée en devenant défilant, et se réduisait à sa largeur naturelle.
const PLACEMENT = [
  "flex", "flexShrink", "flexGrow", "flexBasis", "alignSelf", "width", "maxWidth",
  "minWidth", "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
  "marginHorizontal", "marginVertical", "marginStart", "marginEnd",
] as const;

export default function TexteDefilant({ texte, style, maxFontSizeMultiplier }: {
  texte: string;
  style?: any;
  maxFontSizeMultiplier?: number;
}) {
  const dx = useRef(new Animated.Value(0)).current;
  const [boite, setBoite] = useState(0);
  const [largeur, setLargeur] = useState(0);

  useEffect(() => {
    const d = largeur - boite;
    // 4 pt de marge : en deçà, le débordement tient à l'arrondi de la mesure
    if (boite > 0 && d > 4) {
      const anim = Animated.loop(Animated.sequence([
        Animated.delay(1400),
        Animated.timing(dx, { toValue: -d, duration: Math.max(1400, d * 45), easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(dx, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      anim.start();
      return () => { anim.stop(); dx.setValue(0); };
    }
    dx.setValue(0);
  }, [boite, largeur, dx]);

  const plat: any = StyleSheet.flatten(style) || {};
  const placement: any = {};
  const texteStyle: any = { ...plat };
  for (const cle of PLACEMENT) {
    if (plat[cle] !== undefined) { placement[cle] = plat[cle]; delete texteStyle[cle]; }
  }

  return (
    <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0, flexShrink: 1 }, placement]}
      contentContainerStyle={{ alignItems: "center" }}
      onLayout={e => setBoite(e.nativeEvent.layout.width)}>
      <Animated.Text numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}
        style={[texteStyle, { transform: [{ translateX: dx }] }]}
        onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
        {texte}
      </Animated.Text>
    </ScrollView>
  );
}
