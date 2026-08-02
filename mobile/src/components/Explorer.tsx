// Explorer — l'index des modules, en tuiles.
//
// Deux colonnes de tuiles compactes plutôt que deux longues listes : les huit
// modules tiennent dans un écran, chaque tuile est une grande cible tactile,
// et la grille se balaie d'un seul regard. Les deux entrées transverses
// (Fiche pays, Lois) restent en lignes de liste : ce sont des documents,
// pas des espaces.
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Icone from "@/components/Icone";
import { Apparition, Tapable } from "@/components/ui";
import { tick } from "@/lib/haptique";
import { ESPACE, MODULES, OMBRE, PLUS, POLICE, RAYON, T, TYPO } from "@/theme";

export default function Explorer() {
  const router = useRouter();
  const ouvrir = (href: string) => { tick(); router.push(href as any); };

  return (
    <View style={s.bloc}>
      <Text style={s.titreSection}>EXPLORER</Text>

      <View style={s.grille}>
        {MODULES.map((m, i) => (
          <Apparition key={m.cle} index={i} style={s.caseGrille}>
            <Tapable onPress={() => ouvrir(m.href)} echelle={0.96} style={s.tuile}>
              <View style={s.pastille}>
                <Icone sf={m.sf} materiel={m.icone} taille={19} couleur={T.bleu} />
              </View>
              <Text style={s.tuileTitre} numberOfLines={1}>{m.titre}</Text>
              <Text style={s.tuileSous} numberOfLines={1}>{m.sous}</Text>
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
                <Icone sf={m.sf} materiel={m.icone} taille={19} couleur={T.bleu} />
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
  titreSection: { ...TYPO.micro, color: T.gris, marginBottom: ESPACE.s },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  // 50 % moins la moitié du gap : deux colonnes exactes quel que soit l'écran
  caseGrille: { flexBasis: "48%", flexGrow: 1 },
  tuile: {
    backgroundColor: T.carte, borderRadius: RAYON.moyen,
    paddingHorizontal: 14, paddingVertical: 13, ...OMBRE.n1,
  },
  pastille: {
    width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: T.bleuVoile,
  },
  tuileTitre: { fontSize: 14.5, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2, marginTop: 9 },
  ligneTitre: { fontSize: 14.5, fontFamily: POLICE.demi, color: T.encre, letterSpacing: -0.2 },
  tuileSous: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1.5 },
  surfacePlus: {
    marginTop: 10, backgroundColor: T.carte, borderRadius: RAYON.moyen,
    overflow: "hidden", ...OMBRE.n1,
  },
  lignePlus: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 11, paddingHorizontal: 14 },
  separateur: { height: StyleSheet.hairlineWidth, backgroundColor: T.bordure, marginLeft: 61 },
});
