"use client";
import { Fragment, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { COMP_PALETTE } from "@/lib/couleurs";
import { X, ChevronDown, ChevronRight, SlidersHorizontal, Search } from "lucide-react";
import { SkeletonChartGrid, SkeletonRows } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { useDebounced } from "@/lib/useDebounced";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardIde";
import { HBarChart } from "@/components/charts/HBarChart";
import { DivergingBars } from "@/components/charts/DivergingBars";
import { CurseurAnneeNace, CurseurPlageNace } from "@/components/shared/CurseurNace";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { API, fmtVal, BadgePeriode, BadgeSerie, SERIES_TYPES, fmtNombre, SelecteurVueAnalyse, BtnAjoutGroupement, SousTypeNav, useBornesCnuced, GrapheMultiPays, ModalDonnees, BoutonDonnees } from "./partage";
import { useDonnees } from "@/lib/donnees";
import Variation from "@/components/shared/Variation";


// ── Onglet Monde ──────────────────────────────────────────────────────────────

// ── Vue mondiale (agrégat de tous les pays) ───────────────────────────────────
// Affichée par défaut dans la vue Monde : totaux mondiaux (séries + KPIs) et
// top 10 des pays récepteurs / émetteurs avec curseur Cumul ⇆ année.


type TopPays = { pays: string; code_iso2?: string | null; valeur: number; rang?: number };

// Tableau Top 10 des pays : rang · drapeau · pays · valeur · part · barre,
// avec curseur Cumul (à droite) ⇆ années (vers la gauche, décroissantes)
function TableauTopPays({ titre, rows, annees, annee, onAnnee, chargement }: {
  titre: string; rows: TopPays[]; annees: number[]; annee: number | null;
  onAnnee: (a: number | null) => void; chargement: boolean;
}) {
  const n = annees.length;
  // Part et barres calculées sur le top 10 seul (le Sénégal ajouté à la
  // suite ne fausse pas les proportions)
  const enTop = rows.filter((r, i) => (r.rang ?? i + 1) <= 10);
  const total = enTop.reduce((t, r) => t + Math.max(0, r.valeur), 0);
  const max = Math.max(1e-9, ...enTop.map(r => r.valeur));
  const estSen = (r: TopPays) => r.pays === "Sénégal" || r.pays === "Senegal";
  return (
    <div style={{ background: "var(--carte)", borderRadius: 14, border: "1px solid rgb(var(--encre-rgb) / 0.12)", padding: "16px 18px", minWidth: 0, display: "flex", flexDirection: "column" as const, gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
        <h3 style={{ fontWeight: 700, fontSize: 13.5, color: "var(--encre)", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{titre}</h3>
        {n >= 2 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <CurseurAnneeNace min={0} max={n} value={annee == null ? n : Math.max(0, annees.indexOf(annee))}
              borne={annees[0]} pastille={annee ?? "Cumul"} ariaLabel="Cumul ou année"
              onChange={i => onAnnee(i >= n ? null : annees[i])} />
          </span>
        )}
      </div>
      {chargement ? (
        <SkeletonRows n={Math.max(4, rows.length || 8)} h={26} />
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center" as const, padding: "18px 0" }}>{annee !== null ? `Aucune donnée pour ${annee}.` : "Aucune donnée"}</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
            <span style={{ width: 22, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const, flexShrink: 0 }}>#</span>
            <span style={{ flex: 1, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const }}>Pays</span>
            <span style={{ width: 74, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>Valeur</span>
            <span style={{ width: 44, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>Part</span>
            <span style={{ width: "26%", flexShrink: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
            {rows.map((r, i) => {
              const rang = r.rang ?? i + 1;
              const zebre = i % 2 === 1;
              const podium = rang <= 3;
              const sen = estSen(r);
              const horsTop = rang > 10;
              const fondSen = "linear-gradient(90deg, rgb(var(--bleu-rgb) / 0.10), rgb(var(--bleu-rgb) / 0.02))";
              return (
                <Fragment key={r.pays}>
                  {/* Filet « … » avant le Sénégal ajouté hors top 10 */}
                  {horsTop && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "1px 8px" }}>
                      <span style={{ width: 22, textAlign: "center" as const, color: "var(--gris)", fontSize: 12, fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>⋮</span>
                      <span style={{ flex: 1, height: 1, background: "var(--fond)" }} />
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8,
                    background: sen ? fondSen : zebre ? "var(--carte-douce)" : "transparent",
                    border: sen ? "1px solid rgb(var(--bleu-rgb) / 0.30)" : "1px solid transparent",
                    boxShadow: sen ? "0 1px 6px rgb(var(--ombre-rgb) / 0.10)" : "none", transition: "background 0.12s" }}
                    onMouseEnter={e => { if (!sen) e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)"; }}
                    onMouseLeave={e => { if (!sen) e.currentTarget.style.background = zebre ? "var(--carte-douce)" : "transparent"; }}>
                    <span style={{ width: 22, flexShrink: 0 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 3px", borderRadius: 10,
                        background: sen ? "var(--bleu-action)" : podium ? "var(--bleu-action)" : "var(--fond-creux)", color: sen || podium ? "var(--sur-bleu)" : "var(--gris)", fontSize: 10, fontWeight: 800 }}>{rang}</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <DrapeauPays taille={15} iso={r.code_iso2} nom={r.pays} />
                      <span title={r.pays} style={{ fontSize: 12, fontWeight: sen ? 800 : 700, color: sen ? "var(--bleu)" : "var(--encre)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{r.pays}</span>
                      {sen && horsTop && <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.10)", padding: "2px 7px", borderRadius: 999, flexShrink: 0 }}>{rang}ᵉ DU CLASSEMENT</span>}
                    </span>
                    <span style={{ width: 74, fontSize: 11.5, fontWeight: 800, color: "var(--bleu)", textAlign: "right" as const, flexShrink: 0, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" }}>{fmtVal(r.valeur)}</span>
                    <span style={{ width: 44, fontSize: 10, fontWeight: 700, color: "var(--texte)", textAlign: "right" as const, flexShrink: 0 }}>
                      {total > 0 ? `${(Math.max(0, r.valeur) / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %` : "—"}
                    </span>
                    <div style={{ width: "26%", height: 8, background: "var(--fond)", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
                      {r.valeur > 0 && <div style={{ height: "100%", width: `${Math.min(100, Math.max(2, r.valeur / max * 100))}%`, borderRadius: 99, background: "var(--bleu-action)", opacity: sen ? 1 : podium ? 0.9 : 0.55 }} />}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Libellés de la vue mondiale (ou d'une zone) par catégorie de données
function libellesMonde(sousType: string, zone: string | null) {
  const z = zone ?? "monde";           // « monde » ou le nom de la zone (Afrique…)
  const suf = ` · ${z}`;
  const sufTop = zone ? ` · ${zone}` : "";
  if (sousType === "greenfield") return {
    ind: "greenfield_valeur",
    // Les deux KPIs de tête portaient « · monde » ou « · Afrique » : la zone
    // est deja nommee dans l'en-tete de la vue, le suffixe ne faisait
    // qu'allonger un titre qui tient desormais sur une ligne.
    kpiE: "Greenfield reçus", kpiS: "Greenfield émis",
    serieE: `Investissements greenfield reçus${suf}`, serieS: `Investissements greenfield émis${suf}`,
    topE: `Top 10 des pays d'accueil · greenfield${sufTop}`, topS: `Top 10 des pays émetteurs · greenfield${sufTop}`,
    top1E: "1er pays d'accueil", top1S: "1er pays émetteur",
  };
  if (sousType === "fusion") return {
    ind: "ma_valeur",
    kpiE: "Rachats d'entreprises", kpiS: "Acquisitions",
    serieE: `Valeur des rachats d'entreprises${suf}`, serieS: `Valeur des acquisitions à l'étranger${suf}`,
    topE: `Top 10 des pays cibles · M&A${sufTop}`, topS: `Top 10 des pays acquéreurs · M&A${sufTop}`,
    top1E: "1er pays cible", top1S: "1er pays acquéreur",
  };
  return {
    ind: "flux",
    kpiE: `Flux entrants${suf}`, kpiS: `Flux sortants${suf}`,
    serieE: zone ? `Flux d'IDE entrants · ${zone}` : "Flux d'IDE entrants · total mondial",
    serieS: zone ? `Flux d'IDE sortants · ${zone}` : "Flux d'IDE sortants · total mondial",
    topE: `Top 10 des pays récepteurs d'IDE${sufTop}`, topS: `Top 10 des pays émetteurs d'IDE${sufTop}`,
    top1E: "1er pays récepteur", top1S: "1er pays émetteur",
  };
}

function VueMondeGlobale({ sousType, modeAnnees, anneeMin, anneeMax, anneesSpec, code = null, zone = null }: {
  sousType: string; modeAnnees: "plage" | "specifiques"; anneeMin: number; anneeMax: number; anneesSpec: number[];
  /** Groupement (continent, région, organisation) : restreint l'agrégat à ses pays membres */
  code?: string | null; zone?: string | null;
}) {
  const L = libellesMonde(sousType, zone);
  type Global = { series: { entrant: { annee: number; valeur: number }[]; sortant: { annee: number; valeur: number }[] }; tops: { entrant: TopPays[]; sortant: TopPays[] } };
  const [donnees, setDonnees] = useState<Global | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);
  // Curseur Cumul ⇆ année de chaque top (données estampillées de leur année)
  const [anneeTopE, setAnneeTopE] = useState<number | null>(null);
  const [anneeTopS, setAnneeTopS] = useState<number | null>(null);
  const [topAnneeE, setTopAnneeE] = useState<{ annee: number; rows: TopPays[] } | null>(null);
  const [topAnneeS, setTopAnneeS] = useState<{ annee: number; rows: TopPays[] } | null>(null);
  const anneeTopED = useDebounced(anneeTopE, 250);
  const anneeTopSD = useDebounced(anneeTopS, 250);

  const paramsPeriode = useCallback(() => {
    const p = new URLSearchParams({ indicateur: L.ind });
    if (code) p.set("code", code);
    if (modeAnnees === "specifiques" && anneesSpec.length > 0) p.set("annees", anneesSpec.join(","));
    else { p.set("annee_min", String(anneeMin)); p.set("annee_max", String(anneeMax)); }
    return p;
  }, [L.ind, code, modeAnnees, anneeMin, anneeMax, anneesSpec]);

  useEffect(() => {
    setLoading(true); setErreur(false);
    fetch(`${API}/ide/monde/global?${paramsPeriode()}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setDonnees)
      .catch(e => { console.error(e); setErreur(true); })
      .finally(() => setLoading(false));
  }, [paramsPeriode, tick]);

  // Top d'une année précise (par direction)
  useEffect(() => {
    if (anneeTopED === null) { setTopAnneeE(null); return; }
    const annee = anneeTopED;
    fetch(`${API}/ide/monde/global?indicateur=${L.ind}&annees=${annee}${code ? `&code=${code}` : ""}`)
      .then(r => r.json()).then(d => setTopAnneeE({ annee, rows: d?.tops?.entrant || [] }))
      .catch(() => setTopAnneeE({ annee, rows: [] }));
  }, [anneeTopED, L.ind, code]);
  useEffect(() => {
    if (anneeTopSD === null) { setTopAnneeS(null); return; }
    const annee = anneeTopSD;
    fetch(`${API}/ide/monde/global?indicateur=${L.ind}&annees=${annee}${code ? `&code=${code}` : ""}`)
      .then(r => r.json()).then(d => setTopAnneeS({ annee, rows: d?.tops?.sortant || [] }))
      .catch(() => setTopAnneeS({ annee, rows: [] }));
  }, [anneeTopSD, L.ind, code]);

  if (loading) return <SkeletonChartGrid n={4} cols={2} height={230}/>;
  if (erreur) return <ErreurChargement onRetry={() => setTick(t => t + 1)} />;
  const sE = donnees?.series?.entrant || [];
  const sS = donnees?.series?.sortant || [];
  if (!sE.length && !sS.length) return (
    <div style={{ textAlign: "center" as const, padding: "80px 24px", color: "var(--gris)" }}>
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>Aucune donnée {zone ? `pour ${zone}` : "mondiale"} dans cette catégorie.</p>
    </div>
  );

  const annees = [...new Set([...sE, ...sS].map(d => d.annee))].sort((a, b) => a - b);
  // KPIs : dernière année et variation vs précédente, 1ers pays au cumul
  const kpiDe = (serie: { annee: number; valeur: number }[]) => {
    const l = serie[serie.length - 1], p = serie.length > 1 ? serie[serie.length - 2] : null;
    return { l, delta: l && p && p.valeur ? (l.valeur - p.valeur) / Math.abs(p.valeur) * 100 : null, ref: p?.annee ?? null };
  };
  const kE = kpiDe(sE), kS = kpiDe(sS);
  const topsE = donnees?.tops?.entrant || [], topsS = donnees?.tops?.sortant || [];
  const cards = [
    { label: L.kpiE, annee: kE.l?.annee ?? null, val: kE.l ? fmtVal(kE.l.valeur) : "N/A", delta: kE.delta, ref: kE.ref, texte: false },
    { label: L.kpiS, annee: kS.l?.annee ?? null, val: kS.l ? fmtVal(kS.l.valeur) : "N/A", delta: kS.delta, ref: kS.ref, texte: false },
    { label: L.top1E, annee: null, val: topsE[0]?.pays || "—", delta: null, ref: null, texte: true, sous: topsE[0] ? `${fmtVal(topsE[0].valeur)} sur la période` : "" },
    { label: L.top1S, annee: null, val: topsS[0]?.pays || "—", delta: null, ref: null, texte: true, sous: topsS[0] ? `${fmtVal(topsS[0].valeur)} sur la période` : "" },
  ] as any[];
  const seriesE = [{ nom: zone ?? "Monde", couleur: "var(--bleu)", data: sE }];
  const seriesS = [{ nom: zone ?? "Monde", couleur: "var(--orange)", data: sS }];

  return (
    <div className="charge-in">
      {/* KPIs mondiaux */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: "var(--carte)", borderRadius: 14, padding: "13px 14px", border: "1px solid rgb(var(--encre-rgb) / 0.12)", transition: "border-color 0.18s", minWidth: 0 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgb(var(--bleu-rgb) / 0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgb(var(--encre-rgb) / 0.12)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7, flexWrap: "wrap" as const }}>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "var(--bleu)", textTransform: "uppercase" as const, lineHeight: 1.4 }}>{c.label}</p>
              {c.annee != null && <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--gris)", background: "var(--bleu-voile)", padding: "1px 7px", borderRadius: 4, lineHeight: 1.5, flexShrink: 0 }}>{c.annee}</span>}
            </div>
            <p title={c.texte ? c.val : undefined} style={{ fontSize: c.texte ? "0.98rem" : "1.15rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.val}</p>
            <div style={{ marginTop: 5, minHeight: 12, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const }}>
              {c.delta != null && c.ref != null ? (
                  <Variation valeur={c.delta} annee={c.ref} taille={10} />
                ) : (c.sous ? <p style={{ fontSize: 10, color: "var(--gris)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.sous}</p> : null)}
            </div>
          </div>
        ))}
      </div>

      {/* Totaux mondiaux — un graphe par ligne.
          Entrants et sortants ne se comparent pas terme a terme ici : ce sont
          deux agregats mondiaux d'ordres de grandeur souvent tres differents,
          chacun sur sa propre echelle. Cote a cote, ils invitaient a une
          lecture comparee que les axes ne permettent pas — et une serie de
          trente-cinq ans en demi-largeur perd ses inflexions. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginBottom: 20 }}>
        <GrapheCard titre={L.serieE} unite="M$ USD" source="CNUCED" series={seriesE} grapheId={`monde-global-e-${sousType}-${code ?? "monde"}`} hideLegend hideSousTitre
          fullChildren={<GrapheMultiPays series={seriesE} height={340}/>}>
          <GrapheMultiPays series={seriesE} height={240}/>
        </GrapheCard>
        <GrapheCard titre={L.serieS} unite="M$ USD" source="CNUCED" series={seriesS} grapheId={`monde-global-s-${sousType}-${code ?? "monde"}`} hideLegend hideSousTitre
          fullChildren={<GrapheMultiPays series={seriesS} height={340}/>}>
          <GrapheMultiPays series={seriesS} height={240}/>
        </GrapheCard>
      </div>

      {/* Top 10 mondiaux */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
        <TableauTopPays titre={L.topE} annees={annees}
          annee={anneeTopE} onAnnee={setAnneeTopE}
          chargement={anneeTopE !== null && topAnneeE?.annee !== anneeTopE}
          rows={anneeTopE !== null ? (topAnneeE?.annee === anneeTopE ? topAnneeE.rows : []) : topsE} />
        <TableauTopPays titre={L.topS} annees={annees}
          annee={anneeTopS} onAnnee={setAnneeTopS}
          chargement={anneeTopS !== null && topAnneeS?.annee !== anneeTopS}
          rows={anneeTopS !== null ? (topAnneeS?.annee === anneeTopS ? topAnneeS.rows : []) : topsS} />
      </div>
    </div>
  );
}

function OngletMonde({ showTable, setShowTable, sousOnglet, setSousOnglet, sousType, setSousType, vueP, setVueP }: { showTable: boolean; setShowTable: (v:boolean)=>void; sousOnglet: string; setSousOnglet: (v:"pays"|"comparative"|"monde")=>void; sousType: string; setSousType: (v:"fluxstock"|"greenfield"|"fusion")=>void; vueP: string; setVueP: (v:"pays"|"secteurs")=>void }) {
  const [borneMin, borneMax] = useBornesCnuced(sousType);
  const [anneeMin,    setAnneeMin]   = useState(borneMin);
  const [anneeMax,    setAnneeMax]   = useState(borneMax);
  const [anneesSpec,  setAnneesSpec] = useState<number[]>([]);
  const [modeAnnees,  setModeAnnees] = useState<"plage"|"specifiques">("plage");
  // Période stabilisée : le fetch attend la fin du drag des sliders
  const anneeMinD   = useDebounced(anneeMin, 300);
  const anneeMaxD   = useDebounced(anneeMax, 300);
  const anneesSpecD = useDebounced(anneesSpec, 300);
  // Alignement sur les bornes réelles dès qu'elles sont connues
  useEffect(() => { setAnneeMin(borneMin); setAnneeMax(borneMax); }, [borneMin, borneMax]);
  const [sidebarOpen, setSidebarOpen]= useState(true);
  const [sidebarWidth,setSidebarWidth]=useState(280);
  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 200, 520);

  const [groupements, setGroupements] = useState<{code:string; nom_fr:string; categorie:string}[]>([]);
  const [grpSelec,    setGrpSelec]    = useState<string[]>([]);
  // Raisonner par continents OU par régions (sélections séparées)
  const [contMode,    setContMode]    = useState<"continent"|"region">("continent");
  // Popover d'ajout de groupement ouvert → le contenu est flouté derrière
  const [ajoutOpen,   setAjoutOpen]   = useState(false);
  const [searchGrp,   setSearchGrp]   = useState("");
  const [contExpanded,setContExpanded]= useState<Record<string,boolean>>({});

  const { data: groupementsData } = useDonnees<any[]>(`${API}/ide/monde/groupements`);
  useEffect(() => { setGroupements(groupementsData || []); }, [groupementsData]);


  const grpAvecCouleur = grpSelec.map((code, i) => {
    const g = groupements.find(x => x.code === code);
    return { nom: code, label: g?.nom_fr || code, abrege: code.replace(/_/g, " "), couleur: COMP_PALETTE[i] ?? COMP_PALETTE[4] };
  });

  // Données en cache React Query, clé = groupements + période ; `garder` évite
  // le clignotement pendant les transitions de sélection.
  const urlMonde = (() => {
    if (!grpSelec.length) return null;
    const params = new URLSearchParams();
    params.set("codes_list", grpSelec.join(","));
    if (modeAnnees==="specifiques"&&anneesSpecD.length>0) params.set("annees", anneesSpecD.join(","));
    else { params.set("annee_min", String(anneeMinD)); params.set("annee_max", String(anneeMaxD)); }
    return `${API}/ide/monde?${params}`;
  })();
  const qMonde = useDonnees<any[]>(urlMonde, { garder: true });
  const donnees = useMemo(() => (urlMonde ? (qMonde.data ?? []) : []).map((d: any) => ({
    pays: d.code, direction: d.direction, indicateur: d.indicateur, annee: d.annee, valeur: d.somme,
  })), [urlMonde, qMonde.data]);
  const loading = qMonde.isPending && urlMonde !== null;
  const erreur = qMonde.isError;

  const buildSeries = (dir:string, ind:string) =>
    grpAvecCouleur.map(g => ({ nom:g.abrege, couleur:g.couleur, data:donnees.filter(d=>d.pays===g.nom&&d.direction===dir&&d.indicateur===ind) }));

  // Graphes selon le sous-type actif (Flux & Stocks / Greenfield / M&A)
  const stActif = sousType !== "fluxstock" && SERIES_TYPES[sousType] ? SERIES_TYPES[sousType] : null;
  const GRAPHES = stActif
    ? stActif.map((s, i) => ({ id:`${sousType}-${i}`, titre:s.label, unite:s.unite, series: buildSeries(s.dir, s.ind) }))
    : [
      { id:"fe", titre:"Flux d'IDE entrants",  unite:"musd" as const, series: buildSeries("entrant","flux") },
      { id:"fs", titre:"Flux d'IDE sortants",  unite:"musd" as const, series: buildSeries("sortant","flux") },
      { id:"se", titre:"Stock d'IDE entrant",  unite:"musd" as const, series: buildSeries("entrant","stock") },
      { id:"ss", titre:"Stock d'IDE sortant",  unite:"musd" as const, series: buildSeries("sortant","stock") },
    ];

  // Période réellement couverte par le sous-type (ex. greenfield : 2003+)
  const stBornes = (() => {
    if (!stActif) return null;
    const inds = new Set(stActif.map(s => s.ind));
    const ys = donnees.filter((d: any) => inds.has(d.indicateur) && d.valeur !== null).map((d: any) => d.annee);
    return ys.length ? [Math.min(...ys), Math.max(...ys)] as [number, number] : null;
  })();
  const perMin = stBornes ? Math.max(anneeMin, stBornes[0]) : anneeMin;
  const perMax = stBornes ? Math.min(anneeMax, stBornes[1]) : anneeMax;

  const [donneesDetail, setDonneesDetail] = useState<any[]>([]);
  const modeDetail = grpSelec.length === 1;

  useEffect(() => {
    if (!modeDetail) { setDonneesDetail([]); return; }
    const params = new URLSearchParams({ code: grpSelec[0] });
    if (modeAnnees==="specifiques"&&anneesSpecD.length>0) params.set("annees_spec", anneesSpecD.join(","));
    else { params.set("annee_min", String(anneeMinD)); params.set("annee_max", String(anneeMaxD)); }
    fetch(`${API}/ide/monde/details?${params}`).then(r=>r.json()).then(d=>setDonneesDetail(d||[])).catch(()=>{});
  }, [modeDetail, grpSelec, anneeMinD, anneeMaxD, anneesSpecD, modeAnnees]);

  const q = searchGrp.toLowerCase();
  const matchGrp = (g: {code:string; nom_fr:string}) => !q || g.nom_fr.toLowerCase().includes(q) || g.code.toLowerCase().includes(q);
  const continents = groupements.filter(g => g.categorie === 'continent');
  const groupes    = groupements.filter(g => g.categorie === 'groupe');
  const regionsDe  = (cont: string) => groupements.filter(g => g.categorie === cont);
  // Famille d'un code : « cont » (continents & régions) ou « groupe » — les
  // comparaisons restent homogènes, on ne mélange pas les deux familles.
  const familleDe = (code: string) => (groupements.find(x => x.code === code)?.categorie === "groupe" ? "groupe" : "cont");
  const familleActive = grpSelec.length ? familleDe(grpSelec[0]) : null;
  // Barre latérale = sélection individuelle uniquement (la comparaison passe
  // par le bouton « + » du titre) : un clic remplace la sélection courante,
  // recliquer sur l'unique sélection revient à « Monde ».
  const toggle = (code: string) => {
    if (grpSelec.length === 1 && grpSelec[0] === code) setGrpSelec([]);
    else setGrpSelec([code]);
  };
  const hasFilter = grpSelec.length>0||(modeAnnees==="specifiques"&&anneesSpec.length>0)||(modeAnnees==="plage"&&(anneeMin!==borneMin||anneeMax!==borneMax));
  const nbFiltres = (grpSelec.length>0?1:0)+((modeAnnees==="specifiques"&&anneesSpec.length>0)||(modeAnnees==="plage"&&(anneeMin!==borneMin||anneeMax!==borneMax))?1:0);
  const reinit = () => { setGrpSelec([]); setModeAnnees("plage"); setAnneeMin(borneMin); setAnneeMax(borneMax); setAnneesSpec([]); };

  return (
    <div style={{ display:"flex", flex:1, minHeight:0 }}>
      {/* Sidebar */}
      <aside style={{ width:sidebarOpen?sidebarWidth:52, flexShrink:0, transition:isResizing.current?"none":"width 0.25s", background:"var(--carte)", borderRight:"1px solid var(--bordure-forte)", height:"100%", overflowY:"auto" as const, overscrollBehavior:"contain" as const, display:"flex", flexDirection:"column" as const }}>
          <style>{`::-webkit-scrollbar-thumb{background:var(--fond-creux2)}::-webkit-scrollbar-thumb:hover{background:var(--fond-creux2)}`}</style>
        {sidebarOpen&&<div onMouseDown={startResize} style={{ position:"absolute" as const, right:0, top:0, bottom:0, width:4, cursor:"col-resize", zIndex:10, background:"transparent", transition:"background 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgb(var(--bleu-rgb) / 0.5)"}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}/>}
        <div style={{ padding:sidebarOpen?"14px 16px 10px":"12px 8px", borderBottom:"1px solid var(--bordure)", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", flexShrink:0 }}>
          {sidebarOpen&&<span style={{ fontSize:12, fontWeight:700, color:"var(--encre)", letterSpacing:"0.08em", textTransform:"uppercase" as const }}>Filtres</span>}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={()=>setSidebarOpen(o=>!o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background:"rgb(var(--bleu-rgb) / 0.08)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:5 }}>
              <SlidersHorizontal size={14} style={{ color:"var(--bleu)" }}/>
              {sidebarOpen&&nbFiltres>0&&<span style={{ fontSize:10, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.15)", borderRadius:999, padding:"1px 5px" }}>{nbFiltres}</span>}
            </button>
            {sidebarOpen&&hasFilter&&<button onClick={reinit} title="Tout réinitialiser" style={{ background:"rgb(var(--danger-rgb) / 0.08)", border:"1px solid rgb(var(--danger-rgb) / 0.20)", cursor:"pointer", borderRadius:999, padding:"5px", display:"flex", alignItems:"center", transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgb(var(--danger-rgb) / 0.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgb(var(--danger-rgb) / 0.08)";}}>
              <span className="material-symbols-outlined" style={{ fontSize:15, color:"var(--danger)", fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24", lineHeight:1 }}>close</span>
            </button>}
          </div>
        </div>
        {sidebarOpen&&<div style={{ padding:"16px", overflowY:"auto" as const, flex:1 }}>
          {/* Sélecteurs Vue + Type d'analyse */}
          <SelecteurVueAnalyse vueP={vueP} setVueP={setVueP} typeAnalyse={sousOnglet} setTypeAnalyse={setSousOnglet} setSousType={setSousType}/>

          {/* Recherche */}
          <div style={{ position:"relative" as const, marginBottom:18 }}>
            <Search size={13} style={{ position:"absolute" as const, left:9, top:"50%", transform:"translateY(-50%)", color:"var(--gris)" }}/>
            <input value={searchGrp} onChange={e=>setSearchGrp(e.target.value)} placeholder="Rechercher un groupement…"
              style={{ width:"100%", paddingLeft:30, paddingRight:8, paddingTop:8, paddingBottom:8, borderRadius:8, border:"1px solid var(--bordure-forte)", background:"var(--carte-douce)", fontSize:12, color:"var(--encre)", outline:"none", fontFamily:"var(--font-google-sans)", boxSizing:"border-box" as const }}/>
            {searchGrp&&<button onClick={()=>setSearchGrp("")} aria-label="Effacer la recherche" style={{ position:"absolute" as const, right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0 }}><X size={11} style={{ color:"var(--gris)" }}/></button>}
          </div>
          <div style={{ height:1, background:"var(--fond)", marginBottom:18 }}/>

          {/* Période */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>Période</span>
            </div>
            <div style={{ display:"flex", gap:3, background:"var(--fond)", borderRadius:9, padding:3, marginBottom:12 }}>
              {[{v:"plage",l:"Plage"},{v:"specifiques",l:"Années"}].map(m=>(
                <button key={m.v} onClick={()=>setModeAnnees(m.v as "plage"|"specifiques")}
                  style={{ flex:1, padding:"7px 0", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:modeAnnees===m.v?"var(--carte)":"transparent", color:modeAnnees===m.v?"var(--encre)":"var(--gris)", boxShadow:modeAnnees===m.v?"0 1px 4px rgb(var(--ombre-rgb) / 0.1)":"none", transition:"all 0.15s" }}>
                  {m.l}
                </button>
              ))}
            </div>
            {modeAnnees==="plage" ? (
              <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                <div style={{ padding:"4px 0" }}>
                  <CurseurPlageNace min={borneMin} max={borneMax} debut={anneeMin} fin={anneeMax} ecartMin={1}
                    onChange={(d,f)=>{ setAnneeMin(d); setAnneeMax(f); }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMin}</span>
                  <span style={{ fontSize:10, color:"var(--gris)" }}>—</span>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.08)", padding:"2px 8px", borderRadius:6 }}>{anneeMax}</span>
                </div>
                <p style={{ fontSize:11, color:"var(--gris)", textAlign:"center" as const }}>{anneeMax-anneeMin+1} année{anneeMax-anneeMin+1>1?"s":""}</p>
              </div>
            ) : (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:3, marginBottom:8 }}>
                  {Array.from({length:borneMax-borneMin+1},(_,i)=>borneMin+i).map(a=>{
                    const sel=anneesSpec.includes(a);
                    return (
                      <button key={a} onClick={()=>setAnneesSpec(prev=>sel?prev.filter(x=>x!==a):[...prev,a].sort())}
                        style={{ padding:"5px 0", borderRadius:5, border:`1px solid ${sel?"var(--bleu)":"var(--bordure-forte)"}`, cursor:"pointer", fontSize:10, fontWeight:sel?700:400, textAlign:"center" as const, background:sel?"var(--bleu-action)":"var(--carte-douce)", color:sel?"var(--sur-bleu)":"var(--texte)", transition:"all 0.1s" }}>
                        {a}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, color:"var(--texte)" }}>{anneesSpec.length>0?`${anneesSpec.length} année${anneesSpec.length>1?"s":""}`:""}</span>
                  {anneesSpec.length>0&&<button onClick={()=>setAnneesSpec([])} style={{ fontSize:11, color:"var(--gris)", background:"none", border:"none", cursor:"pointer" }}>Effacer</button>}
                </div>
              </div>
            )}
          </div>
          <div style={{ height:1, background:"var(--fond)", marginBottom:18 }}/>

          {/* ── Monde (agrégat mondial) — sélectionné quand rien d'autre ne l'est ── */}
          {(() => { const mondeSel = grpSelec.length === 0; return (
            <button onClick={()=>setGrpSelec([])}
              style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 10px", borderRadius:9, border:"none", cursor:"pointer", background:mondeSel?"rgb(var(--bleu-rgb) / 0.07)":"transparent", textAlign:"left" as const, width:"100%", marginBottom:10 }}
              onMouseEnter={e=>{ if(!mondeSel)(e.currentTarget as HTMLElement).style.background="var(--carte-douce)"; }}
              onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background=mondeSel?"rgb(var(--bleu-rgb) / 0.07)":"transparent"; }}>
              <div style={{ width:11, height:11, borderRadius:"50%", border:`2px solid ${mondeSel?"var(--bleu)":"var(--bordure-forte)"}`, background:mondeSel?"var(--bleu-action)":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {mondeSel&&<div style={{ width:3.5, height:3.5, borderRadius:"50%", background:"var(--carte)" }}/>}
              </div>
              <span style={{ fontSize:13, color:"var(--encre)", fontWeight:mondeSel?700:500 }}>Monde</span>
            </button>
          ); })()}
          <div style={{ height:1, background:"var(--fond)", marginBottom:12 }}/>

          {groupements.length===0&&<div style={{ padding:"8px 0" }}><SkeletonRows n={8} h={26}/></div>}

          {/* Helper render d'un item */}
          {(() => {
            const Item = ({ g }: { g: {code:string; nom_fr:string}; }) => {
              const sel = grpSelec.includes(g.code);
              const col = sel ? COMP_PALETTE[grpSelec.indexOf(g.code)] : "var(--bordure-forte)";
              return (
                <button key={g.code} onClick={()=>toggle(g.code)} title={g.nom_fr}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:7, border:"none", cursor:"pointer", background:"transparent", textAlign:"left" as const, width:"100%", marginBottom:1 }}
                  onMouseEnter={e=>{
                    if(!sel)(e.currentTarget as HTMLElement).style.background="var(--carte-douce)";
                    const box=e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null; const sp=box?.firstElementChild as HTMLElement|null;
                    if(box&&sp){ const d=sp.scrollWidth-box.clientWidth; if(d>0){ sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; } }
                  }}
                  onMouseLeave={e=>{
                    (e.currentTarget as HTMLElement).style.background="transparent";
                    const box=e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null; const sp=box?.firstElementChild as HTMLElement|null;
                    if(box&&sp){ sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; }
                  }}>
                  <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${sel?col:"var(--bordure-forte)"}`, background:sel?col:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>

                  </div>
                  <span data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const, minWidth:0, flex:1 }}>
                    <span style={{ display:"inline-block", fontSize:12, color:"var(--texte)", fontWeight:sel?700:400 }}>{(g as any).categorie === "groupe" ? g.code.replace(/_/g, " ") : g.nom_fr}</span>
                  </span>
                </button>
              );
            };

            const SectionTitle = ({ label }: { label: string }) => (
              <div style={{ display:"flex", alignItems:"center", marginBottom:6, marginTop:2 }}>
                <span style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em" }}>{label}</span>
              </div>
            );

            const filtCont  = continents.filter(matchGrp);
            const filtGrp   = groupes.filter(matchGrp);

            const showContSection = filtCont.length > 0 || continents.some(c => regionsDe(c.nom_fr).some(matchGrp));
            const showGrpSection  = filtGrp.length > 0;

            return (
              <>
                {/* ── Continents & Régions : on raisonne par l'un OU l'autre ── */}
                {showContSection && <>
                  <SectionTitle label="Continents & Régions"/>
                  <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                    {([{v:"continent",l:"Continents"},{v:"region",l:"Régions"}] as const).map(o=>(
                      <button key={o.v} onClick={()=>{ if(contMode!==o.v){ setContMode(o.v); if(familleActive==="cont") setGrpSelec([]); } }}
                        style={{ flex:1, padding:"7px 2px", borderRadius:8, border:`1px solid ${contMode===o.v?"var(--bleu)":"var(--bordure-forte)"}`, cursor:"pointer", fontSize:11.5, fontWeight:contMode===o.v?700:500, background:contMode===o.v?"rgb(var(--bleu-rgb) / 0.08)":"var(--carte-douce)", color:contMode===o.v?"var(--bleu)":"var(--texte)", fontFamily:"var(--font-google-sans)" }}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                  {contMode === "continent"
                    ? filtCont.map(c => <Item key={c.code} g={c}/>)
                    : continents.map(cont => {
                        const visRegs = regionsDe(cont.nom_fr).filter(matchGrp);
                        if (!visRegs.length) return null;
                        const expanded = q ? true : (contExpanded[cont.code] ?? false);
                        return (
                          <div key={cont.code} style={{ marginBottom:3 }}>
                            {/* Bandeau continent dépliable (comme les groupes BDEF) */}
                            <button onClick={()=>setContExpanded(prev=>({ ...prev, [cont.code]: !expanded }))}
                              style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"rgb(var(--bleu-rgb) / 0.04)", border:"none", cursor:"pointer", borderRadius:8, padding:"6px 9px", marginBottom:2 }}>
                              <span style={{ fontSize:10.5, fontWeight:700, color:"var(--bleu)", letterSpacing:"0.1em", textTransform:"uppercase" as const }}>{cont.nom_fr}</span>
                              {expanded ? <ChevronDown size={12} style={{ color:"var(--bleu)", flexShrink:0 }}/> : <ChevronRight size={12} style={{ color:"var(--bleu)", flexShrink:0 }}/>}
                            </button>
                            {expanded && <div style={{ paddingLeft:6, marginBottom:2 }}>{visRegs.map(r => <Item key={r.code} g={r}/>)}</div>}
                          </div>
                        );
                      })}
                  <div style={{ height:1, background:"var(--fond)", margin:"12px 0" }}/>
                </>}

                {/* ── Groupements ───────────────────────── */}
                {showGrpSection && <>
                  <SectionTitle label="Groupements"/>
                  {filtGrp.map(g => <Item key={g.code} g={g}/>)}
                  <div style={{ height:1, background:"var(--fond)", margin:"12px 0" }}/>
                </>}

                {!showContSection && !showGrpSection && q &&
                  <p style={{ fontSize:12, color:"var(--gris)", textAlign:"center" as const, padding:"8px 0" }}>Aucun résultat</p>}
              </>
            );
          })()}


        </div>}
      </aside>

      {/* Zone graphes */}
      <div style={{ flex:1, minWidth:0, overflowY:"auto" as const, overscrollBehavior:"contain" as const, padding:"36px 40px 80px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:22 }}>
          <SousTypeNav value={sousType} onChange={setSousType}/>
          {grpSelec.length>0 && <BoutonDonnees onClick={()=>setShowTable(true)} dep={grpSelec.join(",")}/>}
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" as const }}>
            {grpSelec.length >= 2 ? (
              /* Comparatif : toutes les sélections en pastilles retirables */
              grpAvecCouleur.map((g,i)=>(
                <BadgeSerie key={g.nom} i={i} couleur={g.couleur} title={g.label}>
                  {g.abrege}
                  <button onClick={()=>setGrpSelec(p=>p.filter(c=>c!==g.nom))} aria-label={`Retirer ${g.label}`}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", color:"inherit" }}>
                    <X size={11}/>
                  </button>
                </BadgeSerie>
              ))
            ) : (
              /* Monde ou sélection unique : le titre EST le choix */
              <>
                <div style={{ width:10, height:10, borderRadius:"50%", background:"var(--bleu-action)", flexShrink:0 }} />
                <h2 style={{ fontWeight:800, fontSize:"1.3rem", color:"var(--encre)", margin:0 }}>{grpAvecCouleur[0]?.label ?? "Monde"}</h2>
              </>
            )}
            <BtnAjoutGroupement groupements={groupements} exclus={grpSelec}
              type={(() => {
                if (!grpSelec.length) return null;
                const cat = groupements.find(x => x.code === grpSelec[0])?.categorie;
                return cat === "continent" ? "continent" : cat === "groupe" ? "groupe" : "region";
              })()}
              plein={grpSelec.length>=4} changer={grpSelec.length===0}
              onPick={code=>setGrpSelec(p=>p.includes(code)||p.length>=4?p:[...p,code])}
              onOpenChange={setAjoutOpen}/>
            <BadgePeriode>
              {modeAnnees==="specifiques"&&anneesSpec.length>0
                ? anneesSpec.length===1?`${anneesSpec[0]}`:`${anneesSpec[0]} — ${anneesSpec[anneesSpec.length-1]}`
                : `${perMin} — ${perMax}`}
            </BadgePeriode>
          </div>
        </div>

        <div style={{ filter: ajoutOpen ? "blur(4px)" : "none", opacity: ajoutOpen ? 0.6 : 1, pointerEvents: ajoutOpen ? "none" : "auto", transition: "filter 0.2s, opacity 0.2s" }}>
        {grpSelec.length===0 ? (
          <VueMondeGlobale key="monde" sousType={sousType} modeAnnees={modeAnnees} anneeMin={anneeMinD} anneeMax={anneeMaxD} anneesSpec={anneesSpecD}/>
        ) : grpSelec.length===1 ? (
          <VueMondeGlobale key={grpSelec[0]} sousType={sousType} modeAnnees={modeAnnees} anneeMin={anneeMinD} anneeMax={anneeMaxD} anneesSpec={anneesSpecD}
            code={grpSelec[0]}
            zone={(groupements.find(g => g.code === grpSelec[0])?.categorie === "groupe"
              ? grpSelec[0].replace(/_/g, " ")
              : grpAvecCouleur[0]?.label) ?? grpSelec[0]}/>
        ) : loading ? (
          <SkeletonChartGrid n={4} cols={2} height={230}/>
        ) : erreur ? (
          <ErreurChargement onRetry={() => qMonde.refetch()} />
        ) : (
          <div className="charge-in">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
            {GRAPHES.map(g=>(
              <GrapheCard key={g.id} titre={g.titre} unite={g.unite==="nombre"?"Nombre":"M$ USD"} source="CNUCED" sous_titre="Somme des pays membres" series={g.series} grapheId={g.id} hideLegend hideSousTitre
                fullChildren={<GrapheMultiPays series={g.series} height={340} type={g.unite==="nombre"?"bar":"line"} titre={g.id} lineWidth={1.6} fmt={g.unite==="nombre"?fmtNombre:undefined}/>}>
                <GrapheMultiPays series={g.series} height={145} type={g.unite==="nombre"?"bar":"line"} titre={g.id} showDots={false} lineWidth={1.4} fmt={g.unite==="nombre"?fmtNombre:undefined}/>
              </GrapheCard>
            ))}
          </div>

          {modeDetail && !stActif && (
            <div style={{ marginTop:28, display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
              <GrapheCard titre={`Flux entrant — Top 10 · ${grpAvecCouleur[0]?.abrege ?? ''}`} unite="M$ USD" source="CNUCED" sous_titre="Flux IDE entrant · dernière année" grapheId="hbar" hideSousTitre
                fullChildren={<HBarChart donnees={donneesDetail}/>}>
                <HBarChart donnees={donneesDetail} mini/>
              </GrapheCard>
              <GrapheCard titre={`Ent. vs Sort. — Top 10 · ${grpAvecCouleur[0]?.abrege ?? ''}`} unite="M$ USD" source="CNUCED" sous_titre="Top 10 · net entrant − sortant · vert positif / rouge négatif" grapheId="divbar" hideSousTitre
                fullChildren={<DivergingBars donnees={donneesDetail}/>}>
                <DivergingBars donnees={donneesDetail} mini/>
              </GrapheCard>
            </div>
          )}
          </div>
        )}
        </div>
      </div>
      <ModalDonnees open={showTable} onClose={()=>setShowTable(false)} donnees={donnees} paysSelectionnes={grpAvecCouleur} sousType={sousType} />
    </div>
  );
}

export default OngletMonde;
