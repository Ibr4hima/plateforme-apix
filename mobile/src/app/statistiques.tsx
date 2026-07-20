// Échanges commerciaux — étape 1 : onglet Indicateurs économiques,
// version app de la page web. Filtres (vue, pays, période) dans une
// feuille ouverte par le bouton filter_list du hero ; TOUS les
// indicateurs en carrousel de KPIs (pages de 4, comme l'accueil) ;
// courbes annuelles premium par indicateur (lissées, aire dégradée,
// curseur tactile), valeur du moment et variation annuelle en en-tête,
// multi-pays en comparaison. Flux bilatéraux : étape suivante.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import GrapheLignes, { Serie } from "@/components/GrapheLignes";
import HeroModule from "@/components/HeroModule";
import StatistiquesFiltres, { FiltresStatistiques } from "@/components/StatistiquesFiltres";
import Symbole from "@/components/Symbole";
import { getJson } from "@/lib/api";
import { COMP_PALETTE } from "@/lib/couleurs";
import { fmtUnite } from "@/lib/format";
import { POLICE, T } from "@/theme";

const ONGLETS = [
  { cle: "indicateurs", label: "Indicateurs éco." },
  { cle: "commerce",    label: "Flux bilatéraux" },
] as const;

const LARGEUR = Dimensions.get("window").width;
const ROTATION_MS = 6000;

function decouper<T>(liste: T[], taille: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) pages.push(liste.slice(i, i + taille));
  return pages;
}

// Carrousel de KPIs : pages de 4, défilement manuel + rotation douce
function CarrouselKpis({ kpis }: { kpis: { code: string; label: string; valeur: string; negatif: boolean; annee: number }[] }) {
  const pages = decouper(kpis, 4);
  const [page, setPage] = useState(0);
  const defileur = useRef<ScrollView>(null);
  const pageRef = useRef(0);
  pageRef.current = page;

  useEffect(() => {
    if (pages.length < 2) return;
    const minuteur = setInterval(() => {
      const suivante = (pageRef.current + 1) % pages.length;
      defileur.current?.scrollTo({ x: suivante * LARGEUR, animated: true });
    }, ROTATION_MS);
    return () => clearInterval(minuteur);
  }, [pages.length]);

  if (!pages.length) return null;
  return (
    <View>
      <ScrollView
        ref={defileur} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / LARGEUR))}>
        {pages.map((groupe, i) => (
          <View key={i} style={[s.kpiPage, { width: LARGEUR }]}>
            {groupe.map(kpi => (
              <View key={kpi.code} style={s.kpi}>
                <View style={s.kpiFilet} />
                <Text style={s.kpiLabel} numberOfLines={2}>{kpi.label.toUpperCase()}</Text>
                <Text style={[s.kpiValeur, kpi.negatif && { color: "#dc2626" }]} numberOfLines={1} adjustsFontSizeToFit>{kpi.valeur}</Text>
                <View style={s.kpiAnnee}><Text style={s.kpiAnneeTexte}>{kpi.annee}</Text></View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 && (
        <View style={s.points}>
          {pages.map((_, i) => <View key={i} style={[s.pointNav, i === page && s.pointNavActif]} />)}
        </View>
      )}
    </View>
  );
}

export default function Statistiques() {
  const [onglet, setOnglet] = useState("indicateurs");
  const [filtresOuverts, setFiltresOuverts] = useState(false);

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
        code: ind.code, label: ind.libelle, annee: d.annee,
        valeur: fmtUnite(d.valeur, ind.unite), negatif: ind.unite === "%" && d.valeur < 0,
      } : null;
    }).filter(Boolean) as any[];
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
      </ScrollView>

      {filtresOuverts && (
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
  centre: { alignItems: "center", justifyContent: "center", padding: 44, gap: 8 },
  erreur: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, textAlign: "center" },
  bouton: { marginTop: 12, backgroundColor: T.bleu, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  boutonTexte: { color: "#fff", fontFamily: POLICE.gras, fontSize: 13 },
  bientotPastille: { width: 56, height: 56, borderRadius: 17, backgroundColor: "rgba(0,79,145,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  bientotTitre: { fontSize: 17, fontFamily: POLICE.gras, color: T.encre },
  bientotTexte: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", lineHeight: 19 },
  pastilles: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16, paddingHorizontal: 16 },
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
  kpiPage: { flexDirection: "row", flexWrap: "wrap", gap: 11, paddingHorizontal: 16 },
  kpi: {
    width: (LARGEUR - 32 - 11) / 2, backgroundColor: "#fff", borderRadius: 18,
    paddingHorizontal: 15, paddingVertical: 13, overflow: "hidden",
    shadowColor: "#001e3c", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  kpiFilet: { position: "absolute", left: 15, right: 15, top: 0, height: 2.5, borderRadius: 2, backgroundColor: "rgba(0,79,145,0.14)" },
  kpiLabel: { fontSize: 9, fontFamily: POLICE.gras, color: "#7d95ad", letterSpacing: 0.9, lineHeight: 12, marginTop: 4, minHeight: 24 },
  kpiValeur: { fontSize: 20, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -0.4, marginTop: 7, fontVariant: ["tabular-nums"] },
  kpiAnnee: { alignSelf: "flex-start", backgroundColor: "rgba(0,79,145,0.07)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 8 },
  kpiAnneeTexte: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.bleu, fontVariant: ["tabular-nums"] },
  points: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  pointNav: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(0,79,145,0.18)" },
  pointNavActif: { width: 18, backgroundColor: T.bleu },
  graphe: {
    backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: T.bordure,
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
