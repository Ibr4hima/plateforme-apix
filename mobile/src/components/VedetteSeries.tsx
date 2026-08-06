// La grammaire « une courbe à la fois » en composant partagé.
//
// La carte vedette (micro-étiquette, nombre en 34 pt qui compte, variation
// vs N-1 fléchée à côté, graphe signature Skia épuré, légende de lecture en
// multi-séries) et, dessous, les autres séries en rangées commutables :
// libellé, dernière valeur (par série et en couleur quand on compare),
// sparkline en mono-série — toucher une rangée l'installe en vedette.
//
// C'est le pattern des écrans Investissements (IDE, Nationaux) ; les panneaux
// des Échanges commerciaux le consomment via ce composant.
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChiffreAnime, Tapable } from "@/components/ui";
import GrapheLignes, { Serie } from "@/components/GrapheLignes";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";

export type GrapheVedette = {
  cle: string;
  label: string;
  fmt: (v: number | null) => string;
  series: Serie[];
};

// Dernier point / précédent d'une série
export function bilanSerie(sr?: Serie) {
  const pts = (sr?.data || []).filter(d => d.valeur !== null);
  if (!pts.length) return null;
  const dernier = pts[pts.length - 1];
  const prec = pts.length > 1 ? pts[pts.length - 2] : null;
  let delta: number | null = null;
  if (prec && prec.valeur) {
    const pct = (dernier.valeur! - prec.valeur!) / Math.abs(prec.valeur!) * 100;
    if (isFinite(pct)) delta = pct;
  }
  return { dernier, prec, delta, valeurs: pts.map(p => p.valeur as number) };
}

