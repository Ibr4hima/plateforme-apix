// Modules — pages de 4 cards en défilement horizontal manuel.
// Glassmorphism bleu clair : dégradé translucide, liseré blanc, pastille
// d'icône en verre, les mêmes icônes Material Symbols que le site.
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Symbole from "@/components/Symbole";
import { MODULES, POLICE, T } from "@/theme";

const LARGEUR = Dimensions.get("window").width;

function decouper<T>(liste: readonly T[], taille: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) pages.push(liste.slice(i, i + taille) as T[]);
  return pages;
}

export default function ModulesGrille() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const pages = decouper(MODULES, 4);

  const ouvrir = (m: (typeof MODULES)[number]) => {
    if (m.href) router.push(m.href as any);
    else Alert.alert(m.titre, "Ce module arrive dans une prochaine version de l'application.");
  };

  return (
    <View style={s.bloc}>
      <Text style={s.titre}>MODULES</Text>
      <ScrollView
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / LARGEUR))}>
        {pages.map((modules, i) => (
          <View key={i} style={[s.page, { width: LARGEUR }]}>
            {modules.map(m => (
              <Pressable key={m.cle} onPress={() => ouvrir(m)} style={({ pressed }) => [s.carteOmbre, pressed && { transform: [{ scale: 0.97 }] }]}>
                <LinearGradient
                  colors={["rgba(255,255,255,0.96)", "rgba(219,233,247,0.82)"]}
                  start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
                  style={s.carte}>
                  <View style={s.carteHalo} />
                  <View style={s.pastille}>
                    <Symbole nom={m.icone} taille={21} couleur={T.bleu} />
                  </View>
                  <Text style={s.carteTitre} numberOfLines={2}>{m.titre}</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 && (
        <View style={s.points}>
          {pages.map((_, i) => <View key={i} style={[s.point, i === page && s.pointActif]} />)}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { marginTop: 30 },
  titre: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.6, marginBottom: 12, paddingHorizontal: 18 },
  page: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 18 },
  carteOmbre: {
    width: (LARGEUR - 36 - 12) / 2, borderRadius: 22,
    shadowColor: "#0b3f73", shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  carte: {
    borderRadius: 22, padding: 15, minHeight: 128, justifyContent: "space-between",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.95)", overflow: "hidden",
  },
  carteHalo: { position: "absolute", top: -46, right: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(0,79,145,0.06)" },
  pastille: {
    width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "rgba(0,79,145,0.10)",
    shadowColor: "#0b3f73", shadowOpacity: 0.10, shadowRadius: 7, shadowOffset: { width: 0, height: 3 },
  },
  carteTitre: { fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, lineHeight: 18, marginTop: 14 },
  points: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 13 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(0,79,145,0.18)" },
  pointActif: { width: 18, backgroundColor: T.bleu },
});
