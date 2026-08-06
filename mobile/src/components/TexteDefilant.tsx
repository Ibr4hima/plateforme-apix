// Un titre trop long pour sa place ne se coupe plus : il défile.
//
// Le remplacement direct d'un `<Text numberOfLines={1}>` — mêmes styles,
// même encombrement. Tant que le texte tient, RIEN ne bouge : le composant
// se comporte alors exactement comme le Text qu'il remplace. Dès qu'il
// déborde, il part doucement vers la gauche, marque un temps sur la fin,
// puis revient. Aller-retour plutôt que boucle sans fin : on lit le début
// d'un titre bien plus souvent que sa fin.
//
// ── Comment on connaît la largeur qu'il FAUDRAIT ─────────────────────────
// Dans le flux ordinaire, un texte d'une ligne reçoit la largeur de son
// parent et s'y coupe : sa mesure vaut donc celle du parent, jamais la
// sienne. Un exemplaire invisible est donc rendu à côté, dans une boîte de
// 9 999 pt où rien ne le contraint — c'est lui qui donne la largeur
// naturelle. Une ScrollView horizontale rendrait le même service, mais elle
// n'a pas de largeur propre : posée dans une pilule, dont la taille vient
// justement de son contenu, elle la faisait s'effondrer.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

// Ce qui relève du PLACEMENT part sur la boîte, ce qui relève du TEXTE reste
// au texte. Sans ce partage, un titre en `flex: 1` perdait sa part de la
// rangée en devenant défilant, et se réduisait à sa largeur naturelle.
const PLACEMENT = [
  "flex", "flexShrink", "flexGrow", "flexBasis", "alignSelf", "width", "maxWidth",
  "minWidth", "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
  "marginHorizontal", "marginVertical", "marginStart", "marginEnd",
] as const;

export default function TexteDefilant({ texte, children, style, maxFontSizeMultiplier }: {
  /** Le texte, quand il tient en une expression. */
  texte?: string;
  /** Sinon, le contenu tel quel — une étiquette composée de deux morceaux
   *  (« LIBELLÉ · 2024 ») n'a pas à être recollée à la main pour défiler. */
  children?: React.ReactNode;
  style?: any;
  maxFontSizeMultiplier?: number;
}) {
  const dx = useRef(new Animated.Value(0)).current;
  const [boite, setBoite] = useState(0);
  const [largeur, setLargeur] = useState(0);
  // 4 pt de marge : en deçà, le débordement tient à l'arrondi de la mesure
  const deborde = boite > 0 && largeur - boite > 4;

  useEffect(() => {
    if (!deborde) { dx.setValue(0); return; }
    const d = largeur - boite;
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(1400),
      Animated.timing(dx, { toValue: -d, duration: Math.max(1400, d * 45), easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(dx, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    anim.start();
    return () => { anim.stop(); dx.setValue(0); };
  }, [deborde, boite, largeur, dx]);

  const plat: any = StyleSheet.flatten(style) || {};
  const placement: any = {};
  const texteStyle: any = { ...plat };
  for (const cle of PLACEMENT) {
    if (plat[cle] !== undefined) { placement[cle] = plat[cle]; delete texteStyle[cle]; }
  }
  const contenu = texte ?? children;

  return (
    // Une fois le débordement constaté, la boîte fige la largeur qu'elle vient
    // de mesurer : sans quoi le texte élargi à sa taille naturelle la ferait
    // grandir, ce qui supprimerait le débordement, ce qui la ferait rétrécir…
    <View
      style={[{ overflow: "hidden" }, placement, deborde && { width: boite }]}
      onLayout={e => setBoite(e.nativeEvent.layout.width)}>
      {/* Le mesureur : hors flux, invisible, et au large */}
      <View pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, width: 9999, opacity: 0 }}>
        <Text numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}
          style={texteStyle} onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
          {contenu}
        </Text>
      </View>
      {/* Élargi à sa taille naturelle, il ne s'abrège plus : c'est la boîte
          qui le rogne, et le glissement qui en montre la suite */}
      <Animated.Text numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier}
        style={[texteStyle, deborde && { width: largeur }, { transform: [{ translateX: dx }] }]}>
        {contenu}
      </Animated.Text>
    </View>
  );
}
