// Investissements nationaux (BDEF · ANSD) — la grammaire EXACTE des sections
// IDE : un curseur d'années, puis UNE carte vedette — le Chiffre d'affaires
// par défaut (micro-étiquette, badge de la vue, nombre en 38 pt qui compte,
// variation vs N-1 fléchée, silhouette Skia sans axes, bornes) — et TOUS les
// autres indicateurs BDEF en repères, un par ligne, la tendance en glyphe
// teinté. Toucher un repère l'installe en vedette.
//
// La vue se choisit dans l'en-tête (Global des secteurs, macro-secteur,
// groupe ou secteur) ; le badge de la carte ouvre le même sélecteur.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, EtatVide, IconeTendance, Tapable } from "@/components/ui";
import CurseurAnnees from "@/components/CurseurAnnees";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import type { SelNational } from "@/components/SourceNationalSheet";
import { getJson } from "@/lib/api";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";

type BdefIndic = { code: string; libelle: string; unite: string; categorie: string; valeurs: Record<string, number | null> };

// L'indicateur qui ouvre la lecture — le chiffre d'affaires, comme le site
const VEDETTE_DEFAUT = "act_ca";

// Montants en FCFA réels (fichier source en millions de FCFA) — règle du site
export function fmtBdef(v: number | null, unite: string, court = false): string {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  const nf1 = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  if (unite === "%") return `${nf1(v)} %`;
  if (unite === "ratio") return v.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  if (unite === "jours") return `${Math.round(v)} j`;
  const suf = court ? "" : " FCFA";
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf1(v / 1e9)} Md${suf}`;
  if (a >= 1e6) return `${nf1(v / 1e6)} M${suf}`;
  if (a >= 1e3) return `${Math.round(v / 1e3).toLocaleString("fr-FR")} k${suf}`;
  return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
}

export default function NationalPanel({ sel, onOuvrirSource }: {
  sel: SelNational; onOuvrirSource: () => void;
}) {
  const [actif, setActif] = useState<string>(VEDETTE_DEFAUT);
  const [anneeSel, setAnneeSel] = useState<number | null>(null);
  const [largeurTendance, setLargeurTendance] = useState(0);
  const [listeDepliee, setListeDepliee] = useState(false);

  const qs = sel.niveau === "global" ? "niveau=global" : `niveau=${sel.niveau}&cible_id=${sel.cible_id}`;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bdef-valeurs", qs], queryFn: () => getJson<any>(`/bdef/valeurs?${qs}`),
  });
  const indicateurs: BdefIndic[] = data?.indicateurs || [];
  const annees: number[] = useMemo(() =>
    (data?.annees || []).slice().sort((a: number, b: number) => a - b), [data]);

  // La vedette repart sur le chiffre d'affaires quand la vue change
  useEffect(() => { setActif(VEDETTE_DEFAUT); setListeDepliee(false); }, [sel.niveau, sel.cible_id]);
  useEffect(() => {
    if (anneeSel != null && !annees.includes(anneeSel)) setAnneeSel(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annees.join(",")]);

  if (isLoading) return <SqueletteDonnees />;
  if (isError) return <EtatErreur onRetry={() => refetch()} />;
  if (!indicateurs.length) return (
    <EtatVide texte="Investissements nationaux"
      sousTexte="Les indicateurs BDEF seront disponibles après leur import dans l'administration." />
  );

  // La série d'un indicateur, coupée à l'année du curseur
  const serieDe = (ind: BdefIndic) => annees
    .filter(a => anneeSel == null || a <= anneeSel)
    .map(a => ({ annee: a, valeur: ind.valeurs[a] ?? null }))
    .filter((pt): pt is { annee: number; valeur: number } => pt.valeur != null);

  const indActif = indicateurs.find(i => i.code === actif) || indicateurs[0];
  const serie = serieDe(indActif);
  const dernier = serie.at(-1) ?? null;
  const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
  const delta = dernier && precedent && precedent.valeur !== 0
    ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
  const hausse = (delta ?? 0) >= 0;

  const autres = indicateurs.filter(i => i.code !== indActif.code);
  const visibles = listeDepliee ? autres : autres.slice(0, 5);

  return (
    <View style={s.rangee}>
      {/* Le curseur d'années — le doigt remonte le temps */}
      {annees.length > 1 && (
        <CurseurAnnees annees={annees}
          valeur={anneeSel ?? annees[annees.length - 1]}
          onChange={a => setAnneeSel(a === annees[annees.length - 1] ? null : a)} />
      )}

      <View style={s.vedette}>
        <View style={s.vedetteEnTete}>
          <Text style={s.etiquette} numberOfLines={1}>
            {indActif.libelle.toUpperCase()}{dernier ? ` · ${dernier.annee}` : ""}
          </Text>
          {/* La vue en badge — le tap ouvre le sélecteur */}
          <Pressable onPress={() => { tick(); onOuvrirSource(); }} style={s.badgeVue}>
            <Text style={s.badgeVueTexte} numberOfLines={1}>{sel.libelle}</Text>
          </Pressable>
        </View>

        {dernier ? (
          <View style={s.nombreLigne}>
            <ChiffreAnime texte={fmtBdef(dernier.valeur, indActif.unite)} style={s.nombre} />
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
            <MiniTendance valeurs={serie.map(x => x.valeur)} largeur={largeurTendance} couleur={T.bleu as string} />
          )}
        </View>
        {serie.length > 1 && (
          <View style={s.bornes}>
            <Text style={s.borne}>{serie[0].annee}</Text>
            <Text style={s.borne}>{dernier!.annee}</Text>
          </View>
        )}

        {/* Les autres indicateurs, un par ligne — cinq d'abord, tous à la demande */}
        <View style={s.pied}>
          {visibles.map((ind, i) => {
            const sx = serieDe(ind);
            const d = sx.at(-1) ?? null;
            const p = sx.length > 1 ? sx[sx.length - 2] : null;
            const dpc = d && p && p.valeur !== 0 ? ((d.valeur - p.valeur) / Math.abs(p.valeur)) * 100 : null;
            return (
              <Tapable key={ind.code} echelle={0.98}
                onPress={() => { tick(); setActif(ind.code); }}
                style={[s.repere, i > 0 && s.repereBord]}>
                <Text style={s.repereLabel} numberOfLines={2}>{ind.libelle.toUpperCase()}</Text>
                <Text style={s.repereValeur} numberOfLines={1}>
                  {d ? fmtBdef(d.valeur, ind.unite, true) : "—"}
                </Text>
                <IconeTendance delta={dpc} />
              </Tapable>
            );
          })}
          {autres.length > 5 && (
            <Tapable echelle={0.98} onPress={() => { tick(); setListeDepliee(v => !v); }}
              style={[s.repere, s.repereBord, { justifyContent: "center" }]}>
              <Text style={s.deplierTexte}>
                {listeDepliee ? "Réduire la liste" : `Voir les ${autres.length - 5} autres indicateurs`}
              </Text>
              <Icone sf={listeDepliee ? "chevron.up" : "chevron.down"}
                materiel={listeDepliee ? "expand_less" : "expand_more"}
                taille={14} couleur={T.bleu} />
            </Tapable>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rangee: { paddingHorizontal: 16, marginTop: 14 },

  // La carte vedette — les styles exacts de l'accueil
  vedette: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  vedetteEnTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  badgeVue: {
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: "rgba(0,79,145,0.22)", maxWidth: 160,
  },
  badgeVueTexte: { fontSize: 11, fontFamily: POLICE.gras, color: T.bleu },
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
  repereLabel: { flex: 1, minWidth: 0, fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8, lineHeight: 13 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
  deplierTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.bleu },
});
