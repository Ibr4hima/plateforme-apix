// FLUX & STOCKS — la première section de l'onglet IDE, la grammaire EXACTE
// de la carte vedette de l'accueil : les Flux entrants en vedette
// (micro-étiquette, badge « Sénégal » bleu sans point, nombre en 38 pt qui
// compte, variation vs N-1 fléchée, silhouette Skia sans axes, bornes) et
// CINQ repères — Flux sortants, Stock entrant, Stock sortant, Flux net,
// Stock net — un par ligne, la tendance en glyphe teinté. Toucher un repère
// l'installe en vedette ; le curseur d'années au-dessus remonte le temps.
//
// Flux net et Stock net se calculent ici : entrant − sortant, année par
// année, sur les couples complets. Valeurs CNUCED en millions USD.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatVide, IconeTendance, Permutation, RangeeMouvante, SeparateurSection, Tapable } from "@/components/ui";
import CurseurAnnees from "@/components/CurseurAnnees";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { getJson } from "@/lib/api";
import { SourceIde, libelleSource, useSeriesIde } from "@/lib/ideSource";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";

type CleSerie = "flux_e" | "flux_s" | "stock_e" | "stock_s" | "flux_net" | "stock_net";
const LABELS: Record<CleSerie, string> = {
  flux_e: "FLUX ENTRANTS", flux_s: "FLUX SORTANTS",
  stock_e: "STOCK ENTRANT", stock_s: "STOCK SORTANT",
  flux_net: "FLUX NET", stock_net: "STOCK NET",
};
const ORDRE: CleSerie[] = ["flux_e", "flux_s", "stock_e", "stock_s", "flux_net", "stock_net"];
const INDICATEURS = ["flux", "stock"];

type Point = { annee: number; valeur: number };

