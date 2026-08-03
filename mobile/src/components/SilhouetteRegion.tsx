// Silhouette d'une région du Sénégal — la forme réelle du territoire en
// tuile, à la place d'un chiffre abstrait. Projection et chemins Skia
// viennent de lib/senegal (mémorisés au niveau du module).
import { Canvas, Path as CheminSkia, Skia } from "@shopify/react-native-skia";
import { View } from "react-native";
import { cheminSeul } from "@/lib/senegal";

export { regionConnue } from "@/lib/senegal";

export default function SilhouetteRegion({ nom, taille = 34, couleur = "#004f91" }: {
  nom: string; taille?: number; couleur?: string;
}) {
  const base = cheminSeul(nom);
  if (!base) return <View style={{ width: taille, height: taille }} />;
  const chemin = base.copy();
  chemin.transform(Skia.Matrix().scale(taille, taille));
  return (
    <Canvas style={{ width: taille, height: taille }}>
      <CheminSkia path={chemin} style="fill" color={couleur} />
    </Canvas>
  );
}
