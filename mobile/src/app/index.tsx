// Accueil — le tableau de situation de la plateforme, pensé mobile :
// hero immersif, recherche, chiffres clés animés, prochain événement,
// modules. Tout se rafraîchit d'un tirer-vers-le-bas.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Compteur from "@/components/Compteur";
import { fetchTous, getJson } from "@/lib/api";
import { MODULES, T } from "@/theme";

// « Dans 12 jours » pour le prochain événement
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
  const dateJour = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <ScrollView
      style={{ backgroundColor: T.fond }}
      contentContainerStyle={{ paddingBottom: 46 }}
      refreshControl={<RefreshControl refreshing={stats.isRefetching} onRefresh={() => { stats.refetch(); prochain.refetch(); }} tintColor="#fff" progressViewOffset={insets.top + 40} />}
      showsVerticalScrollIndicator={false}>

      {/* ── Hero immersif ── */}
      <View style={[s.hero, { paddingTop: insets.top + 14 }]}>
        <View style={s.heroHaut}>
          <View style={s.marque}>
            <View style={s.pointPulse} />
            <Text style={s.marqueTexte}>APIX SÉNÉGAL</Text>
          </View>
          <Text style={s.date}>{dateJour}</Text>
        </View>
        <Text style={s.titre}>Intelligence{"\n"}Investissement{"\n"}Sénégal</Text>

        {/* Recherche — la porte d'entrée principale */}
        <Pressable onPress={() => router.push("/recherche")} style={({ pressed }) => [s.recherche, pressed && { opacity: 0.92 }]}>
          <Ionicons name="search" size={17} color={T.bleu} />
          <Text style={s.rechercheTexte}>Rechercher un pays, une entreprise, un accord…</Text>
        </Pressable>
      </View>

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

      {/* ── Prochain événement ── */}
      {prochain.data && (
        <View style={s.section}>
          <Text style={s.sectionTitre}>PROCHAIN ÉVÉNEMENT</Text>
          <View style={s.event}>
            <View style={s.eventBande} />
            <View style={{ flex: 1, padding: 16 }}>
              <Text style={s.eventEcheance}>{dansCombien(prochain.data.date_debut)}</Text>
              <Text style={s.eventNom} numberOfLines={2}>{prochain.data.nom_event}</Text>
              <Text style={s.eventSous}>
                {[new Date(prochain.data.date_debut + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
                  prochain.data.ville, prochain.data.pays_hote_nom].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Modules ── */}
      <View style={s.section}>
        <Text style={s.sectionTitre}>MODULES</Text>
        <View style={s.grille}>
          {MODULES.map(m => (
            <Link key={m.cle} href={m.href as any} asChild disabled={!m.actif}>
              <Pressable style={({ pressed }) => [s.module, pressed && s.modulePresse, !m.actif && { opacity: 0.5 }]}>
                <View style={[s.moduleIcone, { backgroundColor: `${m.couleur}14` }]}>
                  <Ionicons name={`${m.icone}-outline` as any} size={19} color={m.couleur} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.moduleTitre} numberOfLines={1}>{m.titre}</Text>
                  <Text style={s.moduleSous} numberOfLines={1}>{m.actif ? m.sous : "Bientôt"}</Text>
                </View>
                {m.actif && <Ionicons name="chevron-forward" size={15} color={T.grisClair} />}
              </Pressable>
            </Link>
          ))}
        </View>
      </View>

      <Text style={s.pied}>Plateforme APIX · données en direct</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: T.bleu, paddingHorizontal: 22, paddingBottom: 54 },
  heroHaut: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 26 },
  marque: { flexDirection: "row", alignItems: "center", gap: 8 },
  pointPulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  marqueTexte: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  date: { color: "rgba(255,255,255,0.6)", fontSize: 11.5, fontWeight: "600", textTransform: "capitalize" },
  titre: { color: "#fff", fontSize: 34, fontWeight: "800", lineHeight: 40, letterSpacing: -0.8 },
  recherche: {
    position: "absolute", left: 22, right: 22, bottom: -26, height: 52,
    backgroundColor: "#fff", borderRadius: 999, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, gap: 11,
    shadowColor: "#001e3c", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  rechercheTexte: { color: T.gris, fontSize: 14, fontWeight: "500", flex: 1 },
  tuiles: { flexDirection: "row", flexWrap: "wrap", gap: 11, paddingHorizontal: 18, marginTop: 48 },
  tuile: {
    width: "47.8%", backgroundColor: T.carte, borderRadius: T.rayonCarte,
    borderWidth: 1, borderColor: T.bordure, padding: 16, overflow: "hidden",
  },
  tuileBarre: { position: "absolute", left: 0, top: 14, bottom: 14, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  tuileChiffre: { fontSize: 29, fontWeight: "800", color: T.encre, letterSpacing: -0.6, fontVariant: ["tabular-nums"] },
  tuileLabel: { fontSize: 10.5, fontWeight: "700", color: T.gris, marginTop: 5, letterSpacing: 0.2 },
  section: { paddingHorizontal: 18, marginTop: 28 },
  sectionTitre: { fontSize: 10.5, fontWeight: "800", color: T.gris, letterSpacing: 1.6, marginBottom: 11 },
  event: {
    flexDirection: "row", backgroundColor: T.carte, borderRadius: T.rayonCarte,
    borderWidth: 1, borderColor: T.bordure, overflow: "hidden",
  },
  eventBande: { width: 4, backgroundColor: T.bleu },
  eventEcheance: { fontSize: 11, fontWeight: "800", color: T.bleu, letterSpacing: 0.4, textTransform: "uppercase" },
  eventNom: { fontSize: 15.5, fontWeight: "800", color: T.encre, marginTop: 6, lineHeight: 20 },
  eventSous: { fontSize: 12, color: T.gris, marginTop: 6 },
  grille: { gap: 10 },
  module: {
    flexDirection: "row", alignItems: "center", gap: 13,
    backgroundColor: T.carte, borderRadius: T.rayonCarte,
    borderWidth: 1, borderColor: T.bordure, paddingHorizontal: 15, paddingVertical: 13,
  },
  modulePresse: { transform: [{ scale: 0.985 }], borderColor: "rgba(0,79,145,0.35)" },
  moduleIcone: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  moduleTitre: { fontSize: 14.5, fontWeight: "800", color: T.encre },
  moduleSous: { fontSize: 11.5, color: T.gris, marginTop: 2 },
  pied: { textAlign: "center", fontSize: 10.5, color: T.grisClair, marginTop: 34 },
});
