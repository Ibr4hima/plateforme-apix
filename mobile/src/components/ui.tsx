// Bibliothèque de composants canoniques de l'app — chaque brique est
// définie UNE fois ici et consommée partout : Tapable (le toucher de
// chaque système), Bouton (primaire / secondaire / fantôme, trois tailles),
// Chip, Carte, Badge pastel, RangeeStats (rangée basse des cards),
// Feuille (échafaudage des bottom sheets) et les états de chargement /
// erreur / vide. Jetons : T, TYPO, ESPACE, RAYON, OMBRE (theme.ts).
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityRole, AccessibilityState, ActivityIndicator, Animated, Dimensions,
  LayoutChangeEvent, Modal, Platform, Pressable,
  StyleProp, StyleSheet, Text, View, ViewStyle, type ModalProps,
  type PressableProps, type PressableStateCallbackType,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Reanime, {
  Easing,
  runOnJS, scrollTo, useAnimatedProps, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle,
  useSharedValue, withSpring, withTiming,
} from "react-native-reanimated";
import Icone from "@/components/Icone";
import Symbole from "@/components/Symbole";
import { creerStyles, useCouleur, useStyleResolu } from "@/lib/apparence";
import { foncerPastel } from "@/lib/couleurs";
import { MOUVEMENT_FEUILLE, RESSORT, apparition } from "@/lib/motion";
import { IOS, IPAD } from "@/lib/plateforme";
import { coin, ECHELLE, ESPACE, OMBRE, POLICE, RAYON, T, TYPO } from "@/theme";

const ANDROID = Platform.OS === "android";
const PressableReanime = Reanime.createAnimatedComponent(Pressable);
const FlouAnime = Reanime.createAnimatedComponent(BlurView);

// ── Tapable : le retour tactile de toute l'app — CHAQUE SYSTÈME LE SIEN ─────
// iOS : la surbrillance des cellules d'UIKit (voir TapableIOS). Android :
// l'ondulation de Material (voir TapableAndroid). Ni l'un ni l'autre ne
// rétrécit ce qu'on touche, et rien ne vibre.
export function Tapable(props: ProprietesTapable) {
  return IOS ? <TapableIOS {...props} /> : <TapableAndroid {...props} />;
}

type ProprietesTapable = {
  onPress?: () => void; onLongPress?: () => void; disabled?: boolean;
  style?: StyleProp<ViewStyle>; surbrillance?: boolean; hitSlop?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  accessibilityRole?: AccessibilityRole; accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
  children: React.ReactNode;
};

// SUR iOS, LE TOUCHER D'iOS : ni ressort ni rétrécissement. La surface se
// grise à l'appui — le gris des cellules d'UIKit, posé par-dessus, aux coins
// de la carte — et s'efface au relâcher. C'est ce que fait une ligne de
// Réglages ou de Mail ; l'œil d'un utilisateur d'iPhone le reconnaît.
function TapableIOS({ onPress, onLongPress, disabled, style, surbrillance = true, hitSlop, onLayout, accessibilityRole, accessibilityState, accessibilityLabel, children }: ProprietesTapable) {
  const appui = useSharedValue(0);
  const styleResolu = useStyleResolu(style);
  // Le voile est une vue Reanimated : sa couleur doit lui arriver RÉSOLUE. Un
  // jeton dynamique d'iOS (DynamicColorIOS) y fait tomber l'app au lancement
  const gris = useCouleur(T.surbrillance);
  const voileStyle = useAnimatedStyle(() => ({ opacity: appui.value }));
  const plat = (StyleSheet.flatten(styleResolu) || {}) as ViewStyle;
  return (
    <Pressable
      onPress={onPress} onLongPress={onLongPress} disabled={disabled} hitSlop={hitSlop}
      onLayout={onLayout} accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState} accessibilityLabel={accessibilityLabel}
      onPressIn={() => { if (surbrillance) appui.value = withTiming(1, { duration: 40 }); }}
      onPressOut={() => { appui.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) }); }}
      style={[styleResolu, disabled && { opacity: 0.45 }]}>
      {children}
      {surbrillance ? (
        <Reanime.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          backgroundColor: gris,
          borderRadius: plat.borderRadius, borderCurve: plat.borderCurve,
          borderTopLeftRadius: plat.borderTopLeftRadius, borderTopRightRadius: plat.borderTopRightRadius,
          borderBottomLeftRadius: plat.borderBottomLeftRadius, borderBottomRightRadius: plat.borderBottomRightRadius,
        }, voileStyle]} />
      ) : null}
    </Pressable>
  );
}

