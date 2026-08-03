// Échanges commerciaux — trois lentilles en chips colorées : Indicateurs
// économiques, Flux bilatéraux, Commerce extérieur.
//
// Les Indicateurs économiques reprennent EXACTEMENT la grammaire de la carte
// vedette de l'accueil : micro-étiquette, badge pays blanc dans le coin, le
// nombre en 38 pt qui compte, la variation vs N-1 fléchée, la silhouette
// Skia de toute la série (sans axes), et les repères en grille (2 par ligne)
// — toucher un repère l'installe en vedette. Le PIB ouvre la danse ;
// Population, PIB par habitant, imports / exports de marchandises et de
// services et les deux balances commerciales tournent dessous. Superficie et
// croissances ne sont pas embarquées sur l'app.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, Tapable } from "@/components/ui";
import CommerceExterieurPanel from "@/components/CommerceExterieurPanel";
import CommercePanel from "@/components/CommercePanel";
import EnTetePage from "@/components/EnTetePage";
import Icone from "@/components/Icone";
import MiniTendance from "@/components/MiniTendance";
import StatistiquesFiltres, { FiltresStatistiques } from "@/components/StatistiquesFiltres";
import { getJson } from "@/lib/api";
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

// La rotation de la vedette — le PIB en tête, puis les huit repères.
// Les indicateurs sont retrouvés dans le référentiel par leur libellé
// (les codes varient selon l'import) ; un repère absent est simplement omis.
const plier = (x: string) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const VOULUS: { cle: string; court: string; test: (ind: any) => boolean }[] = [
  { cle: "pib",      court: "PIB",                  test: i => i.code === "pib" },
  { cle: "pop",      court: "POPULATION",           test: i => plier(i.libelle).startsWith("population") },
  { cle: "pibhab",   court: "PIB / HABITANT",       test: i => plier(i.libelle).includes("par habitant") },
  { cle: "impM",     court: "IMPORTS MARCHANDISES", test: i => plier(i.libelle).includes("importations de marchandises") },
  { cle: "expM",     court: "EXPORTS MARCHANDISES", test: i => plier(i.libelle).includes("exportations de marchandises") },
  { cle: "impS",     court: "IMPORTS SERVICES",     test: i => plier(i.libelle).includes("importations de services") },
  { cle: "expS",     court: "EXPORTS SERVICES",     test: i => plier(i.libelle).includes("exportations de services") },
  { cle: "bcM",      court: "BALANCE MARCHANDISES", test: i => plier(i.libelle).includes("balance") && plier(i.libelle).includes("marchandises") },
  { cle: "bcS",      court: "BALANCE SERVICES",     test: i => plier(i.libelle).includes("balance") && plier(i.libelle).includes("services") },
];

type Point = { annee: number; valeur: number };

