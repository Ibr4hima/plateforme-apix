// Fiche potentialité — éditoriale, comme les autres fiches : identité (titre
// en grand, méta « NIVEAU · zone » dans la couleur du niveau), puis des
// sections plates : activités porteuses (arbre NAEMA), atouts groupés par
// catégorie (chips colorées, à plat), description riche, documents.
import { useQuery } from "@tanstack/react-query";
import { Linking, StyleSheet, Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import Symbole from "@/components/Symbole";
import TexteRiche from "@/components/TexteRiche";
import { Feuille, Tapable } from "@/components/ui";
import { API, getJson } from "@/lib/api";
import { COMP_PALETTE, useTeinte } from "@/lib/couleurs";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";

// Couleurs des niveaux territoriaux (palette du site)
export const NIVEAU_COULEURS: Record<string, string> = {
  pole: "#004f91", region: "#ca631f", departement: "#188038", arrondissement: "#6A1B9A",
};

const NIVEAU_LABELS: Record<string, string> = {
  pole: "PÔLE TERRITOIRE", region: "RÉGION", departement: "DÉPARTEMENT", arrondissement: "ARRONDISSEMENT",
};

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitre}>{titre.toUpperCase()}</Text>
      {children}
    </View>
  );
}

export default function PotentialiteSheet({ pot: p, refAvantages, onClose }: { pot: any; refAvantages: any[]; onClose: () => void }) {
  const teinte = useTeinte();
  const nivCouleur = teinte(NIVEAU_COULEURS[p.niveau]) || T.bleu;
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
    <Feuille onClose={onClose} ecart={22}
      titre={<Text style={s.titre}>{p.titre}</Text>}
      sousEntete={zoneNom ? (
        <Text style={s.meta} numberOfLines={1}>
          <Text style={{ color: nivCouleur, fontFamily: POLICE.gras }}>{NIVEAU_LABELS[p.niveau] || ""}</Text>
          {`   ·   ${zoneNom}`}
        </Text>
      ) : undefined}>

      {/* ── Activités porteuses — hiérarchie NAEMA partagée ── */}
      {(secIds.length > 0 || braIds.length > 0) ? (
        <Section titre="Activités porteuses">
          <ArbreNaema secIds={secIds} braIds={braIds} actIds={actIds} />
        </Section>
      ) : null}

      {/* ── Atouts par catégorie — chips colorées, à plat ── */}
      {cats.length > 0 ? (
        <Section titre="Atouts et potentialités">
          <View style={{ gap: 14 }}>
            {cats.map((cat, ci) => {
              const couleur = teinte(COMP_PALETTE[ci % COMP_PALETTE.length]);
              return (
                <View key={cat.nom}>
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
        </Section>
      ) : null}

      {/* ── Description ── */}
      {p.description ? (
        <Section titre="Description">
          <TexteRiche html={p.description} couleur={T.texte as any} fontSize={13} lineHeight={21} />
        </Section>
      ) : null}

      {/* ── Documents ── */}
      {fichiers.length > 0 ? (
        <Section titre={fichiers.length > 1 ? "Documents" : "Document"}>
          <View style={{ gap: 8 }}>
            {fichiers.map((f: any) => (
              <Tapable key={f.id} echelle={0.98} style={s.doc}
                onPress={() => Linking.openURL(`${API}/opportunites/potentialites/${p.id}/fichiers/${f.id}/download`).catch(() => {})}>
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
  meta: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.gris, marginTop: 7 },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },

  categorieNom: { fontSize: 10, fontFamily: POLICE.gras, letterSpacing: 0.8, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5 },
  chipTexte: { fontSize: 11.5, fontFamily: POLICE.demi },

  doc: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: T.bleuVoile, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
}));
