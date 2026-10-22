// TexteDefilant — un titre qui n'est jamais coupé. Quand il tient, c'est un
// Text d'une ligne comme un autre. Quand il déborde, il défile pour se lire en
// entier, à la manière de chaque système :
//   · iOS, comme Musique : il attend, glisse à vitesse constante, une copie
//     le suit après un blanc et prend sa place, puis il se repose. Le bord de
//     fin s'estompe ; celui de tête aussi, le temps du passage ;
//   · Android, le marquee de TextView : départ après 1,2 s, 30 dp/s, la copie
//     suit à un tiers de sa longueur, le bord de fin s'estompe.
//
// IL NE CACHE JAMAIS LE TEXTE. Le Text d'origine reste dans le flux, à sa
// place exacte : c'est lui qui donne l'encombrement, comme avant, et c'est lui
// qu'on lit — avec ses points de suspension — tant que rien n'est mesuré avec
// certitude. La copie qui défile ne se pose par-dessus que sur un débordement
// constaté : la largeur naturelle du texte, mesurée hors de toute contrainte,
// dépasse la place que le Text a réellement reçue. Une boîte mesurée à zéro
// ne déclenche rien.
//
// ÉCONOME (lib/defilement) : il ne bouge que si l'écran a le focus, sur la
// couche du dessus, app au premier plan, et visible à l'écran — vérifié à
// chaque tour ; trois titres au plus à la fois. Les pauses sont des
// minuteries, pas des animations : aucune image n'est calculée pendant
// qu'il se repose. Le mouvement passe par le fil UI (Reanimated).
// MOUVEMENT RÉDUIT (réglage d'accessibilité) : rien ne bouge, le titre se
// replie sur plusieurs lignes — entier quand même.
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Dimensions, Platform, StyleSheet, Text, View, useWindowDimensions,
  type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import Reanime, {
  Easing, ReduceMotion, cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from "react-native-reanimated";
import { prendreTour, rendreTour, useDefilementPermis } from "@/lib/defilement";
import { IOS } from "@/lib/plateforme";

// Le rythme de chaque système. Vitesse en pt (dp) par seconde, durées en ms,
// fondu et écart en pt.
const RYTHME = IOS
  ? { delai: 1800, pause: 2400, vitesse: 30, fondu: 14, ecart: () => 36 }
  : { delai: 1200, pause: 1200, vitesse: 30, fondu: 12, ecart: (largeur: number) => Math.max(24, largeur / 3) };

// Sur le web, MaskedView rend le masque À LA PLACE du contenu : le texte y
// défile dans une simple boîte qui rogne, bords nets
const SANS_MASQUE = Platform.OS === "web";

// Ce qui place la boîte dans son conteneur va à la boîte ; le reste habille
// le texte
const DEHORS = new Set([
  "flex", "flexGrow", "flexShrink", "flexBasis", "alignSelf", "position", "zIndex", "display",
  "top", "bottom", "left", "right", "start", "end",
  "width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight", "aspectRatio",
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
  "marginHorizontal", "marginVertical", "marginStart", "marginEnd",
  "transform", "opacity",
]);

function repartir(style: StyleProp<TextStyle>): { dehors: ViewStyle; dedans: TextStyle } {
  const dehors: Record<string, unknown> = {};
  const dedans: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(StyleSheet.flatten(style) || {})) {
    (DEHORS.has(cle) ? dehors : dedans)[cle] = valeur;
  }
  return { dehors: dehors as ViewStyle, dedans: dedans as TextStyle };
}

// Le texte d'un nœud — de quoi savoir quand remesurer
function texteDe(n: ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(texteDe).join("");
  if (typeof n === "object" && "props" in n) return texteDe((n as { props: { children?: ReactNode } }).props.children);
  return "";
}

type Proprietes = Omit<TextProps, "numberOfLines" | "ellipsizeMode" | "adjustsFontSizeToFit">;

