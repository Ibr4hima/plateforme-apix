// Fiche potentialité — réplique du modal PotentialiteVueModal de la
// plateforme : pilule de zone colorée par niveau, Activités porteuses
// (arbre NAEMA), Atouts et potentialités par catégorie (chips colorées),
// Description, Documents.
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import Symbole from "@/components/Symbole";
import { htmlEnTexte } from "@/components/ZoneSheet";
import { API, getJson } from "@/lib/api";
import { COMP_PALETTE } from "@/lib/couleurs";
import { POLICE, T } from "@/theme";

// Couleurs des niveaux territoriaux (palette du site)
export const NIVEAU_COULEURS: Record<string, string> = {
  pole: "#004f91", region: "#ca631f", departement: "#188038", arrondissement: "#6A1B9A",
};

function SecTitle({ children }: { children: string }) {
  return <Text style={s.secTitle}>{children.toUpperCase()}</Text>;
}

export default function PotentialiteSheet({ pot: p, refAvantages, onClose }: { pot: any; refAvantages: any[]; onClose: () => void }) {
  const nivCouleur = NIVEAU_COULEURS[p.niveau] || T.bleu;
  const zoneNom = p.pole_nom || p.region_nom || p.departement_nom || p.arrondissement_nom || "";
  const secIds: number[] = p.secteur_ids || [];
  const braIds: number[] = p.branche_ids || [];
  const actIds: number[] = p.activite_ids || [];

  // Fichiers servis par le détail (la liste ne les embarque pas)
  const { data: detail } = useQuery({
    queryKey: ["potentialite", p.id],
    queryFn: () => getJson<any>(`/opportunites/potentialites/${p.id}`).catch(() => null),
  });
  const fichiers: any[] = detail?.fichiers || p.fichiers || [];

  // Atouts groupés par catégorie
  const avantagesSel = refAvantages.filter(a => (p.avantage_ids || []).includes(a.id));
  const cats: { nom: string; items: string[] }[] = [];
  for (const a of avantagesSel) {
    const nom = a.categorie_libelle || "Autres";
    let cat = cats.find(c => c.nom === nom);
    if (!cat) { cat = { nom, items: [] }; cats.push(cat); }
    cat.items.push(a.libelle);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.fond} onPress={onClose} />
      <View style={s.feuille}>
        <View style={s.poignee} />
        <View style={s.entete}>
          <Text style={s.titre}>{p.titre}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.fermer}>
            <Ionicons name="close" size={17} color={T.texte} />
          </Pressable>
        </View>
        {zoneNom ? (
          <View style={s.pilules}>
            <View style={[s.pilule, { backgroundColor: `${nivCouleur}12` }]}>
              <Text style={[s.piluleTexte, { color: nivCouleur }]}>{zoneNom}</Text>
            </View>
          </View>
        ) : null}

        <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ gap: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* Activités porteuses */}
          {(secIds.length > 0 || braIds.length > 0) ? (
            <View>
              <SecTitle>Activités porteuses</SecTitle>
              <ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} />
            </View>
          ) : null}

          {/* Atouts et potentialités */}
          {cats.length > 0 ? (
            <View>
              <SecTitle>Atouts et potentialités</SecTitle>
              <View style={{ gap: 10 }}>
                {cats.map((cat, ci) => {
                  const couleur = COMP_PALETTE[ci % COMP_PALETTE.length];
                  return (
                    <View key={cat.nom} style={s.categorie}>
                      <Text style={[s.categorieNom, { color: couleur }]}>{cat.nom.toUpperCase()}</Text>
                      <View style={s.chips}>
                        {cat.items.map((item, i) => (
                          <View key={i} style={[s.chip, { backgroundColor: `${couleur}0D` }]}>
                            <Text style={[s.chipTexte, { color: couleur }]}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Description */}
          {p.description ? (
            <View>
              <SecTitle>Description</SecTitle>
              <View style={s.description}><Text style={s.descriptionTexte}>{htmlEnTexte(p.description)}</Text></View>
            </View>
          ) : null}

          {/* Documents */}
          {fichiers.length > 0 ? (
            <View>
              <SecTitle>{fichiers.length > 1 ? "Documents" : "Document"}</SecTitle>
              <View style={{ gap: 5 }}>
                {fichiers.map((f: any) => (
                  <Pressable key={f.id} onPress={() => Linking.openURL(`${API}/opportunites/potentialites/${p.id}/fichiers/${f.id}/download`)}
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
  categorie: { backgroundColor: "#FAFAF9", borderWidth: 1, borderColor: "#F0EEEC", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  categorieNom: { fontSize: 10.5, fontFamily: POLICE.gras, letterSpacing: 0.8, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  chipTexte: { fontSize: 11.5, fontFamily: POLICE.demi },
  description: { backgroundColor: "#FAFAF9", borderWidth: 1, borderColor: "#F0EEEC", borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13 },
  descriptionTexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21 },
  doc: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,79,145,0.05)", borderWidth: 1, borderColor: "rgba(0,79,145,0.15)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
});
