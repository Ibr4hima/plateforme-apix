// Accueil — le briefing du jour, pas une vitrine.
//
// Sur téléphone, l'écran d'ouverture répond à trois questions, dans l'ordre :
// où en est l'investissement au Sénégal (chiffre vedette + tendance), qu'est-ce
// qui arrive (prochain événement), où est-ce que je creuse (Explorer).
// Fond clair de bout en bout : le bleu APIX est un accent — chiffres, icônes,
// pastilles — plus un décor. L'identité tient dans deux lignes de titre, pas
// dans un panneau.
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Explorer from "@/components/Explorer";
import Icone from "@/components/Icone";
import VedetteIde from "@/components/VedetteIde";
import { Apparition, Tapable } from "@/components/ui";
import { fetchTous } from "@/lib/api";
import { useMargeBas } from "@/lib/marges";
import { ESPACE, OMBRE, POLICE, RAYON, T, TYPO } from "@/theme";

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

// ── Prochain événement — une carte claire, tappable ──────────────────────────
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
      <Text style={s.titreSection}>À VENIR</Text>
      <Tapable onPress={() => router.push("/evenements")} echelle={0.98} style={s.evenement}>
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
          <View style={s.echeance}>
            <Text style={s.echeanceTexte}>{dansCombien(ev.date_debut)}</Text>
          </View>
        </View>
        <Icone sf="chevron.right" materiel="chevron_right" taille={13} couleur={T.grisClair} poids="semibold" />
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

  // L'accueil est clair : barre d'état sombre tant qu'il a le focus, retour
  // au blanc en le quittant (les deux autres onglets gardent leur hero bleu).
  // Impératif plutôt qu'un composant <StatusBar> : les trois onglets restent
  // montés simultanément, des composants par écran se disputeraient le style.
  useFocusEffect(useCallback(() => {
    setStatusBarStyle("dark");
    return () => setStatusBarStyle("light");
  }, []));

  const rafraichir = async () => {
    setRafraichit(true);
    try { await qc.refetchQueries({ type: "active" }); } finally { setRafraichit(false); }
  };

  const dateDuJour = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <ScrollView
      style={{ backgroundColor: T.fond }}
      contentContainerStyle={{ paddingBottom: margeBas }}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir}
        tintColor={T.bleu as string} progressViewOffset={insets.top} />}
      showsVerticalScrollIndicator={false}>

      {/* ── En-tête : date, titre, recherche ── */}
      <View style={[s.enTete, { paddingTop: insets.top + 10 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.date}>{dateDuJour.toUpperCase()}</Text>
          {/* Une seule ligne ; « Senegal » porte le dégradé orange de la marque.
              MaskedView est un bloc : la ligne est donc une rangée de deux
              textes, le second masqué par le dégradé. */}
          <View style={s.titreLigne}>
            <Text style={s.titre}>Invest in </Text>
            <MaskedView maskElement={<Text style={s.titre}>Senegal</Text>}>
              <LinearGradient colors={["#F5B26B", "#E8823C", "#d96f28"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={[s.titre, { opacity: 0 }]}>Senegal</Text>
              </LinearGradient>
            </MaskedView>
          </View>
        </View>
        <Tapable onPress={() => router.push("/recherche")} echelle={0.92} hitSlop={8}
          style={s.boutonRecherche}>
          <Icone sf="magnifyingglass" materiel="search" taille={17} couleur={T.bleu} poids="semibold" />
        </Tapable>
      </View>

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
  enTete: {
    flexDirection: "row", alignItems: "flex-end", gap: ESPACE.s,
    paddingHorizontal: ESPACE.m + 4, paddingBottom: ESPACE.m + 2,
  },
  date: { ...TYPO.micro, color: T.gris },
  titreLigne: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  // 28 pt : « Invest in Senegal » doit tenir sur UNE ligne, bouton recherche compris
  titre: {
    fontSize: 28, lineHeight: 34, fontFamily: POLICE.gras, color: T.encre,
    letterSpacing: -0.7,
  },
  boutonRecherche: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: T.carte, marginBottom: 4, borderWidth: 1, borderColor: T.carteBord,
  },
  // Micro-titres de section en bleu : le langage du site (TITRE_SEC)
  titreSection: { ...TYPO.micro, color: T.bleu, marginBottom: ESPACE.s },
  blocEvenement: { marginTop: ESPACE.l, paddingHorizontal: ESPACE.m },
  evenement: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.carte, borderRadius: RAYON.grand, padding: 14,
    borderWidth: 1, borderColor: T.carteBord,
  },
  // Bloc date en bleu plein : l'ancre visuelle de la carte
  evenementDate: {
    width: 52, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: T.bleuAction,
  },
  evenementJour: { fontSize: 21, fontFamily: POLICE.gras, color: "#fff", lineHeight: 25, fontVariant: ["tabular-nums"] },
  evenementMois: { fontSize: 9.5, fontFamily: POLICE.gras, color: "rgba(255,255,255,0.85)", letterSpacing: 1.2, marginTop: 1 },
  evenementNom: { ...TYPO.sousTitre, color: T.encre },
  evenementLieu: { ...TYPO.legende, color: T.gris, marginTop: 2 },
  echeance: {
    alignSelf: "flex-start", backgroundColor: "rgba(202,99,31,0.10)",
    borderRadius: RAYON.pilule, paddingHorizontal: 9, paddingVertical: 2.5, marginTop: 7,
  },
  echeanceTexte: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.orange },
  pied: {
    textAlign: "center", fontSize: 10.5, fontFamily: POLICE.normal,
    color: T.grisClair, marginTop: ESPACE.xl,
  },
});
