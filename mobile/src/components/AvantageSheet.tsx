// Fiche avantage — réplique du modal AvantageVueModal de la plateforme :
// activité en titre, pilules secteur / branche, Avantages & incitations
// (types sélectionnés avec commentaires), Description, Documents.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Symbole from "@/components/Symbole";
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
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        <View style={s.entete}>
          <Text style={s.titre}>{d.activite_nom}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>
        <View style={s.pilules}>
          {d.secteur_nom ? <View style={[s.pilule, { backgroundColor: "rgba(0,79,145,0.07)" }]}><Text style={[s.piluleTexte, { color: T.bleu }]}>{d.secteur_nom}</Text></View> : null}
          {d.branche_nom ? <View style={[s.pilule, { backgroundColor: "rgba(202,99,31,0.08)", flexShrink: 1 }]}><Text style={[s.piluleTexte, { color: T.orange }]} numberOfLines={1}>{d.branche_nom}</Text></View> : null}
        </View>

        <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ gap: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
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
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(2,20,38,0.45)" },
  feuille: {
    backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 22, paddingTop: 10, maxHeight: "82%",
  },
  poignee: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: T.bordure, marginBottom: 12 },
  entete: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titre: { flex: 1, fontSize: 19, fontFamily: POLICE.gras, color: T.encre, lineHeight: 25, letterSpacing: -0.3 },
  fermer: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.filet, alignItems: "center", justifyContent: "center" },
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  pilule: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5 },
  piluleTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6, marginBottom: 10 },
  selection: { backgroundColor: "#FAFAF9", borderWidth: 1, borderColor: "#F0EEEC", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  selectionLigne: { flexDirection: "row", alignItems: "center", gap: 7 },
  selectionPoint: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.vert },
  selectionType: { flex: 1, fontSize: 13, fontFamily: POLICE.gras, color: T.vert, lineHeight: 18 },
  selectionCommentaire: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21, marginLeft: 15, marginTop: 6 },
  description: { backgroundColor: "#FAFAF9", borderWidth: 1, borderColor: "#F0EEEC", borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13 },
  descriptionTexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21 },
  doc: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,79,145,0.05)", borderWidth: 1, borderColor: "rgba(0,79,145,0.15)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
});
