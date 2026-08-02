// Hiérarchie thématique des fiches — LA version unique.
//
// Secteur pointé bleu, branches sur un rail fin, activités en texte simple :
// la hiérarchie se lit par l'indentation, pas par un code couleur à mémoriser.
// Les fiches Événement et Accord la partagent ; leurs données arrivent sous
// la même forme : secteur → branches → activités.
import { StyleSheet, Text, View } from "react-native";
import { POLICE, T } from "@/theme";

export type ArbreThemes = Record<string, Record<string, string[]>>;

export default function Thematiques({ arbre }: { arbre: ArbreThemes }) {
  const secteurs = Object.entries(arbre);
  if (!secteurs.length) return null;
  return (
    <View style={{ gap: 14 }}>
      {secteurs.map(([sec, branches]) => (
        <View key={sec} style={{ gap: 8 }}>
          <View style={s.secteurLigne}>
            <View style={s.secteurPoint} />
            <Text style={s.secteurTexte}>{sec}</Text>
          </View>
          {Object.entries(branches).map(([bra, acts]) => (
            <View key={bra} style={s.branche}>
              <Text style={s.brancheTexte}>{bra}</Text>
              {acts.length > 0 && (
                <View style={{ gap: 3 }}>
                  {acts.map(act => <Text key={act} style={s.activiteTexte}>{act}</Text>)}
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  secteurLigne: { flexDirection: "row", alignItems: "center", gap: 8 },
  secteurPoint: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.bleu },
  secteurTexte: { flex: 1, fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.1 },
  branche: { marginLeft: 2.5, paddingLeft: 14, borderLeftWidth: 1.5, borderLeftColor: T.filet, gap: 6 },
  brancheTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.texte },
  activiteTexte: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, lineHeight: 18 },
});
