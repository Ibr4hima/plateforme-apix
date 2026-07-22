"use client";

import NavActions from "@/components/layout/NavActions";
import GrapheSignature from "@/components/shared/GrapheMultiPays";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { SkeletonKPIs, SkeletonChartGrid, SkeletonRows } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fmtUnite as fmt, fmtUSD, fmtCompact as fmtValGen, fmtAxe } from "@/lib/format";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { d3, useD3Pret } from "@/lib/d3lazy";
import { ChevronDown, FileSpreadsheet, Loader2, Search, SlidersHorizontal, Table, X } from "lucide-react";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardStatistiques";
import { GrapheBarresH } from "@/components/charts/GrapheBarresH";
import { GrapheBarresEmpilees } from "@/components/charts/GrapheBarresEmpilees";
import { GrapheDonut } from "@/components/charts/GrapheDonut";
import { GrapheConcentration } from "@/components/charts/GrapheConcentration";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Palette de couleurs par pays (analyse comparative / fiche)
const PALETTE = ["#004f91", "#ca631f", "#188038", "#6A1B9A", "#0891b2", "#b91c1c", "#a16207", "#4338ca"];

type Indicateur = { code: string; libelle: string; unite: string; categorie: string; ordre: number; derive: boolean };
type Pays = { id: number; nom: string; code_iso3: string; continent: string; region_geo: string | null };
type Donnee = { pays_id: number; pays: string; annee: number; indicateur: string; valeur: number | null };

// ── Regroupement des pays par continent ───────────────────────────────────────
const VUES: { v: "pays" | "comparative"; l: string }[] = [
  { v: "pays", l: "Pays" },
  { v: "comparative", l: "Analyse comparative" },
];
const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];
const MAX_KPI = 5;
const KPI_DEFAUT = ["population", "superficie", "densite", "pib", "pib_hab"];
function sortContinents(conts: string[]) {
  return [...conts].sort((a, b) => {
    const ia = CONT_ORDER.indexOf(a), ib = CONT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });
}

// ── Panneau Commerce extérieur (Sénégal uniquement) ──────────────────────────
// Alimenté par le Bulletin mensuel du commerce extérieur de l'ANSD (API /bmce) :
// KPIs du dernier mois, série mensuelle export/import et répartitions par
// catégorie. Les dérivés (variations, parts, VU) viennent du backend (règles
// ANSD) : une variation indéfinie (null) ne s'affiche jamais.

// État d'attente : affiché tant qu'aucun bulletin n'a été importé.
function CommerceExterieurAttente() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "60px 40px 100px" }}>
      <div className="ds-carte" style={{ padding: "72px 32px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "var(--rayon-lg)", background: "var(--ds-voile-bleu)",
          display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }} aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ds-primaire)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" />
          </svg>
        </div>
        <p style={{ font: "700 17px/1.4 var(--font-display)", color: "var(--text-primary)" }}>
          Commerce extérieur du Sénégal
        </p>
        <p style={{ font: "var(--typo-corps)", color: "var(--text-muted)", marginTop: 8, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
          Les indicateurs du commerce extérieur (exportations, importations, balance, partenaires et produits)
          seront disponibles ici après l'import des données dans l'administration.
        </p>
      </div>
    </div>
  );
}

// Formes renvoyées par l'API BMCE (backend/app/api/routes/bmce.py)
type BmceFluxMois = { valeur: number | null; poids: number | null };
type BmcePointEnsemble = { periode: string; export?: BmceFluxMois; import?: BmceFluxMois };
type BmceApercu = {
  disponible: boolean; dernier_mois?: string;
  exportations_fab?: number | null; importations_caf?: number | null;
  balance?: number | null; taux_couverture?: number | null;
  variation_export?: number | null; variation_import?: number | null;
  cumul_annee?: { annee: string; exportations_fab: number; importations_caf: number; balance: number };
  mois_provisoires?: string[]; serie?: BmcePointEnsemble[];
};
type BmcePoint = { periode: string; valeur_fcfa: number | null; poids_kg: number | null; vu_fcfa_kg: number | null; part_pct: number | null; variation_pct: number | null };
type BmceRubrique = { libelle: string; ordre: number; vu_cumul_fcfa_kg: number | null; data: BmcePoint[] };

