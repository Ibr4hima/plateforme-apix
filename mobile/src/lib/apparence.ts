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
import { StyleSheet, useColorScheme, type StyleProp } from "react-native";

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
