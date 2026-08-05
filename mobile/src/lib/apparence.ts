// Résolution des couleurs dynamiques — le passage du mode sombre.
//
// Les jetons du thème sont des couleurs DYNAMIQUES (DynamicColorIOS) : iOS
// choisit lui-même la variante claire ou sombre, en direct, sans qu'aucun
// composant ne re-rende. C'est le mécanisme le plus fidèle — sauf pour DEUX
// consommateurs qui ne parlent pas au natif :
//
//   · Reanimated valide les couleurs du style de tout composant animé et
//     rejette l'objet dynamique (« Invalid color value: [object Object] ») ;
//   · Skia dessine sur son propre canevas et n'attend que des chaînes CSS.
//
// D'où ce module : il lit la variante qui convient au schéma courant et la
// rend en chaîne simple. On l'applique DANS les composants concernés
// (Tapable, Feuille, curseur, silhouettes) plutôt qu'aux centaines de points
// d'appel — une couleur oubliée redeviendrait invisible ou ferait planter.
import { useMemo } from "react";
import {
  Appearance, Platform, StyleSheet, useColorScheme,
  type ImageStyle, type StyleProp, type TextStyle, type ViewStyle,
} from "react-native";

// ── Android : le schéma courant, lisible hors React ──────────────────────────
//
// DynamicColorIOS n'existe que sur iOS. Sur Android, un jeton garde ses deux
// valeurs et c'est la LECTURE qui tranche (voir le Proxy de T dans theme.ts).
// Cette lecture arrive des centaines de fois par rendu : elle doit être une
// simple variable, jamais un appel au natif.
const ANDROID = Platform.OS === "android";
let sombreSysteme = Appearance.getColorScheme() === "dark";
let forcage: boolean | null = null;
Appearance.addChangeListener(({ colorScheme }) => { sombreSysteme = colorScheme === "dark"; });

/** Le schéma en vigueur — la préférence de l'app, sinon celle du système. */
export const estSombreCourant = (): boolean => forcage ?? sombreSysteme;

/**
 * Recale le cache sur ce que React voit.
 *
 * Appelé au rendu de la racine, AVANT celui des enfants : on ne dépend plus
 * de l'ordre dans lequel les abonnés d'Appearance sont notifiés, qui pourrait
 * laisser un arbre se redessiner avec le schéma précédent.
 */
export const majSchema = (sombre: boolean) => { sombreSysteme = sombre; };

/** Bascule l'apparence de l'app (et tient le cache ci-dessus à jour). */
export function appliquerSchema(sombre: boolean | null) {
  Appearance.setColorScheme(sombre == null ? null : sombre ? "dark" : "light");
  if (sombre != null) sombreSysteme = sombre;
}

/**
 * Une feuille de style qui suit l'apparence.
 *
 * Sur iOS : rien ne change — les jetons dynamiques descendent au natif tels
 * quels et la feuille reste construite une seule fois.
 *
 * Sur Android : la fabrique est appelée DEUX fois, une fois chaque schéma
 * forcé, et l'objet rendu expose chaque style en accesseur — le rendu lit
 * donc toujours la bonne variante. Il fallait passer par une fabrique : un
 * StyleSheet.create ordinaire fige ses couleurs à l'import du module, bien
 * avant que l'apparence puisse changer, et RN gèle même l'objet en dev.
 */
/**
 * Le cadrage vertical du texte sur Android.
 *
 * Android réserve autour de chaque ligne la place des jambages les plus
 * extrêmes de la fonte (includeFontPadding), qu'ils servent ou non. Dans une
 * pilule, un badge ou une puce d'année — un gabarit court, calé au pixel —
 * ce coussin décentre le texte : il flotte haut, ou bas, jamais au milieu.
 * iOS ne connaît pas ce réglage : le désactiver, c'est le rejoindre.
 *
 * Appliqué à tout style qui porte du texte, plutôt qu'aux centaines de
 * feuilles une à une — un oubli se serait vu, et pas au bon endroit.
 */
const cadrer = (styles: any) => {
  for (const cle of Object.keys(styles)) {
    const st = styles[cle];
    const porteDuTexte = st && (st.fontSize != null || st.fontFamily != null
      || st.lineHeight != null || st.color != null || st.textAlign != null);
    if (porteDuTexte && st.includeFontPadding == null) {
      styles[cle] = { ...st, includeFontPadding: false };
    }
  }
  return styles;
};

type Styles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };
export function creerStyles<S extends Styles<S> | Styles<any>>(
  fabrique: () => S & Styles<any>,
): S {
  if (!ANDROID) return StyleSheet.create(fabrique());
  forcage = false; const clair: any = StyleSheet.create(cadrer(fabrique()));
  forcage = true;  const sombre: any = StyleSheet.create(cadrer(fabrique()));
  forcage = null;
  const feuille = {} as S;
  for (const cle of Object.keys(clair)) {
    Object.defineProperty(feuille, cle, {
      enumerable: true,
      get: () => (estSombreCourant() ? sombre[cle] : clair[cle]),
    });
  }
  return feuille;
}

/** Un jeton dynamique se reconnaît à sa forme : { dynamic: { light, dark } }. */
export const estDynamique = (c: any): boolean =>
  !!c && typeof c === "object" && "dynamic" in c && c.dynamic != null;

/** La variante qui convient au schéma courant, en chaîne simple. */
export const resoudre = (c: any, sombre: boolean): any =>
  estDynamique(c) ? (sombre ? c.dynamic.dark : c.dynamic.light) : c;

/** Vrai quand le système (ou la préférence de l'app) est en sombre. */
export function useSombre(): boolean {
  return useColorScheme() === "dark";
}

/** La couleur d'un jeton, résolue pour le schéma courant. */
export function useCouleur<C>(couleur: C): C {
  const sombre = useSombre();
  return useMemo(() => resoudre(couleur, sombre), [couleur, sombre]);
}

// Toutes les propriétés de style qui portent une couleur — la liste doit
// rester exhaustive : une clé oubliée laisse passer un objet vers Reanimated.
const CLES = [
  "color", "backgroundColor", "borderColor", "borderTopColor", "borderBottomColor",
  "borderLeftColor", "borderRightColor", "borderStartColor", "borderEndColor",
  "shadowColor", "textDecorationColor", "textShadowColor", "tintColor", "overlayColor",
] as const;

/** Le style, aplati, dont chaque couleur dynamique est rendue en chaîne. */
export function resoudreStyle(style: StyleProp<any>, sombre: boolean): any {
  if (!style) return style;
  const plat: any = StyleSheet.flatten(style);
  if (!plat) return style;
  let copie: any = null;
  for (const k of CLES) {
    if (estDynamique(plat[k])) {
      copie = copie || { ...plat };
      copie[k] = resoudre(plat[k], sombre);
    }
  }
  return copie || plat;
}

/** Version hook : mémorisée sur le style et le schéma (vues ET textes). */
export function useStyleResolu(style: StyleProp<any>): any {
  const sombre = useSombre();
  return useMemo(() => resoudreStyle(style, sombre), [style, sombre]);
}

/**
 * Le style de la barre d'état quand la page reprend son fond ordinaire.
 *
 * Les écrans posent « light » tant que leur bandeau bleu a le focus, puis
 * rendent la main en quittant. « dark » (glyphes noirs) convient au fond clair
 * mais disparaîtrait sur le fond de nuit : la valeur suit donc l'apparence.
 */
export function useStyleBarreParDefaut(): "light" | "dark" {
  return useSombre() ? "light" : "dark";
}
