// Explorer — l'index des modules, en tuiles.
//
// Une seule teinte : le bleu APIX. La couleur est un accent d'identité, pas
// un code par module — huit couleurs différentes se regardent, une seule se
// lit. Tuile compacte : pastille et titre sur la même ligne, sous-titre
// dessous — deux colonnes, coins continus, contour fin. Les deux entrées
// transverses (Fiche pays, Lois) restent en lignes de liste : ce sont des
// documents, pas des espaces.
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Icone from "@/components/Icone";
import { Apparition, Tapable } from "@/components/ui";
import { tick } from "@/lib/haptique";
import { ESPACE, MODULES, PLUS, POLICE, T, TYPO } from "@/theme";

export default function Explorer() {
  const router = useRouter();
  const ouvrir = (href: string) => { tick(); router.push(href as any); };

  return (
    <View style={s.bloc}>
      <Text style={s.titreSection}>Explorer</Text>

      <View style={s.grille}>
        {MODULES.map((m, i) => (
          <Apparition key={m.cle} index={i} style={s.caseGrille}>
            <Tapable onPress={() => ouvrir(m.href)} echelle={0.96} style={s.tuile}>
              <View style={s.tuileEntete}>
                <View style={s.pastille}>
                  <Icone sf={m.sf} materiel={m.icone} taille={17} couleur="#fff" />
                </View>
                <Text style={s.tuileTitre} numberOfLines={1}>{m.titre}</Text>
              </View>
              <Text style={[s.tuileSous, s.tuileSousDecale]} numberOfLines={1}>{m.sous}</Text>
            </Tapable>
          </Apparition>
        ))}
      </View>

      <View style={s.surfacePlus}>
        {PLUS.map((m, i) => (
          <View key={m.cle}>
            {i > 0 && <View style={s.separateur} />}
            <Tapable onPress={() => ouvrir(m.href)} echelle={0.98} style={s.lignePlus}>
              <View style={s.pastille}>
                <Icone sf={m.sf} materiel={m.icone} taille={17} couleur="#fff" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.ligneTitre} numberOfLines={1}>{m.titre}</Text>
                <Text style={s.tuileSous} numberOfLines={1}>{m.sous}</Text>
              </View>
              <Icone sf="chevron.right" materiel="chevron_right" taille={13} couleur={T.grisClair} poids="semibold" />
            </Tapable>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { marginTop: ESPACE.l, paddingHorizontal: ESPACE.m },
  // Titres de section affirmés — la hiérarchie se voit avant de se lire
  titreSection: { fontSize: 17, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.3, marginBottom: ESPACE.s + 2 },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  // 50 % moins la moitié du gap : deux colonnes exactes quel que soit l'écran
  caseGrille: { flexBasis: "48%", flexGrow: 1 },
  tuile: {
    backgroundColor: T.carte, borderRadius: 16, borderCurve: "continuous",
    paddingHorizontal: 13, paddingVertical: 12,
    borderWidth: 1, borderColor: T.carteBord,
  },
  tuileEntete: { flexDirection: "row", alignItems: "center", gap: 9 },
  // Carré bleu plein, icône blanche — la couleur qui ancre chaque tuile
  pastille: {
    width: 32, height: 32, borderRadius: 10, borderCurve: "continuous",
    alignItems: "center", justifyContent: "center", backgroundColor: T.bleuAction,
  },
  tuileTitre: { flex: 1, minWidth: 0, fontSize: 14, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2 },
  ligneTitre: { fontSize: 14, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2 },
  tuileSous: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  // Dans la tuile, le sous-titre s'aligne sous le titre (pas sous la pastille)
  tuileSousDecale: { marginLeft: 41, marginTop: 4 },
  surfacePlus: {
    marginTop: 10, backgroundColor: T.carte, borderRadius: 16, borderCurve: "continuous",
    overflow: "hidden", borderWidth: 1, borderColor: T.carteBord,
  },
  lignePlus: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 13 },
  separateur: { height: StyleSheet.hairlineWidth, backgroundColor: T.bordure, marginLeft: 55 },
});
