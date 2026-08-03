// Accueil — le briefing du jour, ouvert par le hero bleu des débuts.
//
// Sur téléphone, l'écran d'ouverture répond à trois questions, dans l'ordre :
// où en est l'investissement au Sénégal (chiffre vedette + tendance), qu'est-ce
// qui arrive (prochain événement), où est-ce que je creuse (Explorer).
// L'identité s'affiche d'emblée : le panneau bleu institutionnel à halos,
// « Investissement » en dégradé orange, la pilule de recherche à cheval —
// puis le fond clair reprend et le bleu redevient un accent.
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Appearance, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Explorer from "@/components/Explorer";
import Icone from "@/components/Icone";
import VedetteIde from "@/components/VedetteIde";
import { Apparition, Tapable } from "@/components/ui";
import { fetchTous } from "@/lib/api";
import { useMargeBas } from "@/lib/marges";
import { ESPACE, OMBRE, POLICE, RAYON, T, TYPO } from "@/theme";

// ── Prochain événement — le bloc bleu de la page, tappable ───────────────────
function ProchainEvenement() {
  const router = useRouter();
  const { data: ev } = useQuery({
    queryKey: ["prochain-evenement"],
    queryFn: async () => {
      const evs = await fetchTous("/evenements");
      const futurs = evs
        .filter((e: any) => e.date_debut && e.date_debut >= new Date().toISOString().slice(0, 10))
        .sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      return futurs[0] || null;
    },
  });
  if (!ev) return null;
  const d = new Date(ev.date_debut.slice(0, 10) + "T00:00:00");
  return (
    <Apparition index={1} style={s.blocEvenement}>
      <Text style={s.titreSection}>À venir</Text>
      {/* Bleu plein en dégradé profond — le bloc de couleur qui ancre la
          page (l'idiome du bandeau « reprendre » des grandes apps) */}
      <Tapable onPress={() => router.push("/evenements")} echelle={0.98} style={s.evenementCoquille}>
        <LinearGradient colors={["#063C6E", "#004f91", "#1465AC"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* Halo discret, comme le hero */}
        <View style={s.evenementHalo} />
        <View style={s.evenement}>
          <View style={s.evenementDate}>
            <Text style={s.evenementJour}>{d.getDate()}</Text>
            <Text style={s.evenementMois}>
              {d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.evenementNom} numberOfLines={2}>{ev.nom_event}</Text>
            <Text style={s.evenementLieu} numberOfLines={1}>
              {[ev.ville, ev.pays_hote_nom].filter(Boolean).join(" · ") || "Lieu à confirmer"}
            </Text>
          </View>
          <Icone sf="chevron.right" materiel="chevron_right" taille={14} couleur="rgba(255,255,255,0.7)" poids="semibold" />
        </View>
      </Tapable>
    </Apparition>
  );
}

export default function Accueil() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const margeBas = useMargeBas({ sousOnglets: true });
  const qc = useQueryClient();
  const [rafraichit, setRafraichit] = useState(false);

  // Mode sombre / clair : préférence mémorisée, appliquée au schéma système
  // (le lecteur du Code la suit déjà ; la peau sombre des écrans arrive)
  const [sombre, setSombre] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem("apix.theme").then(v => {
      if (v === "sombre") { setSombre(true); Appearance.setColorScheme("dark"); }
    }).catch(() => {});
  }, []);
  const basculerTheme = () => setSombre(v => {
    const n = !v;
    AsyncStorage.setItem("apix.theme", n ? "sombre" : "clair").catch(() => {});
    Appearance.setColorScheme(n ? "dark" : "light");
    return n;
  });

  // Le hero est bleu : barre d'état blanche tant que l'accueil a le focus
  // (les autres écrans, clairs, posent la leur via EnTetePage).
  // Impératif plutôt qu'un composant <StatusBar> : les trois onglets restent
  // montés simultanément, des composants par écran se disputeraient le style.
  useFocusEffect(useCallback(() => {
    setStatusBarStyle("light");
    return () => setStatusBarStyle("dark");
  }, []));

  const rafraichir = async () => {
    setRafraichit(true);
    try { await qc.refetchQueries({ type: "active" }); } finally { setRafraichit(false); }
  };

  return (
    <ScrollView
      style={{ backgroundColor: T.fond }}
      contentContainerStyle={{ paddingBottom: margeBas }}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir}
        tintColor="#fff" progressViewOffset={insets.top + 40} />}
      showsVerticalScrollIndicator={false}>

      {/* ── Hero — le panneau bleu des débuts, halos compris ── */}
      <View style={[s.hero, { paddingTop: insets.top + 30 }]}>
        <View style={s.haloHaut} />
        <View style={s.haloBas} />

        {/* Mode sombre / clair, posé sur le bleu */}
        <Tapable onPress={basculerTheme} echelle={0.9} hitSlop={8}
          style={[s.boutonMode, { top: insets.top + 58 }]}>
          <Icone sf={sombre ? "sun.max" : "moon"} materiel={sombre ? "light_mode" : "dark_mode"}
            taille={16} couleur="#fff" poids="semibold" />
        </Tapable>

        <Text style={s.surtitre}>PLATEFORME DE GESTION DES INVESTISSEMENTS</Text>

        {/* « Investissement » porte le dégradé orange de la marque */}
        <Text style={s.titre}>Intelligence</Text>
        <MaskedView maskElement={<Text style={[s.titre, s.titreMasque]}>Investissement</Text>}>
          <LinearGradient colors={["#F5B26B", "#E8823C", "#d96f28"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={[s.titre, s.titreMasque, { opacity: 0 }]}>Investissement</Text>
          </LinearGradient>
        </MaskedView>
        <Text style={s.titre}>Sénégal</Text>
      </View>

      {/* Recherche — la porte d'entrée principale, à cheval sur le hero */}
      <Tapable onPress={() => router.push("/recherche")} echelle={0.98} style={s.recherche}>
        <Icone sf="magnifyingglass" materiel="search" taille={17} couleur={T.bleu} poids="semibold" />
        <Text style={s.rechercheTexte}>Rechercher</Text>
      </Tapable>

      {/* ── La situation ── */}
      <VedetteIde />

      {/* ── À venir ── */}
      <ProchainEvenement />

      {/* ── Explorer ── */}
      <Explorer />

      <Text style={s.pied}>APIX · Direction de l&apos;Intelligence et des Perspectives Économiques</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // Le hero bleu des débuts — halos lumineux, coins bas arrondis
  hero: {
    backgroundColor: T.heroFond, paddingHorizontal: 24, paddingBottom: 64,
    overflow: "hidden", borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  haloHaut: { position: "absolute", top: -170, right: -110, width: 340, height: 340, borderRadius: 170, backgroundColor: "rgba(255,255,255,0.055)" },
  haloBas: { position: "absolute", bottom: -150, left: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(26,106,176,0.35)" },
  surtitre: { color: "rgba(255,255,255,0.75)", fontSize: 10.5, fontFamily: POLICE.gras, letterSpacing: 2.2, marginBottom: 22, textAlign: "center" },
  titre: { color: "#fff", fontSize: 40, fontFamily: POLICE.gras, lineHeight: 47, letterSpacing: -1 },
  titreMasque: { color: "#000" },
  boutonMode: {
    position: "absolute", right: 20, width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center", zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  recherche: {
    marginTop: -26, marginHorizontal: 22, height: 52, zIndex: 2,
    backgroundColor: T.carte, borderRadius: 999, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, gap: 11,
    shadowColor: "#001e3c", shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  rechercheTexte: { color: T.gris, fontSize: 14.5, fontFamily: POLICE.moyen, flex: 1 },
  // Titres de section affirmés — la hiérarchie se voit avant de se lire
  titreSection: { fontSize: 17, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.3, marginBottom: ESPACE.s + 2 },
  blocEvenement: { marginTop: ESPACE.l, paddingHorizontal: ESPACE.m },
  evenementCoquille: {
    borderRadius: RAYON.grand, borderCurve: "continuous", overflow: "hidden",
  },
  evenementHalo: {
    position: "absolute", top: -70, right: -50, width: 190, height: 190, borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  evenement: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  // Bloc date en verre clair sur le bleu
  evenementDate: {
    width: 52, height: 56, borderRadius: 14, borderCurve: "continuous",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.24)",
  },
  evenementJour: { fontSize: 21, fontFamily: POLICE.gras, color: "#fff", lineHeight: 25, fontVariant: ["tabular-nums"] },
  evenementMois: { fontSize: 9.5, fontFamily: POLICE.gras, color: "rgba(255,255,255,0.85)", letterSpacing: 1.2, marginTop: 1 },
  evenementNom: { ...TYPO.sousTitre, color: "#fff" },
  evenementLieu: { ...TYPO.legende, color: "rgba(255,255,255,0.72)", marginTop: 3 },
  pied: {
    textAlign: "center", fontSize: 10.5, fontFamily: POLICE.normal,
    color: T.grisClair, marginTop: ESPACE.xl,
  },
});
