// Graphe en lignes multi-séries (react-native-svg) — version app premium
// des courbes annuelles de la plateforme : graduations « propres »
// calculées sur les vraies valeurs, courbes lissées (Catmull-Rom),
// aire en dégradé sous la série unique, point terminal souligné, et
// curseur tactile (glisser sur le graphe pour lire les valeurs d'une
// année, toutes séries confondues).
import { useMemo, useState } from "react";
import { Text as TexteRN, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as TexteSvg } from "react-native-svg";
import { POLICE, T } from "@/theme";

export type Serie = { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] };

// Graduations « propres » (pas 1/2/5 × 10^k) couvrant [min, max]
function graduations(min: number, max: number, cible = 3): number[] {
  if (min === max) { const e = Math.abs(min) * 0.1 || 1; min -= e; max += e; }
  const brut = (max - min) / cible;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(brut))));
  const norme = brut / mag;
  const pas = (norme < 1.5 ? 1 : norme < 3 ? 2 : norme < 7 ? 5 : 10) * mag;
  const debut = Math.floor(min / pas) * pas;
  const ticks: number[] = [];
  for (let v = debut; v <= max + pas * 0.001; v += pas) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + pas);
  return ticks;
}

// Lissage Catmull-Rom → courbes de Bézier cubiques
function lisser(pts: { x: number; y: number }[]): string {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

let gradSeq = 0;

export default function GrapheLignes({ series, hauteur = 170, fmt }: {
  series: Serie[]; hauteur?: number; fmt: (v: number | null) => string;
}) {
  const [largeur, setLargeur] = useState(0);
  const [curseur, setCurseur] = useState<number | null>(null);
  const gradId = useMemo(() => `gl-${++gradSeq}`, []);

  const annees = useMemo(() =>
    [...new Set(series.flatMap(s => s.data.filter(d => d.valeur !== null).map(d => d.annee)))].sort((a, b) => a - b),
  [series]);
  const valeurs = series.flatMap(s => s.data.map(d => d.valeur)).filter((v): v is number => v !== null);
  const vide = !annees.length || !valeurs.length;

  const M = { haut: 10, droite: 10, bas: 22, gauche: 10 };

  if (vide || largeur === 0) {
    return (
      <View style={{ height: hauteur }} onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
        {vide && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <TexteRN style={{ fontSize: 11.5, fontFamily: POLICE.normal, color: T.grisClair }}>Aucune donnée sur la période</TexteRN>
          </View>
        )}
      </View>
    );
  }

  const ticks = graduations(Math.min(...valeurs), Math.max(...valeurs));
  const dMin = ticks[0], dMax = ticks[ticks.length - 1];
  const a0 = annees[0], a1 = annees[annees.length - 1];
  const x = (a: number) => a1 === a0
    ? (largeur - M.droite + M.gauche) / 2
    : M.gauche + (a - a0) / (a1 - a0) * (largeur - M.gauche - M.droite);
  const y = (v: number) => M.haut + (dMax - v) / (dMax - dMin) * (hauteur - M.haut - M.bas);

  const pointsDe = (s: Serie) => [...s.data]
    .filter(d => d.valeur !== null).sort((a, b) => a.annee - b.annee)
    .map(d => ({ x: x(d.annee), y: y(d.valeur!), annee: d.annee, valeur: d.valeur! }));

  const seule = series.length === 1;
  const anneesAxe = annees.length <= 2 ? annees : [a0, annees[Math.floor((annees.length - 1) / 2)], a1];

  // Curseur tactile : année la plus proche du doigt
  const viserAnnee = (px: number) => {
    let meilleur = annees[0], dist = Infinity;
    for (const a of annees) { const d = Math.abs(x(a) - px); if (d < dist) { dist = d; meilleur = a; } }
    setCurseur(meilleur);
  };
  const lecturesCurseur = curseur === null ? [] : series
    .map(s => ({ nom: s.nom, couleur: s.couleur, valeur: s.data.find(d => d.annee === curseur)?.valeur ?? null }))
    .filter(l => l.valeur !== null) as { nom: string; couleur: string; valeur: number }[];

  // Bulle du curseur : position clampée dans le cadre
  const bulleL = seule ? 118 : 148;
  const bulleX = curseur === null ? 0 : Math.min(Math.max(x(curseur) - bulleL / 2, 2), largeur - bulleL - 2);

  return (
    <View
      style={{ height: hauteur }}
      onLayout={e => setLargeur(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={e => viserAnnee(e.nativeEvent.locationX)}
      onResponderMove={e => viserAnnee(e.nativeEvent.locationX)}
      onResponderRelease={() => setCurseur(null)}
      onResponderTerminate={() => setCurseur(null)}>
      <Svg width={largeur} height={hauteur}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={series[0]?.couleur || T.bleu} stopOpacity={0.16} />
            <Stop offset="1" stopColor={series[0]?.couleur || T.bleu} stopOpacity={0.01} />
          </LinearGradient>
        </Defs>

        {/* Grille + graduations (sur les vraies valeurs) */}
        {ticks.map(t => (
          <Line key={t} x1={M.gauche} x2={largeur - M.droite} y1={y(t)} y2={y(t)}
            stroke={t === 0 ? "#DDD9D4" : "#F0EEEB"} strokeWidth={1} />
        ))}
        {ticks.map(t => (
          <TexteSvg key={`l${t}`} x={M.gauche} y={y(t) - 4} fontSize={9} fill="#B3AEA8">{fmt(t)}</TexteSvg>
        ))}

        {/* Aire sous la série unique */}
        {seule && (() => {
          const pts = pointsDe(series[0]);
          if (pts.length < 2) return null;
          const d = `${lisser(pts)}L${pts[pts.length - 1].x.toFixed(1)},${(hauteur - M.bas).toFixed(1)}L${pts[0].x.toFixed(1)},${(hauteur - M.bas).toFixed(1)}Z`;
          return <Path d={d} fill={`url(#${gradId})`} />;
        })()}

        {/* Courbes lissées */}
        {series.map(sr => (
          <Path key={sr.nom} d={lisser(pointsDe(sr))} stroke={sr.couleur}
            strokeWidth={seule ? 2.4 : 2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* Point terminal de chaque série */}
        {series.map(sr => {
          const pts = pointsDe(sr);
          const fin = pts[pts.length - 1];
          return fin ? <Circle key={`f${sr.nom}`} cx={fin.x} cy={fin.y} r={3.6} fill={sr.couleur} stroke="#fff" strokeWidth={1.6} /> : null;
        })}

        {/* Curseur : ligne + points */}
        {curseur !== null && (
          <>
            <Line x1={x(curseur)} x2={x(curseur)} y1={M.haut} y2={hauteur - M.bas}
              stroke="rgba(26,26,46,0.28)" strokeWidth={1} strokeDasharray="3,3" />
            {lecturesCurseur.map(l => (
              <Circle key={l.nom} cx={x(curseur)} cy={y(l.valeur)} r={4} fill={l.couleur} stroke="#fff" strokeWidth={1.8} />
            ))}
          </>
        )}

        {/* Années en abscisse */}
        {anneesAxe.map(a => (
          <TexteSvg key={a} x={x(a)} y={hauteur - 6} fontSize={9.5} fill={T.gris}
            textAnchor={a === a0 ? "start" : a === a1 ? "end" : "middle"}>
            {String(a)}
          </TexteSvg>
        ))}
      </Svg>

      {/* Bulle de lecture */}
      {curseur !== null && lecturesCurseur.length > 0 && (
        <View style={{
          position: "absolute", top: 2, left: bulleX, width: bulleL,
          backgroundColor: "rgba(26,26,46,0.92)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
        }}>
          <TexteRN style={{ fontSize: 10.5, fontFamily: POLICE.gras, color: "#fff" }}>{curseur}</TexteRN>
          {lecturesCurseur.map(l => (
            <View key={l.nom} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
              {!seule && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: l.couleur }} />}
              <TexteRN style={{ flex: 1, fontSize: 10.5, fontFamily: POLICE.demi, color: "rgba(255,255,255,0.92)" }} numberOfLines={1}>
                {fmt(l.valeur)}
              </TexteRN>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
