// Flux bilatéraux — version app du panneau commerce du site, sur la grammaire
// des Investissements : l'évolution du flux et la balance commerciale en
// vedette commutable (nombre en 34 pt, variation fléchée, graphe signature
// épuré), les repères du commerce (total, année record, 1er partenaire,
// 1re ressource) à plat, puis les classements — top 5 partenaires et
// ressources en barres, poids des ressources en anneau, répartition
// partenaires × ressources en barres empilées.
//
// La sélection se manipule dans la ligne de contexte : la pastille de
// direction BASCULE exportations ↔ importations d'un tap, la période et le
// pays ouvrent la feuille de filtres.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { EtatErreur, EtatVide } from "@/components/ui";
import { BarresEmpilees, BarresH } from "@/components/GrapheBarres";
import GrapheDonut from "@/components/GrapheDonut";
import Icone from "@/components/Icone";
import StatistiquesFiltres, { FiltresStatistiques } from "@/components/StatistiquesFiltres";
import VedetteSeries, { GrapheVedette } from "@/components/VedetteSeries";
import { getJson } from "@/lib/api";
import { fmtUSD } from "@/lib/format";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";

const VUES_COMMERCE = [
  { cle: "exportateur", label: "Vue exportateur" },
  { cle: "importateur", label: "Vue importateur" },
] as const;

export default function CommercePanel({ filtresOuverts, onFermerFiltres, onOuvrirFiltres, onNbFiltres }: {
  filtresOuverts: boolean; onFermerFiltres: () => void; onOuvrirFiltres: () => void; onNbFiltres: (n: number) => void;
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

  // Badge du bouton filtre du hero (la direction se bascule sur sa pastille)
  const nbFiltres =
    (senId !== null && selId !== senId ? 1 : 0) +
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > bornes[0] || f.anneeMax < bornes[1]) ? 1 : 0));
  useEffect(() => { onNbFiltres(nbFiltres); }, [nbFiltres, onNbFiltres]);

  const selPays = paysOpts.find((p: any) => p.id === selId);
  const perLabel = f.modeAnnees === "specifiques" && f.anneesSpec.length
    ? (f.anneesSpec.length === 1 ? `${f.anneesSpec[0]}` : `${f.anneesSpec[0]} — ${f.anneesSpec[f.anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;

  if (isLoading) return <SqueletteDonnees />;
  if (isError) return <EtatErreur onRetry={() => refetch()} />;
  if (!annees.length) return (
    <EtatVide texte="Aucune donnée commerciale" sousTexte="Les flux bilatéraux seront disponibles après import dans l'administration." />
  );

  // ── L'évolution du flux et la balance — vedette commutable ──
  const graphes: GrapheVedette[] = [
    {
      cle: expDir ? "exportations" : "importations",
      label: expDir ? "Exportations" : "Importations", fmt: fmtUSD,
      series: [{ nom: expDir ? "Exportations" : "Importations", couleur: "#004f91",
        data: balance.map((b: any) => ({ annee: b.annee, valeur: expDir ? b.exportations : b.importations })) }],
    },
    {
      cle: "balance", label: "Balance commerciale", fmt: fmtUSD,
      series: [{ nom: "Balance", couleur: "#188038",
        data: balance.map((b: any) => ({ annee: b.annee, valeur: b.balance })) }],
    },
  ];

  // ── Repères du commerce (règles du site) ──
  const ref = kpis?.annee_ref;
  const reperes = [
    { cle: "total", label: expDir ? "Total exportations" : "Total importations", note: ref ? `en ${ref}` : null, valeur: fmtUSD(kpis?.total ?? null) },
    { cle: "record", label: "Année record", note: kpis?.annee_record ? fmtUSD(kpis.annee_record.valeur) : null, valeur: kpis?.annee_record ? String(kpis.annee_record.annee) : "—" },
    { cle: "partenaire", label: expDir ? "1er client" : "1er fournisseur", note: kpis?.top_partenaire ? fmtUSD(kpis.top_partenaire.valeur) : null, valeur: kpis?.top_partenaire?.nom || "—" },
    { cle: "ressource", label: "1re ressource", note: kpis?.top_ressource ? fmtUSD(kpis.top_ressource.valeur) : null, valeur: kpis?.top_ressource?.ressource || "—" },
  ];

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
      {/* Période → filtres · direction → BASCULE d'un tap · pays → filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.pastilles}>
        <Pressable onPress={onOuvrirFiltres} style={s.periodePastille}>
          <Text style={s.periodePastilleTexte}>{perLabel}</Text>
        </Pressable>
        <Pressable onPress={() => { tick(); setFiltres({ ...f, vue: expDir ? "importateur" : "exportateur" }); }}
          style={s.directionPastille} accessibilityLabel="Basculer exportations / importations">
          <Text style={s.directionPastilleTexte}>{expDir ? "Exportations" : "Importations"}</Text>
          <Icone sf="arrow.left.arrow.right" materiel="swap_horiz" taille={13} couleur={T.orange} />
        </Pressable>
        <Pressable onPress={onOuvrirFiltres} style={s.paysPastille}>
          <View style={s.paysPoint} />
          <Text style={s.paysPastilleTexte} numberOfLines={1}>{selPays?.nom || "—"}</Text>
        </Pressable>
      </ScrollView>

      {/* L'évolution en vedette, la balance en rangée commutable */}
      {balance.length > 0 && <VedetteSeries graphes={graphes} />}

      {/* Les repères du commerce — à plat */}
      <View style={s.rangee}>
        <Text style={s.sectionTitre}>REPÈRES</Text>
        <View style={s.carteListe}>
          {reperes.map((r, i) => (
            <View key={r.cle} style={[s.ligne, i > 0 && s.ligneBord]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.ligneNom}>{r.label}</Text>
                {r.note ? <Text style={s.ligneNote}>{r.note}</Text> : null}
              </View>
              <Text style={s.ligneValeur} numberOfLines={1}>{r.valeur}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Classements et répartitions */}
      <View style={{ gap: 12, marginTop: 16, paddingHorizontal: 16 }}>
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
  pastilles: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14, paddingHorizontal: 16 },
  // Les styles badge_* de la plateforme
  periodePastille: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(108,117,125,0.28)",
  },
  periodePastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: "#6b7280", fontVariant: ["tabular-nums"] },
  directionPastille: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(202,99,31,0.24)",
  },
  directionPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.orange },
  paysPastille: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1,
    borderColor: "rgba(0,79,145,0.20)", backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 12, paddingVertical: 5, maxWidth: 190,
  },
  paysPoint: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.bleu },
  paysPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: T.bleu, flexShrink: 1 },

  rangee: { paddingHorizontal: 16, marginTop: 14 },
  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  carteListe: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16, paddingVertical: 3,
  },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9.5 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  ligneNom: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  ligneNote: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  ligneValeur: { flexShrink: 1, fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"], textAlign: "right" },

  carte: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 15, paddingTop: 13, paddingBottom: 12,
  },
  carteTitreLigne: { flexDirection: "row", alignItems: "baseline", gap: 7, flexWrap: "wrap", marginBottom: 10 },
  carteTitre: { fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, letterSpacing: -0.2, flexShrink: 1 },
  carteSous: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.gris },
});
