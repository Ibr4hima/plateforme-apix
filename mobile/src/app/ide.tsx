// Investissements privés — onglet Investissements Directs Étrangers,
// version app de la page web. VUE Pays (analyse par pays, comparative
// jusqu'à 4 pays, Monde par groupements CNUCED) et VUE Secteurs
// (par secteur ou comparative, secteurs / branches CNUCED, catégories
// Greenfield / M&A uniquement). Catégories Flux & Stocks / Greenfield /
// Fusion & Acquisition, période aux bornes du contexte, TOUS les KPIs
// du site en carrousel, courbes annuelles premium.
// L'onglet Investissements nationaux arrive à l'étape suivante.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EtatCharge, EtatErreur, EtatVide } from "@/components/ui";
import CarrouselKpis, { KpiCarrousel } from "@/components/CarrouselKpis";
import GrapheLignes, { Serie } from "@/components/GrapheLignes";
import HeroModule from "@/components/HeroModule";
import IdeFiltres, { FiltresIde } from "@/components/IdeFiltres";
import NationalPanel from "@/components/NationalPanel";
import Symbole from "@/components/Symbole";
import { getJson } from "@/lib/api";
import { COMP_PALETTE } from "@/lib/couleurs";
import { KpiResult, calculerKpis, fmtKpi } from "@/lib/ideKpis";
import { POLICE, T } from "@/theme";

