// Marge basse à réserver sous un contenu défilant.
//
// Elle ne vaut pas la même chose selon l'écran : dans un onglet, il faut
// dégager la barre d'onglets (qui embarque déjà la marge système) ; sur un
// écran empilé, il n'y a que l'indicateur d'accueil ou la barre de navigation
// gestuelle. Une valeur figée — 40 ou 44 dans les écrans jusqu'ici — laissait
// les dernières lignes sous la barre d'onglets sur tous les appareils.
//
// BottomTabBarHeightContext plutôt que useBottomTabBarHeight : le hook lève
// une exception hors d'un navigateur d'onglets, le contexte rend simplement
// undefined. Les écrans restent réutilisables des deux côtés.
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * @param respiration Espace visuel souhaité EN PLUS de la zone système.
 */
export function useMargeBas(respiration = 24): number {
  const hauteurOnglets = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  return (hauteurOnglets ?? insets.bottom) + respiration;
}
