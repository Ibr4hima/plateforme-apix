// Lancement animé — prolonge le splash natif : sur le bleu institutionnel,
// le logo se dessine de gauche à droite derrière un liseré lumineux,
// puis le voile s'efface pour révéler l'app.
import { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from "react-native";

const { width: ECRAN } = Dimensions.get("window");
const LOGO_L = Math.min(ECRAN * 0.62, 300);
const LOGO_H = LOGO_L * (337 / 595); // ratio du fichier logo

export default function LancementAnime({ onFini }: { onFini: () => void }) {
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
      opacity: voile,
      transform: [{ scale: voile.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }],
    }]}>
      <LinearGradient colors={["#003259", "#004f91", "#0a5ca3"]}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.haloHaut} />
      <View style={s.haloBas} />
      <View style={s.haloCentre} />

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

const s = StyleSheet.create({
  fond: {
    ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: "#004f91",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  haloHaut: { position: "absolute", top: -170, right: -110, width: 340, height: 340, borderRadius: 170, backgroundColor: "rgba(255,255,255,0.055)" },
  haloBas: { position: "absolute", bottom: -150, left: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(26,106,176,0.35)" },
  haloCentre: { position: "absolute", alignSelf: "center", width: 460, height: 460, borderRadius: 230, backgroundColor: "rgba(255,255,255,0.035)" },
  lisere: {
    position: "absolute", top: -6, bottom: -6, left: -1, width: 2.5, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "#fff", shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
});
