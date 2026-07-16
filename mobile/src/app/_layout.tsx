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
  });
  useEffect(() => { if (polices) SplashScreen.hideAsync(); }, [polices]);
  if (!polices) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: T.bleu },
          headerTintColor: "#fff",
          headerTitleStyle: { fontFamily: POLICE.gras },
          headerBackTitleStyle: { fontFamily: POLICE.moyen },
          contentStyle: { backgroundColor: T.fond },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="accords" options={{ title: "Accords & Traités" }} />
        <Stack.Screen name="recherche" options={{ title: "Recherche", presentation: "modal", headerStyle: { backgroundColor: "#fff" }, headerTintColor: "#1a1a2e" }} />
      </Stack>
    </QueryClientProvider>
  );
}
