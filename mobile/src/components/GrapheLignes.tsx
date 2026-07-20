// Graphe en lignes multi-séries (react-native-svg) — version app premium
// des courbes annuelles de la plateforme : graduations « propres »,
// courbes lissées (Catmull-Rom), aire en dégradé sous chaque série,
// double échelle automatique quand les ordres de grandeur divergent
// (règle du site : ratio d'amplitudes > 4 → une échelle par série,
// graduations gauche/droite aux couleurs des deux premières), point
// terminal souligné et curseur tactile fluide avec bulle de lecture.
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Text as TexteRN, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as TexteSvg } from "react-native-svg";
import { cran } from "@/lib/haptique";

// Courbes qui se tracent à l'apparition (dash-offset animé)
const PathAnime = Animated.createAnimatedComponent(Path);
const CircleAnime = Animated.createAnimatedComponent(Circle);
// Longueur majorante de n'importe quelle courbe du graphe
const LONGUEUR_TRACE = 1600;
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


// Aires, courbes et points terminaux — avec transition morphing : quand les
// filtres changent sans changer la structure (mêmes séries, même nombre de
// points), la courbe GLISSE vers ses nouvelles valeurs (interpolation du
// chemin) au lieu de se retracer. Structure différente → tracé dash-offset.
const nbNombres = (d: string) => (d.match(/[\d.]+/g) || []).length;

function CourbesAnimees({ series, dCourbes, dAires, fins, seule, gradBase, trace }: {
  series: Serie[]; dCourbes: string[]; dAires: string[];
  fins: ({ x: number; y: number } | null)[]; seule: boolean; gradBase: string;
  trace: Animated.Value;
}) {
  const morph = useRef(new Animated.Value(1)).current;
  type Photo = { structure: string; courbes: string[]; aires: string[]; fins: ({ x: number; y: number } | null)[] };
  const precedent = useRef<Photo | null>(null);
  const [transition, setTransition] = useState<Photo | null>(null);
  const cle = dCourbes.join("\u00a7");

  useEffect(() => {
    const actuel: Photo = {
      structure: series.map((sr, i) => `${sr.nom}:${nbNombres(dCourbes[i] || "")}`).join("|"),
      courbes: dCourbes, aires: dAires, fins,
    };
    const prec = precedent.current;
    precedent.current = actuel;
    if (!prec || prec.structure !== actuel.structure) return; // premier rendu ou structure neuve : le tracé s'en charge
    if (prec.courbes.join() === actuel.courbes.join()) return;
    setTransition(prec);
    morph.setValue(0);
    Animated.timing(morph, { toValue: 1, duration: 480, useNativeDriver: false })
      .start(({ finished }) => { if (finished) setTransition(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  const entre = (de: string, vers: string) =>
    morph.interpolate({ inputRange: [0, 1], outputRange: [de, vers] });

  return (
    <>
      {/* Aires en dégradé sous chaque série */}
      {series.map((sr, i) => {
        if (!dAires[i]) return null;
        const enMorph = !!transition?.aires[i];
        return <PathAnime key={`a${sr.nom}`} fill={`url(#${gradBase}-${i})`}
          d={(enMorph ? entre(transition!.aires[i], dAires[i]) : dAires[i]) as any}
          opacity={enMorph ? 1 : trace.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0.1, 1] }) as any} />;
      })}

      {/* Courbes lissées */}
      {series.map((sr, i) => {
        if (!dCourbes[i]) return null;
        const enMorph = !!transition?.courbes[i];
        return <PathAnime key={sr.nom} stroke={sr.couleur}
          strokeWidth={seule ? 2.4 : 2} fill="none" strokeLinejoin="round" strokeLinecap="round"
          d={(enMorph ? entre(transition!.courbes[i], dCourbes[i]) : dCourbes[i]) as any}
          strokeDasharray={enMorph ? undefined : `${LONGUEUR_TRACE},${LONGUEUR_TRACE}`}
          strokeDashoffset={enMorph ? 0 : trace.interpolate({ inputRange: [0, 1], outputRange: [LONGUEUR_TRACE, 0] }) as any} />;
      })}

      {/* Point terminal de chaque série */}
      {series.map((sr, i) => {
        const fin = fins[i];
        if (!fin) return null;
        const de = transition?.fins[i];
        return <CircleAnime key={`f${sr.nom}`} r={3.6} fill={sr.couleur} stroke={T.carte as any} strokeWidth={1.6}
          cx={(de ? morph.interpolate({ inputRange: [0, 1], outputRange: [de.x, fin.x] }) : fin.x) as any}
          cy={(de ? morph.interpolate({ inputRange: [0, 1], outputRange: [de.y, fin.y] }) : fin.y) as any}
          opacity={de ? 1 : trace.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 0, 1] }) as any} />;
      })}
    </>
  );
}

