// Lecteur du code — expérience de lecture immersive (façon Apple Books) :
// page blanche pleine, barre haute discrète (chapitre courant, réglage de
// la taille du texte, progression de lecture), ouverture de chapitre
// typographique centrée, articles en flux continu avec titres courants,
// sections en séparateurs centrés, navigation chapitre précédent/suivant
// en bas. Arrivée depuis la recherche : défilement + surbrillance douce.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, Text, View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";
import Icone from "@/components/Icone";
import TexteDefilant from "@/components/TexteDefilant";
import TexteRiche from "@/components/TexteRiche";
import { EtatErreur, EtatHorsLigne, EtatVide } from "@/components/ui";
import { getJson, enAttente, enPanne, horsLigne } from "@/lib/api";
import { creerStyles, useSombre } from "@/lib/apparence";
import { DEFILEMENT, useCap } from "@/lib/marges";
import { IOS } from "@/lib/plateforme";
import { coin, FONTE, T } from "@/theme";
import { romainDe } from "@/app/(onglets)/(accueil)/code/index";

// Échelle typographique réglable (5 crans, Apple Books-like)
const CORPS = [15, 16.5, 18, 19.5, 21];
const CLE_TAILLE = "code.taille";

// LA TAILLE DU TEXTE, LUE AVANT LA PREMIÈRE PAGE : la lecture commence dès le
// chargement du module, et le chapitre ne se compose qu'une fois la taille
// connue — il ne s'affichait qu'ensuite à la bonne taille, d'un saut.
let cranMemorise: number | null | undefined;
const lectureCran = AsyncStorage.getItem(CLE_TAILLE)
  .then(v => { const n = Number(v); cranMemorise = v !== null && !isNaN(n) ? Math.min(CORPS.length - 1, Math.max(0, n)) : null; })
  .catch(() => { cranMemorise = null; });

// La lecture de nuit tranchée dans le lecteur vaut pour la séance : elle
// suit les chapitres qu'on ouvre ensuite, et s'efface quand l'app change
// d'apparence. Mémorisée pour de bon, elle laissait le lecteur en nuit dans
// une app de jour, à chaque ouverture.
let sombreTranche: { sombre: boolean; app: boolean } | null = null;

// Palettes de lecture jour / nuit. DEUX TEINTES, DEUX RÔLES : l'orange dit
// le chapitre — son surtitre, le trait sous son titre, la progression de sa
// lecture ; le bleu dit la structure — articles, sections, fin du chapitre,
// passage au chapitre voisin, article retrouvé par la recherche.
const PALETTES = {
  jour: {
    fond: "#fff", titre: "#1a1a2e", corps: "#33383F", intro: "#4a5568",
    bleu: "#004f91", orange: "#ca631f", filet: "#F2F0EF", surligne: "#EAF2FB",
    bleuVoile: "rgba(0,79,145,0.05)", bleuBord: "rgba(0,79,145,0.28)", bleuPoint: "rgba(0,79,145,0.45)",
    ondulation: "rgba(0,79,145,0.12)",
    neutreFond: "rgba(60,64,67,0.06)", neutreTexte: "#5F6368", neutreSep: "rgba(60,64,67,0.18)",
  },
  // Nuit : EXACTEMENT le bleu des CARTES de l'app (T.carte, #151E2E) — pas
  // celui du fond. Une page de lecture est une surface posée, comme une carte
  // ou une feuille ; le fond de l'app, plus sombre, est ce sur quoi les
  // surfaces reposent. Les encres reprennent les jetons du thème.
  nuit: {
    fond: "#151E2E", titre: "#EDF1F7", corps: "#C3CDDA", intro: "#9AA7B8",
    bleu: "#85B9EC", orange: "#FFA45C", filet: "rgba(122,138,164,0.30)", surligne: "rgba(133,185,236,0.14)",
    bleuVoile: "rgba(133,185,236,0.07)", bleuBord: "rgba(133,185,236,0.34)", bleuPoint: "rgba(133,185,236,0.55)",
    ondulation: "rgba(133,185,236,0.16)",
    neutreFond: "rgba(122,138,164,0.16)", neutreTexte: "#B9C2CF", neutreSep: "rgba(122,138,164,0.34)",
  },
} as const;

