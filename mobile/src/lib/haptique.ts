// Retour haptique de l'app — trois gestes, utilisés partout : tick
// (sélection : chips, segments, points de carrousel), cran (curseur de graphe
// qui change d'année) et succès (Appliquer).
//
// Les deux plateformes ont chacune leur moteur, et il ne s'appelle pas pareil.
// `selectionAsync` / `impactAsync` / `notificationAsync` sont des API UIKit :
// sur Android, expo-haptics les simule avec `Vibrator`, ce que Google
// déconseille explicitement (bourdonnement grossier, et permission VIBRATE
// requise). Android a ses propres constantes haptiques, servies ici par
// `performAndroidHapticsAsync` : vrai moteur haptique, aucune permission.
// On appelle donc l'API native de chaque système plutôt qu'une émulation.
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const ios = Platform.OS === "ios";
const android = Platform.OS === "android";

// Un échec haptique ne doit jamais remonter : appareil sans moteur, économie
// d'énergie, retour désactivé dans les réglages…
const sansBruit = (p: Promise<void>) => { p.catch(() => {}); };

/** Tick léger de sélection — passage d'un choix discret à un autre. */
export function tick() {
  if (ios) sansBruit(Haptics.selectionAsync());
  // Segment_Tick : « switching between a series of potential choices » —
  // la définition même d'une chip ou d'un segment.
  else if (android) sansBruit(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick));
}

/** Crantage d'un curseur qui défile — répété vite, doit rester discret. */
export function cran() {
  if (ios) sansBruit(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  // Segment_Frequent_Tick est prévu pour l'enchaînement rapide (« minutes sur
  // un cadran ») : volontairement très doux, pour ne pas devenir désagréable
  // quand on balaie vingt années d'un coup de pouce.
  else if (android) sansBruit(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick));
}

/** Confirmation d'une action aboutie (Appliquer les filtres). */
export function succes() {
  if (ios) sansBruit(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  else if (android) sansBruit(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
}