let gradSeq = 0;

function GrapheLignes({ series, hauteur = 170, fmt }: {
  series: Serie[]; hauteur?: number; fmt: (v: number | null) => string;
}) {
  const [largeur, setLargeur] = useState(0);
  const [curseur, setCurseur] = useState<number | null>(null);
  // Tracé progressif : rejoué quand les séries changent
  const trace = useRef(new Animated.Value(0)).current;
  const signature = series.map(sr => `${sr.nom}:${sr.data.length}`).join("|");
  useEffect(() => {
    trace.setValue(0);
    Animated.timing(trace, { toValue: 1, duration: 900, useNativeDriver: false }).start();
  }, [signature, trace]);
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

  // Chemins de chaque série (courbe, aire fermée, point terminal)
  const dessins = (() => {
    const courbes: string[] = [], aires: string[] = [], fins: ({ x: number; y: number } | null)[] = [];
    series.forEach((_, i) => {
      const pts = pointsDe(i);
      courbes.push(pts.length >= 2 ? lisser(pts) : "");
      aires.push(pts.length >= 2
        ? `${lisser(pts)}L${pts[pts.length - 1].x.toFixed(1)},${(hauteur - M.bas).toFixed(1)}L${pts[0].x.toFixed(1)},${(hauteur - M.bas).toFixed(1)}Z`
        : "");
      fins.push(pts.length ? { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y } : null);
    });
    return { courbes, aires, fins };
  })();

  const seule = series.length === 1;
  const anneesAxe = annees.length <= 2 ? annees : [a0, annees[Math.floor((annees.length - 1) / 2)], a1];

  // Curseur tactile : année la plus proche du doigt (positions figées en refs
  // pour rester fluide, responder jamais cédé au défilement parent)
  const viserAnnee = (px: number) => {
    const l = largeurRef.current;
    const borne = Math.min(Math.max(px, 0), l);
    let meilleur = annees[0], dist = Infinity;
    for (const a of annees) { const d = Math.abs(x(a) - borne); if (d < dist) { dist = d; meilleur = a; } }
    setCurseur(prev => {
      if (prev === meilleur) return prev;
      if (prev !== null) cran(); // crantage haptique à chaque changement d'année
      return meilleur;
    });
  };
  const lecturesCurseur = curseur === null ? [] : series
    .map((s, i) => {
      const valeur = s.data.find(d => d.annee === curseur)?.valeur ?? null;
      // Delta vs l'année précédente disponible de la même série
      const avant = s.data.filter(d => d.valeur !== null && d.annee < curseur);
      const prec = avant.length ? avant.reduce((m, d) => (d.annee > m.annee ? d : m)) : null;
      const delta = valeur !== null && prec && prec.valeur !== 0
        ? (valeur - prec.valeur!) / Math.abs(prec.valeur!) * 100 : null;
      return { nom: s.nom, couleur: s.couleur, i, valeur, delta };
    })
    .filter(l => l.valeur !== null) as { nom: string; couleur: string; i: number; valeur: number; delta: number | null }[];

  const bulleL = seule ? 158 : 216;
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

        <CourbesAnimees series={series} seule={seule} gradBase={gradBase} trace={trace}
          dCourbes={dessins.courbes} dAires={dessins.aires} fins={dessins.fins} />

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
              {l.delta !== null && (
                <TexteRN style={{ fontSize: 9.5, fontFamily: POLICE.gras, color: l.delta >= 0 ? "#7FE0A7" : "#FCA5A5", fontVariant: ["tabular-nums"] }} numberOfLines={1}>
                  {l.delta >= 0 ? "▲" : "▼"} {Math.abs(l.delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                </TexteRN>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default memo(GrapheLignes);
