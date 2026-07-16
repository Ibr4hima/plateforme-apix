// Modules — pages de 4 cards en défilement horizontal manuel, dans le même
// langage que les cards Aperçu (blanc, ombre douce, filet bleu) avec les
// icônes Material Symbols de la plateforme.
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
              <Pressable key={m.cle} onPress={() => ouvrir(m)}
                style={({ pressed }) => [s.carte, pressed && { transform: [{ scale: 0.97 }] }]}>
                <View style={s.carteFilet} />
                <View style={s.pastille}>
                  <Symbole nom={m.icone} taille={20} couleur={T.bleu} />
                </View>
                <Text style={s.carteTitre} numberOfLines={2}>{m.titre}</Text>
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
  carte: {
    width: (LARGEUR - 36 - 12) / 2, backgroundColor: "#fff", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 15, minHeight: 122, justifyContent: "space-between",
    overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  carteFilet: { position: "absolute", left: 16, right: 16, top: 0, height: 2.5, borderRadius: 2, backgroundColor: "rgba(0,79,145,0.14)" },
  pastille: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,79,145,0.08)" },
  carteTitre: { fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, lineHeight: 18, marginTop: 13 },
  points: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 13 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(0,79,145,0.18)" },
  pointActif: { width: 18, backgroundColor: T.bleu },
});
