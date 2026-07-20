// Échanges commerciaux — étape 1 : onglet Indicateurs économiques,
// version app de la page web. Filtres (vue, pays, période) dans une
// feuille ouverte par le bouton filter_list du hero ; TOUS les
// indicateurs en carrousel de KPIs (pages de 4, comme l'accueil) ;
// courbes annuelles premium par indicateur (lissées, aire dégradée,
// curseur tactile), valeur du moment et variation annuelle en en-tête,
// multi-pays en comparaison. Flux bilatéraux : étape suivante.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { EtatCharge, EtatErreur } from "@/components/ui";
import CarrouselKpis, { KpiCarrousel } from "@/components/CarrouselKpis";
import CommercePanel from "@/components/CommercePanel";
import GrapheLignes, { Serie } from "@/components/GrapheLignes";
import HeroModule, { BarreHero, useHeroDefilant } from "@/components/HeroModule";
import StatistiquesFiltres, { FiltresStatistiques } from "@/components/StatistiquesFiltres";
import { getJson } from "@/lib/api";
import { COMP_PALETTE } from "@/lib/couleurs";
import { fmtUnite } from "@/lib/format";
import { POLICE, T } from "@/theme";

const ONGLETS = [
  { cle: "indicateurs", label: "Indicateurs éco." },
  { cle: "commerce",    label: "Flux bilatéraux" },
] as const;

