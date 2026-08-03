// Investissements privés — la refonte mobile, pensée écran par écran et non
// plus comme une réduction de la page web.
//
// Le principe : UNE grande courbe à la fois (le pattern d'une app de marchés),
// pas quatre graphes empilés. La carte vedette reprend la grammaire de
// l'accueil — micro-étiquette, le nombre en 38 pt qui compte jusqu'à sa
// valeur, la variation vs N-1 fléchée à côté — et la prolonge avec le graphe
// signature Skia en mode épuré (ni grille ni ordonnées : le scrubbing aimanté
// et le pic suffisent). Les AUTRES séries de la catégorie sont des rangées
// commutables : libellé, dernière valeur, sparkline — toucher une rangée
// l'installe en vedette.
//
// La sélection se manipule DANS la ligne de contexte, plus seulement dans la
// feuille de filtres : chaque pastille de pays se retire d'un tap (✕), le
// bouton + ouvre un sélecteur avec recherche (jusqu'à 4 pays, la comparaison
// s'active toute seule), la pastille de période ouvre les filtres.
//
// Les 24 KPIs du site ne s'empilent plus en carrousel : « Autres
// indicateurs » les liste à plat, groupés par thème, avec leur variation
// fléchée quand elle s'applique.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SqueletteDonnees } from "@/components/Squelette";
import { ChiffreAnime, EtatErreur, EtatVide, Tapable } from "@/components/ui";
import EnTetePage from "@/components/EnTetePage";
import GrapheLignes, { Serie } from "@/components/GrapheLignes";
import Icone from "@/components/Icone";
import IdeFiltres, { FiltresIde } from "@/components/IdeFiltres";
import MiniTendance from "@/components/MiniTendance";
import NationalPanel from "@/components/NationalPanel";
import PaysSheet from "@/components/PaysSheet";
import { getJson } from "@/lib/api";
import { COMP_PALETTE } from "@/lib/couleurs";
import { KpiResult, calculerKpis, fmtKpi } from "@/lib/ideKpis";
import { tick } from "@/lib/haptique";
import { POLICE, T, TYPO } from "@/theme";
import { useMargeBas } from "@/lib/marges";

// Les deux familles — chips colorées, libellés complets
const ONGLETS = [
  { cle: "ide",       label: "Investissements Directs Étrangers", couleur: "#004f91" },
  { cle: "nationaux", label: "Investissements nationaux",         couleur: "#ca631f" },
] as const;

// Catégories d'analyse (mêmes séries que le site) — la vue Secteurs
// n'existe qu'en Greenfield / M&A
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
    { dir: "entrant", ind: "greenfield_valeur", label: "Investissements greenfield reçus",  unite: "musd" },
    { dir: "sortant", ind: "greenfield_valeur", label: "Greenfield émis à l'étranger",      unite: "musd" },
    { dir: "entrant", ind: "greenfield_nombre", label: "Projets greenfield reçus",          unite: "nombre" },
    { dir: "sortant", ind: "greenfield_nombre", label: "Projets émis à l'étranger",         unite: "nombre" },
  ],
  fusion: [
    { dir: "entrant", ind: "ma_valeur", label: "Rachats d'entreprises locales",  unite: "musd" },
    { dir: "sortant", ind: "ma_valeur", label: "Acquisitions à l'étranger",      unite: "musd" },
    { dir: "entrant", ind: "ma_nombre", label: "Nombre de rachats locaux",       unite: "nombre" },
    { dir: "sortant", ind: "ma_nombre", label: "Nombre d'acquisitions",          unite: "nombre" },
  ],
  // Vue Secteurs — greenfield sans direction (« total »), M&A ventes / achats
  secteur_greenfield: [
    { dir: "total", ind: "greenfield_valeur", label: "Valeur des projets annoncés", unite: "musd" },
    { dir: "total", ind: "greenfield_nombre", label: "Nombre de projets annoncés",  unite: "nombre" },
  ],
  secteur_fusion: [
    { dir: "entrant", ind: "ma_valeur", label: "Valeur des ventes nettes",  unite: "musd" },
    { dir: "sortant", ind: "ma_valeur", label: "Valeur des achats nets",    unite: "musd" },
    { dir: "entrant", ind: "ma_nombre", label: "Nombre de ventes",          unite: "nombre" },
    { dir: "sortant", ind: "ma_nombre", label: "Nombre d'achats",           unite: "nombre" },
  ],
};

// L'ordre du site pour la liste des indicateurs (hors streak). Les derniers
// points des quatre séries n'y figurent pas : ils sont déjà à l'écran
// (vedette + rangées de séries).
const KPI_IDS = [
  "fn_last", "sn_last",
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
  if (k.id.includes("n_pos")) return "sur la période";
  if (k.id.includes("dist_max")) return "vs pic historique";
  if (k.id.includes("regularite")) return "% années positives";
  return null;
}

type Tendance = "hausse" | "baisse" | null;
type LigneStat = { cle: string; label: string; valeur: string; note?: string | null; tendance?: Tendance };

// Un KPI signé (croissance, solde…) porte sa flèche ; les autres restent neutres
const tendanceDe = (k: KpiResult): Tendance =>
  k.valeur !== null && (k.format === "pourcentage" || k.format === "monnaie_signe")
    ? (k.valeur >= 0 ? "hausse" : "baisse") : null;

