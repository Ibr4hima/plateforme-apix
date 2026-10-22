// Fond de carte du Sénégal — source unique pour toutes les vues cartographiques
// de l'app : le même topojson que la vue territoriale du site (14 régions,
// propriété `name`), embarqué dans l'app, aucune requête.
//
// cheminSeul(nom) : la région normalisée dans son propre carré unité — les
// silhouettes en tuile des pôles et des régions.
// Décodage topojson et chemins Skia sont mémorisés au niveau du module : le
// travail n'est fait qu'une fois par région, quel que soit le nombre de vues.
import { Skia, type SkPath } from "@shopify/react-native-skia";
import { feature } from "topojson-client";
import { plier } from "@/lib/format";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TOPO = require("../../assets/cartes/sen.topo.json");


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

function tracer(anneaux: number[][][], px: (x: number) => number, py: (y: number) => number, chemin = Skia.Path.Make()): SkPath {
  for (const anneau of anneaux) {
    anneau.forEach(([x, y], i) => {
      if (i === 0) chemin.moveTo(px(x), py(y)); else chemin.lineTo(px(x), py(y));
    });
    chemin.close();
  }
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

// ── Un groupe de régions (un pôle), normalisé dans son carré unité ───────────
const CHEMINS_GROUPES = new Map<string, SkPath | null>();
export function cheminGroupe(noms: string[]): SkPath | null {
  const cles = [...new Set(noms.map(plier))].filter(c => REGIONS.has(c)).sort();
  if (!cles.length) return null;
  const cle = cles.join("|");
  if (CHEMINS_GROUPES.has(cle)) return CHEMINS_GROUPES.get(cle)!;

  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
  for (const c of cles) for (const anneau of REGIONS.get(c)!.anneaux) for (const [x, y] of anneau) {
    if (x < mnX) mnX = x; if (x > mxX) mxX = x;
    if (y < mnY) mnY = y; if (y > mxY) mxY = y;
  }
  const cos = Math.cos(((mnY + mxY) / 2) * Math.PI / 180);
  const l = (mxX - mnX) * cos, h = mxY - mnY;
  const echelle = 1 / Math.max(l, h);
  const dx = (1 - l * echelle) / 2, dy = (1 - h * echelle) / 2;

  const chemin = Skia.Path.Make();
  for (const c of cles) tracer(REGIONS.get(c)!.anneaux,
    x => dx + (x - mnX) * cos * echelle,
    y => dy + (mxY - y) * echelle,
    chemin);
  CHEMINS_GROUPES.set(cle, chemin);
  return chemin;
}
