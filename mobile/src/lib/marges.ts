// Marge basse à réserver sous un contenu défilant.
//
// Elle ne vaut pas la même chose selon l'écran : sous la barre d'onglets, il
// faut dégager la barre ENTIÈRE ; sur un écran empilé, seule la zone système
// compte (indicateur d'accueil, barre gestuelle). Les écrans posaient jusqu'ici
// une valeur figée — 40 ou 44 — qui laissait les dernières lignes sous la
// barre d'onglets sur tous les appareils.
//
// Le drapeau est explicite plutôt que déduit d'un contexte de navigation :
// BottomTabBarHeightContext viendrait de @react-navigation/bottom-tabs, que ce
// projet ne déclare pas (il arrive par expo-router). Un second exemplaire
// installé un jour dans l'arbre donnerait un contexte différent de celui du
// navigateur, donc undefined, et la marge redeviendrait silencieusement fausse.
// Ici, seuls trois écrans vivent sous les onglets : autant l'écrire.
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Hauteur du contenu de la barre d'onglets, hors marge système. */
// Barre ancrée en verre : ~7 pt de haut + capsule 29 + libellé ≈ 52 pt hors
// zone sûre — 60 laisse la respiration au-dessus du contenu
export const HAUTEUR_ONGLETS = 60;

export function useMargeBas({ sousOnglets = false, respiration = 24 }: {
  /** L'écran est-il l'un des trois onglets ? (la barre le recouvre) */
  sousOnglets?: boolean;
  /** Espace visuel souhaité EN PLUS des zones réservées. */
  respiration?: number;
} = {}): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + (sousOnglets ? HAUTEUR_ONGLETS : 0) + respiration;
}

/**
 * Plafond de largeur du contenu sur grand écran.
 *
 * Une colonne de texte ou une carte de 1 000 pt de large ne se lit pas : la
 * ligne devient trop longue pour l'œil et les courbes s'aplatissent. Au-delà
 * de 700 pt, le contenu se plafonne à 680 et se centre — la valeur employée
 * par tous les écrans de l'app.
 */
export function useCap() {
  const { width } = useWindowDimensions();
  return width >= 700
    ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const }
    : null;
}
