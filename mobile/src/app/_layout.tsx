import {
  GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_600SemiBold, GoogleSans_700Bold,
  useFonts,
} from "@expo-google-fonts/google-sans";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { majSchema, useSombre } from "@/lib/apparence";
import BandeauHorsLigne from "@/components/BandeauHorsLigne";
import LancementAnime from "@/components/LancementAnime";
import { EMPREINTE_API } from "@/lib/api";
import { useOptionsPile } from "@/lib/navigation";
import { IOS } from "@/lib/plateforme";
import { T } from "@/theme";

SplashScreen.preventAutoHideAsync();

// React Query suit l'état réseau réel : les requêtes se mettent en pause
// hors ligne et repartent seules au retour de la connexion
onlineManager.setEventListener(enLigne =>
  NetInfo.addEventListener(etat => enLigne(etat.isConnected !== false)));

const UNE_SEMAINE = 7 * 24 * 3600 * 1000;

export default function RacineLayout() {
  // Un seul client par session, comme sur le site (staleTime 5 min).
  // gcTime d'une semaine : les données restent servables hors ligne.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000, gcTime: UNE_SEMAINE, retry: 1 } },
  }));
  // Cache persisté sur l'appareil : l'app s'ouvre sur les dernières données
  // connues puis rafraîchit en arrière-plan.
  //
  // Chaque écriture sérialise TOUT le cache sur le fil JS. Le préchargement
  // le fait grossir et le modifie vingt-cinq fois d'affilée : à 2 s d'écart,
  // cela ferait autant de sérialisations d'un objet de plus en plus lourd,
  // en plein défilement. Cinq secondes espacent ces écritures sans rien
  // risquer — le cache n'a pas à être à la seconde près.
  const [persister] = useState(() => createAsyncStoragePersister({
    storage: AsyncStorage, key: "apix-cache-v1", throttleTime: 5000,
  }));
  const [lancement, setLancement] = useState(true);
  const [polices] = useFonts({
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_600SemiBold, GoogleSans_700Bold,
    // La police d'icônes de la plateforme (Material Symbols, rendu par ligature)
    MaterialSymbols: require("../../assets/fonts/MaterialSymbolsOutlined.ttf"),
  });
  useEffect(() => { if (polices) SplashScreen.hideAsync(); }, [polices]);

  // Android : les feuilles de style lisent leur variante AU RENDU (creerStyles)
  // — encore faut-il que tout l'arbre re-rende quand l'apparence change. iOS
  // n'en a pas besoin, le natif rebascule seul ; on garde donc une clé stable
  // pour ne rien y remonter.
  const sombre = useSombre();
  majSchema(sombre);
  // Les options des piles (iOS) : le lecteur des lois, empilé au-dessus des
  // onglets, porte la même barre que les autres pages
  const optionsPile = useOptionsPile();
  const cleApparence = Platform.OS === "android" ? (sombre ? "nuit" : "jour") : "app";

  if (!polices) return null;

  return (
    <PersistQueryClientProvider client={queryClient}
      persistOptions={{ persister, maxAge: UNE_SEMAINE, buster: EMPREINTE_API }}>
      {/* iOS : la barre d'état suit l'apparence, sur les barres claires du
          système ; Android : blanche, sur les bandeaux bleus de l'app */}
      <StatusBar style={IOS ? "auto" : "light"} />
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View key={cleApparence} style={{ flex: 1 }}>
      {/* Tout vit sous les onglets : chaque onglet a sa pile, et ses écrans
          s'y empilent (voir lib/navigation et les _layout des onglets) — sauf
          la LECTURE d'un chapitre des lois, empilée au-dessus d'eux : la
          barre du bas s'efface le temps de lire, et revient au retour */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.fond as unknown as string } }}>
        <Stack.Screen name="(onglets)" />
        <Stack.Screen name="lecture/[chapitre]"
          options={IOS ? { ...optionsPile, headerShown: true, title: "" } : { headerShown: false }} />
      </Stack>
      <BandeauHorsLigne />
      {lancement && <LancementAnime onFini={() => setLancement(false)} />}
      </View>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
