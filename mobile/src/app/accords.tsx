// Accords & Traités — première vue branchée sur l'API de la plateforme.
// Mêmes règles que le site : computeStatutAccord, badges pastel, fmtDate.
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import HeroModule from "@/components/HeroModule";
import { fetchTous } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { computeStatutAccord } from "@/lib/statuts";
import { BADGE, T, POLICE } from "@/theme";

function CarteAccord({ a }: { a: any }) {
  const st = BADGE[(computeStatutAccord(a) || "") as keyof typeof BADGE];
  return (
    <Pressable style={({ pressed }) => [s.carte, pressed && s.cartePressee]}>
      <View style={s.ligneTitre}>
        <Text style={s.titre} numberOfLines={2}>{a.titre}</Text>
        {st && (
          <View style={[s.badge, { backgroundColor: st.bg }]}>
            <Text style={[s.badgeTexte, { color: st.c }]}>{st.label}</Text>
          </View>
        )}
      </View>
      <Text style={s.sous}>
        {[a.date_signature ? `Signé le ${fmtDate(a.date_signature)}` : null,
          a.date_entree_vigueur ? `en vigueur depuis le ${fmtDate(a.date_entree_vigueur)}` : null]
          .filter(Boolean).join(" · ") || "Dates non renseignées"}
      </Text>
    </Pressable>
  );
}

export default function Accords() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["accords"],
    queryFn: () => fetchTous("/accords"),
  });

  const hero = (
    <HeroModule surtitre="Module" titre="Accords & Traités" sousTitre="TBI & traités internationaux" />
  );

  return (
    <FlatList
      style={{ backgroundColor: T.fond }}
      data={isLoading || isError ? [] : (data || [])}
      keyExtractor={(a: any) => String(a.id)}
      renderItem={({ item }) => <View style={s.rangee}><CarteAccord a={item} /></View>}
      contentContainerStyle={s.liste}
      refreshing={isRefetching}
      onRefresh={refetch}
      ListHeaderComponent={
        <>
          {hero}
          {!isLoading && !isError && <Text style={s.compte}>{(data || []).length} accords</Text>}
        </>
      }
      ListEmptyComponent={
        isLoading ? <View style={s.centre}><ActivityIndicator color={T.bleu} size="large" /></View>
        : isError ? (
          <View style={s.centre}>
            <Text style={s.erreur}>Impossible de joindre la plateforme.</Text>
            <Text style={s.erreurSous}>Vérifier EXPO_PUBLIC_API_URL et que le backend est démarré.</Text>
            <Pressable onPress={() => refetch()} style={s.bouton}><Text style={s.boutonTexte}>Réessayer</Text></Pressable>
          </View>
        ) : null
      }
    />
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  erreur: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, textAlign: "center" },
  erreurSous: { fontSize: 12, color: T.gris, textAlign: "center" },
  bouton: { marginTop: 12, backgroundColor: T.bleu, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  boutonTexte: { color: "#fff", fontFamily: POLICE.gras, fontSize: 13 },
  liste: { gap: 11, paddingBottom: 40 },
  rangee: { paddingHorizontal: 16 },
  compte: { fontSize: 11, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1, textTransform: "uppercase", marginTop: 16, marginBottom: 4, paddingHorizontal: 16 },
  carte: { backgroundColor: T.carte, borderRadius: T.rayonCarte, borderWidth: 1, borderColor: T.bordure, padding: 16 },
  cartePressee: { transform: [{ scale: 0.99 }], borderColor: "rgba(0,79,145,0.35)" },
  ligneTitre: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  titre: { flex: 1, fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, lineHeight: 18 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTexte: { fontSize: 10, fontFamily: POLICE.gras },
  sous: { fontSize: 11.5, color: T.gris, marginTop: 8 },
});
