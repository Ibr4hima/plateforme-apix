// Les options des piles de navigation — chaque onglet a la sienne.
//
// TOUS LES ÉCRANS VIVENT DANS LA PILE DE LEUR ONGLET : la barre d'onglets
// reste donc visible partout, et l'on passe d'un onglet à l'autre sans
// perdre où l'on était dans chacun.
//
// SUR iOS, chaque écran a la barre de navigation d'UIKit, en TITRE EN LIGNE :
// le même corps sur tous les écrans, et une barre OPAQUE, à la couleur du
// fond, qui reste fixe en haut — le contenu défile dessous sans jamais la
// traverser. Les écrans empilés portent le chevron de retour seul
// (« minimal » : le titre de l'écran précédent n'est pas toujours celui qu'on
// croit) et le balayage depuis le bord. Les titres sont en Google Sans
// demi-gras, la graisse qu'iOS donne aux siens.
//
// SUR ANDROID, rien ne change : les écrans dessinent leur bandeau bleu, la
// barre du système reste cachée.
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { useCouleur } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { POLICE, T } from "@/theme";

/** Les options communes d'une pile d'onglet. */
export function useOptionsPile(): NativeStackNavigationOptions {
  const bleu = useCouleur(T.bleu) as unknown as string;
  const fond = useCouleur(T.fond) as unknown as string;
  const encre = useCouleur(T.encre) as unknown as string;
  return useMemo(() => (IOS ? {
    headerBackButtonDisplayMode: "minimal",
    headerTintColor: bleu,
    headerShadowVisible: false,
    headerTransparent: false,
    headerLargeTitleEnabled: false,
    // Le titre au CENTRE, sur tous les écrans : c'est la place que lui donne
    // UIKit pour un titre en ligne (l'option est explicite pour que rien —
    // ni un écran, ni une autre plateforme de rendu — ne le décale)
    headerTitleAlign: "center",
    headerStyle: { backgroundColor: fond },
    headerTitleStyle: { fontFamily: POLICE.demi, color: encre },
    contentStyle: { backgroundColor: T.fond as unknown as string },
  } : {
    headerShown: false,
    contentStyle: { backgroundColor: T.fond as unknown as string },
  }), [bleu, fond, encre]);
}

/** Un écran de la pile : la barre du système et son titre sur iOS (posé dès
    la transition, avant même que l'écran se dessine), aucune sur Android. */
export const ecran = (titre: string): NativeStackNavigationOptions =>
  IOS ? { headerShown: true, title: titre } : { headerShown: false };

/** La route d'un module ouvert DEPUIS L'ACCUEIL. Sur iOS, les deux modules
    qui ont leur onglet (Investissements, Économie) s'empilent sur l'Accueil
    au lieu de basculer d'onglet : la page ouverte a son chevron de retour,
    comme toutes les autres. Android garde la bascule d'onglet (son bandeau
    porte un retour qui ramène à l'accueil). */
export function routeDepuisAccueil(href: string): string {
  if (!IOS) return href;
  if (href === "/investissements") return "/ide";
  if (href === "/flux") return "/economie";
  return href;
}
