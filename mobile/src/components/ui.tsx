// Bibliothèque de composants canoniques de l'app — chaque brique est
// définie UNE fois ici et consommée partout : Tapable (retour physique
// à ressort), Bouton (primaire / secondaire / fantôme, trois tailles),
// Chip, Carte, Badge pastel, RangeeStats (rangée basse des cards),
// Feuille (échafaudage des bottom sheets) et les états de chargement /
// erreur / vide. Jetons : T, TYPO, ESPACE, RAYON, OMBRE (theme.ts).
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityRole, AccessibilityState, ActivityIndicator, Animated, Dimensions,
  LayoutChangeEvent, Modal, Platform, Pressable, ScrollView,
  StyleProp, StyleSheet, Text, View, ViewStyle,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanime, {
  Easing, FadeInDown, LinearTransition,
  runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from "react-native-reanimated";
import Symbole from "@/components/Symbole";
import { creerStyles, useCouleur, useSombre, useStyleResolu } from "@/lib/apparence";
import { foncerPastel } from "@/lib/couleurs";
import { tick } from "@/lib/haptique";
import { DUREE, ENTREE, RESSORT, apparition } from "@/lib/motion";
import { origineRecente } from "@/lib/origineTap";
import { ECHELLE, ESPACE, OMBRE, POLICE, RAYON, T, TYPO } from "@/theme";

const ANDROID = Platform.OS === "android";
const PressableReanime = Reanime.createAnimatedComponent(Pressable);
const FlouAnime = Reanime.createAnimatedComponent(BlurView);

// ── Tapable : le retour tactile physique de toute l'app ──────────────────────
// La grammaire d'un bouton iOS : à l'appui le contenu se resserre (échelle)
// ET s'assombrit très légèrement — c'est la surbrillance d'UIButton, pas un
// simple zoom. Une seule valeur partagée pilote les deux, exécutée sur le fil
// UI : entrée courte et nette (90 ms), relâcher au ressort standard, pour que
// le doigt sente la surface répondre puis respirer.
export function Tapable({ onPress, onLongPress, disabled, style, echelle = 0.97, surbrillance = true, hitSlop, onLayout, accessibilityRole, accessibilityState, accessibilityLabel, children }: {
  onPress?: () => void; onLongPress?: () => void; disabled?: boolean;
  style?: StyleProp<ViewStyle>; echelle?: number; surbrillance?: boolean; hitSlop?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  accessibilityRole?: AccessibilityRole; accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
  children: React.ReactNode;
}) {
  const appui = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (echelle - 1) * appui.value }],
    opacity: (disabled ? 0.45 : 1) * (1 - (surbrillance ? 0.14 : 0) * appui.value),
  }));
  // Reanimated ne sait pas lire une couleur dynamique : le style reçu est
  // résolu ici, une fois, pour les 177 emplois de Tapable dans l'app
  const styleResolu = useStyleResolu(style);
  return (
    <PressableReanime
      onPress={onPress} onLongPress={onLongPress} disabled={disabled} hitSlop={hitSlop}
      onLayout={onLayout} accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState} accessibilityLabel={accessibilityLabel}
      onPressIn={() => { appui.value = withTiming(1, { duration: 90 }); }}
      onPressOut={() => { appui.value = withSpring(0, RESSORT.standard); }}
      style={[animStyle, styleResolu]}>
      {children}
    </PressableReanime>
  );
}

