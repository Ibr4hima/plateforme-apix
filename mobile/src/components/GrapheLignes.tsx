// Graphe en lignes multi-séries (react-native-svg) — version app des
// courbes annuelles de la plateforme : grille horizontale, courbes par
// pays, points sur série unique, libellés min/max en ordonnée et
// premières/dernières années en abscisse.
import { useState } from "react";
import { Text as TexteRN, View } from "react-native";
import Svg, { Circle, Line, Path, Text as TexteSvg } from "react-native-svg";
import { POLICE, T } from "@/theme";

export type Serie = { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] };

export default function GrapheLignes({ series, hauteur = 150, fmt }: {
  series: Serie[]; hauteur?: number; fmt: (v: number | null) => string;
}) {
  const [largeur, setLargeur] = useState(0);

  const annees = [...new Set(series.flatMap(s => s.data.map(d => d.annee)))].sort((a, b) => a - b);
  const valeurs = series.flatMap(s => s.data.map(d => d.valeur)).filter((v): v is number => v !== null);
  const vide = !annees.length || !valeurs.length;

  const M = { haut: 8, droite: 10, bas: 20, gauche: 6 };
  let contenu: React.ReactNode = null;

  if (!vide && largeur > 0) {
    let min = Math.min(...valeurs), max = Math.max(...valeurs);
    if (min === max) { min -= Math.abs(min) * 0.1 || 1; max += Math.abs(max) * 0.1 || 1; }
    const marge = (max - min) * 0.08;
    min -= marge; max += marge;
    const x = (a: number) => annees.length === 1
      ? (largeur - M.droite + M.gauche) / 2
      : M.gauche + (a - annees[0]) / (annees[annees.length - 1] - annees[0]) * (largeur - M.gauche - M.droite);
    const y = (v: number) => M.haut + (max - v) / (max - min) * (hauteur - M.haut - M.bas);

    // Chemin par série, coupé sur les valeurs manquantes
    const cheminDe = (s: Serie): string => {
      let d = "", enCours = false;
      for (const pt of [...s.data].sort((a, b) => a.annee - b.annee)) {
        if (pt.valeur === null) { enCours = false; continue; }
        d += `${enCours ? "L" : "M"}${x(pt.annee).toFixed(1)},${y(pt.valeur).toFixed(1)}`;
        enCours = true;
      }
      return d;
    };

    const grille = [0.25, 0.5, 0.75].map(t => M.haut + t * (hauteur - M.haut - M.bas));
    const points = series.length === 1 && annees.length <= 14
      ? series[0].data.filter(d => d.valeur !== null) : [];
    const anneesAxe = annees.length <= 2 ? annees
      : [annees[0], annees[Math.floor((annees.length - 1) / 2)], annees[annees.length - 1]];

    contenu = (
      <Svg width={largeur} height={hauteur}>
        {grille.map((gy, i) => (
          <Line key={i} x1={M.gauche} x2={largeur - M.droite} y1={gy} y2={gy} stroke="#EFEDEA" strokeWidth={1} />
        ))}
        {series.map(s => (
          <Path key={s.nom} d={cheminDe(s)} stroke={s.couleur} strokeWidth={series.length > 1 ? 1.8 : 2.2}
            fill="none" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map(pt => (
          <Circle key={pt.annee} cx={x(pt.annee)} cy={y(pt.valeur!)} r={2.8}
            fill={series[0].couleur} stroke="#fff" strokeWidth={1.2} />
        ))}
        {anneesAxe.map(a => (
          <TexteSvg key={a} x={x(a)} y={hauteur - 5} fontSize={9.5} fill={T.gris}
            textAnchor={a === annees[0] ? "start" : a === annees[annees.length - 1] ? "end" : "middle"}>
            {String(a)}
          </TexteSvg>
        ))}
        <TexteSvg x={largeur - M.droite} y={M.haut + 8} fontSize={9} fill={T.grisClair} textAnchor="end">{fmt(max)}</TexteSvg>
        <TexteSvg x={largeur - M.droite} y={hauteur - M.bas - 3} fontSize={9} fill={T.grisClair} textAnchor="end">{fmt(min)}</TexteSvg>
      </Svg>
    );
  }

  return (
    <View style={{ height: hauteur }} onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
      {vide ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <TexteRN style={{ fontSize: 11.5, fontFamily: POLICE.normal, color: T.grisClair }}>Aucune donnée sur la période</TexteRN>
        </View>
      ) : contenu}
    </View>
  );
}
