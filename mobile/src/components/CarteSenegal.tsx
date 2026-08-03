// Carte complète du Sénégal — les 14 régions à leur place, chacune colorée
// par l'appelant, séparées par un trait clair. C'est la carte territoriale du
// site ramenée à l'écran du téléphone, et elle est TAPPABLE : le doigt touche
// une région, on retrouve laquelle par un test d'appartenance géométrique
// (SkPath.contains) sur les chemins mémorisés — aucune hitbox à entretenir.
import { Canvas, Path as CheminSkia, Skia, type SkPath } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { Pressable, type GestureResponderEvent } from "react-native";
import { NOMS_REGIONS, RATIO, cheminPays } from "@/lib/senegal";

export default function CarteSenegal({ largeur, couleurPour, trait = "#fff", epaisseur = 1.2, onRegion }: {
  largeur: number;
  /** Couleur de remplissage d'une région (reçoit le nom d'origine du fond de carte) */
  couleurPour: (nom: string) => string;
  trait?: string;
  epaisseur?: number;
  /** Rend la carte tappable : reçoit le nom de la région touchée */
  onRegion?: (nom: string) => void;
}) {
  const hauteur = Math.round(largeur * RATIO);

  // Chemins à l'échelle de la vue — reconstruits seulement si la largeur change
  const regions = useMemo(() => {
    const m = Skia.Matrix().scale(largeur, largeur);
    return NOMS_REGIONS.map(nom => {
      const base = cheminPays(nom);
      if (!base) return null;
      const chemin = base.copy();
      chemin.transform(m);
      return { nom, chemin };
    }).filter(Boolean) as { nom: string; chemin: SkPath }[];
  }, [largeur]);

  const surTouche = onRegion ? (ev: GestureResponderEvent) => {
    // Le test se fait dans le cadre unité : mêmes coordonnées que cheminPays
    const x = ev.nativeEvent.locationX / largeur;
    const y = ev.nativeEvent.locationY / largeur;
    for (const nom of NOMS_REGIONS) {
      if (cheminPays(nom)?.contains(x, y)) { onRegion(nom); return; }
    }
  } : undefined;

  const carte = (
    <Canvas style={{ width: largeur, height: hauteur }}>
      {regions.map(r => (
        <CheminSkia key={r.nom} path={r.chemin} style="fill" color={couleurPour(r.nom)} />
      ))}
      {regions.map(r => (
        <CheminSkia key={`t-${r.nom}`} path={r.chemin} style="stroke"
          strokeWidth={epaisseur} strokeJoin="round" color={trait} />
      ))}
    </Canvas>
  );

  return onRegion ? <Pressable onPress={surTouche}>{carte}</Pressable> : carte;
}
