// Fiche avantage — réplique du modal AvantageVueModal de la plateforme :
// activité en titre, pilules secteur / branche, Avantages & incitations
// (types sélectionnés avec commentaires), Description, Documents.
import { useQuery } from "@tanstack/react-query";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Symbole from "@/components/Symbole";
import { Feuille } from "@/components/ui";
import { htmlEnTexte } from "@/components/ZoneSheet";
import { API, getJson } from "@/lib/api";
import { POLICE, T } from "@/theme";

function SecTitle({ children }: { children: string }) {
  return <Text style={s.secTitle}>{children.toUpperCase()}</Text>;
}

export default function AvantageSheet({ avantage: a, onClose }: { avantage: any; onClose: () => void }) {
  // Le détail complète la ligne de liste (sélections, description, fichiers)
  const { data: detail } = useQuery({
    queryKey: ["avantage", a.id],
    queryFn: () => getJson<any>(`/opportunites/avantages/${a.id}`).catch(() => null),
  });
  const d = detail || a;
  const selections: any[] = Array.isArray(d.selections) ? d.selections : [];
  const fichiers: any[] = Array.isArray(d.fichiers) ? d.fichiers : [];

  return (
    <Feuille onClose={onClose} titre={d.activite_nom}
      sousEntete={
        <View style={s.pilules}>
          {d.secteur_nom ? <View style={[s.pilule, { backgroundColor: T.bleuVoile }]}><Text style={[s.piluleTexte, { color: T.bleu }]}>{d.secteur_nom}</Text></View> : null}
          {d.branche_nom ? <View style={[s.pilule, { backgroundColor: "rgba(202,99,31,0.08)", flexShrink: 1 }]}><Text style={[s.piluleTexte, { color: T.orange }]} numberOfLines={1}>{d.branche_nom}</Text></View> : null}
        </View>
      }>
          {/* Avantages sélectionnés */}
          {selections.length > 0 ? (
            <View>
              <SecTitle>Avantages & incitations</SecTitle>
              <View style={{ gap: 8 }}>
                {selections.map((sel: any) => (
                  <View key={sel.id} style={s.selection}>
                    <View style={s.selectionLigne}>
                      <View style={s.selectionPoint} />
                      <Text style={s.selectionType}>{sel.type_libelle}</Text>
                    </View>
                    {sel.commentaire ? <Text style={s.selectionCommentaire}>{sel.commentaire}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Description */}
          {d.avantages ? (
            <View>
              <SecTitle>Description</SecTitle>
              <View style={s.description}><Text style={s.descriptionTexte}>{htmlEnTexte(d.avantages)}</Text></View>
            </View>
          ) : null}

          {/* Documents */}
          {fichiers.length > 0 ? (
            <View>
              <SecTitle>{fichiers.length > 1 ? "Documents" : "Document"}</SecTitle>
              <View style={{ gap: 5 }}>
                {fichiers.map((f: any) => (
                  <Pressable key={f.id} onPress={() => Linking.openURL(`${API}/opportunites/avantages/${d.id}/fichiers/${f.id}/download`)}
                    style={({ pressed }) => [s.doc, pressed && { backgroundColor: "rgba(0,79,145,0.09)" }]}>
                    <Symbole nom="description" taille={15} couleur={T.bleu} />
                    <Text style={s.docTexte} numberOfLines={1}>{f.titre || f.fichier_nom}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
    </Feuille>
  );
}

const s = StyleSheet.create({
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  pilule: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5 },
  piluleTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6, marginBottom: 10 },
  selection: { backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  selectionLigne: { flexDirection: "row", alignItems: "center", gap: 7 },
  selectionPoint: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.vert },
  selectionType: { flex: 1, fontSize: 13, fontFamily: POLICE.gras, color: T.vert, lineHeight: 18 },
  selectionCommentaire: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21, marginLeft: 15, marginTop: 6 },
  description: { backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13 },
  descriptionTexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21 },
  doc: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.bleuVoile, borderWidth: 1, borderColor: T.blocBord,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
});
