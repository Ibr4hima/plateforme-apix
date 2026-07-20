// Lecteur du code — expérience de lecture immersive (façon Apple Books) :
// page blanche pleine, barre haute discrète (chapitre courant, réglage de
// la taille du texte, progression de lecture), ouverture de chapitre
// typographique centrée, articles en flux continu avec titres courants,
// sections en séparateurs centrés, navigation chapitre précédent/suivant
// en bas. Arrivée depuis la recherche : défilement + surbrillance douce.
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TexteDefilant from "@/components/TexteDefilant";
import { htmlEnTexte } from "@/components/ZoneSheet";
import { getJson } from "@/lib/api";
import { POLICE, T } from "@/theme";
import { romainDe } from "./index";

// Échelle typographique réglable (5 crans, Apple Books-like)
const CORPS = [15, 16.5, 18, 19.5, 21];
const CLE_TAILLE = "code.taille";
const CLE_SOMBRE = "code.sombre";

// Palettes de lecture jour / nuit
const PALETTES = {
  jour: {
    fond: "#fff", titre: T.encre, corps: "#33383F", intro: T.texte,
    bleu: T.bleu, filet: T.filet, surligne: "#FFF6EB",
    neutreFond: "rgba(60,64,67,0.06)", neutreTexte: "#5F6368", neutreSep: "rgba(60,64,67,0.18)",
  },
  // Nuit bleue : le bleu du hero poussé vers la nuit, encres claires contrastées
  nuit: {
    fond: "#04294A", titre: "#F2F6FA", corps: "#C9D8E6", intro: "#A9BFD2",
    bleu: "#8FC4F2", filet: "rgba(255,255,255,0.13)", surligne: "rgba(255,223,194,0.13)",
    neutreFond: "rgba(255,255,255,0.10)", neutreTexte: "#BFD3E4", neutreSep: "rgba(255,255,255,0.22)",
  },
} as const;

