// Retour haptique de l'app — trois gestes, utilisés partout :
// tick (sélection : chips, segments, points de carrousel), cran
// (curseur de graphe qui change d'année) et succès (Appliquer).
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const ios = Platform.OS === "ios";

// Tick léger de sélection
export function tick() {
  if (ios) Haptics.selectionAsync().catch(() => {});
}

// Crantage du curseur tactile — plus net qu'un tick de sélection
export function cran() {
  if (ios) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// Confirmation (Appliquer les filtres)
export function succes() {
  if (ios) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
