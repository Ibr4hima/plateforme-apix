// Flux bilatéraux — version app du panneau commerce du site : filtres
// (vue exportateur / importateur, pays unique avec Sénégal référence,
// période) dans la feuille partagée, KPIs du commerce en carrousel,
// évolution du total et balance commerciale en courbes, classements
// (débouchés / origines et ressources), poids des ressources en anneau,
// répartition partenaires × ressources en barres empilées.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EtatCharge, EtatErreur, EtatVide } from "@/components/ui";
import CarrouselKpis, { KpiCarrousel } from "@/components/CarrouselKpis";
import { BarresEmpilees, BarresH } from "@/components/GrapheBarres";
import GrapheDonut from "@/components/GrapheDonut";
import GrapheLignes from "@/components/GrapheLignes";
import StatistiquesFiltres, { FiltresStatistiques } from "@/components/StatistiquesFiltres";
import { getJson } from "@/lib/api";
import { fmtUSD } from "@/lib/format";
import { POLICE, T } from "@/theme";

const VUES_COMMERCE = [
  { cle: "exportateur", label: "Vue exportateur" },
  { cle: "importateur", label: "Vue importateur" },
] as const;

export default function CommercePanel({ filtresOuverts, onFermerFiltres, onNbFiltres }: {
  filtresOuverts: boolean; onFermerFiltres: () => void; onNbFiltres: (n: number) => void;
}) {
  // Référentiel du commerce : années disponibles, ressources, pays
  const { data: refs, isLoading, isError, refetch } = useQuery({
    queryKey: ["commerce-filtres"], queryFn: () => getJson<any>("/statistiques/commerce/filtres"), staleTime: Infinity,
  });
  const annees: number[] = useMemo(() => (refs?.annees || []).slice().sort((a: number, b: number) => a - b), [refs]);
  const paysOpts: any[] = refs?.pays || [];
  const senId = useMemo(() => paysOpts.find((p: any) => p.code_iso3 === "SEN")?.id ?? null, [paysOpts]);

  const [filtres, setFiltres] = useState<FiltresStatistiques | null>(null);
  const f: FiltresStatistiques = filtres ?? {
    vue: "exportateur", selection: senId !== null ? [senId] : [],
    modeAnnees: "plage", anneeMin: annees[0] ?? 0, anneeMax: annees[annees.length - 1] ?? 9999, anneesSpec: [],
  };
  const selId = f.selection[0] ?? null;
  const expDir = f.vue === "exportateur";
  const bornes: [number, number] = annees.length ? [annees[0], annees[annees.length - 1]] : [0, 0];
  const anneeMin = Math.max(f.anneeMin, bornes[0]) || bornes[0];
  const anneeMax = Math.min(f.anneeMax, bornes[1]) || bornes[1];

  // Paramètres communs des endpoints commerce (mêmes règles que le site)
  const params = useMemo(() => {
    if (selId === null) return null;
    const p = new URLSearchParams({ pays_id: String(selId), direction: f.vue });
    if (f.modeAnnees === "specifiques" && f.anneesSpec.length) p.set("annees", f.anneesSpec.join(","));
    else { p.set("annee_min", String(anneeMin)); p.set("annee_max", String(anneeMax)); }
    return p.toString();
  }, [selId, f.vue, f.modeAnnees, f.anneesSpec, anneeMin, anneeMax]);

  const kpis = useQuery({
    queryKey: ["commerce-kpis", params], enabled: !!params,
    queryFn: () => getJson<any>(`/statistiques/commerce/kpis?${params}`).catch(() => null),
  }).data;
  const balance: any[] = useQuery({
    queryKey: ["commerce-balance", params], enabled: !!params,
    queryFn: () => getJson<any[]>(`/statistiques/commerce/balance?${params}`).catch(() => []),
  }).data || [];
  const tops = useQuery({
    queryKey: ["commerce-tops", params], enabled: !!params,
    queryFn: () => getJson<any>(`/statistiques/commerce/tops?${params}`).catch(() => null),
  }).data;
  const repart = useQuery({
    queryKey: ["commerce-repartition", params], enabled: !!params,
    queryFn: () => getJson<any>(`/statistiques/commerce/repartition?${params}`).catch(() => null),
  }).data;

  // Badge du bouton filtre du hero
  const nbFiltres =
    (f.vue !== "exportateur" ? 1 : 0) +
    (senId !== null && selId !== senId ? 1 : 0) +
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > bornes[0] || f.anneeMax < bornes[1]) ? 1 : 0));
  useEffect(() => { onNbFiltres(nbFiltres); }, [nbFiltres, onNbFiltres]);

  const selPays = paysOpts.find((p: any) => p.id === selId);
  const perLabel = f.modeAnnees === "specifiques" && f.anneesSpec.length
    ? (f.anneesSpec.length === 1 ? `${f.anneesSpec[0]}` : `${f.anneesSpec[0]} — ${f.anneesSpec[f.anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;

  if (isLoading) return <EtatCharge />;
  if (isError) return (
    <EtatErreur onRetry={() => refetch()} />
  );
  if (!annees.length) return (
    <EtatVide texte="Aucune donnée commerciale" sousTexte="Les flux bilatéraux seront disponibles après import dans l'administration." />
  );

  // ── KPIs du commerce (règles du site) ──
  const ref = kpis?.annee_ref;
  const enRef = ref ? `en ${ref}` : "";
  const kpisCartes: KpiCarrousel[] = [
    { cle: "total", label: expDir ? "Total exportations" : "Total importations", valeur: fmtUSD(kpis?.total ?? null), note: enRef || null },
    { cle: "record", label: "Année record", valeur: kpis?.annee_record ? String(kpis.annee_record.annee) : "—", note: kpis?.annee_record ? fmtUSD(kpis.annee_record.valeur) : null },
    { cle: "partenaire", label: expDir ? `1er client · ${ref ?? "—"}` : `1er fournisseur · ${ref ?? "—"}`, valeur: kpis?.top_partenaire?.nom || "—", note: kpis?.top_partenaire ? fmtUSD(kpis.top_partenaire.valeur) : null },
    { cle: "ressource", label: `1re ressource · ${ref ?? "—"}`, valeur: kpis?.top_ressource?.ressource || "—", note: kpis?.top_ressource ? fmtUSD(kpis.top_ressource.valeur) : null },
  ];

  // ── Séries des courbes ──
  const a0 = balance[0]?.annee, a1 = balance[balance.length - 1]?.annee;
  const fluxSerie = [{ nom: expDir ? "Exportations" : "Importations", couleur: T.bleu, data: balance.map((b: any) => ({ annee: b.annee, valeur: expDir ? b.exportations : b.importations })) }];
  const balSerie = [{ nom: "Balance commerciale", couleur: T.bleu, data: balance.map((b: any) => ({ annee: b.annee, valeur: b.balance })) }];

  // ── Poids des ressources : top 8 + « Autres » ──
  let donut: { label: string; valeur: number }[] = [];
  if (tops?.ressources?.length) {
    const top8 = tops.ressources.slice(0, 8);
    donut = top8.map((r: any) => ({ label: r.ressource, valeur: r.valeur }));
    const autres = (tops.total || 0) - top8.reduce((somme: number, r: any) => somme + r.valeur, 0);
    if (autres > 0.0001 && tops.ressources.length > 8) donut.push({ label: "Autres", valeur: autres });
  }

  const Carte = ({ titre, sous, children }: { titre: string; sous?: string; children: React.ReactNode }) => (
    <View style={s.carte}>
      <View style={s.carteTitreLigne}>
        <Text style={s.carteTitre} numberOfLines={2}>{titre}</Text>
        {sous ? <Text style={s.carteSous} numberOfLines={1}>{sous}</Text> : null}
      </View>
      {children}
    </View>
  );

  return (
    <>
      {/* Période, direction, pays — une seule ligne à défilement */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.pastilles}>
        <View style={s.periodePastille}><Text style={s.periodePastilleTexte}>{perLabel}</Text></View>
        <View style={s.directionPastille}><Text style={s.directionPastilleTexte}>{expDir ? "Exportations" : "Importations"}</Text></View>
        <View style={s.paysPastille}>
          <View style={s.paysPoint} />
          <Text style={s.paysPastilleTexte} numberOfLines={1}>{selPays?.nom || "—"}</Text>
        </View>
      </ScrollView>

      {/* KPIs du commerce */}
      <View style={{ marginTop: 14 }}>
        <CarrouselKpis kpis={kpisCartes} />
      </View>

      {/* Graphes */}
      <View style={{ gap: 12, marginTop: 16, paddingHorizontal: 16 }}>
        {balance.length > 0 && (
          <>
            <Carte titre={expDir ? "Évolution des exportations" : "Évolution des importations"} sous={`USD · ${a0}–${a1}`}>
              <GrapheLignes series={fluxSerie} hauteur={168} fmt={(v: number | null) => fmtUSD(v)} />
            </Carte>
            <Carte titre="Balance commerciale" sous={`Exp. − imp. · ${a0}–${a1}`}>
              <GrapheLignes series={balSerie} hauteur={168} fmt={(v: number | null) => fmtUSD(v)} />
            </Carte>
          </>
        )}
        {tops?.partenaires?.length > 0 && (
          <Carte titre={expDir ? "Répartition par pays de destination" : "Répartition par pays d'origine"} sous={`Top 5 · cumul ${perLabel}`}>
            <BarresH data={tops.partenaires.slice(0, 5).map((p: any) => ({ label: p.nom, valeur: p.valeur }))} fmt={v => fmtUSD(v)} />
          </Carte>
        )}
        {tops?.ressources?.length > 0 && (
          <Carte titre={expDir ? "Classement des ressources exportées" : "Classement des ressources importées"} sous={`Top 5 · cumul ${perLabel}`}>
            <BarresH data={tops.ressources.slice(0, 5).map((r: any) => ({ label: r.ressource, valeur: r.valeur }))} fmt={v => fmtUSD(v)} />
          </Carte>
        )}
        {donut.length > 0 && (
          <Carte titre={expDir ? "Poids des ressources exportées" : "Poids des ressources importées"} sous={`USD · cumul ${perLabel}`}>
            {/* Au centre : le nombre seul, l'unité est portée par le sous-titre */}
            <GrapheDonut data={donut} fmt={v => fmtUSD(v)}
              centre={fmtUSD(donut.reduce((somme, d) => somme + d.valeur, 0)).replace(/\s*\$\s*$/, "")} />
          </Carte>
        )}
        {repart?.partenaires?.length > 0 && (
          <Carte titre={expDir ? "Exportations par destination et ressource" : "Importations par origine et ressource"} sous={`Top 5 · cumul ${perLabel}`}>
            <BarresEmpilees partenaires={repart.partenaires.slice(0, 5)} ressources={repart.ressources || []} fmt={v => fmtUSD(v)} />
          </Carte>
        )}
      </View>

      {filtresOuverts && (
        <StatistiquesFiltres
          pays={paysOpts} senId={senId}
          anneesDispo={annees}
          vues={VUES_COMMERCE} multiPour={() => false}
          valeurs={{ ...f, anneeMin, anneeMax }}
          onAppliquer={setFiltres} onClose={onFermerFiltres} />
      )}
    </>
  );
}

const s = StyleSheet.create({
  pastilles: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16, paddingHorizontal: 16 },
  periodePastille: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: T.filet, borderWidth: 1, borderColor: T.bordure,
  },
  periodePastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.texte, fontVariant: ["tabular-nums"] },
  directionPastille: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: T.bleuVoile },
  directionPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.bleu },
  paysPastille: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1,
    borderColor: T.blocBord, backgroundColor: T.bleuVoile,
    paddingHorizontal: 12, paddingVertical: 5, maxWidth: 190,
  },
  paysPoint: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.bleu },
  paysPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.bleu, flexShrink: 1 },
  carte: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.bordure,
    paddingHorizontal: 15, paddingTop: 13, paddingBottom: 12,
    shadowColor: "#001e3c", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  carteTitreLigne: { flexDirection: "row", alignItems: "baseline", gap: 7, flexWrap: "wrap", marginBottom: 10 },
  carteTitre: { fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.2, flexShrink: 1 },
  carteSous: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris },
});
