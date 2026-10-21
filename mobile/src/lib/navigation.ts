// Les options des piles de navigation — chaque onglet a la sienne.
//
// TOUS LES ÉCRANS VIVENT DANS LA PILE DE LEUR ONGLET : la barre d'onglets
// reste donc visible partout, et l'on passe d'un onglet à l'autre sans
// perdre où l'on était dans chacun.
//
// SUR LES DEUX SYSTÈMES, LA BARRE DU SYSTÈME : celle d'UIKit sur iOS, la
// barre d'application de Material (la Toolbar d'Android) sur Android. Un
// TITRE CENTRÉ, du même corps sur tous les écrans, dans une barre OPAQUE à la
// couleur du fond, qui reste fixe en haut — le contenu défile dessous sans
// jamais la traverser.
//   · iOS — le chevron de retour seul (« minimal » : le titre de l'écran
//     précédent n'est pas toujours celui qu'on croit) et le balayage depuis le
//     bord ; le titre en Google Sans demi-gras, la graisse qu'iOS donne aux
//     siens.
//   · Android — la flèche de retour du système et son geste ; le titre en
//     Google Sans régulier, 22 sp, celui des barres de Material 3 ; la
//     transition d'Android 14 (fondu et glissé court), que react-native-screens
//     reproduit par défaut.
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { useCouleur } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { POLICE, T } from "@/theme";

/** Les options communes d'une pile d'onglet. */
export function useOptionsPile(): NativeStackNavigationOptions {
  const fond = useCouleur(T.fond) as unknown as string;
  const encre = useCouleur(T.encre) as unknown as string;
  return useMemo(() => ({
    headerBackButtonDisplayMode: "minimal",
    // Le retour et les boutons de la barre à l'ENCRE (noir le jour, blanc la
    // nuit) — la teinte d'iOS 26, et celle des icônes d'une barre Material
    headerTintColor: encre,
    headerShadowVisible: false,
    headerTransparent: false,
    headerLargeTitleEnabled: false,
    // Le titre au CENTRE, sur tous les écrans : la place que lui donne UIKit
    // pour un titre en ligne, et la barre « centrée » de Material 3
    headerTitleAlign: "center",
    headerStyle: { backgroundColor: fond },
    headerTitleStyle: IOS
      ? { fontFamily: POLICE.demi, color: encre }
      : { fontFamily: POLICE.normal, fontSize: 22, color: encre },
    contentStyle: { backgroundColor: IOS ? (T.fond as unknown as string) : fond },
  }), [fond, encre]);
}

/** Un écran de la pile : la barre du système et son titre, posés dès la
    transition, avant même que l'écran se dessine. */
export const ecran = (titre: string): NativeStackNavigationOptions =>
  ({ headerShown: true, title: titre });

/** La route d'un module ouvert DEPUIS L'ACCUEIL. Les deux modules qui ont
    leur onglet (Investissements, Économie) s'empilent sur l'Accueil au lieu
    de basculer d'onglet : la page ouverte a son retour, comme toutes les
    autres — le chevron d'iOS, la flèche d'Android. */
export function routeDepuisAccueil(href: string): string {
  if (href === "/investissements") return "/ide";
  if (href === "/flux") return "/economie";
  return href;
}
