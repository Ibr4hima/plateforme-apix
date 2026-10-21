// Ouvrir une page web depuis l'app.
//
// Sur iOS, dans Safari INTÉGRÉ à l'app (SFSafariViewController, par
// expo-web-browser) : on lit le site sans quitter l'app, « OK » y ramène, à la
// teinte de l'app. Ailleurs, dans le navigateur.
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { estSombreCourant, resoudre } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { T } from "@/theme";

export function ouvrirLien(url: string) {
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  if (!IOS) { Linking.openURL(u).catch(() => {}); return; }
  WebBrowser.openBrowserAsync(u, {
    // La teinte de l'app, dans l'apparence du moment
    controlsColor: resoudre(T.bleu, estSombreCourant()) as string,
    dismissButtonStyle: "done",
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  }).catch(() => { Linking.openURL(u).catch(() => {}); });
}
