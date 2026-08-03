// Fond de carte du Sénégal — source unique pour toutes les vues cartographiques
// de l'app : le même topojson que la vue territoriale du site (14 régions,
// propriété `name`), embarqué dans l'app, aucune requête.
//
// Deux projections coexistent :
//   · cheminPays(nom)  — la région à sa place dans le cadre national (pour la
//     carte complète : x ∈ [0,1], y ∈ [0,RATIO], même échelle sur les 2 axes) ;
//   · cheminSeul(nom)  — la région normalisée dans son propre carré unité
//     (pour les silhouettes en tuile).
// Décodage topojson et chemins Skia sont mémorisés au niveau du module : le
// travail n'est fait qu'une fois par région, quel que soit le nombre de vues.
import { Skia, type SkPath } from "@shopify/react-native-skia";
import { feature } from "topojson-client";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TOPO = require("../../assets/cartes/sen.topo.json");

// Nom replié pour l'appariement : accents et casse neutralisés
export const plier = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// nom replié → { nom d'origine, anneaux de coordonnées [lon, lat] }
const REGIONS = new Map<string, { nom: string; anneaux: number[][][] }>();
{
  const geo: any = feature(TOPO, TOPO.objects.sen);
  for (const f of geo.features) {
    const nom: string = f.properties?.name || "";
    if (!nom) continue;
    // Polygon → [rings] ; MultiPolygon → [poly][rings] : on aplatit en anneaux
    const anneaux: number[][][] = f.geometry.type === "Polygon"
      ? f.geometry.coordinates
      : f.geometry.coordinates.flat();
    REGIONS.set(plier(nom), { nom, anneaux });
  }
}

/** La région existe-t-elle dans le fond de carte ? (« Sans région » : non) */
export const regionConnue = (nom: string) => REGIONS.has(plier(nom));

/** Noms d'origine des 14 régions du fond de carte */
export const NOMS_REGIONS = [...REGIONS.values()].map(r => r.nom);

// ── Cadre national ───────────────────────────────────────────────────────────
// Boîte englobante du pays en degrés ; correction cos(lat) pour ne pas écraser
// les formes (équirectangulaire locale — largement suffisant à cette échelle)
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const { anneaux } of REGIONS.values()) for (const anneau of anneaux) for (const [x, y] of anneau) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const cosLat = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
const largeurPays = (maxX - minX) * cosLat;

/** Hauteur du pays pour une largeur de 1 (≈ 0.73 : le Sénégal est plus large que haut) */
export const RATIO = (maxY - minY) / largeurPays;

function tracer(anneaux: number[][][], px: (x: number) => number, py: (y: number) => number): SkPath {
  const chemin = Skia.Path.Make();
  for (const anneau of anneaux) {
    anneau.forEach(([x, y], i) => {
      if (i === 0) chemin.moveTo(px(x), py(y)); else chemin.lineTo(px(x), py(y));
    });
    chemin.close();
  }
  return chemin;
}

// ── La région à sa place dans le cadre national ──────────────────────────────
const CHEMINS_PAYS = new Map<string, SkPath | null>();
export function cheminPays(nom: string): SkPath | null {
  const cle = plier(nom);
  if (CHEMINS_PAYS.has(cle)) return CHEMINS_PAYS.get(cle)!;
  const region = REGIONS.get(cle);
  const chemin = region ? tracer(region.anneaux,
    x => (x - minX) * cosLat / largeurPays,
    y => (maxY - y) / largeurPays, // l'axe des latitudes s'inverse à l'écran
  ) : null;
  CHEMINS_PAYS.set(cle, chemin);
  return chemin;
}

// ── La région seule, normalisée dans son carré unité ─────────────────────────
const CHEMINS_SEULS = new Map<string, SkPath | null>();
export function cheminSeul(nom: string): SkPath | null {
  const cle = plier(nom);
  if (CHEMINS_SEULS.has(cle)) return CHEMINS_SEULS.get(cle)!;
  const region = REGIONS.get(cle);
  if (!region) { CHEMINS_SEULS.set(cle, null); return null; }

  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
  for (const anneau of region.anneaux) for (const [x, y] of anneau) {
    if (x < mnX) mnX = x; if (x > mxX) mxX = x;
    if (y < mnY) mnY = y; if (y > mxY) mxY = y;
  }
  const cos = Math.cos(((mnY + mxY) / 2) * Math.PI / 180);
  const l = (mxX - mnX) * cos, h = mxY - mnY;
  const echelle = 1 / Math.max(l, h);
  // Centrage dans le carré unité
  const dx = (1 - l * echelle) / 2, dy = (1 - h * echelle) / 2;

  const chemin = tracer(region.anneaux,
    x => dx + (x - mnX) * cos * echelle,
    y => dy + (mxY - y) * echelle,
  );
  CHEMINS_SEULS.set(cle, chemin);
  return chemin;
}
