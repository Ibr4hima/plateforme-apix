// Barre d'onglets — capsule FLOTTANTE EN VERRE, rendue entièrement à la main :
// retoucher l'onglet actif remonte l'écran en haut (émission de « tabPress »,
// que useScrollToTop écoute dans chaque écran d'onglet).
// décollée du bord, flou natif, ombre douce, trois onglets. L'actif est une
// pilule bleu voilé qui enveloppe icône ET libellé (filet fin, libellé bleu
// gras) — le signal se voit d'un coup d'œil, les autres restent en gris calme.
//
// La matière est celle de BoutonVerre : un vrai flou derrière une teinte
// laiteuse, pour que le contenu TRANSPARAISSE en défilant dessous au lieu de
// se couper net sur un aplat. La coquille externe porte l'ombre (un
// overflow:hidden la couperait), l'interne rogne le flou à la capsule.
//
// SUR ANDROID, tout cela n'a pas cours. La capsule flottante est un idiome
// iOS ; Android attend une barre de navigation ANCRÉE, à plat, d'un bord à
// l'autre, avec la pastille d'indication derrière la seule icône — c'est la
// grammaire du Play Store et de Material 3. Et le flou natif y est hors
// d'atteinte (voir plus bas). La barre y est donc plane et opaque.
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icone, { type NomsIcone } from "@/components/Icone";
import { Tapable } from "@/components/ui";
import { tick } from "@/lib/haptique";
import { creerStyles, useSombre } from "@/lib/apparence";
import { ECHELLE, POLICE, T } from "@/theme";

const ONGLETS: readonly ({ nom: string; titre: string; court: string } & NomsIcone)[] = [
  { nom: "index",           titre: "Accueil",                court: "Accueil",         sf: "house",                     materiel: "home" },
  { nom: "investissements", titre: "Investissements privés", court: "Investissements", sf: "chart.line.uptrend.xyaxis", materiel: "finance_mode" },
  { nom: "flux",            titre: "Flux commerciaux",       court: "Économie",        sf: "arrow.left.arrow.right",    materiel: "currency_exchange" },
] as const;

function BarreOnglets({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sombre = useSombre();
  // Sur tablette, la capsule ne s'étire pas d'un bord à l'autre : elle se
  // plafonne et se centre, comme le contenu des écrans
  const capBarre = width >= 700 ? { maxWidth: 520, alignSelf: "center" as const, width: "100%" as const } : null;
  return (
    <View pointerEvents="box-none"
      style={[s.zoneBarre, PLAT ? { bottom: 0 } : { bottom: Math.max(insets.bottom - 4, 12) }]}>
      <View style={[s.coquille, !PLAT && capBarre]}>
      <View style={[s.capsule, PLAT && { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {VERRE ? (
          <>
            <BlurView intensity={64} tint={sombre ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, {
              backgroundColor: sombre ? "rgba(21,30,46,0.72)" : "rgba(255,255,255,0.68)",
            }]} />
          </>
        ) : null}
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
                // quand on retouche l'onglet DÉJÀ actif — le réflexe iOS.
                const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!actif && !ev.defaultPrevented) navigation.navigate(route.name);
              }}>
              <View accessible accessibilityRole="tab" accessibilityLabel={o.titre}
                accessibilityState={{ selected: actif }} style={s.zoneOnglet}>
                {/* La pastille enveloppe l'icône ET le libellé, sur les deux
                    plateformes : c'est elle qui désigne l'onglet actif */}
                <View style={[s.pilule, actif && s.piluleActive]}>
                  <Icone sf={o.sf} materiel={o.materiel} taille={21}
                    couleur={actif ? T.bleu : T.gris} poids={actif ? "semibold" : "regular"} />
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

// Le flou natif n'est fidèle que sur iOS. Android sait flouter (expo-blur,
// dimezisBlurView) mais capture pour cela un bitmap MATERIEL, que le canevas
// logiciel d'une capsule rognée refuse de dessiner — l'app tombait sur
// « Software rendering doesn't support hardware bitmaps ». Ailleurs qu'iOS,
// la barre reste donc un aplat opaque.
const VERRE = Platform.OS === "ios";
// Barre ancrée et plane : la grammaire d'Android
const PLAT = Platform.OS === "android";

const s = creerStyles(() => ({
  zoneBarre: PLAT
    ? { position: "absolute", left: 0, right: 0 }
    : { position: "absolute", left: 14, right: 14 },
  // Coquille : elle seule porte l'ombre, que l'overflow de la capsule couperait
  coquille: PLAT ? {} : {
    borderRadius: 34, borderCurve: "continuous",
    shadowColor: "#001e3c", shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  capsule: PLAT ? {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.carte,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
    paddingHorizontal: 4, paddingTop: 8,
  } : {
    flexDirection: "row", alignItems: "center", overflow: "hidden",
    backgroundColor: VERRE ? "transparent" : T.carte,
    borderRadius: 34, borderCurve: "continuous",
    borderWidth: VERRE ? StyleSheet.hairlineWidth : 0, borderColor: T.voileFort,
    paddingHorizontal: 8, paddingVertical: 7,
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
