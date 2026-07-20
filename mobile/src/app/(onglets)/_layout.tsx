// Barre d'onglets native — Accueil · Investissements privés · Flux
// commerciaux. La recherche globale s'ouvre en modal depuis l'accueil.
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import Symbole from "@/components/Symbole";
import { POLICE, T } from "@/theme";

const ONGLETS = [
  { nom: "index",           titre: "Accueil",                icone: "home" },
  { nom: "investissements", titre: "Investissements privés", icone: "finance_mode" },
  { nom: "flux",            titre: "Flux commerciaux",       icone: "currency_exchange" },
] as const;

export default function OngletsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: T.bleu,
        tabBarInactiveTintColor: T.gris,
        tabBarStyle: {
          backgroundColor: T.carte,
          borderTopWidth: Platform.OS === "ios" ? 0.5 : 1,
          borderTopColor: T.bordure,
        },
        tabBarLabelStyle: { fontFamily: POLICE.demi, fontSize: 10.5 },
        sceneStyle: { backgroundColor: T.fond },
      }}>
      {ONGLETS.map(o => (
        <Tabs.Screen key={o.nom} name={o.nom}
          options={{
            title: o.titre,
            tabBarIcon: ({ color }) => <Symbole nom={o.icone} taille={24} couleur={color} />,
          }} />
      ))}
    </Tabs>
  );
}
