// Barre d'onglets native — Accueil · Données · Recherche · Plus.
// L'app de consultation quotidienne : chaque destination majeure à un tap,
// la recherche globale (l'outil n° 1 d'un décideur) a son onglet dédié.
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import Symbole from "@/components/Symbole";
import { POLICE, T } from "@/theme";

const ONGLETS = [
  { nom: "index",     titre: "Accueil",   icone: "home" },
  { nom: "donnees",   titre: "Données",   icone: "monitoring" },
  { nom: "recherche", titre: "Recherche", icone: "search" },
  { nom: "plus",      titre: "Plus",      icone: "apps" },
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
          borderTopWidth: StyleSheetHairline,
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

const StyleSheetHairline = Platform.OS === "ios" ? 0.5 : 1;
