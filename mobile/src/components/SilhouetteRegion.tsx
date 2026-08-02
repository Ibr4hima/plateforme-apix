// Silhouette d'une région du Sénégal — la forme réelle du territoire en
// tuile, à la place d'un chiffre abstrait. Le fond de carte est le même
// topojson que la vue territoriale du site (14 régions, propriété `name`),
// embarqué dans l'app : aucune requête.
//
// Le décodage topojson et la construction des chemins Skia sont mémorisés au
// niveau du module : quel que soit le nombre de tuiles affichées, le travail
// n'est fait qu'une fois par région.
import { Canvas, Path as CheminSkia, Skia, type SkPath } from "@shopify/react-native-skia";
import { feature } from "topojson-client";
import { View } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TOPO = require("../../assets/cartes/sen.topo.json");

// Nom replié pour l'appariement : accents et casse neutralisés
const plier = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// name replié → anneaux de coordonnées [lon, lat]
const REGIONS = new Map<string, number[][][]>();
{
  const geo: any = feature(TOPO, TOPO.objects.sen);
  for (const f of geo.features) {
    const nom = plier(f.properties?.name || "");
    if (!nom) continue;
    // Polygon → [rings] ; MultiPolygon → [poly][rings] : on aplatit en anneaux
    const anneaux: number[][][] = f.geometry.type === "Polygon"
      ? f.geometry.coordinates
      : f.geometry.coordinates.flat();
    REGIONS.set(nom, anneaux);
  }
}

// Chemins Skia normalisés dans un carré unité, par région (construits à la demande)
const CHEMINS = new Map<string, SkPath | null>();
function cheminDe(nom: string): SkPath | null {
  const cle = plier(nom);
  if (CHEMINS.has(cle)) return CHEMINS.get(cle)!;
  const anneaux = REGIONS.get(cle);
  if (!anneaux) { CHEMINS.set(cle, null); return null; }

  // Boîte englobante en degrés ; correction cos(lat) pour ne pas écraser la
  // forme (équirectangulaire locale — largement suffisant à cette échelle)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const anneau of anneaux) for (const [x, y] of anneau) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const cosLat = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const largeur = (maxX - minX) * cosLat, hauteur = maxY - minY;
  const echelle = 1 / Math.max(largeur, hauteur);
  // Centrage dans le carré unité
  const dx = (1 - largeur * echelle) / 2, dy = (1 - hauteur * echelle) / 2;

  const chemin = Skia.Path.Make();
  for (const anneau of anneaux) {
    anneau.forEach(([x, y], i) => {
      const px = dx + (x - minX) * cosLat * echelle;
      const py = dy + (maxY - y) * echelle; // l'axe des latitudes s'inverse à l'écran
      if (i === 0) chemin.moveTo(px, py); else chemin.lineTo(px, py);
    });
    chemin.close();
  }
  CHEMINS.set(cle, chemin);
  return chemin;
}

/** La région existe-t-elle dans le fond de carte ? (« Sans région » : non) */
export function regionConnue(nom: string): boolean {
  return REGIONS.has(plier(nom));
}

export default function SilhouetteRegion({ nom, taille = 34, couleur = "#004f91" }: {
  nom: string; taille?: number; couleur?: string;
}) {
  const base = cheminDe(nom);
  if (!base) return <View style={{ width: taille, height: taille }} />;
  const chemin = base.copy();
  chemin.transform(Skia.Matrix().scale(taille, taille));
  return (
    <Canvas style={{ width: taille, height: taille }}>
      <CheminSkia path={chemin} style="fill" color={couleur} />
    </Canvas>
  );
}
