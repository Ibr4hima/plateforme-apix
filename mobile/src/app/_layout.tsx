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
import { useCallback, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { majSchema, useSombre } from "@/lib/apparence";
import { EMPREINTE_API } from "@/lib/api";
import { useOptionsPile } from "@/lib/navigation";
import { T } from "@/theme";

SplashScreen.preventAutoHideAsync();
// LE LANCEMENT, C'EST LE SPLASH D'iOS, ET LUI SEUL : le logo net et fixe du
// système, qui reste jusqu'à ce que l'app ait posé son premier écran, puis
// s'efface en fondu. Une seconde page de lancement dessinée en JavaScript
// prenait le relais — logo agrandi au-delà de sa définition, tracé de gauche
// à droite au rythme d'un fil JS encore occupé au démarrage, liseré
// lumineux, zoom en sortie : une image floue et instable, « une télé mal
// branchée ».
SplashScreen.setOptions({ fade: true, duration: 350 });

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
  const [polices, erreurPolices] = useFonts({
    GoogleSans_400Regular, GoogleSans_500Medium, GoogleSans_600SemiBold, GoogleSans_700Bold,
    // La police d'icônes de la plateforme (Material Symbols, rendu par ligature)
    MaterialSymbols: require("../../assets/fonts/MaterialSymbolsOutlined.ttf"),
  });
  // Le splash s'efface quand la racine est mesurée — l'app est alors dessinée
  // sous lui, et le fondu la dévoile entière, sans écran vide entre les deux
  const splashParti = useRef(false);
  const surPremiereMesure = useCallback(() => {
    if (splashParti.current) return;
    splashParti.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

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

  // Une police qui ne se charge pas ne doit pas bloquer l'app sous son splash :
  // elle démarre alors avec les polices du système
  if (!polices && !erreurPolices) return null;

  return (
    <PersistQueryClientProvider client={queryClient}
      persistOptions={{ persister, maxAge: UNE_SEMAINE, buster: EMPREINTE_API }}>
      {/* La barre d'état suit l'apparence, sur les barres claires du système
          — sur iOS comme sur Android */}
      <StatusBar style="auto" />
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View key={cleApparence} style={{ flex: 1 }} onLayout={surPremiereMesure}>
      {/* Tout vit sous les onglets : chaque onglet a sa pile, et ses écrans
          s'y empilent (voir lib/navigation et les _layout des onglets) — sauf
          la LECTURE d'un chapitre des lois, empilée au-dessus d'eux : la
          barre du bas s'efface le temps de lire, et revient au retour */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.fond as unknown as string } }}>
        <Stack.Screen name="(onglets)" />
        <Stack.Screen name="lecture/[chapitre]"
          options={{ ...optionsPile, headerShown: true, title: "" }} />
      </Stack>
      {/* Hors ligne, rien ne l'annonce : l'app sert ses données en cache, en
          silence, et se remet à jour d'elle-même au retour du réseau */}
      </View>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
