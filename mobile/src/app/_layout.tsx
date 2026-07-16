import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { T } from "@/theme";

SplashScreen.preventAutoHideAsync();

export default function RacineLayout() {
  // Un seul client par session, comme sur le site (staleTime 5 min)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
  }));
  useEffect(() => { SplashScreen.hideAsync(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: T.bleu },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "800" },
          contentStyle: { backgroundColor: T.fond },
        }}>
        <Stack.Screen name="index" options={{ title: "APIX Sénégal" }} />
        <Stack.Screen name="accords" options={{ title: "Accords & Traités" }} />
      </Stack>
    </QueryClientProvider>
  );
}
