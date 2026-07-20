// Graphe en lignes multi-séries (react-native-svg) — version app premium
// des courbes annuelles de la plateforme : graduations « propres »,
// courbes lissées (Catmull-Rom), aire en dégradé sous chaque série,
// double échelle automatique quand les ordres de grandeur divergent
// (règle du site : ratio d'amplitudes > 4 → une échelle par série,
// graduations gauche/droite aux couleurs des deux premières), point
// terminal souligné et curseur tactile fluide avec bulle de lecture.
import { useMemo, useRef, useState } from "react";
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
  const gradBase = useMemo(() => `gl${++gradSeq}`, []);
  const largeurRef = useRef(0);
  largeurRef.current = largeur;

  const annees = useMemo(() =>
    [...new Set(series.flatMap(s => s.data.filter(d => d.valeur !== null).map(d => d.annee)))].sort((a, b) => a - b),
  [series]);
  const vide = !annees.length;

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

  // Amplitudes par série → double échelle si les ordres de grandeur divergent
  const plages = series.map(s => {
    const vals = s.data.filter(d => d.valeur !== null).map(d => d.valeur!) as number[];
    if (!vals.length) return null;
    return { min: Math.min(...vals), max: Math.max(...vals), amplitude: Math.max(...vals) - Math.min(...vals) || Math.abs(vals[0]) || 1 };
  });
  const amplitudes = plages.filter(Boolean).map(p => p!.amplitude);
  const bi = series.length >= 2 && amplitudes.length >= 2 &&
    Math.max(...amplitudes) / Math.max(1e-9, Math.min(...amplitudes)) > 4;

  // Une échelle par série en mode bi, sinon échelle partagée
  const toutes = series.flatMap(s => s.data.map(d => d.valeur)).filter((v): v is number => v !== null);
  const ticksPartages = graduations(Math.min(...toutes), Math.max(...toutes));
  const echelles = series.map((_, i) => {
    if (!bi || !plages[i]) return ticksPartages;
    return graduations(plages[i]!.min, plages[i]!.max);
  });
  const yDe = (i: number) => {
    const t = echelles[i];
    const dMin = t[0], dMax = t[t.length - 1];
    return (v: number) => M.haut + (dMax - v) / (dMax - dMin) * (hauteur - M.haut - M.bas);
  };

  const a0 = annees[0], a1 = annees[annees.length - 1];
  const x = (a: number) => a1 === a0
    ? (largeur - M.droite + M.gauche) / 2
    : M.gauche + (a - a0) / (a1 - a0) * (largeur - M.gauche - M.droite);

  const pointsDe = (i: number) => {
    const yi = yDe(i);
    return [...series[i].data]
      .filter(d => d.valeur !== null).sort((a, b) => a.annee - b.annee)
      .map(d => ({ x: x(d.annee), y: yi(d.valeur!), annee: d.annee, valeur: d.valeur! }));
  };

  const seule = series.length === 1;
  const anneesAxe = annees.length <= 2 ? annees : [a0, annees[Math.floor((annees.length - 1) / 2)], a1];

  // Curseur tactile : année la plus proche du doigt (positions figées en refs
  // pour rester fluide, responder jamais cédé au défilement parent)
  const viserAnnee = (px: number) => {
    const l = largeurRef.current;
    const borne = Math.min(Math.max(px, 0), l);
    let meilleur = annees[0], dist = Infinity;
    for (const a of annees) { const d = Math.abs(x(a) - borne); if (d < dist) { dist = d; meilleur = a; } }
    setCurseur(prev => (prev === meilleur ? prev : meilleur));
  };
  const lecturesCurseur = curseur === null ? [] : series
    .map((s, i) => ({ nom: s.nom, couleur: s.couleur, i, valeur: s.data.find(d => d.annee === curseur)?.valeur ?? null }))
    .filter(l => l.valeur !== null) as { nom: string; couleur: string; i: number; valeur: number }[];

  const bulleL = seule ? 122 : 190;
  const bulleX = curseur === null ? 0 : Math.min(Math.max(x(curseur) - bulleL / 2, 2), largeur - bulleL - 2);

  // Graduations affichées : partagées à gauche, ou série 1 à gauche + série 2
  // à droite en mode bi-échelle (mêmes couleurs que les courbes, comme le site)
  const ticksGauche = bi ? echelles[0] : ticksPartages;
  const ticksDroite = bi && series.length >= 2 ? echelles[1] : null;

  return (
    <View
      style={{ height: hauteur }}
      onLayout={e => setLargeur(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onMoveShouldSetResponderCapture={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={e => viserAnnee(e.nativeEvent.locationX)}
      onResponderMove={e => viserAnnee(e.nativeEvent.locationX)}
      onResponderRelease={() => setCurseur(null)}
      onResponderTerminate={() => setCurseur(null)}>
      <Svg width={largeur} height={hauteur}>
        <Defs>
          {series.map((sr, i) => (
            <LinearGradient key={i} id={`${gradBase}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={sr.couleur} stopOpacity={seule ? 0.16 : 0.10} />
              <Stop offset="1" stopColor={sr.couleur} stopOpacity={0.01} />
            </LinearGradient>
          ))}
        </Defs>

        {/* Grille sur l'échelle de gauche */}
        {ticksGauche.map(t => {
          const gy = yDe(bi ? 0 : 0)(t);
          return <Line key={t} x1={M.gauche} x2={largeur - M.droite} y1={gy} y2={gy}
            stroke={t === 0 ? T.grilleZero : T.grille} strokeWidth={1} />;
        })}
        {ticksGauche.map(t => (
          <TexteSvg key={`g${t}`} x={M.gauche} y={yDe(0)(t) - 4} fontSize={9}
            fill={bi ? series[0].couleur : T.grisClair} opacity={bi ? 0.75 : 1}>{fmt(t)}</TexteSvg>
        ))}
        {ticksDroite && ticksDroite.map(t => (
          <TexteSvg key={`d${t}`} x={largeur - M.droite} y={yDe(1)(t) - 4} fontSize={9}
            fill={series[1].couleur} opacity={0.75} textAnchor="end">{fmt(t)}</TexteSvg>
        ))}

        {/* Aires en dégradé sous chaque série */}
        {series.map((_, i) => {
          const pts = pointsDe(i);
          if (pts.length < 2) return null;
          const d = `${lisser(pts)}L${pts[pts.length - 1].x.toFixed(1)},${(hauteur - M.bas).toFixed(1)}L${pts[0].x.toFixed(1)},${(hauteur - M.bas).toFixed(1)}Z`;
          return <Path key={`a${i}`} d={d} fill={`url(#${gradBase}-${i})`} />;
        })}

        {/* Courbes lissées */}
        {series.map((sr, i) => (
          <Path key={sr.nom} d={lisser(pointsDe(i))} stroke={sr.couleur}
            strokeWidth={seule ? 2.4 : 2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* Point terminal de chaque série */}
        {series.map((sr, i) => {
          const pts = pointsDe(i);
          const fin = pts[pts.length - 1];
          return fin ? <Circle key={`f${sr.nom}`} cx={fin.x} cy={fin.y} r={3.6} fill={sr.couleur} stroke={T.carte as any} strokeWidth={1.6} /> : null;
        })}

        {/* Curseur : ligne + points */}
        {curseur !== null && (
          <>
            <Line x1={x(curseur)} x2={x(curseur)} y1={M.haut} y2={hauteur - M.bas}
              stroke="rgba(26,26,46,0.28)" strokeWidth={1} strokeDasharray="3,3" />
            {lecturesCurseur.map(l => (
              <Circle key={l.nom} cx={x(curseur)} cy={yDe(l.i)(l.valeur)} r={4} fill={l.couleur} stroke={T.carte as any} strokeWidth={1.8} />
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
        <View pointerEvents="none" style={{
          position: "absolute", top: 2, left: bulleX, width: bulleL,
          backgroundColor: "rgba(26,26,46,0.93)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
        }}>
          <TexteRN style={{ fontSize: 10.5, fontFamily: POLICE.gras, color: "#fff" }}>{curseur}</TexteRN>
          {lecturesCurseur.map(l => (
            <View key={l.nom} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
              {!seule && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: l.couleur }} />}
              {!seule && <TexteRN style={{ flexShrink: 1, fontSize: 10, fontFamily: POLICE.normal, color: "rgba(255,255,255,0.75)" }} numberOfLines={1}>{l.nom}</TexteRN>}
              <TexteRN style={{ marginLeft: "auto", fontSize: 10.5, fontFamily: POLICE.demi, color: "rgba(255,255,255,0.95)" }} numberOfLines={1}>
                {fmt(l.valeur)}
              </TexteRN>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
