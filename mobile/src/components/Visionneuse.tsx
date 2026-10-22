// La visionneuse des documents des fiches — dans l'app, comme Safari ou
// l'aperçu de Mail.
//
// SUR iOS, le document s'ouvre dans une feuille d'iOS (pageSheet) : « OK »
// pour la refermer, ou un glissement vers le bas ; son nom en titre. Il ne
// part plus vers Safari, qui ne connaît pas les identifiants de la plateforme
// (le basic-auth de la démo) : c'est la vue web de l'app qui le charge, en
// portant les en-têtes de l'API, puis l'affiche — un PDF se lit, se zoome,
// défile comme dans Safari.
//
// La feuille est rendue DANS la fiche qui l'ouvre (la fiche est elle-même une
// modale) : une modale ne se présente au-dessus d'une autre que de l'intérieur.
// D'où le crochet : la fiche reçoit `ouvrir` et l'élément à poser dans son
// arbre.
//
// SUR ANDROID AUSSI, LE DOCUMENT SE LIT DANS L'APP — plein écran, à la façon
// de Material : la croix et le nom dans la barre, les pages qui défilent, le
// pincement qui zoome, « 3 / 12 » qui passe en bas. La vue web d'Android ne
// sait pas afficher un PDF : la page de la visionneuse embarque pdf.js
// (components/pdf/pagePdf), qui le dessine. L'app télécharge le fichier en
// portant les en-têtes de l'API, le passe à la page par morceaux, et en
// efface aussitôt la copie. Le document ne quitte jamais l'app : il partait
// jusqu'ici vers la visionneuse du téléphone (Drive, Fichiers), qui offre
// « Partager » — impensable pour les documents des prospects.
//
// Seul un PDF que pdf.js ne sait pas lire se propose, en dernier recours et
// sur demande, à une autre application du téléphone.
import { Directory, File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, ToastAndroid, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import Icone from "@/components/Icone";
import { PAGE_PDF } from "@/components/pdf/pagePdf";
import { ENTETES } from "@/lib/api";
import { creerStyles, useCouleur, useSombre } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { ECHELLE, FONTE, T } from "@/theme";
import { CoucheContexte, useOuvrirCouche } from "@/lib/defilement";
import TexteDefilant from "@/components/TexteDefilant";
import { Bouton } from "@/components/ui";

type Document = { url: string; titre: string };

/** `ouvrir(url, titre)` montre le document ; `element` se pose dans la fiche. */
export function useVisionneuse() {
  const [doc, setDoc] = useState<Document | null>(null);
  const ouvrir = useCallback((url: string, titre?: string | null) => {
    setDoc({ url, titre: titre || "Document" });
  }, []);
  const element = doc
    ? (IOS ? <Visionneuse doc={doc} onClose={() => setDoc(null)} /> : <VisionneuseAndroid doc={doc} onClose={() => setDoc(null)} />)
    : null;
  return { ouvrir, element };
}

// Intent.FLAG_GRANT_READ_URI_PERMISSION : la visionneuse peut lire le fichier
const LECTURE_ACCORDEE = 1;
// Les documents de la plateforme sont des PDF : c'est le type par défaut
// quand le nom du fichier n'en dit rien
const TYPE_PAR_DEFAUT = "application/pdf";

/** Le fichier, dans le cache de l'app. Son nom vient de la réponse de l'API
    (Content-Disposition) ; un fichier déjà téléchargé est remplacé par sa
    version du moment. */
async function telecharger(url: string) {
  const dossier = new Directory(Paths.cache, "documents");
  dossier.create({ idempotent: true, intermediates: true });
  return File.downloadFileAsync(url, dossier, { headers: ENTETES, idempotent: true });
}

/** Les copies des documents ouverts (Android) : effacées — un document de
    prospect ne reste pas sur le téléphone plus longtemps que sa lecture. */
export function effacerCopiesDocuments() {
  if (IOS) return;
  try {
    const dossier = new Directory(Paths.cache, "documents");
    if (dossier.exists) dossier.delete();
  } catch { /* rien à effacer */ }
}

/** Le dernier recours, sur demande : une autre application du téléphone. */
async function ouvrirDansLeTelephone(url: string) {
  ToastAndroid.show("Ouverture du document…", ToastAndroid.SHORT);
  effacerCopiesDocuments();
  const fichier = await telecharger(url).catch(() => null);
  if (!fichier) {
    ToastAndroid.show("Le document n'a pas pu être téléchargé.", ToastAndroid.LONG);
    return;
  }
  const type = fichier.type && !/^(text\/plain|application\/octet-stream)$/.test(fichier.type) ? fichier.type : TYPE_PAR_DEFAUT;
  try {
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: fichier.contentUri, type, flags: LECTURE_ACCORDEE,
    });
  } catch {
    // Aucune application pour ce type : le système propose celles qui
    // savent ouvrir un fichier quelconque
    try {
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: fichier.contentUri, type: "*/*", flags: LECTURE_ACCORDEE,
      });
    } catch {
      ToastAndroid.show("Aucune application ne sait ouvrir ce document.", ToastAndroid.LONG);
    }
  }
}

