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
// SUR ANDROID, le document s'ouvre dans la visionneuse du téléphone — le
// lecteur PDF de Google Drive, Fichiers… —, comme une pièce jointe de Gmail.
// Le navigateur, qui ne connaît pas non plus les identifiants de la
// plateforme, n'y affichait qu'un refus : l'app télécharge donc elle-même le
// fichier, en portant les en-têtes de l'API, dans son cache, puis le confie
// au système par une adresse content:// que la visionneuse a le droit de
// lire. Un toast d'Android dit que l'ouverture est en cours.
import { Directory, File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, ToastAndroid, View } from "react-native";
import { WebView } from "react-native-webview";
import { ENTETES } from "@/lib/api";
import { creerStyles } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { ECHELLE, POLICE, T } from "@/theme";

type Document = { url: string; titre: string };

/** `ouvrir(url, titre)` montre le document ; `element` se pose dans la fiche. */
export function useVisionneuse() {
  const [doc, setDoc] = useState<Document | null>(null);
  // Android : un seul téléchargement à la fois — deux touchers n'ouvrent pas
  // deux fois le même document
  const enCours = useRef(false);
  const ouvrir = useCallback((url: string, titre?: string | null) => {
    if (IOS) { setDoc({ url, titre: titre || "Document" }); return; }
    if (enCours.current) return;
    enCours.current = true;
    ouvrirDansLeTelephone(url).finally(() => { enCours.current = false; });
  }, []);
  const element = doc ? <Visionneuse doc={doc} onClose={() => setDoc(null)} /> : null;
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

async function ouvrirDansLeTelephone(url: string) {
  ToastAndroid.show("Ouverture du document…", ToastAndroid.SHORT);
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
  const [erreur, setErreur] = useState(false);
  return (
    // pageSheet : la feuille d'iOS ; le glissement vers le bas la referme et
    // appelle onRequestClose
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.page}>
        {/* La barre de la feuille : « OK » à gauche, le nom au centre */}
        <View style={s.barre}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button"
            style={({ pressed }) => [s.cote, pressed && { opacity: 0.4 }]}>
            <Text style={s.ok} maxFontSizeMultiplier={ECHELLE.compact}>OK</Text>
          </Pressable>
          <Text style={s.titre} numberOfLines={1} accessibilityRole="header" maxFontSizeMultiplier={ECHELLE.compact}>
            {doc.titre}
          </Text>
          <View style={s.cote} />
        </View>
        {erreur ? (
          <View style={s.centre}>
            <Text style={s.erreurTitre}>Document indisponible</Text>
            <Text style={s.erreurTexte}>Le fichier n'a pas pu être chargé. Vérifiez la connexion et réessayez.</Text>
          </View>
        ) : (
          <WebView
            source={{ uri: doc.url, headers: ENTETES }}
            style={s.vue}
            startInLoadingState
            renderLoading={() => (
              <View style={[StyleSheet.absoluteFill, s.centre]}><ActivityIndicator color={T.gris as any} /></View>
            )}
            onError={() => setErreur(true)}
            onHttpError={() => setErreur(true)}
            // Un document : ni pincement bridé, ni ouverture de liens ailleurs
            allowsInlineMediaPlayback
            originWhitelist={["*"]}
          />
        )}
      </View>
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
  ok: { fontSize: 17, fontFamily: POLICE.gras, color: T.bleu },
  titre: { flex: 1, textAlign: "center", fontSize: 17, fontFamily: POLICE.demi, color: T.encre },
  vue: { flex: 1, backgroundColor: T.fond },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 6 },
  erreurTitre: { fontSize: 17, fontFamily: POLICE.demi, color: T.encre },
  erreurTexte: { fontSize: 14, lineHeight: 20, fontFamily: POLICE.normal, color: T.gris, textAlign: "center" },
}));
