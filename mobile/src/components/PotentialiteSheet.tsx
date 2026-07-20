// Fiche potentialité — réplique du modal PotentialiteVueModal de la
// plateforme : pilule de zone colorée par niveau, Activités porteuses
// (arbre NAEMA), Atouts et potentialités par catégorie (chips colorées),
// Description, Documents.
import { useQuery } from "@tanstack/react-query";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import { Feuille } from "@/components/ui";
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
    <Feuille onClose={onClose} titre={p.titre}
      sousEntete={zoneNom ? (
        <View style={s.pilules}>
          <View style={[s.pilule, { backgroundColor: `${nivCouleur}12` }]}>
            <Text style={[s.piluleTexte, { color: nivCouleur }]}>{zoneNom}</Text>
          </View>
        </View>
      ) : null}>
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
    </Feuille>
  );
}

const s = StyleSheet.create({
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  pilule: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3.5 },
  piluleTexte: { fontSize: 10.5, fontFamily: POLICE.gras },
  secTitle: { fontSize: 10.5, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 1.6, marginBottom: 10 },
  categorie: { backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  categorieNom: { fontSize: 10.5, fontFamily: POLICE.gras, letterSpacing: 0.8, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  chipTexte: { fontSize: 11.5, fontFamily: POLICE.demi },
  description: { backgroundColor: T.carteDouce, borderWidth: 1, borderColor: T.bordureDouce, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13 },
  descriptionTexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.texte, lineHeight: 21 },
  doc: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: T.bleuVoile, borderWidth: 1, borderColor: T.blocBord,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
});