// ── BoutonVerre : le bouton icône en verre dépoli (liquid glass) ─────────────
// Un vrai flou natif derrière une teinte laiteuse, filet de contour froid,
// ombre douce — la coquille externe porte l'ombre (un overflow:hidden la
// couperait), la coquille interne rogne le flou au cercle.
export function BoutonVerre({ onPress, taille = 40, teinte, style, accessibilityLabel, children }: {
  onPress: () => void; taille?: number; teinte?: string;
  style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
  children: React.ReactNode;
}) {
  // Le verre suit l'apparence du bandeau qui le porte : laiteux sur le bleu
  // APIX du jour, sombre sur le bleu de minuit de la nuit — un voile blanc à
  // 62 % y ferait un projecteur. Il reste lisible parce que le voile de nuit
  // est assez marqué (13 %) et que le glyphe, lui, passe au bleu clair.
  const sombre = useSombre();
  return (
    <Tapable onPress={onPress} echelle={0.9} hitSlop={6}
      style={[{ width: taille, height: taille, borderRadius: taille / 2 }, OMBRE.n1, style]}>
      <View accessible accessibilityRole="button" accessibilityLabel={accessibilityLabel}
        style={{ flex: 1, borderRadius: taille / 2, overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth, borderColor: T.voileFort }}>
        {/* Pas de dimezisBlurView : le flou d'Android capture un bitmap
            MATERIEL, que le canevas logiciel d'une vue rognée refuse de
            dessiner (« Software rendering doesn't support hardware bitmaps »).
            Sur Android, BlurView pose donc son voile plat — et le voile ci-
            dessous, plus dense, lui rend la matière que le flou lui retire. */}
        <BlurView intensity={40} tint={sombre ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: teinte
            || (sombre ? (ANDROID ? "rgba(255,255,255,0.17)" : "rgba(255,255,255,0.13)")
                       : "rgba(255,255,255,0.62)"),
        }]} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{children}</View>
      </View>
    </Tapable>
  );
}

// ── Permutation : l'accusé de réception d'un changement de vedette ───────────
// Toucher un repère installe sa série en vedette. Sans transition, le nombre
// se substituait d'un coup et l'ancienne série réapparaissait plus bas sans
// mouvement : on doutait d'avoir cliqué. Ici le bloc vedette se rejoue —
// fondu et légère montée — à chaque changement de clé, et les repères
// glissent à leur nouvelle place (LinearTransition) au lieu de sauter.
export function Permutation({ cle, children, style }: {
  cle: string; children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const styleResolu = useStyleResolu(style);
  return (
    <Reanime.View key={cle} style={styleResolu}
      entering={FadeInDown.duration(230).easing(Easing.out(Easing.cubic))
        .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })}>
      {children}
    </Reanime.View>
  );
}

/** Rangée qui glisse à sa nouvelle place quand l'ordre de la liste change. */
export function RangeeMouvante({ children, style }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const styleResolu = useStyleResolu(style);
  return (
    <Reanime.View layout={LinearTransition.springify().damping(20).stiffness(180)} style={styleResolu}>
      {children}
    </Reanime.View>
  );
}

