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
import { View } from "react-native";
import BandeauHorsLigne from "@/components/BandeauHorsLigne";
import { marquerOrigine } from "@/lib/origineTap";
import { POLICE, T } from "@/theme";

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
  // Cache persisté sur l'appareil : l'app s'ouvre sur les dernières
  // données connues puis rafraîchit en arrière-plan
  const [persister] = useState(() => createAsyncStoragePersister({
    storage: AsyncStorage, key: "apix-cache-v1", throttleTime: 2000,
  }));
  const [polices] = useFonts({
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_600SemiBold, GoogleSans_700Bold,
    // La police d'icônes de la plateforme (Material Symbols, rendu par ligature)
    MaterialSymbols: require("../../assets/fonts/MaterialSymbolsOutlined.ttf"),
  });
  useEffect(() => { if (polices) SplashScreen.hideAsync(); }, [polices]);
  if (!polices) return null;

  return (
    <PersistQueryClientProvider client={queryClient}
      persistOptions={{ persister, maxAge: UNE_SEMAINE, buster: "v1" }}>
      <StatusBar style="light" />
      {/* Capture passive de l'origine de chaque toucher (transitions
          contextuelles des feuilles) — ne revendique jamais le geste */}
      <View style={{ flex: 1 }}
        onStartShouldSetResponderCapture={e => { marquerOrigine(e.nativeEvent.pageY); return false; }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: T.heroFond },
          headerTintColor: "#fff",
          headerTitleStyle: { fontFamily: POLICE.gras },
          headerBackTitleStyle: { fontFamily: POLICE.moyen },
          contentStyle: { backgroundColor: T.fond },
        }}>
        <Stack.Screen name="(onglets)" options={{ headerShown: false }} />
        <Stack.Screen name="recherche" options={{ title: "Recherche", presentation: "modal", headerStyle: { backgroundColor: T.carte }, headerTintColor: T.encre, headerTitleStyle: { fontFamily: POLICE.gras, color: T.encre } }} />
        <Stack.Screen name="accords" options={{ headerShown: false }} />
        <Stack.Screen name="evenements" options={{ headerShown: false }} />
        <Stack.Screen name="entreprises" options={{ headerShown: false }} />
        <Stack.Screen name="zones" options={{ headerShown: false }} />
        <Stack.Screen name="opportunites" options={{ headerShown: false }} />
        <Stack.Screen name="prospects" options={{ headerShown: false }} />
        <Stack.Screen name="fiche-pays/index" options={{ headerShown: false }} />
        <Stack.Screen name="code/index" options={{ headerShown: false }} />
        <Stack.Screen name="code/[chapitre]" options={{ headerShown: false }} />
      </Stack>
      <BandeauHorsLigne />
      </View>
    </PersistQueryClientProvider>
  );
}
