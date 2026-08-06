// FUSION & ACQUISITION — la troisième section de l'onglet IDE, en VERT : la
// même grammaire vedette (curseur d'années, micro-étiquette, badge pays,
// nombre en 38 pt qui compte, variation vs N-1 fléchée, silhouette Skia,
// bornes), les RACHATS D'ENTREPRISES LOCALES en vedette et les ACQUISITIONS
// À L'ÉTRANGER en repère — toucher le repère l'installe en vedette.
//
// Sous la carte, le COMPTE D'OPÉRATIONS du sens en vedette, année par
// année : rachats locaux si les rachats sont en vedette, acquisitions
// sinon. Six années d'abord, la série entière à la demande.
//
// Les valeurs M&A sont NETTES (ventes moins désinvestissements) : elles
// peuvent être négatives, la mise en forme les signe donc naturellement.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChiffreAnime, IconeTendance, SeparateurSection, Tapable } from "@/components/ui";
import CurseurAnnees from "@/components/CurseurAnnees";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import { getJson } from "@/lib/api";
import { SourceIde, libelleSource, useSeriesIde } from "@/lib/ideSource";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";
import { creerStyles } from "@/lib/apparence";

type Sens = "entrant" | "sortant";
const LABELS: Record<Sens, string> = {
  entrant: "RACHATS D'ENTREPRISES LOCALES",
  sortant: "ACQUISITIONS À L'ÉTRANGER",
};
const LABELS_NOMBRE: Record<Sens, string> = {
  entrant: "NOMBRE DE RACHATS D'ENTREPRISES LOCALES",
  sortant: "NOMBRE D'ACQUISITIONS À L'ÉTRANGER",
};

type Point = { annee: number; valeur: number };

