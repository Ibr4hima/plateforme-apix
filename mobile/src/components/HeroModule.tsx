// Hero partagé des écrans de modules — bleu APIX, halos, coins bas arrondis.
// Peut embarquer une recherche (verre dépoli) et des segments (pilule active
// blanche). Pas de bouton retour : le glissement iOS fait le retour.
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Symbole from "@/components/Symbole";
import { POLICE, T } from "@/theme";

export type SegmentOption = { cle: string; label: string };

export default function HeroModule({ titre, sousTitre, recherche, segments, bouton, children }: {
  titre: string;
  sousTitre?: string;
  recherche?: { valeur: string; onChange: (v: string) => void; placeholder?: string };
  segments?: { options: readonly SegmentOption[]; valeur: string; onChange: (cle: string) => void };
  bouton?: { icone: string; onPress: () => void; badge?: number }; // action en verre à droite du titre
  children?: React.ReactNode; // contenu libre inséré sous la recherche
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.hero, { paddingTop: insets.top + 22 }]}>
      <View style={s.haloHaut} />
      <View style={s.haloBas} />

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
