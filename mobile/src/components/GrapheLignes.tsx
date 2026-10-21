// Graphe en lignes multi-séries — rendu Skia signature : courbes avec
// glow et ombre portée, aires en dégradé riche, tracé progressif (trim) au
// premier rendu seulement — ensuite les courbes changent en place —,
// scrubbing aimanté exécuté sur le fil UI (ressort vif), annotation du
// pic historique en mono-série.
// Les règles du site sont inchangées : graduations « propres »,
// lissage Catmull-Rom, double échelle quand les amplitudes divergent
// (ratio > 4, graduations aux couleurs des deux séries).
import {
  BlurMask, Canvas, Circle, DashPathEffect, Group,
  LinearGradient as DegradeSkia, Line as LigneSkia, Path as CheminSkia,
  Skia, vec,
} from "@shopify/react-native-skia";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text as TexteRN, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS, useDerivedValue, useSharedValue, withSpring, withTiming,
} from "react-native-reanimated";
import { DUREE, RESSORT, SORTIE } from "@/lib/motion";
import { coin, POLICE, T } from "@/theme";
import { creerStyles, resoudre, useSombre } from "@/lib/apparence";

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

// Lissage Catmull-Rom → courbes de Bézier cubiques (chemin SVG)
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

// ── Une série : aire riche, ombre portée, glow, ligne — tracée au premier rendu ─
function CourbeSerie({ courbe, aire: aireSvg, trace, couleur, epaisseur, hauteur }: {
  courbe: string; aire: string; trace: any; couleur: string; epaisseur: number; hauteur: number;
}) {
  const cheminVide = useMemo(() => Skia.Path.Make(), []);
  const chemin = useMemo(() => Skia.Path.MakeFromSVGString(courbe) ?? cheminVide, [courbe, cheminVide]);
  const aire = useMemo(() => Skia.Path.MakeFromSVGString(aireSvg) ?? cheminVide, [aireSvg, cheminVide]);

  const aireOpacite = useDerivedValue(() => Math.max(0, Math.min(1, (trace.value - 0.4) / 0.6)));
  const ombreOpacite = useDerivedValue(() => 0.22 * Math.max(0, Math.min(1, (trace.value - 0.2) / 0.8)));

  return (
    <Group>
      {/* Aire : dégradé riche sous la courbe */}
      <CheminSkia path={aire} style="fill" opacity={aireOpacite}>
        <DegradeSkia start={vec(0, 0)} end={vec(0, hauteur)}
          colors={[`${couleur}4D`, `${couleur}12`, `${couleur}00`]} positions={[0, 0.55, 1]} />
      </CheminSkia>
      {/* Ombre portée de la ligne */}
      <Group transform={[{ translateY: 6 }]}>
        <CheminSkia path={chemin} style="stroke" strokeWidth={epaisseur + 0.5} color={couleur}
          opacity={ombreOpacite} start={0} end={trace} strokeJoin="round" strokeCap="round">
          <BlurMask blur={6} style="normal" />
        </CheminSkia>
      </Group>
      {/* Glow : halo doux le long de la courbe */}
      <CheminSkia path={chemin} style="stroke" strokeWidth={epaisseur * 3.2} color={couleur}
        opacity={0.14} start={0} end={trace} strokeJoin="round" strokeCap="round">
        <BlurMask blur={5} style="normal" />
      </CheminSkia>
      {/* La ligne */}
      <CheminSkia path={chemin} style="stroke" strokeWidth={epaisseur} color={couleur}
        start={0} end={trace} strokeJoin="round" strokeCap="round" />
    </Group>
  );
}

