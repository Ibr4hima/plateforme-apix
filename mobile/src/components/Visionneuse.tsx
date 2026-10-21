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
// SUR ANDROID, rien ne change : le navigateur du système.
import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { ENTETES } from "@/lib/api";
import { creerStyles } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { ECHELLE, POLICE, T } from "@/theme";

type Document = { url: string; titre: string };

/** `ouvrir(url, titre)` montre le document ; `element` se pose dans la fiche. */
export function useVisionneuse() {
  const [doc, setDoc] = useState<Document | null>(null);
  const ouvrir = useCallback((url: string, titre?: string | null) => {
    if (!IOS) { Linking.openURL(url).catch(() => {}); return; }
    setDoc({ url, titre: titre || "Document" });
  }, []);
  const element = doc ? <Visionneuse doc={doc} onClose={() => setDoc(null)} /> : null;
  return { ouvrir, element };
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
  barre: {
    flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.voileFort, backgroundColor: T.carte,
  },
  cote: { width: 56, paddingVertical: 6 },
  ok: { fontSize: 17, fontFamily: POLICE.gras, color: T.bleu },
  titre: { flex: 1, textAlign: "center", fontSize: 16, fontFamily: POLICE.demi, color: T.encre },
  vue: { flex: 1, backgroundColor: T.fond },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 6 },
  erreurTitre: { fontSize: 17, fontFamily: POLICE.demi, color: T.encre },
  erreurTexte: { fontSize: 14, lineHeight: 20, fontFamily: POLICE.normal, color: T.gris, textAlign: "center" },
}));
