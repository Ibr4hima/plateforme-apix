// Bandeau discret affiché hors connexion : « Données du 17 juil. · hors
// ligne ». L'app continue de servir le cache persistant ; le bandeau
// disparaît en fondu dès que le réseau revient.
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Symbole from "@/components/Symbole";
import { POLICE } from "@/theme";

export default function BandeauHorsLigne() {
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const [horsLigne, setHorsLigne] = useState(false);
  const fondu = useRef(new Animated.Value(0)).current;

  useEffect(() => NetInfo.addEventListener(etat => {
    // `isConnected` vaut null tant que l'état est inconnu : on reste discret
    setHorsLigne(etat.isConnected === false);
  }), []);

  useEffect(() => {
    Animated.timing(fondu, { toValue: horsLigne ? 1 : 0, duration: 240, useNativeDriver: true }).start();
  }, [horsLigne, fondu]);

  if (!horsLigne) return null;

  // Fraîcheur des données servies : la plus récente du cache
  const der = Math.max(0, ...client.getQueryCache().getAll().map(r => r.state.dataUpdatedAt || 0));
  const date = der > 0
    ? new Date(der).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    : null;

  return (
    <Animated.View pointerEvents="none" style={[s.zone, { top: insets.top + 6, opacity: fondu }]}>
      <View style={s.pilule}>
        <Symbole nom="cloud_off" taille={13} couleur="rgba(255,255,255,0.85)" />
        <Text style={s.texte}>{date ? `Données du ${date} · hors ligne` : "Hors ligne"}</Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  zone: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 60 },
  pilule: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(16,28,44,0.92)", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6,
    shadowColor: "#001e3c", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  texte: { fontSize: 11, fontFamily: POLICE.demi, color: "rgba(255,255,255,0.92)" },
});
