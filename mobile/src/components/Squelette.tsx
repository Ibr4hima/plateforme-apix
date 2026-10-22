// Squelettes de chargement — des formes qui épousent le vrai contenu
// (cards de liste, grille de KPIs, cartes de graphes) balayées par un
// reflet brillant, à la place des ActivityIndicator centrés.
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";
import { coin, RAYON, T } from "@/theme";
import { creerStyles, useSombre } from "@/lib/apparence";
import { useMouvementReduit } from "@/lib/motion";

const LARGEUR = Dimensions.get("window").width;

// Le reflet : franc sur le gris du jour ; à peine perceptible la nuit, où
// une bande blanche à 55 % balayait l'écran sombre comme un phare
const REFLET_JOUR = ["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0)"] as const;
const REFLET_NUIT = ["rgba(255,255,255,0)", "rgba(255,255,255,0.07)", "rgba(255,255,255,0)"] as const;

// Un « os » : bloc gris balayé par un reflet en boucle (fil natif). Mouvement
// réduit : l'os reste immobile
export function Os({ style }: { style?: any }) {
  const sombre = useSombre();
  const reduit = useMouvementReduit();
  const balaye = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduit) return;
    const boucle = Animated.loop(Animated.timing(balaye, { toValue: 1, duration: 1150, useNativeDriver: true }));
    boucle.start();
    return () => boucle.stop();
  }, [balaye, reduit]);
  return (
    <View style={[s.os, style]}>
      {reduit ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, {
          transform: [{ translateX: balaye.interpolate({ inputRange: [0, 1], outputRange: [-180, LARGEUR] }) }],
        }]}>
          <LinearGradient colors={sombre ? REFLET_NUIT : REFLET_JOUR}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={{ width: 130, height: "100%" }} />
        </Animated.View>
      )}
    </View>
  );
}

// ── Liste : cards fantômes (titre, sous-titre, rangée de stats) ──────────────
export function SqueletteListe({ n = 5 }: { n?: number }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 11 }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={s.carte}>
          <Os style={{ height: 14, width: "68%" }} />
          <Os style={{ height: 10, width: "42%", marginTop: 9 }} />
          <View style={s.filet} />
          <View style={{ flexDirection: "row", gap: 26 }}>
            <Os style={{ height: 9, width: "26%" }} />
            <Os style={{ height: 9, width: "26%" }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── KPIs : la grille 2×2 du carrousel ────────────────────────────────────────
export function SqueletteKpis() {
  const largeurCarte = (LARGEUR - 32 - 11) / 2;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 11, paddingHorizontal: 16 }}>
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={[s.kpi, { width: largeurCarte }]}>
          <Os style={{ height: 8, width: "82%" }} />
          <Os style={{ height: 8, width: "55%", marginTop: 5 }} />
          <Os style={{ height: 19, width: "62%", marginTop: 11 }} />
          <Os style={{ height: 9, width: "38%", marginTop: 10, borderRadius: 999 }} />
        </View>
      ))}
    </View>
  );
}

// ── Graphe : carte avec zone de tracé ────────────────────────────────────────
export function SqueletteGraphe({ hauteur = 150 }: { hauteur?: number }) {
  return (
    <View style={[s.carte, { marginHorizontal: 16 }]}>
      <Os style={{ height: 12, width: "52%" }} />
      <Os style={{ height: hauteur, width: "100%", marginTop: 14, borderRadius: 12 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
        <Os style={{ height: 8, width: 34 }} />
        <Os style={{ height: 8, width: 34 }} />
        <Os style={{ height: 8, width: 34 }} />
      </View>
    </View>
  );
}

// ── Écran de données : pastilles + KPIs + deux graphes ───────────────────────
export function SqueletteDonnees() {
  return (
    <View style={{ paddingTop: 14, gap: 18 }}>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16 }}>
        <Os style={{ height: 26, width: 92, borderRadius: 999 }} />
        <Os style={{ height: 26, width: 74, borderRadius: 999 }} />
        <Os style={{ height: 26, width: 108, borderRadius: 999 }} />
      </View>
      <SqueletteKpis />
      <SqueletteGraphe />
      <SqueletteGraphe />
    </View>
  );
}

const s = creerStyles(() => ({
  os: { backgroundColor: T.filet, borderRadius: 6, overflow: "hidden" },
  carte: {
    backgroundColor: T.carte, borderRadius: coin(RAYON.moyen), borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 16, paddingVertical: 15,
  },
  kpi: {
    backgroundColor: T.carte, borderRadius: coin(18), paddingHorizontal: 15, paddingVertical: 13,
    borderWidth: 1, borderColor: T.bordure,
  },
  filet: { height: 1, backgroundColor: T.filet, marginVertical: 12 },
}));