export default function StatistiquesEcran() {
  const [onglet, setOnglet] = useState("indicateurs");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const { defilY, onScroll } = useHeroDefilant();
  const [nbFiltresCom, setNbFiltresCom] = useState(0);

  const { data: pays } = useQuery({ queryKey: ["stat-pays"], queryFn: () => getJson<any[]>("/statistiques/pays") });
  const { data: indicateurs } = useQuery({ queryKey: ["stat-indicateurs"], queryFn: () => getJson<any[]>("/statistiques/indicateurs"), staleTime: Infinity });
  const senId = useMemo(() => (pays || []).find((p: any) => p.code_iso3 === "SEN")?.id ?? null, [pays]);

  // Filtres appliqués (la feuille travaille sur un brouillon)
  const [filtres, setFiltres] = useState<FiltresStatistiques | null>(null);
  const f: FiltresStatistiques = filtres ?? {
    vue: "pays", selection: senId !== null ? [senId] : [],
    modeAnnees: "plage", anneeMin: 0, anneeMax: 9999, anneesSpec: [],
  };

  const { data: donnees, isLoading, isError, refetch } = useQuery({
    queryKey: ["stat-donnees", f.selection.join(",")],
    enabled: f.selection.length > 0,
    queryFn: () => getJson<any[]>(`/statistiques/donnees?pays=${f.selection.join(",")}`),
  });

  // Années réellement disponibles dans les données
  const anneesDispo = useMemo(() =>
    [...new Set((donnees || []).map((d: any) => d.annee))].filter((a: number) => a > 0).sort((a, b) => a - b),
  [donnees]);
  const bornes: [number, number] = anneesDispo.length ? [anneesDispo[0], anneesDispo[anneesDispo.length - 1]] : [0, 0];
  const anneeMin = Math.max(f.anneeMin, bornes[0]) || bornes[0];
  const anneeMax = Math.min(f.anneeMax, bornes[1]) || bornes[1];
  const anneesActives = useMemo(() => (
    f.modeAnnees === "specifiques" && f.anneesSpec.length
      ? anneesDispo.filter(a => f.anneesSpec.includes(a))
      : anneesDispo.filter(a => a >= anneeMin && a <= anneeMax)
  ), [anneesDispo, f.modeAnnees, f.anneesSpec, anneeMin, anneeMax]);
  const refAnnee = anneesActives[anneesActives.length - 1] ?? anneeMax;

  const valeur = (paysId: number, code: string, annee: number) =>
    (donnees || []).find((d: any) => d.pays_id === paysId && d.indicateur === code && d.annee === annee)?.valeur ?? null;
  const paysNom = (id: number) => (pays || []).find((p: any) => p.id === id)?.nom || "";
  const couleurPays = (id: number) => COMP_PALETTE[Math.max(0, f.selection.indexOf(id)) % COMP_PALETTE.length];

  // Dernière valeur connue d'un indicateur sur la période (et son année)
  const derniereValeur = (paysId: number, code: string): { valeur: number; annee: number; precedente: number | null } | null => {
    for (let i = anneesActives.length - 1; i >= 0; i--) {
      const v = valeur(paysId, code, anneesActives[i]);
      if (v !== null) {
        const prec = i > 0 ? valeur(paysId, code, anneesActives[i - 1]) : null;
        return { valeur: v, annee: anneesActives[i], precedente: prec };
      }
    }
    return null;
  };

  // TOUS les indicateurs avec une valeur → carrousel de KPIs (vue Pays)
  const kpis = useMemo(() => {
    if (!f.selection.length) return [];
    return (indicateurs || []).map((ind: any) => {
      const d = derniereValeur(f.selection[0], ind.code);
      return d ? {
        cle: ind.code, label: ind.libelle, note: String(d.annee),
        valeur: fmtUnite(d.valeur, ind.unite), negatif: ind.unite === "%" && d.valeur < 0,
      } : null;
    }).filter(Boolean) as KpiCarrousel[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicateurs, donnees, anneesActives, f.selection]);

  // Graphes : tous les indicateurs traçables avec des données
  // (hors superficie et croissance du PIB, non pertinents en courbe)
  const graphesIndics = useMemo(() =>
    (indicateurs || []).filter((ind: any) => ind.code !== "superficie" &&
      !(ind.code || "").includes("croissance") && !(ind.libelle || "").toLowerCase().includes("croissance") &&
      f.selection.some(id => anneesActives.some(a => valeur(id, ind.code, a) !== null))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [indicateurs, donnees, anneesActives, f.selection]);

  const nbFiltres =
    (f.vue !== "pays" ? 1 : 0) +
    (f.selection.length > 1 || (senId !== null && f.selection[0] !== senId) ? 1 : 0) +
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > bornes[0] || f.anneeMax < bornes[1]) ? 1 : 0));

  const perLabel = f.modeAnnees === "specifiques" && f.anneesSpec.length
    ? (f.anneesSpec.length === 1 ? `${f.anneesSpec[0]}` : `${f.anneesSpec[0]} — ${f.anneesSpec[f.anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;

  // Variation annuelle (dernière valeur vs précédente) pour l'en-tête d'un graphe
  const deltaDe = (d: { valeur: number; precedente: number | null } | null): { texte: string; hausse: boolean } | null => {
    if (!d || d.precedente === null || d.precedente === 0) return null;
    const pct = (d.valeur - d.precedente) / Math.abs(d.precedente) * 100;
    if (!isFinite(pct)) return null;
    return { texte: `${pct >= 0 ? "+" : ""}${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`, hausse: pct >= 0 };
  };

  return (
    <>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: 44 }}>
        <HeroModule titre="Échanges commerciaux"
          segments={{ options: ONGLETS, valeur: onglet, onChange: setOnglet }}
          bouton={{ icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: (onglet === "indicateurs" ? nbFiltres : nbFiltresCom) || undefined }} />

        {onglet === "commerce" ? (
          <CommercePanel
            filtresOuverts={filtresOuverts && onglet === "commerce"}
            onFermerFiltres={() => setFiltresOuverts(false)}
            onNbFiltres={setNbFiltresCom} />
        ) : isLoading || !indicateurs || !pays ? (
          <EtatCharge />
        ) : isError ? (
          <EtatErreur onRetry={() => refetch()} />
        ) : (
          <>
            {/* Période puis pays — une seule ligne, défilement horizontal */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.pastilles}>
              <View style={s.periodePastille}><Text style={s.periodePastilleTexte}>{perLabel}</Text></View>
              {f.selection.map(id => (
                <View key={id} style={[s.paysPastille, { backgroundColor: `${couleurPays(id)}0D`, borderColor: `${couleurPays(id)}2E` }]}>
                  <View style={[s.paysPoint, { backgroundColor: couleurPays(id) }]} />
                  <Text style={[s.paysPastilleTexte, { color: couleurPays(id) }]} numberOfLines={1}>{paysNom(id)}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Carrousel de KPIs — vue Pays (tous les indicateurs) */}
            {f.vue === "pays" && kpis.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <CarrouselKpis kpis={kpis} />
              </View>
            )}

            {/* Graphes */}
            <View style={{ gap: 12, marginTop: 16, paddingHorizontal: 16 }}>
              {graphesIndics.map((ind: any) => {
                const series: Serie[] = f.selection.map(id => ({
                  nom: paysNom(id), couleur: couleurPays(id),
                  data: anneesActives.map(a => ({ annee: a, valeur: valeur(id, ind.code, a) })),
                }));
                const dernier = f.vue === "pays" && f.selection.length ? derniereValeur(f.selection[0], ind.code) : null;
                const delta = deltaDe(dernier);
                return (
                  <View key={ind.code} style={s.graphe}>
                    <View style={s.grapheEntete}>
                      {/* Titre + unité·période sur la même ligne de base */}
                      <View style={s.grapheTitreLigne}>
                        <Text style={s.grapheTitre} numberOfLines={1}>{ind.libelle}</Text>
                        <Text style={s.grapheSous} numberOfLines={1}>{ind.unite} · {anneesActives[0] ?? anneeMin}–{refAnnee}</Text>
                      </View>
                      {dernier && (
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <Text style={s.grapheValeur} numberOfLines={1}>{fmtUnite(dernier.valeur, ind.unite)}</Text>
                          {delta && (
                            <View style={[s.deltaChip, { backgroundColor: delta.hausse ? "rgba(24,128,56,0.10)" : "rgba(220,38,38,0.09)" }]}>
                              <Text style={[s.deltaTexte, { color: delta.hausse ? T.vert : "#dc2626" }]}>
                                {delta.hausse ? "▲" : "▼"} {delta.texte}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    <GrapheLignes series={series} hauteur={168} fmt={(v: number | null) => fmtUnite(v, ind.unite)} />
                  </View>
                );
              })}
            </View>
          </>
        )}
      </Animated.ScrollView>
      <BarreHero titre="Échanges commerciaux" defilY={defilY}
        bouton={{ icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: (onglet === "indicateurs" ? nbFiltres : nbFiltresCom) || undefined }} />

      {filtresOuverts && onglet === "indicateurs" && (
        <StatistiquesFiltres
          pays={pays || []} senId={senId}
          anneesDispo={anneesDispo}
          valeurs={{ ...f, anneeMin, anneeMax }}
          onAppliquer={setFiltres} onClose={() => setFiltresOuverts(false)} />
      )}
    </>
  );
}

const s = StyleSheet.create({
  pastilles: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16, paddingHorizontal: 16 },
  paysPastille: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 5, maxWidth: 190,
  },
  paysPoint: { width: 7, height: 7, borderRadius: 4 },
  paysPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, flexShrink: 1 },
  periodePastille: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: T.filet, borderWidth: 1, borderColor: T.bordure,
  },
  periodePastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.texte, fontVariant: ["tabular-nums"] },
  graphe: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 15, paddingTop: 13, paddingBottom: 10,
    shadowColor: "#001e3c", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  grapheEntete: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  grapheTitreLigne: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", gap: 7, flexWrap: "wrap" },
  grapheTitre: { fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.2, flexShrink: 1 },
  grapheSous: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris },
  grapheValeur: { fontSize: 15, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.2, fontVariant: ["tabular-nums"] },
  deltaChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  deltaTexte: { fontSize: 10, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
});
