// Investissements privés — étape 1 : onglet Investissements Directs
// Étrangers, version app de la page web. Catégories Flux & Stocks /
// Greenfield / Fusion & Acquisition, filtres (pays CNUCED avec Sénégal
// référence, période) dans la feuille partagée, TOUS les KPIs (les 25
// indicateurs du site calculés par le moteur ideKpis) en carrousel de
// pages de 4, quatre courbes annuelles premium par catégorie.
// L'onglet Investissements nationaux arrive à l'étape suivante.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import CarrouselKpis, { KpiCarrousel } from "@/components/CarrouselKpis";
import GrapheLignes, { Serie } from "@/components/GrapheLignes";
import HeroModule from "@/components/HeroModule";
import StatistiquesFiltres, { FiltresStatistiques } from "@/components/StatistiquesFiltres";
import Symbole from "@/components/Symbole";
import { getJson } from "@/lib/api";
import { COMP_PALETTE } from "@/lib/couleurs";
import { KpiResult, calculerKpis, fmtKpi } from "@/lib/ideKpis";
import { POLICE, T } from "@/theme";

const ONGLETS = [
  { cle: "ide",       label: "Inv. Directs Étrangers" },
  { cle: "nationaux", label: "Inv. Nationaux" },
] as const;

// Catégories d'analyse (mêmes séries que le site)
const SOUS_TYPES = [
  { cle: "fluxstock",  label: "Flux & Stocks" },
  { cle: "greenfield", label: "Greenfield" },
  { cle: "fusion",     label: "Fusion & Acquisition" },
] as const;

const SERIES_TYPES: Record<string, { dir: string; ind: string; label: string; unite: "musd" | "nombre" }[]> = {
  fluxstock: [
    { dir: "entrant", ind: "flux",  label: "Flux entrants", unite: "musd" },
    { dir: "sortant", ind: "flux",  label: "Flux sortants", unite: "musd" },
    { dir: "entrant", ind: "stock", label: "Stock entrant", unite: "musd" },
    { dir: "sortant", ind: "stock", label: "Stock sortant", unite: "musd" },
  ],
  greenfield: [
    { dir: "entrant", ind: "greenfield_valeur", label: "Valeur des investissements greenfield reçus",    unite: "musd" },
    { dir: "sortant", ind: "greenfield_valeur", label: "Investissements greenfield émis à l'étranger",   unite: "musd" },
    { dir: "entrant", ind: "greenfield_nombre", label: "Nombre de projets greenfield reçus",             unite: "nombre" },
    { dir: "sortant", ind: "greenfield_nombre", label: "Nombre de projets greenfield émis à l'étranger", unite: "nombre" },
  ],
  fusion: [
    { dir: "entrant", ind: "ma_valeur", label: "Valeur des rachats d'entreprises locales", unite: "musd" },
    { dir: "sortant", ind: "ma_valeur", label: "Valeur des acquisitions à l'étranger",     unite: "musd" },
    { dir: "entrant", ind: "ma_nombre", label: "Nombre de rachats d'entreprises locales",  unite: "nombre" },
    { dir: "sortant", ind: "ma_nombre", label: "Nombre d'acquisitions à l'étranger",       unite: "nombre" },
  ],
};

// Les 25 KPIs affichés du site (ordre de la barre latérale)
const KPI_25_IDS = [
  "fe_last", "fs_last", "fn_last", "se_last", "ss_last", "sn_last",
  "g_fe", "g_se", "cagr_fe", "mom_fe",
  "moy_fe", "med_fe", "max_fe", "min_fe", "std_fe",
  "trend_fe", "accel_fe", "tv5_fe", "tv10_fe",
  "r_fe_fs", "dist_max_fe", "regularite_fe", "vs_moy_fe",
  "n_pos_fe",
];