export default function StatistiquesEcran() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const { width } = useWindowDimensions();
  const [vue, setVue] = useState("indicateurs");
  const [actif, setActif] = useState("pib");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [nbFiltresCom, setNbFiltresCom] = useState(0);
  const [largeurTendance, setLargeurTendance] = useState(0);
  const chipsRef = useRef<ScrollView>(null);
  const chipsPos = useRef<Record<string, { x: number; largeur: number }>>({});

  const { data: pays } = useQuery({ queryKey: ["stat-pays"], queryFn: () => getJson<any[]>("/statistiques/pays") });
  const { data: indicateurs } = useQuery({ queryKey: ["stat-indicateurs"], queryFn: () => getJson<any[]>("/statistiques/indicateurs"), staleTime: Infinity });
  const senId = useMemo(() => (pays || []).find((p: any) => p.code_iso3 === "SEN")?.id ?? null, [pays]);

  // Filtres appliqués (pays et période via la feuille)
  const [filtres, setFiltres] = useState<FiltresStatistiques | null>(null);
  const f: FiltresStatistiques = filtres ?? {
    vue: "pays", selection: senId !== null ? [senId] : [],
    modeAnnees: "plage", anneeMin: 0, anneeMax: 9999, anneesSpec: [],
  };
  const paysId = f.selection[0] ?? senId;

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

  const paysNom = (id: number | null) => (pays || []).find((p: any) => p.id === id)?.nom || "";

  // Les repères présents dans le référentiel, dans l'ordre voulu
  const reperes = useMemo(() =>
    VOULUS.map(v => ({ ...v, ind: (indicateurs || []).find(v.test) }))
      .filter(v => v.ind) as (typeof VOULUS[number] & { ind: any })[],
  [indicateurs]);
  const repereActif = reperes.find(r => r.cle === actif) ?? reperes[0];

  const serieDe = (code: string): Point[] => {
    if (paysId == null) return [];
    return anneesActives
      .map(a => ({ annee: a, valeur: (donnees || []).find((d: any) => d.pays_id === paysId && d.indicateur === code && d.annee === a)?.valeur ?? null }))
      .filter((p): p is Point => p.valeur != null);
  };

  const nbFiltres =
    (senId !== null && paysId !== senId ? 1 : 0) +
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > bornes[0] || f.anneeMax < bornes[1]) ? 1 : 0));

  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;
  const badgeHero = vue === "indicateurs" ? nbFiltres : vue === "commerce" ? nbFiltresCom : 0;
  const boutonHero = vue === "exterieur" ? undefined
    : { icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: badgeHero || undefined };

  // ── La vedette (grammaire exacte de l'accueil) ──
  const rendreVedette = () => {
    if (!repereActif) return null;
    const serie = serieDe(repereActif.ind.code);
    const dernier = serie.at(-1) ?? null;
    const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
    const delta = dernier && precedent && precedent.valeur !== 0
      ? ((dernier.valeur - precedent.valeur) / Math.abs(precedent.valeur)) * 100 : null;
    const hausse = (delta ?? 0) >= 0;
    const autres = reperes.filter(r => r.cle !== repereActif.cle);
    const fmt = (v: number) => fmtUnite(v, repereActif.ind.unite);
    return (
      <View style={[s.rangee, cap]}>
        <View style={s.vedette}>
          {/* Étiquette + le pays en badge blanc, sans point */}
          <View style={s.vedetteEnTete}>
            <Text style={s.etiquette} numberOfLines={1}>
              {String(repereActif.ind.libelle).toUpperCase()}{dernier ? ` · ${dernier.annee}` : ""}
            </Text>
            <Pressable onPress={() => setFiltresOuverts(true)} style={s.badgePays}>
              <Text style={s.badgePaysTexte} numberOfLines={1}>{paysNom(paysId) || "—"}</Text>
            </Pressable>
          </View>

          {dernier ? (
            <View style={s.nombreLigne}>
              <ChiffreAnime texte={fmt(dernier.valeur)} style={s.nombre} />
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
            <Text style={s.indispo}>Donnée indisponible pour cette série.</Text>
          )}

          {/* La silhouette de la série entière */}
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

          {/* Les repères en grille — toucher installe en vedette */}
          <View style={s.pied}>
            {autres.map((r, i) => {
              const sx = serieDe(r.ind.code);
              const d = sx.at(-1) ?? null;
              return (
                <Tapable key={r.cle} echelle={0.96}
                  onPress={() => { tick(); setActif(r.cle); }}
                  style={[s.repere, i % 2 === 1 && s.repereDroit, i >= 2 && s.repereBas]}>
                  <Text style={s.repereLabel} numberOfLines={1}>{r.court}</Text>
                  <Text style={s.repereValeur} numberOfLines={1} adjustsFontSizeToFit>
                    {d ? fmtUnite(d.valeur, r.ind.unite) : "—"}
                    {d ? <Text style={s.repereAnnee}>  {d.annee}</Text> : null}
                  </Text>
                </Tapable>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <Animated.ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: margeBas }}>
        <EnTetePage retour={false} titre="Échanges commerciaux" bouton={boutonHero} />

        {/* Les trois lentilles en chips colorées */}
        <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }} contentContainerStyle={[s.chipsRangee, cap]}>
          {LENTILLES.map(l => {
            const lActif = vue === l.cle;
            return (
              <Pressable key={l.cle}
                onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; chipsPos.current[l.cle] = { x, largeur: la }; }}
                onPress={() => {
                  tick();
                  setVue(l.cle);
                  const p = chipsPos.current[l.cle];
                  if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
                }}
                style={[s.chipFiltre, lActif && { backgroundColor: `${l.couleur}14`, borderColor: `${l.couleur}66` }]}>
                <Text style={[s.chipFiltreTexte, { color: l.couleur }, lActif && { fontFamily: POLICE.gras }]}>{l.label}</Text>
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
          rendreVedette()
        )}
      </Animated.ScrollView>

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

  rangee: { paddingHorizontal: 16, marginTop: 14 },

  // La carte vedette — les styles exacts de l'accueil
  vedette: {
    backgroundColor: T.carte, borderRadius: 18, borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  vedetteEnTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  // Badge blanc du pays, sans point — le tap ouvre les filtres pour en changer
  badgePays: {
    backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
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
  borne: { fontSize: 10, fontFamily: POLICE.demi, color: T.grisClair, fontVariant: ["tabular-nums"] },

  pied: {
    flexDirection: "row", flexWrap: "wrap",
    marginTop: 14, paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  repere: { width: "50%", paddingTop: 10, paddingBottom: 2, paddingRight: 10 },
  repereDroit: { paddingRight: 0, paddingLeft: 10, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: T.bordure },
  repereBas: { marginTop: 8 },
  repereLabel: { fontSize: 9.5, fontFamily: POLICE.gras, color: T.gris, letterSpacing: 0.8 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, marginTop: 3, fontVariant: ["tabular-nums"] },
  repereAnnee: { fontSize: 11, fontFamily: POLICE.normal, color: T.grisClair },
});