const fmtPct = (v: number) => Math.abs(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default function VedetteSeries({ graphes }: { graphes: GrapheVedette[] }) {
  const [actif, setActif] = useState(0);
  const structure = graphes.map(g => g.cle).join("|");
  // La vedette repart en tête quand le jeu de séries change
  useEffect(() => { setActif(0); }, [structure]);

  const idx = Math.min(actif, Math.max(0, graphes.length - 1));
  const gActive = graphes[idx];
  const multi = (gActive?.series.length ?? 0) > 1;
  const bilan = useMemo(() => gActive ? bilanSerie(gActive.series[0]) : null, [gActive]);
  const hausse = (bilan?.delta ?? 0) >= 0;
  const autres = graphes.map((g, i) => ({ g, i })).filter(x => x.i !== idx);

  if (!gActive) return null;

  return (
    <>
      {/* ── La vedette ── */}
      <View style={s.rangee}>
        <View style={s.vedette}>
          <Text style={s.etiquette} numberOfLines={1}>
            {gActive.label.toUpperCase()}{!multi && bilan ? ` · ${bilan.dernier.annee}` : ""}
          </Text>
          {!multi && bilan && (
            <View style={s.nombreLigne}>
              <ChiffreAnime texte={gActive.fmt(bilan.dernier.valeur)} style={s.nombre} />
              {bilan.delta !== null && (
                <View style={s.deltaLigne}>
                  <Icone sf={hausse ? "arrow.up.right" : "arrow.down.right"}
                    materiel={hausse ? "north_east" : "south_east"}
                    taille={12} couleur={hausse ? T.vert : "#dc2626"} poids="bold" />
                  <Text style={[s.deltaTexte, { color: hausse ? T.vert : "#dc2626" }]}>{fmtPct(bilan.delta)} %</Text>
                  <Text style={s.deltaContexte}>vs {bilan.prec!.annee}</Text>
                </View>
              )}
            </View>
          )}
          <View style={{ marginTop: multi ? 4 : 10 }}>
            <GrapheLignes series={gActive.series} hauteur={multi ? 190 : 172} fmt={gActive.fmt} epure />
          </View>
          {/* En multi-séries, la lecture vit sous la courbe */}
          {multi && (
            <View style={s.legende}>
              {gActive.series.map(sr => {
                const b = bilanSerie(sr);
                const bHausse = (b?.delta ?? 0) >= 0;
                return (
                  <View key={sr.nom} style={s.legendeLigne}>
                    <View style={[s.point, { backgroundColor: sr.couleur }]} />
                    <Text style={s.legendeNom} numberOfLines={1}>{sr.nom}</Text>
                    {b?.dernier && <Text style={s.legendeAnnee}>{b.dernier.annee}</Text>}
                    <Text style={s.legendeValeur}>{b ? gActive.fmt(b.dernier.valeur) : "—"}</Text>
                    {b?.delta != null ? (
                      <View style={s.legendeDelta}>
                        <Icone sf={bHausse ? "arrow.up.right" : "arrow.down.right"}
                          materiel={bHausse ? "north_east" : "south_east"}
                          taille={10} couleur={bHausse ? T.vert : "#dc2626"} poids="bold" />
                        <Text style={[s.legendeDeltaTexte, { color: bHausse ? T.vert : "#dc2626" }]}>{fmtPct(b.delta)} %</Text>
                      </View>
                    ) : <View style={s.legendeDelta} />}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* ── Les autres séries — rangées commutables ── */}
      {autres.length > 0 && (
        <View style={s.rangee}>
          <View style={s.carteListe}>
            {autres.map(({ g, i }, pos) => {
              const b = bilanSerie(g.series[0]);
              const bHausse = (b?.delta ?? 0) >= 0;
              const rMulti = g.series.length > 1;
              return (
                <Tapable key={g.cle} echelle={0.99}
                  onPress={() => { tick(); setActif(i); }}
                  style={[s.serieLigne, pos > 0 && s.serieLigneBord]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.serieLabel} numberOfLines={1}>{g.label}</Text>
                    {rMulti ? (
                      <View style={s.serieSous}>
                        {g.series.map(sr => {
                          const bs = bilanSerie(sr);
                          return (
                            <Text key={sr.nom} style={[s.serieValeur, { color: sr.couleur }]}>
                              {bs ? g.fmt(bs.dernier.valeur) : "—"}
                            </Text>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={s.serieSous}>
                        <Text style={s.serieValeur}>{b ? g.fmt(b.dernier.valeur) : "—"}</Text>
                        {b?.delta != null && (
                          <Text style={[s.serieDelta, { color: bHausse ? T.vert : "#dc2626" }]}>
                            {bHausse ? "+" : "−"}{fmtPct(b.delta)} %
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  {!rMulti && b && b.valeurs.length > 1 && (
                    <MiniTendance valeurs={b.valeurs} largeur={72} hauteur={30}
                      couleur={g.series[0]?.couleur || (T.bleu as string)} />
                  )}
                </Tapable>
              );
            })}
          </View>
        </View>
      )}
    </>
  );
}

const s = creerStyles(() => ({
  rangee: { paddingHorizontal: 16, marginTop: 14 },
  vedette: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, overflow: "hidden",
  },
  etiquette: { ...TYPO.micro, color: T.gris },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 34, lineHeight: 40, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -0.8, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexte: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },

  point: { width: 7, height: 7, borderRadius: 4 },
  legende: {
    marginTop: 8, paddingTop: 4, paddingBottom: 6, gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  legendeLigne: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 4 },
  legendeNom: { flex: 1, minWidth: 0, fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre },
  legendeAnnee: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.grisClair, fontVariant: ["tabular-nums"] },
  legendeValeur: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  legendeDelta: { flexDirection: "row", alignItems: "center", gap: 2, minWidth: 58, justifyContent: "flex-end" },
  legendeDeltaTexte: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },

  carteListe: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16,
  },
  serieLigne: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 11 },
  serieLigneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  serieLabel: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  serieSous: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 2, flexWrap: "wrap" },
  serieValeur: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.texte, fontVariant: ["tabular-nums"] },
  serieDelta: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
}));
