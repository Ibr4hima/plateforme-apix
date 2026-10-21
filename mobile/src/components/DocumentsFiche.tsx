// La section « Documents » d'une fiche — accords, événements. Sur iOS, la
// liste groupée d'iOS (l'icône du document, son nom, le chevron) ; sur
// Android, des lignes teintées. Un toucher ouvre le document dans la
// visionneuse de l'app (iOS) ou dans le navigateur (Android) : la fiche passe
// son `ouvrir` (useVisionneuse) et l'adresse de chaque fichier.
import { Text, View } from "react-native";
import { EnTeteSection, GroupeDocuments } from "@/components/ListeIOS";
import Symbole from "@/components/Symbole";
import { Tapable } from "@/components/ui";
import { creerStyles } from "@/lib/apparence";
import { IOS } from "@/lib/plateforme";
import { POLICE, T, TYPO } from "@/theme";

const nomDe = (f: any): string => f.titre || f.nom || f.fichier_nom || "Document";

export default function DocumentsFiche({ fichiers, urlDe, ouvrir }: {
  fichiers: any[]; urlDe: (f: any) => string; ouvrir: (url: string, titre?: string | null) => void;
}) {
  if (!fichiers.length) return null;
  const titre = fichiers.length > 1 ? "Documents" : "Document";
  if (IOS) return (
    <View>
      <EnTeteSection titre={titre} />
      <GroupeDocuments fichiers={fichiers} ouvrir={f => ouvrir(urlDe(f), nomDe(f))} />
    </View>
  );
  return (
    <View>
      <Text style={s.titre}>{titre.toUpperCase()}</Text>
      <View style={{ gap: 8 }}>
        {fichiers.map((f: any) => (
          <Tapable key={f.id} echelle={0.98} style={s.doc} onPress={() => ouvrir(urlDe(f), nomDe(f))}>
            <Symbole nom="description" taille={16} couleur={T.bleu} />
            <Text style={s.docTexte} numberOfLines={1}>{nomDe(f)}</Text>
          </Tapable>
        ))}
      </View>
    </View>
  );
}

const s = creerStyles(() => ({
  titre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  // Les lignes de documents des autres fiches Android (Zone, Projet…)
  doc: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: T.bleuVoile, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10,
  },
  docTexte: { flex: 1, fontSize: 12.5, fontFamily: POLICE.demi, color: T.bleu },
}));
