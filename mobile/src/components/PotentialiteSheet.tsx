// Fiche potentialité — éditoriale, comme les autres fiches : identité (titre
// en grand, méta « NIVEAU · zone » dans la couleur du niveau), puis des
// sections plates : activités porteuses (arbre NAEMA), atouts groupés par
// catégorie (chips colorées, à plat), description riche, documents.
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import ArbreNaema from "@/components/ArbreNaema";
import TexteRiche from "@/components/TexteRiche";
import { Bloc, EnTeteSection, GroupeDocuments } from "@/components/ListeIOS";
import { useVisionneuse } from "@/components/Visionneuse";
import { Feuille } from "@/components/ui";
import { API, getJson } from "@/lib/api";
import { COMP_PALETTE, useTeinte } from "@/lib/couleurs";
import { FONTE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";

// Couleurs des niveaux territoriaux (palette du site)
export const NIVEAU_COULEURS: Record<string, string> = {
  pole: "#004f91", region: "#ca631f", departement: "#188038", arrondissement: "#6A1B9A",
};

const NIVEAU_LABELS: Record<string, string> = {
  pole: "PÔLE TERRITOIRE", region: "RÉGION", departement: "DÉPARTEMENT", arrondissement: "ARRONDISSEMENT",
};

// La fiche se lit en listes groupées, sur iOS comme sur Android (ListeIOS) :
// chaque section dans son bloc blanc sur le fond gris, les documents en
// liste.

/** `liste` : la section porte des lignes (un groupe) plutôt qu'un contenu
    libre (un bloc). */
function Section({ titre, liste, children }: { titre: string; liste?: boolean; children: React.ReactNode }) {
  return <View><EnTeteSection titre={titre} />{liste ? children : <Bloc>{children}</Bloc>}</View>;
}

export default function PotentialiteSheet({ pot: p, refAvantages, onClose }: { pot: any; refAvantages: any[]; onClose: () => void }) {
  // Les documents s'ouvrent dans l'app (visionneuse), pas dans Safari
  const { ouvrir: ouvrirDoc, element: visionneuse } = useVisionneuse();
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
    <Feuille onClose={onClose} ecart={22} fondGroupe
      titre={p.titre}
      sousEntete={zoneNom ? (
        <TexteDefilant style={s.meta}>
          <Text style={{ color: nivCouleur, ...FONTE.gras }}>{NIVEAU_LABELS[p.niveau] || ""}</Text>
          {`   ·   ${zoneNom}`}
        </TexteDefilant>
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
        <Section titre={fichiers.length > 1 ? "Documents" : "Document"} liste>
          <GroupeDocuments fichiers={fichiers}
            ouvrir={f => ouvrirDoc(`${API}/opportunites/potentialites/${p.id}/fichiers/${f.id}/download`, f.titre || f.nom)} />
        </Section>
      ) : null}
      {visionneuse}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  meta: { fontSize: 12.5, ...FONTE.demi, color: T.gris, marginTop: 7 },

  categorieNom: { fontSize: 10, ...FONTE.gras, letterSpacing: 0.8, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5 },
  chipTexte: { fontSize: 11.5, ...FONTE.demi },
}));
