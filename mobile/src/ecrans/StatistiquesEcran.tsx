// Échanges commerciaux — trois lentilles en chips colorées (le pattern des
// Zones et des Opportunités) : Indicateurs économiques, Flux bilatéraux,
// Commerce extérieur.
//
// Les Indicateurs économiques suivent la grammaire des Investissements : UNE
// grande courbe en vedette (nombre en 34 pt, variation fléchée, graphe
// signature épuré, légende en comparaison), les autres indicateurs traçables
// en rangées commutables, le reste (superficie, croissances) à plat avec sa
// variation fléchée. La comparaison de pays se manipule dans la ligne de
// contexte : pastilles ✕ et bouton + (jusqu'à 4 pays).
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { EtatErreur } from "@/components/ui";
import CommerceExterieurPanel from "@/components/CommerceExterieurPanel";
import CommercePanel from "@/components/CommercePanel";
import EnTetePage from "@/components/EnTetePage";
import Icone from "@/components/Icone";
import PaysSheet from "@/components/PaysSheet";
import StatistiquesFiltres, { FiltresStatistiques } from "@/components/StatistiquesFiltres";
import VedetteSeries, { GrapheVedette } from "@/components/VedetteSeries";
import { getJson } from "@/lib/api";
import { COMP_PALETTE } from "@/lib/couleurs";
import { fmtUnite } from "@/lib/format";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";
import { useMargeBas } from "@/lib/marges";

// Les trois lentilles — chips colorées comme les types de zones
const LENTILLES = [
  { cle: "indicateurs", label: "Indicateurs économiques", couleur: "#004f91" },
  { cle: "commerce",    label: "Flux bilatéraux",         couleur: "#ca631f" },
  { cle: "exterieur",   label: "Commerce extérieur",      couleur: "#188038" },
] as const;

