// Accueil — le briefing du jour, pas une vitrine.
//
// Sur téléphone, l'écran d'ouverture répond à trois questions, dans l'ordre :
// où en est l'investissement au Sénégal (chiffre vedette + tendance), qu'est-ce
// qui arrive (prochain événement), où est-ce que je creuse (Explorer).
//
// L'EN-TÊTE « AUJOURD'HUI », sur les deux systèmes : la date en petites
// capitales grises, le bouton jour/nuit sur sa ligne, et dessous le grand
// titre de 34 pt, « Senegal » dans le dégradé de la marque. Pas de barre de
// navigation sur cet écran. Chaque système garde ses gestes :
//   · iOS — le bouton en verre d'iOS 26 (un disque gris avant), et un flou de
//     matériau qui se pose sous la barre d'état dès qu'on fait défiler ;
//   · Android — le bouton icône tonal de Material 3 et son ondulation, et une
//     bande de la couleur du fond sous la barre d'état : le texte n'y passe
//     jamais.
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EvenementSheet from "@/components/EvenementSheet";
import Explorer from "@/components/Explorer";
import Icone, { type NomsIcone } from "@/components/Icone";
import VedetteIde from "@/components/VedetteIde";
import { Apparition, Tapable } from "@/components/ui";
import { fetchTous } from "@/lib/api";
import { appliquerSchema, creerStyles, useSombre } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { useMargeBas } from "@/lib/marges";
import { usePrechargement } from "@/lib/prechargement";
import { ECHELLE, ESPACE, POLICE, RAYON, T, TYPO } from "@/theme";

// ── Prochain événement — le bloc bleu de la page, tappable ───────────────────
// Le toucher ouvre SA fiche, directement : c'est elle qu'on vient chercher,
// pas la liste de tous les événements (l'Explorer y mène).
function ProchainEvenement() {
  const [ouvert, setOuvert] = useState(false);
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
      <Text style={s.titreSection} maxFontSizeMultiplier={ECHELLE.texte}>Événement à venir</Text>
      {/* Un bleu UNI — le bloc de couleur qui ancre la page, sans dégradé ni
          reflet : la couleur de la maison, franche */}
      <Tapable onPress={() => setOuvert(true)} style={s.evenementCoquille}
        accessibilityRole="button" accessibilityLabel={`${ev.nom_event}, ouvrir la fiche`}>
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
          <Icone sf="chevron.right" materiel="chevron_right" taille={14} couleur={T.surTuileEvenementDoux} poids="semibold" />
        </View>
      </Tapable>
      {ouvert && <EvenementSheet ev={ev} onClose={() => setOuvert(false)} />}
    </Apparition>
  );
}

export default function Accueil() {
  // Le cache des autres modules se remplit en arrière-plan, une fois l'accueil
  // peint et ses propres requêtes abouties — pour qu'ils soient consultables
  // hors ligne sans avoir été ouverts une première fois
  usePrechargement();
  const insets = useSafeAreaInsets();
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
  // appliquerSchema plutôt qu'Appearance.setColorScheme : Android lit le
  // schéma hors de React (lib/apparence) et ce cache doit suivre la bascule
  useEffect(() => {
    AsyncStorage.getItem("apix.theme").then(v => {
      if (v === "sombre") appliquerSchema(true);
      else if (v === "clair") appliquerSchema(false);
    }).catch(() => {});
  }, []);
  const basculerTheme = () => {
    const suivant = sombre ? "clair" : "sombre";
    appliquerSchema(suivant === "sombre");
    AsyncStorage.setItem("apix.theme", suivant).catch(() => {});
  };

  // iOS : le flou sous la barre d'état apparaît dès que le contenu y passe.
  // Les marges automatiques font démarrer le défilement à -insets.top.
  const defil = useRef(new Animated.Value(0)).current;
  const voileHaut = defil.interpolate({
    inputRange: [-insets.top, -insets.top + 18], outputRange: [0, 1], extrapolate: "clamp",
  });

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
    <>
    <Animated.ScrollView
      ref={defilement}
      style={{ backgroundColor: T.fond }}
      // iOS : sous la barre d'état et au-dessus de la barre d'onglets, les
      // marges se règlent d'elles-mêmes
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: margeBas }}
      scrollEventThrottle={16}
      onScroll={IOS ? Animated.event([{ nativeEvent: { contentOffset: { y: defil } } }], { useNativeDriver: true }) : undefined}
      refreshControl={IOS
        ? <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} />
        : <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} colors={[T.bleu as any]}
            progressBackgroundColor={T.carte as any} progressViewOffset={insets.top} />}
      showsVerticalScrollIndicator={false}>

      {/* ── L'en-tête « Aujourd'hui » ── Android : sous la barre d'état, que
          le défilement ne règle pas de lui-même */}
      <View style={[s.enTete, !IOS && { paddingTop: insets.top + 8 }, cap]}>
        <View style={s.ligneDate}>
          <Text style={s.date} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>
            {dateDuJour.toUpperCase()}
          </Text>
          <View style={s.boutons}>
            {/* La recherche a son onglet, en bas : il ne reste ici que le jour
                et la nuit */}
            <BoutonRond sf={sombre ? "sun.max" : "moon"} materiel={sombre ? "light_mode" : "dark_mode"}
              onPress={basculerTheme} label={sombre ? "Passer en mode clair" : "Passer en mode sombre"} />
          </View>
        </View>
        <View style={s.titreLigne}>
          <Text style={s.titre} maxFontSizeMultiplier={1.1} accessibilityRole="header">Invest in </Text>
          <MaskedView maskElement={<Text style={s.titre} maxFontSizeMultiplier={1.1}>Senegal</Text>}>
            <LinearGradient colors={["#F5B26B", "#E8823C", "#d96f28"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={[s.titre, { opacity: 0 }]} maxFontSizeMultiplier={1.1}>Senegal</Text>
            </LinearGradient>
          </MaskedView>
        </View>
      </View>

      {/* Sur tablette, le contenu se plafonne et se centre : une carte de
          1 000 pt de large aplatit la courbe et rend les lignes illisibles */}
      <View style={cap}>
        {/* ── La situation — la carte respire sous l'en-tête ── */}
        <View style={{ height: ESPACE.m }} />
        <VedetteIde />

        {/* ── À venir ── */}
        <ProchainEvenement />

        {/* ── Explorer ── */}
        <Explorer />
      </View>
    </Animated.ScrollView>
    {IOS ? (
      <Animated.View pointerEvents="none" style={[s.voileHaut, { height: insets.top, opacity: voileHaut }]}>
        <BlurView tint="systemChromeMaterial" intensity={100} style={StyleSheet.absoluteFill} />
      </Animated.View>
    ) : (
      <View pointerEvents="none" style={[s.voileHaut, { height: insets.top, backgroundColor: T.fond }]} />
    )}
    </>
  );
}

