// Lancement animé — prolonge le splash natif.
//
// Une page nue : un fond, un logo, rien d'autre. Le logo se dessine de
// gauche à droite derrière un liseré lumineux, puis le voile s'efface pour
// révéler l'app.
//
// Le fond suit l'apparence. De jour, le bleu institutionnel APIX ; de nuit,
// le bleu de minuit de l'app — même famille que le fond des écrans et que le
// hero, pour qu'on ne passe pas d'un aplat éclatant à une nuit profonde en
// une demi-seconde. Dans les deux cas, une seule lumière en diagonale, celle
// des bandeaux : les trois cercles translucides d'avant se coupaient net sur
// les bords, et un bord dur est tout ce qu'une page de lancement ne doit pas
// montrer.
import { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from "react-native";
import { creerStyles, useSombre } from "@/lib/apparence";

const { width: ECRAN } = Dimensions.get("window");
const LOGO_L = Math.min(ECRAN * 0.62, 300);
const LOGO_H = LOGO_L * (337 / 595); // ratio du fichier logo

// Trois bornes plutôt que deux : le fond garde une profondeur, sans qu'aucune
// transition ne se voie. Le logo est blanc — il porte sur les deux.
const FOND = {
  clair: ["#00376A", "#004f91", "#1064AC"] as const,
  sombre: ["#0B1220", "#16213A", "#22406A"] as const,
};

export default function LancementAnime({ onFini }: { onFini: () => void }) {
  const sombre = useSombre();
  const dessin = useRef(new Animated.Value(0)).current;  // révélation du logo
  const voile = useRef(new Animated.Value(1)).current;   // sortie de l'écran
  const [parti, setParti] = useState(false);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(dessin, { toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.delay(430),
      Animated.timing(voile, { toValue: 0, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start(() => { setParti(true); onFini(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (parti) return null;

  return (
    <Animated.View pointerEvents="none" style={[s.fond, {
      backgroundColor: sombre ? "#0B1220" : "#004f91",
      opacity: voile,
      transform: [{ scale: voile.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }],
    }]}>
      <LinearGradient colors={[...(sombre ? FOND.sombre : FOND.clair)]}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* La lumière : la même diagonale que les bandeaux de l'app, qui
          s'éteint d'elle-même au lieu de se couper sur un bord */}
      <LinearGradient
        colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0)"]}
        locations={[0, 0.45, 1]}
        start={{ x: 1, y: 0 }} end={{ x: 0.15, y: 1 }}
        style={StyleSheet.absoluteFill} />

      <View style={{ width: LOGO_L, height: LOGO_H }}>
        {/* Le logo se dessine : fenêtre qui s'ouvre de gauche à droite */}
        <Animated.View style={{
          overflow: "hidden", height: LOGO_H,
          width: dessin.interpolate({ inputRange: [0, 1], outputRange: [0, LOGO_L] }),
        }}>
          <Image source={require("../../assets/images/logo-blanc.png")}
            style={{ width: LOGO_L, height: LOGO_H }} resizeMode="contain" />
        </Animated.View>
        {/* Liseré lumineux au bord du dessin */}
        <Animated.View style={[s.lisere, {
          opacity: dessin.interpolate({ inputRange: [0, 0.06, 0.94, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateX: dessin.interpolate({ inputRange: [0, 1], outputRange: [0, LOGO_L] }) }],
        }]} />
      </View>
    </Animated.View>
  );
}

const s = creerStyles(() => ({
  fond: {
    ...StyleSheet.absoluteFillObject, zIndex: 100,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  lisere: {
    position: "absolute", top: -6, bottom: -6, left: -1, width: 2.5, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "#fff", shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
}));
