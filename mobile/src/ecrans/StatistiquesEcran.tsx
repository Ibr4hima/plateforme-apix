// Échanges commerciaux — trois lentilles en pastilles : Indicateurs
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
import { useScrollToTop } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, ChipFiltre, EtatErreur, IconeTendance, Ondulable, Tapable, EtatHorsLigne, Variation } from "@/components/ui";
import CommerceExterieurPanel from "@/components/CommerceExterieurPanel";
import CommercePanel from "@/components/CommercePanel";
import CurseurAnnees from "@/components/CurseurAnnees";
import EnTetePage from "@/components/EnTetePage";
import MiniTendance from "@/components/MiniTendance";
import PaysSheet from "@/components/PaysSheet";
import { enPanne, getJson, horsLigne } from "@/lib/api";
import { fmtUnite, variation } from "@/lib/format";
import { coin, FONTE, T, TYPO } from "@/theme";
import { useMargeBas, useCap } from "@/lib/marges";
import { creerStyles } from "@/lib/apparence";
import TexteDefilant from "@/components/TexteDefilant";

// Les trois lentilles, en pastilles (ChipFiltre)
const LENTILLES = [
  { cle: "indicateurs", label: "Indicateurs économiques", couleur: "bleu" },
  { cle: "commerce",    label: "Flux bilatéraux",         couleur: "bleu" },
  { cle: "exterieur",   label: "Commerce extérieur",      couleur: "bleu" },
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

// Ce que l'écran lit : le pays choisi, et la période (toute la série par défaut)
type FiltresStatistiques = {
  vue: string;
  typeAnalyse?: string;
  selection: number[];
  modeAnnees: "plage" | "specifiques";
  anneeMin: number;
  anneeMax: number;
  anneesSpec: number[];
};

export default function StatistiquesEcran() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const [vue, setVue] = useState("indicateurs");
  // Ouvert depuis l'Accueil sur une série : la lentille (et le sens des
  // échanges) qu'elle désigne. Le jeton change à chaque ouverture : la même
  // vue demandée deux fois s'applique deux fois
  const lien = useLocalSearchParams<{ vue?: string; sens?: string; jeton?: string }>();
  useEffect(() => {
    if (lien.vue && LENTILLES.some(l => l.cle === lien.vue)) setVue(lien.vue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lien.jeton]);
  const [actif, setActif] = useState("pib");
  // Année de référence du curseur (null = la dernière connue, qui suit les données)
  const [anneeSel, setAnneeSel] = useState<number | null>(null);
  const [paysOuvert, setPaysOuvert] = useState(false);
  const [largeurTendance, setLargeurTendance] = useState(0);
  const chipsRef = useRef<ScrollView>(null);
  // Retoucher l'onglet déjà actif remonte la page en haut
  const defilement = useRef<any>(null);
  useScrollToTop(defilement);
  const chipsPos = useRef<Record<string, { x: number; largeur: number }>>({});

  // Les deux référentiels gardent leur état : si l'un manque, l'écran le dit
  // et se relance — au lieu d'un squelette sans fin
  const qPays = useQuery({ queryKey: ["stat-pays"], queryFn: () => getJson<any[]>("/statistiques/pays") });
  const qIndicateurs = useQuery({ queryKey: ["stat-indicateurs"], queryFn: () => getJson<any[]>("/statistiques/indicateurs"), staleTime: Infinity });
  const pays = qPays.data;
  const indicateurs = qIndicateurs.data;
  const senId = useMemo(() => (pays || []).find((p: any) => p.code_iso3 === "SEN")?.id ?? null, [pays]);

  // Le pays lu (choisi dans sa feuille) et la période
  const [filtres, setFiltres] = useState<FiltresStatistiques | null>(null);
  const f: FiltresStatistiques = filtres ?? {
    vue: "pays", selection: senId !== null ? [senId] : [],
    modeAnnees: "plage", anneeMin: 0, anneeMax: 9999, anneesSpec: [],
  };
  const paysId = f.selection[0] ?? senId;

  const qDonnees = useQuery({
    queryKey: ["stat-donnees", f.selection.join(",")],
    enabled: f.selection.length > 0,
    queryFn: () => getJson<any[]>(`/statistiques/donnees?pays=${f.selection.join(",")}`),
  });
  const donnees = qDonnees.data;

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

  // Le curseur ne peut pointer que dans les années actives
  useEffect(() => {
    if (anneeSel != null && !anneesActives.includes(anneeSel)) setAnneeSel(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesActives.join(",")]);
  // La série coupée à l'année du curseur : le dernier point devient l'année
  // choisie, la variation se lit vs l'année précédente
  const jusqu = (sx: Point[]) => anneeSel == null ? sx : sx.filter(pt => pt.annee <= anneeSel);
  // L'année que dit le curseur — aucune quand il s'efface, faute de deux
  // années : la carte ne la répète pas, sauf si sa valeur date d'une autre
  const anneeCurseur = anneesActives.length > 1 ? (anneeSel ?? anneesActives[anneesActives.length - 1]) : null;

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

  const cap = useCap();
  // Indicateurs et Flux bilatéraux : le bouton « … » ouvre le choix du pays
  // (plus d'analyse comparative sur l'app) ; Commerce extérieur est Sénégal
  // uniquement, sans bouton
  const boutonHero = vue === "exterieur" ? undefined
    : { onPress: () => setPaysOuvert(true), libelle: "Choisir le pays" };

  // ── La vedette (grammaire exacte de l'accueil) ──
  const rendreVedette = () => {
    if (!repereActif) return null;
    const serie = jusqu(serieDe(repereActif.ind.code));
    const dernier = serie.at(-1) ?? null;
    const precedent = serie.length > 1 ? serie[serie.length - 2] : null;
    // En points pour un taux, en pourcentage sinon (lib/format)
    const varia = dernier && precedent ? variation(dernier.valeur, precedent.valeur, repereActif.ind.unite) : null;
    const hausse = (varia?.delta ?? 0) >= 0;
    const autres = reperes.filter(r => r.cle !== repereActif.cle);
    const fmt = (v: number) => fmtUnite(v, repereActif.ind.unite, repereActif.ind.code);
    return (
      <View style={[s.rangee, cap]}>
        {/* Le curseur d'années — le doigt remonte le temps */}
        <CurseurAnnees annees={anneesActives}
          valeur={anneeSel ?? anneesActives[anneesActives.length - 1]}
          onChange={a => setAnneeSel(a === anneesActives[anneesActives.length - 1] ? null : a)} />
        <View style={s.vedette}>
          {/* Étiquette + le pays en badge blanc, sans point */}
          <View style={s.vedetteEnTete}>
            <TexteDefilant style={s.etiquette}>
              {String(repereActif.ind.libelle).toUpperCase()}{dernier && dernier.annee !== anneeCurseur ? ` · ${dernier.annee}` : ""}
            </TexteDefilant>
            <Ondulable onPress={() => setPaysOuvert(true)} style={s.badgePays} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityLabel={`Pays : ${paysNom(paysId) || "aucun"}. Changer`}>
              <TexteDefilant style={s.badgePaysTexte}>{paysNom(paysId) || "—"}</TexteDefilant>
            </Ondulable>
          </View>

          {dernier ? (
            <View style={s.nombreLigne}>
              <ChiffreAnime texte={fmt(dernier.valeur)} style={s.nombre} />
              {varia && (
                <Variation hausse={hausse} texte={varia.texte} annee={precedent!.annee} />
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
              const sx = jusqu(serieDe(r.ind.code));
              const d = sx.at(-1) ?? null;
              const p = sx.length > 1 ? sx[sx.length - 2] : null;
              const dpc = d && p ? variation(d.valeur, p.valeur, r.ind.unite)?.delta ?? null : null;
              return (
                <Tapable key={r.cle}
                  onPress={() => setActif(r.cle)}
                  style={[s.repere, i > 0 && s.repereBord]}>
                  <TexteDefilant style={s.repereLabel}>{r.court}</TexteDefilant>
                  <Text style={s.repereValeur} numberOfLines={1}>
                    {d ? fmtUnite(d.valeur, r.ind.unite, r.ind.code) : "—"}
                  </Text>
                  <IconeTendance delta={dpc} />
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
      {/* L'en-tête est ancré hors du défilement. AUCUNE VUE AUTOUR DE LA
          LISTE : retoucher l'onglet remonte, sur iOS, la liste que le système
          trouve en suivant le premier enfant de l'écran — elle doit être là,
          comme sur l'Accueil. */}
        <EnTetePage titre="Échanges commerciaux" titreCourt="Économie" bouton={boutonHero} />
        <Animated.ScrollView ref={defilement} style={{ flex: 1, backgroundColor: T.fond }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: margeBas }}>

        {/* Les trois lentilles en chips colorées */}
        <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false}
          style={[{ flexGrow: 0 }, cap]} contentContainerStyle={s.chipsRangee} accessibilityRole="tablist">
          {LENTILLES.map(l => {
            const lActif = vue === l.cle;
            return (
              <ChipFiltre key={l.cle} label={l.label} actif={lActif}
                onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; chipsPos.current[l.cle] = { x, largeur: la }; }}
                onPress={() => {
                  setVue(l.cle);
                  const p = chipsPos.current[l.cle];
                  if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
                }} />
            );
          })}
        </ScrollView>

        {vue === "commerce" ? (
          <View style={cap}>
            <CommercePanel pays={pays || []} paysId={paysId}
              onOuvrirPays={() => setPaysOuvert(true)} />
          </View>
        ) : vue === "exterieur" ? (
          <View style={cap}>
            <CommerceExterieurPanel sensDemande={lien.sens === "import" || lien.sens === "export" ? lien.sens : undefined}
              jeton={lien.jeton} />
          </View>
        ) : enPanne(qPays) || enPanne(qIndicateurs) || enPanne(qDonnees) ? (
          <EtatErreur onRetry={() => { qPays.refetch(); qIndicateurs.refetch(); qDonnees.refetch(); }} />
        ) : horsLigne(qPays) || horsLigne(qIndicateurs) || horsLigne(qDonnees) ? (
          <EtatHorsLigne />
        ) : donnees === undefined || !indicateurs || !pays ? (
          <SqueletteDonnees />
        ) : (
          rendreVedette()
        )}
        </Animated.ScrollView>

      {paysOuvert && (
        <PaysSheet pays={pays || []} choisi={paysId}
          onChoisir={id => setFiltres({ ...f, vue: "pays", selection: [id] })}
          onClose={() => setPaysOuvert(false)} />
      )}
    </>
  );
}

const s = creerStyles(() => ({
  chipsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },

  rangee: { paddingHorizontal: 16, marginTop: 14 },

  // La carte vedette — les styles exacts de l'accueil
  vedette: {
    backgroundColor: T.carte, borderRadius: coin(18), borderCurve: "continuous",
    paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden",
    borderWidth: 1, borderColor: T.carteBord,
  },
  vedetteEnTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  etiquette: { ...TYPO.micro, color: T.gris, flexShrink: 1 },
  // Badge blanc du pays, sans point — le tap ouvre les filtres pour en changer
  badgePays: {
    backgroundColor: T.carte, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3.5,
    borderWidth: 1, borderColor: T.lisereBleu, maxWidth: 150,
  },
  badgePaysTexte: { fontSize: 11, ...FONTE.gras, color: T.bleu },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 38, lineHeight: 44, ...FONTE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  indispo: { fontSize: 12.5, ...FONTE.normal, color: T.gris, marginTop: 10 },
  bornes: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  borne: { fontSize: 10, ...FONTE.demi, color: T.gris, fontVariant: ["tabular-nums"] },

  // Les repères, un par ligne — le label à gauche, la valeur et sa tendance à droite
  pied: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repere: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10.5 },
  repereBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  repereLabel: { flex: 1, minWidth: 0, fontSize: 9.5, ...FONTE.gras, color: T.gris, letterSpacing: 0.8 },
  repereValeur: { ...TYPO.sousTitre, color: T.encre, flexShrink: 1, fontVariant: ["tabular-nums"] },
}));