/** Le bouton rond de l'en-tête. iOS 26 et suivants : en verre Liquid Glass,
    comme les commandes du système ; avant iOS 26, un disque gris. Android :
    le bouton icône tonal de Material 3 — un disque de 40 dp, l'icône en 24 dp,
    l'ondulation au toucher. */
const VERRE = IOS && isLiquidGlassAvailable();

function BoutonRond({ sf, materiel, onPress, label }: NomsIcone & { onPress: () => void; label: string }) {
  if (!IOS) return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      android_ripple={{ color: T.surbrillance as any, borderless: true, radius: 20 }} style={s.boutonAndroid}>
      <Icone sf={sf} materiel={materiel} taille={24} couleur={T.encre} />
    </Pressable>
  );
  // À l'encre, comme les boutons des barres de toutes les pages
  const icone = <Icone sf={sf} materiel={materiel} taille={16} couleur={T.encre} poids="semibold" />;
  if (VERRE) return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      <GlassView isInteractive glassEffectStyle="regular" style={s.boutonVerre}>{icone}</GlassView>
    </Pressable>
  );
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [s.boutonRond, pressed && { opacity: 0.5 }]}>
      {icone}
    </Pressable>
  );
}

const s = creerStyles(() => ({
  // L'en-tête « Aujourd'hui » : date en petites capitales, grand titre
  enTete: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6 },
  ligneDate: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 34 },
  date: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: POLICE.demi, color: T.gris, letterSpacing: 0.6 },
  boutons: { flexDirection: "row", alignItems: "center", gap: 10 },
  boutonRond: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: T.voile,
  },
  // Le verre réagit lui-même au toucher (isInteractive) : pas d'opacité en plus
  boutonVerre: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  boutonAndroid: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: T.voile,
  },
  // Le grand titre d'iOS : 34 pt gras, interligne 41
  // « Invest in » au bleu de la maison le jour ; la nuit, l'encre claire
  titre: { fontSize: 34, lineHeight: 41, fontFamily: POLICE.gras, color: T.titreAccueil, letterSpacing: -0.7 },
  voileHaut: { position: "absolute", top: 0, left: 0, right: 0 },

  titreLigne: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  // Titres de section affirmés — la hiérarchie se voit avant de se lire
  titreSection: { fontSize: 17, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.3, marginBottom: ESPACE.s + 2 },
  blocEvenement: { marginTop: ESPACE.l, paddingHorizontal: ESPACE.m },
  evenementCoquille: {
    borderRadius: RAYON.grand, borderCurve: "continuous", overflow: "hidden",
    // Le jour, le bleu de la maison ; la nuit, le bleu clair du chiffre
    // vedette, un cran plus foncé (theme : tuileEvenement)
    backgroundColor: T.tuileEvenement,
  },
  evenement: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  // Bloc date en verre sur le bleu : clair le jour, sombre sur le bleu clair
  // de la nuit
  evenementDate: {
    minWidth: 52, minHeight: 56, paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 14, borderCurve: "continuous",
    alignItems: "center", justifyContent: "center",
    backgroundColor: T.dateTuileEvenement,
    borderWidth: 1, borderColor: T.bordDateEvenement,
  },
  evenementJour: { fontSize: 21, fontFamily: POLICE.gras, color: T.surTuileEvenement, lineHeight: 25, fontVariant: ["tabular-nums"] },
  evenementMois: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.surTuileEvenementDoux, letterSpacing: 1.2, marginTop: 1 },
  evenementNom: { ...TYPO.sousTitre, color: T.surTuileEvenement },
  // Blanc à 86 % sur le bleu du jour (au-dessus du seuil AA) ; l'encre de
  // nuit à 74 % sur le bleu clair
  evenementLieu: { ...TYPO.legende, color: T.surTuileEvenementDoux, marginTop: 3 },
}));