// SUR ANDROID, LE TOUCHER D'ANDROID : l'ondulation de Material — le
// RippleDrawable du système, qui part du doigt et s'étale sur la surface —,
// sans ressort ni rétrécissement. C'est ce que fait une carte de Google Agenda
// ou une ligne des Paramètres.
//
// L'ondulation vit dans le fond de la vue, que les coins arrondis ne rognent
// pas : sur une carte, elle déborderait en rectangle. Une surface arrondie se
// pose donc en deux étages — dehors, la boîte (sa place, sa taille, son fond,
// son bord, son ombre), qui rogne à ses coins ; dedans, le Pressable qui
// ondule et range le contenu.
// Ce que reçoit la surface d'Android : les propriétés d'un Pressable, son
// style à plat
type ProprietesSurfaceAndroid = Omit<PressableProps, "style" | "children" | "hitSlop"> & {
  style?: StyleProp<ViewStyle>; surbrillance?: boolean; hitSlop?: number; children?: React.ReactNode;
};

function TapableAndroid({ style, surbrillance = true, disabled, onLayout, children, ...reste }: ProprietesSurfaceAndroid) {
  const plat = (StyleSheet.flatten(style) || {}) as ViewStyle;
  const commun = {
    ...reste, disabled,
    android_ripple: surbrillance ? { color: T.surbrillance as unknown as string } : undefined,
  };
  if (!surbrillance || !arrondi(plat)) return (
    <Pressable {...commun} onLayout={onLayout} style={[plat, disabled && { opacity: 0.45 }]}>
      {children}
    </Pressable>
  );
  const { dehors, dedans } = repartirStyle(plat);
  return (
    <View onLayout={onLayout} style={[dehors, { overflow: "hidden" }, disabled && { opacity: 0.45 }]}>
      <Pressable {...commun} style={dedans}>{children}</Pressable>
    </View>
  );
}

/** Une surface touchable qu'iOS dessine à sa façon — sans retour (un badge,
    un libellé qui ouvre un sélecteur) ou avec le sien (`style` en fonction de
    `pressed`) — et qui, sur Android, ondule comme toute surface de Material.
    Sur iOS, c'est le Pressable d'avant, à l'identique. */
type ProprietesOndulable = Omit<PressableProps, "style" | "children" | "hitSlop"> & {
  style?: StyleProp<ViewStyle> | ((etat: PressableStateCallbackType) => StyleProp<ViewStyle>);
  hitSlop?: number;
  children?: React.ReactNode;
};
export function Ondulable({ style, children, ...reste }: ProprietesOndulable) {
  if (IOS) return <Pressable {...reste} style={style}>{children}</Pressable>;
  return (
    <TapableAndroid {...reste} style={typeof style === "function" ? style({ pressed: false }) : style}>
      {children}
    </TapableAndroid>
  );
}

const arrondi = (st: ViewStyle) => !!(st.borderRadius || st.borderTopLeftRadius || st.borderTopRightRadius
  || st.borderBottomLeftRadius || st.borderBottomRightRadius);

// Ce qui range le contenu passe dans le Pressable ; tout le reste (place dans
// le flux, taille, fond, bord, coins, ombre) fait la boîte. Le Pressable
// remplit la boîte : toute la surface répond au doigt.
const DEDANS = new Set([
  "padding", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "paddingHorizontal",
  "paddingVertical", "paddingStart", "paddingEnd", "flexDirection", "flexWrap", "alignItems",
  "alignContent", "justifyContent", "gap", "rowGap", "columnGap",
]);
function repartirStyle(plat: ViewStyle) {
  const dehors: Record<string, unknown> = {};
  const dedans: Record<string, unknown> = { flexGrow: 1 };
  for (const [cle, valeur] of Object.entries(plat)) (DEDANS.has(cle) ? dedans : dehors)[cle] = valeur;
  return { dehors: dehors as ViewStyle, dedans: dedans as ViewStyle };
}