// Valeurs CNUCED en millions USD (règle d'affichage du site)
const fmtMusd = (v: number | null): string => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md $`;
  return `${Math.round(v).toLocaleString("fr-FR")} M $`;
};
const fmtNombre = (v: number | null): string =>
  v === null || v === undefined || isNaN(v) ? "—" : Math.round(v).toLocaleString("fr-FR");

// Indicatif grisé sous la valeur d'un KPI (règles du site)
function indicatifDe(k: KpiResult): string | null {
  if (k.annee) return `en ${k.annee}`;
  if (k.id.includes("vs_moy")) return "vs moyenne hist.";
  if (k.id.includes("5_fe") || k.id.includes("5_fs")) return "5 dernières années";
  if (k.id.includes("10_fe") || k.id.includes("10_fs")) return "10 dernières années";
  if (k.id.includes("cagr")) return "période complète";
  if (k.id.includes("mom")) return "5 ans glissants";
  if (k.id.includes("n_pos") || k.id.includes("cur_streak")) return "sur la période";
  if (k.id.includes("dist_max")) return "vs pic historique";
  if (k.id.includes("regularite")) return "% années positives";
  return null;
}

export default function Ide() {
  const [onglet, setOnglet] = useState("ide");
  const [sousType, setSousType] = useState<string>("fluxstock");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const chipsRef = useRef<ScrollView>(null);
  const chipsPos = useRef<Record<string, { x: number; largeur: number }>>({});

  // Référentiels : pays CNUCED et bornes d'années par catégorie
  const { data: paysDispo } = useQuery({
    queryKey: ["ide-pays"], queryFn: () => getJson<any[]>("/ide/cnuced/pays-disponibles"), staleTime: Infinity,
  });
  const { data: bornesRef } = useQuery({
    queryKey: ["ide-annees"], queryFn: () => getJson<any>("/ide/cnuced/annees"), staleTime: Infinity,
  });
  // Liste de pays indexée pour la feuille de filtres (sélection par nom)
  const paysListe = useMemo(() => (paysDispo || []).map((p: any, i: number) => ({
    id: i, nom: p.nom, code_iso3: p.code_iso3, continent: p.continent, region_geo: p.region_geo,
  })), [paysDispo]);
  const senId = useMemo(() => paysListe.find((p: any) => p.nom === "Sénégal")?.id ?? null, [paysListe]);

  const cat = bornesRef?.categories?.[sousType];
  const borneMin = cat?.annee_min ?? bornesRef?.annee_min ?? 1990;
  const borneMax = cat?.annee_max ?? bornesRef?.annee_max ?? 2025;
  const anneesDispo = useMemo(() =>
    Array.from({ length: Math.max(0, borneMax - borneMin + 1) }, (_, i) => borneMin + i),
  [borneMin, borneMax]);

  const [filtres, setFiltres] = useState<FiltresStatistiques | null>(null);
  const f: FiltresStatistiques = filtres ?? {
    vue: "pays", typeAnalyse: "pays", selection: senId !== null ? [senId] : [],
    modeAnnees: "plage", anneeMin: borneMin, anneeMax: borneMax, anneesSpec: [],
  };
  const comparative = f.typeAnalyse === "comparative";
  const nomsSelec = f.selection
    .map(id => paysListe.find((p: any) => p.id === id)?.nom)
    .filter(Boolean) as string[];
  const paysSelec = nomsSelec[0] ?? "Sénégal";
  const couleurPays = (nom: string) => COMP_PALETTE[Math.max(0, nomsSelec.indexOf(nom)) % COMP_PALETTE.length];
  const anneeMin = Math.max(f.anneeMin, borneMin);
  const anneeMax = Math.min(Math.max(f.anneeMax, anneeMin), borneMax);

  // Données CNUCED du pays sur la période
  const params = useMemo(() => {
    const p = new URLSearchParams({ pays_list: (comparative ? nomsSelec : [paysSelec]).join(",") });
    if (f.modeAnnees === "specifiques" && f.anneesSpec.length) p.set("annees", f.anneesSpec.join(","));
    else { p.set("annee_min", String(anneeMin)); p.set("annee_max", String(anneeMax)); }
    return p.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomsSelec.join(","), comparative, f.modeAnnees, f.anneesSpec, anneeMin, anneeMax]);
  const { data: donnees, isLoading, isError, refetch } = useQuery({
    queryKey: ["ide-cnuced", params], enabled: !!paysDispo,
    queryFn: () => getJson<any[]>(`/ide/cnuced?${params}`),
  });

  // ── KPIs ──
  // Flux & Stocks : les 25 indicateurs du site, calculés par le moteur partagé
  const kpisFluxStock: KpiCarrousel[] = useMemo(() => {
    if (sousType !== "fluxstock") return [];
    const tous = calculerKpis((donnees || []).filter((d: any) => !comparative || d.pays === paysSelec));
    return KPI_25_IDS
      .map(id => tous.find(k => k.id === id))
      .filter(Boolean)
      .map(k => ({
        cle: k!.id, label: k!.label, valeur: fmtKpi(k!), note: indicatifDe(k!),
        negatif: k!.valeur !== null && k!.valeur < 0 && (k!.format === "pourcentage" || k!.format === "monnaie_signe"),
      }));
  }, [donnees, sousType]);

  // Greenfield / M&A : KPIs dédiés (règles du site)
  const kpisCategorie: KpiCarrousel[] = useMemo(() => {
    const st = SERIES_TYPES[sousType];
    if (sousType === "fluxstock" || !st) return [];
    const serie = (dir: string, ind: string) => (donnees || [])
      .filter((d: any) => d.direction === dir && d.indicateur === ind && d.valeur !== null)
      .sort((a: any, b: any) => a.annee - b.annee);
    const dernier = (rs: any[]) => rs.length ? rs[rs.length - 1] : null;
    const vE = dernier(serie("entrant", st[0].ind));
    const vS = dernier(serie("sortant", st[1].ind));
    const nE = dernier(serie("entrant", st[2].ind));
    const solde = vE && vS && vE.annee === vS.annee ? vE.valeur - vS.valeur : null;
    const gf = sousType === "greenfield";
    return [
      { cle: "recus", label: gf ? "Inv. greenfield reçus" : "Rachats d'entreprises locales", valeur: vE ? fmtMusd(vE.valeur) : "N/A", note: vE ? `en ${vE.annee}` : null },
      { cle: "emis", label: gf ? "Inv. greenfield émis" : "Acquisitions à l'étranger", valeur: vS ? fmtMusd(vS.valeur) : "N/A", note: vS ? `en ${vS.annee}` : null },
      { cle: "nombre", label: gf ? "Nombre de projets reçus" : "Nombre de rachats locaux", valeur: nE ? fmtNombre(nE.valeur) : "N/A", note: nE ? `en ${nE.annee}` : null },
      { cle: "solde", label: gf ? "Solde net · reçus − émis" : "Solde net · rachats − acquisitions", valeur: solde !== null ? `${solde > 0 ? "+" : ""}${fmtMusd(solde)}` : "N/A", note: vE && solde !== null ? `en ${vE.annee}` : null, negatif: solde !== null && solde < 0 },
    ];
  }, [donnees, sousType]);
  const kpis = sousType === "fluxstock" ? kpisFluxStock : kpisCategorie;

  // ── Graphes : les 4 séries de la catégorie ──
  const noms = comparative ? nomsSelec : [paysSelec];
  const graphes = (SERIES_TYPES[sousType] || SERIES_TYPES.fluxstock).map(st => {
    const series: Serie[] = noms.map(nom => ({
      nom, couleur: couleurPays(nom),
      data: (donnees || [])
        .filter((d: any) => d.direction === st.dir && d.indicateur === st.ind && (!comparative || d.pays === nom))
        .sort((a: any, b: any) => a.annee - b.annee)
        .map((d: any) => ({ annee: d.annee, valeur: d.valeur })),
    }));
    return { ...st, series };
  });
  const fmtDe = (unite: "musd" | "nombre") => (v: number | null) => unite === "nombre" ? fmtNombre(v) : fmtMusd(v);

  // Dernière valeur + variation annuelle pour l'en-tête d'un graphe
  const enTeteDe = (g: typeof graphes[number]) => {
    const pts = g.series[0].data.filter(d => d.valeur !== null);
    if (!pts.length) return null;
    const dernier = pts[pts.length - 1];
    const prec = pts.length > 1 ? pts[pts.length - 2] : null;
    let delta: { texte: string; hausse: boolean } | null = null;
    if (prec && prec.valeur) {
      const pct = (dernier.valeur! - prec.valeur!) / Math.abs(prec.valeur!) * 100;
      if (isFinite(pct)) delta = { texte: `${pct >= 0 ? "+" : ""}${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`, hausse: pct >= 0 };
    }
    return { valeur: fmtDe(g.unite)(dernier.valeur), delta };
  };

  const nbFiltres =
    (f.vue !== "pays" ? 1 : 0) +
    (f.typeAnalyse !== "pays" ? 1 : 0) +
    (senId !== null && (f.selection.length > 1 || f.selection[0] !== senId) ? 1 : 0) +
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > borneMin || f.anneeMax < borneMax) ? 1 : 0));
  const perLabel = f.modeAnnees === "specifiques" && f.anneesSpec.length
    ? (f.anneesSpec.length === 1 ? `${f.anneesSpec[0]}` : `${f.anneesSpec[0]} — ${f.anneesSpec[f.anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;

  const centrerChip = (cle: string) => {
    const p = chipsPos.current[cle];
    if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
  };

  return (
    <>
      <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: 44 }}>
        <HeroModule titre="Investissements privés"
          segments={{ options: ONGLETS, valeur: onglet, onChange: setOnglet }}
          bouton={onglet === "ide" ? { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: nbFiltres || undefined } : undefined} />

        {onglet === "nationaux" ? (
          <View style={s.centre}>
            <View style={s.bientotPastille}><Symbole nom="finance_mode" taille={26} couleur={T.bleu} /></View>
            <Text style={s.bientotTitre}>Investissements nationaux</Text>
            <Text style={s.bientotTexte}>Cette section arrive à la prochaine étape.{"\n"}Les IDE restent disponibles.</Text>
          </View>
        ) : (
          <>
            {/* Catégories : Flux & Stocks / Greenfield / Fusion & Acquisition */}
            <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chipsRangee}>
              {SOUS_TYPES.map(st => {
                const actif = sousType === st.cle;
                return (
                  <Pressable key={st.cle}
                    onLayout={ev => { const { x, width } = ev.nativeEvent.layout; chipsPos.current[st.cle] = { x, largeur: width }; }}
                    onPress={() => { setSousType(st.cle); centrerChip(st.cle); }}
                    style={[s.chipFiltre, actif && s.chipFiltreActif]}>
                    <Text style={[s.chipFiltreTexte, actif && s.chipFiltreTexteActif]}>{st.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {f.vue === "secteurs" || f.typeAnalyse === "monde" ? (
              <View style={s.centre}>
                <View style={s.bientotPastille}><Symbole nom={f.vue === "secteurs" ? "category" : "public"} taille={26} couleur={T.bleu} /></View>
                <Text style={s.bientotTitre}>{f.vue === "secteurs" ? "Vue Secteurs" : "Vue Monde"}</Text>
                <Text style={s.bientotTexte}>Cette vue arrive à la prochaine étape.{"\n"}L'analyse par pays reste disponible via le filtre.</Text>
              </View>
            ) : isLoading || !paysDispo ? (
              <View style={s.centre}><ActivityIndicator color={T.bleu} size="large" /></View>
            ) : isError ? (
              <View style={s.centre}>
                <Text style={s.erreur}>Impossible de joindre la plateforme.</Text>
                <Pressable onPress={() => refetch()} style={s.bouton}><Text style={s.boutonTexte}>Réessayer</Text></Pressable>
              </View>
            ) : (
              <>
                {/* Période puis pays — une seule ligne à défilement */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.pastilles}>
                  <View style={s.periodePastille}><Text style={s.periodePastilleTexte}>{perLabel}</Text></View>
                  {(comparative ? nomsSelec : [paysSelec]).map(nom => (
                    <View key={nom} style={[s.paysPastille, comparative && { borderColor: `${couleurPays(nom)}2E`, backgroundColor: `${couleurPays(nom)}0D` }]}>
                      <View style={[s.paysPoint, comparative && { backgroundColor: couleurPays(nom) }]} />
                      <Text style={[s.paysPastilleTexte, comparative && { color: couleurPays(nom) }]} numberOfLines={1}>{nom}</Text>
                    </View>
                  ))}
                </ScrollView>

                {/* Tous les KPIs en carrousel (analyse par pays) */}
                {!comparative && (
                  <View style={{ marginTop: 14 }}>
                    <CarrouselKpis kpis={kpis} />
                  </View>
                )}

                {/* Courbes de la catégorie */}
                <View style={{ gap: 12, marginTop: 16, paddingHorizontal: 16 }}>
                  {graphes.map(g => {
                    const entete = enTeteDe(g);
                    return (
                      <View key={`${g.dir}-${g.ind}`} style={s.graphe}>
                        <View style={s.grapheEntete}>
                          <View style={s.grapheTitreLigne}>
                            <Text style={s.grapheTitre} numberOfLines={2}>{g.label}</Text>
                            <Text style={s.grapheSous} numberOfLines={1}>{g.unite === "nombre" ? "projets" : "USD"} · {perLabel.replace(" — ", "–")}</Text>
                          </View>
                          {entete && (
                            <View style={{ alignItems: "flex-end", gap: 4 }}>
                              <Text style={s.grapheValeur} numberOfLines={1}>{entete.valeur}</Text>
                              {entete.delta && (
                                <View style={[s.deltaChip, { backgroundColor: entete.delta.hausse ? "rgba(24,128,56,0.10)" : "rgba(220,38,38,0.09)" }]}>
                                  <Text style={[s.deltaTexte, { color: entete.delta.hausse ? T.vert : "#dc2626" }]}>
                                    {entete.delta.hausse ? "▲" : "▼"} {entete.delta.texte}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                        <GrapheLignes series={g.series} hauteur={168} fmt={fmtDe(g.unite)} />
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {filtresOuverts && onglet === "ide" && (
        <StatistiquesFiltres
          pays={paysListe} senId={senId}
          anneesDispo={anneesDispo}
          vues={[{ cle: "pays", label: "Pays" }, { cle: "secteurs", label: "Secteurs" }]}
          analyses={[{ cle: "pays", label: "Par pays" }, { cle: "comparative", label: "Comparative" }, { cle: "monde", label: "Monde" }]}
          multiPour={x => x.typeAnalyse === "comparative"}
          valeurs={{ ...f, anneeMin, anneeMax }}
          onAppliquer={setFiltres} onClose={() => setFiltresOuverts(false)} />
      )}
    </>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center", padding: 44, gap: 8 },
  erreur: { fontSize: 14.5, fontFamily: POLICE.gras, color: T.encre, textAlign: "center" },
  bouton: { marginTop: 12, backgroundColor: T.bleuAction, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  boutonTexte: { color: "#fff", fontFamily: POLICE.gras, fontSize: 13 },
  bientotPastille: { width: 56, height: 56, borderRadius: 17, backgroundColor: T.bleuVoile, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  bientotTitre: { fontSize: 17, fontFamily: POLICE.gras, color: T.encre },
  bientotTexte: { fontSize: 12.5, fontFamily: POLICE.normal, color: T.gris, textAlign: "center", lineHeight: 19 },
  chipsRangee: { flexGrow: 1, justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipFiltre: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure },
  chipFiltreActif: { backgroundColor: T.blocFond, borderColor: T.blocBord },
  chipFiltreTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.texte },
  chipFiltreTexteActif: { color: T.bleu, fontFamily: POLICE.gras },
  pastilles: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14, paddingHorizontal: 16 },
  periodePastille: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: T.filet, borderWidth: 1, borderColor: T.bordure,
  },
  periodePastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.texte, fontVariant: ["tabular-nums"] },
  paysPastille: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1,
    borderColor: T.blocBord, backgroundColor: T.blocFond,
    paddingHorizontal: 12, paddingVertical: 5, maxWidth: 200,
  },
  paysPoint: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.bleu },
  paysPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.bleu, flexShrink: 1 },
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