export default function Lecteur() {
  const { chapitre, base = "code-investissement", art } = useLocalSearchParams<{ chapitre: string; base?: string; art?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const defileur = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const [surligneId, setSurligneId] = useState<string | null>(art || null);
  // Taille du texte : mémorisée entre les sessions
  const [cran, setCran] = useState(1);
  useEffect(() => {
    AsyncStorage.getItem(CLE_TAILLE).then(v => {
      const n = Number(v);
      if (v !== null && !isNaN(n)) setCran(Math.min(CORPS.length - 1, Math.max(0, n)));
    }).catch(() => {});
  }, []);
  const changerCran = (delta: number) => setCran(c => {
    const n = Math.min(CORPS.length - 1, Math.max(0, c + delta));
    AsyncStorage.setItem(CLE_TAILLE, String(n)).catch(() => {});
    return n;
  });
  // Mode sombre de lecture : mémorisé lui aussi
  const [sombre, setSombre] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(CLE_SOMBRE).then(v => { if (v === "1") setSombre(true); }).catch(() => {});
  }, []);
  const basculerSombre = () => setSombre(v => {
    AsyncStorage.setItem(CLE_SOMBRE, v ? "0" : "1").catch(() => {});
    return !v;
  });
  const P = sombre ? PALETTES.nuit : PALETTES.jour;
  // Progression de lecture : valeur animée alimentée par le défilement
  const defilementY = useRef(new Animated.Value(0)).current;
  const [hauteurMax, setHauteurMax] = useState(1);
  const hauteurEcran = useRef(0);
  const hauteurContenu = useRef(0);
  const majMax = () => setHauteurMax(Math.max(1, hauteurContenu.current - hauteurEcran.current));

  const { data: chapitres, isLoading } = useQuery({
    queryKey: ["code", base],
    queryFn: () => getJson<any[]>(`/${base}`),
    staleTime: 30 * 60 * 1000,
  });
  const liste = chapitres || [];
  const index = liste.findIndex((c: any) => c.id === chapitre);
  const chap = index >= 0 ? liste[index] : null;
  const precedent = index > 0 ? liste[index - 1] : null;
  const suivant = index >= 0 && index < liste.length - 1 ? liste[index + 1] : null;

  // Tailles dérivées du cran choisi
  const corps = CORPS[cran];
  const interligne = Math.round(corps * 1.66);
  const artTitreTaille = corps + 1;

  const enregistrerPosition = (id: string, y: number) => { positions.current[id] = y; };

  // Défilement vers l'article demandé (depuis la recherche)
  useEffect(() => {
    if (!art || !chap) return;
    const t = setTimeout(() => {
      const y = positions.current[art];
      if (y != null) defileur.current?.scrollTo({ y: Math.max(0, y - insets.top - 70), animated: true });
      setTimeout(() => setSurligneId(null), 2600);
    }, 400);
    return () => clearTimeout(t);
  }, [art, chap?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allerA = (id: string) => {
    positions.current = {};
    defileur.current?.scrollTo({ y: 0, animated: false });
    router.replace({ pathname: "/code/[chapitre]", params: { chapitre: id, base } } as any);
  };

  const etiquette = `${base === "modalites-application" ? "MODALITÉS D'APPLICATION" : "CODE DES INVESTISSEMENTS"}`;
  const numeroChap = chap ? (chap.numero === 1 ? "PREMIER" : String(chap.num_display).toUpperCase()) : "";

  const Article = ({ a }: { a: any }) => (
    <View onLayout={e => enregistrerPosition(a.id, e.nativeEvent.layout.y)}
      style={[s.article, a.id === surligneId && { backgroundColor: P.surligne }]}>
      <View style={s.artEntete}>
        <Text style={[s.artNumero, { color: P.bleu }]}>Article {a.num_display}</Text>
        <View style={[s.artFilet, { backgroundColor: P.filet }]} />
      </View>
      {a.titre ? <Text style={[s.artTitre, { color: P.titre, fontSize: artTitreTaille, lineHeight: Math.round(artTitreTaille * 1.35) }]}>{a.titre}</Text> : null}
      {/* Le contenu est stocké en HTML riche (listes…) : converti en texte à puces */}
      <Text style={[s.artContenu, { color: P.corps, fontSize: corps, lineHeight: interligne }]}>{htmlEnTexte(a.contenu || "")}</Text>
    </View>
  );

  const deuxPilules = !!(precedent && suivant);

  return (
    <View style={{ flex: 1, backgroundColor: P.fond }}>
      <StatusBar style={sombre ? "light" : "dark"} />
      <Animated.ScrollView
        ref={defileur as any}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 62, paddingBottom: 60 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: defilementY } } }], { useNativeDriver: false })}
        onLayout={e => { hauteurEcran.current = e.nativeEvent.layout.height; majMax(); }}
        onContentSizeChange={(_, h) => { hauteurContenu.current = h; majMax(); }}>
        {isLoading && <ActivityIndicator color={T.bleu} style={{ marginTop: 40 }} />}
        {chap && (
          <>
            {/* Ouverture de chapitre */}
            <View style={s.ouverture}>
              <Text style={s.ouvertureSur}>CHAPITRE {numeroChap}</Text>
              <Text style={[s.ouvertureTitre, { color: P.titre }]}>{chap.titre}</Text>
              <View style={s.ornement} />
            </View>
            {chap.contenu ? (
              <Text style={[s.chapContenu, { color: P.intro, fontSize: corps, lineHeight: interligne }]}>{htmlEnTexte(chap.contenu)}</Text>
            ) : null}

            {/* Articles directs */}
            <View>
              {(chap.articles || []).map((a: any) => <Article key={a.id} a={a} />)}
            </View>

            {/* Sections */}
            {(chap.sections || []).map((sec: any) => (
              <View key={sec.id}>
                <View style={s.section}>
                  <View style={s.sectionFilet} />
                  <Text style={s.sectionNumero}>SECTION {String(sec.num_display).toUpperCase()}</Text>
                  <Text style={[s.sectionTitre, { color: P.titre }]}>{sec.titre}</Text>
                </View>
                {sec.contenu ? (
                  <Text style={[s.chapContenu, { color: P.intro, fontSize: corps, lineHeight: interligne }]}>{htmlEnTexte(sec.contenu)}</Text>
                ) : null}
                {(sec.articles || []).map((a: any) => <Article key={a.id} a={a} />)}
              </View>
            ))}

            {/* Fin de chapitre : ornement centré */}
            <View style={s.fin}>
              <View style={s.finPoint} />
              <View style={[s.finPoint, { width: 5, height: 5, borderRadius: 3 }]} />
              <View style={s.finPoint} />
            </View>

            {/* Navigation entre chapitres : pilules (flèches seulement quand
                une seule pilule ; titre long : défilement lent) */}
            {(precedent || suivant) && (
              <View style={s.navigation}>
                {precedent ? (
                  <Pressable onPress={() => allerA(precedent.id)}
                    style={({ pressed }) => [s.navPilule, pressed && { backgroundColor: "rgba(202,99,31,0.12)" }]}>
                    {!deuxPilules && <Ionicons name="chevron-back" size={13} color={T.orange} />}
                    <TexteDefilant texte={`${romainDe(precedent)}. ${precedent.titre}`} style={s.navTexte} />
                  </Pressable>
                ) : null}
                {suivant ? (
                  <Pressable onPress={() => allerA(suivant.id)}
                    style={({ pressed }) => [s.navPilule, pressed && { backgroundColor: "rgba(202,99,31,0.12)" }]}>
                    <TexteDefilant texte={`${romainDe(suivant)}. ${suivant.titre}`} style={s.navTexte} />
                    {!deuxPilules && <Ionicons name="chevron-forward" size={13} color={T.orange} />}
                  </Pressable>
                ) : null}
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>

      {/* Barre haute : chapitre courant, mode nuit, réglage du texte, progression */}
      <View style={[s.barre, { paddingTop: insets.top + 6, backgroundColor: P.fond }]}>
        <View style={s.barreContenu}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.barreEtiquette} numberOfLines={1}>{etiquette}</Text>
            {chap ? <Text style={[s.barreChapitre, { color: P.titre }]} numberOfLines={1}>Chapitre {numeroChap.toLowerCase() === "premier" ? "premier" : numeroChap}</Text> : null}
          </View>
          <Pressable onPress={basculerSombre} hitSlop={6}
            style={({ pressed }) => [s.sombreBouton, { backgroundColor: P.neutreFond }, pressed && { opacity: 0.7 }]}>
            <Ionicons name={sombre ? "sunny-outline" : "moon-outline"} size={15} color={P.neutreTexte} />
          </Pressable>
          <View style={[s.tailleGroupe, { backgroundColor: P.neutreFond }]}>
            <Pressable onPress={() => changerCran(-1)} disabled={cran === 0} hitSlop={6}
              style={({ pressed }) => [s.tailleBouton, pressed && { opacity: 0.6 }, cran === 0 && { opacity: 0.35 }]}>
              <Text style={[s.tailleTexte, { color: P.neutreTexte, fontSize: 12 }]}>A</Text>
            </Pressable>
            <View style={[s.tailleSep, { backgroundColor: P.neutreSep }]} />
            <Pressable onPress={() => changerCran(1)} disabled={cran === CORPS.length - 1} hitSlop={6}
              style={({ pressed }) => [s.tailleBouton, pressed && { opacity: 0.6 }, cran === CORPS.length - 1 && { opacity: 0.35 }]}>
              <Text style={[s.tailleTexte, { color: P.neutreTexte, fontSize: 17 }]}>A</Text>
            </Pressable>
          </View>
        </View>
        {/* Progression de lecture — suit le défilement image par image */}
        <View style={[s.progFond, { backgroundColor: P.filet }]}>
          <Animated.View style={[s.progBarre, {
            width: defilementY.interpolate({
              inputRange: [0, hauteurMax],
              outputRange: ["0%", "100%"],
              extrapolate: "clamp",
            }),
          }]} />
        </View>
      </View>
    </View>
  );
}

const MARGE = 26;

const s = StyleSheet.create({
  barre: { position: "absolute", top: 0, left: 0, right: 0 },
  barreContenu: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: MARGE, paddingBottom: 8 },
  barreEtiquette: { fontSize: 8.5, fontFamily: POLICE.gras, color: T.orange, letterSpacing: 1.6 },
  barreChapitre: { fontSize: 13, fontFamily: POLICE.demi, marginTop: 1.5, letterSpacing: -0.2 },
  sombreBouton: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  tailleGroupe: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 999, paddingHorizontal: 4, paddingVertical: 3,
  },
  tailleBouton: { width: 34, height: 28, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  tailleTexte: { fontFamily: POLICE.demi },
  tailleSep: { width: 1, height: 14 },
  progFond: { height: 2.5 },
  progBarre: { height: "100%", backgroundColor: T.orange },
  ouverture: { alignItems: "center", paddingHorizontal: MARGE, paddingTop: 26, paddingBottom: 4 },
  ouvertureSur: { fontSize: 11, fontFamily: POLICE.gras, color: T.orange, letterSpacing: 2.4 },
  ouvertureTitre: {
    fontSize: 25, fontFamily: POLICE.gras, color: T.encre, textAlign: "center",
    lineHeight: 32, letterSpacing: -0.4, marginTop: 12,
  },
  ornement: { width: 34, height: 2.5, borderRadius: 2, backgroundColor: T.orange, marginTop: 18, marginBottom: 8 },
  chapContenu: { fontFamily: POLICE.normal, color: T.texte, paddingHorizontal: MARGE, marginTop: 14 },
  article: { paddingHorizontal: MARGE, paddingTop: 26, paddingBottom: 6, borderRadius: 14 },
  articleSurligne: { backgroundColor: "#FFF6EB" },
  artEntete: { flexDirection: "row", alignItems: "center", gap: 12 },
  artNumero: { fontSize: 12, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.1, textTransform: "uppercase" },
  artFilet: { flex: 1, height: 1, backgroundColor: T.filet },
  artTitre: { fontFamily: POLICE.demi, color: T.encre, marginTop: 9, letterSpacing: -0.2 },
  artContenu: { fontFamily: POLICE.normal, color: "#33383F", marginTop: 9 },
  section: { alignItems: "center", paddingHorizontal: MARGE, paddingTop: 38, paddingBottom: 2 },
  sectionFilet: { width: 26, height: 2, borderRadius: 2, backgroundColor: T.orange, marginBottom: 12 },
  sectionNumero: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.orange, letterSpacing: 2.2 },
  sectionTitre: {
    fontSize: 16.5, fontFamily: POLICE.demi, color: T.encre, textAlign: "center",
    lineHeight: 22, letterSpacing: -0.2, marginTop: 7,
  },
  fin: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 40 },
  finPoint: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: "rgba(202,99,31,0.55)" },
  navigation: { flexDirection: "row", gap: 10, marginTop: 26, marginHorizontal: MARGE },
  navPilule: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderWidth: 1, borderColor: "rgba(202,99,31,0.42)", backgroundColor: "rgba(202,99,31,0.05)",
    borderRadius: 999, paddingVertical: 13, paddingHorizontal: 14, minWidth: 0,
  },
  navTexte: { fontSize: 13, fontFamily: POLICE.demi, color: T.orange, letterSpacing: -0.2, flexShrink: 1 },
});
