// Hero partagé des écrans de modules — bleu APIX, halos, coins bas arrondis.
// Peut embarquer une recherche (verre dépoli) et des segments (pilule active
// blanche). Pas de bouton retour : le glissement iOS fait le retour.
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Symbole from "@/components/Symbole";
import { POLICE, T } from "@/theme";

export type SegmentOption = { cle: string; label: string };

// ── Hero réductible (pattern App Store) ──────────────────────────────────────
// Le grand hero défile avec le contenu ; passé le seuil, une barre compacte
// (titre + action) apparaît en fondu, pilotée par le fil natif.
export function useHeroDefilant() {
  const defilY = useRef(new Animated.Value(0)).current;
  const onScroll = useRef(Animated.event(
    [{ nativeEvent: { contentOffset: { y: defilY } } }],
    { useNativeDriver: true },
  )).current;
  return { defilY, onScroll };
}

// Point blanc pulsant à côté du titre — le même signe de vie que la plateforme
function PointPulsant() {
  const pouls = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pouls, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(pouls, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])).start();
    return () => pouls.stopAnimation();
  }, [pouls]);
  const halo = {
    opacity: pouls.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.7, 0, 0] }),
    transform: [{ scale: pouls.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
  };
  return (
    <View style={sb.pointZone}>
      <Animated.View style={[sb.pointHalo, halo]} />
      <View style={sb.point} />
    </View>
  );
}

