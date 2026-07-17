// Hero partagé des écrans de modules — même langage que l'accueil :
// bleu APIX, halos lumineux, surtitre espacé, titre Google Sans gras.
// Remplace l'en-tête natif (bouton retour en verre dépoli intégré).
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { POLICE, T } from "@/theme";

export default function HeroModule({ surtitre, titre, sousTitre, droite }: {
  surtitre: string; titre: string; sousTitre?: string; droite?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[s.hero, { paddingTop: insets.top + 8 }]}>
      <View style={s.haloHaut} />
      <View style={s.haloBas} />
      <View style={s.rangee}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [s.retour, pressed && { backgroundColor: "rgba(255,255,255,0.22)" }]}>
          <Ionicons name="chevron-back" size={19} color="#fff" />
        </Pressable>
        {droite}
      </View>
      <Text style={s.surtitre}>{surtitre.toUpperCase()}</Text>
      <Text style={s.titre}>{titre}</Text>
      {sousTitre ? <Text style={s.sousTitre}>{sousTitre}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: T.bleu, paddingHorizontal: 22, paddingBottom: 26, overflow: "hidden" },
  haloHaut: { position: "absolute", top: -170, right: -110, width: 340, height: 340, borderRadius: 170, backgroundColor: "rgba(255,255,255,0.055)" },
  haloBas: { position: "absolute", bottom: -150, left: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(26,106,176,0.35)" },
  rangee: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  retour: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  surtitre: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontFamily: POLICE.gras, letterSpacing: 2, marginBottom: 8 },
  titre: { color: "#fff", fontSize: 28, fontFamily: POLICE.gras, lineHeight: 34, letterSpacing: -0.6 },
  sousTitre: { color: "rgba(255,255,255,0.70)", fontSize: 12.5, fontFamily: POLICE.normal, marginTop: 7 },
});
