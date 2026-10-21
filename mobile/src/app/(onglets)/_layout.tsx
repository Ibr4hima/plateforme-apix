// Barre d'onglets — CHAQUE SYSTÈME LA SIENNE.
//
// SUR iOS : la barre d'onglets DU SYSTÈME (UITabBar), plus une imitation.
// Trois onglets et, tout à droite, la Recherche, avec le rôle d'iOS.
// Sur iOS 26 elle est en verre Liquid Glass ; elle reste TOUJOURS visible —
// jamais réduite au défilement, jamais cachée par un écran empilé : chaque
// onglet a sa pile, où s'ouvrent ses écrans. Sur iPad, iPadOS la place en
// haut de l'écran. Elle porte les SF Symbols, la teinte de l'app et ses
// libellés en Google Sans, aux tailles d'iOS (10 pt sur iPhone, plus grands
// sur iPad). Retoucher l'onglet actif ramène en haut et à la racine — le
// réflexe iOS, assuré par le système.
//
// SUR ANDROID : la barre de navigation de Material 3 — 80 dp, d'un bord à
// l'autre, l'indicateur de 64 × 32 dp derrière l'icône de l'onglet actif, le
// libellé dessous, l'ondulation au toucher. Elle est dessinée ici : retoucher
// l'onglet actif remonte l'écran en haut (émission de « tabPress », que
// useScrollToTop écoute dans chaque écran d'onglet).
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icone, { type NomsIcone } from "@/components/Icone";
import { creerStyles, useCouleur } from "@/lib/apparence";
import { HAUTEUR_ONGLETS } from "@/lib/marges";
import { IOS, IPAD } from "@/lib/plateforme";
import { ECHELLE, FONTE, T } from "@/theme";

const ONGLETS: readonly ({ nom: string; titre: string; court: string } & NomsIcone)[] = [
  { nom: "(accueil)",       titre: "Accueil",                court: "Accueil",         sf: "house",                     materiel: "home" },
  { nom: "investissements", titre: "Investissements privés", court: "Investissements", sf: "chart.line.uptrend.xyaxis", materiel: "finance_mode" },
  { nom: "flux",            titre: "Flux commerciaux",       court: "Économie",        sf: "arrow.left.arrow.right",    materiel: "currency_exchange" },
  { nom: "recherche",       titre: "Recherche",              court: "Recherche",       sf: "magnifyingglass",           materiel: "search" },
] as const;

export default function OngletsLayout() {
  return IOS ? <OngletsIOS /> : <OngletsAndroid />;
}

// ── iOS : la barre du système ────────────────────────────────────────────────

function OngletsIOS() {
  const bleu = useCouleur(T.bleu) as unknown as string;
  return (
    <NativeTabs tintColor={bleu}
      labelStyle={{ ...FONTE.moyen, fontSize: IPAD ? 13 : 10 }}>
      <NativeTabs.Trigger name="(accueil)">
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
      {/* L'onglet de recherche d'iOS (rôle « search ») : sur iOS 26, la loupe
          se détache au bout de la barre, dans sa propre capsule de verre,
          comme dans Musique ou l'App Store ; avant, un onglet « Rechercher ».
          Son symbole et son titre sont ceux du système (en français : l'app
          déclare cette langue dans app.json). */}
      <NativeTabs.Trigger name="recherche" role="search" />
    </NativeTabs>
  );
}

// ── Android : la barre de navigation de Material 3 ───────────────────────────
// Aux mesures de Material 3 : 80 dp de haut, d'un bord à l'autre, sur la
// surface de la barre ; l'icône en 24 dp dans l'indicateur de l'onglet actif
// — une pilule de 64 × 32 dp au ton de sélection, derrière l'icône seule —,
// le libellé dessous ; l'ondulation au toucher. Dessinée ici plutôt que
// confiée aux onglets natifs de react-native-screens : sur Android, ceux-ci ne
// savent pas encore remonter la page quand on retouche l'onglet actif.

function BarreOnglets({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={s.zoneBarre}>
      <View style={[s.barre, { paddingBottom: insets.bottom }]}>
        {state.routes.map((route: any, i: number) => {
          const o = ONGLETS.find(x => x.nom === route.name);
          if (!o) return null;
          const actif = state.index === i;
          return (
            <Pressable key={route.key} style={s.onglet}
              android_ripple={{ color: T.surbrillance as any, borderless: true, radius: 36 }}
              accessibilityRole="tab" accessibilityLabel={o.titre} accessibilityState={{ selected: actif }}
              onPress={() => {
                // L'événement standard de react-navigation : les écrans qui
                // enregistrent leur liste (useScrollToTop) remontent en haut
                // quand on retouche l'onglet DÉJÀ actif, et sa pile revient à
                // sa racine.
                const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!actif && !ev.defaultPrevented) navigation.navigate(route.name);
              }}>
              <View style={[s.indicateur, actif && s.indicateurActif]}>
                <Icone sf={o.sf} materiel={o.materiel} taille={24} couleur={actif ? T.surSelection : T.gris} />
              </View>
              <Text style={[s.libelle, actif && s.libelleActif]} numberOfLines={1}
                maxFontSizeMultiplier={ECHELLE.compact}>
                {o.court}
              </Text>
            </Pressable>
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
  barre: { flexDirection: "row", backgroundColor: T.surfaceBarre },
  onglet: { flex: 1, height: HAUTEUR_ONGLETS, alignItems: "center", paddingTop: 12 },
  indicateur: { width: 64, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  indicateurActif: { backgroundColor: T.selection },
  libelle: { marginTop: 4, fontSize: 12, lineHeight: 16, ...FONTE.moyen, color: T.gris },
  libelleActif: { color: T.encre, ...FONTE.demi },
}));
