// Fiche avantage — éditoriale, comme les autres fiches : identité (activité
// en grand, méta « secteur · branche » avec le secteur dans sa couleur), puis
// des sections plates : avantages & incitations en lignes à filets (le type
// en vert, le commentaire dessous), description riche, documents.
import { useQuery } from "@tanstack/react-query";
import { Linking, StyleSheet, Text, View } from "react-native";
import Symbole from "@/components/Symbole";
import TexteRiche from "@/components/TexteRiche";
import { Feuille, Tapable } from "@/components/ui";
import { API, getJson } from "@/lib/api";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";

// Couleur du secteur économique (celles du site : primaire vert,
// secondaire orange, tertiaire bleu)
const couleurSecteur = (nom?: string): string => {
  const n = (nom || "").toLowerCase();
  if (n.includes("primaire")) return "#188038";
  if (n.includes("secondaire")) return "#ca631f";
  if (n.includes("tertiaire")) return "#004f91";
  return T.gris as string;
};

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitre}>{titre.toUpperCase()}</Text>
      {children}
    </View>
  );
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
    <Feuille onClose={onClose} ecart={22}
      titre={<Text style={s.titre}>{d.activite_nom}</Text>}
      sousEntete={(d.secteur_nom || d.branche_nom) ? (
        <Text style={s.meta} numberOfLines={2}>
          {d.secteur_nom ? (
            <Text style={{ color: couleurSecteur(d.secteur_nom), fontFamily: POLICE.gras }}>{d.secteur_nom}</Text>
          ) : null}
          {d.secteur_nom && d.branche_nom ? "   ·   " : ""}
          {d.branche_nom || ""}
        </Text>
      ) : undefined}>

      {/* ── Les avantages accordés — lignes à filets, le fond de la fiche ── */}
      {selections.length > 0 ? (
        <Section titre="Avantages & incitations">
          <View>
            {selections.map((sel: any, i: number) => (
              <View key={sel.id} style={[s.selection, i > 0 && s.selectionBord]}>
                <View style={s.selectionLigne}>
                  <Symbole nom="check_circle" taille={15} couleur={T.vert} />
                  <Text style={s.selectionType}>{sel.type_libelle}</Text>
                </View>
                {sel.commentaire ? <Text style={s.selectionCommentaire}>{sel.commentaire}</Text> : null}
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {/* ── Description ── */}
      {d.avantages ? (
        <Section titre="Description">
          <TexteRiche html={d.avantages} couleur={T.texte as any} fontSize={13} lineHeight={21} />
        </Section>
      ) : null}

      {/* ── Documents ── */}
      {fichiers.length > 0 ? (
        <Section titre={fichiers.length > 1 ? "Documents" : "Document"}>
          <View style={{ gap: 8 }}>
            {fichiers.map((f: any) => (
              <Tapable key={f.id} echelle={0.98} style={s.doc}
                onPress={() => Linking.openURL(`${API}/opportunites/avantages/${d.id}/fichiers/${f.id}/download`).catch(() => {})}>
                <Symbole nom="description" taille={16} couleur={T.bleu} />
                <Text style={s.docTexte} numberOfLines={1}>{f.titre || f.fichier_nom}</Text>
              </Tapable>
            ))}
          </View>
        </Section>
      ) : null}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  titre: { fontSize: 21, fontFamily: POLICE.gras, color: T.encre, lineHeight: 27, letterSpacing: -0.4, flex: 1 },
  meta: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris, marginTop: 7, lineHeight: 18 },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },

  selection: { paddingVertical: 10 },
  selectionBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  selectionLigne: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectionType: { flex: 1, fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  selectionCommentaire: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.texte, lineHeight: 20, marginLeft: 23, marginTop: 4 },

  doc: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: T.bleuVoile, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
}));