const fmtPct = (v: number) => Math.abs(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default function StatistiquesEcran() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const { width } = useWindowDimensions();
  const [vue, setVue] = useState("indicateurs");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [paysOuvert, setPaysOuvert] = useState(false);
  const [nbFiltresCom, setNbFiltresCom] = useState(0);
  const chipsRef = useRef<ScrollView>(null);
  const chipsPos = useRef<Record<string, { x: number; largeur: number }>>({});

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

  const valeur = (paysId: number, code: string, annee: number) =>
    (donnees || []).find((d: any) => d.pays_id === paysId && d.indicateur === code && d.annee === annee)?.valeur ?? null;
  const paysNom = (id: number) => (pays || []).find((p: any) => p.id === id)?.nom || "";
  const couleurPays = (id: number) => COMP_PALETTE[Math.max(0, f.selection.indexOf(id)) % COMP_PALETTE.length];
  const multi = f.selection.length > 1;

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

  // ── Gestion directe des pays (pastilles ✕ et bouton +) ──
  const ajouterPays = (id: number) => {
    const sel = [...f.selection.filter(x => x !== id), id].slice(0, 4);
    setFiltres({ ...f, vue: sel.length > 1 ? "comparative" : "pays", selection: sel });
  };
  const retirerPays = (id: number) => {
    const sel = f.selection.filter(x => x !== id);
    if (!sel.length) return;
    setFiltres({ ...f, vue: sel.length > 1 ? "comparative" : "pays", selection: sel });
  };

  // ── Les indicateurs traçables → vedette + rangées commutables ──
  const estTracable = (ind: any) => ind.code !== "superficie" &&
    !(ind.code || "").includes("croissance") && !(ind.libelle || "").toLowerCase().includes("croissance");
  const graphes: GrapheVedette[] = useMemo(() =>
    (indicateurs || [])
      .filter((ind: any) => estTracable(ind) &&
        f.selection.some(id => anneesActives.some(a => valeur(id, ind.code, a) !== null)))
      .map((ind: any) => ({
        cle: ind.code, label: ind.libelle,
        fmt: (v: number | null) => fmtUnite(v, ind.unite),
        series: f.selection.map(id => ({
          nom: paysNom(id), couleur: couleurPays(id),
          data: anneesActives.map(a => ({ annee: a, valeur: valeur(id, ind.code, a) })),
        })),
      })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [indicateurs, donnees, anneesActives, f.selection]);

  // ── Le reste — à plat, variation vs N-1 fléchée quand elle existe ──
  const autresIndics = useMemo(() =>
    (indicateurs || [])
      .filter((ind: any) => !estTracable(ind))
      .map((ind: any) => {
        const parPays = f.selection.map(id => ({ id, d: derniereValeur(id, ind.code) })).filter(x => x.d);
        if (!parPays.length) return null;
        const d = parPays[0].d!;
        let delta: number | null = null;
        if (d.precedente) { const pct = (d.valeur - d.precedente) / Math.abs(d.precedente) * 100; if (isFinite(pct)) delta = pct; }
        return { ind, parPays, d, delta };
      })
      .filter(Boolean) as { ind: any; parPays: { id: number; d: any }[]; d: any; delta: number | null }[],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [indicateurs, donnees, anneesActives, f.selection]);

  const nbFiltres =
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > bornes[0] || f.anneeMax < bornes[1]) ? 1 : 0));

  const perLabel = f.modeAnnees === "specifiques" && f.anneesSpec.length
    ? (f.anneesSpec.length === 1 ? `${f.anneesSpec[0]}` : `${f.anneesSpec[0]} — ${f.anneesSpec[f.anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;

  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;
  const badgeHero = vue === "indicateurs" ? nbFiltres : vue === "commerce" ? nbFiltresCom : 0;
  const boutonHero = vue === "exterieur" ? undefined
    : { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: badgeHero || undefined };

  return (
    <>
      <Animated.ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: margeBas }}>
        <EnTetePage retour={false} titre="Échanges commerciaux" bouton={boutonHero} />

        {/* Les trois lentilles en chips colorées */}
        <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }} contentContainerStyle={[s.chipsRangee, cap]}>
          {LENTILLES.map(l => {
            const actif = vue === l.cle;
            return (
              <Pressable key={l.cle}
                onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; chipsPos.current[l.cle] = { x, largeur: la }; }}
                onPress={() => {
                  tick();
                  setVue(l.cle);
                  const p = chipsPos.current[l.cle];
                  if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
                }}
                style={[s.chipFiltre, actif && { backgroundColor: `${l.couleur}14`, borderColor: `${l.couleur}66` }]}>
                <Text style={[s.chipFiltreTexte, { color: l.couleur }, actif && { fontFamily: POLICE.gras }]}>{l.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {vue === "commerce" ? (
          <View style={cap}>
            <CommercePanel
              filtresOuverts={filtresOuverts && vue === "commerce"}
              onFermerFiltres={() => setFiltresOuverts(false)}
              onOuvrirFiltres={() => setFiltresOuverts(true)}
              onNbFiltres={setNbFiltresCom} />
          </View>
        ) : vue === "exterieur" ? (
          <View style={cap}>
            <CommerceExterieurPanel />
          </View>
        ) : isLoading || !indicateurs || !pays ? (
          <SqueletteDonnees />
        ) : isError ? (
          <EtatErreur onRetry={() => refetch()} />
        ) : (
          <View style={cap}>
            {/* La sélection se manipule ICI : période → filtres, pastille →
                retirer (✕), + → ajouter un pays */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.pastilles}>
              <Pressable onPress={() => setFiltresOuverts(true)} style={s.periodePastille}>
                <Text style={s.periodePastilleTexte}>{perLabel}</Text>
              </Pressable>
              {f.selection.map(id => (
                <Pressable key={id}
                  onPress={multi ? () => { tick(); retirerPays(id); } : () => setFiltresOuverts(true)}
                  style={[s.paysPastille, { borderColor: `${couleurPays(id)}33` }]}>
                  <View style={[s.paysPoint, { backgroundColor: couleurPays(id) }]} />
                  <Text style={[s.paysPastilleTexte, { color: couleurPays(id) }]} numberOfLines={1}>{paysNom(id)}</Text>
                  {multi && <Icone sf="xmark" materiel="close" taille={11} couleur={couleurPays(id)} />}
                </Pressable>
              ))}
              {f.selection.length < 4 && (
                <Pressable onPress={() => { tick(); setPaysOuvert(true); }} style={s.plusPastille}
                  accessibilityLabel="Ajouter un pays à comparer">
                  <Icone sf="plus" materiel="add" taille={14} couleur={T.bleu} poids="semibold" />
                </Pressable>
              )}
            </ScrollView>

            {/* Une courbe en vedette, les autres en rangées commutables */}
            <VedetteSeries graphes={graphes} />

            {/* Le reste des indicateurs — à plat */}
            {autresIndics.length > 0 && (
              <View style={s.rangee}>
                <Text style={s.sectionTitre}>AUTRES INDICATEURS</Text>
                <View style={s.carteListe}>
                  {autresIndics.map((l, i) => {
                    const hausse = (l.delta ?? 0) >= 0;
                    return (
                      <View key={l.ind.code} style={[s.ligne, i > 0 && s.ligneBord]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.ligneNom} numberOfLines={2}>{l.ind.libelle}</Text>
                          <Text style={s.ligneNote}>en {l.d.annee}</Text>
                        </View>
                        {multi ? (
                          <View style={s.ligneMulti}>
                            {l.parPays.map(x => (
                              <Text key={x.id} style={[s.ligneValeur, { color: couleurPays(x.id) }]}>
                                {fmtUnite(x.d.valeur, l.ind.unite)}
                              </Text>
                            ))}
                          </View>
                        ) : (
                          <>
                            {l.delta != null && (
                              <View style={s.delta}>
                                <Icone sf={hausse ? "arrow.up.right" : "arrow.down.right"}
                                  materiel={hausse ? "north_east" : "south_east"}
                                  taille={10} couleur={hausse ? T.vert : "#dc2626"} poids="bold" />
                                <Text style={[s.deltaTexte, { color: hausse ? T.vert : "#dc2626" }]}>{fmtPct(l.delta)} %</Text>
                              </View>
                            )}
                            <Text style={s.ligneValeur}>{fmtUnite(l.d.valeur, l.ind.unite)}</Text>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {paysOuvert && (
        <PaysSheet pays={pays || []} exclus={f.selection}
          onChoisir={ajouterPays} onClose={() => setPaysOuvert(false)} />
      )}

      {filtresOuverts && vue === "indicateurs" && (
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
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipFiltre: {
    paddingHorizontal: 14, paddingVertical: 7.5, borderRadius: 999,
    backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure,
  },
  chipFiltreTexte: { fontSize: 12.5, fontFamily: POLICE.demi },

  pastilles: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14, paddingHorizontal: 16 },
  // Les styles badge_* de la plateforme
  periodePastille: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(108,117,125,0.28)",
  },
  periodePastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: "#6b7280", fontVariant: ["tabular-nums"] },
  paysPastille: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 12, paddingVertical: 5, maxWidth: 190,
  },
  paysPoint: { width: 7, height: 7, borderRadius: 4 },
  paysPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, flexShrink: 1 },
  plusPastille: {
    width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: T.bleuVoile, borderWidth: 1, borderColor: "rgba(0,79,145,0.22)",
  },

  rangee: { paddingHorizontal: 16, marginTop: 14 },
  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  carteListe: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16, paddingVertical: 3,
  },
  ligne: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9.5 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  ligneNom: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  ligneNote: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  ligneValeur: { fontSize: 13.5, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  ligneMulti: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, maxWidth: 200 },
  delta: { flexDirection: "row", alignItems: "center", gap: 2 },
  deltaTexte: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
});