export function BarreHero({ titre, defilY, bouton, seuil = 118 }: {
  titre: string;
  defilY: Animated.Value;
  bouton?: { icone: string; onPress: () => void; badge?: number };
  seuil?: number; // défilement à partir duquel la barre est pleinement visible
}) {
  const insets = useSafeAreaInsets();
  // La barre ne doit pas intercepter les touches tant qu'elle est invisible
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = defilY.addListener(({ value }) => setVisible(value > seuil - 30));
    return () => defilY.removeListener(id);
  }, [defilY, seuil]);

  const opacity = defilY.interpolate({ inputRange: [seuil - 42, seuil], outputRange: [0, 1], extrapolate: "clamp" });
  const glisse  = defilY.interpolate({ inputRange: [seuil - 42, seuil], outputRange: [12, 0], extrapolate: "clamp" });

  return (
    <Animated.View pointerEvents={visible ? "box-none" : "none"}
      style={[sb.barre, { paddingTop: insets.top, height: insets.top + 54, opacity }]}>
      <Animated.View style={[sb.contenu, { transform: [{ translateY: glisse }] }]}>
        <PointPulsant />
        <Text style={sb.titre} numberOfLines={1}>{titre}</Text>
        {bouton && (
          <Pressable onPress={bouton.onPress} hitSlop={8}
            style={({ pressed }) => [sb.action, pressed && { backgroundColor: "rgba(255,255,255,0.24)" }]}>
            <Symbole nom={bouton.icone} taille={18} couleur="#fff" />
            {bouton.badge ? (
              <View style={sb.badge}><Text style={sb.badgeTexte}>{bouton.badge}</Text></View>
            ) : null}
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const sb = StyleSheet.create({
  barre: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
    backgroundColor: T.heroFond,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    shadowColor: "#001e3c", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  contenu: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, gap: 10,
  },
  pointZone: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  point: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  pointHalo: { position: "absolute", width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  titre: { flex: 1, color: "#fff", fontSize: 16.5, fontFamily: POLICE.gras, letterSpacing: -0.3 },
  action: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  badge: {
    position: "absolute", top: -3, right: -3, minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: T.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 3.5,
  },
  badgeTexte: { fontSize: 9, fontFamily: POLICE.gras, color: "#fff", fontVariant: ["tabular-nums"] },
});

export default function HeroModule({ titre, sousTitre, recherche, segments, bascule, bouton, children }: {
  titre: string;
  sousTitre?: string;
  recherche?: { valeur: string; onChange: (v: string) => void; placeholder?: string };
  segments?: { options: readonly SegmentOption[]; valeur: string; onChange: (cle: string) => void };
  bascule?: { options: readonly SegmentOption[]; valeur: string; onChange: (cle: string) => void }; // sélecteur de module au-dessus du titre (onglet Données)
  bouton?: { icone: string; onPress: () => void; badge?: number }; // action en verre à droite du titre
  children?: React.ReactNode; // contenu libre inséré sous la recherche
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.hero, { paddingTop: insets.top + (bascule ? 14 : 22) }]}>
      <View style={s.haloHaut} />
      <View style={s.haloBas} />

      {bascule && (
        <View style={s.bascule}>
          {bascule.options.map(o => {
            const actif = bascule.valeur === o.cle;
            return (
              <Pressable key={o.cle} onPress={() => bascule.onChange(o.cle)}
                style={[s.basculePilule, actif && s.basculePiluleActive]}>
                <Text style={[s.basculeTexte, actif && s.basculeTexteActif]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={s.ligneTitre}>
        <Text style={[s.titre, { flexShrink: 1 }]}>{titre}</Text>
        {bouton && (
          <Pressable onPress={bouton.onPress} hitSlop={6}
            style={({ pressed }) => [s.action, pressed && { backgroundColor: "rgba(255,255,255,0.22)" }]}>
            <Symbole nom={bouton.icone} taille={21} couleur="#fff" />
            {bouton.badge ? (
              <View style={s.actionBadge}><Text style={s.actionBadgeTexte}>{bouton.badge}</Text></View>
            ) : null}
          </Pressable>
        )}
      </View>
      {sousTitre ? <Text style={s.sousTitre}>{sousTitre}</Text> : null}

      {recherche && (
        <View style={s.barre}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.65)" />
          <TextInput
            value={recherche.valeur} onChangeText={recherche.onChange}
            placeholder={recherche.placeholder || "Rechercher…"}
            placeholderTextColor="rgba(255,255,255,0.55)"
            autoCorrect={false} clearButtonMode="while-editing"
            style={s.champ} keyboardAppearance="dark" />
        </View>
      )}
      {children}

      {segments && (
        <View style={s.segments}>
          {segments.options.map(o => {
            const actif = segments.valeur === o.cle;
            return (
              <Pressable key={o.cle} onPress={() => segments.onChange(o.cle)}
                style={[s.segment, actif && s.segmentActif]}>
                <Text style={[s.segmentTexte, actif && s.segmentTexteActif]} numberOfLines={1}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: T.heroFond, paddingHorizontal: 22, paddingBottom: 24,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden",
  },
  haloHaut: { position: "absolute", top: -170, right: -110, width: 340, height: 340, borderRadius: 170, backgroundColor: "rgba(255,255,255,0.055)" },
  haloBas: { position: "absolute", bottom: -150, left: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(26,106,176,0.35)" },
  bascule: { flexDirection: "row", gap: 7, marginBottom: 14 },
  basculePilule: {
    borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)",
  },
  basculePiluleActive: { backgroundColor: "#fff", borderColor: "#fff" },
  basculeTexte: { fontSize: 11.5, fontFamily: POLICE.demi, color: "rgba(255,255,255,0.80)" },
  basculeTexteActif: { color: T.bleu, fontFamily: POLICE.gras },
  ligneTitre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  titre: { color: "#fff", fontSize: 29, fontFamily: POLICE.gras, lineHeight: 35, letterSpacing: -0.6 },
  action: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)",
  },
  actionBadge: {
    position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: T.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  actionBadgeTexte: { fontSize: 10, fontFamily: POLICE.gras, color: "#fff", fontVariant: ["tabular-nums"] },
  sousTitre: { color: "rgba(255,255,255,0.70)", fontSize: 12.5, fontFamily: POLICE.normal, marginTop: 6 },
  barre: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 999, paddingHorizontal: 17, height: 47,
  },
  champ: { flex: 1, fontSize: 14.5, fontFamily: POLICE.moyen, color: "#fff" },
  segments: {
    flexDirection: "row", marginTop: 12, padding: 4, gap: 4,
    backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8.5, borderRadius: 999 },
  segmentActif: { backgroundColor: "#fff" },
  segmentTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: "rgba(255,255,255,0.85)" },
  segmentTexteActif: { color: T.bleu },
});
