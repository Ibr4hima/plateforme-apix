// Barre d'onglets — CHAQUE SYSTÈME LA SIENNE.
//
// SUR iOS : la barre d'onglets DU SYSTÈME (UITabBar), plus une imitation.
// Sur iOS 26 elle est en verre Liquid Glass et se réduit quand on fait
// défiler vers le bas ; sur iPad, iPadOS la place en haut de l'écran ; elle
// porte les SF Symbols et la teinte de l'app. Retoucher l'onglet actif
// ramène en haut et à la racine — le réflexe iOS, assuré par le système.
//
// SUR ANDROID : une barre ANCRÉE, à plat, d'un bord à l'autre, la pastille
// d'indication derrière l'icône — la grammaire de Material 3. Elle est
// dessinée ici : retoucher l'onglet actif remonte l'écran en haut (émission
// de « tabPress », que useScrollToTop écoute dans chaque écran d'onglet).
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icone, { type NomsIcone } from "@/components/Icone";
import { Tapable } from "@/components/ui";
import { tick } from "@/lib/haptique";
import { creerStyles, useCouleur } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { ECHELLE, POLICE, T } from "@/theme";

const ONGLETS: readonly ({ nom: string; titre: string; court: string } & NomsIcone)[] = [
  { nom: "index",           titre: "Accueil",                court: "Accueil",         sf: "house",                     materiel: "home" },
  { nom: "investissements", titre: "Investissements privés", court: "Investissements", sf: "chart.line.uptrend.xyaxis", materiel: "finance_mode" },
  { nom: "flux",            titre: "Flux commerciaux",       court: "Économie",        sf: "arrow.left.arrow.right",    materiel: "currency_exchange" },
] as const;

export default function OngletsLayout() {
  return IOS ? <OngletsIOS /> : <OngletsAndroid />;
}

// ── iOS : la barre du système ────────────────────────────────────────────────

function OngletsIOS() {
  const bleu = useCouleur(T.bleu) as unknown as string;
  return (
    <NativeTabs tintColor={bleu} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Accueil</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="investissements">
        <Icon sf="chart.line.uptrend.xyaxis" />
        <Label>Investissements</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="flux">
        <Icon sf="arrow.left.arrow.right" />
        <Label>Économie</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// ── Android : la barre ancrée de Material 3 ──────────────────────────────────

function BarreOnglets({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={s.zoneBarre}>
      <View style={[s.barre, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {state.routes.map((route: any, i: number) => {
          const o = ONGLETS.find(x => x.nom === route.name);
          if (!o) return null;
          const actif = state.index === i;
          return (
            <Tapable key={route.key} echelle={0.94} surbrillance={false} style={{ flex: 1 }}
              onPress={() => {
                tick();
                // L'événement standard de react-navigation : les écrans qui
                // enregistrent leur liste (useScrollToTop) remontent en haut
                // quand on retouche l'onglet DÉJÀ actif.
                const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!actif && !ev.defaultPrevented) navigation.navigate(route.name);
              }}>
              <View accessible accessibilityRole="tab" accessibilityLabel={o.titre}
                accessibilityState={{ selected: actif }} style={s.zoneOnglet}>
                {/* La pastille enveloppe l'icône ET le libellé : c'est elle
                    qui désigne l'onglet actif */}
                <View style={[s.pilule, actif && s.piluleActive]}>
                  <Icone sf={o.sf} materiel={o.materiel} taille={21} couleur={actif ? T.bleu : T.gris} />
                  <Text style={[s.libelle, actif && s.libelleActif]} numberOfLines={1}
                    maxFontSizeMultiplier={ECHELLE.compact}>
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

function OngletsAndroid() {
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

const s = creerStyles(() => ({
  zoneBarre: { position: "absolute", left: 0, right: 0, bottom: 0 },
  barre: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.carte,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
    paddingHorizontal: 4, paddingTop: 8,
  },
  zoneOnglet: { alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  pilule: {
    alignItems: "center", justifyContent: "center", gap: 2, alignSelf: "stretch",
    marginHorizontal: 2, paddingVertical: 7, borderRadius: 24, borderCurve: "continuous",
    borderWidth: 1, borderColor: "transparent",
  },
  piluleActive: { backgroundColor: T.bleuVoile, borderColor: T.blocBord },
  libelle: { fontSize: 10.5, fontFamily: POLICE.demi, color: T.gris },
  libelleActif: { color: T.bleu, fontFamily: POLICE.gras },
}));
