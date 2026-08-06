// Texte trop long pour son conteneur : défilement lent en aller-retour
// pour se lire en entier (pilules du hero Fiche Pays, pied de chapitre
// du lecteur du code…). Rendu dans une ScrollView horizontale figée pour
// que le texte garde sa largeur naturelle sur une seule ligne.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView } from "react-native";

export default function TexteDefilant({ texte, style }: { texte: string; style?: any }) {
  const dx = useRef(new Animated.Value(0)).current;
  const [boite, setBoite] = useState(0);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const d = largeur - boite;
    if (d > 4) {
      const anim = Animated.loop(Animated.sequence([
        Animated.delay(1100),
        Animated.timing(dx, { toValue: -d, duration: Math.max(1400, d * 45), easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(dx, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      anim.start();
      return () => anim.stop();
    }
    dx.setValue(0);
  }, [boite, largeur, dx]);
  return (
    <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}
      style={{ flexShrink: 1, flexGrow: 0 }}
      onLayout={e => setBoite(e.nativeEvent.layout.width)}>
      <Animated.Text numberOfLines={1} style={[style, { transform: [{ translateX: dx }] }]}
        onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
        {texte}
      </Animated.Text>
    </ScrollView>
  );
}