export default function Lecteur() {
  const { chapitre, base = "code-investissement", art } = useLocalSearchParams<{ chapitre: string; base?: string; art?: string }>();
  const router = useRouter();
  const cap = useCap();
  const defileur = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const [surligneId, setSurligneId] = useState<string | null>(art || null);
  // Taille du texte : mémorisée entre les sessions, connue avant la page
  const [cranPret, setCranPret] = useState(cranMemorise !== undefined);
  const [cran, setCran] = useState(() => cranMemorise ?? 1);
  useEffect(() => {
    if (cranPret) return;
    lectureCran.then(() => { setCran(cranMemorise ?? 1); setCranPret(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const changerCran = (delta: number) => {
    retenirPlace();
    setCran(c => {
      const n = Math.min(CORPS.length - 1, Math.max(0, c + delta));
      AsyncStorage.setItem(CLE_TAILLE, String(n)).catch(() => {});
      return n;
    });
  };
  // Mode sombre de lecture : il SUIT l'apparence de l'app par défaut — une
  // app en nuit qui ouvre un lecteur en plein jour éblouit — et la bascule
  // du lecteur tranche pour la séance (voir sombreTranche).
  const appSombre = useSombre();
  const [sombre, setSombre] = useState(() =>
    sombreTranche && sombreTranche.app === appSombre ? sombreTranche.sombre : appSombre);
  useEffect(() => {
    if (sombreTranche && sombreTranche.app !== appSombre) sombreTranche = null;
    if (!sombreTranche) setSombre(appSombre);
  }, [appSombre]);
  const basculerSombre = () => {
    retenirPlace();
    setSombre(v => {
      sombreTranche = { sombre: !v, app: appSombre };
      return !v;
    });
  };
  const P = sombre ? PALETTES.nuit : PALETTES.jour;
  // Progression de lecture : valeur animée alimentée par le défilement
  const defilementY = useRef(new Animated.Value(0)).current;
  const [hauteurMax, setHauteurMax] = useState(1);
  const hauteurEcran = useRef(0);
  const hauteurContenu = useRef(0);
  const majMax = () => setHauteurMax(Math.max(1, hauteurContenu.current - hauteurEcran.current));

  // LE LECTEUR NE PERD PAS SA PLACE QUAND IL RÈGLE SA PAGE. Passer en lecture
  // de nuit ou changer la taille du texte le ramenait en haut du chapitre :
  // la barre du système, reconfigurée, réinitialisait le défilement. Avant
  // chaque réglage, la place est retenue — en proportion du texte, que la
  // taille allonge ou raccourcit —, puis rendue une fois la page recomposée ;
  // un retour en haut qui survient dans l'instant (0,6 s : le temps que la
  // barre se reconfigure) est aussitôt annulé.
  const yCourant = useRef(0);
  const place = useRef<{ part: number; y: number; jusqua: number } | null>(null);
  const retenirPlace = () => {
    place.current = {
      y: yCourant.current, part: yCourant.current / Math.max(1, hauteurContenu.current), jusqua: Date.now() + 600,
    };
  };
  const rendrePlace = () => {
    const p = place.current;
    if (!p || Date.now() > p.jusqua) { place.current = null; return; }
    const max = Math.max(0, hauteurContenu.current - hauteurEcran.current);
    const cible = Math.min(max, Math.round(p.part * hauteurContenu.current));
    defileur.current?.scrollTo({ y: cible, animated: false });
  };
  const surDefilement = (y: number) => {
    yCourant.current = y;
    // Un saut en haut, que le lecteur n'a pas fait : la place est rendue
    if (y <= 1 && place.current && place.current.y > 40) rendrePlace();
  };

  const requeteChapitres = useQuery({
    queryKey: ["code", base],
    queryFn: () => getJson<any[]>(`/${base}`),
    staleTime: 30 * 60 * 1000,
  });
  const chapitres = requeteChapitres.data;
  const liste = chapitres || [];
  const index = liste.findIndex((c: any) => c.id === chapitre);
  const chap = index >= 0 ? liste[index] : null;
  const precedent = index > 0 ? liste[index - 1] : null;
  const suivant = index >= 0 && index < liste.length - 1 ? liste[index + 1] : null;

  // Après un réglage, la page dessinée : la place est rendue (la lecture de
  // nuit ne change pas la hauteur du texte, rien d'autre ne le ferait)
  useEffect(() => {
    const image = requestAnimationFrame(() => rendrePlace());
    return () => cancelAnimationFrame(image);
  }, [sombre, cran]);

  // Tailles dérivées du cran choisi
  const corps = CORPS[cran];
  const interligne = Math.round(corps * 1.66);
  const artTitreTaille = corps + 1;

  // L'ARTICLE DEMANDÉ (depuis la recherche) : la page y descend dès qu'il est
  // posé. Les articles sont des enfants directs du contenu défilant : leur
  // position est donc celle du défilement — dans leur section, elle était
  // relative à celle-ci, et la page s'arrêtait au mauvais endroit. Le haut
  // du défilement est sous la barre : seize points d'air, rien d'autre.
  const aAtteindre = useRef(art || null);
  const enregistrerPosition = (id: string, y: number) => {
    positions.current[id] = y;
    if (id !== aAtteindre.current) return;
    aAtteindre.current = null;
    requestAnimationFrame(() => defileur.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }));
  };
  useEffect(() => {
    if (!art) return;
    const t = setTimeout(() => setSurligneId(null), 3200);
    return () => clearTimeout(t);
  }, [art]);

  const allerA = (id: string) => {
    // Un autre chapitre s'ouvre en haut : aucune place à rendre
    place.current = null;
    positions.current = {};
    defileur.current?.scrollTo({ y: 0, animated: false });
    router.replace({ pathname: "/lecture/[chapitre]", params: { chapitre: id, base } } as any);
  };

  const numeroChap = chap ? (chap.numero === 1 ? "PREMIER" : String(chap.num_display).toUpperCase()) : "";

  const article = (a: any) => (
    <Article key={a.id} a={a} P={P} surligne={a.id === surligneId} corps={corps} interligne={interligne}
      titreTaille={artTitreTaille} onPosition={enregistrerPosition} />
  );

  const deuxPilules = !!(precedent && suivant);
  // Les pilules du chapitre voisin, au bleu de la page
  const pilule = { borderColor: P.bleuBord, backgroundColor: P.bleuVoile };

  // La barre du système, à la couleur de la page — celle d'UIKit sur iOS,
  // celle de Material sur Android : le retour et les réglages à droite, en
  // boutons de barre (SF Symbols sans pastilles sur iOS, où la barre d'iOS 26
  // les pose déjà dans sa capsule de verre ; icônes Material à l'ondulation
  // sur Android). Pas de titre : le chapitre s'ouvre dans la page, en grand ;
  // la barre ne porte que les commandes. Le retour prend l'encre de la page :
  // le bleu de l'app disparaîtrait sur la page de nuit. Mémoïsé : la barre
  // n'est reconfigurée qu'au passage jour / nuit et quand A− ou A+ s'éteint
  // ou se rallume — pas à chaque cran (ses boutons agissent par mise à jour
  // fonctionnelle de l'état, ils n'ont pas à être recréés).
  const auPlusPetit = cran === 0, auPlusGrand = cran === CORPS.length - 1;
  const optionsBarre = useMemo(() => ({
    title: "",
    headerTintColor: P.titre,
    headerStyle: { backgroundColor: P.fond },
    headerTitleStyle: { ...FONTE.demi, color: P.titre },
    headerRight: () => (
      <View style={s.reglagesIOS}>
        <BoutonLecture sf={sombre ? "sun.max" : "moon"} materiel={sombre ? "light_mode" : "dark_mode"}
          couleur={P.titre} onPress={basculerSombre} label={sombre ? "Lecture de jour" : "Lecture de nuit"} />
        <BoutonLecture sf="textformat.size.smaller" materiel="text_decrease" couleur={P.titre}
          onPress={() => changerCran(-1)} inactif={auPlusPetit} label="Texte plus petit" />
        <BoutonLecture sf="textformat.size.larger" materiel="text_increase" couleur={P.titre}
          onPress={() => changerCran(1)} inactif={auPlusGrand} label="Texte plus grand" />
      </View>
    ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sombre, auPlusPetit, auPlusGrand]);

  return (
    <View style={{ flex: 1, backgroundColor: P.fond }}>
      <StatusBar style={sombre ? "light" : "dark"} />
      <Stack.Screen options={optionsBarre} />
      <Animated.ScrollView {...DEFILEMENT}
        ref={defileur as any}
        style={{ flex: 1 }}
        contentContainerStyle={[{ paddingTop: 18, paddingBottom: 60 }, cap]}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: defilementY } } }], {
          useNativeDriver: false, listener: (e: any) => surDefilement(e.nativeEvent.contentOffset.y),
        })}
        // Le lecteur qui fait défiler reprend la main : plus rien à rendre
        onScrollBeginDrag={() => { place.current = null; }}
        onLayout={e => { hauteurEcran.current = e.nativeEvent.layout.height; majMax(); }}
        // Le texte recomposé à sa nouvelle taille : la place est rendue
        onContentSizeChange={(_, h) => { hauteurContenu.current = h; majMax(); rendrePlace(); }}>
        {/* Ses états, plutôt qu'une page blanche sous la barre : l'attente,
            le réseau absent, la panne, le chapitre disparu */}
        {horsLigne(requeteChapitres) ? <EtatHorsLigne />
        : enAttente(requeteChapitres) ? <ActivityIndicator color={T.bleu} style={{ marginTop: 40 }} />
        : enPanne(requeteChapitres) ? <EtatErreur onRetry={() => requeteChapitres.refetch()} />
        : chapitres && !chap ? <EtatVide texte="Ce chapitre n'est plus disponible." icone="menu_book" />
        : null}
        {chap && cranPret && (
          <>
            {/* Ouverture de chapitre */}
            <View style={s.ouverture}>
              <Text style={[s.ouvertureSur, { color: P.orange }]}>CHAPITRE {numeroChap}</Text>
              <Text style={[s.ouvertureTitre, { color: P.titre }]}>{chap.titre}</Text>
              <View style={[s.ornement, { backgroundColor: P.orange }]} />
            </View>
            {chap.contenu ? (
              <TexteRiche html={chap.contenu} couleur={P.intro} fontSize={corps} lineHeight={interligne} />
            ) : null}

            {/* Articles directs — sans conteneur : leur position est celle
                du défilement */}
            {(chap.articles || []).map(article)}

            {/* Sections */}
            {(chap.sections || []).map((sec: any) => (
              <Fragment key={sec.id}>
                <View style={s.section}>
                  <View style={[s.sectionFilet, { backgroundColor: P.bleu }]} />
                  <Text style={[s.sectionNumero, { color: P.bleu }]}>SECTION {String(sec.num_display).toUpperCase()}</Text>
                  <Text style={[s.sectionTitre, { color: P.titre }]}>{sec.titre}</Text>
                </View>
                {sec.contenu ? (
                  <TexteRiche html={sec.contenu} couleur={P.intro} fontSize={corps} lineHeight={interligne} />
                ) : null}
                {(sec.articles || []).map(article)}
              </Fragment>
            ))}

            {/* Fin de chapitre : ornement centré */}
            <View style={s.fin}>
              <View style={[s.finPoint, { backgroundColor: P.bleuPoint }]} />
              <View style={[s.finPoint, { width: 5, height: 5, borderRadius: 3, backgroundColor: P.bleuPoint }]} />
              <View style={[s.finPoint, { backgroundColor: P.bleuPoint }]} />
            </View>

            {/* Navigation entre chapitres : pilules (flèches seulement quand
                une seule pilule ; titre long : défilement lent) */}
            {(precedent || suivant) && (
              <View style={s.navigation}>
                {precedent ? (
                  <Pressable onPress={() => allerA(precedent.id)} android_ripple={{ color: P.ondulation }}
                    style={({ pressed }) => [s.navPilule, pilule, IOS && pressed && { opacity: 0.5 }]}>
                    {!deuxPilules && <Icone sf="chevron.left" materiel="chevron_left" taille={13} couleur={P.bleu} poids="semibold" />}
                    <TexteDefilant style={[s.navTexte, { color: P.bleu }]}>{`${romainDe(precedent)}. ${precedent.titre}`}</TexteDefilant>
                  </Pressable>
                ) : null}
                {suivant ? (
                  <Pressable onPress={() => allerA(suivant.id)} android_ripple={{ color: P.ondulation }}
                    style={({ pressed }) => [s.navPilule, pilule, IOS && pressed && { opacity: 0.5 }]}>
                    <TexteDefilant style={[s.navTexte, { color: P.bleu }]}>{`${romainDe(suivant)}. ${suivant.titre}`}</TexteDefilant>
                    {!deuxPilules && <Icone sf="chevron.right" materiel="chevron_right" taille={13} couleur={P.bleu} poids="semibold" />}
                  </Pressable>
                ) : null}
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>

      {/* La progression de lecture, collée sous la barre du système, qui porte
          les boutons — elle suit le défilement image par image */}
      <View style={[s.barre, { backgroundColor: P.fond }]}>
        <View style={[s.progFond, { backgroundColor: P.filet }]}>
          <Animated.View style={[s.progBarre, { backgroundColor: P.orange,
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

/** Un article : son numéro, son titre, son texte. Un composant du module, et
    non une fonction du lecteur : recréé à chaque rendu, il remontait tous les
    articles à chaque réglage. */
function Article({ a, P, surligne, corps, interligne, titreTaille, onPosition }: {
  a: any; P: (typeof PALETTES)[keyof typeof PALETTES]; surligne: boolean; corps: number; interligne: number;
  titreTaille: number; onPosition: (id: string, y: number) => void;
}) {
  return (
    <View onLayout={e => onPosition(a.id, e.nativeEvent.layout.y)}
      style={[s.article, surligne && { backgroundColor: P.surligne }]}>
      <View style={s.artEntete}>
        <Text style={[s.artNumero, { color: P.bleu }]}>Article {a.num_display}</Text>
        <View style={[s.artFilet, { backgroundColor: P.filet }]} />
      </View>
      {a.titre ? <Text style={[s.artTitre, { color: P.titre, fontSize: titreTaille, lineHeight: Math.round(titreTaille * 1.35) }]}>{a.titre}</Text> : null}
      {/* Le contenu est stocké en HTML riche (listes…) : converti en texte à puces */}
      <TexteRiche html={a.contenu || ""} couleur={P.corps} fontSize={corps} lineHeight={interligne} />
    </View>
  );
}

/** Un bouton de la barre du lecteur, à l'encre de la page : un SF Symbol qui
    s'estompe au toucher sur iOS ; sur Android, le bouton icône de Material 3 —
    l'icône en 24 dp, une ondulation circulaire, une cible de 48 dp. */
function BoutonLecture({ sf, materiel, couleur, onPress, label, inactif }: {
  sf: SFSymbol; materiel: string; couleur: string; onPress: () => void; label: string; inactif?: boolean;
}) {
  if (!IOS) return (
    <Pressable onPress={onPress} disabled={inactif} accessibilityRole="button" accessibilityLabel={label}
      android_ripple={{ color: T.surbrillance as any, borderless: true, radius: 20 }}
      style={[s.boutonLectureAndroid, inactif && { opacity: 0.38 }]}>
      <Icone sf={sf} materiel={materiel} taille={24} couleur={couleur} />
    </Pressable>
  );
  return (
    <Pressable onPress={onPress} disabled={inactif} hitSlop={4} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [s.boutonLecture, (pressed || inactif) && { opacity: inactif ? 0.3 : 0.4 }]}>
      <Icone sf={sf} materiel={materiel} taille={18} couleur={couleur} poids="medium" />
    </Pressable>
  );
}

const MARGE = 26;

const s = creerStyles(() => ({
  barre: { position: "absolute", top: 0, left: 0, right: 0 },
  reglagesIOS: { flexDirection: "row", alignItems: "center" },
  boutonLecture: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  boutonLectureAndroid: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  progFond: { height: 2.5 },
  progBarre: { height: "100%", backgroundColor: T.orange },
  ouverture: { alignItems: "center", paddingHorizontal: MARGE, paddingTop: 26, paddingBottom: 4 },
  ouvertureSur: { fontSize: 11, ...FONTE.gras, color: T.orange, letterSpacing: 2.4 },
  ouvertureTitre: {
    fontSize: 25, ...FONTE.gras, color: T.encre, textAlign: "center",
    lineHeight: 32, letterSpacing: -0.4, marginTop: 12,
  },
  ornement: { width: 34, height: 2.5, borderRadius: 2, backgroundColor: T.orange, marginTop: 18, marginBottom: 8 },
  chapContenu: { ...FONTE.normal, color: T.texte, paddingHorizontal: MARGE, marginTop: 14 },
  article: { paddingHorizontal: MARGE, paddingTop: 26, paddingBottom: 6, borderRadius: coin(14) },
  artEntete: { flexDirection: "row", alignItems: "center", gap: 12 },
  artNumero: { fontSize: 12, ...FONTE.gras, color: T.bleu, letterSpacing: 1.1, textTransform: "uppercase" },
  artFilet: { flex: 1, height: 1, backgroundColor: T.filet },
  artTitre: { ...FONTE.demi, color: T.encre, marginTop: 9, letterSpacing: -0.2 },
  artContenu: { ...FONTE.normal, color: "#33383F", marginTop: 9 },
  section: { alignItems: "center", paddingHorizontal: MARGE, paddingTop: 38, paddingBottom: 2 },
  // La teinte vient de la palette de lecture (le bleu de la page)
  sectionFilet: { width: 26, height: 2, borderRadius: 2, marginBottom: 12 },
  sectionNumero: { fontSize: 10.5, ...FONTE.gras, letterSpacing: 2.2 },
  sectionTitre: {
    fontSize: 16.5, ...FONTE.demi, color: T.encre, textAlign: "center",
    lineHeight: 22, letterSpacing: -0.2, marginTop: 7,
  },
  fin: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 40 },
  finPoint: { width: 3.5, height: 3.5, borderRadius: 2 },
  navigation: { flexDirection: "row", gap: 10, marginTop: 26, marginHorizontal: MARGE },
  navPilule: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderWidth: 1,
    borderRadius: 999, paddingVertical: 13, paddingHorizontal: 14, minWidth: 0,
  },
  navTexte: { fontSize: 13, ...FONTE.demi, letterSpacing: -0.2, flexShrink: 1 },
}));
