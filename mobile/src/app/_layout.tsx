import {
  GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_600SemiBold, GoogleSans_700Bold,
  useFonts,
} from "@expo-google-fonts/google-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { POLICE, T } from "@/theme";

SplashScreen.preventAutoHideAsync();

export default function RacineLayout() {
  // Un seul client par session, comme sur le site (staleTime 5 min)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
  }));
  const [polices] = useFonts({
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_600SemiBold, GoogleSans_700Bold,
    // La police d'icônes de la plateforme (Material Symbols, rendu par ligature)
    MaterialSymbols: require("../../assets/fonts/MaterialSymbolsOutlined.ttf"),
  });
  useEffect(() => { if (polices) SplashScreen.hideAsync(); }, [polices]);
  if (!polices) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: T.heroFond },
          headerTintColor: "#fff",
          headerTitleStyle: { fontFamily: POLICE.gras },
          headerBackTitleStyle: { fontFamily: POLICE.moyen },
          contentStyle: { backgroundColor: T.fond },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="accords" options={{ headerShown: false }} />
        <Stack.Screen name="evenements" options={{ headerShown: false }} />
        <Stack.Screen name="entreprises" options={{ headerShown: false }} />
        <Stack.Screen name="zones" options={{ headerShown: false }} />
        <Stack.Screen name="opportunites" options={{ headerShown: false }} />
        <Stack.Screen name="prospects" options={{ headerShown: false }} />
        <Stack.Screen name="statistiques" options={{ headerShown: false }} />
        <Stack.Screen name="fiche-pays/index" options={{ headerShown: false }} />
        <Stack.Screen name="recherche" options={{ title: "Recherche", presentation: "modal", headerStyle: { backgroundColor: T.carte }, headerTintColor: T.encre }} />
        <Stack.Screen name="code/index" options={{ headerShown: false }} />
        <Stack.Screen name="code/[chapitre]" options={{ headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
}
