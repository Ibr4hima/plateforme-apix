// Accueil — le briefing du jour, pas une vitrine.
//
// Sur téléphone, l'écran d'ouverture répond à trois questions, dans l'ordre :
// où en est l'investissement au Sénégal (chiffre vedette + tendance), qu'est-ce
// qui arrive (prochain événement), où est-ce que je creuse (Explorer).
// L'en-tête garde sa composition (date, « Invest in Senegal », recherche)
// mais se pose sur un bandeau bleu institutionnel qui part du haut de
// l'écran — compact : le reste de la page reste clair, le bleu en accent.
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Appearance, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Explorer from "@/components/Explorer";
import Icone from "@/components/Icone";
import VedetteIde from "@/components/VedetteIde";
import { Apparition, BoutonVerre, Tapable } from "@/components/ui";
import { fetchTous } from "@/lib/api";
import { useSombre, useStyleBarreParDefaut } from "@/lib/apparence";
import { tick } from "@/lib/haptique";
import { useMargeBas } from "@/lib/marges";
import { DEGRADE_EVENEMENT, ECHELLE, ESPACE, POLICE, RAYON, T, TYPO } from "@/theme";

// ── Prochain événement — le bloc bleu de la page, tappable ───────────────────
function ProchainEvenement() {
  const router = useRouter();
  const sombre = useSombre();
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
    <Apparition index={1} cle="accueil-evenement" style={s.blocEvenement}>
      <Text style={s.titreSection} maxFontSizeMultiplier={ECHELLE.texte}>À venir</Text>
      {/* Bleu plein en dégradé profond — le bloc de couleur qui ancre la
          page (l'idiome du bandeau « reprendre » des grandes apps) */}
      <Tapable onPress={() => router.push("/evenements")} echelle={0.98} style={s.evenementCoquille}>
        <LinearGradient colors={[...(sombre ? DEGRADE_EVENEMENT.sombre : DEGRADE_EVENEMENT.clair)]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* Halo discret, comme le hero */}
        <View style={s.evenementHalo} />
        <View style={s.evenement}>
          <View style={s.evenementDate}>
            <Text style={s.evenementJour} maxFontSizeMultiplier={ECHELLE.chiffre}>{d.getDate()}</Text>
            <Text style={s.evenementMois} maxFontSizeMultiplier={ECHELLE.compact}>
              {d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.evenementNom} numberOfLines={2} maxFontSizeMultiplier={ECHELLE.texte}>{ev.nom_event}</Text>
            <Text style={s.evenementLieu} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.texte}>
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
  const { width } = useWindowDimensions();
  const margeBas = useMargeBas({ sousOnglets: true });
  const qc = useQueryClient();
  const [rafraichit, setRafraichit] = useState(false);
  // Retoucher l'onglet Accueil déjà actif remonte la page en haut
  const defilement = useRef<ScrollView>(null);
  useScrollToTop(defilement);

  // Apparence : le système décide par défaut, le bouton lune/soleil tranche
  // et la préférence est mémorisée d'une session à l'autre
  const sombre = useSombre();
  useEffect(() => {
    AsyncStorage.getItem("apix.theme").then(v => {
      if (v === "sombre") Appearance.setColorScheme("dark");
      else if (v === "clair") Appearance.setColorScheme("light");
    }).catch(() => {});
  }, []);
  const basculerTheme = () => {
    tick();
    const suivant = sombre ? "clair" : "sombre";
    Appearance.setColorScheme(suivant === "sombre" ? "dark" : "light");
    AsyncStorage.setItem("apix.theme", suivant).catch(() => {});
  };

  // Le bandeau d'en-tête est bleu : barre d'état blanche tant que l'accueil
  // a le focus (les autres écrans, clairs, posent la leur via EnTetePage).
  // Impératif plutôt qu'un composant <StatusBar> : les trois onglets restent
  // montés simultanément, des composants par écran se disputeraient le style.
  const styleParDefaut = useStyleBarreParDefaut();
  useFocusEffect(useCallback(() => {
    setStatusBarStyle("light");
    return () => setStatusBarStyle(styleParDefaut);
  }, [styleParDefaut]));

  const rafraichir = async () => {
    setRafraichit(true);
    try { await qc.refetchQueries({ type: "active" }); } finally { setRafraichit(false); }
  };

  const dateDuJour = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Tablette : le contenu se plafonne et se centre, comme les autres écrans
  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;

  return (
    <ScrollView
      ref={defilement}
      style={{ backgroundColor: T.fond }}
      contentContainerStyle={{ paddingBottom: margeBas }}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir}
        tintColor="#fff" progressViewOffset={insets.top} />}
      showsVerticalScrollIndicator={false}>

      {/* ── En-tête : le bandeau bleu, du haut de l'écran au titre ── */}
      <View style={[s.enTete, { paddingTop: insets.top + 10 }]}>
        {/* La lumière du bandeau : un dégradé en diagonale, du coin haut droit
            vers le bas gauche. Un cercle translucide se serait coupé net sur
            la bordure basse — le dégradé s'éteint de lui-même. */}
        <LinearGradient
          colors={["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0)"]}
          locations={[0, 0.45, 1]}
          start={{ x: 1, y: -0.1 }} end={{ x: 0.15, y: 1 }}
          pointerEvents="none" style={StyleSheet.absoluteFill} />

        <View style={[s.enTeteContenu, cap]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.date} maxFontSizeMultiplier={ECHELLE.compact}>{dateDuJour.toUpperCase()}</Text>
            {/* Une seule ligne ; « Senegal » porte le dégradé orange de la marque.
                MaskedView est un bloc : la ligne est donc une rangée de deux
                textes, le second masqué par le dégradé. */}
            <View style={s.titreLigne}>
              <Text style={[s.titre, { color: "#fff" }]} maxFontSizeMultiplier={ECHELLE.chiffre}>Invest in </Text>
              <MaskedView maskElement={<Text style={s.titre} maxFontSizeMultiplier={ECHELLE.chiffre}>Senegal</Text>}>
                <LinearGradient colors={["#F5B26B", "#E8823C", "#d96f28"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={[s.titre, { opacity: 0 }]} maxFontSizeMultiplier={ECHELLE.chiffre}>Senegal</Text>
                </LinearGradient>
              </MaskedView>
            </View>
          </View>
          <View style={s.boutonsEnTete}>
            <BoutonVerre onPress={basculerTheme} taille={40}
              accessibilityLabel={sombre ? "Passer en mode clair" : "Passer en mode sombre"}>
              <Icone sf={sombre ? "sun.max" : "moon"} materiel={sombre ? "light_mode" : "dark_mode"}
                taille={17} couleur={T.bleu} poids="semibold" />
            </BoutonVerre>
            <BoutonVerre onPress={() => router.push("/recherche")} taille={40}
              accessibilityLabel="Rechercher">
              <Icone sf="magnifyingglass" materiel="search" taille={17} couleur={T.bleu} poids="semibold" />
            </BoutonVerre>
          </View>
        </View>
      </View>

      {/* Sur tablette, le contenu se plafonne et se centre : une carte de
          1 000 pt de large aplatit la courbe et rend les lignes illisibles */}
      <View style={cap}>
        {/* ── La situation — la carte respire sous le bandeau ── */}
        <View style={{ height: ESPACE.m }} />
        <VedetteIde />

        {/* ── À venir ── */}
        <ProchainEvenement />

        {/* ── Explorer ── */}
        <Explorer />

        <Text style={s.pied} maxFontSizeMultiplier={ECHELLE.texte}>
          Direction de l&apos;Intelligence et des Perspectives Économiques
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // Le bandeau bleu compact — coins bas arrondis, franc mais posé (18 pt,
  // moitié moins que les 28 du grand hero d'origine). L'aplat va d'un bord à
  // l'autre de l'écran ; seul son CONTENU se plafonne (cap).
  enTete: {
    backgroundColor: T.heroFond, overflow: "hidden", paddingBottom: ESPACE.m + 6,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderCurve: "continuous",
  },
  enTeteContenu: {
    flexDirection: "row", alignItems: "flex-end", gap: ESPACE.s,
    paddingHorizontal: ESPACE.m + 4,
  },
  // Blanc à 86 % sur le bleu : 6,6:1, au-dessus du seuil AA (4,5:1)
  date: { ...TYPO.micro, color: "rgba(255,255,255,0.86)" },
  boutonsEnTete: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  titreLigne: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  // 28 pt : « Invest in Senegal » doit tenir sur UNE ligne, bouton recherche compris
  titre: {
    fontSize: 28, lineHeight: 34, fontFamily: POLICE.gras, color: T.encre,
    letterSpacing: -0.7,
  },
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
    minWidth: 52, minHeight: 56, paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 14, borderCurve: "continuous",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.24)",
  },
  evenementJour: { fontSize: 21, fontFamily: POLICE.gras, color: "#fff", lineHeight: 25, fontVariant: ["tabular-nums"] },
  evenementMois: { fontSize: 9.5, fontFamily: POLICE.gras, color: "rgba(255,255,255,0.85)", letterSpacing: 1.2, marginTop: 1 },
  evenementNom: { ...TYPO.sousTitre, color: "#fff" },
  // 4,9:1 sur la partie claire du dégradé — le seuil AA, alors que 72 %
  // n'y arrivait qu'à 3,9:1
  evenementLieu: { ...TYPO.legende, color: "rgba(255,255,255,0.86)", marginTop: 3 },
  pied: {
    textAlign: "center", fontSize: 10.5, fontFamily: POLICE.normal,
    color: T.grisClair, marginTop: ESPACE.xl,
  },
});
