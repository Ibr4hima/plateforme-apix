// Onglet Plus — les modules de consultation ponctuelle et les entrées
// transverses, en listes groupées (même langage que l'accueil).
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Symbole from "@/components/Symbole";
import { MODULES, PLUS, POLICE, T } from "@/theme";

// Les deux modules de données vivent dans l'onglet Données
const MODULES_PLUS = MODULES.filter(m => m.cle !== "ide" && m.cle !== "statistiques");

function Liste({ titre, entrees }: { titre: string; entrees: readonly { cle: string; titre: string; sous: string; icone: string; href: string }[] }) {
  const router = useRouter();
  return (
    <View style={s.bloc}>
      <Text style={s.blocTitre}>{titre}</Text>
      <View style={s.surface}>
        {entrees.map((m, i) => (
          <View key={m.cle}>
            {i > 0 && <View style={s.separateur} />}
            <Pressable onPress={() => router.push(m.href as any)}
              style={({ pressed }) => [s.ligne, pressed && { backgroundColor: "rgba(0,79,145,0.05)" }]}>
              <LinearGradient
                colors={["rgba(0,79,145,0.16)", "rgba(0,79,145,0.07)"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.pastille}>
                <Symbole nom={m.icone} taille={22} couleur={T.bleu} />
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.ligneTitre} numberOfLines={1}>{m.titre}</Text>
                <Text style={s.ligneSous} numberOfLines={1}>{m.sous}</Text>
              </View>
              <Symbole nom="chevron_right" taille={20} couleur={T.grisClair} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Plus() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={s.titre}>Plus</Text>
      <Liste titre="MODULES" entrees={MODULES_PLUS} />
      <Liste titre="RESSOURCES" entrees={PLUS} />
      <Text style={s.pied}>Direction de l'Intelligence et des Perspectives Économiques</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  titre: { fontSize: 29, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.6, paddingHorizontal: 20 },
  bloc: { marginTop: 24, paddingHorizontal: 18 },
  blocTitre: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.6, marginBottom: 12 },
  surface: {
    backgroundColor: T.carte, borderRadius: 22, overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  separateur: { height: 1, backgroundColor: "rgba(0,30,60,0.07)", marginLeft: 70 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 15, paddingVertical: 13, paddingHorizontal: 16 },
  pastille: {
    width: 39, height: 39, borderRadius: 12, alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,79,145,0.22)",
  },
  ligneTitre: { fontSize: 15, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2 },
  ligneSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  pied: { textAlign: "center", fontSize: 10.5, fontFamily: POLICE.normal, color: T.grisClair, marginTop: 32 },
});
