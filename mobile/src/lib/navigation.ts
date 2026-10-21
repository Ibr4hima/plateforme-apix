// Les options des piles de navigation — la barre du système sur iOS.
//
// SUR iOS, CHAQUE ÉCRAN A LA BARRE DE NAVIGATION D'UIKit :
//   · aux RACINES des onglets, le grand titre (34 pt) qui se replie en titre
//     en ligne au défilement. La barre y est TRANSLUCIDE : le contenu passe
//     dessous — c'est là qu'iOS 26 pose son verre — et la liste de l'écran
//     règle ses marges d'elle-même (contentInsetAdjustmentBehavior) ;
//   · sur les écrans EMPILÉS, le titre en ligne, le chevron de retour seul
//     (« minimal » : le titre de l'écran précédent n'est pas toujours celui
//     qu'on croit — l'accueil n'a pas de barre) et le balayage depuis le bord.
//     La barre y est OPAQUE, à la couleur de la page : ces écrans posent sous
//     elle des segments fixes, que le contenu ne doit pas recouvrir — d'où
//     headerTransparent: false, qui empêche native-stack de la rendre
//     translucide dès qu'un champ de recherche s'y loge.
// Les titres sont en Google Sans, la police de l'app sur les deux systèmes :
// demi-gras pour le titre en ligne, gras pour le grand titre — les graisses
// qu'iOS donne à ses propres titres.
//
// SUR ANDROID, rien ne change : les écrans dessinent leur bandeau bleu, la
// barre du système reste cachée.
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { useCouleur } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { POLICE, T } from "@/theme";

/** Les options communes de la pile principale. */
export function useOptionsPile(): NativeStackNavigationOptions {
  const bleu = useCouleur(T.bleu) as unknown as string;
  const fond = useCouleur(T.fond) as unknown as string;
  const heroFond = useCouleur(T.heroFond) as unknown as string;
  return useMemo(() => (IOS ? {
    headerBackButtonDisplayMode: "minimal",
    headerTintColor: bleu,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: fond },
    headerTitleStyle: { fontFamily: POLICE.demi },
    contentStyle: { backgroundColor: T.fond as unknown as string },
  } : {
    headerStyle: { backgroundColor: heroFond },
    headerTintColor: "#fff",
    headerTitleStyle: { fontFamily: POLICE.gras },
    headerBackTitleStyle: { fontFamily: POLICE.moyen },
    contentStyle: { backgroundColor: T.fond as unknown as string },
  }), [bleu, fond, heroFond]);
}

/** Un écran empilé : la barre du système sur iOS (son titre est posé dès la
    transition, avant même que l'écran se dessine), aucune sur Android. */
export const ecranEmpile = (titre: string): NativeStackNavigationOptions =>
  IOS ? { headerShown: true, title: titre, headerTransparent: false } : { headerShown: false };

/** La racine d'un onglet : le grand titre d'iOS, qui se replie au défilement. */
export function useOptionsRacineOnglet(titre: string): NativeStackNavigationOptions {
  const bleu = useCouleur(T.bleu) as unknown as string;
  return useMemo(() => (IOS ? {
    headerShown: true,
    title: titre,
    headerLargeTitleEnabled: true,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerTintColor: bleu,
    headerTitleStyle: { fontFamily: POLICE.demi },
    headerLargeTitleStyle: { fontFamily: POLICE.gras },
    contentStyle: { backgroundColor: T.fond as unknown as string },
  } : {
    headerShown: false,
    contentStyle: { backgroundColor: T.fond as unknown as string },
  }), [titre, bleu]);
}
