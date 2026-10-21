// Le menu contextuel d'iOS — l'appui long sur une carte.
//
// Sur iOS, un appui long sur un élément de liste soulève la carte et ouvre le
// menu du SYSTÈME (UIContextMenuInteraction, par @react-native-menu/menu) :
// les gestes qu'on attend d'un objet — voir sa fiche, le partager, copier son
// nom, appeler, écrire, ouvrir son site. Un numéro ou une adresse parmi
// plusieurs se choisit dans un sous-menu. Le toucher simple, lui, ouvre
// toujours la fiche : le menu ne retire rien, il raccourcit.
//
// Android garde pour l'heure ses cartes telles quelles ; son propre menu
// viendra avec l'étape Android.
//
// Les liens web s'ouvrent dans Safari INTÉGRÉ à l'app (SFSafariViewController,
// par expo-web-browser) : on lit le site sans quitter l'app, « OK » y ramène.
import { MenuView, type MenuAction } from "@react-native-menu/menu";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { Linking, Share } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";
import { estSombreCourant, resoudre } from "@/lib/apparence";
import { succes } from "@/lib/haptique";
import { IOS } from "@/lib/plateforme";
import { fmtPhone } from "@/lib/telephone";
import { T } from "@/theme";

export type ActionMenu = {
  id: string; titre: string; sf: SFSymbol; sousTitre?: string;
  /** Un sous-menu : l'action ouvre ses choix au lieu d'agir. */
  sous?: ActionMenu[];
  onPress?: () => void;
};

type Absente = null | false | undefined;

export function MenuContextuel({ actions, titre, children }: {
  actions: (ActionMenu | Absente)[]; titre?: string; children: React.ReactNode;
}) {
  const liste = actions.filter(Boolean) as ActionMenu[];
  if (!IOS || !liste.length) return <>{children}</>;
  // Le système rend l'identifiant de l'action choisie, à quelque niveau
  // qu'elle soit : on la retrouve à plat
  const aPlat = (l: ActionMenu[]): ActionMenu[] => l.flatMap(a => (a.sous ? aPlat(a.sous) : [a]));
  const versNatif = (a: ActionMenu): MenuAction => ({
    id: a.id, title: a.titre, subtitle: a.sousTitre, image: a.sf,
    subactions: a.sous?.map(versNatif),
  });
  return (
    <MenuView shouldOpenOnLongPress title={titre} actions={liste.map(versNatif)}
      onPressAction={({ nativeEvent }) => aPlat(liste).find(a => a.id === nativeEvent.event)?.onPress?.()}>
      {children}
    </MenuView>
  );
}

// ── Les actions courantes ────────────────────────────────────────────────────

export const actionFiche = (onPress: () => void): ActionMenu =>
  ({ id: "fiche", titre: "Voir la fiche", sf: "doc.text", onPress });

/** Partager un texte — la feuille de partage d'iOS (Messages, Mail, WhatsApp…). */
export const actionPartager = (message: string): ActionMenu =>
  ({ id: "partager", titre: "Partager…", sf: "square.and.arrow.up", onPress: () => { Share.share({ message }).catch(() => {}); } });

export const actionCopier = (texte: string | null | undefined, titre = "Copier le nom"): ActionMenu | null =>
  texte ? {
    id: "copier", titre, sf: "doc.on.doc",
    onPress: () => { Clipboard.setStringAsync(texte).then(() => succes()).catch(() => {}); },
  } : null;

/** Appeler : un seul numéro agit d'emblée, plusieurs s'offrent en sous-menu. */
export function actionAppeler(numeros: string[]): ActionMenu | null {
  const liste = numeros.map(n => n.trim()).filter(Boolean);
  if (!liste.length) return null;
  const appel = (n: string, i: number): ActionMenu => ({
    id: `appeler-${i}`, titre: liste.length > 1 ? fmtPhone(n) : "Appeler", sf: "phone",
    sousTitre: liste.length > 1 ? undefined : fmtPhone(n),
    onPress: () => { Linking.openURL(`tel:${n.replace(/[^\d+]/g, "")}`).catch(() => {}); },
  });
  return liste.length === 1 ? appel(liste[0], 0) : { id: "appeler", titre: "Appeler", sf: "phone", sous: liste.map(appel) };
}

/** Écrire : une adresse agit d'emblée, plusieurs s'offrent en sous-menu. */
export function actionEcrire(adresses: string[]): ActionMenu | null {
  const liste = adresses.map(m => m.trim()).filter(Boolean);
  if (!liste.length) return null;
  const mail = (m: string, i: number): ActionMenu => ({
    id: `ecrire-${i}`, titre: liste.length > 1 ? m : "Envoyer un e-mail", sf: "envelope",
    sousTitre: liste.length > 1 ? undefined : m,
    onPress: () => { Linking.openURL(`mailto:${m}`).catch(() => {}); },
  });
  return liste.length === 1 ? mail(liste[0], 0) : { id: "ecrire", titre: "Envoyer un e-mail", sf: "envelope", sous: liste.map(mail) };
}

export const actionSite = (url: string | null | undefined): ActionMenu | null =>
  url ? { id: "site", titre: "Ouvrir le site", sf: "safari", sousTitre: domaine(url), onPress: () => ouvrirLien(url) } : null;

/** « www.exemple.sn » d'une adresse complète — pour la légende d'une action. */
export function domaine(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
}

/** Ouvre une page web : dans Safari intégré à l'app sur iOS — on ne quitte
    pas l'app —, dans le navigateur ailleurs. */
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