const fmtMusd = (v: number | null): string => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md $`;
  return `${Math.round(v).toLocaleString("fr-FR")} M $`;
};
const fmtNombre = (v: number | null): string =>
  v === null || v === undefined || isNaN(v) ? "—" : Math.round(v).toLocaleString("fr-FR");

const INDICATEURS = ["ma_valeur", "ma_nombre"];

export default function IdeFusionPanel({ source, onOuvrirSource }: {
  source: SourceIde; onOuvrirSource: () => void;
}) {
  const [actif, setActif] = useState<Sens>("entrant");
  const [anneeSel, setAnneeSel] = useState<number | null>(null);
  const [largeurTendance, setLargeurTendance] = useState(0);
  const [listeDepliee, setListeDepliee] = useState(false);

  // Les bornes propres aux fusions-acquisitions
  const { data: bornesRef } = useQuery({
    queryKey: ["ide-annees"], queryFn: () => getJson<any>("/ide/cnuced/annees"), staleTime: Infinity,
  });
  const cat = bornesRef?.categories?.fusion;
  const bornes: [number, number] = [cat?.annee_min ?? bornesRef?.annee_min ?? 1990, cat?.annee_max ?? bornesRef?.annee_max ?? 2025];

  const { rows } = useSeriesIde(source, INDICATEURS, bornes);

  // Les quatre séries : valeur et nombre, par sens
  const series = useMemo(() => {
    const de = (dir: string, ind: string): Point[] => rows
      .filter(d => d.direction === dir && d.indicateur === ind)
      .map(d => ({ annee: d.annee, valeur: d.valeur }))
      .sort((a: Point, b: Point) => a.annee - b.annee);
    return {
      valeur: { entrant: de("entrant", "ma_valeur"), sortant: de("sortant", "ma_valeur") },
      nombre: { entrant: de("entrant", "ma_nombre"), sortant: de("sortant", "ma_nombre") },
    };
  }, [rows]);

  const anneesSerie = useMemo(() => series.valeur.entrant.map(pt => pt.annee), [series]);
  useEffect(() => {
    if (anneeSel != null && !anneesSerie.includes(anneeSel)) setAnneeSel(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesSerie.join(",")]);

  if (!series.valeur.entrant.length) return null;

  const jusqu = (sx: Point[]) => anneeSel == null ? sx : sx.filter(pt => pt.annee <= anneeSel);
  const serie = jusqu(series.valeur[actif]);
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const hausse = (delta ?? 0) >= 0;
  const repere: Sens = actif === "entrant" ? "sortant" : "entrant";
  const sxRep = jusqu(series.valeur[repere]);
  const dRep = sxRep.at(-1) ?? null;
  const pRep = sxRep.length > 1 ? sxRep[sxRep.length - 2] : null;
  const dpcRep = dRep && pRep && pRep.valeur !== 0 ? ((dRep.valeur - pRep.valeur) / Math.abs(pRep.valeur)) * 100 : null;

  // Le compte d'opérations du sens en vedette — le plus récent d'abord
  const operations = jusqu(series.nombre[actif]).slice().reverse();
  const visibles = listeDepliee ? operations : operations.slice(0, 6);

  return (
    <View style={s.rangee}>
      <SeparateurSection titre="FUSION & ACQUISITION" couleur={T.vert as string} voile={T.vertVoile as string} />

      <CurseurAnnees annees={anneesSerie}
        valeur={anneeSel ?? anneesSerie[anneesSerie.length - 1]}
        couleur={T.vert as string} voile={T.vertVoile as string}
        onChange={a => setAnneeSel(a === anneesSerie[anneesSerie.length - 1] ? null : a)} />

      <View style={s.vedette}>
        <View style={s.vedetteEnTete}>
          <Text style={s.etiquette} numberOfLines={1}>
            {LABELS[actif]}{dernier ? ` · ${dernier.annee}` : ""}
          </Text>
          <Pressable onPress={() => { tick(); onOuvrirSource(); }} style={s.badgePays}>
            <Text style={s.badgePaysTexte} numberOfLines={1}>{libelleSource(source)}</Text>
          </Pressable>
        </View>

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

        <View style={{ marginTop: 10 }} onLayout={e => setLargeurTendance(e.nativeEvent.layout.width)}>
          {largeurTendance > 0 && serie.length > 1 && (
            <MiniTendance valeurs={serie.map(x => x.valeur)} largeur={largeurTendance} couleur={T.vert as string} />
          )}
        </View>
        {serie.length > 1 && (
          <View style={s.bornes}>
            <Text style={s.borne}>{serie[0].annee}</Text>
            <Text style={s.borne}>{dernier!.annee}</Text>
          </View>
        )}

        {/* Le sens opposé en repère */}
        <View style={s.pied}>
          <Tapable echelle={0.98} onPress={() => { tick(); setActif(repere); setListeDepliee(false); }}
            style={s.repere}>
            <Text style={s.repereLabel} numberOfLines={1}>{LABELS[repere]}</Text>
            <Text style={s.repereValeur} numberOfLines={1}>{dRep ? fmtMusd(dRep.valeur) : "—"}</Text>
            <IconeTendance delta={dpcRep} />
          </Tapable>
        </View>
      </View>

      {/* Le compte d'opérations du sens en vedette, année par année */}
      {operations.length > 0 && (
        <View style={s.carteOperations}>
          <Text style={s.operationsTitre}>{LABELS_NOMBRE[actif]}</Text>
          {visibles.map((pt, i) => {
            const idx = operations.indexOf(pt);
            const prec = operations[idx + 1] ?? null;   // la liste descend : le suivant est l'année d'avant
            const dpc = prec && prec.valeur !== 0
              ? ((pt.valeur - prec.valeur) / Math.abs(prec.valeur)) * 100 : null;
            return (
              <View key={pt.annee} style={[s.operationLigne, i > 0 && s.operationBord]}>
                <Text style={s.operationAnnee}>{pt.annee}</Text>
                <View style={{ flex: 1 }} />
                <Text style={s.operationValeur}>{fmtNombre(pt.valeur)}</Text>
                <IconeTendance delta={dpc} taille={16} />
              </View>
            );
          })}
          {operations.length > 6 && (
            <Tapable echelle={0.98} onPress={() => { tick(); setListeDepliee(v => !v); }}
              style={[s.operationLigne, s.operationBord, { justifyContent: "center" }]}>
              <Text style={s.deplierTexte}>
                {listeDepliee ? "Réduire" : `Voir les ${operations.length - 6} années précédentes`}
              </Text>
              <Icone sf={listeDepliee ? "chevron.up" : "chevron.down"}
                materiel={listeDepliee ? "expand_less" : "expand_more"}
                taille={14} couleur={T.vert} />
            </Tapable>
          )}
        </View>
      )}
    </View>
  );
}

const s = creerStyles(() => ({
  // La césure porte la respiration : la section suivante s'écarte franchement
  rangee: { paddingHorizontal: 16, marginTop: 30 },

  vedette: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  vedetteEnTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  badgePays: {
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(24,128,56,0.30)", maxWidth: 150,
  },
  badgePaysTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.vert },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 38, lineHeight: 44, fontFamily: POLICE.gras, color: T.vert, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexte: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },
  indispo: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  pied: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repere: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10.5 },
  repereLabel: { flex: 1, minWidth: 0, fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },

  // Le compte d'opérations, année par année
  carteOperations: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 6, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord, marginTop: 12,
  },
  operationsTitre: { ...TYPO.micro, color: T.gris, paddingTop: 10, paddingBottom: 4 },
  operationLigne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9.5 },
  operationBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  operationAnnee: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.gris, fontVariant: ["tabular-nums"] },
  operationValeur: { fontSize: 15, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  deplierTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.vert },
}));
