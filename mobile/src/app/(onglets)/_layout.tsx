// Barre d'onglets native — Accueil · Investissements · Flux commerciaux ·
// Recherche. Style signature : surface blanche détachée par une ombre douce
// (pas de filet), icône active posée sur une pastille bleu voilé.
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import Symbole from "@/components/Symbole";
import { OMBRE, POLICE, T } from "@/theme";

const ONGLETS = [
  { nom: "index",           titre: "Accueil",          icone: "home" },
  { nom: "investissements", titre: "Investissements",  icone: "finance_mode" },
  { nom: "flux",            titre: "Flux commerciaux", icone: "currency_exchange" },
  { nom: "recherche",       titre: "Recherche",        icone: "search" },
] as const;

function IconeOnglet({ icone, couleur, actif }: { icone: string; couleur: string; actif: boolean }) {
  return (
    <View style={[s.pastille, actif && s.pastilleActive]}>
      <Symbole nom={icone} taille={23} couleur={couleur} />
    </View>
  );
}

export default function OngletsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: T.bleu,
        tabBarInactiveTintColor: T.gris,
        tabBarStyle: {
          backgroundColor: T.carte,
          borderTopWidth: 0,
          height: 86,
          paddingTop: 8,
          ...OMBRE.n3,
          shadowOffset: { width: 0, height: -6 },
        },
        tabBarItemStyle: { gap: 1 },
        tabBarLabelStyle: { fontFamily: POLICE.demi, fontSize: 9.5, letterSpacing: 0.1 },
        sceneStyle: { backgroundColor: T.fond },
      }}>
      {ONGLETS.map(o => (
        <Tabs.Screen key={o.nom} name={o.nom}
          options={{
            title: o.titre,
            tabBarIcon: ({ color, focused }) => <IconeOnglet icone={o.icone} couleur={color} actif={focused} />,
          }} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  pastille: {
    width: 54, height: 30, borderRadius: 999,
    alignItems: "center", justifyContent: "center",
  },
  pastilleActive: { backgroundColor: T.bleuVoile },
});