// ── SeparateurSection : la césure entre deux blocs d'une même page ───────────
// Deux filets qui s'éteignent vers les bords de l'écran et, au centre, le nom
// de la section dans un tag au liseré et au texte de sa couleur, sur le fond
// de la page. Empilées sans marque, les
// sections d'une page longue (Flux & Stocks, Greenfield, Fusion & Acquisition)
// se confondaient ; ici la coupure se voit avant même d'être lue, et la teinte
// annonce celle des cartes qui suivent.
export function SeparateurSection({ titre, couleur: teinte = T.bleu as string, style }: {
  titre: string; couleur?: string; style?: StyleProp<ViewStyle>;
}) {
  // La teinte part en concaténation (`${couleur}33`) : il lui faut une chaîne
  const couleur = useCouleur(teinte);
  return (
    <View style={[ss.rangee, style]} accessibilityRole="header">
      <LinearGradient colors={["rgba(122,138,164,0)", "rgba(122,138,164,0.42)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ss.filet} />
      {/* Le tag sur le fond de la page (#FAFAFA) : sa couleur tient au
          liseré et au texte, sans aplat teinté */}
      <View style={[ss.tag, { backgroundColor: T.fond, borderColor: `${couleur}33` }]}>
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

// ── ChipFiltre : la barre d'onglets en pastilles, en haut des écrans ─────────
// Une rangée qui défile, une pastille par vue, une seule choisie. Chaque
// système la dessine à sa façon : les pastilles grises des onglets du site
// sur iOS, la puce de filtre de Material 3 sur Android. Défini ici une seule
// fois — six écrans en recopiaient la mise en forme.
export function ChipFiltre({ label, actif, compte, onPress, onLayout }: {
  label: string; actif: boolean; compte?: number | null;
  onPress: () => void; onLayout?: (e: LayoutChangeEvent) => void;
}) {
  // iOS : le style des onglets du site (Investissements réalisés · projetés).
  // Les autres sont des pastilles grises, au texte gris ; la choisie est
  // BLANCHE, son nom en bleu APIX, en gras, légèrement soulevée par une ombre
  // douce. Aucun aplat de couleur : la sélection se lit au relief et au bleu
  // du texte. Le nom reste complet, le compte se lit en second, dans la
  // pastille. Elle s'estompe au toucher, comme un bouton d'iOS.
  if (IOS) return (
    <Pressable onPress={() => onPress()} onLayout={onLayout}
      accessibilityRole="tab" accessibilityState={{ selected: actif }}
      style={({ pressed }) => [scf.capsule, actif && scf.capsuleActive, pressed && { opacity: 0.6 }]}>
      <Text style={[scf.capsuleTexte, actif && scf.capsuleTexteActif]} maxFontSizeMultiplier={ECHELLE.compact}>
        {label}
      </Text>
      {compte != null && (
        <Text style={[scf.capsuleCompte, actif && scf.capsuleCompteActif]} maxFontSizeMultiplier={ECHELLE.compact}>
          {compte}
        </Text>
      )}
    </Pressable>
  );
  // Android : la puce de filtre de Material 3 — 32 dp, coins de 8 dp. Au
  // repos, un contour fin et l'encre ; choisie, le ton de sélection, sans
  // contour, sa coche en tête, l'ondulation au toucher. Le compte suit le
  // nom, plus discret.
  return (
    <Tapable onPress={() => onPress()} onLayout={onLayout}
      accessibilityRole="tab" accessibilityState={{ selected: actif }}
      style={[scf.puce, actif && scf.puceChoisie]}>
      {actif ? <Icone sf="checkmark" materiel="check" taille={18} couleur={T.bleu} /> : null}
      <Text style={[scf.puceTexte, actif && scf.puceTexteChoisie]} maxFontSizeMultiplier={ECHELLE.compact}>
        {label}
      </Text>
      {compte != null && (
        <Text style={[scf.puceCompte, actif && scf.puceCompteChoisie]} maxFontSizeMultiplier={ECHELLE.compact}>
          {compte}
        </Text>
      )}
    </Tapable>
  );
}

const scf = creerStyles(() => ({
  // Android : la puce de filtre de Material 3
  puce: {
    flexDirection: "row", alignItems: "center", gap: 8, height: 32, paddingHorizontal: 16,
    borderRadius: 8, borderWidth: 1, borderColor: T.voileFort,
  },
  // Choisie : la coche prend la place de la marge de tête
  puceChoisie: { paddingLeft: 8, backgroundColor: T.selection, borderColor: "transparent" },
  puceTexte: { fontSize: 14, lineHeight: 20, fontFamily: POLICE.moyen, color: T.encre },
  puceTexteChoisie: { color: T.bleu },
  puceCompte: { fontSize: 13, fontFamily: POLICE.moyen, color: T.gris, fontVariant: ["tabular-nums"] },
  puceCompteChoisie: { color: T.bleu, opacity: 0.7 },
  // iOS
  capsule: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: RAYON.pilule, borderCurve: "continuous",
    backgroundColor: T.voile, borderWidth: StyleSheet.hairlineWidth, borderColor: "transparent",
    // La rangée défile : sur iOS elle rogne ce qui dépasse — ce jeu garde
    // l'ombre de la choisie entière
    marginVertical: 3,
  },
  // La choisie : blanche, soulevée (l'ombre du site : 0 1 4, 10 %)
  capsuleActive: {
    backgroundColor: T.carte, borderColor: T.carteBord,
    shadowColor: "#0B1220", shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  capsuleTexte: { fontSize: 14, fontFamily: POLICE.demi, color: T.gris },
  capsuleTexteActif: { color: T.bleu, fontFamily: POLICE.gras },
  capsuleCompte: { fontSize: 13, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },
  capsuleCompteActif: { color: T.bleu, opacity: 0.7 },
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

// ── Feuille : l'échafaudage des feuilles ─────────────────────────────────────
// Fond voilé, poignée, en-tête (titre + fermer), sous-en-tête libre
// (pilules…), corps défilant, `pied` fixe optionnel. La feuille prend TOUTE
// LA PAGE, jusque sous la barre d'état, quel que soit son contenu : une
// hauteur constante d'une fiche à l'autre. Sur iOS, c'est la feuille d'iOS
// (pageSheet) ; sur Android, la feuille de Material 3 dépliée.
//
// L'OUVERTURE EST CELLE D'UNE FEUILLE D'iOS : elle monte du bas de l'écran,
// toujours, sur la courbe des feuilles du système (lib/motion), sans échelle
// ni rebond. Elle partait de la card touchée — d'en haut ou d'en bas selon
// l'endroit du doigt, en grandissant de 86 à 100 % —, et démarrait au montage,
// pendant que la fiche se construisait encore : ses premières images
// sautaient. Elle part désormais une fois la feuille mesurée, une image plus
// tard : le mouvement est entier, du premier pixel au dernier.
//
// LA FERMETURE AU DOIGT, comme une feuille d'iOS : on la tire vers le bas par
// son en-tête OU PAR SON CONTENU dès que celui-ci est revenu en haut — le
// défilement remonte d'abord, puis la feuille suit le doigt sans à-coup. Au
// lâcher, c'est l'élan qui décide : un geste vif ferme même court, un geste
// lent ferme passé le quart de la feuille ; sinon elle se repose. La sortie
// garde la vitesse du doigt (durée raccourcie d'autant) et le fond se
// dévoile en même temps.
//
// SUR iOS : le fond flouté, la croix d'iOS ; le fond gris des listes
// groupées (fondGroupe), sur lequel se posent les groupes blancs de ListeIOS ;
// la barre d'une feuille d'UIKit pour les filtres (actions : « Réinitialiser »
// · « OK »).
//
// SUR ANDROID, LA FEUILLE DE MATERIAL 3 : coins de 28 dp, la poignée de
// 32 × 4 dp, le voile noir à 32 % sans flou ; le titre à gauche en 22 sp, la
// croix en bouton icône ; les actions en boutons texte au bout de la ligne
// du titre. La fenêtre est bord à bord : la feuille descend sous la barre de
// navigation, et son contenu s'arrête au-dessus.
type ActionFeuille = { label: string; onPress: () => void };

type ProprietesFeuille = {
  titre: React.ReactNode; sousEntete?: React.ReactNode; onClose: () => void;
  ecart?: number; pied?: React.ReactNode;
  /** Sur tablette, la feuille se plafonne et se centre au lieu de s'étirer
   *  d'un bord à l'autre : une fiche de 1 000 pt de large ne se lit pas. Sans
   *  effet sur téléphone, plus étroit que le plafond. */
  largeurMax?: number;
  /** Le fond gris des listes groupées, sur lequel se posent les groupes
   *  blancs (ListeIOS) — celui des feuilles de réglages et de filtres. */
  fondGroupe?: boolean;
  /** La barre des filtres, sans croix. iOS : celle d'UIKit — le titre centré,
   *  une commande de chaque côté (« Réinitialiser » · « OK »). Android : le
   *  titre à gauche, les deux commandes en boutons texte au bout. */
  actions?: { gauche?: ActionFeuille; droite?: ActionFeuille };
  children: React.ReactNode;
};

export function Feuille(props: ProprietesFeuille) {
  return <FeuilleDessinee {...props} />;
}

// Ce que la feuille parcourt EN PLUS de sa hauteur pour quitter l'écran : son
// ombre portée doit sortir avec elle
const MARGE_SORTIE = 48;

// Sur iPad, la feuille suit l'écran dans toutes ses orientations ; sur
// iPhone, l'app reste en portrait
const ORIENTATIONS_FEUILLE: ModalProps["supportedOrientations"] = IPAD
  ? ["portrait", "portrait-upside-down", "landscape-left", "landscape-right"]
  : ["portrait"];

/** Une commande de la barre d'une feuille. iOS : du texte à la teinte de
    l'app, en gras pour celle qui conclut (« OK »). Android : le bouton texte
    de Material 3 — 40 dp, l'ondulation en pilule. */
function ActionBarre({ action, principale }: { action: ActionFeuille; principale?: boolean }) {
  if (!IOS) return (
    <Ondulable onPress={action.onPress} accessibilityRole="button" style={sf.actionAndroid}>
      <Text style={sf.actionAndroidTexte} numberOfLines={1} maxFontSizeMultiplier={ECHELLE.compact}>{action.label}</Text>
    </Ondulable>
  );
  return (
    <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button"
      style={({ pressed }) => [sf.action, pressed && { opacity: 0.4 }]}>
      <Text style={[sf.actionTexte, principale && sf.actionPrincipale]} numberOfLines={1}
        maxFontSizeMultiplier={ECHELLE.compact}>{action.label}</Text>
    </Pressable>
  );
}

function FeuilleDessinee({
  titre, sousEntete, onClose, ecart = 20, pied, largeurMax, fondGroupe, actions, children,
}: ProprietesFeuille) {
  // Le fond gris des listes groupées, sur lequel se posent leurs groupes
  // blancs — sur iOS comme sur Android
  const groupe = fondGroupe;
  // Toute la page, jusque sous la barre d'état — 8 pt laissent voir le fond.
  // iOS : la hauteur de l'écran. Android : la fenêtre de la feuille couvre
  // tout l'écran, bord à bord, quand les dimensions de la fenêtre de l'app en
  // retranchent la barre de navigation — la feuille s'ancre donc aux bords de
  // sa fenêtre, centrée sous son plafond de largeur sur tablette.
  const insets = useSafeAreaInsets();
  const largeurEcran = Dimensions.get("window").width;
  const cote = largeurMax ? Math.max(0, (largeurEcran - largeurMax) / 2) : 0;
  const taille: ViewStyle = IOS
    ? { height: Dimensions.get("window").height - insets.top - 8 }
    : { position: "absolute", top: insets.top + 8, bottom: 0, left: cote, right: cote };
  // Android : le contenu s'arrête au-dessus de la barre de navigation
  const basSysteme = IOS ? 0 : insets.bottom;
  // La feuille est une vue Reanimated : son fond lui arrive résolu (un jeton
  // dynamique d'iOS y ferait tomber l'app)
  const fondFeuilleGroupe = useCouleur(T.fond);
  const H = Dimensions.get("window").height;

  // Deux grandeurs pilotent tout : l'ouverture (0→1) et le tirage du doigt.
  // Fond, flou et position en dérivent en continu — pendant le geste, c'est
  // l'écran entier qui suit la main.
  const feuilleResolue = useStyleResolu(sf.feuille);
  const progres = useSharedValue(0);
  const tirage = useSharedValue(0);
  // La hauteur réelle de la feuille (le seuil de fermeture en dépend), et la
  // course de l'ouverture : de sous l'écran à sa place. Avant d'être mesurée,
  // la feuille attend sous le bord.
  const hauteurFeuille = useSharedValue(H);
  const course = useSharedValue(H + MARGE_SORTIE);
  const ouverte = useRef(false);

  const mesurer = (h: number) => {
    hauteurFeuille.value = h;
    if (ouverte.current) return;
    ouverte.current = true;
    course.value = h + MARGE_SORTIE;
    // Une image après la mesure : le montage du contenu est passé, et le
    // mouvement ne perd aucune de ses images
    requestAnimationFrame(() => { progres.value = withTiming(1, MOUVEMENT_FEUILLE.ouverture); });
  };

  const fermer = () => {
    // La feuille a pu changer de taille depuis son ouverture (rotation sur
    // iPad) : elle sort entière
    course.value = hauteurFeuille.value + MARGE_SORTIE;
    progres.value = withTiming(0, MOUVEMENT_FEUILLE.fermeture,
      fini => { if (fini) runOnJS(onClose)(); });
  };
  // Le décalage du défilement du contenu : la feuille ne suit le doigt que
  // lorsque le contenu est en haut
  const refDefil = useAnimatedRef<Reanime.ScrollView>();
  const defil = useSharedValue(0);
  const surDefil = useAnimatedScrollHandler(e => { defil.value = e.contentOffset.y; });

  // Le lâcher : l'élan d'abord (projection à ~150 ms), la distance ensuite
  const lacher = (vy: number) => {
    "worklet";
    const projete = tirage.value + Math.max(vy, 0) * 0.15;
    if (tirage.value > 8 && (vy > 550 || projete > Math.min(140, hauteurFeuille.value * 0.25))) {
      // La sortie part à la vitesse du doigt : plus il est vif, plus elle est brève
      const reste = Math.max(hauteurFeuille.value + 40 - tirage.value, 0);
      const duree = Math.min(260, Math.max(140, (reste / Math.max(vy, 900)) * 1000));
      tirage.value = withTiming(hauteurFeuille.value + 40, { duration: duree, easing: Easing.out(Easing.quad) },
        fini => { if (fini) runOnJS(onClose)(); });
    } else {
      tirage.value = withSpring(0, { ...RESSORT.standard, velocity: vy });
    }
  };

  // Par l'en-tête : vers le bas il suit le doigt, vers le haut il résiste
  const gesteEntete = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onChange(e => {
      tirage.value = e.translationY > 0 ? e.translationY : e.translationY / 8;
    })
    .onEnd(e => { lacher(e.velocityY); });

  // Par le contenu : seulement vers le bas, et seulement contenu en haut. Le
  // défilement et la feuille se partagent le geste : tant que la feuille est
  // tirée, le contenu est tenu en haut ; revenue à sa place, il redéfile.
  const natif = Gesture.Native();
  const gesteContenu = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-14, 14])
    .simultaneousWithExternalGesture(natif)
    .onChange(e => {
      if (defil.value > 0.5 && tirage.value <= 0) return;
      const suivant = Math.max(0, tirage.value + e.changeY);
      tirage.value = suivant;
      if (suivant > 0) scrollTo(refDefil, 0, 0, false);
    })
    .onEnd(e => { if (tirage.value > 0) lacher(e.velocityY); });

  // Le voile s'éclaircit à mesure que la feuille est tirée vers le bas, et
  // s'éteint tout à fait quand elle sort de l'écran — quelle que soit sa hauteur
  const styleFond = useAnimatedStyle(() => ({
    opacity: progres.value * Math.max(0, 1 - Math.max(tirage.value, 0) / (hauteurFeuille.value + 40)),
  }));
  // Le flou suit la même courbe que le voile, mais via son intensité native
  const propsFlou = useAnimatedProps(() => ({
    intensity: 28 * progres.value * Math.max(0, 1 - Math.max(tirage.value, 0) / (hauteurFeuille.value + 40)),
  }));
  // Un seul mouvement : la translation — ni fondu, ni échelle
  const styleFeuille = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progres.value) * course.value + Math.max(tirage.value, -30) }],
  }));

  return (
    <Modal visible transparent animationType="none" onRequestClose={fermer} supportedOrientations={ORIENTATIONS_FEUILLE}>
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
      <Reanime.View style={[feuilleResolue, taille, groupe && { backgroundColor: fondFeuilleGroupe },
        IOS && largeurMax ? { width: "100%", maxWidth: largeurMax, alignSelf: "center" } : null, styleFeuille]}
        onLayout={e => mesurer(e.nativeEvent.layout.height)}>
        {/* Tout l'en-tête est une zone de tirage : la seule bande de la
            poignée (~20 pt) était trop étroite pour être trouvée au pouce.
            Le Pan ne s'arme qu'après 4 pt de glissement vertical : les
            touches (fermer, contenus du sous-en-tête) restent intactes. */}
        <GestureDetector gesture={gesteEntete}>
          <View>
            <View style={sf.zonePoignee}>
              <View style={sf.poignee} />
            </View>
            {actions && IOS ? (
              // iOS : la barre d'une feuille d'UIKit — les deux côtés ont la
              // même largeur, le titre reste au centre optique
              <View style={sf.barreIOS}>
                <View style={sf.barreCote}>
                  {actions.gauche ? <ActionBarre action={actions.gauche} /> : null}
                </View>
                <Text style={sf.barreTitre} numberOfLines={1} accessibilityRole="header">
                  {typeof titre === "string" ? titre : null}
                </Text>
                <View style={[sf.barreCote, { alignItems: "flex-end" }]}>
                  {actions.droite ? <ActionBarre action={actions.droite} principale /> : null}
                </View>
              </View>
            ) : actions ? (
              // Android : le titre à gauche, les commandes au bout
              <View style={sf.barreAndroid}>
                <Text style={sf.titreAndroid} numberOfLines={1} accessibilityRole="header">
                  {typeof titre === "string" ? titre : null}
                </Text>
                {actions.gauche ? <ActionBarre action={actions.gauche} /> : null}
                {actions.droite ? <ActionBarre action={actions.droite} principale /> : null}
              </View>
            ) : (
              <View style={sf.entete}>
                {typeof titre === "string"
                  ? <Text style={IOS ? sf.titre : sf.titreAndroid} accessibilityRole="header">{titre}</Text>
                  : <View style={{ flex: 1, minWidth: 0 }}>{titre}</View>}
                {IOS ? (
                  <Tapable onPress={fermer} hitSlop={10} style={sf.fermer} accessibilityLabel="Fermer">
                    <Icone sf="xmark" materiel="close" taille={13} poids="bold" couleur={T.gris} />
                  </Tapable>
                ) : (
                  // Android : le bouton icône de Material 3
                  <Pressable onPress={fermer} accessibilityRole="button" accessibilityLabel="Fermer"
                    android_ripple={{ color: T.surbrillance as unknown as string, borderless: true, radius: 20 }}
                    style={sf.fermerAndroid}>
                    <Icone sf="xmark" materiel="close" taille={24} couleur={T.gris} />
                  </Pressable>
                )}
              </View>
            )}
            {sousEntete}
          </View>
        </GestureDetector>
        <GestureDetector gesture={gesteContenu}>
          <View style={sf.corps}>
            <GestureDetector gesture={natif}>
              {/* Pas de rebond en haut : tiré vers le bas, c'est la feuille
                  qui descend, pas son contenu dans la feuille */}
              <Reanime.ScrollView ref={refDefil} onScroll={surDefil} scrollEventThrottle={16} bounces={false}
                style={{ marginTop: ESPACE.m }}
                contentContainerStyle={{ gap: ecart, paddingBottom: (pied ? ESPACE.m : 36) + basSysteme }}
                showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
                {children}
              </Reanime.ScrollView>
            </GestureDetector>
          </View>
        </GestureDetector>
        {pied && basSysteme ? <View style={{ paddingBottom: basSysteme }}>{pied}</View> : pied}
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
//
// C'EST LE SEUL MOUVEMENT d'une carte vedette quand on change d'indicateur. Le
// bloc se rejouait (fondu, légère montée), les repères glissaient au ressort,
// la courbe se déformait d'une série à l'autre : trop d'effets pour un tableau
// de bord. Le nombre recompte ; tout le reste change en place.
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
    // Android : le bouton de Material 3, en pilule
    borderRadius: IOS ? RAYON.petit : RAYON.pilule, alignSelf: "center",
  },
}));