// ── Rangée d'indicateur : libellé + indicatif à gauche, valeur fléchée à droite ──
function LigneIndic({ ligne, premier }: { ligne: LigneStat; premier: boolean }) {
  const c = ligne.tendance === "hausse" ? T.vert : ligne.tendance === "baisse" ? "#dc2626" : T.encre;
  return (
    <View style={[st.ligne, !premier && st.ligneBord]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.label}>{ligne.label}</Text>
        {ligne.note ? <Text style={st.note}>{ligne.note}</Text> : null}
      </View>
      {ligne.tendance && (
        <Icone sf={ligne.tendance === "hausse" ? "arrow.up.right" : "arrow.down.right"}
          materiel={ligne.tendance === "hausse" ? "north_east" : "south_east"}
          taille={11} couleur={c} poids="bold" />
      )}
      <Text style={[st.valeur, { color: c }]}>{ligne.valeur}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  ligne: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9.5 },
  ligneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  label: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre, lineHeight: 18 },
  note: { fontSize: 11, fontFamily: POLICE.normal, color: T.gris, marginTop: 1 },
  valeur: { fontSize: 13.5, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
});

export default function IdeEcran() {
  const margeBas = useMargeBas({ sousOnglets: true });
  const { width } = useWindowDimensions();
  const [onglet, setOnglet] = useState("ide");
  const [sousType, setSousType] = useState<string>("fluxstock");
  const [serieActive, setSerieActive] = useState(0);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [paysOuvert, setPaysOuvert] = useState(false);
  const [nbFiltresNat, setNbFiltresNat] = useState(0);
  const chipsRef = useRef<ScrollView>(null);
  const chipsPos = useRef<Record<string, { x: number; largeur: number }>>({});
  const ongletsRef = useRef<ScrollView>(null);
  const ongletsPos = useRef<Record<string, { x: number; largeur: number }>>({});

  // ── Référentiels ──
  const { data: paysDispo } = useQuery({
    queryKey: ["ide-pays"], queryFn: () => getJson<any[]>("/ide/cnuced/pays-disponibles"), staleTime: Infinity,
  });
  const { data: bornesRef } = useQuery({
    queryKey: ["ide-annees"], queryFn: () => getJson<any>("/ide/cnuced/annees"), staleTime: Infinity,
  });
  const { data: groupements } = useQuery({
    queryKey: ["ide-groupements"], queryFn: () => getJson<any[]>("/ide/monde/groupements"), staleTime: Infinity,
  });
  const { data: refSecteurs } = useQuery({
    queryKey: ["ide-secteurs"], queryFn: () => getJson<any[]>("/ide/secteurs"), staleTime: Infinity,
  });
  const { data: donneesSecteurs } = useQuery({
    queryKey: ["ide-cnuced-secteurs"], queryFn: () => getJson<any[]>("/ide/cnuced-secteurs"), staleTime: 30 * 60 * 1000,
  });

  const paysListe = useMemo(() => (paysDispo || []).map((p: any, i: number) => ({
    id: i, nom: p.nom, code_iso3: p.code_iso3, continent: p.continent, region_geo: p.region_geo,
  })), [paysDispo]);
  const senId = useMemo(() => paysListe.find((p: any) => p.nom === "Sénégal")?.id ?? null, [paysListe]);

  // Groupements par défaut de la vue Monde : les 4 continents (règle du site)
  const grpDefaut = useMemo(() => {
    const noms = ["Afrique", "Amérique", "Asie", "Europe"];
    return (groupements || [])
      .filter((g: any) => g.categorie === "continent" && noms.includes(g.nom_fr))
      .slice(0, 4).map((g: any) => g.code);
  }, [groupements]);

  // ── Filtres appliqués ──
  const [filtres, setFiltres] = useState<FiltresIde | null>(null);
  const f: FiltresIde = useMemo(() => filtres ?? {
    vue: "pays", typeAnalyse: "pays",
    paysSelection: senId !== null ? [senId] : [],
    grpSelection: grpDefaut,
    secteurSelection: [0],
    compNiveau: "secteur",
    modeAnnees: "plage", anneeMin: 0, anneeMax: 9999, anneesSpec: [],
  }, [filtres, senId, grpDefaut]);
  const secteursVue = f.vue === "secteurs";
  const monde = !secteursVue && f.typeAnalyse === "monde";
  const comparative = f.typeAnalyse === "comparative";
  // La vue Secteurs n'existe pas en Flux & Stocks (règle du site)
  const st_ = secteursVue && sousType === "fluxstock" ? "greenfield" : sousType;
  const sousTypesVisibles = secteursVue ? SOUS_TYPES.filter(x => x.cle !== "fluxstock") : SOUS_TYPES;

  // La série vedette repart en tête quand le contexte change
  useEffect(() => { setSerieActive(0); }, [st_, f.vue, f.typeAnalyse]);

  // ── Bornes de période du contexte ──
  const catPays = bornesRef?.categories?.[st_];
  const bornesPays: [number, number] = [catPays?.annee_min ?? bornesRef?.annee_min ?? 1990, catPays?.annee_max ?? bornesRef?.annee_max ?? 2025];
  // Secteurs : bornes réelles du jeu de données de la catégorie
  const prefixe = st_ === "fusion" ? "ma_" : "greenfield";
  const rowsCat = useMemo(() =>
    (donneesSecteurs || []).filter((d: any) => d.indicateur.startsWith(prefixe) && d.valeur !== null),
  [donneesSecteurs, prefixe]);
  const bornesSecteurs: [number, number] = useMemo(() => {
    if (!rowsCat.length) return bornesPays;
    let mn = rowsCat[0].annee, mx = rowsCat[0].annee;
    rowsCat.forEach((d: any) => { if (d.annee < mn) mn = d.annee; if (d.annee > mx) mx = d.annee; });
    return [mn, mx];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsCat]);
  const bornes = secteursVue ? bornesSecteurs : bornesPays;
  const anneesDe = (b: [number, number]) => Array.from({ length: Math.max(0, b[1] - b[0] + 1) }, (_, i) => b[0] + i);
  const anneeMin = Math.max(f.anneeMin, bornes[0]) || bornes[0];
  const anneeMax = Math.min(Math.max(f.anneeMax, anneeMin), bornes[1]) || bornes[1];
  const enPeriode = (a: number) => f.modeAnnees === "specifiques" && f.anneesSpec.length
    ? f.anneesSpec.includes(a) : a >= anneeMin && a <= anneeMax;

  // ── Sélections nommées ──
  const nomsPays = f.paysSelection.map(id => paysListe.find((p: any) => p.id === id)?.nom).filter(Boolean) as string[];
  const paysSelec = nomsPays[0] ?? "Sénégal";
  const grpInfos = f.grpSelection.map((code, i) => {
    const g = (groupements || []).find((x: any) => x.code === code);
    return { code, label: g?.nom_fr || code, abrege: code.replace(/_/g, " "), couleur: COMP_PALETTE[i] ?? COMP_PALETTE[COMP_PALETTE.length - 1] };
  });
  const nomSecteurDe = useMemo(() => {
    const m = new Map<number, string>([[0, "Global des secteurs"]]);
    (refSecteurs || []).forEach((sx: any) => { m.set(sx.id, sx.nom_fr); (sx.branches || []).forEach((b: any) => m.set(b.id, b.nom_fr)); });
    return m;
  }, [refSecteurs]);
  const topIds = new Set((refSecteurs || []).map((sx: any) => sx.id));
  const accentSecteur = f.secteurSelection[0] !== 0 && !topIds.has(f.secteurSelection[0]) ? T.orange : T.bleu;
  const couleurSelSecteur = (i: number) => comparative ? COMP_PALETTE[i % COMP_PALETTE.length] : accentSecteur;

  // ── Gestion directe des pays (pastilles ✕ et bouton +) ──
  const ajouterPays = (id: number) => {
    const sel = [...f.paysSelection.filter(x => x !== id), id].slice(0, 4);
    setFiltres({ ...f, vue: "pays", typeAnalyse: sel.length > 1 ? "comparative" : "pays", paysSelection: sel });
  };
  const retirerPays = (nom: string) => {
    const ids = f.paysSelection.filter(pid => paysListe.find((p: any) => p.id === pid)?.nom !== nom);
    if (!ids.length) return;
    setFiltres({ ...f, typeAnalyse: ids.length > 1 ? "comparative" : "pays", paysSelection: ids });
  };

  // ── Données Pays / Comparative ──
  const paramsPays = useMemo(() => {
    const p = new URLSearchParams({ pays_list: (comparative ? nomsPays : [paysSelec]).join(",") });
    if (f.modeAnnees === "specifiques" && f.anneesSpec.length) p.set("annees", f.anneesSpec.join(","));
    else { p.set("annee_min", String(anneeMin)); p.set("annee_max", String(anneeMax)); }
    return p.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomsPays.join(","), comparative, f.modeAnnees, f.anneesSpec, anneeMin, anneeMax]);
  const requetePays = useQuery({
    queryKey: ["ide-cnuced", paramsPays], enabled: !!paysDispo && !secteursVue && !monde,
    queryFn: () => getJson<any[]>(`/ide/cnuced?${paramsPays}`),
  });

  // ── Données Monde (groupements agrégés) ──
  const paramsMonde = useMemo(() => {
    const p = new URLSearchParams({ codes_list: f.grpSelection.join(",") });
    if (f.modeAnnees === "specifiques" && f.anneesSpec.length) p.set("annees", f.anneesSpec.join(","));
    else { p.set("annee_min", String(anneeMin)); p.set("annee_max", String(anneeMax)); }
    return p.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.grpSelection.join(","), f.modeAnnees, f.anneesSpec, anneeMin, anneeMax]);
  const requeteMonde = useQuery({
    queryKey: ["ide-monde", paramsMonde], enabled: monde && f.grpSelection.length > 0,
    queryFn: async () => {
      const brut = await getJson<any[]>(`/ide/monde?${paramsMonde}`);
      return (brut || []).map((d: any) => ({ pays: d.code, direction: d.direction, indicateur: d.indicateur, annee: d.annee, valeur: d.somme }));
    },
  });

  const donnees = monde ? requeteMonde.data : requetePays.data;
  const chargement = secteursVue ? (!refSecteurs || !donneesSecteurs)
    : monde ? (requeteMonde.isLoading && f.grpSelection.length > 0) || !groupements
    : requetePays.isLoading || !paysDispo;
  const enErreur = secteursVue ? false : monde ? requeteMonde.isError : requetePays.isError;
  const recharger = monde ? requeteMonde.refetch : requetePays.refetch;

  // ── Lignes sectorielles de la sélection (le Global agrège les ids 1-3) ──
  const rowsPourSecteur = (id: number) => {
    if (id !== 0) return rowsCat.filter((d: any) => d.secteur_id === id && enPeriode(d.annee));
    const agg = new Map<string, any>();
    rowsCat.forEach((d: any) => {
      if (![1, 2, 3].includes(d.secteur_id) || !enPeriode(d.annee)) return;
      const k = `${d.annee}|${d.direction}|${d.indicateur}`;
      const cur = agg.get(k);
      if (cur) cur.valeur += d.valeur;
      else agg.set(k, { secteur_id: 0, annee: d.annee, direction: d.direction, indicateur: d.indicateur, valeur: d.valeur });
    });
    return [...agg.values()];
  };

  // ── Graphes (une entrée par série de la catégorie) ──
  const graphes = useMemo(() => {
    if (secteursVue) {
      const series = SERIES_TYPES[`secteur_${st_ === "fusion" ? "fusion" : "greenfield"}`];
      return series.map(sx => ({
        ...sx,
        series: f.secteurSelection.map((id, i) => ({
          nom: nomSecteurDe.get(id) || "?", couleur: couleurSelSecteur(i),
          data: rowsPourSecteur(id)
            .filter((d: any) => d.direction === sx.dir && d.indicateur === sx.ind)
            .sort((a: any, b: any) => a.annee - b.annee)
            .map((d: any) => ({ annee: d.annee, valeur: d.valeur })),
        })) as Serie[],
      }));
    }
    const series = SERIES_TYPES[st_] || SERIES_TYPES.fluxstock;
    if (monde) {
      return series.map(sx => ({
        ...sx,
        series: grpInfos.map(g => ({
          nom: g.abrege, couleur: g.couleur,
          data: (donnees || [])
            .filter((d: any) => d.pays === g.code && d.direction === sx.dir && d.indicateur === sx.ind)
            .sort((a: any, b: any) => a.annee - b.annee)
            .map((d: any) => ({ annee: d.annee, valeur: d.valeur })),
        })) as Serie[],
      }));
    }
    const noms = comparative ? nomsPays : [paysSelec];
    return series.map(sx => ({
      ...sx,
      series: noms.map((nom, i) => ({
        nom, couleur: comparative ? COMP_PALETTE[i % COMP_PALETTE.length] : "#004f91",
        data: (donnees || [])
          .filter((d: any) => d.direction === sx.dir && d.indicateur === sx.ind && (!comparative || d.pays === nom))
          .sort((a: any, b: any) => a.annee - b.annee)
          .map((d: any) => ({ annee: d.annee, valeur: d.valeur })),
      })) as Serie[],
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secteursVue, monde, comparative, st_, donnees, rowsCat, f.secteurSelection, f.grpSelection.join(","), nomsPays.join(","), anneeMin, anneeMax, f.anneesSpec, f.modeAnnees]);

  const fmtDe = (unite: "musd" | "nombre") => (v: number | null) => unite === "nombre" ? fmtNombre(v) : fmtMusd(v);

  // Dernier point / précédent d'UNE série (vedette, rangées, légende)
  const bilanSerie = (sr?: Serie) => {
    const pts = (sr?.data || []).filter(d => d.valeur !== null);
    if (!pts.length) return null;
    const dernier = pts[pts.length - 1];
    const prec = pts.length > 1 ? pts[pts.length - 2] : null;
    let delta: number | null = null;
    if (prec && prec.valeur) {
      const pct = (dernier.valeur! - prec.valeur!) / Math.abs(prec.valeur!) * 100;
      if (isFinite(pct)) delta = pct;
    }
    return { dernier, prec, delta, valeurs: pts.map(p => p.valeur as number) };
  };
  const bilanDe = (g: { series: Serie[] }) => bilanSerie(g.series[0]);

  // ── Autres indicateurs — la liste à plat, groupée par thème ──
  const groupesIndics = useMemo<{ nom: string; lignes: LigneStat[] }[]>(() => {
    if (secteursVue || monde || comparative) return [];
    if (st_ === "fluxstock") {
      const tous = calculerKpis((donnees || []) as any);
      const kpis = KPI_IDS.map(id => tous.find(k => k.id === id)).filter(Boolean) as KpiResult[];
      const groupes: { nom: string; lignes: LigneStat[] }[] = [];
      for (const k of kpis) {
        let g = groupes.find(x => x.nom === k.categorie);
        if (!g) { g = { nom: k.categorie, lignes: [] }; groupes.push(g); }
        g.lignes.push({ cle: k.id, label: k.label, valeur: fmtKpi(k), note: indicatifDe(k), tendance: tendanceDe(k) });
      }
      return groupes;
    }
    // Greenfield / M&A : solde, moyenne 5 ans, record, total période
    const series = SERIES_TYPES[st_];
    const serie = (dir: string) => (donnees || [])
      .filter((d: any) => d.direction === dir && d.indicateur === series[0].ind && d.valeur !== null)
      .sort((a: any, b: any) => a.annee - b.annee);
    const sE = serie("entrant"), sS = serie("sortant");
    if (!sE.length) return [];
    const vE = sE[sE.length - 1], vS = sS.length ? sS[sS.length - 1] : null;
    const solde = vS && vE.annee === vS.annee ? vE.valeur - vS.valeur : null;
    const cinq = sE.slice(-5);
    const moy5 = cinq.reduce((acc: number, r: any) => acc + r.valeur, 0) / cinq.length;
    const rec = sE.reduce((best: any, r: any) => r.valeur > best.valeur ? r : best, sE[0]);
    const total = sE.reduce((acc: number, r: any) => acc + r.valeur, 0);
    return [{
      nom: "", lignes: [
        { cle: "solde", label: "Solde net · reçus − émis", valeur: solde !== null ? fmtMusd(Math.abs(solde)) : "—", note: solde !== null ? `en ${vE.annee}` : "années décalées", tendance: solde === null ? null : solde >= 0 ? "hausse" : "baisse" },
        { cle: "moy5",  label: "Moyenne 5 ans", valeur: fmtMusd(moy5), note: "valeur reçue" },
        { cle: "record", label: "Record historique", valeur: fmtMusd(rec.valeur), note: `en ${rec.annee}` },
        { cle: "total", label: "Total sur la période", valeur: fmtMusd(total), note: `${sE[0].annee} — ${vE.annee}` },
      ],
    }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees, st_, secteursVue, monde, comparative]);

  // Vue Secteurs (analyse simple) : les repères du site
  const groupesIndicsSecteur = useMemo<{ nom: string; lignes: LigneStat[] }[]>(() => {
    if (!secteursVue || f.typeAnalyse !== "secteur" || !f.secteurSelection.length) return [];
    const sid = f.secteurSelection[0];
    const rows = rowsPourSecteur(sid);
    const gf = st_ !== "fusion";
    const dirV = gf ? "total" : "entrant";
    const indV = gf ? "greenfield_valeur" : "ma_valeur";
    const indN = gf ? "greenfield_nombre" : "ma_nombre";
    const serie = (dir: string, ind: string) => rows
      .filter((d: any) => d.direction === dir && d.indicateur === ind)
      .sort((a: any, b: any) => a.annee - b.annee);
    const sV = serie(dirV, indV);
    if (!sV.length) return [];
    const vD = sV[sV.length - 1];
    const cinq = sV.slice(-5);
    const moy5 = cinq.reduce((acc: number, r: any) => acc + r.valeur, 0) / cinq.length;
    const part = (() => {
      if (sid === 0) return null;
      let total = 0, trouve = false;
      rowsCat.forEach((d: any) => {
        if ([1, 2, 3].includes(d.secteur_id) && d.annee === vD.annee && d.direction === dirV && d.indicateur === indV) { total += d.valeur; trouve = true; }
      });
      return trouve && total !== 0 ? (vD.valeur / total) * 100 : null;
    })();
    const dominant = (() => {
      if (sid !== 0) return null;
      const NOMS: Record<number, string> = { 1: "Primaire", 2: "Manufacturier", 3: "Services" };
      let best: { id: number; v: number } | null = null, total = 0;
      rowsCat.forEach((d: any) => {
        if (![1, 2, 3].includes(d.secteur_id) || d.annee !== vD.annee || d.direction !== dirV || d.indicateur !== indV) return;
        total += d.valeur;
        if (!best || d.valeur > best.v) best = { id: d.secteur_id, v: d.valeur };
      });
      if (!best) return null;
      const b = best as { id: number; v: number };
      return { nom: NOMS[b.id], part: total !== 0 ? (b.v / total) * 100 : null, annee: vD.annee };
    })();
    const lignes: LigneStat[] = [
      { cle: "moy5", label: "Moyenne 5 ans", valeur: fmtMusd(moy5), note: gf ? "valeur annoncée" : "ventes nettes" },
      sid === 0
        ? { cle: "dominant", label: "Secteur dominant", valeur: dominant ? dominant.nom : "—", note: dominant && dominant.part !== null ? `${dominant.part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % en ${dominant.annee}` : null }
        : { cle: "part", label: "Part du total", valeur: part !== null ? `${part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—", note: `en ${vD.annee}` },
    ];
    return [{ nom: "", lignes }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secteursVue, f.typeAnalyse, f.secteurSelection, rowsCat, st_, anneeMin, anneeMax, f.anneesSpec, f.modeAnnees]);

  const indicateurs = secteursVue ? groupesIndicsSecteur : groupesIndics;

  // ── En-tête et badge ──
  const perLabel = f.modeAnnees === "specifiques" && f.anneesSpec.length
    ? (f.anneesSpec.length === 1 ? `${f.anneesSpec[0]}` : `${f.anneesSpec[0]} — ${f.anneesSpec[f.anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;
  const pastilles: { cle: string; nom: string; couleur: any }[] = secteursVue
    ? f.secteurSelection.map((id, i) => ({ cle: String(id), nom: nomSecteurDe.get(id) || "?", couleur: couleurSelSecteur(i) }))
    : monde
    ? grpInfos.map(g => ({ cle: g.code, nom: g.label, couleur: g.couleur }))
    : (comparative ? nomsPays : [paysSelec]).map((nom, i) => ({ cle: nom, nom, couleur: comparative ? COMP_PALETTE[i % COMP_PALETTE.length] : T.bleu }));
  const paysGerable = !secteursVue && !monde; // pastilles ✕ et bouton + actifs
  // Logique du site : la comparaison de pays n'est plus un « filtre » (elle se
  // fait au « + », dans le contexte) — le badge ne compte que la vue, le
  // secteur et la période
  const nbFiltres =
    (secteursVue || monde ? 1 : 0) +
    (secteursVue && f.typeAnalyse !== "secteur" ? 1 : 0) +
    (secteursVue && f.typeAnalyse === "secteur" && f.secteurSelection[0] !== 0 ? 1 : 0) +
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > bornes[0] || f.anneeMax < bornes[1]) ? 1 : 0));

  const centrerChip = (cle: string) => {
    const p = chipsPos.current[cle];
    if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
  };

  const cap = width >= 700 ? { width: "100%" as const, maxWidth: 680, alignSelf: "center" as const } : null;

  // ── La vedette et les autres séries ──
  const idx = Math.min(serieActive, graphes.length - 1);
  const gActive = graphes[idx];
  const multi = (gActive?.series.length ?? 0) > 1;
  const bilan = gActive ? bilanDe(gActive) : null;
  const hausse = (bilan?.delta ?? 0) >= 0;
  const autres = graphes.map((g, i) => ({ g, i })).filter(x => x.i !== idx);

  return (
    <>
      <Animated.ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: margeBas }}>
        <EnTetePage retour={false} titre="Investissements privés"
          bouton={{ icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: (onglet === "ide" ? nbFiltres : nbFiltresNat) || undefined }} />

        {/* Les deux familles en chips colorées */}
        <ScrollView ref={ongletsRef} horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }} contentContainerStyle={[s.ongletsRangee, cap]}>
          {ONGLETS.map(o => {
            const actif = onglet === o.cle;
            return (
              <Pressable key={o.cle}
                onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; ongletsPos.current[o.cle] = { x, largeur: la }; }}
                onPress={() => {
                  tick();
                  setOnglet(o.cle);
                  const p = ongletsPos.current[o.cle];
                  if (p) ongletsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
                }}
                style={[s.chipLentille, actif && { backgroundColor: `${o.couleur}14`, borderColor: `${o.couleur}66` }]}>
                <Text style={[s.chipLentilleTexte, { color: o.couleur }, actif && { fontFamily: POLICE.gras }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {onglet === "nationaux" ? (
          <NationalPanel
            filtresOuverts={filtresOuverts && onglet === "nationaux"}
            onFermerFiltres={() => setFiltresOuverts(false)}
            onOuvrirFiltres={() => setFiltresOuverts(true)}
            onNbFiltres={setNbFiltresNat} />
        ) : (
          <>
            {/* Catégories (la vue Secteurs n'a pas de Flux & Stocks) */}
            <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={[s.chipsRangee, cap]}>
              {sousTypesVisibles.map(o => {
                const actif = st_ === o.cle;
                return (
                  <Pressable key={o.cle}
                    onLayout={ev => { const { x, width: la } = ev.nativeEvent.layout; chipsPos.current[o.cle] = { x, largeur: la }; }}
                    onPress={() => { tick(); setSousType(o.cle); centrerChip(o.cle); }}
                    style={[s.chipFiltre, actif && s.chipFiltreActif]}>
                    <Text style={[s.chipFiltreTexte, actif && s.chipFiltreTexteActif]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {chargement ? (
              <SqueletteDonnees />
            ) : enErreur ? (
              <EtatErreur onRetry={() => recharger()} />
            ) : monde && !f.grpSelection.length ? (
              <EtatVide texte="Sélectionnez un groupement" sousTexte="Choisissez jusqu'à 4 groupements dans le filtre." />
            ) : !gActive ? null : (
              <View style={cap}>
                {/* La sélection se manipule ICI : période → filtres, pastille → retirer, + → ajouter */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.pastilles}>
                  <Pressable onPress={() => setFiltresOuverts(true)} style={s.periodePastille}>
                    <Text style={s.periodePastilleTexte}>{perLabel}</Text>
                  </Pressable>
                  {pastilles.map(pa => {
                    const retirable = paysGerable && pastilles.length > 1;
                    return (
                      <Pressable key={pa.cle}
                        onPress={retirable ? () => { tick(); retirerPays(pa.nom); } : () => setFiltresOuverts(true)}
                        style={[s.paysPastille, { borderColor: `${pa.couleur}33` }]}>
                        <View style={[s.paysPoint, { backgroundColor: pa.couleur }]} />
                        <Text style={[s.paysPastilleTexte, { color: pa.couleur }]} numberOfLines={1}>{pa.nom}</Text>
                        {retirable && (
                          <Icone sf="xmark" materiel="close" taille={11} couleur={pa.couleur} />
                        )}
                      </Pressable>
                    );
                  })}
                  {paysGerable && pastilles.length < 4 && (
                    <Pressable onPress={() => { tick(); setPaysOuvert(true); }} style={s.plusPastille}
                      accessibilityLabel="Ajouter un pays à comparer">
                      <Icone sf="plus" materiel="add" taille={14} couleur={T.bleu} poids="semibold" />
                    </Pressable>
                  )}
                </ScrollView>

                {/* ── La vedette : UNE série en grand, la grammaire de l'accueil ── */}
                <View style={s.rangee}>
                  <View style={s.vedette}>
                    <Text style={s.etiquette} numberOfLines={1}>
                      {gActive.label.toUpperCase()}{!multi && bilan ? ` · ${bilan.dernier.annee}` : ""}
                    </Text>
                    {!multi && bilan && (
                      <View style={s.nombreLigne}>
                        <ChiffreAnime texte={fmtDe(gActive.unite)(bilan.dernier.valeur)} style={s.nombre} />
                        {bilan.delta !== null && (
                          <View style={s.deltaLigne}>
                            <Icone sf={hausse ? "arrow.up.right" : "arrow.down.right"}
                              materiel={hausse ? "north_east" : "south_east"}
                              taille={12} couleur={hausse ? T.vert : "#dc2626"} poids="bold" />
                            <Text style={[s.deltaTexte, { color: hausse ? T.vert : "#dc2626" }]}>
                              {Math.abs(bilan.delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                            </Text>
                            <Text style={s.deltaContexte}>vs {bilan.prec!.annee}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    <View style={{ marginTop: multi ? 4 : 10 }}>
                      <GrapheLignes series={gActive.series} hauteur={multi ? 190 : 172} fmt={fmtDe(gActive.unite)} epure />
                    </View>
                    {/* En comparaison, la lecture vit sous la courbe : une
                        ligne par série — dernière valeur, année, variation */}
                    {multi && (
                      <View style={s.legende}>
                        {gActive.series.map(sr => {
                          const b = bilanSerie(sr);
                          const bHausse = (b?.delta ?? 0) >= 0;
                          return (
                            <View key={sr.nom} style={s.legendeLigne}>
                              <View style={[s.paysPoint, { backgroundColor: sr.couleur }]} />
                              <Text style={s.legendeNom} numberOfLines={1}>{sr.nom}</Text>
                              {b?.dernier && <Text style={s.legendeAnnee}>{b.dernier.annee}</Text>}
                              <Text style={s.legendeValeur}>{b ? fmtDe(gActive.unite)(b.dernier.valeur) : "—"}</Text>
                              {b?.delta != null ? (
                                <View style={s.legendeDelta}>
                                  <Icone sf={bHausse ? "arrow.up.right" : "arrow.down.right"}
                                    materiel={bHausse ? "north_east" : "south_east"}
                                    taille={10} couleur={bHausse ? T.vert : "#dc2626"} poids="bold" />
                                  <Text style={[s.legendeDeltaTexte, { color: bHausse ? T.vert : "#dc2626" }]}>
                                    {Math.abs(b.delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                                  </Text>
                                </View>
                              ) : <View style={s.legendeDelta} />}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>

                {/* ── Les autres séries — une rangée chacune, tap pour l'installer en vedette ── */}
                {autres.length > 0 && (
                  <View style={s.rangee}>
                    <View style={s.carteListe}>
                      {autres.map(({ g, i }, pos) => {
                        const b = bilanDe(g);
                        const bHausse = (b?.delta ?? 0) >= 0;
                        return (
                          <Tapable key={`${g.dir}-${g.ind}`} echelle={0.99}
                            onPress={() => { tick(); setSerieActive(i); }}
                            style={[s.serieLigne, pos > 0 && s.serieLigneBord]}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={s.serieLabel} numberOfLines={1}>{g.label}</Text>
                              {multi ? (
                                // En comparaison : la dernière valeur de CHAQUE
                                // série, dans sa couleur — l'ordre des pastilles
                                <View style={s.serieSous}>
                                  {g.series.map(sr => {
                                    const bs = bilanSerie(sr);
                                    return (
                                      <Text key={sr.nom} style={[s.serieValeur, { color: sr.couleur }]}>
                                        {bs ? fmtDe(g.unite)(bs.dernier.valeur) : "—"}
                                      </Text>
                                    );
                                  })}
                                </View>
                              ) : (
                                <View style={s.serieSous}>
                                  <Text style={s.serieValeur}>{b ? fmtDe(g.unite)(b.dernier.valeur) : "—"}</Text>
                                  {b?.delta != null && (
                                    <Text style={[s.serieDelta, { color: bHausse ? T.vert : "#dc2626" }]}>
                                      {bHausse ? "+" : "−"}{Math.abs(b.delta).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                                    </Text>
                                  )}
                                </View>
                              )}
                            </View>
                            {!multi && b && b.valeurs.length > 1 && (
                              <MiniTendance valeurs={b.valeurs} largeur={72} hauteur={30}
                                couleur={g.series[0]?.couleur || (T.bleu as string)} />
                            )}
                          </Tapable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* ── Autres indicateurs — la liste à plat, variations fléchées ── */}
                {indicateurs.length > 0 && (
                  <View style={s.rangee}>
                    <Text style={s.sectionTitre}>AUTRES INDICATEURS</Text>
                    <View style={[s.carteListe, { paddingVertical: 3 }]}>
                      {indicateurs.map((g, gi) => (
                        <View key={g.nom || "seul"}>
                          {g.nom ? <Text style={[s.groupeTitre, gi > 0 && { marginTop: 10 }]}>{g.nom.toUpperCase()}</Text> : null}
                          {g.lignes.map((l, i) => (
                            <LigneIndic key={l.cle} ligne={l} premier={i === 0 && !g.nom} />
                          ))}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>

      {paysOuvert && (
        <PaysSheet pays={paysListe} exclus={f.paysSelection}
          onChoisir={ajouterPays} onClose={() => setPaysOuvert(false)} />
      )}

      {filtresOuverts && onglet === "ide" && (
        <IdeFiltres
          pays={paysListe} senId={senId}
          groupements={groupements || []} refSecteurs={refSecteurs || []}
          anneesPays={anneesDe(bornesPays)} anneesSecteurs={anneesDe(bornesSecteurs)}
          valeurs={{ ...f, anneeMin, anneeMax }}
          onAppliquer={setFiltres} onClose={() => setFiltresOuverts(false)} />
      )}
    </>
  );
}

const s = StyleSheet.create({
  ongletsRangee: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  chipLentille: {
    paddingHorizontal: 14, paddingVertical: 7.5, borderRadius: 999,
    backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure,
  },
  chipLentilleTexte: { fontSize: 12.5, fontFamily: POLICE.demi },
  chipsRangee: { flexGrow: 1, justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },
  chipFiltre: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: T.carte, borderWidth: 1, borderColor: T.bordure },
  chipFiltreActif: { backgroundColor: T.blocFond, borderColor: T.blocBord },
  chipFiltreTexte: { fontSize: 12.5, fontFamily: POLICE.demi, color: T.texte },
  chipFiltreTexteActif: { color: T.bleu, fontFamily: POLICE.gras },

  pastilles: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14, paddingHorizontal: 16 },
  // Les styles badge_* de la plateforme : pastille blanche translucide à
  // bordure teintée, texte de la couleur (gris pour la période)
  periodePastille: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(108,117,125,0.28)",
  },
  periodePastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, color: "#6b7280", fontVariant: ["tabular-nums"] },
  paysPastille: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 12, paddingVertical: 5, maxWidth: 220,
  },
  paysPoint: { width: 7, height: 7, borderRadius: 4 },
  paysPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, flexShrink: 1 },
  plusPastille: {
    width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: T.bleuVoile, borderWidth: 1, borderColor: "rgba(0,79,145,0.22)",
  },

  rangee: { paddingHorizontal: 16, marginTop: 14 },

  // La vedette — la grammaire de la carte de l'accueil, prolongée du graphe signature
  vedette: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, overflow: "hidden",
  },
  etiquette: { ...TYPO.micro, color: T.gris },
  nombreLigne: { flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  nombre: { fontSize: 38, lineHeight: 44, fontFamily: POLICE.gras, color: T.bleu, letterSpacing: -1, marginTop: 8, fontVariant: ["tabular-nums"] },
  deltaLigne: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaTexte: { fontSize: 13, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },
  deltaContexte: { fontSize: 13, fontFamily: POLICE.normal, color: T.gris, marginLeft: 2 },

  // Légende de lecture sous la courbe (comparaisons)
  legende: {
    marginTop: 8, paddingTop: 4, paddingBottom: 6, gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure,
  },
  legendeLigne: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 4 },
  legendeNom: { flex: 1, minWidth: 0, fontSize: 12.5, fontFamily: POLICE.demi, color: T.encre },
  legendeAnnee: { fontSize: 10.5, fontFamily: POLICE.normal, color: T.grisClair, fontVariant: ["tabular-nums"] },
  legendeValeur: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.encre, fontVariant: ["tabular-nums"] },
  legendeDelta: { flexDirection: "row", alignItems: "center", gap: 2, minWidth: 62, justifyContent: "flex-end" },
  legendeDeltaTexte: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },

  // Cartes-listes (séries commutables, indicateurs)
  carteListe: {
    backgroundColor: T.carte, borderRadius: 18, borderWidth: 1, borderColor: T.carteBord,
    paddingHorizontal: 16,
  },
  serieLigne: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 11 },
  serieLigneBord: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.bordure },
  serieLabel: { fontSize: 13, fontFamily: POLICE.demi, color: T.encre },
  serieSous: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 2 },
  serieValeur: { fontSize: 12.5, fontFamily: POLICE.gras, color: T.texte, fontVariant: ["tabular-nums"] },
  serieDelta: { fontSize: 11, fontFamily: POLICE.gras, fontVariant: ["tabular-nums"] },

  sectionTitre: { ...TYPO.micro, color: T.bleu, marginBottom: 10 },
  groupeTitre: { fontSize: 9, fontFamily: POLICE.gras, letterSpacing: 1.1, color: T.gris, marginTop: 12, marginBottom: 2 },
});
