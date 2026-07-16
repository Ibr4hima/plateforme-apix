// Modules — liste groupée sur une seule surface, séparateurs hairline en
// retrait (à la manière des listes natives iOS). Aucun ornement : la
// pastille d'icône, le titre, et la lumière du fond au toucher.
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Symbole from "@/components/Symbole";
import { MODULES, POLICE, T } from "@/theme";

export default function ModulesGrille() {
  const router = useRouter();

  const ouvrir = (m: (typeof MODULES)[number]) => {
    if (m.href) router.push(m.href as any);
    else Alert.alert(m.titre, "Ce module arrive dans une prochaine version de l'application.");
  };

  return (
    <View style={s.bloc}>
      <Text style={s.titre}>MODULES</Text>
      <View style={s.surface}>
        {MODULES.map((m, i) => (
          <View key={m.cle}>
            {i > 0 && <View style={s.separateur} />}
            <Pressable onPress={() => ouvrir(m)}
              style={({ pressed }) => [s.ligne, pressed && { backgroundColor: "rgba(0,79,145,0.045)" }]}>
              <LinearGradient
                colors={["rgba(0,79,145,0.10)", "rgba(0,79,145,0.045)"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.pastille}>
                <Symbole nom={m.icone} taille={20} couleur={T.bleu} />
              </LinearGradient>
              <Text style={s.ligneTitre} numberOfLines={1}>{m.titre}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { marginTop: 30, paddingHorizontal: 18 },
  titre: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.6, marginBottom: 12 },
  surface: {
    backgroundColor: "#fff", borderRadius: 22, overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  separateur: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(0,30,60,0.08)", marginLeft: 68 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 15, paddingVertical: 14.5, paddingHorizontal: 17 },
  pastille: {
    width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,79,145,0.16)",
  },
  ligneTitre: { flex: 1, fontSize: 15, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2 },
});
