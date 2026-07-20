// Anneau « poids des ressources » — version app du donut du site :
// angles pondérés en racine carrée pour garder les petites parts
// visibles, total réel au centre, légende avec les vraies proportions.
import { StyleSheet, Text, View } from "react-native";
import Svg, { G, Path, Text as TexteSvg } from "react-native-svg";
import { degradeBleu } from "@/components/GrapheBarres";
import { POLICE, T } from "@/theme";

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  // Secteur d'anneau entre les angles a0 → a1 (radians, 0 en haut, horaire)
  const pt = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`;
  const grand = a1 - a0 > Math.PI ? 1 : 0;
  return `M${pt(r1, a0)}A${r1},${r1} 0 ${grand} 1 ${pt(r1, a1)}L${pt(r0, a1)}A${r0},${r0} 0 ${grand} 0 ${pt(r0, a0)}Z`;
}

export default function GrapheDonut({ data, fmt, centre }: {
  data: { label: string; valeur: number }[]; fmt: (v: number) => string;
  centre?: string; // texte central (par défaut : total formaté)
}) {
  const positifs = data.filter(d => d.valeur > 0);
  const total = positifs.reduce((somme, d) => somme + d.valeur, 0);
  if (!positifs.length || total <= 0) return <Text style={s.vide}>Aucune donnée</Text>;

  const TAILLE = 172, R = TAILLE / 2 - 4, R0 = R * 0.6, cx = TAILLE / 2, cy = TAILLE / 2;
  // Angles pondérés en racine (règle du site) ; les % affichés restent réels
  const poids = positifs.map(d => Math.sqrt(d.valeur));
  const sommePoids = poids.reduce((a, b) => a + b, 0);
  let angle = 0;
  const secteurs = positifs.map((d, i) => {
    const a0 = angle, a1 = angle + poids[i] / sommePoids * Math.PI * 2;
    angle = a1;
    return { ...d, a0, a1: Math.min(a1, a0 + Math.PI * 2 - 0.0001), i };
  });

  return (
    <View style={{ alignItems: "center", gap: 14 }}>
      <Svg width={TAILLE} height={TAILLE}>
        <G>
          {secteurs.map(sec => (
            <Path key={sec.label} d={arc(cx, cy, R0, R, sec.a0, sec.a1)}
              fill={degradeBleu(sec.i, secteurs.length)} opacity={0.92} />
          ))}
        </G>
        <TexteSvg x={cx} y={cy - 2} fontSize={17} fontFamily={POLICE.gras} fill={T.encre} textAnchor="middle">{centre ?? fmt(total)}</TexteSvg>
        <TexteSvg x={cx} y={cy + 14} fontSize={9.5} fontFamily={POLICE.normal} fill={T.gris} textAnchor="middle">total</TexteSvg>
      </Svg>
      <View style={s.legende}>
        {secteurs.map(sec => (
          <View key={sec.label} style={s.legendeLigne}>
            <View style={[s.carre, { backgroundColor: degradeBleu(sec.i, secteurs.length) }]} />
            <Text style={s.legendeTexte} numberOfLines={1}>{sec.label}</Text>
            <Text style={s.legendePct}>{(sec.valeur / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  vide: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.grisClair, textAlign: "center", paddingVertical: 18 },
  legende: { alignSelf: "stretch", gap: 6 },
  legendeLigne: { flexDirection: "row", alignItems: "center", gap: 8 },
  carre: { width: 10, height: 10, borderRadius: 2.5, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.15)" },
  legendeTexte: { flex: 1, fontSize: 11.5, fontFamily: POLICE.normal, color: T.texte },
  legendePct: { fontSize: 11.5, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
});
