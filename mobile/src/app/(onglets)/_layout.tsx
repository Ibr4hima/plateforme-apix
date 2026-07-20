// Barre d'onglets native — Accueil · Investissements privés · Flux
// commerciaux. L'onglet actif est posé sur un beau cadre bleu voilé
// arrondi (icône + libellé), les autres restent en gris discret.
import { Tabs, usePathname } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Symbole from "@/components/Symbole";
import { tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

const ONGLETS = [
  { nom: "index",           chemin: "/",                titre: "Accueil",                icone: "home" },
  { nom: "investissements", chemin: "/investissements", titre: "Investissements privés", icone: "finance_mode" },
  { nom: "flux",            chemin: "/flux",            titre: "Flux commerciaux",       icone: "currency_exchange" },
] as const;

// Bouton d'onglet maison : cadre arrondi autour de l'icône ET du libellé
function BoutonOnglet({ actif, icone, titre, onPress }: {
  actif: boolean; icone: string; titre: string; onPress?: (e: any) => void;
}) {
  return (
    <Pressable onPress={e => { if (!actif) tick(); onPress?.(e); }} style={s.zone}>
      <View style={[s.cadre, actif && s.cadreActif]}>
        <Symbole nom={icone} taille={22} couleur={actif ? T.bleu : T.gris} />
        <Text style={[s.libelle, actif && s.libelleActif]} numberOfLines={1}>{titre}</Text>
      </View>
    </Pressable>
  );
}

export default function OngletsLayout() {
  // L'onglet actif se lit dans la route elle-même — fiable quelle que soit
  // la façon dont la barre transmet (ou non) l'état de sélection au bouton
  const chemin = usePathname();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: T.carte,
          borderTopWidth: Platform.OS === "ios" ? 0.5 : 1,
          borderTopColor: T.bordure,
          height: 88,
        },
        sceneStyle: { backgroundColor: T.fond },
      }}>
      {ONGLETS.map(o => (
        <Tabs.Screen key={o.nom} name={o.nom}
          options={{
            title: o.titre,
            tabBarButton: props => (
              <BoutonOnglet
                actif={o.chemin === "/" ? chemin === "/" : chemin.startsWith(o.chemin)}
                icone={o.icone} titre={o.titre}
                onPress={props.onPress} />
            ),
          }} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  zone: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 8 },
  cadre: {
    alignItems: "center", justifyContent: "center", gap: 3,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 17,
    borderWidth: 1, borderColor: "transparent", minWidth: 92,
  },
  cadreActif: {
    backgroundColor: T.bleuVoile,
    borderColor: T.blocBord,
  },
  libelle: { fontSize: 9.5, fontFamily: POLICE.demi, color: T.gris },
  libelleActif: { color: T.bleu, fontFamily: POLICE.gras },
});
