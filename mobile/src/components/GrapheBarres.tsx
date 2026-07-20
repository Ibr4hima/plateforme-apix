// Barres horizontales (classements) et barres empilées par ressource —
// versions app des graphes de flux bilatéraux du site. Longueurs en
// racine carrée (même règle que le web) pour garder les petites valeurs
// visibles ; dégradé bleu institutionnel pour les segments empilés.
import { StyleSheet, Text, View } from "react-native";
import { POLICE, T } from "@/theme";

// Dégradé du site : interpolation #003468 → #EDF4FB
export function degradeBleu(i: number, n: number): string {
  const t = n > 1 ? i / (n - 1) : 0;
  const a = [0x00, 0x34, 0x68], b = [0xED, 0xF4, 0xFB];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * t));
  return `#${c.map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

// ── Classement en barres horizontales ────────────────────────────────────────
export function BarresH({ data, fmt, couleur = T.bleu }: {
  data: { label: string; valeur: number }[]; fmt: (v: number) => string; couleur?: string;
}) {
  if (!data.length) return <Text style={s.vide}>Aucune donnée</Text>;
  const max = Math.max(...data.map(d => d.valeur));
  return (
    <View style={{ gap: 11 }}>
      {data.map(d => (
        <View key={d.label}>
          <View style={s.ligne}>
            <Text style={s.label} numberOfLines={1}>{d.label}</Text>
            <Text style={s.valeur}>{fmt(d.valeur)}</Text>
          </View>
          <View style={s.piste}>
            <View style={[s.barre, { width: `${Math.max(3, Math.sqrt(d.valeur / max) * 100)}%`, backgroundColor: couleur }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Barres empilées : partenaires × ressources ───────────────────────────────
// Sous chaque barre, la répartition détaillée du pays (carré de couleur,
// ressource, part réelle en %), puis un filet fin avant le pays suivant.
export function BarresEmpilees({ partenaires, ressources, fmt }: {
  partenaires: { nom: string; total: number; valeurs: number[] }[];
  ressources: string[];
  fmt: (v: number) => string;
}) {
  if (!partenaires.length) return <Text style={s.vide}>Aucune donnée</Text>;
  const max = Math.max(...partenaires.map(p => p.total));
  return (
    <View>
      {partenaires.map((p, pi) => {
        // Ressources du pays, de la plus forte à la plus faible
        const parts = ressources
          .map((nom, i) => ({ nom, i, valeur: p.valeurs[i] || 0 }))
          .filter(r => r.valeur > 0)
          .sort((a, b) => b.valeur - a.valeur);
        return (
          <View key={p.nom}>
            {pi > 0 && <View style={s.separation} />}
            <View style={s.ligne}>
              <Text style={s.label} numberOfLines={1}>{p.nom}</Text>
              <Text style={s.valeur}>{fmt(p.total)}</Text>
            </View>
            <View style={[s.piste, { flexDirection: "row", overflow: "hidden" }]}>
              <View style={{ flexDirection: "row", width: `${Math.max(3, Math.sqrt(p.total / max) * 100)}%` }}>
                {parts.map(r => (
                  <View key={r.i} style={{ flex: r.valeur / p.total, backgroundColor: degradeBleu(r.i, ressources.length) }} />
                ))}
              </View>
            </View>
            <View style={s.repartition}>
              {parts.map(r => (
                <View key={r.nom} style={s.repartitionLigne}>
                  <View style={[s.legendeCarre, { backgroundColor: degradeBleu(r.i, ressources.length) }]} />
                  <Text style={s.repartitionNom} numberOfLines={1}>{r.nom}</Text>
                  <Text style={s.repartitionPct}>{(r.valeur / p.total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  vide: { fontSize: 11.5, fontFamily: POLICE.normal, color: T.grisClair, textAlign: "center", paddingVertical: 18 },
  ligne: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 5 },
  label: { flex: 1, fontSize: 12, fontFamily: POLICE.demi, color: T.encre },
  valeur: { fontSize: 11.5, fontFamily: POLICE.gras, color: T.texte, fontVariant: ["tabular-nums"] },
  piste: { height: 8, backgroundColor: T.grille, borderRadius: 99, overflow: "hidden" },
  barre: { height: "100%", borderRadius: 99 },
  legendeCarre: { width: 9, height: 9, borderRadius: 2.5, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.15)" },
  separation: { height: 1, backgroundColor: T.filet, marginVertical: 13 },
  repartition: { gap: 5, marginTop: 9 },
  repartitionLigne: { flexDirection: "row", alignItems: "center", gap: 7 },
  repartitionNom: { flex: 1, fontSize: 11, fontFamily: POLICE.normal, color: T.texte },
  repartitionPct: { fontSize: 11, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
});
