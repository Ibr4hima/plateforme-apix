// Échanges commerciaux — étape 1 : onglet Indicateurs économiques,
// version app de la page web. Filtres (vue, pays, période, KPI) dans une
// feuille ouverte par le bouton filter_list du hero ; KPI cards de la
// dernière année ; courbes annuelles par indicateur (indicateurs
// épinglés + flux de commerce extérieur), multi-pays en comparaison.
// L'onglet Flux bilatéraux arrive à l'étape suivante.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import GrapheLignes, { Serie } from "@/components/GrapheLignes";
import HeroModule from "@/components/HeroModule";
import StatistiquesFiltres, { FiltresStatistiques, MAX_KPI } from "@/components/StatistiquesFiltres";
import Symbole from "@/components/Symbole";
import { getJson } from "@/lib/api";
import { COMP_PALETTE } from "@/lib/couleurs";
import { fmtUnite } from "@/lib/format";
import { POLICE, T } from "@/theme";

const ONGLETS = [
  { cle: "indicateurs", label: "Indicateurs éco." },
  { cle: "commerce",    label: "Flux bilatéraux" },
] as const;

// Défauts du site : KPI épinglés et flux de commerce toujours tracés
const KPI_DEFAUT = ["population", "superficie", "densite", "pib", "pib_hab"];
const TRADE_CODES = ["importations_marchandises", "exportations_marchandises", "importations_services", "exportations_services"];

