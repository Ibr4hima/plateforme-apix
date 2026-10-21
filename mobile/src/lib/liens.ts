// Ouvrir une page web depuis l'app, sans la quitter (expo-web-browser).
//
// Sur iOS, dans Safari INTÉGRÉ à l'app (SFSafariViewController) : « OK » y
// ramène, à la teinte de l'app. Sur Android, dans un onglet Chrome
// personnalisé (Custom Tabs) : la barre aux couleurs de la page de l'app, le
// titre du site, la flèche retour ramène à la fiche — l'onglet vit dans la
// tâche de l'app, pas dans une fenêtre à part des applications récentes.
// Sans navigateur compatible, le lien part vers le navigateur par défaut.
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
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
