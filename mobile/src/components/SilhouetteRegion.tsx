// Silhouette d'une région du Sénégal — la forme réelle du territoire en
// tuile, à la place d'un chiffre abstrait. Projection et chemins Skia
// viennent de lib/senegal (mémorisés au niveau du module).
import { Canvas, Path as CheminSkia, Skia, type SkPath } from "@shopify/react-native-skia";
import { View } from "react-native";
import { cheminGroupe, cheminSeul } from "@/lib/senegal";
import { useCouleur } from "@/lib/apparence";

export { regionConnue } from "@/lib/senegal";

function Silhouette({ base, taille, couleur: teinte }: { base: SkPath | null; taille: number; couleur: string }) {
  // Skia n'accepte que des chaînes : le jeton dynamique est résolu ici
  const couleur = useCouleur(teinte);
  if (!base) return <View style={{ width: taille, height: taille }} />;
  const chemin = base.copy();
  chemin.transform(Skia.Matrix().scale(taille, taille));
  return (
    <Canvas style={{ width: taille, height: taille }}>
      <CheminSkia path={chemin} style="fill" color={couleur} />
    </Canvas>
  );
}

export default function SilhouetteRegion({ nom, taille = 34, couleur = "#004f91" }: {
  nom: string; taille?: number; couleur?: string;
}) {
  return <Silhouette base={cheminSeul(nom)} taille={taille} couleur={couleur} />;
}

/** Un pôle territorial entier : la forme unie de ses régions */
export function SilhouettePole({ noms, taille = 34, couleur = "#004f91" }: {
  noms: string[]; taille?: number; couleur?: string;
}) {
  // La résolution se fait dans Silhouette, commune aux deux formes
  return <Silhouette base={cheminGroupe(noms)} taille={taille} couleur={couleur} />;
}
