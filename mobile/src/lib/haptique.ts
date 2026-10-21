// Retour haptique de l'app — trois gestes, utilisés partout : tick
// (sélection : chips, segments, points de carrousel), cran (curseur de graphe
// qui change d'année) et succès (Appliquer).
//
// SUR iOS, AUCUNE VIBRATION AU TOUCHER : les contrôles d'iOS — boutons,
// cellules, segments, pastilles — ne vibrent pas quand on les touche, et
// l'app ne le fait pas non plus. Les trois gestes ne jouent que sur Android.
//
// Android a ses propres constantes haptiques, servies par
// `performAndroidHapticsAsync` : vrai moteur haptique, aucune permission —
// et non les API UIKit d'expo-haptics, qu'Android simulerait avec
// `Vibrator` (bourdonnement grossier, permission VIBRATE requise).
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const android = Platform.OS === "android";

// ⚠ Le choix de la constante Android n'est PAS libre.
//
// Deux contraintes se combinent :
//   1. Les constantes de HapticFeedbackConstants sont apparues par vagues.
//      SEGMENT_TICK et SEGMENT_FREQUENT_TICK exigent Android 14 (API 34),
//      CONFIRM exige l'API 30. En demander une absente fait lever au natif
//      « A haptics engine is not available on this device » — message
//      trompeur : le moteur va bien, c'est la constante qui n'existe pas.
//   2. performAndroidHapticsAsync d'expo-haptics 15.0.8 appelle le natif
//      SANS `await` ni `return` : la promesse rejetée devient orpheline et
//      AUCUN .catch() de l'appelant ne peut l'intercepter. L'erreur remonte
//      en « Uncaught (in promise) » et pollue la console à chaque toucher.
//
// Conséquence : on ne peut pas tenter puis rattraper. Il faut ne demander
// que des constantes certaines, d'où la sélection par niveau d'API ci-dessous
// (Platform.Version vaut le niveau d'API sur Android).
const API = android ? Number(Platform.Version) : 0;
const A = Haptics.AndroidHaptics;

// Un échec haptique ne doit jamais remonter : appareil sans moteur, économie
// d'énergie, retour désactivé dans les réglages…
const sansBruit = (p: Promise<void>) => { p.catch(() => {}); };

/** Tick léger de sélection — passage d'un choix discret à un autre. */
export function tick() {
  // Segment_Tick est le geste exact (« switching between a series of potential
  // choices ») mais n'existe qu'à partir d'Android 14 ; Context_Click est son
  // équivalent le plus proche parmi les constantes de toujours.
  if (android) sansBruit(Haptics.performAndroidHapticsAsync(API >= 34 ? A.Segment_Tick : A.Context_Click));
}

/** Crantage d'un curseur qui défile — répété vite, doit rester discret. */
export function cran() {
  // Segment_Frequent_Tick est taillé pour l'enchaînement rapide, mais Android
  // 14 également. En dessous, Clock_Tick — littéralement le cran d'un cadran,
  // le plus léger des retours disponibles, donc supportable en rafale.
  if (android) sansBruit(Haptics.performAndroidHapticsAsync(API >= 34 ? A.Segment_Frequent_Tick : A.Clock_Tick));
}

/** Confirmation d'une action aboutie (Appliquer les filtres). */
export function succes() {
  // Confirm demande l'API 30 ; en dessous, Long_Press est le seul retour
  // franchement appuyé garanti — ce qu'on veut pour marquer un aboutissement.
  if (android) sansBruit(Haptics.performAndroidHapticsAsync(API >= 30 ? A.Confirm : A.Long_Press));
}
