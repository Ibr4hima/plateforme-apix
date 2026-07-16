// Modules & Plus — listes groupées sur une seule surface, séparateurs en
// retrait, icônes Material Symbols (graisse 600) sur pastille dégradée.
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Symbole from "@/components/Symbole";
import { MODULES, PLUS, POLICE, T } from "@/theme";

type Entree = { cle: string; titre: string; sous: string; icone: string; href: string };

function ListeGroupee({ titre, entrees }: { titre: string; entrees: readonly Entree[] }) {
  const router = useRouter();
  const ouvrir = (m: Entree) => {
    if (m.href) router.push(m.href as any);
    else Alert.alert(m.titre, "Cette section arrive dans une prochaine version de l'application.");
  };
  return (
    <View style={s.bloc}>
      <Text style={s.titre}>{titre}</Text>
      <View style={s.surface}>
        {entrees.map((m, i) => (
          <View key={m.cle}>
            {i > 0 && <View style={s.separateur} />}
            <Pressable onPress={() => ouvrir(m)}
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
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ModulesGrille() {
  return (
    <>
      <ListeGroupee titre="MODULES" entrees={MODULES} />
      <ListeGroupee titre="PLUS" entrees={PLUS} />
    </>
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
  separateur: { height: 1, backgroundColor: "rgba(0,30,60,0.07)", marginLeft: 70 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 15, paddingVertical: 13, paddingHorizontal: 16 },
  pastille: {
    width: 39, height: 39, borderRadius: 12, alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,79,145,0.22)",
  },
  ligneTitre: { fontSize: 15, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2 },
  ligneSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
});