const ONGLETS = [
  { cle: "ide",       label: "Inv. Directs Étrangers" },
  { cle: "nationaux", label: "Inv. Nationaux" },
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

// Les KPIs affichés du site (ordre de la barre latérale, hors streak)
const KPI_IDS = [
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
  if (k.id.includes("n_pos")) return "sur la période";
  if (k.id.includes("dist_max")) return "vs pic historique";
  if (k.id.includes("regularite")) return "% années positives";
  return null;
}

export default function Ide() {
  const [onglet, setOnglet] = useState("ide");
  const [sousType, setSousType] = useState<string>("fluxstock");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [nbFiltresNat, setNbFiltresNat] = useState(0);
  const chipsRef = useRef<ScrollView>(null);
  const chipsPos = useRef<Record<string, { x: number; largeur: number }>>({});

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
  const st = secteursVue && sousType === "fluxstock" ? "greenfield" : sousType;
  const sousTypesVisibles = secteursVue ? SOUS_TYPES.filter(x => x.cle !== "fluxstock") : SOUS_TYPES;

  // ── Bornes de période du contexte ──
  const catPays = bornesRef?.categories?.[st];
  const bornesPays: [number, number] = [catPays?.annee_min ?? bornesRef?.annee_min ?? 1990, catPays?.annee_max ?? bornesRef?.annee_max ?? 2025];
  // Secteurs : bornes réelles du jeu de données de la catégorie
  const prefixe = st === "fusion" ? "ma_" : "greenfield";
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

  // ── KPIs ──
  const kpisFluxStock: KpiCarrousel[] = useMemo(() => {
    if (secteursVue || monde || st !== "fluxstock") return [];
    const tous = calculerKpis((donnees || []).filter((d: any) => !comparative || d.pays === paysSelec));
    return KPI_IDS
      .map(id => tous.find(k => k.id === id)).filter(Boolean)
      .map(k => ({
        cle: k!.id, label: k!.label, valeur: fmtKpi(k!), note: indicatifDe(k!),
        negatif: k!.valeur !== null && k!.valeur < 0 && (k!.format === "pourcentage" || k!.format === "monnaie_signe"),
      }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees, st, secteursVue, monde, comparative, paysSelec]);

  const kpisCategoriePays: KpiCarrousel[] = useMemo(() => {
    const series = SERIES_TYPES[st];
    if (secteursVue || monde || st === "fluxstock" || !series) return [];
    const serie = (dir: string, ind: string) => (donnees || [])
      .filter((d: any) => d.direction === dir && d.indicateur === ind && d.valeur !== null && (!comparative || d.pays === paysSelec))
      .sort((a: any, b: any) => a.annee - b.annee);
    const dernier = (rs: any[]) => rs.length ? rs[rs.length - 1] : null;
    const vE = dernier(serie("entrant", series[0].ind));
    const vS = dernier(serie("sortant", series[1].ind));
    const nE = dernier(serie("entrant", series[2].ind));
    const solde = vE && vS && vE.annee === vS.annee ? vE.valeur - vS.valeur : null;
    const gf = st === "greenfield";
    return [
      { cle: "recus", label: gf ? "Inv. greenfield reçus" : "Rachats d'entreprises locales", valeur: vE ? fmtMusd(vE.valeur) : "N/A", note: vE ? `en ${vE.annee}` : null },
      { cle: "emis", label: gf ? "Inv. greenfield émis" : "Acquisitions à l'étranger", valeur: vS ? fmtMusd(vS.valeur) : "N/A", note: vS ? `en ${vS.annee}` : null },
      { cle: "nombre", label: gf ? "Nombre de projets reçus" : "Nombre de rachats locaux", valeur: nE ? fmtNombre(nE.valeur) : "N/A", note: nE ? `en ${nE.annee}` : null },
      { cle: "solde", label: gf ? "Solde net · reçus − émis" : "Solde net · rachats − acquisitions", valeur: solde !== null ? `${solde > 0 ? "+" : ""}${fmtMusd(solde)}` : "N/A", note: vE && solde !== null ? `en ${vE.annee}` : null, negatif: solde !== null && solde < 0 },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees, st, secteursVue, monde, comparative, paysSelec]);

  // KPIs de l'analyse par secteur (règles du site, sans l'année record)
  const kpisSecteur: KpiCarrousel[] = useMemo(() => {
    if (!secteursVue || f.typeAnalyse !== "secteur" || !f.secteurSelection.length) return [];
    const sid = f.secteurSelection[0];
    const rows = rowsPourSecteur(sid);
    const serie = (dir: string, ind: string) => rows
      .filter((d: any) => d.direction === dir && d.indicateur === ind)
      .sort((a: any, b: any) => a.annee - b.annee);
    const dernier = (rs: any[]) => rs.length ? rs[rs.length - 1] : null;
    const gf = st === "greenfield";
    const dirV = gf ? "total" : "entrant";
    const indV = gf ? "greenfield_valeur" : "ma_valeur";
    const indN = gf ? "greenfield_nombre" : "ma_nombre";
    const sV = serie(dirV, indV);
    const vD = dernier(sV);
    const nD = dernier(serie(dirV, indN));
    const vSf = !gf ? dernier(serie("sortant", "ma_valeur")) : null;
    const moy5 = sV.length ? sV.slice(-5).reduce((acc: number, r: any) => acc + r.valeur, 0) / Math.min(5, sV.length) : null;
    // Part du total des 3 grands secteurs la même année (ou secteur dominant en global)
    const part = (() => {
      if (!vD || sid === 0) return null;
      let total = 0, trouve = false;
      rowsCat.forEach((d: any) => {
        if ([1, 2, 3].includes(d.secteur_id) && d.annee === vD.annee && d.direction === dirV && d.indicateur === indV) { total += d.valeur; trouve = true; }
      });
      return trouve && total !== 0 ? (vD.valeur / total) * 100 : null;
    })();
    const dominant = (() => {
      if (sid !== 0 || !vD) return null;
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
    return [
      { cle: "valeur", label: gf ? "Valeur des projets annoncés" : "Ventes nettes", valeur: vD ? fmtMusd(vD.valeur) : "N/A", note: vD ? `en ${vD.annee}` : null },
      gf
        ? { cle: "nombre", label: "Nombre de projets annoncés", valeur: nD ? fmtNombre(nD.valeur) : "N/A", note: nD ? `en ${nD.annee}` : null }
        : { cle: "achats", label: "Achats nets", valeur: vSf ? fmtMusd(vSf.valeur) : "N/A", note: vSf ? `en ${vSf.annee}` : null },
      gf
        ? { cle: "moy5", label: "Moyenne 5 ans · valeur", valeur: moy5 !== null ? fmtMusd(moy5) : "N/A", note: "5 dernières années" }
        : { cle: "nombre", label: "Nombre de ventes", valeur: nD ? fmtNombre(nD.valeur) : "N/A", note: nD ? `en ${nD.annee}` : null },
      sid === 0
        ? { cle: "dominant", label: "Secteur dominant", valeur: dominant ? dominant.nom : "N/A", note: dominant && dominant.part !== null ? `${dominant.part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % en ${dominant.annee}` : null }
        : { cle: "part", label: gf ? "Part du total · valeur" : "Part du total · ventes", valeur: part !== null ? `${part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "N/A", note: vD ? `en ${vD.annee}` : null },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secteursVue, f.typeAnalyse, f.secteurSelection, rowsCat, st, anneeMin, anneeMax, f.anneesSpec, f.modeAnnees]);

  const kpis = secteursVue ? kpisSecteur : st === "fluxstock" ? kpisFluxStock : kpisCategoriePays;
  const kpisVisibles = !monde && !comparative && kpis.length > 0;

  // ── Graphes ──
  const graphes = useMemo(() => {
    if (secteursVue) {
      const series = SERIES_TYPES[`secteur_${st === "fusion" ? "fusion" : "greenfield"}`];
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
    const series = SERIES_TYPES[st] || SERIES_TYPES.fluxstock;
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
  }, [secteursVue, monde, comparative, st, donnees, rowsCat, f.secteurSelection, f.grpSelection.join(","), nomsPays.join(","), anneeMin, anneeMax, f.anneesSpec, f.modeAnnees]);

  const fmtDe = (unite: "musd" | "nombre") => (v: number | null) => unite === "nombre" ? fmtNombre(v) : fmtMusd(v);
  const enTeteDe = (g: { unite: "musd" | "nombre"; series: Serie[] }) => {
    if (g.series.length !== 1) return null;
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

  // ── En-tête et badge ──
  const perLabel = f.modeAnnees === "specifiques" && f.anneesSpec.length
    ? (f.anneesSpec.length === 1 ? `${f.anneesSpec[0]}` : `${f.anneesSpec[0]} — ${f.anneesSpec[f.anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;
  const pastilles: { cle: string; nom: string; couleur: any }[] = secteursVue
    ? f.secteurSelection.map((id, i) => ({ cle: String(id), nom: nomSecteurDe.get(id) || "?", couleur: couleurSelSecteur(i) }))
    : monde
    ? grpInfos.map(g => ({ cle: g.code, nom: g.label, couleur: g.couleur }))
    : (comparative ? nomsPays : [paysSelec]).map((nom, i) => ({ cle: nom, nom, couleur: comparative ? COMP_PALETTE[i % COMP_PALETTE.length] : T.bleu }));
  const nbFiltres =
    (f.vue !== "pays" ? 1 : 0) +
    (!secteursVue && f.typeAnalyse !== "pays" ? 1 : 0) +
    (secteursVue && f.typeAnalyse !== "secteur" ? 1 : 0) +
    (!secteursVue && !monde && senId !== null && (f.paysSelection.length > 1 || f.paysSelection[0] !== senId) ? 1 : 0) +
    (secteursVue && f.typeAnalyse === "secteur" && f.secteurSelection[0] !== 0 ? 1 : 0) +
    (f.modeAnnees === "specifiques" ? (f.anneesSpec.length ? 1 : 0) : (filtres && (f.anneeMin > bornes[0] || f.anneeMax < bornes[1]) ? 1 : 0));

  const centrerChip = (cle: string) => {
    const p = chipsPos.current[cle];
    if (p) chipsRef.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - Dimensions.get("window").width / 2), animated: true });
  };

  return (
    <>
      <ScrollView style={{ backgroundColor: T.fond }} contentContainerStyle={{ paddingBottom: 44 }}>
        <HeroModule titre="Investissements privés"
          segments={{ options: ONGLETS, valeur: onglet, onChange: setOnglet }}
          bouton={{ icone: "filter_list", onPress: () => setFiltresOuverts(true), badge: (onglet === "ide" ? nbFiltres : nbFiltresNat) || undefined }} />

        {onglet === "nationaux" ? (
          <NationalPanel
            filtresOuverts={filtresOuverts && onglet === "nationaux"}
            onFermerFiltres={() => setFiltresOuverts(false)}
            onNbFiltres={setNbFiltresNat} />
        ) : (
          <>
            {/* Catégories (la vue Secteurs n'a pas de Flux & Stocks) */}
            <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chipsRangee}>
              {sousTypesVisibles.map(o => {
                const actif = st === o.cle;
                return (
                  <Pressable key={o.cle}
                    onLayout={ev => { const { x, width } = ev.nativeEvent.layout; chipsPos.current[o.cle] = { x, largeur: width }; }}
                    onPress={() => { setSousType(o.cle); centrerChip(o.cle); }}
                    style={[s.chipFiltre, actif && s.chipFiltreActif]}>
                    <Text style={[s.chipFiltreTexte, actif && s.chipFiltreTexteActif]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {chargement ? (
              <EtatCharge />
            ) : enErreur ? (
              <EtatErreur onRetry={() => recharger()} />
            ) : monde && !f.grpSelection.length ? (
              <EtatVide texte="Sélectionnez un groupement" sousTexte="Choisissez jusqu'à 4 groupements dans le filtre." />
            ) : (
              <>
                {/* Période puis sélection — une seule ligne à défilement */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.pastilles}>
                  <View style={s.periodePastille}><Text style={s.periodePastilleTexte}>{perLabel}</Text></View>
                  {pastilles.map(pa => (
                    <View key={pa.cle} style={[s.paysPastille, { borderColor: `${pa.couleur}2E`, backgroundColor: `${pa.couleur}0D` }]}>
                      <View style={[s.paysPoint, { backgroundColor: pa.couleur }]} />
                      <Text style={[s.paysPastilleTexte, { color: pa.couleur }]} numberOfLines={1}>{pa.nom}</Text>
                    </View>
                  ))}
                </ScrollView>

                {/* KPIs (analyses mono-sélection) */}
                {kpisVisibles && (
                  <View style={{ marginTop: 14 }}>
                    <CarrouselKpis kpis={kpis} />
                  </View>
                )}

                {/* Courbes */}
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
    paddingHorizontal: 12, paddingVertical: 5, maxWidth: 220,
  },
  paysPoint: { width: 7, height: 7, borderRadius: 4 },
  paysPastilleTexte: { fontSize: 12, fontFamily: POLICE.gras, flexShrink: 1 },
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