export default function Statistiques() {
  const [onglet, setOnglet] = useState("indicateurs");
  const [filtresOuverts, setFiltresOuverts] = useState(false);

  const { data: pays } = useQuery({ queryKey: ["stat-pays"], queryFn: () => getJson<any[]>("/statistiques/pays") });
  const { data: indicateurs } = useQuery({ queryKey: ["stat-indicateurs"], queryFn: () => getJson<any[]>("/statistiques/indicateurs"), staleTime: Infinity });
  const senId = useMemo(() => (pays || []).find((p: any) => p.code_iso3 === "SEN")?.id ?? null, [pays]);

  const kpisDefaut = useMemo(() => {
    const codes = (indicateurs || []).map((i: any) => i.code);
    const def = KPI_DEFAUT.filter(c => codes.includes(c)).slice(0, MAX_KPI);
    return def.length ? def : codes.slice(0, MAX_KPI);
  }, [indicateurs]);

  // Filtres appliqués (la feuille travaille sur un brouillon)
  const [filtres, setFiltres] = useState<FiltresStatistiques | null>(null);
  const f: FiltresStatistiques = filtres ?? {
    vue: "pays", selection: senId !== null ? [senId] : [],
    modeAnnees: "plage", anneeMin: 0, anneeMax: 9999, anneesSpec: [],
    kpisEpingles: kpisDefaut,
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

  const indicateursAffiches = (indicateurs || []).filter((i: any) => f.kpisEpingles.includes(i.code));

  // Graphes : KPI épinglés (hors superficie) + flux de commerce s'ils ont des données
  const graphesIndics = useMemo(() => {
    const aDesDonnees = (code: string) => f.selection.some(id => anneesActives.some(a => valeur(id, code, a) !== null));
    const base = indicateursAffiches.filter((i: any) => i.code !== "superficie").map((i: any) => i.code);
    const codes = [...base, ...TRADE_CODES.filter(c => !base.includes(c) && aDesDonnees(c))];
    return codes.map(c => (indicateurs || []).find((i: any) => i.code === c)).filter(Boolean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicateursAffiches, indicateurs, donnees, anneesActives, f.selection]);

  // Badge du bouton filtre : écarts par rapport aux défauts
  const nbFiltres =
    (f.vue !== "pays" ? 1 : 0) +
    (f.selection.length > 1 || (senId !== null && f.selection[0] !== senId) ? 1 : 0) +
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > bornes[0] || f.anneeMax < bornes[1]) ? 1 : 0)) +
    (f.kpisEpingles.join(",") !== kpisDefaut.join(",") ? 1 : 0);

  const perLabel = f.modeAnnees === "specifiques" && f.anneesSpec.length
    ? (f.anneesSpec.length === 1 ? `${f.anneesSpec[0]}` : `${f.anneesSpec[0]} — ${f.anneesSpec[f.anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;

  return (
    <>
      <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: 44 }}>
        <HeroModule titre="Échanges commerciaux"
          segments={{ options: ONGLETS, valeur: onglet, onChange: setOnglet }}
          bouton={onglet === "indicateurs" ? { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: nbFiltres || undefined } : undefined} />

        {onglet === "commerce" ? (
          <View style={s.centre}>
            <View style={s.bientotPastille}><Symbole nom="currency_exchange" taille={26} couleur={T.bleu} /></View>
            <Text style={s.bientotTitre}>Flux bilatéraux</Text>
            <Text style={s.bientotTexte}>Cette section arrive à la prochaine étape.{"\n"}Les indicateurs économiques restent disponibles.</Text>
          </View>
        ) : isLoading || !indicateurs || !pays ? (
          <View style={s.centre}><ActivityIndicator color={T.bleu} size="large" /></View>
        ) : isError ? (
          <View style={s.centre}>
            <Text style={s.erreur}>Impossible de joindre la plateforme.</Text>
            <Pressable onPress={() => refetch()} style={s.bouton}><Text style={s.boutonTexte}>Réessayer</Text></Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {/* Pays sélectionnés + période */}
            <View style={s.pastilles}>
              {f.selection.map(id => (
                <View key={id} style={[s.paysPastille, { backgroundColor: `${couleurPays(id)}0D`, borderColor: `${couleurPays(id)}2E` }]}>
                  <View style={[s.paysPoint, { backgroundColor: couleurPays(id) }]} />
                  <Text style={[s.paysPastilleTexte, { color: couleurPays(id) }]} numberOfLines={1}>{paysNom(id)}</Text>
                </View>
              ))}
              <View style={s.periodePastille}><Text style={s.periodePastilleTexte}>{perLabel}</Text></View>
            </View>

            {/* KPI cards — vue Pays uniquement (dernière année) */}
            {f.vue === "pays" && (
              <View style={s.kpis}>
                {indicateursAffiches.map((ind: any) => {
                  const v = f.selection.length ? valeur(f.selection[0], ind.code, refAnnee) : null;
                  return (
                    <View key={ind.code} style={s.kpi}>
                      <Text style={s.kpiLabel} numberOfLines={2}>{ind.libelle.toUpperCase()}</Text>
                      <Text style={[s.kpiValeur, ind.unite === "%" && v !== null && v < 0 && { color: "#dc2626" }]} numberOfLines={1} adjustsFontSizeToFit>
                        {fmtUnite(v, ind.unite)}
                      </Text>
                      <Text style={s.kpiAnnee}>en {refAnnee}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Graphes */}
            <View style={{ gap: 12, marginTop: f.vue === "pays" ? 14 : 6 }}>
              {graphesIndics.map((ind: any) => {
                const series: Serie[] = f.selection.map(id => ({
                  nom: paysNom(id), couleur: couleurPays(id),
                  data: anneesActives.map(a => ({ annee: a, valeur: valeur(id, ind.code, a) })),
                }));
                return (
                  <View key={ind.code} style={s.graphe}>
                    <View style={s.grapheEntete}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.grapheTitre} numberOfLines={1}>{ind.libelle}</Text>
                        <Text style={s.grapheSous}>{ind.unite} · {anneesActives[0] ?? anneeMin}–{refAnnee}</Text>
                      </View>
                    </View>
                    <GrapheLignes series={series} hauteur={150} fmt={(v: number | null) => fmtUnite(v, ind.unite)} />
                    {f.vue === "comparative" && (
                      <View style={s.legende}>
                        {series.map(sr => (
                          <View key={sr.nom} style={s.legendeItem}>
                            <View style={[s.paysPoint, { backgroundColor: sr.couleur }]} />
                            <Text style={s.legendeTexte} numberOfLines={1}>{sr.nom}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {filtresOuverts && (
        <StatistiquesFiltres
          pays={pays || []} senId={senId} indicateurs={indicateurs || []}
          anneesDispo={anneesDispo} kpisDefaut={kpisDefaut}
          valeurs={{ ...f, anneeMin, anneeMax }}
          onAppliquer={setFiltres} onClose={() => setFiltresOuverts(false)} />
      )}
    </>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 44, gap: 8 },
  erreur: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, textAlign: "center" },
  bouton: { marginTop: 12, backgroundColor: T.bleu, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  boutonTexte: { color: "#fff", fontFamily: POLICE.gras, fontSize: 13 },
  bientotPastille: { width: 56, height: 56, borderRadius: 17, backgroundColor: "rgba(0,79,145,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  bientotTitre: { fontSize: 17, fontFamily: POLICE.gras, color: T.encre },
  bientotTexte: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", lineHeight: 19 },
  pastilles: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 16 },
  paysPastille: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 5, maxWidth: 190,
  },
  paysPoint: { width: 7, height: 7, borderRadius: 4 },
  paysPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, flexShrink: 1 },
  periodePastille: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: "#ECEAE8", borderWidth: 1, borderColor: "#DFDBD7",
  },
  periodePastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: "#3a4452", fontVariant: ["tabular-nums"] },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 14 },
  kpi: {
    flexGrow: 1, flexBasis: "45%", backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: T.bordure, paddingHorizontal: 14, paddingVertical: 12, gap: 6,
  },
  kpiLabel: { fontSize: 9, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: 0.9, lineHeight: 12 },
  kpiValeur: { fontSize: 19, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  kpiAnnee: { fontSize: 10, fontFamily: POLICE.normal, color: T.gris },
  graphe: {
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 15, paddingTop: 13, paddingBottom: 10,
  },
  grapheEntete: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  grapheTitre: { fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.2 },
  grapheSous: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris, marginTop: 2 },
  legende: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8, paddingTop: 9, borderTopWidth: 1, borderTopColor: T.filet },
  legendeItem: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "48%" },
  legendeTexte: { fontSize: 11, fontFamily: POLICE.demi, color: T.texte, flexShrink: 1 },
});
