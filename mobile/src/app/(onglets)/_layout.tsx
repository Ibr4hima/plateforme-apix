// Barre d'onglets — capsule blanche FLOTTANTE, rendue entièrement à la main :
// décollée du bord, ombre douce, trois onglets. L'actif est une pilule bleu
// voilé qui enveloppe icône ET libellé (filet fin, libellé bleu gras) — le
// signal se voit d'un coup d'œil, les autres restent en gris calme.
import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icone, { type NomsIcone } from "@/components/Icone";
import { Tapable } from "@/components/ui";
import { tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

const ONGLETS: readonly ({ nom: string; titre: string; court: string } & NomsIcone)[] = [
  { nom: "index",           titre: "Accueil",                court: "Accueil",         sf: "house",                     materiel: "home" },
  { nom: "investissements", titre: "Investissements privés", court: "Investissements", sf: "chart.line.uptrend.xyaxis", materiel: "finance_mode" },
  { nom: "flux",            titre: "Flux commerciaux",       court: "Économie",        sf: "arrow.left.arrow.right",    materiel: "currency_exchange" },
] as const;

function BarreOnglets({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[s.zoneBarre, { bottom: Math.max(insets.bottom - 4, 12) }]}>
      <View style={s.capsule}>
        {state.routes.map((route: any, i: number) => {
          const o = ONGLETS.find(x => x.nom === route.name);
          if (!o) return null;
          const actif = state.index === i;
          return (
            <Tapable key={route.key} echelle={0.94} surbrillance={false} style={{ flex: 1 }}
              onPress={() => { if (!actif) { tick(); navigation.navigate(route.name); } }}>
              <View accessible accessibilityRole="tab" accessibilityLabel={o.titre}
                accessibilityState={{ selected: actif }} style={s.zoneOnglet}>
                <View style={[s.pilule, actif && s.piluleActive]}>
                  <Icone sf={o.sf} materiel={o.materiel} taille={21}
                    couleur={actif ? T.bleu : T.gris} poids={actif ? "semibold" : "regular"} />
                  <Text style={[s.libelle, actif && s.libelleActif]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    {o.court}
                  </Text>
                </View>
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
  zoneBarre: { position: "absolute", left: 14, right: 14 },
  capsule: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.carte, borderRadius: 34, borderCurve: "continuous",
    paddingHorizontal: 8, paddingVertical: 7,
    shadowColor: "#001e3c", shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  zoneOnglet: { alignItems: "center", justifyContent: "center" },
  pilule: {
    alignItems: "center", justifyContent: "center", gap: 2, alignSelf: "stretch",
    marginHorizontal: 2, paddingVertical: 7, borderRadius: 24, borderCurve: "continuous",
    borderWidth: 1, borderColor: "transparent",
  },
  piluleActive: { backgroundColor: T.bleuVoile, borderColor: T.blocBord },
  libelle: { fontSize: 10.5, fontFamily: POLICE.demi, color: T.gris },
  libelleActif: { color: T.bleu, fontFamily: POLICE.gras },
});