// Montants en FCFA (pas de helper FCFA dans lib/format : helper local, mêmes
// règles que fmtUSD — fr-FR, 1 décimale max, suffixes avec espaces)
const nfFcfa = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
function fmtFCFA(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `${nfFcfa(v / 1e9)} Md FCFA`;
  if (a >= 1e6) return `${nfFcfa(v / 1e6)} M FCFA`;
  return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
}
// « 2025-04-01 » → « avril 2025 » (long) / « avr. 25 » (axe) / « avr. » (nu)
function bmceMoisLong(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}
function bmceMoisCourt(iso: string, avecAnnee = true): string {
  const [y, m] = iso.split("-").map(Number);
  const nom = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
  return avecAnnee ? `${nom} ${String(y).slice(2)}` : nom;
}
// « 2025-01-01 » → « Janvier » (mois en toutes lettres, initiale majuscule)
function bmceMoisNom(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const nom = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long" });
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}
// Variation mensuelle ▲/▼ — règle ANSD : indéfinie (null) → on n'affiche rien
function BmceVariation({ v, taille = 11 }: { v: number | null | undefined; taille?: number }) {
  if (v === null || v === undefined) return null;
  const pos = v > 0, neg = v < 0;
  const col = pos ? "#188038" : neg ? "#dc2626" : "#9aa5b4";
  return (
    <span style={{ fontSize: taille, fontWeight: 700, color: col, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {pos ? "▲" : neg ? "▼" : "="}&nbsp;{Math.abs(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
    </span>
  );
}

const BMCE_BLEU = "#004f91";    // exportations
const BMCE_ORANGE = "#ca631f";  // importations

const BMCE_SENS = [
  { v: "export", l: "Exportations" },
  { v: "import", l: "Importations" },
] as const;
const BMCE_CATS = [
  { v: "groupe_utilisation", l: "Groupes d'utilisation" },
  { v: "produit_regroupe", l: "Produits regroupés" },
  { v: "chapitre", l: "Chapitres" },
  { v: "pays", l: "Pays" },
] as const;
type BmceSens = (typeof BMCE_SENS)[number]["v"];
type BmceCat = (typeof BMCE_CATS)[number]["v"];

function CommerceExterieurPanel() {
  const [apercu, setApercu] = useState<BmceApercu | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);
  // Répartition : sélection sens × catégorie
  const [sens, setSens] = useState<BmceSens>("export");
  const [categorie, setCategorie] = useState<BmceCat>("groupe_utilisation");
  const [rubriques, setRubriques] = useState<BmceRubrique[] | null>(null);
  const [chargSeries, setChargSeries] = useState(false);
  const [erreurSeries, setErreurSeries] = useState(false);
  const [tickSeries, setTickSeries] = useState(0);
  const cacheSeries = useRef<Record<string, BmceRubrique[]>>({});
  // Période analysée : une année (parmi celles des bulletins importés) puis,
  // dans l'année, le cumul annuel ou un mois précis. Tout le panneau suit.
  const [annee, setAnnee] = useState<number | null>(null);
  const [moisSel, setMoisSel] = useState<string>("cumul");   // "cumul" | periode ISO

  useEffect(() => {
    setLoading(true); setErreur(false);
    fetch(`${API}/bmce/apercu`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setApercu).catch(() => setErreur(true)).finally(() => setLoading(false));
  }, [tick]);
  // Sélection par défaut : le dernier mois importé (comportement historique)
  useEffect(() => {
    if (apercu?.disponible && apercu.dernier_mois) {
      setAnnee(Number(apercu.dernier_mois.slice(0, 4)));
      setMoisSel(apercu.dernier_mois);
    }
  }, [apercu]);

  const dispo = apercu?.disponible === true;
  useEffect(() => {
    if (!dispo) return;
    const cle = `${categorie}:${sens}`;
    const enCache = cacheSeries.current[cle];
    if (enCache) { setRubriques(enCache); setErreurSeries(false); return; }
    setChargSeries(true); setErreurSeries(false);
    fetch(`${API}/bmce/series?categorie=${categorie}&sens=${sens}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { cacheSeries.current[cle] = d; setRubriques(d); })
      .catch(() => { setRubriques(null); setErreurSeries(true); })
      .finally(() => setChargSeries(false));
  }, [dispo, categorie, sens, tickSeries]);

  // Série de l'ensemble triée, années disponibles et mois de l'année choisie
  const serie = useMemo(() =>
    (apercu?.serie || []).slice().sort((a, b) => (a.periode < b.periode ? -1 : 1)), [apercu]);
  // Années présentes en base, classées de la plus récente à la plus ancienne
  const anneesDispo = useMemo(() =>
    [...new Set(serie.map(p => Number(p.periode.slice(0, 4))))].sort((a, b) => b - a), [serie]);
  const an = annee ?? anneesDispo[0] ?? 0;
  const serieAn = useMemo(() => serie.filter(p => Number(p.periode.slice(0, 4)) === an), [serie, an]);
  const enCumul = moisSel === "cumul";
  // Mois de référence des ▲/▼ : le mois sélectionné, ou en mode année le
  // dernier mois disponible de l'année (les variations restent mensuelles)
  const moisRef = enCumul ? (serieAn[serieAn.length - 1]?.periode ?? "") : moisSel;

  // Rubriques pour la période choisie (mois : point tel quel ; cumul : sommes
  // ANSD — Σ valeurs, part = Σ / Σ ensemble ; ▲/▼ = variation mensuelle du
  // mois de référence, comme dans le bulletin)
  const derniers = useMemo(() => {
    if (!rubriques) return [];
    let lignes: { libelle: string; valeur: number; part: number | null; variation: number | null }[];
    if (!enCumul) {
      lignes = rubriques.flatMap(r => {
        const pt = r.data.find(d => d.periode === moisSel);
        return pt && pt.valeur_fcfa !== null
          ? [{ libelle: r.libelle, valeur: pt.valeur_fcfa, part: pt.part_pct, variation: pt.variation_pct }] : [];
      });
    } else {
      const ensTot = serieAn.reduce((s, p) => s + ((sens === "export" ? p.export : p.import)?.valeur ?? 0), 0);
      lignes = rubriques.flatMap(r => {
        const pts = r.data.filter(d => Number(d.periode.slice(0, 4)) === an && d.valeur_fcfa !== null);
        if (!pts.length) return [];
        const v = pts.reduce((s, d) => s + (d.valeur_fcfa || 0), 0);
        const ptRef = r.data.find(d => d.periode === moisRef);
        return [{ libelle: r.libelle, valeur: v, part: ensTot > 0 ? (v / ensTot) * 100 : null,
                  variation: ptRef?.variation_pct ?? null }];
      });
    }
    return lignes.sort((a, b) => b.valeur - a.valeur);
  }, [rubriques, enCumul, moisSel, serieAn, sens, an, moisRef]);
  const couleurSens = sens === "export" ? BMCE_BLEU : BMCE_ORANGE;

  const TITRE_SEC: any = { fontSize: 10.5, fontWeight: 800, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 };
  const LBL_SEG: any = { fontSize: 10, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em", minWidth: 76 };

  if (loading) return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 40px 80px", display: "grid", gap: 18 }}>
      <SkeletonKPIs n={4} />
      <SkeletonChartGrid n={1} cols={1} height={300} />
      <SkeletonRows n={6} h={32} />
    </div>
  );
  if (erreur) return <ErreurChargement onRetry={() => setTick(t => t + 1)} />;
  if (!apercu || !apercu.disponible) return <CommerceExterieurAttente />;

  // Agrégats de la période choisie, calculés depuis la série de l'ensemble.
  // Règles ANSD : variation depuis un précédent nul/zéro = indéfinie (null) ;
  // les ▲/▼ sont toujours des variations mensuelles (celle du mois affiché,
  // ou du dernier mois de l'année en mode cumul) ; taux = export / import.
  const sommeSerie = (pts: BmcePointEnsemble[], s: "export" | "import") => {
    const vals = pts.map(p => (s === "export" ? p.export : p.import)?.valeur).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const idxRef = serie.findIndex(p => p.periode === moisRef);
  const pRef = idxRef >= 0 ? serie[idxRef] : null;
  const pPrec = idxRef > 0 ? serie[idxRef - 1] : null;
  const varDe = (v: number | null | undefined, prec: number | null | undefined) =>
    v == null || prec == null || prec === 0 ? null : ((v - prec) / prec) * 100;
  const expSel = enCumul ? sommeSerie(serieAn, "export") : pRef?.export?.valeur ?? null;
  const impSel = enCumul ? sommeSerie(serieAn, "import") : pRef?.import?.valeur ?? null;
  // ▲/▼ : toujours la variation mensuelle du mois de référence
  const varExp = varDe(pRef?.export?.valeur, pPrec?.export?.valeur);
  const varImp = varDe(pRef?.import?.valeur, pPrec?.import?.valeur);
  const libComparaison = pPrec
    ? `${bmceMoisCourt(moisRef, false)} vs ${bmceMoisCourt(pPrec.periode, false)}`
    : "vs mois précédent";
  const balance = expSel != null && impSel != null ? expSel - impSel : null;
  const taux = expSel != null && impSel != null && impSel !== 0 ? (expSel / impSel) * 100 : null;
  // Cumul ANSD de janvier au mois sélectionné (bandeau sous les KPIs en mode mois)
  const serieCumul = enCumul ? serieAn : serieAn.filter(p => p.periode <= moisSel);
  const libPeriode = enCumul
    ? `cumul ${an}${serieAn.length ? ` (${bmceMoisCourt(serieAn[0].periode, false)} – ${bmceMoisCourt(serieAn[serieAn.length - 1].periode, false)})` : ""}`
    : bmceMoisLong(moisSel);
  const kpis = [
    { label: "Exportations", tag: "FAB", valeur: fmtFCFA(expSel), variation: varExp, rouge: false },
    { label: "Importations", tag: "CAF", valeur: fmtFCFA(impSel), variation: varImp, rouge: false },
    // Seule exception rouge autorisée : une balance commerciale négative
    { label: "Balance commerciale", tag: "FAB − CAF", valeur: fmtFCFA(balance), variation: null, rouge: (balance ?? 0) < 0 },
    { label: "Taux de couverture", tag: null, valeur: taux != null ? `${taux.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—", variation: null, rouge: false },
  ];

  return (
    <div className="charge-in" style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 40px 80px" }}>
      {/* En-tête : titre + années des bulletins importés (récentes d'abord).
          Cliquer une année = voir son cumul ; cliquer un mois = voir le mois.
          Style : segments blancs bordés, actif en bleu plein — même langage
          que SousTypeNav de la page IDE (Flux & Stocks / Greenfield / M&A). */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "#1a1a2e", margin: 0 }}>Commerce extérieur du Sénégal</h2>
        <div role="tablist" aria-label="Année"
          style={{ display: "inline-flex", background: "#fff", border: "1px solid #ECEAE7", borderRadius: 999, padding: 3, gap: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          {anneesDispo.map(a => {
            const actif = a === an;
            return (
              <button key={a} role="tab" aria-selected={actif}
                onClick={() => { setAnnee(a); setMoisSel("cumul"); }}
                style={{ padding: "6px 18px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                  background: actif ? "#004f91" : "transparent",
                  color: actif ? "#fff" : "#4a5568",
                  boxShadow: actif ? "0 2px 8px rgba(0,79,145,0.30), inset 0 1px 0 rgba(255,255,255,0.12)" : "none",
                  transition: "background 0.18s, box-shadow 0.18s, color 0.18s", fontFamily: "var(--font-google-sans)" }}
                onMouseEnter={e => { if (!actif) e.currentTarget.style.background = "#F6F5F3"; }}
                onMouseLeave={e => { if (!actif) e.currentTarget.style.background = "transparent"; }}>
                {a}
              </button>
            );
          })}
        </div>
        {/* Briefing exécutif de l'année affichée (communications officielles) */}
        <a href={`/statistiques/rapport-commerce?annee=${an}`}
          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 999,
            background: "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", color: "#fff", fontSize: 12.5, fontWeight: 800,
            textDecoration: "none", boxShadow: "0 2px 10px rgba(0,79,145,0.28)", whiteSpace: "nowrap",
            fontFamily: "var(--font-google-sans)" }}>
          <span className="material-symbols-outlined" aria-hidden
            style={{ fontSize: 17, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 20" }}>dashboard</span>
          Rapport d&apos;analyse
        </a>
      </div>
      {/* Mois de l'année choisie (uniquement les bulletins importés) */}
      {serieAn.length > 0 && (
        <div style={{ display: "inline-flex", background: "#fff", border: "1px solid #ECEAE7", borderRadius: 999, padding: 3, gap: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20, flexWrap: "wrap" }}>
          {serieAn.map(p => {
            const actif = moisSel === p.periode;
            return (
              <button key={p.periode} aria-pressed={actif} onClick={() => setMoisSel(actif ? "cumul" : p.periode)}
                style={{ padding: "6px 18px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                  background: actif ? "#004f91" : "transparent",
                  color: actif ? "#fff" : "#4a5568",
                  boxShadow: actif ? "0 2px 8px rgba(0,79,145,0.30), inset 0 1px 0 rgba(255,255,255,0.12)" : "none",
                  transition: "background 0.18s, box-shadow 0.18s, color 0.18s", fontFamily: "var(--font-google-sans)" }}
                onMouseEnter={e => { if (!actif) e.currentTarget.style.background = "#F6F5F3"; }}
                onMouseLeave={e => { if (!actif) e.currentTarget.style.background = "transparent"; }}>
                {bmceMoisNom(p.periode)}
              </button>
            );
          })}
        </div>
      )}

      {/* KPIs de la période sélectionnée */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} className="ds-carte" style={{ padding: "14px 16px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", color: "#004f91", textTransform: "uppercase", lineHeight: 1.4, margin: 0 }}>{k.label}</p>
              {k.tag && <span style={{ fontSize: 8.5, fontWeight: 700, color: "#9aa5b4", background: "#F2F0EF", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{k.tag}</span>}
            </div>
            <p className="ds-donnee" style={{ fontSize: "1.2rem", fontWeight: 800, color: k.rouge ? "#dc2626" : "#1a1a2e", lineHeight: 1.15, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.valeur}</p>
            <div style={{ marginTop: 6, minHeight: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <BmceVariation v={k.variation} />
              {k.variation !== null && k.variation !== undefined && <span style={{ fontSize: 10, color: "#9aa5b4" }}>{libComparaison}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Cumul de janvier au mois sélectionné (mode mois uniquement :
          en mode année, les KPIs SONT le cumul) */}
      {!enCumul && serieCumul.length > 0 && (() => {
        const cExp = sommeSerie(serieCumul, "export"), cImp = sommeSerie(serieCumul, "import");
        const cBal = cExp != null && cImp != null ? cExp - cImp : null;
        return (
          <div style={{ marginTop: 10, marginBottom: 20, padding: "9px 16px", background: "var(--ds-carte-douce)", border: "1px solid var(--ds-bordure)", borderRadius: "var(--rayon-md)", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Cumul {bmceMoisCourt(serieCumul[0].periode, false)} – {bmceMoisCourt(serieCumul[serieCumul.length - 1].periode, false)} {an}
            </span>
            <span className="ds-donnee" style={{ fontSize: 11.5, color: "#4a5568" }}>Exportations FAB&nbsp;: <b style={{ color: "#1a1a2e" }}>{fmtFCFA(cExp)}</b></span>
            <span className="ds-donnee" style={{ fontSize: 11.5, color: "#4a5568" }}>Importations CAF&nbsp;: <b style={{ color: "#1a1a2e" }}>{fmtFCFA(cImp)}</b></span>
            <span className="ds-donnee" style={{ fontSize: 11.5, color: "#4a5568" }}>Balance&nbsp;: <b style={{ color: (cBal ?? 0) < 0 ? "#dc2626" : "#1a1a2e" }}>{fmtFCFA(cBal)}</b></span>
          </div>
        );
      })()}
      {enCumul && <div style={{ marginBottom: 20 }} />}

      {/* Répartition par sens × catégorie */}
      <div className="ds-carte" style={{ padding: "18px 20px" }}>
        <p style={TITRE_SEC}>Répartition — {libPeriode}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={LBL_SEG}>Sens</span>
            {BMCE_SENS.map(o => (
              <button key={o.v} className="ds-chip" aria-pressed={sens === o.v} onClick={() => setSens(o.v)}>{o.l}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={LBL_SEG}>Catégorie</span>
            {BMCE_CATS.map(o => (
              <button key={o.v} className="ds-chip" aria-pressed={categorie === o.v} onClick={() => setCategorie(o.v)}>{o.l}</button>
            ))}
          </div>
        </div>

        {chargSeries ? (
          <SkeletonRows n={8} h={40} />
        ) : erreurSeries ? (
          <ErreurChargement compact onRetry={() => setTickSeries(t => t + 1)} />
        ) : derniers.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#9aa5b4", textAlign: "center", padding: "24px 0" }}>Aucune donnée pour cette sélection.</p>
        ) : (
          // Classement complet : chaque rubrique = libellé (au-dessus, jamais
          // tronqué) + jauge pleine largeur. Échelle en racine carrée pour que
          // les petites valeurs restent visibles face aux dominantes.
          <div style={{ display: "grid", gap: 2 }}>
            {derniers.map((r, i) => {
              const maxV = derniers[0].valeur || 1;
              const largeur = Math.max(1.5, Math.sqrt(Math.max(0, r.valeur) / maxV) * 100);
              return (
                <div key={r.libelle} style={{ padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid #F4F2F1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#3a4553", lineHeight: 1.3, flex: "1 1 auto", minWidth: 0 }}>{r.libelle}</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexShrink: 0 }}>
                      <span className="ds-donnee" style={{ fontSize: 12.5, fontWeight: 800, color: "#1a1a2e", whiteSpace: "nowrap" }}>{fmtFCFA(r.valeur)}</span>
                      <span className="ds-donnee" style={{ fontSize: 11, color: "#9aa5b4", whiteSpace: "nowrap", width: 48, textAlign: "right" }}>
                        {r.part != null ? `${r.part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : ""}
                      </span>
                      <span style={{ width: 80, textAlign: "right", flexShrink: 0 }}><BmceVariation v={r.variation} /></span>
                    </div>
                  </div>
                  <div style={{ height: 11, background: "var(--ds-voile-bleu)", borderRadius: 6, overflow: "hidden" }}>
                    <div title={`${r.libelle} : ${fmtFCFA(r.valeur)}${r.part != null ? ` · ${r.part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % du total` : ""}`}
                      style={{ width: `${largeur}%`, height: "100%", background: couleurSens, borderRadius: 6 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panneau Flux bilatéraux (données commerciales) ────────────────────────────
type OptionPaysCom = { id: number; nom: string; code_iso3: string | null; continent: string | null; region_geo: string | null };
// ── Modal « Tableau de données » des flux bilatéraux ──────────────────────────
function ModalDonneesCommerce({ open, onClose, selId, vue, nomPays, anneesTabs }: {
  open: boolean; onClose: () => void; selId: number | null; vue: "exportateur" | "importateur";
  nomPays: string; anneesTabs: number[];
}) {
  const [annee, setAnnee] = useState<number | null>(null);
  const [partenaires, setPartenaires] = useState<{ nom: string; total: number; lignes: { ressource: string; valeur: number }[] }[]>([]);
  const [charg, setCharg] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState(false); // échec d'export : message transitoire
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open && anneesTabs.length) setAnnee(anneesTabs[anneesTabs.length - 1]); }, [open, anneesTabs]);
  // Faire défiler l'onglet actif dans le champ de vision (l'année par défaut
  // est la dernière, sinon hors écran quand la période compte 20+ années)
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[data-actif="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [open, annee]);
  useEffect(() => {
    if (!open || !selId || annee == null) return;
    setCharg(true);
    fetch(`${API}/statistiques/commerce/detail?pays_id=${selId}&direction=${vue}&annee=${annee}`)
      .then(r => r.json()).then(d => setPartenaires(d.partenaires || []))
      .catch(() => setPartenaires([])).finally(() => setCharg(false));
  }, [open, selId, vue, annee]);

  if (!open) return null;
  const expDir = vue === "exportateur";
  const colSelf = expDir ? "Exportateur" : "Importateur";
  const colPart = expDir ? "Importateur" : "Exportateur";
  const totalRows = partenaires.reduce((s, p) => s + Math.max(1, p.lignes.length), 0);
  const grand = partenaires.reduce((s, p) => s + p.total, 0);
  const TH: any = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#fff", background: "#004f91", letterSpacing: "0.03em", textAlign: "left", position: "sticky", top: 0, zIndex: 2, whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.28)" };
  const cell: any = { border: "1px solid #E6E2DE", padding: "8px 14px", verticalAlign: "middle", fontSize: 12.5 };

  const exporterExcel = async () => {
    if (!selId) return;
    setExporting(true);
    try {
      // SheetJS chargé à la demande (~400 Ko) : uniquement au clic Export
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      // Récupération de toutes les années en parallèle (l'ordre des onglets
      // reste garanti : Promise.all conserve l'ordre du tableau d'entrée).
      const details = await Promise.all(anneesTabs.map(a =>
        fetch(`${API}/statistiques/commerce/detail?pays_id=${selId}&direction=${vue}&annee=${a}`).then(r => r.json())
      ));
      anneesTabs.forEach((a, idx) => {
        const parts: any[] = details[idx].partenaires || [];
        const aoa: any[][] = [[colSelf, colPart, "Ressource", "Valeur ($)"]];
        const merges: any[] = [];
        let r = 1; const startExp = r;
        parts.forEach(p => {
          const lignes = p.lignes.length ? p.lignes : [{ ressource: "—", valeur: 0 }];
          const startP = r;
          lignes.forEach((lg: any, li: number) => {
            aoa.push(["", li === 0 ? p.nom : "", lg.ressource, Math.round(lg.valeur)]);
            r++;
          });
          if (lignes.length > 1) merges.push({ s: { r: startP, c: 1 }, e: { r: r - 1, c: 1 } });
        });
        const endExp = r - 1;
        if (endExp >= startExp) { aoa[startExp][0] = nomPays; merges.push({ s: { r: startExp, c: 0 }, e: { r: endExp, c: 0 } }); }
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!merges"] = merges;
        ws["!cols"] = [{ wch: 22 }, { wch: 26 }, { wch: 32 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, String(a));
      });
      XLSX.writeFile(wb, `Flux_${nomPays.replace(/\s/g, "_")}_${expDir ? "exportations" : "importations"}.xlsx`);
    } catch { setExportErr(true); setTimeout(() => setExportErr(false), 5000); }
    setExporting(false);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 1000, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "#004f91", flexShrink: 0 }} />
        <div style={{ padding: "18px 28px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a2e", margin: 0 }}>Tableau de données</h2>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "3px 10px", borderRadius: 999 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#004f91" }} />{nomPays} · {expDir ? "Exportations" : "Importations"}</span>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8"; }} onMouseLeave={e => { e.currentTarget.style.background = "#F5F4F3"; }}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
          {/* Onglets années — défilement horizontal, onglet actif centré */}
          <div ref={tabsRef} style={{ display: "flex", gap: 4, borderBottom: "1px solid #F0EEEC", overflowX: "auto", scrollbarWidth: "thin" }}>
            {anneesTabs.map(a => {
              const on = a === annee;
              return (
                <button key={a} onClick={() => setAnnee(a)} data-actif={on ? "true" : "false"}
                  style={{ padding: "9px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: on ? 800 : 600, color: on ? "#004f91" : "#9aa5b4", borderBottom: on ? "2px solid #004f91" : "2px solid transparent", marginBottom: -1, fontFamily: "var(--font-google-sans)", flexShrink: 0 }}>
                  {a}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "0 28px 8px" }}>
          {charg ? (
            <div style={{ paddingTop: 12 }}><SkeletonRows n={9} h={36} /></div>
          ) : partenaires.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#9aa5b4", fontSize: 13 }}>Aucune donnée pour {annee}.</div>
          ) : (
            <table className="charge-in" style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, borderTopLeftRadius: 8 }}>{colSelf}</th>
                  <th style={TH}>{colPart}</th>
                  <th style={TH}>Ressource</th>
                  <th style={{ ...TH, textAlign: "right", borderTopRightRadius: 8, borderRight: "none" }}>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: any[] = [];
                  let firstOverall = true;
                  partenaires.forEach((p, pi) => {
                    const lignes = p.lignes.length ? p.lignes : [{ ressource: "—", valeur: 0 }];
                    const bg = pi % 2 === 0 ? "#fff" : "#FAFAF9";
                    lignes.forEach((lg, li) => {
                      rows.push(
                        <tr key={`${pi}-${li}`}>
                          {firstOverall && <td rowSpan={totalRows} style={{ ...cell, fontWeight: 800, color: "#004f91", textAlign: "center", background: "#F4F7FB", verticalAlign: "middle" }}>{nomPays}</td>}
                          {li === 0 && <td rowSpan={lignes.length} style={{ ...cell, fontWeight: 700, color: "#2d3540", verticalAlign: "middle", background: bg }} title={fmtUSD(p.total)}>{p.nom}</td>}
                          <td style={{ ...cell, color: "#4a5568", background: bg }}>{lg.ressource}</td>
                          <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#004f91", background: bg }} title={lg.valeur.toLocaleString("fr-FR") + " $"}>{fmtUSD(lg.valeur)}</td>
                        </tr>
                      );
                      firstOverall = false;
                    });
                  });
                  return rows;
                })()}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: "14px 28px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 10 }}>
          <span style={{ fontSize: 11.5, color: "#9aa5b4" }}>{partenaires.length} {colPart.toLowerCase()}s · total {fmtUSD(grand)} en {annee}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {exportErr && <span style={{ fontSize: 11.5, fontWeight: 600, color: "#dc2626" }}>Échec de l&apos;export — réessayez.</span>}
            <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #E4E1DE", background: "#fff", color: "#4a5568", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Fermer</button>
            <button onClick={exporterExcel} disabled={exporting}
              style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: exporting ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 3px 12px rgba(0,79,145,0.25)", fontFamily: "var(--font-google-sans)", opacity: exporting ? 0.7 : 1 }}>
              {exporting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <FileSpreadsheet size={13} />} Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const VUES_COM: { v: "exportateur" | "importateur"; l: string }[] = [
  { v: "exportateur", l: "Exportateur" },
  { v: "importateur", l: "Importateur" },
];
function CommercePanel() {
  const [vue, setVue] = useState<"exportateur" | "importateur">("exportateur");
  const [annees, setAnnees] = useState<number[]>([]);
  const [ressources, setRessources] = useState<{ nom_en: string; libelle: string }[]>([]);
  const [paysOpts, setPaysOpts] = useState<OptionPaysCom[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Barre latérale
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [searchPays, setSearchPays] = useState("");
  const [openConts, setOpenConts] = useState<Set<string>>(new Set());
  // Période
  const [modeAnnees, setModeAnnees] = useState<"plage" | "specifiques">("plage");
  const [bornes, setBornes] = useState<[number, number]>([2020, 2024]);
  const [anneeMin, setAnneeMin] = useState(2020);
  const [anneeMax, setAnneeMax] = useState(2024);
  const [anneesSpec, setAnneesSpec] = useState<number[]>([]);
  const [periodeTouchee, setPeriodeTouchee] = useState(false);
  // Période « stabilisée » : les fetchs attendent la fin du drag / des clics
  // rapides au lieu de partir en rafale à chaque tick de slider.
  const anneeMinD = useDebounced(anneeMin, 300);
  const anneeMaxD = useDebounced(anneeMax, 300);
  const anneesSpecD = useDebounced(anneesSpec, 300);
  // Ressources sélectionnées (nom_en)
  const [ressSel, setRessSel] = useState<string[]>([]);
  const [qRess, setQRess] = useState("");
  // Table
  const [lignes, setLignes] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [chargTable, setChargTable] = useState(false);
  const [kpis, setKpis] = useState<any>(null);
  const [chargKpis, setChargKpis] = useState(false);
  const [balance, setBalance] = useState<{ annee: number; exportations: number; importations: number; balance: number }[]>([]);
  const [tops, setTops] = useState<{ partenaires: { nom: string; valeur: number }[]; ressources: { ressource: string; valeur: number }[]; total: number } | null>(null);
  const [repart, setRepart] = useState<{ ressources: string[]; partenaires: { nom: string; total: number; valeurs: number[] }[] } | null>(null);
  const [showTable, setShowTable] = useState(false);
  const TAILLE = 50;

  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 220, 520);

  // Chargement principal : en cas d'échec, état d'erreur avec relance (tick)
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setLoading(true); setErreur(false);
    fetch(`${API}/statistiques/commerce/filtres`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => {
      const ann: number[] = (d.annees || []).slice().sort((a: number, b: number) => a - b);
      setAnnees(ann); setRessources(d.ressources || []); setPaysOpts(d.pays || []);
      setRessSel((d.ressources || []).map((r: any) => r.nom_en));
      if (ann.length) { setBornes([ann[0], ann[ann.length - 1]]); setAnneeMin(ann[0]); setAnneeMax(ann[ann.length - 1]); }
      const sen = (d.pays || []).find((p: any) => p.code_iso3 === "SEN");
      setSelId(sen ? sen.id : (d.pays && d.pays[0] ? d.pays[0].id : null));
    }).catch(() => setErreur(true)).finally(() => setLoading(false));
  }, [tick]);

  // KPIs agrégés (période + ressources, hors recherche texte)
  useEffect(() => {
    if (!selId) { setKpis(null); return; }
    setChargKpis(true);
    const p = new URLSearchParams({ pays_id: String(selId), direction: vue });
    if (modeAnnees === "specifiques") { if (anneesSpecD.length) p.set("annees", anneesSpecD.join(",")); }
    else { p.set("annee_min", String(anneeMinD)); p.set("annee_max", String(anneeMaxD)); }
    if (ressources.length && ressSel.length && ressSel.length < ressources.length) p.set("ressources", ressSel.join(","));
    fetch(`${API}/statistiques/commerce/kpis?${p.toString()}`)
      .then(r => r.json()).then(setKpis).catch(() => setKpis(null))
      .finally(() => setChargKpis(false));
  }, [vue, selId, modeAnnees, anneeMinD, anneeMaxD, anneesSpecD, ressSel, ressources.length]);

  // Balance commerciale (exp − imp) — indépendante de la vue
  useEffect(() => {
    if (!selId) { setBalance([]); return; }
    const p = new URLSearchParams({ pays_id: String(selId) });
    if (modeAnnees === "specifiques") { if (anneesSpecD.length) p.set("annees", anneesSpecD.join(",")); }
    else { p.set("annee_min", String(anneeMinD)); p.set("annee_max", String(anneeMaxD)); }
    if (ressources.length && ressSel.length && ressSel.length < ressources.length) p.set("ressources", ressSel.join(","));
    fetch(`${API}/statistiques/commerce/balance?${p.toString()}`)
      .then(r => r.json()).then(d => setBalance(Array.isArray(d) ? d : [])).catch(() => setBalance([]));
  }, [selId, modeAnnees, anneeMinD, anneeMaxD, anneesSpecD, ressSel, ressources.length]);

  // Tops (débouchés / ressources) — dépend de la direction (vue)
  useEffect(() => {
    if (!selId) { setTops(null); setRepart(null); return; }
    const p = new URLSearchParams({ pays_id: String(selId), direction: vue });
    if (modeAnnees === "specifiques") { if (anneesSpecD.length) p.set("annees", anneesSpecD.join(",")); }
    else { p.set("annee_min", String(anneeMinD)); p.set("annee_max", String(anneeMaxD)); }
    if (ressources.length && ressSel.length && ressSel.length < ressources.length) p.set("ressources", ressSel.join(","));
    fetch(`${API}/statistiques/commerce/tops?${p.toString()}`)
      .then(r => r.json()).then(setTops).catch(() => setTops(null));
    fetch(`${API}/statistiques/commerce/repartition?${p.toString()}`)
      .then(r => r.json()).then(setRepart).catch(() => setRepart(null));
  }, [vue, selId, modeAnnees, anneeMinD, anneeMaxD, anneesSpecD, ressSel, ressources.length]);

  const span = Math.max(1, bornes[1] - bornes[0]);
  const nbPages = Math.max(1, Math.ceil(total / TAILLE));
  const senId = useMemo(() => paysOpts.find(p => p.code_iso3 === "SEN")?.id ?? null, [paysOpts]);
  const selPays = paysOpts.find(p => p.id === selId);

  const groupedPays = useMemo(() => {
    const g: Record<string, Record<string, OptionPaysCom[]>> = {};
    paysOpts.filter(p => !searchPays || p.nom.toLowerCase().includes(searchPays.toLowerCase()))
      .forEach(p => {
        const c = p.continent || "Autre";
        const z = p.region_geo || "Autre";
        ((g[c] ||= {})[z] ||= []).push(p);
      });
    for (const c of Object.keys(g))
      for (const z of Object.keys(g[c]))
        g[c][z].sort((a, b) => { if (a.code_iso3 === "SEN") return -1; if (b.code_iso3 === "SEN") return 1; return a.nom.localeCompare(b.nom, "fr"); });
    return g;
  }, [paysOpts, searchPays]);
  useEffect(() => { if (searchPays) setOpenConts(new Set(Object.keys(groupedPays))); }, [searchPays, groupedPays]);

  const toggleCont = (c: string) => setOpenConts(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const toggleRess = (code: string) => setRessSel(prev => prev.includes(code) ? (prev.length > 1 ? prev.filter(c => c !== code) : prev) : [...prev, code]);

  const perLabel = modeAnnees === "specifiques" && anneesSpec.length > 0
    ? (anneesSpec.length === 1 ? `${anneesSpec[0]}` : `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;
  const anneesTabs = useMemo(() => annees.filter(a => modeAnnees === "specifiques"
    ? anneesSpec.includes(a) : (a >= anneeMin && a <= anneeMax)), [annees, modeAnnees, anneesSpec, anneeMin, anneeMax]);
  const paysChange = selId !== senId;
  const periodeChange = modeAnnees === "specifiques" ? anneesSpec.length > 0 : (anneeMin !== bornes[0] || anneeMax !== bornes[1]);
  const ressChange = ressources.length > 0 && ressSel.length !== ressources.length;
  const nbFiltres = (paysChange ? 1 : 0) + (periodeChange ? 1 : 0) + (ressChange ? 1 : 0);
  const reinit = () => {
    setSelId(senId); setModeAnnees("plage"); setAnneeMin(bornes[0]); setAnneeMax(bornes[1]);
    setAnneesSpec([]); setPeriodeTouchee(false); setRessSel(ressources.map(r => r.nom_en));
  };

  const LBL: any = { fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em" };
  const TH: any = { padding: "11px 16px", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6b7684", whiteSpace: "nowrap" };
  const TD: any = { padding: "10px 16px", verticalAlign: "middle" };
  const ressFiltrees = ressources.filter(r => !qRess || (r.libelle || r.nom_en).toLowerCase().includes(qRess.toLowerCase()));

  if (loading) return (
    <div style={{ padding: "32px 40px 80px", display: "grid", gap: 18 }}>
      <SkeletonKPIs n={5} />
      <SkeletonChartGrid n={2} cols={2} height={320} />
    </div>
  );
  if (erreur) return <ErreurChargement onRetry={() => setTick(t => t + 1)} />;
  if (!annees.length) return (
    <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Aucune donnée commerciale</p>
      <p style={{ fontSize: 14, marginTop: 6 }}>Les flux bilatéraux seront disponibles après import dans l&apos;administration.</p>
    </div>
  );

  return (
    <div className="charge-in" style={{ display: "flex", alignItems: "flex-start" }}>
      {/* ── Barre de filtre ── */}
      <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s", background: "#fff", borderRight: "1px solid #E8E5E3", height: "100vh", overflowY: "auto", position: "sticky", top: 0, display: "flex", flexDirection: "column" }}>
        {sidebarOpen && <div onMouseDown={startResize} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.5)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
        <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
          {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" }}>Filtres</span>}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setSidebarOpen(o => !o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
              <SlidersHorizontal size={14} style={{ color: "#004f91" }} />
              {sidebarOpen && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
            </button>
            {sidebarOpen && nbFiltres > 0 && <button onClick={reinit} title="Tout réinitialiser" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.20)", cursor: "pointer", borderRadius: 999, padding: "5px", display: "flex", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; }}>
              <X size={13} style={{ color: "#dc2626" }} />
            </button>}
          </div>
        </div>
        {sidebarOpen && <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
          {/* Vue */}
          <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #F2F0EF" }}>
            <p style={{ ...LBL, marginBottom: 8 }}>Vue</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {VUES_COM.map(o => (
                <button key={o.v} onClick={() => setVue(o.v)}
                  style={{ textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: vue === o.v ? 700 : 500, background: vue === o.v ? "rgba(0,79,145,0.08)" : "transparent", color: vue === o.v ? "#004f91" : "#4a5568", fontFamily: "var(--font-google-sans)" }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          {/* Recherche pays */}
          <div style={{ position: "relative", marginBottom: 18 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
            <input value={searchPays} onChange={e => setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
              style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
            {searchPays && <button onClick={() => setSearchPays("")} aria-label="Effacer la recherche" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
          </div>
          <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
          {/* Pays */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={LBL}>Pays</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.18)", padding: "1px 6px", borderRadius: 999 }}>1</span>
            </div>
            {/* Sénégal épinglé (référence) */}
            {senId !== null && (() => {
              const sel = selId === senId;
              return (
                <div style={{ marginBottom: 8, marginLeft: 6 }}>
                  <button onClick={() => setSelId(senId)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left", width: "100%" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? "#004f91" : "#C5BFBB"}`, background: sel ? "#004f91" : "transparent", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#4a5568", fontWeight: sel ? 700 : 400 }}>Sénégal</span>
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "#9aa5b4", fontWeight: 600, background: "#F2F0EF", padding: "1px 5px", borderRadius: 4 }}>Réf.</span>
                  </button>
                </div>
              );
            })()}
            <div style={{ height: 1, background: "#F2F0EF", marginBottom: 8 }} />
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {sortContinents(Object.keys(groupedPays)).map(continent => {
                const isOpen = openConts.has(continent);
                const zones = groupedPays[continent];
                return (
                  <div key={continent} style={{ marginBottom: 6 }}>
                    <button onClick={() => toggleCont(continent)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: 7, background: "rgba(0,79,145,0.04)", border: "none", cursor: "pointer", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", letterSpacing: "0.1em", textTransform: "uppercase" }}>{continent}</span>
                      <ChevronDown size={11} style={{ color: "#004f91", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                    </button>
                    {isOpen && Object.entries(zones).sort(([a], [b]) => a.localeCompare(b, "fr")).map(([zone, paysInZone]) => (
                      <div key={zone} style={{ marginLeft: 6, marginBottom: 4 }}>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "#C5BFBB", textTransform: "uppercase", letterSpacing: "0.1em", padding: "2px 8px", marginBottom: 2 }}>{zone}</p>
                        {paysInZone.map(p => {
                          const sel = selId === p.id;
                          if (p.id === senId) return (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, width: "100%", opacity: 0.35, cursor: "not-allowed" }}>
                              <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? "#004f91" : "#C5BFBB"}`, background: sel ? "#004f91" : "transparent", flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                              <span style={{ marginLeft: "auto", fontSize: 9, color: "#9aa5b4" }}>Réf.</span>
                            </div>
                          );
                          return (
                            <button key={p.id} onClick={() => setSelId(p.id)}
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left", width: "100%" }}
                              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#F8F7F6"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                              <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? "#004f91" : "#C5BFBB"}`, background: sel ? "#004f91" : "transparent", flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "#4a5568", fontWeight: sel ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
              {Object.keys(groupedPays).length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center", padding: "8px 0" }}>Aucun pays trouvé</p>}
            </div>
          </div>
          <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
          {/* Période */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={LBL}>Période</span>
            </div>
            <div style={{ display: "flex", gap: 3, background: "#F2F0EF", borderRadius: 9, padding: 3, marginBottom: 12 }}>
              {[{ v: "plage", l: "Plage" }, { v: "specifiques", l: "Années" }].map(m => (
                <button key={m.v} onClick={() => setModeAnnees(m.v as "plage" | "specifiques")}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: modeAnnees === m.v ? "#fff" : "transparent", color: modeAnnees === m.v ? "#1a1a2e" : "#9aa5b4", boxShadow: modeAnnees === m.v ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
                  {m.l}
                </button>
              ))}
            </div>
            {modeAnnees === "plage" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ position: "relative", height: 24, marginBottom: 2 }}>
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 4, background: "#E8E5E3", borderRadius: 2, transform: "translateY(-50%)" }} />
                  <div style={{ position: "absolute", top: "50%", left: `${((anneeMin - bornes[0]) / span) * 100}%`, width: `${Math.max(0, ((anneeMax - bornes[0]) / span) * 100 - ((anneeMin - bornes[0]) / span) * 100)}%`, height: 4, background: "#004f91", borderRadius: 2, transform: "translateY(-50%)" }} />
                  <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMin}
                    onChange={e => { setPeriodeTouchee(true); setAnneeMin(Math.min(+e.target.value, anneeMax)); }}
                    className="drs-thumb" style={{ zIndex: anneeMin >= anneeMax ? 4 : 2 } as any} />
                  <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMax}
                    onChange={e => { setPeriodeTouchee(true); setAnneeMax(Math.max(+e.target.value, anneeMin)); }}
                    className="drs-thumb" style={{ zIndex: 3 } as any} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "2px 8px", borderRadius: 6 }}>{anneeMin}</span>
                  <span style={{ fontSize: 10, color: "#9aa5b4" }}>—</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "2px 8px", borderRadius: 6 }}>{anneeMax}</span>
                </div>
                <p style={{ fontSize: 11, color: "#9aa5b4", textAlign: "center" }}>{anneeMax - anneeMin + 1} année{anneeMax - anneeMin + 1 > 1 ? "s" : ""}</p>
              </div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3, marginBottom: 8 }}>
                  {Array.from({ length: span + 1 }, (_, i) => bornes[0] + i).map(a => {
                    const sel = anneesSpec.includes(a);
                    return (
                      <button key={a} onClick={() => { setPeriodeTouchee(true); setAnneesSpec(prev => sel ? prev.filter(x => x !== a) : [...prev, a].sort()); }}
                        style={{ padding: "5px 0", borderRadius: 5, border: `1px solid ${sel ? "#004f91" : "#E8E5E3"}`, cursor: "pointer", fontSize: 10, fontWeight: sel ? 700 : 400, textAlign: "center", background: sel ? "#004f91" : "#F8F7F6", color: sel ? "#fff" : "#4a5568", transition: "all 0.1s" }}>
                        {a}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#4a5568" }}>{anneesSpec.length > 0 ? `${anneesSpec.length} année${anneesSpec.length > 1 ? "s" : ""}` : ""}</span>
                  {anneesSpec.length > 0 && <button onClick={() => setAnneesSpec([])} style={{ fontSize: 11, color: "#9aa5b4", background: "none", border: "none", cursor: "pointer" }}>Effacer</button>}
                </div>
              </div>
            )}
          </div>
        </div>}
      </aside>

      {/* ── Zone principale ── */}
      <div style={{ flex: 1, minWidth: 0, padding: "32px 40px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#004f91", flexShrink: 0 }} />
          <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "#1a1a2e", margin: 0 }}>{selPays?.nom || "—"}</h2>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, background: "rgba(0,79,145,0.08)", fontSize: 12, fontWeight: 700, color: "#004f91", flexShrink: 0 }}>{vue === "exportateur" ? "Exportations" : "Importations"}</span>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, background: "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.02em", flexShrink: 0 }}>{perLabel}</span>
          <button onClick={() => setShowTable(true)} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 999, border: "1px solid #E4E1DE", background: "#fff", color: "#004f91", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)", flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F5F4F3"; }} onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}>
            <Table size={14} /> Tableau de données
          </button>
        </div>

        {/* KPI cards — valeurs de la dernière année sélectionnée (sauf « Année record ») */}
        {(() => {
          const expDir = vue === "exportateur";
          const ref = kpis?.annee_ref;
          const enRef = ref ? `en ${ref}` : "";
          const cards = [
            { label: expDir ? "Total exportations" : "Total importations", sub: "Dernière année", value: fmtUSD(kpis?.total ?? null), indicatif: enRef, text: false },
            { label: "Année record", sub: "", value: kpis?.annee_record ? String(kpis.annee_record.annee) : "—", indicatif: kpis?.annee_record ? fmtUSD(kpis.annee_record.valeur) : "", text: false },
            { label: expDir ? `1er client · ${ref ?? "—"}` : `1er fournisseur · ${ref ?? "—"}`, sub: "", value: kpis?.top_partenaire?.nom || "—", indicatif: kpis?.top_partenaire ? `${fmtUSD(kpis.top_partenaire.valeur)} ${enRef}` : "", text: true },
            { label: `1re ressource · ${ref ?? "—"}`, sub: "", value: kpis?.top_ressource?.ressource || "—", indicatif: kpis?.top_ressource ? `${fmtUSD(kpis.top_ressource.valeur)} ${enRef}` : "", text: true },
            { label: expDir ? "Part du 1er débouché" : "Part du 1er fournisseur", sub: `Concentration · ${ref ?? "—"}`, value: kpis?.part_top_partenaire != null ? `${kpis.part_top_partenaire.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—", indicatif: kpis?.top_partenaire?.nom ? `${expDir ? "vers" : "depuis"} ${kpis.top_partenaire.nom}` : "", text: false },
          ];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20, opacity: chargKpis ? 0.5 : 1, transition: "opacity 0.15s" }}>
              {cards.map((c, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "13px 14px", border: "1px solid #ECEAE7", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", minWidth: 0 }}>
                  <div style={{ marginBottom: 7 }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", color: "#004f91", textTransform: "uppercase", lineHeight: 1.4 }}>{c.label}</p>
                    {c.sub && <p style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.06em", color: "#9aa5b4", textTransform: "uppercase", marginTop: 2, lineHeight: 1.3 }}>{c.sub}</p>}
                  </div>
                  <p title={c.text ? c.value : undefined} style={{ fontSize: c.text ? "0.95rem" : "1.15rem", fontWeight: 800, color: "#1a1a2e", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: c.text ? "normal" : "nowrap", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{c.value}</p>
                  {c.indicatif && <p style={{ fontSize: 10, color: "#9aa5b4", marginTop: 5, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.indicatif}</p>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Graphes */}
        {balance.length > 0 && (() => {
          const expDir = vue === "exportateur";
          const a0 = balance[0].annee, a1 = balance[balance.length - 1].annee;
          const balSerie = [{ nom: "Balance commerciale", couleur: "#004f91", data: balance.map(b => ({ annee: b.annee, valeur: b.balance })) }];
          const fluxSerie = [{ nom: expDir ? "Exportations" : "Importations", couleur: "#004f91", data: balance.map(b => ({ annee: b.annee, valeur: expDir ? b.exportations : b.importations })) }];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 20 }}>
              {/* 1. Évolution du total exporté / importé */}
              <GrapheCard titre={expDir ? "Évolution des exportations" : "Évolution des importations"} sous_titre={`Total · ${a0}–${a1}`} series={fluxSerie} grapheId={`stat_flux_${vue}_${selId}`} hideLegend
                fullChildren={<GrapheMultiPays series={fluxSerie} height={340} type="line" fmt={(v: number | null) => fmtUSD(v)} />}>
                <GrapheMultiPays series={fluxSerie} height={160} type="line" fmt={(v: number | null) => fmtUSD(v)} />
              </GrapheCard>
              {/* Balance commerciale (partagée) */}
              <GrapheCard titre="Balance commerciale" sous_titre={`Exportations − importations · ${a0}–${a1}`} series={balSerie} grapheId={`stat_balance_${selId}`} hideLegend
                fullChildren={<GrapheMultiPays series={balSerie} height={340} type="line" fmt={(v: number | null) => fmtUSD(v)} />}>
                <GrapheMultiPays series={balSerie} height={160} type="line" fmt={(v: number | null) => fmtUSD(v)} />
              </GrapheCard>
            </div>
          );
        })()}

        {/* 2 & 3. Top débouchés / origines & Top ressources */}
        {tops && (tops.partenaires.length > 0 || tops.ressources.length > 0) && (() => {
          const expDir = vue === "exportateur";
          const dataPart = tops.partenaires.map(p => ({ label: p.nom, valeur: p.valeur }));
          const dataRes = tops.ressources.map(r => ({ label: r.ressource, valeur: r.valeur }));
          const periode = modeAnnees === "specifiques" && anneesSpec.length > 0
            ? `${anneesSpec[0]}–${anneesSpec[anneesSpec.length - 1]}` : `${anneeMin}–${anneeMax}`;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 20 }}>
              <GrapheCard titre={expDir ? "Répartition des exportations par pays de destination" : "Répartition des importations par pays d'origine"} grapheId={`stat_top_part_${vue}_${selId}`} hideLegend
                fullChildren={<GrapheBarresH data={dataPart} fmt={(v) => fmtUSD(v)} rowH={40} />}>
                <GrapheBarresH data={dataPart.slice(0, 5)} fmt={(v) => fmtUSD(v)} />
              </GrapheCard>
              <GrapheCard titre={expDir ? "Classement des ressources exportées" : "Classement des ressources importées"} grapheId={`stat_top_res_${vue}_${selId}`} hideLegend
                fullChildren={<GrapheBarresH data={dataRes} fmt={(v) => fmtUSD(v)} rowH={40} />}>
                <GrapheBarresH data={dataRes.slice(0, 5)} fmt={(v) => fmtUSD(v)} />
              </GrapheCard>
            </div>
          );
        })()}

        {/* 4 & 5. Poids des ressources & Concentration */}
        {(() => {
          const expDir = vue === "exportateur";
          const periode = modeAnnees === "specifiques" && anneesSpec.length > 0
            ? `${anneesSpec[0]}–${anneesSpec[anneesSpec.length - 1]}` : `${anneeMin}–${anneeMax}`;
          // Poids des ressources : top 8 + « Autres »
          let donutData: { label: string; valeur: number }[] = [];
          if (tops && tops.ressources.length) {
            const top8 = tops.ressources.slice(0, 8);
            donutData = top8.map(r => ({ label: r.ressource, valeur: r.valeur }));
            const autres = (tops.total || 0) - top8.reduce((s, r) => s + r.valeur, 0);
            if (autres > 0.0001 && tops.ressources.length > 8) donutData.push({ label: "Autres", valeur: autres });
          }
          const parts = repart?.partenaires || [];
          const resLabels = repart?.ressources || [];
          if (!donutData.length && !parts.length) return null;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 20 }}>
              {donutData.length > 0 && (
                <GrapheCard titre={expDir ? "Poids des ressources exportées" : "Poids des ressources importées"} grapheId={`stat_poids_res_${vue}_${selId}`} hideLegend
                  fullChildren={<GrapheDonut data={donutData} fmt={(v) => fmtUSD(v)} height={360} />}>
                  <GrapheDonut data={donutData} fmt={(v) => fmtUSD(v)} />
                </GrapheCard>
              )}
              {parts.length > 0 && (
                <GrapheCard titre={expDir ? "Exportations par destination et ressource" : "Importations par origine et ressource"} sous_titre={`Cumul ${periode}`} grapheId={`stat_repart_${vue}_${selId}`} hideLegend
                  fullChildren={<GrapheBarresEmpilees partenaires={parts} ressources={resLabels} fmt={(v) => fmtUSD(v)} rowH={42} />}>
                  <GrapheBarresEmpilees partenaires={parts.slice(0, 5)} ressources={resLabels} fmt={(v) => fmtUSD(v)} showLegend={false} />
                </GrapheCard>
              )}
            </div>
          );
        })()}
      </div>
      <ModalDonneesCommerce open={showTable} onClose={() => setShowTable(false)} selId={selId} vue={vue}
        nomPays={selPays?.nom || "—"} anneesTabs={anneesTabs} />
    </div>
  );
}

// ── Graphe D3 (repris de la page IDE) ─────────────────────────────────────────

function GrapheMultiPays(props: {
  series: { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] }[];
  height?: number; type?: "line" | "bar"; titre?: string;
  fmt?: (v: number | null) => string; showDots?: boolean; lineWidth?: number;
}) {
  return <GrapheSignature {...props} fmt={props.fmt || fmtValGen} />;
}



// ── Définitions & interprétations des indicateurs ─────────────────────────────
const DEF_INDICATEUR: Record<string, string> = {
  population: "Nombre total d'habitants du pays au 1er juillet de l'année considérée.",
  superficie: "Superficie terrestre totale du pays, exprimée en kilomètres carrés.",
  densite: "Nombre moyen d'habitants par kilomètre carré (population ÷ superficie).",
  pib: "Produit intérieur brut : valeur totale des biens et services produits sur une année, en dollars courants.",
  pib_hab: "PIB rapporté au nombre d'habitants (PIB ÷ population), en dollars courants.",
  croissance_pib: "Taux de croissance annuel du PIB réel, en pourcentage.",
  importations_marchandises: "Valeur totale des marchandises importées sur l'année, en dollars.",
  exportations_marchandises: "Valeur totale des marchandises exportées sur l'année, en dollars.",
  importations_services: "Valeur totale des services importés sur l'année, en dollars.",
  exportations_services: "Valeur totale des services exportés sur l'année, en dollars.",
  balance_marchandises: "Solde du commerce de marchandises (exportations − importations).",
  balance_services: "Solde du commerce de services (exportations − importations).",
};

function MiniModalKpi({ kpi, pays, couleur, onClose }: { kpi: { ind: Indicateur; valeur: number | null; annee: number; precedent: number | null } | null; pays: string; couleur: string; onClose: () => void }) {
  if (!kpi) return null;
  const { ind, valeur, annee, precedent } = kpi;
  const def = DEF_INDICATEUR[ind.code] || `${ind.libelle} — ${ind.unite}.`;
  let variation: number | null = null;
  if (valeur !== null && precedent !== null && precedent !== 0) variation = ((valeur - precedent) / Math.abs(precedent)) * 100;
  const isPos = variation !== null && variation > 0.05;
  const isNeg = variation !== null && variation < -0.05;
  const signalColor = couleur;
  const interpret = (() => {
    if (valeur === null) return "Donnée non disponible pour cet indicateur sur la période sélectionnée.";
    const val = fmt(valeur, ind.unite);
    if (variation === null) return `En ${annee}, ${pays} affiche ${val} pour l'indicateur « ${ind.libelle} ».`;
    const sens = isPos ? "en hausse" : isNeg ? "en baisse" : "stable";
    const pct = `${variation > 0 ? "+" : ""}${variation.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
    return `En ${annee}, ${pays} affiche ${val} (${sens} de ${pct} par rapport à l'année précédente) pour l'indicateur « ${ind.libelle} ».`;
  })();
  const trendColor = isPos ? "#188038" : isNeg ? "#dc2626" : "#9aa5b4";
  const trendBg = isPos ? "rgba(24,128,56,0.06)" : isNeg ? "rgba(220,38,38,0.05)" : "#FAFAF9";
  const trendBorder = isPos ? "rgba(24,128,56,0.18)" : isNeg ? "rgba(220,38,38,0.18)" : "#F0EEEC";
  const SecTitle = ({ children }: { children: any }) => (
    <p style={{ fontSize: 10.5, fontWeight: 700, color: "#004f91", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{children}</p>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "#004f91", flexShrink: 0 }} />
        <div style={{ padding: "18px 28px 16px", borderBottom: "1px solid #F2F0EF", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a2e", margin: 0, lineHeight: 1.35 }}>{ind.libelle}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: couleur, background: `${couleur}12`, border: `1px solid ${couleur}30` }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: couleur, display: "inline-block" }} />{pays}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "#4a5568", background: "#F5F4F3" }}>{ind.unite}</span>
                {variation !== null && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: trendColor, background: trendBg, border: `1px solid ${trendBorder}` }}>{isPos ? "Positif" : isNeg ? "Négatif" : "Stable"}</span>
                )}
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "#4a5568", background: "#F5F4F3" }}>{annee}</span>
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8"; }} onMouseLeave={e => { e.currentTarget.style.background = "#F5F4F3"; }}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>
        <div style={{ padding: "22px 28px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <SecTitle>Valeur</SecTitle>
            <div style={{ background: trendBg, border: `1px solid ${trendBorder}`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: "2.2rem", fontWeight: 800, color: signalColor, lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(valeur, ind.unite)}</span>
              <span style={{ fontSize: 13, color: "#9aa5b4", fontWeight: 500 }}>en {annee}</span>
            </div>
          </div>
          <div>
            <SecTitle>Interprétation</SecTitle>
            <div style={{ background: "#FAFAF9", border: "1px solid #F0EEEC", borderRadius: 12, padding: "14px 18px" }}>
              <p style={{ fontSize: 13, color: "#1a1a2e", lineHeight: 1.75 }}>{interpret}</p>
            </div>
          </div>
          <div>
            <SecTitle>Définition</SecTitle>
            <p style={{ fontSize: 12, color: "#9aa5b4", lineHeight: 1.65 }}>{def}</p>
          </div>
        </div>
        <div style={{ padding: "14px 28px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #E4E1DE", background: "#fff", color: "#4a5568", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ── Export Excel du tableau de données ────────────────────────────────────────
async function exportXLSXStat(donnees: Donnee[], indicateurs: Indicateur[], paysSelectionnes: { id: number; nom: string }[], annees: number[], periode: string) {
  // SheetJS chargé à la demande (~400 Ko) : uniquement au clic Export
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const val = (pid: number, code: string, a: number) =>
    donnees.find(d => d.pays_id === pid && d.indicateur === code && d.annee === a)?.valeur ?? null;
  paysSelectionnes.forEach(p => {
    const header = ["Indicateur", "Unité", ...annees.map(String)];
    const rows: (string | number | null)[][] = [header];
    indicateurs.forEach(ind => {
      const row: (string | number | null)[] = [ind.libelle, ind.unite];
      annees.forEach(a => { const v = val(p.id, ind.code, a); row.push(v !== null && v !== undefined ? Number(v) : null); });
      rows.push(row);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = rows[0].map((_, ci) => { const maxLen = Math.max(...rows.map(r => String(r[ci] ?? "").length)); return { wch: Math.min(Math.max(maxLen + 2, 12), 50) }; });
    XLSX.utils.book_append_sheet(wb, ws, p.nom.slice(0, 31));
  });
  XLSX.writeFile(wb, `Statistiques_${paysSelectionnes.map(p => p.nom.replace(/\s/g, "_")).join("_")}_${periode}.xlsx`);
}

// ── Modal « Tableau de données » ──────────────────────────────────────────────
function ModalDonnees({ open, onClose, donnees, indicateurs, paysSelectionnes, annees }: {
  open: boolean; onClose: () => void; donnees: Donnee[]; indicateurs: Indicateur[];
  paysSelectionnes: { id: number; nom: string; couleur: string }[]; annees: number[];
}) {
  if (!open) return null;
  const periode = annees.length ? `${annees[0]}_${annees[annees.length - 1]}` : "all";
  const val = (pid: number, code: string, a: number) =>
    donnees.find(d => d.pays_id === pid && d.indicateur === code && d.annee === a)?.valeur ?? null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,20,38,0.45)", backdropFilter: "blur(8px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 1200, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,30,60,0.28)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "#004f91", flexShrink: 0 }} />
        <div style={{ padding: "18px 28px 16px", borderBottom: "1px solid #F2F0EF", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a2e", margin: 0, lineHeight: 1.35, flexShrink: 0 }}>Tableau de données</h2>
                {annees.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, background: "#ECEAE8", border: "1px solid #DFDBD7", fontSize: 10.5, fontWeight: 700, color: "#3a4452", letterSpacing: "0.02em", flexShrink: 0 }}>{annees[0]} — {annees[annees.length - 1]}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap", minWidth: 0 }}>
                {paysSelectionnes.map(p => (
                  <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: `${p.couleur}0D`, border: `1px solid ${p.couleur}2E`, fontSize: 10.5, fontWeight: 700, color: p.couleur }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.couleur, display: "inline-block", flexShrink: 0 }} />{p.nom}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: "50%", background: "#F5F4F3", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#ECEAE8"; }} onMouseLeave={e => { e.currentTarget.style.background = "#F5F4F3"; }}>
              <X size={15} color="#4a5568" />
            </button>
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ background: "#FAFAF9" }}>
                <th style={{ padding: "11px 28px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#4a5568", letterSpacing: "0.1em", textTransform: "uppercase", position: "sticky", left: 0, background: "#FAFAF9", borderRight: "1px solid #F0EEEC", borderBottom: "1px solid #F0EEEC", whiteSpace: "nowrap", minWidth: 200 }}>Indicateur</th>
                {annees.map(a => <th key={a} style={{ padding: "11px 12px", fontSize: 10, fontWeight: 800, color: "#4a5568", letterSpacing: "0.06em", textAlign: "right", minWidth: 90, borderBottom: "1px solid #F0EEEC" }}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {paysSelectionnes.map(pays => (
                <Fragment key={pays.id}>
                  <tr>
                    <td colSpan={annees.length + 1} style={{ padding: "12px 28px 6px", background: "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: pays.couleur, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: pays.couleur }}>{pays.nom}</span>
                      </div>
                    </td>
                  </tr>
                  {indicateurs.map((ind, si) => (
                    <tr key={`${pays.id}-${ind.code}`}
                      style={{ borderBottom: si === indicateurs.length - 1 ? "1px solid #ECEAE7" : "1px solid #F6F4F3", background: "#fff", transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#FAFAF9"}
                      onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                      <td style={{ padding: "9px 28px 9px 44px", position: "sticky", left: 0, background: "inherit", borderRight: "1px solid #F0EEEC", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 500 }}>{ind.libelle} <span style={{ color: "#9aa5b4", fontSize: 11 }}>· {ind.unite}</span></span>
                      </td>
                      {annees.map(a => {
                        const v = val(pays.id, ind.code, a);
                        const display = v !== null && v !== undefined ? fmt(v, ind.unite) : "—";
                        const color = v === null || v === undefined ? "#C5BFBB" : (ind.unite === "%" && v < 0) ? "#dc2626" : "#4a5568";
                        return (
                          <td key={a} style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, color, fontWeight: v !== null && v !== undefined ? 600 : 400, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{display}</td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "14px 28px", borderTop: "1px solid #F2F0EF", background: "#FCFBFA", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 10 }}>
          <span style={{ fontSize: 11, color: "#9aa5b4" }}>{paysSelectionnes.length} pays · {indicateurs.length} indicateurs · {annees.length} années</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #E4E1DE", background: "#fff", color: "#4a5568", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Fermer</button>
            <button onClick={() => exportXLSXStat(donnees, indicateurs, paysSelectionnes, annees, periode)}
              style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#004f91", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 3px 12px rgba(0,79,145,0.25)", fontFamily: "var(--font-google-sans)" }}>
              <FileSpreadsheet size={13} /> Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bouton « Tableau de données » responsive (plein → « Données » → icône) ─────
function BoutonDonnees({ onClick, dep }: { onClick: () => void; dep?: any }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<"full" | "court" | "icone">("full");
  useEffect(() => {
    const btn = ref.current; const parent = btn?.parentElement;
    if (!btn || !parent) return;
    const calc = () => {
      let used = 0;
      Array.from(parent.children).forEach(ch => { if (ch !== btn) used += (ch as HTMLElement).offsetWidth + 8; });
      const avail = parent.clientWidth - used;
      setMode(avail >= 185 ? "full" : avail >= 112 ? "court" : "icone");
    };
    const raf = requestAnimationFrame(calc);
    const ro = new ResizeObserver(calc); ro.observe(parent);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [dep]);
  return (
    <button ref={ref} onClick={onClick} title="Tableau de données"
      style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: mode === "icone" ? 0 : 7, padding: mode === "icone" ? "8px 10px" : "8px 16px", borderRadius: 999, border: "1px solid #E4E1DE", background: "#fff", color: "#004f91", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)", flexShrink: 0, whiteSpace: "nowrap" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#F5F4F3"; }} onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}>
      <Table size={14} />{mode !== "icone" && <span>{mode === "full" ? "Tableau de données" : "Données"}</span>}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StatistiquesPage() {
  const [mode, setMode] = useEtatUrl<"indicateurs" | "commerce" | "exterieur">("mode", "indicateurs", ["indicateurs","commerce","exterieur"]);
  const [vue, setVue] = useEtatUrl<"pays" | "comparative">("vue", "pays", ["pays","comparative"]);
  const [pays, setPays] = useState<Pays[]>([]);
  const [indicateurs, setIndicateurs] = useState<Indicateur[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [donnees, setDonnees] = useState<Donnee[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiActif, setKpiActif] = useState<{ ind: Indicateur; valeur: number | null; annee: number; precedent: number | null } | null>(null);
  const [showTable, setShowTable] = useState(false);
  // Barre latérale
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [searchPays, setSearchPays] = useState("");
  const [openConts, setOpenConts] = useState<Set<string>>(new Set());
  // Période
  const [modeAnnees, setModeAnnees] = useState<"plage" | "specifiques">("plage");
  const [bornes, setBornes] = useState<[number, number]>([2019, 2023]);
  const [anneeMin, setAnneeMin] = useState(2019);
  const [anneeMax, setAnneeMax] = useState(2023);
  const [anneesSpec, setAnneesSpec] = useState<number[]>([]);
  const [periodeTouchee, setPeriodeTouchee] = useState(false);
  // KPI (indicateurs épinglés)
  const [kpisEpingles, setKpisEpingles] = useState<string[]>([]);

  const MAX_SEL = 4; // 4 pays au plus en comparaison (comme la page IDE)
  const multi = vue !== "pays";
  const senId = useMemo(() => pays.find(p => p.code_iso3 === "SEN")?.id ?? null, [pays]);

  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 220, 520);

  // Chargement principal : en cas d'échec, état d'erreur avec relance (tick)
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setLoading(true); setErreur(false);
    Promise.all([
      fetch(`${API}/statistiques/pays`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${API}/statistiques/indicateurs`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    ]).then(([p, i]) => {
      setPays(p || []); setIndicateurs(i || []);
      const sen = (p || []).find((x: Pays) => x.code_iso3 === "SEN");
      if (sen) setSelection([sen.id]);
    }).catch(() => setErreur(true)).finally(() => setLoading(false));
  }, [tick]);

  // Par défaut : Population, Superficie, Densité, PIB, PIB/hab (dans la limite de 5)
  useEffect(() => {
    if (!indicateurs.length) return;
    const codes = indicateurs.map(i => i.code);
    const def = KPI_DEFAUT.filter(c => codes.includes(c)).slice(0, MAX_KPI);
    setKpisEpingles(def.length ? def : codes.slice(0, MAX_KPI));
  }, [indicateurs]);

  useEffect(() => {
    if (!selection.length) { setDonnees([]); return; }
    fetch(`${API}/statistiques/donnees?pays=${selection.join(",")}`).then(r => r.json()).then(setDonnees).catch(() => {});
  }, [selection]);

  // Bornes d'années d'après les données réellement disponibles
  const anneesDispo = useMemo(() => [...new Set(donnees.map(d => d.annee))].filter(a => a > 0).sort((a, b) => a - b), [donnees]);
  useEffect(() => {
    if (!anneesDispo.length) return;
    const mn = anneesDispo[0], mx = anneesDispo[anneesDispo.length - 1];
    setBornes([mn, mx]);
    if (!periodeTouchee) { setAnneeMin(mn); setAnneeMax(mx); }
  }, [anneesDispo, periodeTouchee]);

  // en passant de comparative→pays, ne garder qu'un pays (Sénégal en priorité)
  useEffect(() => {
    if (!multi && selection.length > 1) setSelection([selection.includes(senId as number) ? (senId as number) : selection[0]]);
  }, [multi]);

  const toggleCont = (c: string) => setOpenConts(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const toggleEpingle = (code: string) => setKpisEpingles(prev => prev.includes(code) ? prev.filter(c => c !== code) : (prev.length >= MAX_KPI ? prev : [...prev, code]));

  const clickPays = (id: number) => {
    if (!multi) { setSelection([id]); return; }
    setSelection(prev => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter(x => x !== id) : prev;
      if (prev.length >= MAX_SEL) return prev;
      return [...prev, id];
    });
  };

  const groupedPays = useMemo(() => {
    const g: Record<string, Record<string, Pays[]>> = {};
    pays.filter(p => !searchPays || p.nom.toLowerCase().includes(searchPays.toLowerCase()))
      .forEach(p => {
        const c = p.continent || "Autre";
        const z = p.region_geo || "Autre";
        ((g[c] ||= {})[z] ||= []).push(p);
      });
    for (const c of Object.keys(g))
      for (const z of Object.keys(g[c]))
        g[c][z].sort((a, b) => { if (a.nom === "Sénégal") return -1; if (b.nom === "Sénégal") return 1; return a.nom.localeCompare(b.nom, "fr"); });
    return g;
  }, [pays, searchPays]);
  useEffect(() => { if (searchPays) setOpenConts(new Set(Object.keys(groupedPays))); }, [searchPays, groupedPays]);

  const paysNom = (id: number) => pays.find(p => p.id === id)?.nom || "";
  const couleurPays = (id: number) => PALETTE[selection.indexOf(id) % PALETTE.length];
  const span = Math.max(1, bornes[1] - bornes[0]);
  const anneesActives = useMemo(() => (
    modeAnnees === "specifiques"
      ? anneesDispo.filter(a => anneesSpec.includes(a))
      : anneesDispo.filter(a => a >= anneeMin && a <= anneeMax)
  ), [anneesDispo, modeAnnees, anneesSpec, anneeMin, anneeMax]);
  const refAnnee = anneesActives[anneesActives.length - 1] ?? anneeMax;
  const indicateursAffiches = indicateurs.filter(i => kpisEpingles.includes(i.code));

  const valeur = (paysId: number, code: string, annee: number) =>
    donnees.find(d => d.pays_id === paysId && d.indicateur === code && d.annee === annee)?.valeur ?? null;

  // État des filtres (pour badge + réinitialisation)
  const paysChange = multi ? (selection.length > 1 || selection[0] !== senId) : selection[0] !== senId;
  const periodeChange = modeAnnees === "specifiques" ? anneesSpec.length > 0 : (anneeMin !== bornes[0] || anneeMax !== bornes[1]);
  const kpiDefautSet = KPI_DEFAUT.filter(c => indicateurs.some(i => i.code === c)).slice(0, MAX_KPI);
  const kpiChange = kpisEpingles.length !== kpiDefautSet.length || kpisEpingles.some(c => !kpiDefautSet.includes(c));
  const nbFiltres = (paysChange ? 1 : 0) + (periodeChange ? 1 : 0) + (kpiChange ? 1 : 0);
  const hasFilter = nbFiltres > 0;
  const reinit = () => {
    setSelection(senId ? [senId] : []); setModeAnnees("plage");
    setAnneeMin(bornes[0]); setAnneeMax(bornes[1]); setAnneesSpec([]);
    setPeriodeTouchee(false); setKpisEpingles(kpiDefautSet.length ? kpiDefautSet : indicateurs.map(i => i.code).slice(0, MAX_KPI));
  };

  const LBL: any = { fontSize: 11, fontWeight: 700, color: "#9aa5b4", textTransform: "uppercase", letterSpacing: "0.1em" };

  // d3 est chargé dans un chunk séparé : on attend qu'il soit prêt avant de
  // rendre quoi que ce soit qui dessine (les données, elles, se chargent en parallèle)
  const d3Pret = useD3Pret();
  if (!d3Pret) return <main style={{ minHeight: "100vh", background: "#F6F5F3" }}/>;

  return (
    <main style={{ minHeight: "100vh", background: "#F6F5F3", fontFamily: "var(--font-google-sans)" }}>
      <div id="d3-tooltip" style={{ position: "fixed", pointerEvents: "none", background: "rgba(26,26,46,0.92)", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12, lineHeight: 1.5, opacity: 0, zIndex: 9999, backdropFilter: "blur(4px)" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.drs-thumb{-webkit-appearance:none;appearance:none;background:transparent;height:24px;margin:0;padding:0;position:absolute;top:0;left:0;width:100%;pointer-events:none}
.drs-thumb::-webkit-slider-runnable-track{background:transparent;height:4px}
.drs-thumb::-moz-range-track{background:transparent;height:4px}
.drs-thumb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all;margin-top:-6px}
.drs-thumb::-moz-range-thumb{background:#004f91;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,79,145,0.35);cursor:pointer;height:16px;width:16px;pointer-events:all}`}</style>
      <BarreTitre titre="Échanges commerciaux" compact actions={<NavActions onDark home flouFond/>}>
        <BarreTitreSegment options={[
          { v: "indicateurs", l: "Indicateurs économiques" },
          { v: "commerce", l: "Flux bilatéraux" },
          { v: "exterieur", l: "Commerce extérieur", badge: "SEN" },
        ]} value={mode} onChange={setMode} />
      </BarreTitre>

      {mode === "exterieur" ? (
        <CommerceExterieurPanel />
      ) : mode === "commerce" ? (
        <CommercePanel />
      ) : (
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {/* ── Barre de filtre ── */}
        <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s", background: "#fff", borderRight: "1px solid #E8E5E3", height: "100vh", overflowY: "auto", position: "sticky", top: 0, display: "flex", flexDirection: "column" }}>
          <style>{`::-webkit-scrollbar-thumb{background:#E8E5E3}::-webkit-scrollbar-thumb:hover{background:#C5BFBB}`}</style>
          {sidebarOpen && <div onMouseDown={startResize} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.5)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
          <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid #F2F0EF", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
            {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", letterSpacing: "0.08em", textTransform: "uppercase" }}>Filtres</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setSidebarOpen(o => !o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background: "rgba(0,79,145,0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
                <SlidersHorizontal size={14} style={{ color: "#004f91" }} />
                {sidebarOpen && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
              </button>
              {sidebarOpen && hasFilter && <button onClick={reinit} title="Tout réinitialiser" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.20)", cursor: "pointer", borderRadius: 999, padding: "5px", display: "flex", alignItems: "center" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; }}>
                <X size={13} style={{ color: "#dc2626" }} />
              </button>}
            </div>
          </div>
          {sidebarOpen && <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
            {/* Vue */}
            <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #F2F0EF" }}>
              <p style={{ ...LBL, marginBottom: 8 }}>Vue</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {VUES.map(o => (
                  <button key={o.v} onClick={() => setVue(o.v)}
                    style={{ textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: vue === o.v ? 700 : 500, background: vue === o.v ? "rgba(0,79,145,0.08)" : "transparent", color: vue === o.v ? "#004f91" : "#4a5568", fontFamily: "var(--font-google-sans)" }}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            {/* Recherche pays */}
            <div style={{ position: "relative", marginBottom: 18 }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
              <input value={searchPays} onChange={e => setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
                style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
              {searchPays && <button onClick={() => setSearchPays("")} aria-label="Effacer la recherche" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
            </div>
            <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
            {/* Pays */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={LBL}>Pays</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: multi && selection.length >= MAX_SEL ? "#004f91" : "#004f91", background: "rgba(0,79,145,0.18)", padding: "1px 6px", borderRadius: 999 }}>{multi ? `${selection.length}/${MAX_SEL}` : "1"}</span>
              </div>
              {/* Sénégal épinglé (référence) */}
              {senId !== null && (() => {
                const sel = selection.includes(senId);
                const col = sel ? couleurPays(senId) : "#C5BFBB";
                const removable = multi && sel && selection.length > 1;
                const canAdd = multi && !sel && selection.length < MAX_SEL;
                return (
                  <div style={{ marginBottom: 8, marginLeft: 6 }}>
                    <button onClick={() => { if (!multi) setSelection([senId]); else if (removable) setSelection(prev => prev.filter(x => x !== senId)); else if (canAdd) setSelection(prev => [...prev, senId]); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left", width: "100%" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#F8F7F6"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? col : "#C5BFBB"}`, background: sel ? col : "transparent", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#4a5568", fontWeight: sel ? 700 : 400 }}>Sénégal</span>
                      <span style={{ marginLeft: "auto", fontSize: 9, color: "#9aa5b4", fontWeight: 600, background: "#F2F0EF", padding: "1px 5px", borderRadius: 4 }}>Réf.</span>
                    </button>
                  </div>
                );
              })()}
              <div style={{ height: 1, background: "#F2F0EF", marginBottom: 8 }} />
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {sortContinents(Object.keys(groupedPays)).map(continent => {
                  const isOpen = openConts.has(continent);
                  const zones = groupedPays[continent];
                  return (
                    <div key={continent} style={{ marginBottom: 6 }}>
                      <button onClick={() => toggleCont(continent)}
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: 7, background: "rgba(0,79,145,0.04)", border: "none", cursor: "pointer", marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", letterSpacing: "0.1em", textTransform: "uppercase" }}>{continent}</span>
                        <ChevronDown size={11} style={{ color: "#004f91", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                      </button>
                      {isOpen && Object.entries(zones).sort(([a], [b]) => a.localeCompare(b, "fr")).map(([zone, paysInZone]) => (
                        <div key={zone} style={{ marginLeft: 6, marginBottom: 4 }}>
                          <p style={{ fontSize: 9, fontWeight: 600, color: "#C5BFBB", textTransform: "uppercase", letterSpacing: "0.1em", padding: "2px 8px", marginBottom: 2 }}>{zone}</p>
                          {paysInZone.map(p => {
                            const sel = selection.includes(p.id);
                            const col = sel ? couleurPays(p.id) : "#C5BFBB";
                            const disabled = multi && !sel && selection.length >= MAX_SEL;
                            if (p.id === senId) return (
                              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, width: "100%", opacity: 0.35, cursor: "not-allowed" }}>
                                <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? col : "#C5BFBB"}`, background: sel ? col : "transparent", flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                                <span style={{ marginLeft: "auto", fontSize: 9, color: "#9aa5b4" }}>Réf.</span>
                              </div>
                            );
                            return (
                              <button key={p.id} onClick={() => clickPays(p.id)}
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: disabled ? "not-allowed" : "pointer", background: "transparent", textAlign: "left", width: "100%", opacity: disabled ? 0.4 : 1 }}
                                onMouseEnter={e => { if (!disabled && !sel) e.currentTarget.style.background = "#F8F7F6"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? col : "#C5BFBB"}`, background: sel ? col : "transparent", flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: "#4a5568", fontWeight: sel ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {Object.keys(groupedPays).length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center", padding: "8px 0" }}>Aucun pays trouvé</p>}
              </div>
            </div>
            <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
            {/* Période */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <span style={LBL}>Période</span>
              </div>
              <div style={{ display: "flex", gap: 3, background: "#F2F0EF", borderRadius: 9, padding: 3, marginBottom: 12 }}>
                {[{ v: "plage", l: "Plage" }, { v: "specifiques", l: "Années" }].map(m => (
                  <button key={m.v} onClick={() => setModeAnnees(m.v as "plage" | "specifiques")}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: modeAnnees === m.v ? "#fff" : "transparent", color: modeAnnees === m.v ? "#1a1a2e" : "#9aa5b4", boxShadow: modeAnnees === m.v ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
                    {m.l}
                  </button>
                ))}
              </div>
              {modeAnnees === "plage" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ position: "relative", height: 24, marginBottom: 2 }}>
                    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 4, background: "#E8E5E3", borderRadius: 2, transform: "translateY(-50%)" }} />
                    <div style={{ position: "absolute", top: "50%", left: `${((anneeMin - bornes[0]) / span) * 100}%`, width: `${Math.max(0, ((anneeMax - bornes[0]) / span) * 100 - ((anneeMin - bornes[0]) / span) * 100)}%`, height: 4, background: "#004f91", borderRadius: 2, transform: "translateY(-50%)" }} />
                    <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMin}
                      onChange={e => { setPeriodeTouchee(true); setAnneeMin(Math.min(+e.target.value, anneeMax)); }}
                      className="drs-thumb" style={{ zIndex: anneeMin >= anneeMax ? 4 : 2 } as any} />
                    <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMax}
                      onChange={e => { setPeriodeTouchee(true); setAnneeMax(Math.max(+e.target.value, anneeMin)); }}
                      className="drs-thumb" style={{ zIndex: 3 } as any} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "2px 8px", borderRadius: 6 }}>{anneeMin}</span>
                    <span style={{ fontSize: 10, color: "#9aa5b4" }}>—</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "2px 8px", borderRadius: 6 }}>{anneeMax}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#9aa5b4", textAlign: "center" }}>{anneeMax - anneeMin + 1} année{anneeMax - anneeMin + 1 > 1 ? "s" : ""}</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3, marginBottom: 8 }}>
                    {Array.from({ length: span + 1 }, (_, i) => bornes[0] + i).map(a => {
                      const sel = anneesSpec.includes(a);
                      return (
                        <button key={a} onClick={() => { setPeriodeTouchee(true); setAnneesSpec(prev => sel ? prev.filter(x => x !== a) : [...prev, a].sort()); }}
                          style={{ padding: "5px 0", borderRadius: 5, border: `1px solid ${sel ? "#004f91" : "#E8E5E3"}`, cursor: "pointer", fontSize: 10, fontWeight: sel ? 700 : 400, textAlign: "center", background: sel ? "#004f91" : "#F8F7F6", color: sel ? "#fff" : "#4a5568", transition: "all 0.1s" }}>
                          {a}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#4a5568" }}>{anneesSpec.length > 0 ? `${anneesSpec.length} année${anneesSpec.length > 1 ? "s" : ""}` : ""}</span>
                    {anneesSpec.length > 0 && <button onClick={() => setAnneesSpec([])} style={{ fontSize: 11, color: "#9aa5b4", background: "none", border: "none", cursor: "pointer" }}>Effacer</button>}
                  </div>
                </div>
              )}
            </div>
            <div style={{ height: 1, background: "#F2F0EF", marginBottom: 18 }} />
            {/* KPI */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={LBL}>Key Performance Indicators</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: kpisEpingles.length >= MAX_KPI ? "#004f91" : "#9aa5b4", background: kpisEpingles.length >= MAX_KPI ? "rgba(0,79,145,0.08)" : "#F2F0EF", padding: "2px 8px", borderRadius: 999 }}>{kpisEpingles.length}/{MAX_KPI}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 240, overflowY: "auto" }}>
                {indicateurs.map(ind => {
                  const epingle = kpisEpingles.includes(ind.code);
                  const disabled = !epingle && kpisEpingles.length >= MAX_KPI;
                  return (
                    <div key={ind.code} title={ind.libelle}
                      onClick={() => { if (!disabled) toggleEpingle(ind.code); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, background: "transparent", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.3 : 1, transition: "background 0.1s" }}
                      onMouseEnter={ev => { ev.currentTarget.style.background = "#F8F7F6"; }}
                      onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${epingle ? "#004f91" : "#C5BFBB"}`, background: epingle ? "#004f91" : "transparent", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#4a5568", flex: 1, minWidth: 0, lineHeight: 1.35, fontWeight: epingle ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ind.libelle}</span>
                      {refAnnee ? <span style={{ fontSize: 9, color: "#9aa5b4", fontWeight: 600, background: "#F2F0EF", padding: "1px 5px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0 }}>{refAnnee}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>}
        </aside>

        {/* Zone principale */}
        <div style={{ flex: 1, minWidth: 0, padding: "32px 40px 80px" }}>
          {loading ? (
            <div style={{ display: "grid", gap: 18 }}>
              <SkeletonKPIs n={5} />
              <SkeletonChartGrid n={2} cols={2} height={320} />
            </div>
          ) : erreur ? (
            <ErreurChargement onRetry={() => setTick(t => t + 1)} />
          ) : !selection.length ? (
            <div style={{ textAlign: "center", padding: "80px 24px", color: "#9aa5b4" }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4a5568" }}>Sélectionnez un pays</p>
              <p style={{ fontSize: 14, marginTop: 6 }}>Choisissez un ou plusieurs pays dans la barre de filtre pour explorer leurs statistiques.</p>
            </div>
          ) : (
            <div className="charge-in">
              {/* ── Analyse par pays ── */}
              {vue === "pays" && (() => {
                const perLabel = modeAnnees === "specifiques" && anneesSpec.length > 0
                  ? `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length - 1]}`
                  : `${anneeMin} — ${anneeMax}`;
                // Graphes : indicateurs épinglés (hors superficie) + les 4 flux de
                // commerce extérieur, toujours présents s'ils ont des données.
                const TRADE_CODES = ["importations_marchandises", "exportations_marchandises", "importations_services", "exportations_services"];
                const aDesDonnees = (code: string) => anneesActives.some(a => valeur(selection[0], code, a) !== null);
                const baseCodes = indicateursAffiches.filter(i => i.code !== "superficie").map(i => i.code);
                const codesGraphes = [...baseCodes, ...TRADE_CODES.filter(c => !baseCodes.includes(c) && aDesDonnees(c))];
                const graphIndics = codesGraphes.map(c => indicateurs.find(i => i.code === c)).filter(Boolean) as Indicateur[];
                return (
                <>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#004f91", flexShrink: 0 }} />
                      <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "#1a1a2e" }}>{paysNom(selection[0])}</h2>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, background: "linear-gradient(160deg,#003a6e 0%,#004f91 60%,#1a6ab0 100%)", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.02em", flexShrink: 0 }}>{perLabel}</span>
                    </div>
                    <BoutonDonnees onClick={() => setShowTable(true)} dep={selection[0]} />
                  </div>

                  {/* KPI cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
                    {indicateursAffiches.map(ind => {
                      const v = valeur(selection[0], ind.code, refAnnee);
                      const prec = valeur(selection[0], ind.code, refAnnee - 1);
                      return (
                        <div key={ind.code} onClick={() => setKpiActif({ ind, valeur: v, annee: refAnnee, precedent: prec })}
                          style={{ background: "#fff", borderRadius: 14, padding: "13px 14px", border: "1px solid #ECEAE7", cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", minWidth: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,30,60,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(0,79,145,0.25)"; }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "#ECEAE7"; }}>
                          <div style={{ marginBottom: 7 }}>
                            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", lineHeight: 1.4 }}>{ind.libelle}</p>
                            <p style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.06em", color: "#9aa5b4", textTransform: "uppercase", marginTop: 2, lineHeight: 1.3 }}>Dernière année</p>
                          </div>
                          <p style={{ fontSize: "1.15rem", fontWeight: 800, color: ind.unite === "%" && v !== null && v < 0 ? "#dc2626" : "#1a1a2e", lineHeight: 1 }}>{fmt(v, ind.unite)}</p>
                          <p style={{ fontSize: 10, color: "#9aa5b4", marginTop: 5, lineHeight: 1 }}>en {refAnnee}</p>
                        </div>
                      );
                    })}
                    {Array.from({ length: Math.max(0, MAX_KPI - indicateursAffiches.length) }).map((_, i) => (
                      <div key={`empty-${i}`} style={{ background: "#fff", borderRadius: 14, padding: "13px 14px", border: "1.5px dashed #E8E5E3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 90 }}>
                        <span style={{ fontSize: 20, color: "#C5BFBB", lineHeight: 1 }}>+</span>
                        <span style={{ fontSize: 10, color: "#C5BFBB", textAlign: "center", lineHeight: 1.5 }}>Choisir dans<br />le filtre</span>
                      </div>
                    ))}
                  </div>

                  {/* Graphes */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                    {graphIndics.map(ind => {
                      const serie = [{ nom: paysNom(selection[0]), couleur: "#004f91", data: anneesActives.map(a => ({ annee: a, valeur: valeur(selection[0], ind.code, a) })) }];
                      return (
                        <GrapheCard key={ind.code} titre={ind.libelle} sous_titre={`${ind.unite} · ${anneesActives[0] ?? anneeMin}–${refAnnee}`} series={serie} grapheId={`stat_${ind.code}`}
                          fullChildren={<GrapheMultiPays series={serie} height={340} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} />}>
                          <GrapheMultiPays series={serie} height={145} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} />
                        </GrapheCard>
                      );
                    })}
                  </div>
                </>
                );
              })()}

              {/* ── Analyse comparative ── */}
              {vue === "comparative" && (() => {
                const perLabel = modeAnnees === "specifiques" && anneesSpec.length > 0
                  ? (anneesSpec.length === 1 ? `${anneesSpec[0]}` : `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length - 1]}`)
                  : `${anneeMin} — ${anneeMax}`;
                // Mêmes graphes que la vue Pays : indicateurs épinglés (hors superficie)
                // + les 4 flux de commerce extérieur, dès qu'un pays sélectionné a des données.
                const TRADE_CODES = ["importations_marchandises", "exportations_marchandises", "importations_services", "exportations_services"];
                const aDesDonnees = (code: string) => selection.some(id => anneesActives.some(a => valeur(id, code, a) !== null));
                const baseCodes = indicateursAffiches.filter(i => i.code !== "superficie").map(i => i.code);
                const codesGraphes = [...baseCodes, ...TRADE_CODES.filter(c => !baseCodes.includes(c) && aDesDonnees(c))];
                const graphIndics = codesGraphes.map(c => indicateurs.find(i => i.code === c)).filter(Boolean) as Indicateur[];
                return (
                <>
                  {/* Header : période + pastilles pays */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "nowrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 13px", borderRadius: 999, background: "#ECEAE8", border: "1px solid #DFDBD7", fontSize: 12, fontWeight: 700, color: "#3a4452", letterSpacing: "0.02em", flexShrink: 0 }}>{perLabel}</span>
                    {selection.map(id => (
                      <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 999, background: `${couleurPays(id)}0D`, border: `1px solid ${couleurPays(id)}2E`, fontSize: 12, fontWeight: 700, color: couleurPays(id), flexShrink: 0, whiteSpace: "nowrap" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: couleurPays(id), display: "inline-block" }} />{paysNom(id)}
                      </span>
                    ))}
                    <BoutonDonnees onClick={() => setShowTable(true)} dep={selection.join(",")} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                    {graphIndics.map(ind => {
                      const series = selection.map(id => ({ nom: paysNom(id), couleur: couleurPays(id), data: anneesActives.map(a => ({ annee: a, valeur: valeur(id, ind.code, a) })) }));
                      return (
                        <GrapheCard key={ind.code} titre={ind.libelle} sous_titre={`${ind.unite} · ${anneesActives[0] ?? anneeMin}–${refAnnee}`} series={series} grapheId={`stat_cmp_${ind.code}`} hideLegend
                          fullChildren={<GrapheMultiPays series={series} height={340} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} lineWidth={1.6} />}>
                          <GrapheMultiPays series={series} height={145} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} showDots={false} lineWidth={1.4} />
                        </GrapheCard>
                      );
                    })}
                  </div>
                </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      )}

      <MiniModalKpi kpi={kpiActif} pays={kpiActif ? paysNom(selection[0]) : ""} couleur="#004f91" onClose={() => setKpiActif(null)} />
      <ModalDonnees open={showTable} onClose={() => setShowTable(false)} donnees={donnees} indicateurs={indicateurs}
        paysSelectionnes={selection.map(id => ({ id, nom: paysNom(id), couleur: couleurPays(id) }))} annees={anneesActives} />
    </main>
  );
}