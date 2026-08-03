// Barre d'onglets — reconstruite à la main (composant tabBar custom) pour
// maîtriser chaque pixel : ancrée au bord, VERRE DÉPOLI natif sur toute la
// largeur (flou + voile clair, filet supérieur), et l'état actif lisible d'un
// coup d'œil : l'icône se pose dans une capsule bleu voilé, le libellé passe
// en bleu gras. Libellés complets, retour tactile physique, rôles d'onglet
// posés pour VoiceOver / TalkBack.
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icone, { type NomsIcone } from "@/components/Icone";
import { Tapable } from "@/components/ui";
import { tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

const ONGLETS: readonly ({ nom: string; titre: string } & NomsIcone)[] = [
  { nom: "index",           titre: "Accueil",                sf: "house",                     materiel: "home" },
  { nom: "investissements", titre: "Investissements privés", sf: "chart.line.uptrend.xyaxis", materiel: "finance_mode" },
  { nom: "flux",            titre: "Flux commerciaux",       sf: "arrow.left.arrow.right",    materiel: "currency_exchange" },
] as const;

function BarreOnglets({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.barre, { paddingBottom: Math.max(insets.bottom - 2, 8) }]}>
      <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(250,249,248,0.82)" }]} />
      <View style={s.rangee}>
        {state.routes.map((route: any, i: number) => {
          const o = ONGLETS.find(x => x.nom === route.name);
          if (!o) return null;
          const actif = state.index === i;
          return (
            <Tapable key={route.key} echelle={0.94} surbrillance={false} style={s.zone}
              onPress={() => {
                if (!actif) { tick(); navigation.navigate(route.name); }
              }}>
              <View accessible accessibilityRole="tab" accessibilityLabel={o.titre}
                accessibilityState={{ selected: actif }} style={s.bouton}>
                {/* La capsule bleu voilé n'entoure que l'icône : le signal
                    actif est net sans transformer la barre en boutons */}
                <View style={[s.capsule, actif && s.capsuleActive]}>
                  <Icone sf={o.sf} materiel={o.materiel} taille={21}
                    couleur={actif ? T.bleu : T.gris} poids={actif ? "semibold" : "regular"} />
                </View>
                <Text style={[s.libelle, actif && s.libelleActif]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {o.titre}
                </Text>
              </View>
            </Tapable>
          );
        })}
      </View>
    </View>
  );
}

export default function OngletsLayout() {
  return (
    <Tabs
      tabBar={props => <BarreOnglets {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: T.fond } }}>
      {ONGLETS.map(o => (
        <Tabs.Screen key={o.nom} name={o.nom} options={{ title: o.titre }} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  barre: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingTop: 7, overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  rangee: { flexDirection: "row", alignItems: "flex-start" },
  zone: { flex: 1 },
  bouton: { alignItems: "center", justifyContent: "center", gap: 3 },
  capsule: {
    width: 56, height: 29, borderRadius: 15, alignItems: "center", justifyContent: "center",
    borderCurve: "continuous",
  },
  capsuleActive: { backgroundColor: T.bleuVoile },
  libelle: { fontSize: 9.5, fontFamily: POLICE.demi, color: T.gris },
  libelleActif: { color: T.bleu, fontFamily: POLICE.gras },
});