function GrapheLignes({ series: seriesBrutes, hauteur = 170, fmt, epure, echelleUnique }: {
  series: Serie[]; hauteur?: number; fmt: (v: number | null) => string;
  // Mode épuré : ni grille ni graduations d'ordonnées — la courbe seule,
  // comme une sparkline qui aurait gardé le scrubbing, le pic et les années
  epure?: boolean;
  // Une seule échelle, même quand les amplitudes divergent : deux séries de
  // MÊME grandeur (les deux sens d'un échange) ne se lisent pas sur deux axes,
  // où des ordres de grandeur différents feraient se croiser leurs courbes
  echelleUnique?: boolean;
}) {
  // Skia n'accepte que des chaînes : les teintes des séries, qui peuvent
  // venir des jetons dynamiques du thème, sont résolues en entrée
  const sombre = useSombre();
  const series = useMemo(
    () => seriesBrutes.map(sr => ({ ...sr, couleur: resoudre(sr.couleur, sombre) })),
    [seriesBrutes, sombre]);
  // Les jetons du thème que le CANEVAS emploie passent par la même porte. Sur
  // iOS, un jeton est un objet DynamicColorIOS, et Skia lève « Invalid color
  // type: object » sur le fil UI : l'app se ferme net dès que le point
  // terminal se dessine. L'aperçu web, où les jetons sont des chaînes, ne
  // pouvait pas le montrer.
  const carte = resoudre(T.carte, sombre) as string;
  const grille = resoudre(T.grille, sombre) as string;
  const grilleZero = resoudre(T.grilleZero, sombre) as string;
  const [largeur, setLargeur] = useState(0);
  const [curseur, setCurseur] = useState<number | null>(null);

  // Le tracé progressif (trim) — seul mouvement du graphe, à son premier rendu
  const trace = useSharedValue(0);

  const annees = useMemo(() =>
    [...new Set(series.flatMap(s => s.data.filter(d => d.valeur !== null).map(d => d.annee)))].sort((a, b) => a - b),
  [series]);
  const vide = !annees.length;

  const M = { haut: 10, droite: 10, bas: 22, gauche: 10 };

  // ── Géométrie (identique à la version précédente) ──
  const geo = useMemo(() => {
    if (vide || largeur === 0) return null;
    const plages = series.map(s => {
      const vals = s.data.filter(d => d.valeur !== null).map(d => d.valeur!) as number[];
      if (!vals.length) return null;
      return { min: Math.min(...vals), max: Math.max(...vals), amplitude: Math.max(...vals) - Math.min(...vals) || Math.abs(vals[0]) || 1 };
    });
    const amplitudes = plages.filter(Boolean).map(p => p!.amplitude);
    const bi = !echelleUnique && series.length >= 2 && amplitudes.length >= 2 &&
      Math.max(...amplitudes) / Math.max(1e-9, Math.min(...amplitudes)) > 4;
    const toutes = series.flatMap(s => s.data.map(d => d.valeur)).filter((v): v is number => v !== null);
    const ticksPartages = graduations(Math.min(...toutes), Math.max(...toutes));
    const echelles = series.map((_, i) => (!bi || !plages[i]) ? ticksPartages : graduations(plages[i]!.min, plages[i]!.max));
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
    const courbes: string[] = [], aires: string[] = [], fins: ({ x: number; y: number } | null)[] = [];
    series.forEach((_, i) => {
      const pts = pointsDe(i);
      courbes.push(pts.length >= 2 ? lisser(pts) : "");
      aires.push(pts.length >= 2
        ? `${lisser(pts)}L${pts[pts.length - 1].x.toFixed(1)},${(hauteur - M.bas).toFixed(1)}L${pts[0].x.toFixed(1)},${(hauteur - M.bas).toFixed(1)}Z`
        : "");
      fins.push(pts.length ? { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y } : null);
    });
    // Pic historique de la série unique (annotation signature)
    let pic: { x: number; y: number; annee: number; valeur: number } | null = null;
    if (series.length === 1) {
      const pts = pointsDe(0);
      if (pts.length >= 3) pic = pts.reduce((m, p) => (p.valeur > m.valeur ? p : m));
    }
    return { bi, ticksPartages, echelles, yDe, x, a0, a1, pointsDe, courbes, aires, fins, pic };
  }, [series, largeur, hauteur, annees, vide, echelleUnique]);

  // ── Le tracé progressif, UNE FOIS : au premier rendu des courbes. Ensuite,
  // une autre série, une autre période remplacent la courbe EN PLACE : la
  // déformer de l'une vers l'autre la faisait onduler, la retracer à chaque
  // toucher clignotait — des effets de trop pour un tableau de bord.
  const dejaTrace = useRef(false);
  const geoPrete = geo !== null;
  useEffect(() => {
    if (!geoPrete || dejaTrace.current) return;
    dejaTrace.current = true;
    trace.value = 0;
    trace.value = withTiming(1, { duration: DUREE.longue + 320, easing: SORTIE });
  }, [geoPrete, trace]);

  // ── Scrubbing aimanté sur le fil UI ──
  const xsAnnees = useMemo(() => (geo ? annees.map(a => geo.x(a)) : []), [geo, annees]);
  const curseurX = useSharedValue(-1);
  const derniereAnneeUI = useSharedValue(-1);
  const changerAnnee = (a: number | null) => setCurseur(a);
  const geste = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .onBegin(e => {
      "worklet";
      if (!xsAnnees.length) return;
      let m = 0;
      for (let i = 1; i < xsAnnees.length; i++) if (Math.abs(xsAnnees[i] - e.x) < Math.abs(xsAnnees[m] - e.x)) m = i;
      derniereAnneeUI.value = annees[m];
      curseurX.value = xsAnnees[m];
      runOnJS(changerAnnee)(annees[m]);
    })
    .onChange(e => {
      "worklet";
      if (!xsAnnees.length) return;
      let m = 0;
      for (let i = 1; i < xsAnnees.length; i++) if (Math.abs(xsAnnees[i] - e.x) < Math.abs(xsAnnees[m] - e.x)) m = i;
      if (derniereAnneeUI.value !== annees[m]) {
        derniereAnneeUI.value = annees[m];
        // Aimantation : la ligne saute à l'année au ressort vif
        curseurX.value = withSpring(xsAnnees[m], RESSORT.vif);
        runOnJS(changerAnnee)(annees[m]);
      }
    })
    .onFinalize(() => {
      "worklet";
      derniereAnneeUI.value = -1;
      runOnJS(changerAnnee)(null);
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [xsAnnees, annees]);

  const curseurP1 = useDerivedValue(() => vec(curseurX.value, M.haut));
  const curseurP2 = useDerivedValue(() => vec(curseurX.value, hauteur - M.bas));
  const finOpacite = useDerivedValue(() => Math.max(0, Math.min(1, (trace.value - 0.85) / 0.15)));

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
  if (!geo) return <View style={{ height: hauteur }} />;

  const seule = series.length === 1;
  const anneesAxe = annees.length <= 2 ? annees : [geo.a0, annees[Math.floor((annees.length - 1) / 2)], geo.a1];

  const lecturesCurseur = curseur === null ? [] : series
    .map((s, i) => {
      const valeur = s.data.find(d => d.annee === curseur)?.valeur ?? null;
      const avant = s.data.filter(d => d.valeur !== null && d.annee < curseur);
      const prec = avant.length ? avant.reduce((m, d) => (d.annee > m.annee ? d : m)) : null;
      const delta = valeur !== null && prec && prec.valeur !== 0
        ? (valeur - prec.valeur!) / Math.abs(prec.valeur!) * 100 : null;
      return { nom: s.nom, couleur: s.couleur, i, valeur, delta };
    })
    .filter(l => l.valeur !== null) as { nom: string; couleur: string; i: number; valeur: number; delta: number | null }[];

  const bulleL = seule ? 158 : 216;
  const bulleX = curseur === null ? 0 : Math.min(Math.max(geo.x(curseur) - bulleL / 2, 2), largeur - bulleL - 2);

  const ticksGauche = geo.bi ? geo.echelles[0] : geo.ticksPartages;
  const ticksDroite = geo.bi && series.length >= 2 ? geo.echelles[1] : null;

  // Annotation du pic : chip au-dessus du point, bornée dans le cadre
  const pic = geo.pic;
  const picGauche = pic ? Math.min(Math.max(pic.x - 42, 2), largeur - 88) : 0;

  return (
    <GestureDetector gesture={geste}>
      <View style={{ height: hauteur }} onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
        <Canvas style={{ width: largeur, height: hauteur }}>
          {/* Grille */}
          {!epure && ticksGauche.map(t => (
            <LigneSkia key={`g${t}`} p1={vec(M.gauche, geo.yDe(0)(t))} p2={vec(largeur - M.droite, geo.yDe(0)(t))}
              color={t === 0 ? grilleZero : grille} strokeWidth={1} />
          ))}

          {/* Séries : aire riche + ombre + glow + ligne */}
          {series.map((sr, i) => (
            geo.courbes[i] ? (
              <CourbeSerie key={sr.nom} courbe={geo.courbes[i]} aire={geo.aires[i]} trace={trace}
                couleur={sr.couleur} epaisseur={seule ? 2.6 : 2} hauteur={hauteur} />
            ) : null
          ))}

          {/* Pic historique (mono-série) : anneau sur le point */}
          {pic && (
            <Group opacity={finOpacite}>
              <Circle cx={pic.x} cy={pic.y} r={7.5} color={series[0].couleur} opacity={0.2}>
                <BlurMask blur={3.5} style="normal" />
              </Circle>
              <Circle cx={pic.x} cy={pic.y} r={4.5} color={series[0].couleur} style="stroke" strokeWidth={1.7} />
            </Group>
          )}

          {/* Point terminal de chaque série, souligné d'un glow */}
          {series.map((sr, i) => {
            const fin = geo.fins[i];
            if (!fin) return null;
            return (
              <Group key={`f${sr.nom}`} opacity={finOpacite}>
                <Circle cx={fin.x} cy={fin.y} r={7} color={sr.couleur} opacity={0.3}>
                  <BlurMask blur={4} style="normal" />
                </Circle>
                <Circle cx={fin.x} cy={fin.y} r={3.6} color={sr.couleur} />
                <Circle cx={fin.x} cy={fin.y} r={3.6} color={carte} style="stroke" strokeWidth={1.6} />
              </Group>
            );
          })}

          {/* Curseur : ligne aimantée + points */}
          {curseur !== null && (
            <Group>
              <LigneSkia p1={curseurP1} p2={curseurP2} color="rgba(26,26,46,0.30)" strokeWidth={1}>
                <DashPathEffect intervals={[3, 3]} />
              </LigneSkia>
              {lecturesCurseur.map(l => (
                <Group key={l.nom}>
                  <Circle cx={curseurX} cy={geo.yDe(l.i)(l.valeur)} r={7.5} color={l.couleur} opacity={0.25}>
                    <BlurMask blur={3.5} style="normal" />
                  </Circle>
                  <Circle cx={curseurX} cy={geo.yDe(l.i)(l.valeur)} r={4.2} color={l.couleur} />
                  <Circle cx={curseurX} cy={geo.yDe(l.i)(l.valeur)} r={4.2} color={carte} style="stroke" strokeWidth={1.8} />
                </Group>
              ))}
            </Group>
          )}
        </Canvas>

        {/* Graduations (texte RN — mêmes règles de couleur que le site) */}
        {!epure && ticksGauche.map(t => (
          <TexteRN key={`tg${t}`} style={[s.tick, { left: M.gauche, top: geo.yDe(0)(t) - 13, color: geo.bi ? series[0].couleur : T.grisClair, opacity: geo.bi ? 0.75 : 1 }]}>
            {fmt(t)}
          </TexteRN>
        ))}
        {!epure && ticksDroite && ticksDroite.map(t => (
          <TexteRN key={`td${t}`} style={[s.tick, { right: M.droite, top: geo.yDe(1)(t) - 13, color: series[1].couleur, opacity: 0.75, textAlign: "right" }]}>
            {fmt(t)}
          </TexteRN>
        ))}
        {/* Années en abscisse */}
        {anneesAxe.map(a => (
          <TexteRN key={`a${a}`} style={[s.annee, a === geo.a0 ? { left: geo.x(a) } : a === geo.a1 ? { right: largeur - geo.x(a) } : { left: geo.x(a) - 30, width: 60, textAlign: "center" }]}>
            {String(a)}
          </TexteRN>
        ))}

        {/* Chip du pic historique */}
        {pic && curseur === null && (
          <View pointerEvents="none" style={[s.picChip, { left: picGauche, top: Math.max(2, pic.y - 26) }]}>
            <TexteRN style={[s.picTexte, { color: series[0].couleur }]}>PIC · {pic.annee}</TexteRN>
          </View>
        )}

        {/* Bulle de lecture (valeur + delta vs année précédente) */}
        {curseur !== null && lecturesCurseur.length > 0 && (
          <View pointerEvents="none" style={{
            position: "absolute", top: 2, left: bulleX, width: bulleL,
            backgroundColor: "rgba(26,26,46,0.93)", borderRadius: coin(10), paddingHorizontal: 10, paddingVertical: 7,
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
    </GestureDetector>
  );
}

const s = creerStyles(() => ({
  tick: { position: "absolute", fontSize: 9, fontFamily: POLICE.normal },
  annee: { position: "absolute", bottom: 2, fontSize: 9.5, fontFamily: POLICE.normal, color: T.gris },
  picChip: {
    position: "absolute", flexDirection: "row", alignItems: "center",
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2.5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,30,60,0.16)",
    shadowColor: "#001e3c", shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  picTexte: { fontSize: 8.5, fontFamily: POLICE.gras, letterSpacing: 0.8, fontVariant: ["tabular-nums"] },
}));

export default memo(GrapheLignes);
