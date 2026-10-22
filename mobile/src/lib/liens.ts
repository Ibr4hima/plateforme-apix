// Ouvrir une page web depuis l'app, sans la quitter (expo-web-browser).
//
// Sur iOS, dans Safari INTÉGRÉ à l'app (SFSafariViewController) : « OK » y
// ramène, à la teinte de l'app. Sur Android, dans un onglet Chrome
// personnalisé (Custom Tabs) : la barre aux couleurs de la page de l'app, le
// titre du site, la flèche retour ramène à la fiche — l'onglet vit dans la
// tâche de l'app, pas dans une fenêtre à part des applications récentes.
// Sans navigateur compatible, le lien part vers le navigateur par défaut.
import * as WebBrowser from "expo-web-browser";
import { ActionSheetIOS, Alert, Linking } from "react-native";
import { estSombreCourant, resoudre } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { T } from "@/theme";

export function ouvrirLien(url: string) {
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const sombre = estSombreCourant();
  WebBrowser.openBrowserAsync(u, IOS ? {
    // La teinte de l'app, dans l'apparence du moment
    controlsColor: resoudre(T.bleu, sombre) as string,
    dismissButtonStyle: "done",
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  } : {
    toolbarColor: resoudre(T.fond, sombre) as string,
    secondaryToolbarColor: resoudre(T.fond, sombre) as string,
    showTitle: true,
    createTask: false,
  }).catch(() => { Linking.openURL(u).catch(() => {}); });
}

/** Écrire à une adresse. */
export const ouvrirMail = (m: string) => Linking.openURL(`mailto:${m.trim()}`).catch(() => {});

/** À plusieurs numéros ou adresses, on PROPOSE au lieu de choisir à la place
    de l'utilisateur : feuille d'action native sur iOS, alerte à boutons
    ailleurs. Un seul : il agit tout de suite. */
export function proposer(titre: string, libelles: string[], agir: (index: number) => void) {
  if (libelles.length === 1) { agir(0); return; }
  if (IOS) {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: titre, options: [...libelles, "Annuler"], cancelButtonIndex: libelles.length },
      i => { if (i < libelles.length) agir(i); },
    );
  } else {
    Alert.alert(titre, undefined, [
      ...libelles.map((l, i) => ({ text: l, onPress: () => agir(i) })),
      { text: "Annuler", style: "cancel" as const },
    ]);
  }
}
