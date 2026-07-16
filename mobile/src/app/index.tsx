// Accueil — le tableau de situation de la plateforme, pensé mobile.
// Hero aux couleurs APIX (bleu institutionnel, « Investissement » en orange,
// badge liseré orange comme le site), recherche pilule flottante, chiffres
// clés animés, prochain événement, modules.
import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Compteur from "@/components/Compteur";
import { fetchTous, getJson } from "@/lib/api";
import { MODULES, POLICE, T } from "@/theme";

function dansCombien(dstr: string): string {
  const d = new Date(dstr.slice(0, 10) + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const jours = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return "Demain";
  if (jours < 31) return `Dans ${jours} jours`;
  const mois = Math.round(jours / 30.44);
  if (mois < 12) return `Dans ${mois} mois`;
  return `Dans ${Math.floor(mois / 12)} an${mois >= 24 ? "s" : ""}`;
}

export default function Accueil() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const stats = useQuery({ queryKey: ["stats"], queryFn: () => getJson("/dashboard/stats") });
  const prochain = useQuery({
    queryKey: ["prochain-evenement"],
    queryFn: async () => {
      const evs = await fetchTous("/evenements");
      const futurs = evs
        .filter((e: any) => e.date_debut && e.date_debut >= new Date().toISOString().slice(0, 10))
        .sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      return futurs[0] || null;
    },
  });

  const k = stats.data || {};
  const CHIFFRES = [
    { label: "Entreprises installées", valeur: k.entreprises_total ?? 0, couleur: T.bleu },
    { label: "Accords en vigueur",     valeur: k.accords_vigueur ?? 0,   couleur: T.vert },
    { label: "Événements à venir",     valeur: k.evenements_a_venir ?? 0, couleur: T.orange },
    { label: "Zones d'investissement", valeur: k.zones_total ?? 0,       couleur: "#6A1B9A" },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: T.fond }}
      contentContainerStyle={{ paddingBottom: 46 }}
      refreshControl={<RefreshControl refreshing={stats.isRefetching} onRefresh={() => { stats.refetch(); prochain.refetch(); }} tintColor="#fff" progressViewOffset={insets.top + 40} />}
      showsVerticalScrollIndicator={false}>

      {/* ── Hero ── */}
      <View style={[s.hero, { paddingTop: insets.top + 30 }]}>
        {/* Halos lumineux, comme le hero du site */}
        <View style={s.haloHaut} />
        <View style={s.haloBas} />

        <Text style={s.surtitre}>PLATEFORME DE GESTION DES INVESTISSEMENTS</Text>

        <Text style={s.titre}>Intelligence</Text>
        <MaskedView maskElement={<Text style={[s.titre, s.titreMasque]}>Investissement</Text>}>
          <LinearGradient colors={["#F5B26B", "#E8823C", "#d96f28"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={[s.titre, s.titreMasque, { opacity: 0 }]}>Investissement</Text>
          </LinearGradient>
        </MaskedView>
        <Text style={s.titre}>Sénégal</Text>
      </View>

      {/* Recherche — la porte d'entrée principale, à cheval sur le hero */}
      <Pressable onPress={() => router.push("/recherche")} style={({ pressed }) => [s.recherche, pressed && { opacity: 0.94 }]}>
        <Ionicons name="search" size={17} color={T.bleu} />
        <Text style={s.rechercheTexte}>Rechercher</Text>
      </Pressable>

      {/* ── Prochain événement — carte signature ── */}
      {prochain.data && (() => {
        const d = new Date(prochain.data.date_debut.slice(0, 10) + "T00:00:00");
        return (
          <View style={s.eventOmbre}>
            <LinearGradient colors={["#083a6b", "#004f91"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.event}>
              <View style={s.eventHalo} />
              <View style={s.eventDate}>
                <Text style={s.eventJour}>{d.getDate()}</Text>
                <Text style={s.eventMois}>{d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.eventEnteteLigne}>
                  <Text style={s.eventLabel}>PROCHAIN ÉVÉNEMENT</Text>
                  <LinearGradient colors={["#F5B26B", "#d96f28"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.eventEcheance}>
                    <Text style={s.eventEcheanceTexte}>{dansCombien(prochain.data.date_debut)}</Text>
                  </LinearGradient>
                </View>
                <Text style={s.eventNom} numberOfLines={2}>{prochain.data.nom_event}</Text>
                <Text style={s.eventSous} numberOfLines={1}>
                  {[prochain.data.ville, prochain.data.pays_hote_nom].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </LinearGradient>
          </View>
        );
      })()}

      {/* ── Chiffres clés ── */}
      <View style={s.tuiles}>
        {CHIFFRES.map(c => (
          <View key={c.label} style={s.tuile}>
            <View style={[s.tuileBarre, { backgroundColor: c.couleur }]} />
            <Compteur valeur={c.valeur} style={s.tuileChiffre} />
            <Text style={s.tuileLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Modules ── */}
      <View style={s.section}>
        <Text style={s.sectionTitre}>MODULES</Text>
        <View style={{ gap: 10 }}>
          {MODULES.map(m => (
            <Pressable key={m.cle} disabled={!m.actif} onPress={() => router.push(m.href as any)}
              style={({ pressed }) => [s.module, pressed && s.modulePresse, !m.actif && { opacity: 0.5 }]}>
              <View style={[s.moduleIcone, { backgroundColor: `${m.couleur}14` }]}>
                <Ionicons name={`${m.icone}-outline` as any} size={19} color={m.couleur} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.moduleTitre} numberOfLines={1}>{m.titre}</Text>
                <Text style={s.moduleSous} numberOfLines={1}>{m.actif ? m.sous : "Bientôt"}</Text>
              </View>
              {m.actif && <Ionicons name="chevron-forward" size={15} color={T.grisClair} />}
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={s.pied}>Plateforme APIX · données en direct</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: T.bleu, paddingHorizontal: 24, paddingBottom: 64, overflow: "hidden" },
  haloHaut: { position: "absolute", top: -170, right: -110, width: 340, height: 340, borderRadius: 170, backgroundColor: "rgba(255,255,255,0.055)" },
  haloBas: { position: "absolute", bottom: -150, left: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(26,106,176,0.35)" },
  surtitre: { color: "rgba(255,255,255,0.75)", fontSize: 10.5, fontFamily: POLICE.gras, letterSpacing: 2.2, marginBottom: 22 },
  titre: { color: "#fff", fontSize: 40, fontFamily: POLICE.gras, lineHeight: 47, letterSpacing: -1 },
  titreMasque: { color: "#000" },
  recherche: {
    marginTop: -26, marginHorizontal: 22, height: 52, zIndex: 2,
    backgroundColor: "#fff", borderRadius: 999, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, gap: 11,
    shadowColor: "#001e3c", shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  rechercheTexte: { color: T.gris, fontSize: 14.5, fontFamily: POLICE.moyen, flex: 1 },
  tuiles: { flexDirection: "row", flexWrap: "wrap", gap: 11, paddingHorizontal: 18, marginTop: 24 },
  tuile: {
    width: "47.8%", backgroundColor: T.carte, borderRadius: 16,
    borderWidth: 1, borderColor: T.bordure, padding: 16, overflow: "hidden",
  },
  tuileBarre: { position: "absolute", left: 0, top: 14, bottom: 14, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  tuileChiffre: { fontSize: 28, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  tuileLabel: { fontSize: 10.5, fontFamily: POLICE.demi, color: T.gris, marginTop: 5, letterSpacing: 0.2 },
  section: { paddingHorizontal: 18, marginTop: 28 },
  sectionTitre: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 1.6, marginBottom: 11 },
  eventOmbre: {
    marginHorizontal: 18, marginTop: 22, borderRadius: 20,
    shadowColor: "#001e3c", shadowOpacity: 0.30, shadowRadius: 16, shadowOffset: { width: 0, height: 9 },
    elevation: 7,
  },
  event: {
    flexDirection: "row", alignItems: "center", gap: 15,
    borderRadius: 20, padding: 17, overflow: "hidden",
  },
  eventHalo: { position: "absolute", top: -70, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(255,255,255,0.07)" },
  eventDate: {
    width: 58, height: 62, borderRadius: 15, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  eventJour: { color: "#fff", fontSize: 24, fontFamily: POLICE.gras, lineHeight: 28, fontVariant: ["tabular-nums"] },
  eventMois: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontFamily: POLICE.gras, letterSpacing: 1.4 },
  eventEnteteLigne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  eventLabel: { color: "rgba(255,255,255,0.55)", fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.6 },
  eventEcheance: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5 },
  eventEcheanceTexte: { color: "#fff", fontSize: 10, fontFamily: POLICE.gras, letterSpacing: 0.3 },
  eventNom: { fontSize: 16.5, fontFamily: POLICE.gras, color: "#fff", marginTop: 7, lineHeight: 21 },
  eventSous: { fontSize: 12, fontFamily: POLICE.moyen, color: "rgba(255,255,255,0.65)", marginTop: 5 },
  module: {
    flexDirection: "row", alignItems: "center", gap: 13,
    backgroundColor: T.carte, borderRadius: 16,
    borderWidth: 1, borderColor: T.bordure, paddingHorizontal: 15, paddingVertical: 13,
  },
  modulePresse: { transform: [{ scale: 0.985 }], borderColor: "rgba(0,79,145,0.35)" },
  moduleIcone: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  moduleTitre: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre },
  moduleSous: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  pied: { textAlign: "center", fontSize: 10.5, fontFamily: POLICE.normal, color: T.grisClair, marginTop: 34 },
});