function Visionneuse({ doc, onClose }: { doc: Document; onClose: () => void }) {
  // L'échec dit sa nature : un document retiré de la plateforme (404) n'est
  // pas un réseau absent — et ce dernier se réessaie d'un toucher
  const [erreur, setErreur] = useState<null | "absent" | "reseau">(null);
  const [essai, setEssai] = useState(0);
  // Le document recouvre l'écran : ses titres cessent de défiler
  const couche = useOuvrirCouche();
  return (
    // pageSheet : la feuille d'iOS ; le glissement vers le bas la referme et
    // appelle onRequestClose
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <CoucheContexte.Provider value={couche}>
      <View style={s.page}>
        {/* La barre de la feuille : « OK » à gauche, le nom au centre */}
        <View style={s.barre}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button"
            style={({ pressed }) => [s.cote, pressed && { opacity: 0.4 }]}>
            <Text style={s.ok} maxFontSizeMultiplier={ECHELLE.compact}>OK</Text>
          </Pressable>
          <TexteDefilant style={s.titre} accessibilityRole="header" maxFontSizeMultiplier={ECHELLE.compact}>
            {doc.titre}
          </TexteDefilant>
          <View style={s.cote} />
        </View>
        {erreur ? (
          <View style={s.centre}>
            <Text style={s.erreurTitre}>{erreur === "absent" ? "Document introuvable" : "Document indisponible"}</Text>
            <Text style={s.erreurTexte}>
              {erreur === "absent"
                ? "Ce document n'est plus disponible sur la plateforme."
                : "Le fichier n'a pas pu être chargé. Vérifiez la connexion et réessayez."}
            </Text>
            {erreur === "reseau" ? (
              <Bouton label="Réessayer" variante="secondaire" style={{ marginTop: 10 }}
                onPress={() => { setErreur(null); setEssai(n => n + 1); }} />
            ) : null}
          </View>
        ) : (
          <WebView key={essai}
            source={{ uri: doc.url, headers: ENTETES }}
            style={s.vue}
            startInLoadingState
            renderLoading={() => (
              <View style={[StyleSheet.absoluteFill, s.centre]}><ActivityIndicator color={T.gris as any} /></View>
            )}
            onError={() => setErreur("reseau")}
            onHttpError={e => setErreur(e.nativeEvent.statusCode === 404 || e.nativeEvent.statusCode === 410 ? "absent" : "reseau")}
            // Un document : ni pincement bridé, ni ouverture de liens ailleurs
            allowsInlineMediaPlayback
            originWhitelist={["*"]}
          />
        )}
      </View>
      </CoucheContexte.Provider>
    </Modal>
  );
}

