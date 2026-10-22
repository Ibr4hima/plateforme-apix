// Fiche avantage — éditoriale, comme les autres fiches : identité (activité
// en grand, méta « secteur · branche » avec le secteur dans sa couleur), puis
// des sections plates : avantages & incitations en lignes à filets (le type
// en vert, le commentaire dessous), description riche, documents.
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import TexteRiche from "@/components/TexteRiche";
import { htmlEnTexte } from "@/components/ZoneSheet";
import Icone from "@/components/Icone";
import { Bloc, EnTeteSection, Groupe, GroupeDocuments, Ligne } from "@/components/ListeIOS";
import { useVisionneuse } from "@/components/Visionneuse";
import { Feuille } from "@/components/ui";
import { IOS } from "@/lib/plateforme";
import { API, getJson } from "@/lib/api";
import { FONTE, T } from "@/theme";
import { creerStyles } from "@/lib/apparence";

// La fiche se lit en listes groupées, sur iOS comme sur Android (ListeIOS) :
// les avantages accordés en liste (la coche verte en tête, le commentaire en
// légende), la description dans son bloc, les documents en liste.

/** `liste` : la section porte des lignes (un groupe) plutôt qu'un contenu
    libre (un bloc). */
function Section({ titre, liste, children }: { titre: string; liste?: boolean; children: React.ReactNode }) {
  return <View><EnTeteSection titre={titre} />{liste ? children : <Bloc>{children}</Bloc>}</View>;
}

export default function AvantageSheet({ avantage: a, onClose }: { avantage: any; onClose: () => void }) {
  // Les documents s'ouvrent dans l'app (visionneuse), pas dans Safari
  const { ouvrir: ouvrirDoc, element: visionneuse } = useVisionneuse();
  // Le détail complète la ligne de liste (sélections, description, fichiers)
  const { data: detail } = useQuery({
    queryKey: ["avantage", a.id],
    queryFn: () => getJson<any>(`/opportunites/avantages/${a.id}`).catch(() => null),
  });
  const d = detail || a;
  const selections: any[] = Array.isArray(d.selections) ? d.selections : [];
  const fichiers: any[] = Array.isArray(d.fichiers) ? d.fichiers : [];

  return (
    <Feuille onClose={onClose} ecart={22} fondGroupe
      titre={d.activite_nom}
      sousEntete={(d.secteur_nom || d.branche_nom) ? (
        <Text style={s.meta}>
          {/* Le secteur à l'encre, la branche en gris — sans code couleur,
              comme la hiérarchie des thématiques */}
          {d.secteur_nom ? (
            <Text style={{ color: T.encre, ...FONTE.gras }}>{d.secteur_nom}</Text>
          ) : null}
          {d.secteur_nom && d.branche_nom ? " · " : ""}
          {d.branche_nom || ""}
        </Text>
      ) : undefined}>

      {/* ── Les avantages accordés — la coche verte en tête ── */}
      {selections.length > 0 ? (
        <Section titre="Avantages & incitations" liste>
          <Groupe>
            {selections.map((sel: any) => (
              <Ligne key={sel.id} label={sel.type_libelle} legende={sel.commentaire ? htmlEnTexte(sel.commentaire) : undefined}
                avant={<Icone sf="checkmark.circle.fill" materiel="check_circle" taille={IOS ? 17 : 24} couleur={T.vert} />} />
            ))}
          </Groupe>
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
        <Section titre={fichiers.length > 1 ? "Documents" : "Document"} liste>
          <GroupeDocuments fichiers={fichiers}
            ouvrir={f => ouvrirDoc(`${API}/opportunites/avantages/${d.id}/fichiers/${f.id}/download`, f.titre || f.nom)} />
        </Section>
      ) : null}
      {visionneuse}
    </Feuille>
  );
}

const s = creerStyles(() => ({
  meta: { fontSize: 12.5, ...FONTE.demi, color: T.gris, marginTop: 7, lineHeight: 18 },
}));
