// Section ÉPINGLÉS de l'accueil — les KPIs que l'utilisateur a épinglés
// d'un appui long dans les modules, avec leur dernière valeur connue.
// Tap : ouvre le module d'origine. Appui long : détache l'épingle.
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Symbole from "@/components/Symbole";
import { ChiffreAnime } from "@/components/ui";
import { KpiEpingle, abonnerEpingles, chargerEpingles, retirerEpingle } from "@/lib/epingles";
import { tick } from "@/lib/haptique";
import { POLICE, T } from "@/theme";

const LARGEUR = Dimensions.get("window").width;

export default function KpisEpingles() {
  const router = useRouter();
  const [liste, setListe] = useState<KpiEpingle[]>([]);

  const charger = useCallback(() => { chargerEpingles().then(setListe); }, []);
  useEffect(() => abonnerEpingles(charger), [charger]);
  useFocusEffect(charger);

  if (!liste.length) return null;

  return (
    <View style={s.bloc}>
      <View style={s.titreLigne}>
        <Symbole nom="keep" taille={13} couleur={T.gris} />
        <Text style={s.titre}>ÉPINGLÉS</Text>
      </View>
      <View style={s.grille}>
        {liste.map(k => (
          <Pressable key={k.id}
            onPress={() => router.push(k.href as any)}
            onLongPress={() => { tick(); retirerEpingle(k.id); }}
            delayLongPress={340}
            style={({ pressed }) => [s.carte, pressed && { transform: [{ scale: 0.98 }] }]}>
            <View style={s.filet} />
            <Text style={s.label} numberOfLines={2}>{k.label.toUpperCase()}</Text>
            <ChiffreAnime texte={k.valeur} style={s.valeur} />
            <View style={s.pied}>
              <Text style={s.source} numberOfLines={1}>{k.sourceLabel}</Text>
              {k.note ? <Text style={s.note} numberOfLines={1}>{k.note}</Text> : null}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { marginTop: 26 },
  titreLigne: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, paddingHorizontal: 18 },
  titre: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.6 },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 18 },
  carte: {
    width: (LARGEUR - 36 - 12) / 2, backgroundColor: T.carte, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 15, overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  filet: { position: "absolute", left: 16, right: 16, top: 0, height: 2.5, borderRadius: 2, backgroundColor: "rgba(202,99,31,0.35)" },
  label: { fontSize: 9, fontFamily: POLICE.gras, color: "#7d95ad", letterSpacing: 0.9, lineHeight: 12, marginTop: 4, minHeight: 24 },
  valeur: { fontSize: 20, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -0.4, marginTop: 8, fontVariant: ["tabular-nums"] },
  pied: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 },
  source: { flexShrink: 1, fontSize: 9.5, fontFamily: POLICE.gras, color: T.orange },
  note: { fontSize: 9.5, fontFamily: POLICE.normal, color: T.gris },
});
