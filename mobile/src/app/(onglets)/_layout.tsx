// Barre d'onglets — flottante, en verre dépoli, détachée du bord (l'idiome
// des barres iOS récentes) : une capsule de flou natif posée à 8 pt du bas,
// filet froid, ombre douce. L'onglet ACTIF est une pilule bleu plein — icône
// et libellé blancs — qu'on repère d'un coup d'œil ; les autres restent en
// gris discret. Chaque bouton a le retour tactile physique de l'app.
import { BlurView } from "expo-blur";
import { Tabs, usePathname } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icone, { type NomsIcone } from "@/components/Icone";
import { Tapable } from "@/components/ui";
import { tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

const ONGLETS: readonly ({ nom: string; chemin: string; titre: string; court: string } & NomsIcone)[] = [
  { nom: "index",           chemin: "/",                titre: "Accueil",                court: "Accueil",     sf: "house",                     materiel: "home" },
  { nom: "investissements", chemin: "/investissements", titre: "Investissements privés", court: "Investir",    sf: "chart.line.uptrend.xyaxis", materiel: "finance_mode" },
  { nom: "flux",            chemin: "/flux",            titre: "Flux commerciaux",       court: "Échanges",    sf: "arrow.left.arrow.right",    materiel: "currency_exchange" },
] as const;

const BARRE = 62;

// Bouton d'onglet maison : pilule pleine quand actif, retour physique au tap.
// Un tabBarButton personnalisé remplace celui de react-navigation, qui
// portait le rôle et l'état de sélection : on les repose ici, sans quoi
// VoiceOver et TalkBack annoncent trois boutons anonymes au lieu d'onglets.
function BoutonOnglet({ actif, sf, materiel, titre, court, onPress }: {
  actif: boolean; titre: string; court: string; onPress?: (e: any) => void;
} & NomsIcone) {
  return (
    <Tapable onPress={(e?: any) => { if (!actif) tick(); onPress?.(e); }} echelle={0.93} style={s.zone}>
      <View accessible accessibilityRole="tab" accessibilityLabel={titre}
        accessibilityState={{ selected: actif }}
        style={[s.pilule, actif && s.piluleActive]}>
        <Icone sf={sf} materiel={materiel} taille={20} couleur={actif ? "#fff" : T.gris}
          poids={actif ? "semibold" : "regular"} />
        <Text style={[s.libelle, actif && s.libelleActif]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {court}
        </Text>
      </View>
    </Tapable>
  );
}

export default function OngletsLayout() {
  // L'onglet actif se lit dans la route elle-même — fiable quelle que soit
  // la façon dont la barre transmet (ou non) l'état de sélection au bouton
  const chemin = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: 16, right: 16, bottom: Math.max(insets.bottom, 10),
          height: BARRE, borderRadius: BARRE / 2,
          backgroundColor: "transparent", borderTopWidth: 0,
          shadowColor: "#001e3c", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        },
        // La capsule de verre : flou natif + voile laiteux + filet froid
        tabBarBackground: () => (
          <View style={s.verre}>
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.66)" }]} />
          </View>
        ),
        sceneStyle: { backgroundColor: T.fond },
      }}>
      {ONGLETS.map(o => (
        <Tabs.Screen key={o.nom} name={o.nom}
          options={{
            title: o.titre,
            tabBarButton: props => (
              <BoutonOnglet
                actif={o.chemin === "/" ? chemin === "/" : chemin.startsWith(o.chemin)}
                sf={o.sf} materiel={o.materiel} titre={o.titre} court={o.court}
                onPress={props.onPress} />
            ),
          }} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  verre: {
    flex: 1, borderRadius: BARRE / 2, overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(16,26,46,0.14)",
  },
  zone: { flex: 1, alignItems: "center", justifyContent: "center" },
  pilule: {
    alignItems: "center", justifyContent: "center", gap: 2,
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 21, minWidth: 96,
  },
  piluleActive: { backgroundColor: T.bleuAction },
  libelle: { fontSize: 10, fontFamily: POLICE.demi, color: T.gris },
  libelleActif: { color: "#fff", fontFamily: POLICE.gras },
});
