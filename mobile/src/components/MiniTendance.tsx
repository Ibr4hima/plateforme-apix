// Mini-tendance — la silhouette d'une série, sans axes ni étiquettes.
// Une sparkline n'est pas un graphe réduit : elle ne répond qu'à une question
// (« ça monte ou ça descend, et comment ? ») posée d'un coup d'œil sous un
// grand nombre. Tout ce qui se lit — valeurs, années — vit dans la carte qui
// l'héberge. Rendu Skia : courbe lissée Catmull-Rom, aire en dégradé qui
// s'évanouit, point terminal sur la dernière valeur.
import {
  Canvas, Circle, Group, LinearGradient as DegradeSkia,
  Path as CheminSkia, Skia, vec,
} from "@shopify/react-native-skia";
import { useMemo } from "react";

// Catmull-Rom → Béziers cubiques, même lissage que les grands graphes
function lisser(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6},`
      + ` ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function MiniTendance({ valeurs, largeur, hauteur = 56, couleur = "#004f91" }: {
  valeurs: number[]; largeur: number; hauteur?: number; couleur?: string;
}) {
  const { trace, aire, fin } = useMemo(() => {
    if (valeurs.length < 2 || largeur <= 0) return { trace: null, aire: null, fin: null };
    // Marges internes : le point terminal (r=3) ne doit pas être rogné
    const M = 4;
    const min = Math.min(...valeurs), max = Math.max(...valeurs);
    const plage = max - min || 1;
    const pts = valeurs.map((v, i) => ({
      x: M + (i / (valeurs.length - 1)) * (largeur - 2 * M),
      y: M + (1 - (v - min) / plage) * (hauteur - 2 * M),
    }));
    const d = lisser(pts);
    const trace = Skia.Path.MakeFromSVGString(d);
    const aire = Skia.Path.MakeFromSVGString(
      `${d} L ${pts[pts.length - 1].x} ${hauteur} L ${pts[0].x} ${hauteur} Z`);
    return { trace, aire, fin: pts[pts.length - 1] };
  }, [valeurs, largeur, hauteur]);

  if (!trace || !aire || !fin) return null;

  return (
    <Canvas style={{ width: largeur, height: hauteur }}>
      <Group>
        <CheminSkia path={aire} style="fill">
          <DegradeSkia start={vec(0, 0)} end={vec(0, hauteur)}
            colors={[`${couleur}2E`, `${couleur}00`]} />
        </CheminSkia>
        <CheminSkia path={trace} style="stroke" strokeWidth={2}
          strokeCap="round" strokeJoin="round" color={couleur} />
        <Circle cx={fin.x} cy={fin.y} r={3} color={couleur} />
        <Circle cx={fin.x} cy={fin.y} r={5.5} color={`${couleur}26`} />
      </Group>
    </Canvas>
  );
}