export default function TexteDefilant({ style, children, onLayout, ...props }: Proprietes) {
  const reduit = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const permis = useDefilementPermis();
  const { dehors, dedans } = repartir(style);
  const echelle = { maxFontSizeMultiplier: props.maxFontSizeMultiplier, allowFontScaling: props.allowFontScaling };

  // La place reçue (le Text du flux) et la largeur naturelle du texte. La
  // mesure se refait quand le texte ou sa typographie change.
  const [boite, setBoite] = useState(0);
  const signature = [texteDe(children), fontScale, dedans.fontSize, dedans.fontFamily, dedans.fontWeight,
    dedans.letterSpacing, dedans.textTransform].join("|");
  const [mesure, setMesure] = useState<{ signature: string; largeur: number } | null>(null);
  const aMesurer = mesure?.signature !== signature;
  const naturelle = aMesurer ? 0 : mesure!.largeur;
  // Un vrai débordement, dans une vraie boîte — sinon c'est un Text ordinaire
  const deborde = !reduit && boite >= 24 && naturelle > boite + 1;
  // Une marge d'un point de chaque côté : la copie ne s'abrège jamais
  const largeurTexte = Math.ceil(naturelle) + 2;
  const ecart = Math.round(RYTHME.ecart(largeurTexte));
  const course = largeurTexte + ecart;

  const ref = useRef<View>(null);
  const tx = useSharedValue(0);
  const anime = deborde && permis;

  useEffect(() => {
    if (!anime) return;
    let fini = false;
    let tour = false;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const relancer = (delai: number) => { if (!fini) minuteur = setTimeout(passer, delai); };
    const conclure = () => {
      if (tour) { tour = false; rendreTour(); }
      relancer(RYTHME.pause);
    };
    function passer() {
      if (fini) return;
      const vue = ref.current;
      if (!vue) return relancer(RYTHME.pause);
      vue.measureInWindow((x, y, l, h) => {
        if (fini) return;
        const { width: W, height: H } = Dimensions.get("window");
        const visible = l > 0 && h > 0 && x < W && x + l > 0 && y < H && y + h > 0;
        // Hors de l'écran, ou trois titres déjà en route : on repassera, à un
        // moment un peu différent des autres pour que chacun ait son tour
        if (!visible || !prendreTour()) return relancer(RYTHME.pause * (0.6 + Math.random() * 0.8));
        tour = true;
        // Le mouvement réduit est traité plus haut (le titre se replie) : ce
        // tour ne part que s'il est permis, il va donc jusqu'au bout
        tx.value = withTiming(-course, {
          duration: (course / RYTHME.vitesse) * 1000, easing: Easing.linear, reduceMotion: ReduceMotion.Never,
        }, termine => {
          // La copie est arrivée à la place du texte : on revient à zéro sans
          // que rien ne se voie
          if (termine) { tx.value = 0; runOnJS(conclure)(); }
        });
      });
    }
    relancer(RYTHME.delai);
    return () => {
      fini = true;
      if (minuteur) clearTimeout(minuteur);
      cancelAnimation(tx);
      tx.value = 0;
      if (tour) { tour = false; rendreTour(); }
    };
  }, [anime, course, tx]);

  const styleRuban = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  // iOS : le bord de tête s'estompe en proportion du chemin parcouru — net au
  // repos, net quand la copie se pose
  const styleTeteNette = useAnimatedStyle(() => {
    const parcouru = -tx.value;
    const force = Math.min(1, Math.max(0, Math.min(parcouru, course - parcouru) / RYTHME.fondu));
    return { opacity: 1 - force };
  });

  // Mouvement réduit : le titre entier, replié s'il le faut
  if (reduit) return <Text {...props} style={style} onLayout={onLayout}>{children}</Text>;

  return (
    <View ref={ref} style={dehors} collapsable={false}>
      <Text {...props} style={[dedans, deborde && s.efface]} numberOfLines={1}
        onLayout={e => { setBoite(e.nativeEvent.layout.width); onLayout?.(e); }}>
        {children}
      </Text>
      {aMesurer ? (
        // La largeur naturelle : le même texte, sur une ligne, sans contrainte
        <View style={s.mesure} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text style={dedans} numberOfLines={1} {...echelle}
            onLayout={e => setMesure({ signature, largeur: e.nativeEvent.layout.width })}>
            {children}
          </Text>
        </View>
      ) : null}
      {deborde ? (() => {
        // Le texte et sa copie, à la suite, sur le fil UI
        const ruban = (
          <Reanime.View style={[s.ruban, { width: course + largeurTexte }, styleRuban]}>
            <Text style={[dedans, { width: largeurTexte }]} numberOfLines={1} {...echelle}>{children}</Text>
            <Text style={[dedans, { width: largeurTexte, marginLeft: ecart }]} numberOfLines={1} {...echelle}>{children}</Text>
          </Reanime.View>
        );
        return SANS_MASQUE ? (
          <View style={[StyleSheet.absoluteFill, s.rogne]} pointerEvents="none" aria-hidden>{ruban}</View>
        ) : (
          <MaskedView style={StyleSheet.absoluteFill} pointerEvents="none"
            importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
            maskElement={<Masque styleTete={styleTeteNette} />}>
            {ruban}
          </MaskedView>
        );
      })() : null}
    </View>
  );
}

// Le masque : opaque là où le texte se lit, estompé aux bords. Sur Android, le
// masque est une image recalculée à chaque changement : il reste donc fixe —
// le seul bord de fin, comme au repos du marquee
function Masque({ styleTete }: { styleTete: ReturnType<typeof useAnimatedStyle> }) {
  return (
    <View style={s.masque}>
      {IOS ? (
        <View style={{ width: RYTHME.fondu }}>
          <LinearGradient colors={["transparent", "black"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill} />
          <Reanime.View style={[StyleSheet.absoluteFill, s.plein, styleTete]} />
        </View>
      ) : null}
      <View style={[s.plein, { flex: 1 }]} />
      <LinearGradient colors={["black", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ width: RYTHME.fondu }} />
    </View>
  );
}

const s = StyleSheet.create({
  efface: { opacity: 0 },
  mesure: { position: "absolute", left: 0, top: 0, width: 10000, flexDirection: "row", opacity: 0 },
  ruban: { position: "absolute", left: 0, top: 0, flexDirection: "row" },
  rogne: { overflow: "hidden" },
  masque: { flex: 1, flexDirection: "row" },
  plein: { backgroundColor: "black" },
});