// ── SeparateurSection : la césure entre deux blocs d'une même page ───────────
// Deux filets qui s'éteignent vers les bords de l'écran et, au centre, le nom
// de la section dans un tag teinté à sa couleur. Empilées sans marque, les
// sections d'une page longue (Flux & Stocks, Greenfield, Fusion & Acquisition)
// se confondaient ; ici la coupure se voit avant même d'être lue, et la teinte
// annonce celle des cartes qui suivent.
export function SeparateurSection({ titre, couleur: teinte = T.bleu as string, voile: voileBrut = T.bleuVoile as string, style }: {
  titre: string; couleur?: string; voile?: string; style?: StyleProp<ViewStyle>;
}) {
  // La teinte part en concaténation (`${couleur}33`) : il lui faut une chaîne
  const couleur = useCouleur(teinte);
  const voile = useCouleur(voileBrut);
  return (
    <View style={[ss.rangee, style]} accessibilityRole="header">
      <LinearGradient colors={["rgba(122,138,164,0)", "rgba(122,138,164,0.42)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ss.filet} />
      <View style={[ss.tag, { backgroundColor: voile, borderColor: `${couleur}33` }]}>
        <Text style={[ss.texte, { color: couleur }]} numberOfLines={1}
          maxFontSizeMultiplier={ECHELLE.compact}>{titre}</Text>
      </View>
      <LinearGradient colors={["rgba(122,138,164,0.42)", "rgba(122,138,164,0)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ss.filet} />
    </View>
  );
}

const ss = creerStyles(() => ({
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  filet: { flex: 1, height: 1, borderRadius: 1 },
  tag: {
    paddingHorizontal: 13, paddingVertical: 5.5, borderRadius: 999,
    borderCurve: "continuous", borderWidth: 1, flexShrink: 1,
  },
  texte: { fontSize: 10, fontFamily: POLICE.gras, letterSpacing: 1.3 },
}));

// ── IconeTendance : la direction d'une série en un glyphe ────────────────────
// trending_up / trending_down / trending_flat, teinté vert / rouge / gris
// selon la dernière variation — le langage des repères des cartes vedettes.
export function IconeTendance({ delta, taille = 18 }: { delta: number | null; taille?: number }) {
  if (delta == null || !isFinite(delta)) return null;
  const plat = Math.abs(delta) < 0.05;
  const nom = plat ? "trending_flat" : delta > 0 ? "trending_up" : "trending_down";
  const couleur = plat ? (T.gris as string) : delta > 0 ? (T.vert as string) : "#dc2626";
  return <Symbole nom={nom} taille={taille} couleur={couleur} />;
}

// ── Bouton ───────────────────────────────────────────────────────────────────
export function Bouton({ label, onPress, variante = "primaire", taille = "moyenne", icone, disabled, style }: {
  label: string; onPress: () => void;
  variante?: "primaire" | "secondaire" | "fantome";
  taille?: "petite" | "moyenne" | "grande";
  icone?: string; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const dims = taille === "petite"
    ? { pv: 8, ph: 14, fs: 12.5 }
    : taille === "grande" ? { pv: 13, ph: 24, fs: 14.5 } : { pv: 10, ph: 20, fs: 13 };
  const fond = variante === "primaire" ? { backgroundColor: T.bleuAction }
    : variante === "secondaire" ? { backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure }
    : { backgroundColor: "transparent" };
  const texteCouleur = variante === "primaire" ? "#fff" : variante === "secondaire" ? T.texte : T.bleu;
  return (
    <Tapable onPress={onPress} disabled={disabled}
      style={[sb.base, fond, { paddingVertical: dims.pv, paddingHorizontal: dims.ph }, style]}>
      {icone ? <Symbole nom={icone} taille={dims.fs + 3} couleur={texteCouleur} /> : null}
      <Text style={{ fontSize: dims.fs, fontFamily: POLICE.gras, color: texteCouleur }}>{label}</Text>
    </Tapable>
  );
}

// ── Chip (filtres, catégories) ───────────────────────────────────────────────
// « pleine » : active en bleu plein, texte blanc. « pastel » : active en
// voile de sa couleur, texte coloré gras (style zones / IDE).
export function Chip({ label, actif, onPress, variante = "pastel", couleur, desactive }: {
  label: string; actif: boolean; onPress: () => void;
  variante?: "pleine" | "pastel"; couleur?: string; desactive?: boolean;
}) {
  // La teinte part en concaténation (`${c}14`) : jamais un jeton dynamique
  const c = useCouleur(couleur) || "#004f91";
  const fondActif = variante === "pleine"
    ? { backgroundColor: T.bleuAction, borderColor: "transparent" }
    : { backgroundColor: `${c}14`, borderColor: `${c}66` };
  const texteActif = variante === "pleine" ? { color: "#fff" } : { color: c, fontFamily: POLICE.gras };
  return (
    <Tapable onPress={() => { tick(); onPress(); }} disabled={desactive} style={[sc.chip, actif && fondActif]}>
      <Text style={[sc.texte, couleur && !actif && { color: c }, actif && texteActif]}>{label}</Text>
    </Tapable>
  );
}

// ── ChipFiltre : la barre d'onglets en pilules, en haut des écrans ───────────
// L'actif était signalé par un voile de bleu à 8 % et un liseré : sur une
// carte de nuit, ce voile ne se voyait pas — et comme tous les libellés
// étaient déjà bleus, plus rien ne disait lequel était choisi. L'actif prend
// donc un APLAT PLEIN et une encre blanche : l'écart ne tient plus à une
// nuance, il se lit d'un coup d'œil et il vaut dans les deux apparences.
// Défini ici une seule fois — six écrans en recopiaient la mise en forme.
export function ChipFiltre({ label, actif, compte, onPress, onLayout }: {
  label: string; actif: boolean; compte?: number | null;
  onPress: () => void; onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <Tapable onPress={() => { tick(); onPress(); }} onLayout={onLayout} echelle={0.97}
      accessibilityRole="tab" accessibilityState={{ selected: actif }}
      style={[scf.chip, actif && scf.chipActif]}>
      <Text style={[scf.texte, actif && scf.texteActif]} maxFontSizeMultiplier={ECHELLE.compact}>
        {label}
      </Text>
      {compte != null && (
        <View style={[scf.compte, actif && scf.compteActif]}>
          <Text style={[scf.compteTexte, actif && scf.compteTexteActif]}
            maxFontSizeMultiplier={ECHELLE.compact}>{compte}</Text>
        </View>
      )}
    </Tapable>
  );
}

const scf = creerStyles(() => ({
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 15, paddingVertical: 8, borderRadius: RAYON.pilule,
    backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure,
  },
  // L'aplat plein : porte du blanc dans les deux schémas
  chipActif: { backgroundColor: T.chipActif, borderColor: "transparent", ...OMBRE.n1 },
  texte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
  texteActif: { color: "#fff", fontFamily: POLICE.gras },
  compte: { backgroundColor: T.bleuVoile, borderRadius: RAYON.pilule, minWidth: 20, paddingHorizontal: 5.5, paddingVertical: 1, alignItems: "center" },
  compteActif: { backgroundColor: "rgba(255,255,255,0.22)" },
  compteTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
  compteTexteActif: { color: "#fff" },
}));

// ── Carte : la surface de base ───────────────────────────────────────────────
export function Carte({ onPress, elevation = 1, style, children }: {
  onPress?: () => void; elevation?: 0 | 1 | 2; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  const ombre = elevation === 2 ? OMBRE.n2 : elevation === 1 ? OMBRE.n1 : null;
  const base = [scarte.carte, ombre, style];
  if (onPress) return <Tapable onPress={onPress} style={base}>{children}</Tapable>;
  return <View style={base}>{children}</View>;
}

// ── Badge pastel (statuts, pôles) ────────────────────────────────────────────
export function Badge({ label, pastel }: { label: string; pastel: string }) {
  return (
    <View style={[sbadge.badge, { backgroundColor: `${pastel}40`, borderColor: `${pastel}90` }]}>
      <Text style={[sbadge.texte, { color: foncerPastel(pastel) }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── RangeeStats : la rangée basse des cards (LABEL | LABEL) ──────────────────
export function RangeeStats({ items }: {
  items: { label: string; valeur: string | null; numerique?: boolean }[];
}) {
  return (
    <View style={sr.rangee}>
      {items.map((it, i) => (
        <View key={it.label} style={{ flex: 1, minWidth: 0, flexDirection: "row" }}>
          {i > 0 && <View style={sr.separateur} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={sr.label}>{it.label.toUpperCase()}</Text>
            <Text style={[sr.valeur, { color: it.valeur ? T.encre : T.grisClair }, it.numerique !== false && { fontVariant: ["tabular-nums"] }]}
              numberOfLines={1}>
              {it.valeur || "—"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Feuille : l'échafaudage des bottom sheets ────────────────────────────────
// Fond assombri, poignée, en-tête (titre + fermer), sous-en-tête libre
// (pilules…), corps défilant. `pied` fixe optionnel (boutons de filtres).
// Transition contextuelle : la feuille « pousse » depuis la card touchée
// (origine capturée à la racine) au lieu de glisser génériquement.
export function Feuille({ titre, sousEntete, onClose, hauteur = "82%", ecart = 20, pied, sansDefilement, children }: {
  titre: React.ReactNode; sousEntete?: React.ReactNode; onClose: () => void;
  hauteur?: `${number}%`; ecart?: number; pied?: React.ReactNode; sansDefilement?: boolean;
  children: React.ReactNode;
}) {
  const H = Dimensions.get("window").height;
  // Point de départ : la card touchée si le tap vient d'avoir lieu, le bas sinon
  const [depart] = useState(() => {
    const y = origineRecente();
    if (y === null) return H * 0.35;
    return Math.max(-H * 0.25, Math.min(y - H * 0.62, H * 0.35));
  });

  // Deux grandeurs pilotent tout : l'ouverture (0→1, ressort doux) et le
  // tirage du doigt. Fond, échelle et position en dérivent en continu —
  // pendant le geste, c'est l'écran entier qui suit la main.
  const feuilleResolue = useStyleResolu(sf.feuille);
  const progres = useSharedValue(0);
  const tirage = useSharedValue(0);
  useEffect(() => { progres.value = withSpring(1, RESSORT.doux); }, [progres]);

  const fermer = () => {
    progres.value = withTiming(0, { duration: DUREE.courte, easing: ENTREE },
      fini => { if (fini) runOnJS(onClose)(); });
  };
  const fermerAuGeste = (velocite: number) => {
    tirage.value = withSpring(H * 0.9, { ...RESSORT.doux, velocity: velocite },
      fini => { if (fini) runOnJS(onClose)(); });
  };

  const geste = Gesture.Pan()
    .activeOffsetY(4)
    .onChange(e => {
      // Vers le bas : suit le doigt ; vers le haut : résistance élastique
      tirage.value = e.translationY > 0 ? e.translationY : e.translationY / 8;
    })
    .onEnd(e => {
      if (tirage.value > 130 || e.velocityY > 900) runOnJS(fermerAuGeste)(e.velocityY);
      else tirage.value = withSpring(0, RESSORT.standard);
    });

  const styleFond = useAnimatedStyle(() => ({
    // Le voile s'éclaircit à mesure que la feuille est tirée vers le bas
    opacity: progres.value * Math.max(0, 1 - tirage.value / (H * 0.7)),
  }));
  // Le flou suit la même courbe que le voile, mais via son intensité native
  const propsFlou = useAnimatedProps(() => ({
    intensity: 28 * progres.value * Math.max(0, 1 - tirage.value / (H * 0.7)),
  }));
  const styleFeuille = useAnimatedStyle(() => ({
    opacity: Math.min(1, progres.value * 2.5),
    transform: [
      { translateY: (1 - progres.value) * depart + Math.max(tirage.value, -30) },
      { scale: 0.86 + 0.14 * progres.value - Math.min(Math.max(tirage.value, 0) / (H * 14), 0.01) },
    ],
  }));

  return (
    <Modal visible transparent animationType="none" onRequestClose={fermer}>
      <GestureHandlerRootView style={{ flex: 1, justifyContent: "flex-end" }}>
      {/* Le fond n'est pas qu'assombri : il est FLOUTÉ. Le contenu de l'écran
          reste reconnaissable — on sait d'où l'on vient — mais devient
          illisible, donc la feuille prend tout le regard. Le voile sombre
          garde son rôle : garantir le contraste du texte de la feuille.
          IMPORTANT : c'est l'INTENSITÉ du flou qui est animée, pas l'opacité
          de la vue — une BlurView iOS à l'opacité animée rend par bandes non
          uniformes, visibles surtout à la fermeture. */}
      {/* Sur Android, BlurView ne floute pas sans dimezisBlurView — qui, lui,
          fait tomber l'app (bitmap matériel sur canevas logiciel). À 28
          d'intensité il n'y posait qu'un voile imperceptible : « le flou ne
          marche pas ». Android prend donc le parti de Material — un voile
          franc, sans flou — et c'est le voile ci-dessous qui s'y charge. */}
      {ANDROID ? null : (
        <FlouAnime animatedProps={propsFlou} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      )}
      <PressableReanime style={[sf.fond, styleFond]} onPress={fermer} />
      <Reanime.View style={[feuilleResolue, { maxHeight: hauteur }, styleFeuille]}>
        {/* Tout l'en-tête est une zone de tirage : la seule bande de la
            poignée (~20 pt) était trop étroite pour être trouvée au pouce.
            Le Pan ne s'arme qu'après 4 pt de glissement vertical : les
            touches (fermer, contenus du sous-en-tête) restent intactes. */}
        <GestureDetector gesture={geste}>
          <View>
            <View style={sf.zonePoignee}>
              <View style={sf.poignee} />
            </View>
            <View style={sf.entete}>
              {typeof titre === "string"
                ? <Text style={sf.titre}>{titre}</Text>
                : <View style={{ flex: 1, minWidth: 0 }}>{titre}</View>}
              <Tapable onPress={fermer} hitSlop={10} style={sf.fermer}>
                <Ionicons name="close" size={17} color={T.texte} />
              </Tapable>
            </View>
            {sousEntete}
          </View>
        </GestureDetector>
        {sansDefilement ? children : (
          <ScrollView style={{ marginTop: ESPACE.m }} contentContainerStyle={{ gap: ecart, paddingBottom: pied ? ESPACE.m : 36 }}
            showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        )}
        {pied}
      </Reanime.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ── Apparition : entrée en cascade (fondu + 12 px de translation) ────────────
// À poser autour des cards de liste et des KPIs : `index` décale chaque
// entrée de 40 ms pour l'effet de cascade. Ressort standard (lib/motion).
// Les blocs qui portent une `cle` ne s'animent qu'UNE FOIS par session : sur
// un écran d'onglet, revenir dix fois dans la journée ne doit pas rejouer dix
// fois la cascade. Les listes, elles, gardent l'animation à chaque montage —
// c'est leur façon d'accuser réception d'un nouveau contenu.
const dejaJoue = new Set<string>();

export function Apparition({ index = 0, cle, style, children }: {
  index?: number; cle?: string; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  const rejoue = useRef(cle != null && dejaJoue.has(cle));
  useEffect(() => { if (cle != null) dejaJoue.add(cle); }, [cle]);
  const styleResolu = useStyleResolu(style);
  return (
    <Reanime.View entering={rejoue.current ? undefined : apparition(index)} style={styleResolu}>
      {children}
    </Reanime.View>
  );
}

// ── ChiffreAnime : le nombre compte jusqu'à sa valeur ────────────────────────
// Reçoit le texte déjà formaté (« 1 234,5 M $ ») : le premier nombre est
// animé de 0 à sa valeur en conservant préfixe, suffixe et décimales.
// Le contenu d'un <Text> ne peut venir que de React : impossible de le pousser
// depuis le thread UI comme le reste de nos animations. L'écouteur tourne donc
// sur le thread JS — mais à 60 Hz, avec plusieurs compteurs simultanés sur
// l'accueil, cela faisait des centaines de rendus par seconde au moment précis
// où l'utilisateur commence à faire défiler. Deux garde-fous : cadence
// plafonnée (un nombre qui défile est parfaitement lisse à ~20 Hz, l'œil ne
// distingue pas plus de valeurs dans du texte) et aucun rendu si la chaîne
// formatée n'a pas bougé. La valeur finale, elle, est toujours posée exacte.
const CADENCE_MS = 50;

export function ChiffreAnime({ texte, style, duree = 750, echelleMax = ECHELLE.chiffre }: {
  texte: string; style?: any; duree?: number; echelleMax?: number;
}) {
  const m = /-?\d[\d\u202F\u00A0 ]*(?:,\d+)?/.exec(texte);
  const [affiche, setAffiche] = useState(m ? texte.replace(m[0], "0") : texte);
  const dernierRendu = useRef(0);
  const derniereChaine = useRef("");
  useEffect(() => {
    if (!m) { setAffiche(texte); return; }
    dernierRendu.current = 0; derniereChaine.current = "";
    const brut = m[0];
    const cible = parseFloat(brut.replace(/[\u202F\u00A0 ]/g, "").replace(",", "."));
    const decimales = brut.includes(",") ? brut.split(",")[1].length : 0;
    const anim = new Animated.Value(0);
    const id = anim.addListener(({ value }) => {
      const maintenant = Date.now();
      if (maintenant - dernierRendu.current < CADENCE_MS) return;
      const courant = (cible * value).toLocaleString("fr-FR", {
        minimumFractionDigits: decimales, maximumFractionDigits: decimales,
      });
      if (courant === derniereChaine.current) return;
      dernierRendu.current = maintenant; derniereChaine.current = courant;
      setAffiche(texte.replace(brut, courant));
    });
    Animated.timing(anim, { toValue: 1, duration: duree, useNativeDriver: false }).start(() => setAffiche(texte));
    return () => { anim.removeListener(id); anim.stopAnimation(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte]);
  // Le gabarit est contraint : le chiffre se réduit pour tenir sur une ligne,
  // et son agrandissement système est plafonné
  return (
    <Text style={style} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
      maxFontSizeMultiplier={echelleMax}>{affiche}</Text>
  );
}

// ── États : chargement / erreur / vide ───────────────────────────────────────
export function EtatCharge() {
  return <View style={se.centre}><ActivityIndicator color={T.bleu} size="large" /></View>;
}

export function EtatErreur({ onRetry, texte = "Impossible de joindre la plateforme." }: {
  onRetry: () => void; texte?: string;
}) {
  return (
    <View style={se.centre}>
      <View style={se.pastille}><Symbole nom="cloud_off" taille={24} couleur={T.gris} /></View>
      <Text style={se.titre}>{texte}</Text>
      <Bouton label="Réessayer" onPress={onRetry} style={{ marginTop: ESPACE.xs }} />
    </View>
  );
}

export function EtatVide({ texte, icone = "search_off", sousTexte, action }: {
  texte: string; icone?: string; sousTexte?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={se.centre}>
      <View style={se.pastille}><Symbole nom={icone} taille={24} couleur={T.gris} /></View>
      <Text style={se.titre}>{texte}</Text>
      {sousTexte ? <Text style={se.sous}>{sousTexte}</Text> : null}
      {action ? <Bouton label={action.label} onPress={action.onPress} variante="secondaire" taille="petite" style={{ marginTop: ESPACE.xs }} /> : null}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const sb = creerStyles(() => ({
  base: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    borderRadius: RAYON.petit, alignSelf: "center",
  },
}));

const sc = creerStyles(() => ({
  chip: {
    paddingHorizontal: 15, paddingVertical: 8, borderRadius: RAYON.pilule,
    backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure,
  },
  texte: { ...TYPO.legende, fontFamily: POLICE.demi, color: T.texte },
}));

const scarte = creerStyles(() => ({
  carte: {
    backgroundColor: T.carte, borderRadius: RAYON.moyen,
    borderWidth: 1, borderColor: T.carteBord,
  },
}));

const sbadge = creerStyles(() => ({
  badge: {
    borderRadius: RAYON.pilule, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 3,
    flexShrink: 1, maxWidth: 170,
  },
  texte: { ...TYPO.micro, letterSpacing: 0, fontSize: 10.5 },
}));

const sr = creerStyles(() => ({
  rangee: {
    flexDirection: "row", alignItems: "center",
    borderTopWidth: 1, borderTopColor: T.filet, paddingTop: ESPACE.s,
  },
  separateur: { width: 1, alignSelf: "stretch", backgroundColor: T.filet, marginHorizontal: 18 },
  label: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.gris, marginBottom: 4 },
  valeur: { fontSize: 12.5, fontFamily: POLICE.gras },
}));

const sf = creerStyles(() => ({
  // Le voile couvre TOUT l'écran, pas seulement la place laissée au-dessus de
  // la feuille : en `flex: 1` il s'arrêtait à la hauteur calculée à la mise en
  // page, alors que la feuille se déplace ensuite par transform. Deux coutures
  // en découlaient — les coins arrondis laissaient voir un flou non voilé, et
  // le glissement vers le bas découvrait une bande plus claire à l'ancienne
  // position. La feuille étant opaque, la voiler dessous ne coûte rien.
  // Le voile : léger sur iOS, où le flou fait le gros du travail ; franc sur
  // Android, où il est seul à isoler la feuille de ce qu'il y a derrière
  fond: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ANDROID ? "rgba(2,20,38,0.62)" : "rgba(2,20,38,0.28)",
  },
  feuille: {
    backgroundColor: T.carte, borderTopLeftRadius: 34, borderTopRightRadius: 34,
    // La courbe continue (« squircle ») : c'est elle qui fait les coins
    // d'une vraie feuille iOS — un rayon circulaire paraît toujours
    // légèrement faux sans qu'on sache dire pourquoi.
    borderCurve: "continuous", overflow: "hidden",
    paddingHorizontal: 22, paddingTop: 10, ...OMBRE.n3,
  },
  zonePoignee: { alignSelf: "stretch", alignItems: "center", paddingTop: 2, paddingBottom: ESPACE.s, marginTop: -6 },
  poignee: { width: 38, height: 4, borderRadius: 2, backgroundColor: T.bordure, marginTop: 6 },
  entete: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: ESPACE.s },
  titre: { ...TYPO.titre, flex: 1, color: T.encre },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
}));

const se = creerStyles(() => ({
  centre: { alignItems: "center", justifyContent: "center", padding: 44, gap: ESPACE.xs },
  pastille: {
    width: 52, height: 52, borderRadius: RAYON.moyen, backgroundColor: T.filet,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  titre: { ...TYPO.sousTitre, color: T.encre, textAlign: "center" },
  sous: { ...TYPO.legende, color: T.gris, textAlign: "center" },
}));