// Valeurs CNUCED en millions USD (règle d'affichage du site)
const fmtMusd = (v: number | null): string => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md $`;
  return `${Math.round(v).toLocaleString("fr-FR")} M $`;
};

export default function IdeFluxStocksPanel({ source, onOuvrirSource }: {
  source: SourceIde; onOuvrirSource: () => void;
}) {
  const [actif, setActif] = useState<CleSerie>("flux_e");
  const [anneeSel, setAnneeSel] = useState<number | null>(null);
  const [largeurTendance, setLargeurTendance] = useState(0);

  // Les bornes de la catégorie, puis la série complète du Sénégal
  const { data: bornesRef } = useQuery({
    queryKey: ["ide-annees"], queryFn: () => getJson<any>("/ide/cnuced/annees"), staleTime: Infinity,
  });
  const cat = bornesRef?.categories?.fluxstock;
  const bornes: [number, number] = [cat?.annee_min ?? bornesRef?.annee_min ?? 1990, cat?.annee_max ?? bornesRef?.annee_max ?? 2025];

  const { rows, chargement } = useSeriesIde(source, INDICATEURS, bornes);

  // ── Les six séries — les quatre servies, les deux nettes calculées ──
  const series = useMemo<Record<CleSerie, Point[]>>(() => {
    const de = (dir: string, ind: string): Point[] => rows
      .filter(d => d.direction === dir && d.indicateur === ind)
      .map((d: any) => ({ annee: d.annee, valeur: d.valeur }))
      .sort((a: Point, b: Point) => a.annee - b.annee);
    const net = (e: Point[], sx: Point[]): Point[] => e
      .map(pt => {
        const so = sx.find(x => x.annee === pt.annee);
        return so ? { annee: pt.annee, valeur: pt.valeur - so.valeur } : null;
      })
      .filter((pt): pt is Point => pt != null);
    const flux_e = de("entrant", "flux"), flux_s = de("sortant", "flux");
    const stock_e = de("entrant", "stock"), stock_s = de("sortant", "stock");
    return { flux_e, flux_s, stock_e, stock_s, flux_net: net(flux_e, flux_s), stock_net: net(stock_e, stock_s) };
  }, [rows]);

  // Le calendrier du curseur : les années de la série vedette par défaut
  const anneesSerie = useMemo(() => series.flux_e.map(pt => pt.annee), [series]);
  useEffect(() => {
    if (anneeSel != null && !anneesSerie.includes(anneeSel)) setAnneeSel(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesSerie.join(",")]);

  if (chargement || !bornesRef) return <SqueletteDonnees />;
  if (!series.flux_e.length) return (
    <EtatVide texte="Flux & Stocks d'IDE"
      sousTexte="Aucune série pour cette sélection." />
  );

  const jusqu = (sx: Point[]) => anneeSel == null ? sx : sx.filter(pt => pt.annee <= anneeSel);
  const serie = jusqu(series[actif]);
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const hausse = (delta ?? 0) >= 0;
  const reperes = ORDRE.filter(c => c !== actif);

  return (
    <View style={s.rangee}>
      <SeparateurSection titre="FLUX & STOCKS" couleur={T.bleu as string} voile={T.bleuVoile as string} />

      {/* Le curseur d'années — le doigt remonte le temps */}
      <CurseurAnnees annees={anneesSerie}
        valeur={anneeSel ?? anneesSerie[anneesSerie.length - 1]}
        onChange={a => setAnneeSel(a === anneesSerie[anneesSerie.length - 1] ? null : a)} />

      <View style={s.vedette}>
        <View style={s.vedetteEnTete}>
          <Text style={s.etiquette} numberOfLines={1}>
            {LABELS[actif]}{dernier ? ` · ${dernier.annee}` : ""}
          </Text>
          {/* La source en badge, sans point — le tap ouvre le sélecteur */}
          <Pressable onPress={() => { tick(); onOuvrirSource(); }} style={s.badgePays}>
            <Text style={s.badgePaysTexte} numberOfLines={1}>{libelleSource(source)}</Text>
          </Pressable>
        </View>

        {/* Le mesureur reste monté : la Permutation rejoue à chaque
            changement de vedette, la largeur de la courbe ne se remesure pas */}
        <View onLayout={e => setLargeurTendance(e.nativeEvent.layout.width)}>
          <Permutation cle={actif}>
            {dernier ? (
              <View style={s.nombreLigne}>
                <ChiffreAnime texte={fmtMusd(dernier.valeur)} style={s.nombre} />
                {delta !== null && (
                  <View style={s.deltaLigne}>
                    <Icone sf={hausse ? "arrow.up.right" : "arrow.down.right"}
                      materiel={hausse ? "north_east" : "south_east"}
                      taille={12} couleur={hausse ? T.vert : "#dc2626"} poids="bold" />
                    <Text style={[s.deltaTexte, { color: hausse ? T.vert : "#dc2626" }]}>
                      {Math.abs(delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                    </Text>
                    <Text style={s.deltaContexte}>vs {precedent!.annee}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={s.indispo}>Donnée indisponible.</Text>
            )}

            <View style={{ marginTop: 10 }}>
              {largeurTendance > 0 && serie.length > 1 && (
                <MiniTendance valeurs={serie.map(x => x.valeur)} largeur={largeurTendance} couleur={T.bleu as string} />
              )}
            </View>
            {serie.length > 1 && (
              <View style={s.bornes}>
                <Text style={s.borne}>{serie[0].annee}</Text>
                <Text style={s.borne}>{dernier!.annee}</Text>
              </View>
            )}
          </Permutation>
        </View>

        {/* Les cinq repères, un par ligne — ils GLISSENT à leur nouvelle place
            quand l'un d'eux monte en vedette */}
        <View style={s.pied}>
          {reperes.map((cle, i) => {
            const sx = jusqu(series[cle]);
            const d = sx.at(-1) ?? null;
            const p = sx.length > 1 ? sx[sx.length - 2] : null;
            const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
            return (
              <RangeeMouvante key={cle}>
                <Tapable echelle={0.98}
                  onPress={() => { tick(); setActif(cle); }}
                  style={[s.repere, i > 0 && s.repereBord]}>
                  <Text style={s.repereLabel} numberOfLines={1}>{LABELS[cle]}</Text>
                  <Text style={s.repereValeur} numberOfLines={1}>{d ? fmtMusd(d.valeur) : "—"}</Text>
                  <IconeTendance delta={dpc} />
                </Tapable>
              </RangeeMouvante>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const s = creerStyles(() => ({
  rangee: { paddingHorizontal: 16, marginTop: 18 },

  // La carte vedette — les styles exacts de l'accueil
  vedette: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  vedetteEnTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  badgePays: {
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(0,79,145,0.22)", maxWidth: 150,
  },
  badgePaysTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 38, lineHeight: 44, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexte: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },
  indispo: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  pied: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repere: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10.5 },
  repereBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repereLabel: { flex: 1, minWidth: 0, fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
}));