const scarte = creerStyles(() => ({
  carte: {
    backgroundColor: T.carte, borderRadius: coin(RAYON.moyen),
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
    // Android : le voile de Material 3, noir à 32 %
    backgroundColor: ANDROID ? "rgba(0,0,0,0.32)" : "rgba(2,20,38,0.28)",
  },
  feuille: IOS ? {
    backgroundColor: T.carte, borderTopLeftRadius: 34, borderTopRightRadius: 34,
    // La courbe continue (« squircle ») : c'est elle qui fait les coins
    // d'une vraie feuille iOS — un rayon circulaire paraît toujours
    // légèrement faux sans qu'on sache dire pourquoi.
    borderCurve: "continuous", overflow: "hidden",
    paddingHorizontal: 22, paddingTop: 10, ...OMBRE.n3,
  } : {
    // Android : la feuille de Material 3 — coins de 28 dp, les marges de
    // 16 dp du système
    backgroundColor: T.carte, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden",
    paddingHorizontal: 16, elevation: 1,
  },
  // Le corps défilant remplit la feuille pleine page
  corps: { flex: 1 },
  // iOS : la barre d'une feuille d'UIKit — titre centré, une commande de
  // chaque côté
  barreIOS: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: 8 },
  barreCote: { flex: 1, alignItems: "flex-start" },
  barreTitre: { flexShrink: 1, fontSize: 17, fontFamily: POLICE.demi, color: T.encre, textAlign: "center" },
  action: { paddingVertical: 6 },
  actionTexte: { fontSize: 16, fontFamily: POLICE.moyen, color: T.bleu },
  actionPrincipale: { fontFamily: POLICE.gras },
  // Android : la poignée de Material 3 — 32 × 4 dp, 22 dp au-dessus
  zonePoignee: IOS
    ? { alignSelf: "stretch", alignItems: "center", paddingTop: 2, paddingBottom: ESPACE.s, marginTop: -6 }
    : { alignSelf: "stretch", alignItems: "center", paddingTop: 22, paddingBottom: 14 },
  poignee: IOS
    ? { width: 38, height: 4, borderRadius: 2, backgroundColor: T.bordure, marginTop: 6 }
    : { width: 32, height: 4, borderRadius: 2, backgroundColor: T.gris, opacity: 0.4 },
  entete: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: ESPACE.s },
  // Le titre d'une feuille de choix (« Choisir un pays », « Destination »)
  titre: { flex: 1, fontSize: 21, lineHeight: 27, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.4 },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
  // Android : le titre d'une feuille de Material 3, le bouton icône de 48 dp
  // (son icône calée sur la marge), les boutons texte
  titreAndroid: { flex: 1, fontSize: 22, lineHeight: 28, fontFamily: POLICE.normal, color: T.encre },
  fermerAndroid: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginTop: -10, marginRight: -12 },
  barreAndroid: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 48 },
  actionAndroid: { height: 40, paddingHorizontal: 12, borderRadius: 20, justifyContent: "center" },
  actionAndroidTexte: { fontSize: 14, fontFamily: POLICE.moyen, color: T.bleu, letterSpacing: 0.1 },
}));

const se = creerStyles(() => ({
  centre: { alignItems: "center", justifyContent: "center", padding: 44, gap: ESPACE.xs },
  pastille: {
    width: 52, height: 52, borderRadius: coin(RAYON.moyen), backgroundColor: T.filet,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  titre: { ...TYPO.sousTitre, color: T.encre, textAlign: "center" },
  sous: { ...TYPO.legende, color: T.gris, textAlign: "center" },
}));
