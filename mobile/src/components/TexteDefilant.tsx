// Un titre trop long pour sa place ne se coupe plus : il défile.
//
// Le remplacement direct d'un `<Text numberOfLines={1}>` — mêmes styles,
// même encombrement. Tant que le texte tient, RIEN ne bouge : le composant
// se comporte alors exactement comme le Text qu'il remplace.
//
// Quand il déborde : il glisse d'un trait vers la gauche, JUSTE de quoi
// montrer ce qui manquait, s'y arrête une seconde, puis revient à son point
// de départ. Pas de défilement sans fin, pas de texte qui sort d'un côté
// pour rentrer de l'autre : le mouvement ne sert qu'à révéler la fin, et il
// s'arrête là. Il ne se déclenche jamais pour un titre qui tient.
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
  // Le seuil décide si ça bouge, et il doit être franc : à 4 pt, l'arrondi
  // d'une mesure suffisait à lancer un titre qui tenait parfaitement — un
  // mouvement sans raison, le pire des mouvements. Il faut donc DEUX
  // conditions : au moins 10 pt manquants, et au moins 4 % de la largeur.
  const manque = largeur - boite;
  const deborde = boite > 0 && manque > 10 && manque > boite * 0.04;

  useEffect(() => {
    if (!deborde) { dx.setValue(0); return; }
    // Un aller, un temps d'arrêt sur la fin, un retour. Le rythme est celui
    // d'une lecture : on part vite (≈ 45 pt par seconde), on laisse une
    // seconde pour lire ce qui vient d'apparaître, et on revient d'un trait.
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(900),
      Animated.timing(dx, { toValue: -manque, duration: Math.max(600, manque * 22), easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(dx, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    anim.start();
    return () => { anim.stop(); dx.setValue(0); };
  }, [deborde, manque, dx]);

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
