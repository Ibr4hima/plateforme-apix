// Modules — liste verticale premium : pastille d'icône Material Symbols,
// numéro d'ordre discret (comme l'accueil du site) et chevron en médaillon.
import { Ionicons } from "@expo/vector-icons";
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
      <View style={s.liste}>
        {MODULES.map((m, i) => (
          <Pressable key={m.cle} onPress={() => ouvrir(m)}
            style={({ pressed }) => [s.ligne, pressed && s.lignePressee]}>
            <View style={s.pastille}>
              <Symbole nom={m.icone} taille={21} couleur={T.bleu} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.ligneTitre} numberOfLines={1}>{m.titre}</Text>
            </View>
            <Text style={s.numero}>{String(i + 1).padStart(2, "0")}</Text>
            <View style={s.chevron}>
              <Ionicons name="chevron-forward" size={13} color={T.bleu} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { marginTop: 30, paddingHorizontal: 18 },
  titre: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.6, marginBottom: 12 },
  liste: { gap: 9 },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff", borderRadius: 18,
    paddingVertical: 13, paddingLeft: 13, paddingRight: 15,
    shadowColor: "#001e3c", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  lignePressee: { transform: [{ scale: 0.985 }], backgroundColor: "#FBFDFF" },
  pastille: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,79,145,0.07)" },
  ligneTitre: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.2 },
  numero: { fontSize: 11, fontFamily: POLICE.gras, color: "#C9D4DF", letterSpacing: 0.5, fontVariant: ["tabular-nums"] },
  chevron: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,79,145,0.06)" },
});
