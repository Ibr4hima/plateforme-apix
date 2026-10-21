// La section « Documents » d'une fiche — accords, événements : la liste du
// système (l'icône du document, son nom ; le chevron sur iOS). Un toucher
// ouvre le document : la fiche passe son `ouvrir` (useVisionneuse) et
// l'adresse de chaque fichier.
import { View } from "react-native";
import { EnTeteSection, GroupeDocuments } from "@/components/ListeIOS";

const nomDe = (f: any): string => f.titre || f.nom || f.fichier_nom || "Document";

export default function DocumentsFiche({ fichiers, urlDe, ouvrir }: {
  fichiers: any[]; urlDe: (f: any) => string; ouvrir: (url: string, titre?: string | null) => void;
}) {
  if (!fichiers.length) return null;
  return (
    <View>
      <EnTeteSection titre={fichiers.length > 1 ? "Documents" : "Document"} />
      <GroupeDocuments fichiers={fichiers} ouvrir={f => ouvrir(urlDe(f), nomDe(f))} />
    </View>
  );
}