// ── Android : la visionneuse de l'app ───────────────────────────────────────
// Le document passe à la page par morceaux d'un quart de mégaoctet : un seul
// message de plusieurs mégaoctets pèserait sur le pont entre l'app et la vue.
const MORCEAU = 256 * 1024;

type EtatAndroid = "attente" | "lu" | "absent" | "reseau" | "illisible";

function VisionneuseAndroid({ doc, onClose }: { doc: Document; onClose: () => void }) {
  // Le document recouvre l'écran : ses titres cessent de défiler
  const couche = useOuvrirCouche();
  const insets = useSafeAreaInsets();
  const sombre = useSombre();
  const fond = useCouleur(T.fond) as string;
  const [etat, setEtat] = useState<EtatAndroid>("attente");
  const [essai, setEssai] = useState(0);
  const vue = useRef<WebView>(null);
  // Le document (base64) en attente de la page, et la page en attente de lui
  const contenu = useRef<string | null>(null);
  const pagePrete = useRef(false);
  // Les teintes de la page : le fond de l'app, la pastille inversée de Material
  const teintes = useRef({ fond, pastille: "", surPastille: "" });
  teintes.current = {
    fond,
    pastille: sombre ? "rgba(232,234,237,0.92)" : "rgba(32,33,36,0.86)",
    surPastille: sombre ? "#202124" : "#FFFFFF",
  };

  // Quand le document ET la page sont prêts, le document part — une fois
  const envoyer = useCallback(() => {
    const b64 = contenu.current, v = vue.current;
    if (!b64 || !v || !pagePrete.current) return;
    contenu.current = null;
    const n = Math.max(1, Math.ceil(b64.length / MORCEAU));
    v.postMessage(JSON.stringify({ type: "theme", ...teintes.current }));
    v.postMessage(JSON.stringify({ type: "debut", n }));
    for (let i = 0; i < n; i++) {
      v.postMessage(JSON.stringify({ type: "morceau", i, data: b64.slice(i * MORCEAU, (i + 1) * MORCEAU) }));
    }
  }, []);

  useEffect(() => {
    let fini = false;
    let fichier: Awaited<ReturnType<typeof telecharger>> | null = null;
    pagePrete.current = false;
    contenu.current = null;
    setEtat("attente");
    (async () => {
      try {
        effacerCopiesDocuments();
        const telecharge = await telecharger(doc.url);
        fichier = telecharge;
        const b64 = await telecharge.base64();
        if (fini) return;
        contenu.current = b64;
        envoyer();
      } catch (e) {
        if (fini) return;
        // « response has status: 404 » : le document a été retiré
        setEtat(/status: (404|410)\b/.test(String((e as Error)?.message ?? e)) ? "absent" : "reseau");
      } finally {
        // La copie s'efface dès qu'elle est lue : le document ne vit plus que
        // dans la visionneuse, le temps de la lecture
        try { fichier?.delete(); } catch { /* déjà effacée */ }
      }
    })();
    return () => { fini = true; };
  }, [doc.url, essai, envoyer]);

  const surMessage = (e: WebViewMessageEvent) => {
    let m: { type?: string };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === "pret") { pagePrete.current = true; envoyer(); }
    else if (m.type === "premiere") setEtat("lu");
    else if (m.type === "erreur") setEtat("illisible");
  };

  const echec = etat === "absent" || etat === "reseau" || etat === "illisible";
  return (
    // Plein écran, bord à bord : la barre sous la barre d'état, les pages
    // jusqu'au-dessus de la barre de navigation. Le retour du système ferme
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <CoucheContexte.Provider value={couche}>
      <View style={[s.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* La petite barre d'app de Material 3 : la croix, le nom du document */}
        <View style={s.barreAndroid}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer"
            android_ripple={{ color: T.surbrillance as unknown as string, borderless: true, radius: 20 }}
            style={s.fermerAndroid}>
            <Icone sf="xmark" materiel="close" taille={24} couleur={T.encre} />
          </Pressable>
          <TexteDefilant style={s.titreAndroid} accessibilityRole="header" maxFontSizeMultiplier={ECHELLE.compact}>
            {doc.titre}
          </TexteDefilant>
        </View>
        {echec ? (
          <View style={s.centre}>
            <Text style={s.erreurTitre}>
              {etat === "absent" ? "Document introuvable" : etat === "illisible" ? "Lecture impossible" : "Document indisponible"}
            </Text>
            <Text style={s.erreurTexte}>
              {etat === "absent" ? "Ce document n'est plus disponible sur la plateforme."
                : etat === "illisible" ? "Ce document ne peut pas s'afficher dans l'app."
                : "Le fichier n'a pas pu être chargé. Vérifiez la connexion et réessayez."}
            </Text>
            {etat === "reseau" ? (
              <Bouton label="Réessayer" variante="secondaire" style={{ marginTop: 10 }}
                onPress={() => setEssai(n => n + 1)} />
            ) : etat === "illisible" ? (
              <Bouton label="Ouvrir dans une autre application" variante="secondaire" style={{ marginTop: 10 }}
                onPress={() => { onClose(); ouvrirDansLeTelephone(doc.url); }} />
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <WebView key={essai} ref={vue}
              source={{ html: PAGE_PDF }}
              onMessage={surMessage}
              // La page ne navigue nulle part, n'ouvre aucune fenêtre, ne garde
              // rien. Toute adresse passe la liste blanche pour être refusée
              // ICI : hors de la liste, la vue web l'ouvrirait dans le navigateur
              originWhitelist={["*"]}
              onShouldStartLoadWithRequest={r => r.url === "about:blank"}
              setSupportMultipleWindows={false}
              incognito cacheEnabled={false} domStorageEnabled={false}
              // Le pincement de la vue web zoome les pages ; sans ses boutons
              setBuiltInZoomControls setDisplayZoomControls={false}
              // La taille de texte du système n'agrandit pas la page d'un document
              textZoom={100}
              overScrollMode="never"
              // Le rendu d'un document trop lourd peut faire tomber la vue
              onRenderProcessGone={() => setEtat("illisible")}
              style={{ flex: 1, backgroundColor: fond }} />
            {etat === "attente" ? (
              <View style={[StyleSheet.absoluteFill, s.centre, { backgroundColor: fond }]}>
                <ActivityIndicator color={T.accent as unknown as string} />
                <Text style={s.attenteTexte}>Ouverture du document…</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
      </CoucheContexte.Provider>
    </Modal>
  );
}

const s = creerStyles(() => ({
  page: { flex: 1, backgroundColor: T.fond },
  // La barre d'une feuille d'iOS, à sa hauteur : elle respire sous les
  // grands coins de la feuille d'iOS 26 au lieu de s'y coller
  barre: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 60,
    paddingTop: 14, paddingBottom: 10, paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.voileFort, backgroundColor: T.carte,
  },
  cote: { width: 60, paddingVertical: 8 },
  ok: { fontSize: 17, ...FONTE.gras, color: T.bleu },
  titre: { flex: 1, textAlign: "center", fontSize: 17, ...FONTE.demi, color: T.encre },
  vue: { flex: 1, backgroundColor: T.fond },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 6 },
  erreurTitre: { fontSize: 17, ...FONTE.demi, color: T.encre },
  erreurTexte: { fontSize: 14, lineHeight: 20, ...FONTE.normal, color: T.gris, textAlign: "center" },
  // Android : la petite barre d'app de Material 3 — 64 dp, la croix en
  // bouton icône de 48 dp calé sur la marge, le titre en 22 sp
  barreAndroid: { flexDirection: "row", alignItems: "center", gap: 4, height: 64, paddingHorizontal: 4, backgroundColor: T.fond },
  fermerAndroid: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  titreAndroid: { flex: 1, fontSize: 22, ...FONTE.normal, color: T.encre, marginRight: 16 },
  attenteTexte: { fontSize: 14, ...FONTE.normal, color: T.gris, marginTop: 10 },
}));
