"use client";
import GrapheSignature from "@/components/shared/GrapheMultiPays";
import { SkeletonKPIs, SkeletonChartGrid, SkeletonRows } from "@/components/shared/Skeleton";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fmtUnite as fmt, fmtMFCFA, fmtTonnes } from "@/lib/format";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, FileSpreadsheet, Loader2, Search, X } from "lucide-react";
import { ACCENT_BLEU, StylesCurseurNace, pastilleCurseur, varsAccent, CurseurAnneeNace as CurseurAnneeCommun, CurseurPlageNace } from "@/components/shared/CurseurNace";
import { badge_bleu, badge_orange } from "@/lib/couleurs";
import { API, NACE_BLEU, NACE_ORANGE } from "./partage";
import { useDonnees } from "@/lib/donnees";
import Variation from "@/components/shared/Variation";


// ── Panneau Commerce extérieur (Sénégal uniquement) ──────────────────────────
// Refonte en cours : ce module sera alimenté par les Notes d'Analyse du
// Commerce Extérieur (NACE) de l'ANSD — rapports annuels (2019 à 2024).
// L'ancienne version (Bulletin mensuel / API /bmce) a été retirée.

// État d'attente : affiché tant qu'aucune donnée NACE n'a été importée.
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
          Ce module est en cours de refonte sur la base des Notes d'Analyse du Commerce Extérieur
          (NACE) de l'ANSD. Les indicateurs seront disponibles ici après l'import des rapports annuels.
        </p>
      </div>
    </div>
  );
}

// ── Panneau Commerce extérieur (NACE) ────────────────────────────────────────
// Alimenté par les principaux produits des annexes NACE (API /nace) :
// chaque année est résolue côté backend avec l'édition la plus récente
// qui la couvre, libellés ramenés à la nomenclature courante.
type NaceLigne = { produit: string; annee: number; valeur: number | null; poids: number | null; edition: number };
type NaceData = { disponible: boolean; annees: number[]; editions: number[]; donnees: { export: NaceLigne[]; import: NaceLigne[] } };
type NaceMesure = "valeur" | "poids";


// Cellule d'une statistique d'intervalle. L'année accompagne le minimum et le
// maximum : sans elle, on saurait qu'un creux a eu lieu sans savoir quand,
// ce qui est justement ce qu'on cherche en lisant plusieurs années.
// « 16 395,8 Md FCFA » et « 303,9 Md FCFA · 2018 » sont les gabarits les plus
// larges : les colonnes sont dimensionnées dessus, faute de quoi les nombres se
// chevauchent d'une colonne à l'autre.
const L_SOMME = 106, L_MOY = 98, L_EXT = 130;
function CelluleStat({ v, an, fmt, large, attenue }: {
  v: number | null; an?: number | null; fmt: (x: number | null) => string; large: number; attenue?: boolean;
}) {
  return (
    <span className="ds-donnee" style={{ width: large, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap",
      fontVariantNumeric: "tabular-nums", fontSize: 10.5, fontWeight: 700, color: attenue ? "var(--gris)" : "var(--texte)" }}>
      {v == null ? "—" : fmt(v)}
      {v != null && an != null && <span style={{ color: "var(--gris)", fontWeight: 650 }}> · {an}</span>}
    </span>
  );
}
// Variation en CELLULE DE TABLEAU : le triangle y reste, faute de place pour
// une icône, et parce que des dizaines de lignes alignées se lisent mieux avec
// un signe de largeur fixe. Les cartes KPI, elles, utilisent <Variation>.
function VariationNace({ v }: { v: number | null }) {
  if (v == null || !isFinite(v)) return <span style={{ fontSize: 10.5, color: "var(--gris)" }}>—</span>;
  const pos = v > 0, neg = v < 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 800, color: pos ? "var(--vert)" : neg ? "var(--danger)" : "var(--gris)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {pos ? "▲" : neg ? "▼" : "="}&nbsp;{Math.abs(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
    </span>
  );
}

// Familles de l'annexe partageant la même forme : une modalité × un sens ×
// une année, avec valeur (millions FCFA) et poids net (tonnes).
type NaceLigneCle = { annee: number; valeur: number | null; poids: number | null; edition: number };
type NaceDataGU = { disponible: boolean; annees: number[]; editions: number[];
  donnees: { export: (NaceLigneCle & { groupe: string })[]; import: (NaceLigneCle & { groupe: string })[] } };
type NaceDataCont = { disponible: boolean; annees: number[]; editions: number[];
  donnees: { export: (NaceLigneCle & { continent: string })[]; import: (NaceLigneCle & { continent: string })[] } };
type NaceDataChap = { disponible: boolean; annees: number[]; editions: number[];
  donnees: { export: (NaceLigneCle & { chapitre: string })[]; import: (NaceLigneCle & { chapitre: string })[] } };

// ── Tableau de classement, partagé par les deux volets d'analyse ──────────────
// Produits et zones géographiques se lisent de la même façon : un classement
// du sens affiché, avec part, part cumulée, variation annuelle et balance. Le
// rendu est donc mis en commun, pour que les deux sections ne puissent pas
// divulguer entre elles.
type LigneClassement = {
  cle: string; nom: string; iso2?: string | null; parent?: string | null;
  v: number | null; p: number | null;              // sens affiché
  vAutre: number | null; pAutre: number | null;    // sens opposé, pour la balance
  vPrec: number | null; pPrec: number | null;      // année n-1, pour la variation
  sv?: Stats | null; sp?: Stats | null;            // moyenne/min/max, en intervalle
  libelles?: number;                               // > 1 : ligne agrégée
  ouvrable?: boolean;                              // descend d'un niveau au clic
};

// Somme tolérante aux trous : le rapport imprime « - » pour une absence
// d'échange, que l'API rend en null. null + null reste null (donnée absente),
// null + valeur vaut la valeur.
const sommeNace = (a: number | null | undefined, b: number | null | undefined) =>
  a == null && b == null ? null : (a ?? 0) + (b ?? 0);

// ── Période d'analyse ────────────────────────────────────────────────────────
// Chaque section se lit soit sur une année, soit sur un intervalle résumé par
// un calcul. Les deux modes tiennent dans un seul objet, pour qu'une section
// n'ait qu'un état de période et une seule commande.
type Periode = { debut: number; fin: number; intervalle: boolean };
const MODES_PERIODE: { v: "annee" | "intervalle"; l: string }[] = [
  { v: "annee", l: "Année" }, { v: "intervalle", l: "Intervalle" },
];
const estIntervalle = (p: Periode) => p.intervalle;
const anneeSeule = (a: number): Periode => ({ debut: a, fin: a, intervalle: false });

// Résumé d'une série annuelle sur l'intervalle. Les quatre statistiques sont
// calculées d'un coup et affichées ensemble : le classement se lit sur la
// somme, et les trois autres colonnes disent comment cette somme s'est faite —
// un total tiré par une seule année exceptionnelle ne se lit pas comme un
// courant régulier.
//
// La moyenne divise par le nombre d'années COUVERTES par l'intervalle, et non
// par le nombre d'années où la modalité a échangé : le rapport imprime « - »
// pour une absence d'échange, ce qui est un zéro réel et non une donnée
// manquante. Un partenaire présent deux années sur dix a bien une moyenne
// annuelle faible sur la décennie.
//
// Le minimum et le maximum, eux, ne portent que sur les années renseignées :
// un « minimum de 0 » sur une année sans échange ne dirait rien, et l'année
// affichée à côté serait arbitraire.
type Stats = { somme: number | null; moyenne: number | null; mediane: number | null;
               min: number | null; anMin: number | null;
               max: number | null; anMax: number | null };
const VIDE: Stats = { somme: null, moyenne: null, mediane: null, min: null, anMin: null, max: null, anMax: null };
function statistiquesPeriode(serie: Map<number, number | null>, per: Periode, annees: Set<number>): Stats {
  let somme: number | null = null;
  let min: number | null = null, anMin: number | null = null;
  let max: number | null = null, anMax: number | null = null;
  for (const [annee, v] of serie) {
    if (v == null || annee < per.debut || annee > per.fin) continue;
    somme = (somme ?? 0) + v;
    if (min == null || v < min) { min = v; anMin = annee; }
    if (max == null || v > max) { max = v; anMax = annee; }
  }
  if (somme == null) return VIDE;
  // Moyenne et médiane décrivent toutes deux le niveau annuel courant : elles
  // portent donc sur la MÊME population, les années couvertes par l'intervalle,
  // une année sans échange comptant pour zéro. Les prendre sur des populations
  // différentes rendrait leur écart illisible.
  const valeurs = [...annees].map(a => serie.get(a) ?? 0).sort((x, y) => x - y);
  const n = valeurs.length, mi = n >> 1;
  return {
    somme, moyenne: n > 0 ? somme / n : null,
    mediane: n === 0 ? null : n % 2 ? valeurs[mi] : (valeurs[mi - 1] + valeurs[mi]) / 2,
    min, anMin, max, anMax,
  };
}

// Indexe une famille par modalité sur la période, en sommant d'abord les
// doublons de chaque année (deux libellés du rapport visant la même modalité).
// `v`/`p` portent la valeur qui classe : celle de l'année en lecture annuelle,
// la somme de l'intervalle sinon. `sv`/`sp` ne sont renseignés qu'en
// intervalle, où ils alimentent les colonnes Moyenne, Min et Max.
// `serie` porte le détail annuel. L'affichage ne s'en sert pas — il ne montre
// que le résumé — mais l'export Excel en fait une colonne par année, ce qui est
// la matière première d'une analyse plus poussée.
type AgrNace = { v: number | null; p: number | null; sv: Stats | null; sp: Stats | null;
                 serie: { v: Map<number, number | null>; p: Map<number, number | null> } };
function indexerNace<T extends { annee: number; valeur: number | null; poids: number | null }>(
  lignes: T[], cle: (r: T) => string, per: Periode,
): Map<string, AgrNace> {
  const series = new Map<string, { v: Map<number, number | null>; p: Map<number, number | null> }>();
  const annees = new Set<number>();
  for (const r of lignes) {
    if (r.annee < per.debut || r.annee > per.fin) continue;
    annees.add(r.annee);
    const k = cle(r);
    let s = series.get(k);
    if (!s) { s = { v: new Map(), p: new Map() }; series.set(k, s); }
    s.v.set(r.annee, sommeNace(s.v.get(r.annee), r.valeur));
    s.p.set(r.annee, sommeNace(s.p.get(r.annee), r.poids));
  }
  const m = new Map<string, AgrNace>();
  for (const [k, s] of series) {
    if (!per.intervalle) {
      m.set(k, { v: s.v.get(per.fin) ?? null, p: s.p.get(per.fin) ?? null, sv: null, sp: null, serie: s });
      continue;
    }
    const sv = statistiquesPeriode(s.v, per, annees), sp = statistiquesPeriode(s.p, per, annees);
    m.set(k, { v: sv.somme, p: sp.somme, sv, sp, serie: s });
  }
  return m;
}

function TableauClassementNace({ lignes, agregeSous, sens, mesure, colonne, drapeaux, top,
  entete, nomPortee, totalLibelle, onOuvrir, montrerParent, libelleParent, balance = true,
  granularite, uniteBascule, actions, periode, totalPeriode }: {
  lignes: LigneClassement[];
  // Libellé de la ligne fourre-tout à épingler hors classement, s'il y en a
  // une : « Autres pays » pour les zones, « Autres produits » pour les
  // nomenclatures. Ce n'est pas une modalité, elle n'a donc pas de rang.
  agregeSous?: string;
  sens: ZoneSens; mesure: NaceMesure; colonne: string;
  drapeaux?: boolean; top: number;
  // La balance n'a de sens que si la nomenclature liste les MÊMES modalités
  // dans les deux sens. C'est le cas des zones géographiques, des groupes
  // d'utilisation et des chapitres SH, mais pas des paniers de produits que
  // l'ANSD compose séparément par direction (1 libellé commun sur 13 export /
  // 11 import pour les principaux produits, 3 sur 31/56 pour les regroupés) :
  // l'y afficher reviendrait à prétendre qu'un produit importé n'est pas
  // exporté du tout, alors qu'il porte simplement un autre nom à l'export.
  balance?: boolean;
  entete?: React.ReactNode;          // fil d'Ariane, ou rien
  nomPortee: string;                 // ce sur quoi porte le classement
  totalLibelle: string;              // libellé de la ligne de somme
  onOuvrir?: (l: LigneClassement) => void;
  montrerParent?: boolean; libelleParent?: (p: string) => string;
  // Bascules portées par le tableau lui-même — granularité (nomenclature ou
  // niveau géographique) et unité de mesure — plutôt que par l'en-tête de
  // section : ce sont des réglages de lecture du tableau, pas de la section,
  // qui ne garde que le sens des échanges et l'année.
  granularite?: React.ReactNode; uniteBascule?: React.ReactNode; actions?: React.ReactNode;
  periode: Periode;
  // Statistiques de la portée entière : la moyenne, le minimum et le maximum
  // du total ne se déduisent pas des lignes — la somme des minima n'est le
  // minimum de rien, les modalités n'atteignant pas leur creux la même année.
  // L'appelant les calcule donc comme les lignes, mais sur la portée entière.
  totalPeriode?: AgrNace;
}) {
  const [q, setQ] = useState("");
  const [tout, setTout] = useState(false);
  // La prise de focus sur la recherche déplie la liste entière : on cherche
  // aussi bien dans les lignes déjà visibles que dans celles au-delà du top,
  // et la saisie ne fait que resserrer.
  const [focus, setFocus] = useState(false);
  useEffect(() => { setQ(""); setTout(false); }, [nomPortee, colonne, sens, mesure, lignes.length]);

  const couleur = sens === "export" ? NACE_BLEU : NACE_ORANGE;
  const fmtV = mesure === "valeur" ? fmtMFCFA : fmtTonnes;
  const mv = (l: LigneClassement) => (mesure === "valeur" ? l.v : l.p) ?? 0;
  // En intervalle, le classement se lit sur la somme et les colonnes de droite
  // deviennent Moyenne, Min et Max : part et cumul restent valides (la somme
  // est additive) mais la variation « vs n-1 » n'a plus de terme de comparaison,
  // et les trois nouvelles colonnes prennent la place des deux premières.
  const intervalle = estIntervalle(periode);
  const statDe = (l: LigneClassement) => (mesure === "valeur" ? l.sv : l.sp) ?? null;
  // La balance disparaît en intervalle : les quatre statistiques suffisent, et
  // en ajouter une cinquième colonne d'une autre nature chargerait la lecture.
  const colBalance = balance && !intervalle;

  const rangees = lignes.filter(l => l.nom !== agregeSous).sort((x, y) => mv(y) - mv(x));
  const agregee = agregeSous ? lignes.find(l => l.nom === agregeSous) ?? null : null;
  // Le total est celui de la portée affichée, pour que « Part » et « Cumul »
  // restent interprétables après une descente ou un changement de famille.
  const total = lignes.reduce((s, l) => s + Math.max(0, mv(l)), 0);
  const statTotal = totalPeriode ? (mesure === "valeur" ? totalPeriode.sv : totalPeriode.sp) : null;

  // La balance commerciale est TOUJOURS exportations − importations, quel que
  // soit le sens affiché : la définir par rapport à la colonne visible ferait
  // passer le Nigeria de −308 Md à +308 Md au simple basculement de la vue,
  // alors que le déficit sénégalais avec lui ne bouge pas. C'est aussi la
  // convention du KPI « Balance commerciale (FAB − CAF) » de l'en-tête.
  const balanceDe = (l: LigneClassement) => {
    const affiche = mv(l), oppose = (mesure === "valeur" ? l.vAutre : l.pAutre) ?? 0;
    return sens === "export" ? affiche - oppose : oppose - affiche;
  };
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtres = q ? rangees.filter(l => norm(l.nom).includes(norm(q)) || norm(l.parent ?? "").includes(norm(q))) : rangees;
  const visibles = q || tout || focus ? filtres : filtres.slice(0, top);

  // Rang et cumul se lisent sur la liste rangée complète, pas sur la portion
  // visible : une recherche ne doit pas renuméroter les lignes ni fausser le
  // cumul. Une seule passe, indexée par clé.
  const rangDe = new Map<string, number>();
  const cumulDe = new Map<string, number>();
  { let c = 0; rangees.forEach((l, i) => { c += Math.max(0, mv(l)); rangDe.set(l.cle, i + 1); cumulDe.set(l.cle, c); }); }

  const EN_TETE: React.CSSProperties = { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" };
  const Ligne = ({ l, rang }: { l: LigneClassement; rang: number | null }) => {
    const vPrec = mesure === "valeur" ? l.vPrec : l.pPrec;
    const delta = vPrec != null && vPrec !== 0 ? ((mv(l) - vPrec) / Math.abs(vPrec)) * 100 : null;
    const bal = balanceDe(l);
    const podium = rang != null && rang <= 3;
    const epingle = rang == null;
    const ouvrable = !!(l.ouvrable && onOuvrir);
    return (
      <div onClick={ouvrable ? () => onOuvrir!(l) : undefined}
        role={ouvrable ? "button" : undefined} tabIndex={ouvrable ? 0 : undefined}
        // Entrée et Espace équivalent au clic : la ligne porte role="button",
        // elle doit en honorer le contrat clavier. preventDefault retient le
        // défilement que déclencherait Espace.
        onKeyDown={ouvrable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOuvrir!(l); } } : undefined}
        title={ouvrable ? `Voir le détail de « ${l.nom} »` : undefined}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8,
          cursor: ouvrable ? "pointer" : "default", transition: "background .12s",
          background: epingle ? "var(--champ)" : rang != null && rang % 2 === 0 ? "var(--carte-douce)" : "transparent" }}
        onMouseEnter={e => { if (ouvrable) e.currentTarget.style.background = "var(--bleu-voile)"; }}
        onMouseLeave={e => { if (ouvrable) e.currentTarget.style.background = rang != null && rang % 2 === 0 ? "var(--carte-douce)" : "transparent"; }}>
        <span style={{ width: 24, flexShrink: 0 }}>
          {rang != null && (
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 3px", borderRadius: 10,
              background: podium ? couleur : "var(--sur-bleu)", color: podium ? "var(--sur-bleu)" : "var(--gris)", fontSize: 10, fontWeight: 800 }}>{rang}</span>
          )}
        </span>
        {drapeaux && (epingle
          ? <span style={{ width: 20, flexShrink: 0, textAlign: "center", fontSize: 13, lineHeight: 1 }}>🌐</span>
          : <DrapeauPays iso={l.iso2} nom={l.nom} />)}
        <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "baseline", gap: 7 }}>
          <span title={l.nom} style={{ fontSize: 12.5, fontWeight: epingle ? 600 : 650, fontStyle: epingle ? "italic" : "normal",
            color: epingle ? "var(--gris)" : "var(--encre)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nom}</span>
          {epingle && l.libelles != null && l.libelles > 1 &&
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gris)", flexShrink: 0 }}>({l.libelles})</span>}
          {!epingle && montrerParent && l.parent && (
            <span title={l.parent} style={{ fontSize: 9.5, fontWeight: 700, color: "var(--gris)", whiteSpace: "nowrap", flexShrink: 0 }}>
              {libelleParent ? libelleParent(l.parent) : l.parent}
            </span>
          )}
          {ouvrable && <ChevronRight size={12} style={{ color: "var(--gris)", flexShrink: 0 }} />}
        </span>
        <span className="ds-donnee" style={{ width: intervalle ? L_SOMME : 88, fontSize: 11.5, fontWeight: 800, color: epingle ? "var(--gris)" : couleur, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtV(mv(l))}</span>
        {intervalle ? <>
          <CelluleStat v={statDe(l)?.moyenne ?? null} fmt={fmtV} large={L_MOY} attenue={epingle} />
          <CelluleStat v={statDe(l)?.mediane ?? null} fmt={fmtV} large={L_MOY} attenue={epingle} />
          <CelluleStat v={statDe(l)?.min ?? null} an={statDe(l)?.anMin ?? null} fmt={fmtV} large={L_EXT} attenue={epingle} />
          <CelluleStat v={statDe(l)?.max ?? null} an={statDe(l)?.anMax ?? null} fmt={fmtV} large={L_EXT} attenue={epingle} />
        </> : <>
          <span style={{ width: 38, fontSize: 10, fontWeight: 700, color: epingle ? "var(--gris)" : "var(--texte)", textAlign: "right", flexShrink: 0 }}>
            {total > 0 ? `${(Math.max(0, mv(l)) / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—"}
          </span>
          <span style={{ width: 40, fontSize: 10, fontWeight: 650, color: "var(--gris)", textAlign: "right", flexShrink: 0 }}>
            {rang != null && total > 0 ? `${((cumulDe.get(l.cle) ?? 0) / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %` : ""}
          </span>
          <span style={{ width: 58, textAlign: "right", flexShrink: 0 }}><VariationNace v={delta} /></span>
        </>}
        {colBalance && (
          <span className="ds-donnee" style={{ width: 92, fontSize: 11, fontWeight: 800, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
            color: bal > 0 ? "var(--vert)" : bal < 0 ? "var(--danger)" : "var(--gris)" }}>
            {bal > 0 ? "+" : bal < 0 ? "−" : ""}{fmtV(Math.abs(bal))}
          </span>
        )}
      </div>
    );
  };

  if (!lignes.length) return null;
  return (
    <div className="ds-carte" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Barre d'outils du tableau : granularité et fil d'Ariane à gauche,
          unité de mesure à droite */}
      {(granularite || entete || uniteBascule || actions) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {granularite}
          {entete}
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
            {uniteBascule}{actions}
          </span>
        </div>
      )}

      {/* Recherche : utile dès que la portée dépasse la vingtaine de lignes */}
      {rangees.length > 20 && (
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--gris)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…"
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            style={{ width: "100%", paddingLeft: 30, paddingRight: 28, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: "1px solid var(--bordure-forte)", background: "var(--carte-douce)", fontSize: 12, color: "var(--encre)", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
          {q && <button onMouseDown={e => e.preventDefault()} onClick={() => setQ("")} aria-label="Effacer la recherche"
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "var(--gris)" }} /></button>}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
        <span style={{ ...EN_TETE, width: 24, flexShrink: 0 }}>#</span>
        {drapeaux && <span style={{ width: 20, flexShrink: 0 }} />}
        <span style={{ ...EN_TETE, flex: 1 }}>{colonne}</span>
        <span title={intervalle ? `Somme des ${sens === "export" ? "exportations" : "importations"} de ${periode.debut} à ${periode.fin} — c'est elle qui classe` : undefined}
          style={{ ...EN_TETE, width: intervalle ? L_SOMME : 88, textAlign: "right", flexShrink: 0 }}>
          {intervalle ? "Somme" : sens === "export" ? "Export" : "Import"}
        </span>
        {intervalle ? <>
          <span title={`Moyenne annuelle sur les ${periode.fin - periode.debut + 1} années de l'intervalle`}
            style={{ ...EN_TETE, width: L_MOY, textAlign: "right", flexShrink: 0 }}>Moyenne</span>
          <span title="Année médiane de l'intervalle : la moitié des années sont en dessous"
            style={{ ...EN_TETE, width: L_MOY, textAlign: "right", flexShrink: 0 }}>Médiane</span>
          <span title="Année la plus basse de l'intervalle, et son année" style={{ ...EN_TETE, width: L_EXT, textAlign: "right", flexShrink: 0 }}>Min</span>
          <span title="Année la plus haute de l'intervalle, et son année" style={{ ...EN_TETE, width: L_EXT, textAlign: "right", flexShrink: 0 }}>Max</span>
        </> : <>
          <span style={{ ...EN_TETE, width: 38, textAlign: "right", flexShrink: 0 }}>Part</span>
          <span style={{ ...EN_TETE, width: 40, textAlign: "right", flexShrink: 0 }}>Cumul</span>
          <span style={{ ...EN_TETE, width: 58, textAlign: "right", flexShrink: 0 }}>vs n-1</span>
        </>}
        {colBalance && (
          <span title="Exportations − importations, quel que soit le sens affiché"
            style={{ ...EN_TETE, width: 92, textAlign: "right", flexShrink: 0 }}>Balance</span>
        )}
      </div>

      {filtres.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center", padding: "18px 0" }}>Aucun résultat pour « {q} ».</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {visibles.map(l => <Ligne key={l.cle} l={l} rang={rangDe.get(l.cle) ?? null} />)}
          {!q && !focus && filtres.length > top && (
            <button onClick={() => setTout(t => !t)}
              style={{ margin: "4px 0 2px", padding: "7px 0", borderRadius: 8, border: "1px dashed var(--bordure-forte)", background: "transparent", cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: couleur, fontFamily: "var(--font-google-sans)" }}>
              {tout ? `Réduire au top ${top}` : `Voir les ${filtres.length - top} autres`}
            </button>
          )}
          {agregee && !q && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "1px 8px" }}>
                <span style={{ width: 24, textAlign: "center", color: "var(--gris)", fontSize: 12, fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>⋮</span>
                <span style={{ flex: 1, height: 1, background: "var(--fond)" }} />
              </div>
              <Ligne l={agregee} rang={null} />
            </>
          )}
          {/* Somme de la portée : elle égale le total imprimé par l'ANSD */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderTop: "1px solid var(--bordure)", marginTop: 4 }}>
            <span style={{ width: 24, flexShrink: 0 }} />
            {drapeaux && <span style={{ width: 20, flexShrink: 0 }} />}
            <span style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "var(--texte)", textTransform: "uppercase" }}>{totalLibelle}</span>
            <span className="ds-donnee" style={{ width: intervalle ? L_SOMME : 88, fontSize: 11.5, fontWeight: 800, color: couleur, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>{fmtV(total)}</span>
            {intervalle ? <>
              <CelluleStat v={statTotal?.moyenne ?? null} fmt={fmtV} large={L_MOY} />
              <CelluleStat v={statTotal?.mediane ?? null} fmt={fmtV} large={L_MOY} />
              <CelluleStat v={statTotal?.min ?? null} an={statTotal?.anMin ?? null} fmt={fmtV} large={L_EXT} />
              <CelluleStat v={statTotal?.max ?? null} an={statTotal?.anMax ?? null} fmt={fmtV} large={L_EXT} />
            </> : <>
              <span style={{ width: 38, flexShrink: 0 }} /><span style={{ width: 40, flexShrink: 0 }} />
              <span style={{ width: 58, flexShrink: 0 }} />
            </>}
            {colBalance && (() => {
              const bal = lignes.reduce((s, l) => s + balanceDe(l), 0);
              return (
                <span className="ds-donnee" style={{ width: 92, fontSize: 11, fontWeight: 800, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap",
                  color: bal > 0 ? "var(--vert)" : bal < 0 ? "var(--danger)" : "var(--gris)" }}>
                  {bal > 0 ? "+" : bal < 0 ? "−" : ""}{fmtV(Math.abs(bal))}
                </span>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Zone géographique (tableaux 26–29 et 34–37, puis 31–34 dès 2022) ─────────
// Les trois granularités du volet géographique du rapport sont emboîtées :
// 6 continents ⊃ 12 régions ⊃ ~190 pays partenaires. Une seule section les
// couvre, avec une bascule de niveau et un fil d'Ariane, plutôt que trois
// tableaux juxtaposés qui obligeraient à recomposer la hiérarchie de tête.
//
// Les partenaires hors référentiel (DOM-TOM, RAS chinoises, entités
// disparues, provisions de bord) arrivent de l'API sous « Autres pays » DE
// LEUR RÉGION : la somme affichée égale donc toujours le sous-total imprimé
// par l'ANSD, à l'arrondi près.
type NacePaysLigne = { pays: string; code_iso2: string | null; region: string; annee: number;
  valeur: number | null; poids: number | null; libelles: number; edition: number };
type NaceDataPays = { disponible: boolean; annees: number[]; editions: number[]; ordre: string[];
  continents: Record<string, string>; donnees: { export: NacePaysLigne[]; import: NacePaysLigne[] } };
type NaceDataReg = { disponible: boolean; annees: number[]; editions: number[]; ordre: string[];
  continents: Record<string, string>;
  donnees: { export: (NaceLigneCle & { region: string })[]; import: (NaceLigneCle & { region: string })[] } };

function CurseurPeriodeNace({ min, max, periode, onChange, largeur = 150 }: {
  min: number; max: number; periode: Periode; onChange: (p: Periode) => void; largeur?: number;
}) {
  if (!(max > min)) return null;
  if (!estIntervalle(periode)) {
    return <CurseurAnneeCommun min={min} max={max} value={Math.min(max, Math.max(min, periode.fin))}
      largeur={largeur} onChange={v => onChange({ debut: v, fin: v, intervalle: false })} />;
  }
  // Un intervalle d'une seule année n'en est pas un : les poignées se bornent
  // l'une l'autre à une année d'écart au moins, faute de quoi la lecture
  // « intervalle » afficherait les statistiques d'un millésime unique — une
  // moyenne égale à la somme, un minimum égal au maximum.
  const debut = Math.max(min, Math.min(periode.debut, periode.fin - 1));
  const fin = Math.min(max, Math.max(debut + 1, periode.fin));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11, flexShrink: 0, ...varsAccent(ACCENT_BLEU) }}>
      <StylesCurseurNace />
      <span style={{ fontSize: 10, color: "var(--gris)", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{min}</span>
      <CurseurPlageNace min={min} max={max} debut={debut} fin={fin} ecartMin={1} largeur={largeur}
        onChange={(d, f) => onChange({ ...periode, debut: d, fin: f })} />
      <span style={pastilleCurseur(ACCENT_BLEU)}>{debut}–{fin}</span>
    </span>
  );
}

// Bascule segmentée compacte, teintée du sens affiché (bleu à l'export,
// orange à l'import) pour que les commandes s'accordent aux valeurs.
function SegmentNace<T extends string>({ options, valeur, onChange, accent }: {
  options: { v: T; l: string }[]; valeur: T; onChange: (v: T) => void; accent?: string;
}) {
  return (
    <div style={{ display: "inline-flex", background: "var(--fond)", borderRadius: 999, padding: 2, gap: 2, flexShrink: 0 }}>
      {options.map(o => {
        const actif = o.v === valeur;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            border: "none", cursor: "pointer", padding: "4px 13px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
            background: actif ? "var(--carte)" : "transparent", color: actif ? (accent ?? "var(--bleu)") : "var(--gris-fort)",
            boxShadow: actif ? "var(--ombre-1)" : "none", transition: "color .15s, background .15s", fontFamily: "var(--font-google-sans)" }}>{o.l}</button>
        );
      })}
    </div>
  );
}

// En-tête de section reprenant celui du tableau de bord : numéro, titre, les
// commandes de la section sur la même ligne, puis un filet qui court jusqu'au
// bord. Chaque section porte ses propres commandes — dont son curseur d'année
// — pour qu'on puisse comparer deux millésimes d'une section à l'autre.
function EnTeteSectionNace({ n, titre, commandes }: {
  n: number; titre: string; commandes?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "30px 0 14px" }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgb(var(--bleu-rgb) / 0.09)", color: "var(--bleu)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
        {String(n).padStart(2, "0")}
      </span>
      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--encre)", letterSpacing: "-0.01em", whiteSpace: "nowrap", flexShrink: 0 }}>{titre}</h3>
      {commandes}
      <div style={{ flex: 1, height: 1, background: "rgb(var(--encre-rgb) / 0.12)" }} />
    </div>
  );
}

type ZoneNiveau = "continent" | "region" | "pays";
type ZoneSens = "export" | "import";
type ZoneLigne = {
  cle: string; nom: string; iso2: string | null; parent: string | null;
  v: number | null; p: number | null;              // sens affiché
  vAutre: number | null; pAutre: number | null;    // sens opposé, pour la balance
  vPrec: number | null; pPrec: number | null;      // année n-1, pour la variation
  libelles: number;                                // > 1 : ligne agrégée
  ouvrable: boolean;                               // descend d'un niveau au clic
};

const AUTRES_PAYS = "Autres pays";

// Les libellés de régions du rapport sont longs ; abrégés pour la pastille de
// rattachement qui suit le nom, le nom complet restant en infobulle.
const REGION_COURT: Record<string, string> = {
  "Union européenne": "UE",
  "Autres pays d'Europe": "Autres Europe",
  "Afrique centrale": "Afr. centrale",
  "Afrique du Nord": "Afr. du Nord",
  "Afrique occidentale": "Afr. occidentale",
  "Afrique orientale et du Sud": "Afr. or. et Sud",
  "Amérique du Nord": "Am. du Nord",
  "Amérique centrale et du Sud": "Am. centr. et Sud",
  "Asie occidentale": "Asie occ.",
  "Autres pays d'Asie": "Autres Asie",
  "Océanie": "Océanie",
  "Divers": "Divers",
};
const NIVEAUX: { v: ZoneNiveau; l: string }[] = [
  { v: "continent", l: "Continents" }, { v: "region", l: "Régions" }, { v: "pays", l: "Pays" },
];

// Somme tolérante aux trous : le rapport imprime « - » pour une absence
// d'échange, que l'API rend en null. null + null reste null (donnée absente),
// null + valeur vaut la valeur.
const somme = (a: number | null | undefined, b: number | null | undefined) =>
  a == null && b == null ? null : (a ?? 0) + (b ?? 0);

function indexerZone<T extends { annee: number; valeur: number | null; poids: number | null }>(
  lignes: T[], cle: (r: T) => string, annee: number,
): Map<string, { v: number | null; p: number | null }> {
  const m = new Map<string, { v: number | null; p: number | null }>();
  for (const r of lignes) {
    if (r.annee !== annee) continue;
    const k = cle(r), a = m.get(k);
    m.set(k, { v: somme(a?.v, r.valeur), p: somme(a?.p, r.poids) });
  }
  return m;
}

// La portée courante — niveau et zooms — vit chez le parent, parce que la
// bascule de niveau est remontée dans l'en-tête de section, et que descendre
// au clic dans une ligne doit changer le niveau : les deux commandes agissent
// sur le même état.
type ZonePortee = { niveau: ZoneNiveau; cont: string | null; reg: string | null };

function ZoneGeographique({ periode, cont, reg, pys, portee, setPortee, sens, mesure, setMesure }: {
  periode: Periode; cont: NaceDataCont | null; reg: NaceDataReg | null; pys: NaceDataPays | null;
  portee: ZonePortee; setPortee: (p: ZonePortee) => void;
  sens: ZoneSens; mesure: NaceMesure; setMesure: (m: NaceMesure) => void;
}) {
  const { niveau, cont: zoomCont, reg: zoomReg } = portee;
  const autre: ZoneSens = sens === "export" ? "import" : "export";
  const ratt = reg?.continents ?? pys?.continents ?? {};
  const badgeSens = sens === "export" ? badge_bleu : badge_orange;
  const couleur = sens === "export" ? NACE_BLEU : NACE_ORANGE;

  const { lignes, totalPeriode } = useMemo(() => {
    const vide = { lignes: [] as LigneClassement[], totalPeriode: undefined };
    // Un triplet d'index par niveau : sens affiché, sens opposé (balance) et
    // année précédente (variation), cette dernière n'ayant de terme de
    // comparaison qu'en lecture d'une seule année.
    const trois = <T extends NaceLigneCle>(src: { export: T[]; import: T[] }, k: (r: T) => string,
                                           garde: (r: T) => boolean = () => true) => ({
      a: indexerNace(src[sens].filter(garde), k, periode),
      b: indexerNace(src[autre].filter(garde), k, periode),
      pr: estIntervalle(periode) ? new Map<string, AgrNace>()
        : indexerNace(src[sens].filter(garde), k, anneeSeule(periode.fin - 1)),
      // Total de la portée agrégé comme les lignes : en Min/Max, leur somme
      // ne le donnerait pas.
      t: indexerNace(src[sens].filter(garde), () => "∑", periode).get("∑"),
    });
    const monter = (cles: string[], i: ReturnType<typeof trois>,
                    extra: (nom: string) => Partial<LigneClassement>) =>
      cles.map(nom => ({
        cle: nom, nom,
        v: i.a.get(nom)?.v ?? null, p: i.a.get(nom)?.p ?? null,
        sv: i.a.get(nom)?.sv ?? null, sp: i.a.get(nom)?.sp ?? null,
        vAutre: i.b.get(nom)?.v ?? null, pAutre: i.b.get(nom)?.p ?? null,
        vPrec: i.pr.get(nom)?.v ?? null, pPrec: i.pr.get(nom)?.p ?? null,
        ...extra(nom),
      }));

    if (niveau === "continent") {
      if (!cont?.disponible) return vide;
      const i = trois(cont.donnees, r => r.continent);
      // « Divers » n'a pas de région : le clic n'y mènerait à rien.
      return { totalPeriode: i.t, lignes: monter([...i.a.keys()], i, nom => ({
        ouvrable: Object.values(ratt).includes(nom) && nom !== "Divers",
      })) };
    }
    if (niveau === "region") {
      if (!reg?.disponible) return vide;
      const i = trois(reg.donnees, r => r.region);
      const cles = [...i.a.keys()].filter(n => !zoomCont || ratt[n] === zoomCont);
      return { totalPeriode: i.t, lignes: monter(cles, i, nom => ({ parent: ratt[nom] ?? null, ouvrable: true })) };
    }
    if (!pys?.disponible) return vide;
    // Au niveau pays, toutes les lignes « Autres pays » de la portée sont
    // fondues en une seule : ce n'est pas un pays, il n'a donc pas de rang.
    const k = (r: NacePaysLigne) => (r.pays === AUTRES_PAYS ? AUTRES_PAYS : `${r.region}·${r.pays}`);
    const garde = (r: NacePaysLigne) =>
      (!zoomReg || r.region === zoomReg) && (!zoomCont || ratt[r.region] === zoomCont);
    const i = trois(pys.donnees, k, garde);
    // Métadonnées (nom affiché, drapeau, région) et nombre de libellés fondus.
    // Le décompte est celui d'une année, pas de la période : sommer sur dix ans
    // multiplierait par dix le nombre de territoires regroupés sous « Autres
    // pays ». On retient l'année la plus fournie de l'intervalle.
    const meta = new Map<string, NacePaysLigne>();
    const fondus = new Map<string, Map<number, number>>();
    for (const r of pys.donnees[sens]) {
      if (r.annee < periode.debut || r.annee > periode.fin || !garde(r)) continue;
      const key = k(r);
      if (!meta.has(key)) meta.set(key, r);
      let parAn = fondus.get(key);
      if (!parAn) { parAn = new Map(); fondus.set(key, parAn); }
      parAn.set(r.annee, (parAn.get(r.annee) ?? 0) + r.libelles);
    }
    return { totalPeriode: i.t, lignes: monter([...i.a.keys()], i, key => {
      const m = meta.get(key);
      return {
        nom: m?.pays ?? key, iso2: m?.code_iso2 ?? null,
        parent: key === AUTRES_PAYS ? null : m?.region ?? null,
        libelles: Math.max(1, ...(fondus.get(key)?.values() ?? [])),
      };
    }) };
  }, [niveau, sens, autre, periode, cont, reg, pys, ratt, zoomCont, zoomReg]);

  // Le classeur couvre les TROIS granularités et le monde entier, quelle que
  // soit la descente en cours : dans un tableur, on filtre soi-même.
  const exporter = async () => {
    const unite = mesure === "valeur" ? "M FCFA" : "tonnes";
    const feuilles: FeuilleXL[] = [];
    if (cont?.disponible) feuilles.push(feuilleFamille(
      "Continents", "Continent", cont.donnees, r => r.continent, sens, mesure, periode,
      { unite, balance: true }));
    if (reg?.disponible) feuilles.push(feuilleFamille(
      "Régions", "Région", reg.donnees, r => r.region, sens, mesure, periode,
      { unite, balance: true, parent: k => ratt[k] ?? null, titreParent: "Continent" }));
    if (pys?.disponible) feuilles.push(feuilleFamille(
      // Clé région·pays, comme le tableau : « Autres pays » existe dans chaque
      // région et n'est pas le même reste de l'une à l'autre.
      "Pays partenaires", "Partenaire", pys.donnees, r => `${r.region}·${r.pays}`, sens, mesure, periode,
      { unite, balance: true, agregeSous: AUTRES_PAYS, libelle: k => k.split("·")[1] ?? k,
        parent: k => { const r = k.split("·")[0]; return ratt[r] ? `${r} (${ratt[r]})` : r; },
        titreParent: "Région (continent)" }));
    await ecrireClasseurNace(
      `NACE_Zones-geographiques_${sens === "export" ? "exportations" : "importations"}_${suffixeFichier(mesure, periode)}.xlsx`,
      contexteNace(mesure, periode), feuilles);
  };

  const nomPortee = zoomReg ?? zoomCont ?? "Monde";
  // Fil d'Ariane. « Océanie » et « Divers » nomment à la fois un continent et
  // une région : descendre dans la région produirait deux crans identiques —
  // « Monde › Divers › Divers » — donc un affichage redondant et des clés React
  // en double. Les crans consécutifs de même libellé sont fondus ; le niveau
  // intermédiaire est de toute façon dégénéré, ce continent n'ayant qu'une
  // seule région, et la bascule de granularité reste disponible pour y revenir.
  const crans: { l: string; p: ZonePortee }[] = [
    { l: "Monde", p: { niveau: "continent" as ZoneNiveau, cont: null, reg: null } },
    ...(zoomCont ? [{ l: zoomCont, p: { niveau: "region" as ZoneNiveau, cont: zoomCont, reg: null } }] : []),
    ...(zoomReg ? [{ l: zoomReg, p: { niveau: "pays" as ZoneNiveau, cont: zoomCont, reg: zoomReg } }] : []),
  ].filter((c, i, a) => i === 0 || c.l !== a[i - 1].l);

  return (
    <TableauClassementNace
      lignes={lignes} agregeSous={AUTRES_PAYS} sens={sens} mesure={mesure}
      periode={periode} totalPeriode={totalPeriode}
      colonne={niveau === "pays" ? "Partenaire" : niveau === "region" ? "Région" : "Continent"}
      drapeaux={niveau === "pays"} top={niveau === "pays" ? 15 : 20}
      nomPortee={nomPortee} totalLibelle={nomPortee === "Monde" ? "Ensemble" : nomPortee}
      // Le rattachement n'a d'intérêt que si la portée mélange plusieurs
      // parents : une fois descendu dans une région, il serait constant.
      montrerParent={!zoomReg && !(niveau === "region" && !!zoomCont)}
      libelleParent={p => REGION_COURT[p] ?? p}
      granularite={
        <SegmentNace options={NIVEAUX} valeur={niveau} accent={couleur}
          onChange={n => setPortee({
            niveau: n,
            // Remonter d'un niveau relâche la portée correspondante.
            cont: n === "continent" ? null : zoomCont,
            reg: n === "pays" ? zoomReg : null,
          })} />
      }
      uniteBascule={
        <SegmentNace options={[{ v: "valeur" as NaceMesure, l: "Valeur" }, { v: "poids" as NaceMesure, l: "Volume" }]}
          valeur={mesure} onChange={setMesure} accent={couleur} />
      }
      actions={<BoutonExcel construire={exporter}
        titre={`Télécharger continents, régions et pays — ${sens === "export" ? "exportations" : "importations"}, ${mesure === "valeur" ? "valeur" : "volume"}, ${libellePeriode(periode)}`} />}
      onOuvrir={l => niveau === "continent"
        ? setPortee({ niveau: "region", cont: l.nom, reg: null })
        : setPortee({ niveau: "pays", cont: l.parent ?? zoomCont, reg: l.nom })}
      entete={
        /* Fil d'Ariane : la portée courante, en badge teinté du sens affiché.
           Chaque cran antérieur ramène à son niveau. */
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {crans.map((c, i, arr) => {
            const dernier = i === arr.length - 1;
            return (
              <span key={`${i}·${c.l}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {i > 0 && <ChevronRight size={12} style={{ color: "var(--gris)" }} />}
                <button onClick={() => setPortee(c.p)} disabled={dernier}
                  style={dernier
                    ? { ...badgeSens, fontWeight: 700, cursor: "default", fontFamily: "var(--font-google-sans)" }
                    : { border: "none", background: "transparent", padding: "4px 11px", borderRadius: 999,
                        fontSize: 11, fontWeight: 600, color: "var(--gris-fort)", cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>
                  {c.l}
                </button>
              </span>
            );
          })}
        </div>
      }
    />
  );
}

// ── Export Excel ─────────────────────────────────────────────────────────────
// Le classeur reprend EXACTEMENT la sélection en cours — sens, unité, période —
// mais toutes les lignes, pas seulement celles que le tableau montre, et toutes
// les nomenclatures de la section, pas seulement celle affichée : à l'écran on
// compare, dans un tableur on dépouille.
//
// En intervalle, chaque feuille ajoute le détail annuel après le résumé. C'est
// ce qui rend l'analyse possible ailleurs : une somme et une médiane se
// recalculent, une série annuelle ne se devine pas.
type ColonneXL = { titre: string; largeur: number; format?: string };
type FeuilleXL = { nom: string; titre: string; colonnes: ColonneXL[];
                   lignes: (string | number | null)[][]; total?: (string | number | null)[] };

const FMT_NOMBRE = "#,##0";
const FMT_PART = "0.0%";

// Un nom de feuille Excel : 31 caractères au plus, et []:*?/\ interdits.
const nomFeuille = (t: string) => t.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);

function libellePeriode(per: Periode) {
  return per.intervalle ? `${per.debut} à ${per.fin}` : String(per.fin);
}

// Colonnes de statistiques, identiques dans toutes les feuilles pour que deux
// onglets se comparent sans relire les en-têtes.
function colonnesStats(per: Periode, unite: string, annees: number[]): ColonneXL[] {
  if (!per.intervalle) return [
    { titre: `Valeur (${unite})`, largeur: 16, format: FMT_NOMBRE },
    { titre: "Part", largeur: 9, format: FMT_PART },
    { titre: "Part cumulée", largeur: 13, format: FMT_PART },
    { titre: `Variation vs ${per.fin - 1}`, largeur: 15, format: FMT_PART },
  ];
  return [
    { titre: `Somme (${unite})`, largeur: 16, format: FMT_NOMBRE },
    { titre: `Moyenne (${unite})`, largeur: 16, format: FMT_NOMBRE },
    { titre: `Médiane (${unite})`, largeur: 16, format: FMT_NOMBRE },
    { titre: `Minimum (${unite})`, largeur: 16, format: FMT_NOMBRE },
    { titre: "Année du minimum", largeur: 16 },
    { titre: `Maximum (${unite})`, largeur: 16, format: FMT_NOMBRE },
    { titre: "Année du maximum", largeur: 16 },
    ...annees.map(a => ({ titre: String(a), largeur: 14, format: FMT_NOMBRE })),
  ];
}

// Valeurs correspondantes. `part` et `cumul` sont des fractions : Excel les
// affiche en pourcentage grâce au format, et elles restent calculables.
function valeursStats(a: AgrNace | undefined, per: Periode, mesure: NaceMesure, annees: number[],
                      part: number | null, cumul: number | null, prec: number | null,
): (string | number | null)[] {
  const serie = mesure === "valeur" ? a?.serie.v : a?.serie.p;
  const v = a ? (mesure === "valeur" ? a.v : a.p) : null;
  if (!per.intervalle) return [
    v, part, cumul,
    prec != null && prec !== 0 && v != null ? (v - prec) / Math.abs(prec) : null,
  ];
  const st = (mesure === "valeur" ? a?.sv : a?.sp) ?? null;
  return [
    st?.somme ?? null, st?.moyenne ?? null, st?.mediane ?? null,
    st?.min ?? null, st?.anMin ?? null, st?.max ?? null, st?.anMax ?? null,
    ...annees.map(an => serie?.get(an) ?? null),
  ];
}

async function ecrireClasseurNace(fichier: string, entete: string[], feuilles: FeuilleXL[]) {
  // SheetJS chargé à la demande (~400 Ko) : uniquement au clic.
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const f of feuilles) {
    // Bandeau de contexte avant le tableau : ouvert six mois plus tard, le
    // fichier doit encore dire de quoi il parle et d'où il vient.
    const aoa: (string | number | null)[][] = [
      [f.titre], ...entete.map(l => [l]), [],
      f.colonnes.map(c => c.titre),
      ...f.lignes,
      ...(f.total ? [f.total] : []),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = f.colonnes.map(c => ({ wch: c.largeur }));
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(1, f.colonnes.length - 1) } }];
    const lgEntete = 1 + entete.length + 1;              // titre + contexte + ligne vide
    const derniere = lgEntete + f.lignes.length + (f.total ? 1 : 0);
    // Pas de filtre automatique : SheetJS l'accompagne d'un nom défini
    // `_xlnm._FilterDatabase` dont il n'échappe pas l'apostrophe du nom de
    // feuille — « 'Groupes d'utilisation'!A8:O18 » n'est pas une formule
    // valide. Excel ouvrait alors le classeur en mode réparation et retirait
    // le nom défini. Un fichier qui s'ouvre sans avertissement vaut mieux que
    // des menus de filtre, que l'utilisateur pose d'un clic (Données ▸ Filtrer).
    // Formats numériques posés cellule par cellule : le format vit sur la
    // cellule dans le fichier xlsx, il n'y a pas de format de colonne.
    f.colonnes.forEach((c, ci) => {
      if (!c.format) return;
      for (let r = lgEntete + 1; r <= derniere; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: ci })];
        if (cell && typeof cell.v === "number") cell.z = c.format;
      }
    });
    XLSX.utils.book_append_sheet(wb, ws, nomFeuille(f.nom));
  }
  XLSX.writeFile(wb, fichier);
}

// Années effectivement couvertes par la période dans une famille donnée : une
// famille peut ne pas porter toutes les années de l'onglet.
function anneesDe(lignes: { annee: number }[], per: Periode): number[] {
  const s = new Set<number>();
  for (const r of lignes) if (r.annee >= per.debut && r.annee <= per.fin) s.add(r.annee);
  return [...s].sort((a, b) => a - b);
}

// Construit une feuille à partir d'une famille brute. Le classement, le total
// et les parts sont recalculés ici avec les mêmes fonctions que l'affichage —
// c'est la même vérité, pas une seconde implémentation.
function feuilleFamille<T extends NaceLigneCle>(
  nom: string, colonneLibelle: string, source: { export: T[]; import: T[] },
  cle: (r: T) => string, sens: ZoneSens, mesure: NaceMesure, per: Periode,
  opts: { unite: string; parent?: (k: string) => string | null; titreParent?: string;
          libelle?: (k: string) => string; balance?: boolean; agregeSous?: string } = { unite: "M FCFA" },
): FeuilleXL {
  const autre: ZoneSens = sens === "export" ? "import" : "export";
  const annees = anneesDe(source[sens], per);
  const idx = indexerNace(source[sens], cle, per);
  const idxAutre = opts.balance ? indexerNace(source[autre], cle, per) : null;
  const prec = per.intervalle ? null : indexerNace(source[sens], cle, anneeSeule(per.fin - 1));
  const mv = (a: AgrNace | undefined) => (a ? (mesure === "valeur" ? a.v : a.p) : null) ?? 0;

  // Le fourre-tout — « Autres produits », « Autres pays » — sort du classement
  // et passe en dernier, exactement comme à l'écran : ce n'est pas une modalité
  // et lui donner le rang 1 ferait dire au fichier autre chose que le tableau.
  // Il reste dans la feuille, et dans le total.
  const estAgrege = (k: string) => opts.agregeSous != null && (opts.libelle ? opts.libelle(k) : k) === opts.agregeSous;
  const classees = [...idx.keys()].filter(k => !estAgrege(k)).sort((x, y) => mv(idx.get(y)) - mv(idx.get(x)));
  const cles = [...classees, ...[...idx.keys()].filter(estAgrege)];
  const total = cles.reduce((t, k) => t + Math.max(0, mv(idx.get(k))), 0);
  let cumul = 0;
  const lignes = cles.map((k, i) => {
    const range = i < classees.length;
    if (range) cumul += Math.max(0, mv(idx.get(k)));
    const a = idx.get(k);
    const pr = prec ? (mesure === "valeur" ? prec.get(k)?.v : prec.get(k)?.p) ?? null : null;
    const bal = idxAutre
      ? (sens === "export" ? mv(a) - mv(idxAutre.get(k)) : mv(idxAutre.get(k)) - mv(a))
      : null;
    return [
      range ? i + 1 : null, opts.libelle ? opts.libelle(k) : k,
      ...(opts.parent ? [opts.parent(k)] : []),
      ...valeursStats(a, per, mesure, annees, total ? Math.max(0, mv(a)) / total : null,
                      range && total ? cumul / total : null, pr),
      ...(idxAutre ? [bal] : []),
    ];
  });
  // Total de la portée agrégé comme les lignes : en Min/Max/Médiane, leur
  // somme ne le donnerait pas.
  const agTotal = indexerNace(source[sens], () => "∑", per).get("∑");
  const agAutre = idxAutre ? indexerNace(source[autre], () => "∑", per).get("∑") : null;
  const prTotal = prec ? indexerNace(source[sens], () => "∑", anneeSeule(per.fin - 1)).get("∑") : null;
  const prV = prTotal ? (mesure === "valeur" ? prTotal.v : prTotal.p) : null;

  return {
    nom, titre: `${nom} — ${sens === "export" ? "Exportations" : "Importations"} · ${opts.unite === "tonnes" ? "poids net" : "valeur"} · ${libellePeriode(per)}`,
    colonnes: [
      { titre: "Rang", largeur: 6 },
      { titre: colonneLibelle, largeur: 44 },
      ...(opts.parent ? [{ titre: opts.titreParent ?? "Rattachement", largeur: 26 }] : []),
      ...colonnesStats(per, opts.unite, annees),
      ...(idxAutre ? [{ titre: `Balance (${opts.unite})`, largeur: 18, format: FMT_NOMBRE }] : []),
    ],
    lignes,
    total: [
      null, "ENSEMBLE", ...(opts.parent ? [null] : []),
      ...valeursStats(agTotal, per, mesure, annees, null, null, prV),
      ...(agAutre ? [sens === "export" ? mv(agTotal) - mv(agAutre) : mv(agAutre) - mv(agTotal)] : []),
    ],
  };
}

// Sections 03 et 04 : deux feuilles par portée. Les fondre en une seule
// obligerait à choisir un classement — celui des clients ou celui des
// fournisseurs — et à laisser des trous pour les pays absents d'un des sens.
function feuillesPortees(pys: NaceDataPays, portees: { nom: string; garde: (r: NacePaysLigne) => boolean }[],
                         mesure: NaceMesure, per: Periode, montrerRegion: boolean): FeuilleXL[] {
  const unite = mesure === "valeur" ? "M FCFA" : "tonnes";
  return portees.flatMap(z => {
    const src = { export: pys.donnees.export.filter(z.garde), import: pys.donnees.import.filter(z.garde) };
    if (!src.export.length && !src.import.length) return [];
    return (["export", "import"] as ZoneSens[]).map(sens => ({
      ...feuilleFamille(
        `${z.nom} — ${sens === "export" ? "Clients" : "Fournisseurs"}`, "Partenaire", src,
        r => `${r.region}·${r.pays}`, sens, mesure, per,
        { unite, balance: true, agregeSous: AUTRES_PAYS, libelle: k => k.split("·")[1] ?? k,
          ...(montrerRegion ? { parent: (k: string) => k.split("·")[0], titreParent: "Région" } : {}) }),
    }));
  });
}

// Bandeau de contexte identique dans toutes les feuilles : sans lui, un fichier
// retrouvé plus tard ne dit ni sa source, ni son unité, ni sa période.
function contexteNace(mesure: NaceMesure, per: Periode): string[] {
  return [
    "Source : Notes d'analyse du commerce extérieur (NACE), ANSD — Sénégal",
    `Unité : ${mesure === "valeur" ? "millions de FCFA" : "tonnes (poids net)"}`,
    `Période : ${libellePeriode(per)}`,
    `Extrait le ${new Date().toLocaleDateString("fr-FR")}`,
  ];
}
const suffixeFichier = (mesure: NaceMesure, per: Periode) =>
  `${mesure === "valeur" ? "valeur" : "volume"}_${per.intervalle ? `${per.debut}-${per.fin}` : per.fin}`;

// Bouton d'export d'une section. L'état d'attente est réel : SheetJS pèse
// ~400 Ko et n'est chargé qu'ici, le premier clic met donc un instant.
function BoutonExcel({ construire, titre }: { construire: () => Promise<void>; titre: string }) {
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState(false);
  return (
    <>
    {/* Les keyframes voyagent avec le bouton : celles définies plus bas dans le
        fichier appartiennent à un composant que cet onglet ne monte pas. */}
    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    <button
      onClick={async () => {
        if (enCours) return;
        setEnCours(true); setEchec(false);
        try { await construire(); } catch { setEchec(true); } finally { setEnCours(false); }
      }}
      title={echec ? "L'export a échoué — réessayer" : titre}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--bordure-forte)",
        background: "var(--carte)", borderRadius: 999, padding: "4px 13px", fontSize: 11, fontWeight: 700,
        color: echec ? "var(--danger)" : "var(--vert)", cursor: enCours ? "progress" : "pointer",
        fontFamily: "var(--font-google-sans)", whiteSpace: "nowrap", boxShadow: "var(--ombre-1)" }}>
      {enCours ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <FileSpreadsheet size={12} />}
      {echec ? "Réessayer" : "Excel"}
    </button>
    </>
  );
}

// ── Partenaires : classements de pays, dérivés de la même famille ────────────
// Ces blocs complètent le tableau navigable de la zone géographique : celui-ci
// répond à « comment se répartit tel niveau », ceux-ci à « qui sont les
// premiers partenaires », mondialement puis dans chaque continent.
type Partenaire = { nom: string; iso2: string | null; region: string; valeur: number;
                    part: number | null; stats: Stats | null };

// `garder` restreint la portée — un continent, un groupement économique, ou
// rien pour le monde entier. La part se rapporte alors à cette portée et non
// au total mondial : c'est la lecture utile quand on regarde une zone.
function classerPartenaires(pys: NaceDataPays | null, sens: ZoneSens, per: Periode, top: number,
                            mesure: NaceMesure = "valeur", garder?: (r: NacePaysLigne) => boolean,
): { lignes: Partenaire[]; total: number } {
  const mes = (r: NacePaysLigne) => (mesure === "valeur" ? r.valeur : r.poids);
  if (!pys?.disponible) return { lignes: [], total: 0 };
  // Série annuelle par partenaire, puis résumé sur l'intervalle : le minimum
  // d'un partenaire est celui de ses valeurs annuelles, pas celui d'une somme
  // déjà écrasée.
  const series = new Map<string, { meta: NacePaysLigne; an: Map<number, number | null> }>();
  // Le dénominateur inclut « Autres pays », que le classement exclut : la part
  // est celle du total de la portée, comme dans le tableau ci-dessus. La
  // rapporter aux seuls partenaires nommés la gonflerait — le Mali passerait
  // de 20,5 à 21,9 % des exportations, et les deux blocs se contrediraient.
  const serieTotal = new Map<number, number | null>();
  const annees = new Set<number>();
  for (const r of pys.donnees[sens]) {
    if (r.annee < per.debut || r.annee > per.fin) continue;
    if (garder && !garder(r)) continue;
    annees.add(r.annee);
    serieTotal.set(r.annee, sommeNace(serieTotal.get(r.annee), mes(r)));
    if (r.pays === AUTRES_PAYS) continue;
    let s = series.get(r.pays);
    if (!s) { s = { meta: r, an: new Map() }; series.set(r.pays, s); }
    s.an.set(r.annee, sommeNace(s.an.get(r.annee), mes(r)));
  }
  // La valeur qui classe : celle de l'année, ou la somme de l'intervalle.
  const classante = (serie: Map<number, number | null>, st: Stats) =>
    per.intervalle ? st.somme ?? 0 : serie.get(per.fin) ?? 0;
  const st = statistiquesPeriode(serieTotal, per, annees);
  const total = classante(serieTotal, st);
  // Un partenaire sans échange sur la période n'en est pas un : sans ce filtre,
  // l'Océanie alignerait des lignes à zéro.
  const lignes = [...series.values()]
    .map(s => { const x = statistiquesPeriode(s.an, per, annees);
                return { s, x, v: classante(s.an, x) }; })
    .filter(e => e.v > 0)
    .sort((a, b) => b.v - a.v).slice(0, top)
    .map(({ s, x, v }) => ({
      nom: s.meta.pays, iso2: s.meta.code_iso2, region: s.meta.region,
      valeur: v, stats: per.intervalle ? x : null,
      part: total ? v / total * 100 : null,
    }));
  return { lignes, total };
}

function TopPartenaires({ titre, lignes, total, couleur, montrerRegion, intervalle, mesure = "valeur" }: {
  titre: string; lignes: Partenaire[]; total: number;
  couleur: string; montrerRegion?: boolean; intervalle?: boolean; mesure?: NaceMesure;
}) {
  const fmt = mesure === "valeur" ? fmtMFCFA : fmtTonnes;
  return (
    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, margin: "0 8px 2px" }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: "var(--gris)", letterSpacing: "0.09em", textTransform: "uppercase" }}>{titre}</span>
        {/* Total de la portée : c'est le dénominateur des parts affichées. En
            intervalle il est résumé sur la portée entière, année par année — la
            somme des minima des lignes ne serait le minimum de rien. */}
        <span className="ds-donnee" style={{ fontSize: 11, fontWeight: 800, color: couleur, whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
      </div>
      {/* En-tête de colonnes : nécessaire dès qu'il y en a quatre, la seule
          colonne « part » de la lecture annuelle se passant d'intitulé. */}
      {intervalle && lignes.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 2px" }}>
          <span style={{ width: 20, flexShrink: 0 }} /><span style={{ width: 20, flexShrink: 0 }} />
          <span style={{ flex: 1 }} />
          {[["Somme", L_SOMME], ["Moyenne", L_MOY], ["Médiane", L_MOY], ["Min", L_EXT], ["Max", L_EXT]].map(([t, w]) => (
            <span key={t as string} style={{ width: w as number, flexShrink: 0, textAlign: "right", fontSize: 8.5,
              fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" }}>{t}</span>
          ))}
        </div>
      )}
      {lignes.length === 0
        ? <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center", padding: "14px 0" }}>Aucun échange.</p>
        : lignes.map((l, i) => (
          <div key={l.nom} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0,
            padding: "4px 8px", borderRadius: 8, background: i % 2 === 1 ? "var(--carte-douce)" : "transparent" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20,
              borderRadius: 999, background: i < 3 ? couleur : "var(--sur-bleu)", color: i < 3 ? "var(--sur-bleu)" : "var(--gris)",
              fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
            <DrapeauPays iso={l.iso2} nom={l.nom} />
            <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "baseline", gap: 7 }}>
              <span title={l.nom} style={{ fontSize: 12.5, fontWeight: 650, color: "var(--encre)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nom}</span>
              {montrerRegion && (
                <span title={l.region} style={{ fontSize: 9.5, fontWeight: 700, color: "var(--gris)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {REGION_COURT[l.region] ?? l.region}
                </span>
              )}
            </span>
            <span className="ds-donnee" style={{ width: intervalle ? L_SOMME : 88, fontSize: 11.5, fontWeight: 800, color: couleur, textAlign: "right",
              flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmt(l.valeur)}</span>
            {intervalle ? <>
              <CelluleStat v={l.stats?.moyenne ?? null} fmt={fmt} large={L_MOY} />
              <CelluleStat v={l.stats?.mediane ?? null} fmt={fmt} large={L_MOY} />
              <CelluleStat v={l.stats?.min ?? null} an={l.stats?.anMin ?? null} fmt={fmt} large={L_EXT} />
              <CelluleStat v={l.stats?.max ?? null} an={l.stats?.anMax ?? null} fmt={fmt} large={L_EXT} />
            </> : (
              <span style={{ width: 40, fontSize: 10, fontWeight: 700, color: "var(--texte)", textAlign: "right", flexShrink: 0 }}>
                {l.part != null ? `${l.part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—"}
              </span>
            )}
          </div>
        ))}
    </div>
  );
}

// Ordre fixe des continents pour la bascule : les classer par volume les
// ferait sauter d'une année à l'autre. « Divers » n'en est pas un — provisions
// de bord, or monétaire et origines non déterminées n'ont pas de partenaires.
const CONTINENTS_ORDRE = ["Afrique", "Europe", "Asie", "Amérique", "Océanie"];
// Les cinq sont féminins et commencent par une voyelle : « avec l'Afrique ».
const AVEC_CONTINENT = (c: string) => `avec l'${c}`;

// ── Groupements économiques ──────────────────────────────────────────────────
// La composition vient du référentiel (ref_groupements / ref_pays_groupements),
// que l'administration tient déjà et qu'emploient les autres modules : une
// adhésion corrigée là-bas se répercute ici sans toucher au code.
//
// Les membres sont désignés par code ISO 3166-1 alpha-2 et non par nom : les
// noms de ref_pays ont déjà bougé (« Cap-Vert » à l'origine, « Cabo Verde »
// depuis), et un nom qui dérive ferait disparaître un membre du classement
// sans rien signaler.
//
// Le Sénégal appartient aux deux unions, mais il ne peut pas apparaître au
// classement : le pays déclarant n'a pas de ligne dans ses propres échanges.
type Groupement = { code: string; nom_fr: string; membres: string[] };

// ── Nomenclatures de produits (tableaux 8–19 et 38–41) ───────────────────────
// Quatre lectures du même commerce, de la plus synthétique à la plus fine.
// Elles ne s'emboîtent PAS : ce sont quatre nomenclatures indépendantes de
// l'ANSD, pas les niveaux d'une hiérarchie — d'où une bascule sans fil
// d'Ariane, là où les zones géographiques se descendent.
type NaceFamille = "principaux" | "groupes" | "regroupes" | "chapitres";
// Libellés abrégés : le titre de section porte déjà « Produits », et la barre
// de commandes doit tenir sur une seule ligne avec les deux autres bascules et
// le curseur.
const FAMILLES_PRODUITS: { v: NaceFamille; l: string }[] = [
  { v: "principaux", l: "Principaux" },
  { v: "groupes", l: "Groupes d'utilisation" },
  { v: "regroupes", l: "Regroupés" },
  { v: "chapitres", l: "Chapitres SH" },
];
const AUTRES_PRODUITS = "Autres produits";

function ProduitsNace({ periode, famille, setFamille, sens, mesure, setMesure,
  principaux, gu, regroupes, chapitres }: {
  periode: Periode; famille: NaceFamille; setFamille: (f: NaceFamille) => void;
  sens: ZoneSens; mesure: NaceMesure; setMesure: (m: NaceMesure) => void;
  principaux: NaceData | null; gu: NaceDataGU | null;
  regroupes: NaceData | null; chapitres: NaceDataChap | null;
}) {
  const autre: ZoneSens = sens === "export" ? "import" : "export";
  const couleur = sens === "export" ? NACE_BLEU : NACE_ORANGE;

  const { lignes, totalPeriode } = useMemo(() => {
    const vide = { lignes: [] as LigneClassement[], totalPeriode: undefined };
    const source = famille === "principaux" ? principaux
      : famille === "regroupes" ? regroupes
      : famille === "groupes" ? gu : chapitres;
    if (!source?.disponible) return vide;
    // Chaque famille nomme sa modalité différemment ; on l'extrait par clé.
    const k = (r: Record<string, unknown>) =>
      String(r[famille === "groupes" ? "groupe" : famille === "chapitres" ? "chapitre" : "produit"]);
    const d = source.donnees as unknown as Record<ZoneSens, Record<string, unknown>[]>;
    const dd = d as unknown as Record<ZoneSens, (NaceLigneCle & Record<string, unknown>)[]>;
    const a = indexerNace(dd[sens], k, periode);
    const b = indexerNace(dd[autre], k, periode);
    // La variation annuelle n'a de terme de comparaison qu'en lecture d'une
    // seule année : sur un intervalle, la colonne est masquée.
    const pr = estIntervalle(periode) ? new Map<string, AgrNace>()
      : indexerNace(dd[sens], k, anneeSeule(periode.fin - 1));
    return {
      lignes: [...a.keys()].map(nom => ({
        cle: nom, nom,
        v: a.get(nom)?.v ?? null, p: a.get(nom)?.p ?? null,
        sv: a.get(nom)?.sv ?? null, sp: a.get(nom)?.sp ?? null,
        vAutre: b.get(nom)?.v ?? null, pAutre: b.get(nom)?.p ?? null,
        vPrec: pr.get(nom)?.v ?? null, pPrec: pr.get(nom)?.p ?? null,
      })),
      // Total de la portée calculé comme les lignes, mais sur la nomenclature
      // entière : en Min/Max, la somme des lignes ne le donnerait pas.
      totalPeriode: indexerNace(dd[sens], () => "∑", periode).get("∑"),
    };
  }, [famille, sens, autre, periode, principaux, gu, regroupes, chapitres]);

  const nom = FAMILLES_PRODUITS.find(f => f.v === famille)?.l ?? "Produits";

  // Le classeur reprend la sélection — sens, unité, période — mais couvre les
  // QUATRE nomenclatures et toutes leurs lignes : la bascule sert à comparer à
  // l'écran, elle n'a pas à amputer un fichier destiné au dépouillement.
  const exporter = async () => {
    const sources: { nom: string; colonne: string; cle: string;
                     src: { export: NaceLigneCle[]; import: NaceLigneCle[] } | null; balance: boolean;
                     agrege?: string }[] = [
      { nom: "Principaux produits", colonne: "Produit", cle: "produit", src: principaux?.disponible ? principaux.donnees : null, balance: false, agrege: AUTRES_PRODUITS },
      { nom: "Groupes d'utilisation", colonne: "Groupe", cle: "groupe", src: gu?.disponible ? gu.donnees : null, balance: true },
      { nom: "Produits regroupés", colonne: "Produit", cle: "produit", src: regroupes?.disponible ? regroupes.donnees : null, balance: false, agrege: AUTRES_PRODUITS },
      { nom: "Chapitres SH", colonne: "Chapitre", cle: "chapitre", src: chapitres?.disponible ? chapitres.donnees : null, balance: true },
    ];
    const feuilles = sources.filter(x => x.src).map(x => feuilleFamille(
      x.nom, x.colonne, x.src!, r => String((r as unknown as Record<string, unknown>)[x.cle]),
      sens, mesure, periode,
      { unite: mesure === "valeur" ? "M FCFA" : "tonnes", balance: x.balance, agregeSous: x.agrege }));
    await ecrireClasseurNace(
      `NACE_Produits_${sens === "export" ? "exportations" : "importations"}_${suffixeFichier(mesure, periode)}.xlsx`,
      contexteNace(mesure, periode), feuilles);
  };

  return (
    <TableauClassementNace
      lignes={lignes}
      // « Autres produits » ne clôt que les deux nomenclatures non
      // exhaustives ; groupes d'utilisation et chapitres SH couvrent tout.
      agregeSous={famille === "principaux" || famille === "regroupes" ? AUTRES_PRODUITS : undefined}
      sens={sens} mesure={mesure}
      colonne={famille === "groupes" ? "Groupe" : famille === "chapitres" ? "Chapitre" : "Produit"}
      // Seules les nomenclatures exhaustives listent les mêmes modalités dans
      // les deux sens, donc seules elles ont une balance par ligne.
      balance={famille === "groupes" || famille === "chapitres"}
      top={famille === "chapitres" ? 15 : 20}
      periode={periode} totalPeriode={totalPeriode}
      nomPortee={nom} totalLibelle="Ensemble"
      granularite={<SegmentNace options={FAMILLES_PRODUITS} valeur={famille} onChange={setFamille} accent={couleur} />}
      uniteBascule={
        <SegmentNace options={[{ v: "valeur" as NaceMesure, l: "Valeur" }, { v: "poids" as NaceMesure, l: "Volume" }]}
          valeur={mesure} onChange={setMesure} accent={couleur} />
      }
      actions={<BoutonExcel construire={exporter}
        titre={`Télécharger les quatre nomenclatures — ${sens === "export" ? "exportations" : "importations"}, ${mesure === "valeur" ? "valeur" : "volume"}, ${libellePeriode(periode)}`} />}
    />
  );
}

function CommerceExterieurPanel() {
  // Les huit familles NACE viennent du cache React Query : revenir sur
  // l'onglet raffiche sans squelette. Seule la famille principale bloque la
  // page ; les autres sections apparaissent chacune à l'arrivée de la sienne.
  const qData = useDonnees<NaceData>(`${API}/nace/principaux-produits`);
  const data = qData.data ?? null;
  const loading = qData.isPending;
  const erreur = qData.isError;
  // Une période par section, et non une seule pour tout l'onglet : on veut
  // pouvoir tenir un millésime sur les produits pendant qu'on en parcourt un
  // autre sur les zones. `null` = dernière année disponible, que l'on ne
  // connaît qu'une fois les données chargées.
  const [anKpi, setAnKpi] = useState<number | null>(null);
  const [perProd, setPerProd] = useState<Periode | null>(null);
  const [perZone, setPerZone] = useState<Periode | null>(null);
  const [perCont, setPerCont] = useState<Periode | null>(null);
  // Continent affiché en section 03 ; l'Afrique par défaut, premier partenaire
  // du Sénégal à l'export comme à l'import.
  const [contSel, setContSel] = useState("Afrique");
  const [contMesure, setContMesure] = useState<NaceMesure>("valeur");
  const [perGrp, setPerGrp] = useState<Periode | null>(null);
  const [grpMesure, setGrpMesure] = useState<NaceMesure>("valeur");
  // Groupement affiché en section 04. `null` = le premier de la liste, la
  // section n'ayant pas à présumer de ce que contient le référentiel.
  const [grpSel, setGrpSel] = useState<string | null>(null);
  const { data: groupementsData } = useDonnees<Groupement[]>(`${API}/nace/groupements`);
  const groupements = useMemo(() => Array.isArray(groupementsData) ? groupementsData : [], [groupementsData]);
  // Bascules de la section Produits : nomenclature, sens, unité.
  const [prodFamille, setProdFamille] = useState<NaceFamille>("principaux");
  const [prodSens, setProdSens] = useState<ZoneSens>("export");
  const [prodMesure, setProdMesure] = useState<NaceMesure>("valeur");
  // Portée et bascules de la zone géographique : remontées ici car leurs
  // commandes vivent dans l'en-tête de section.
  const [zonePortee, setZonePortee] = useState<ZonePortee>({ niveau: "continent", cont: null, reg: null });
  const [zoneSens, setZoneSens] = useState<ZoneSens>("export");
  const [zoneMesure, setZoneMesure] = useState<NaceMesure>("valeur");

  // Sections dédiées, non bloquantes : produits regroupés, groupes
  // d'utilisation et chapitres SH (repliés par défaut, 96 postes par sens)
  const reg = useDonnees<NaceData>(`${API}/nace/produits-regroupes`).data ?? null;
  const gu = useDonnees<NaceDataGU>(`${API}/nace/groupes-utilisation`).data ?? null;
  const chap = useDonnees<NaceDataChap>(`${API}/nace/chapitres`).data ?? null;
  const cont = useDonnees<NaceDataCont>(`${API}/nace/continents`).data ?? null;
  const reg2 = useDonnees<NaceDataReg>(`${API}/nace/regions`).data ?? null;
  // La famille pays est la plus lourde des sept (tous partenaires, toutes
  // années) : sans indicateur dédié, la section 03 surgirait après coup et
  // ferait sauter la page. On lui réserve sa place le temps du chargement.
  const qPys = useDonnees<NaceDataPays>(`${API}/nace/pays`);
  const pys = qPys.data ?? null;
  const pysEnCours = qPys.isPending;

  const annees = data?.annees ?? [];
  const dernier = annees[annees.length - 1] ?? 0;
  const an = anKpi ?? dernier;
  const lignesDe = useCallback((sens: "export" | "import", a: number) =>
    (data?.donnees[sens] ?? []).filter(r => r.annee === a), [data]);

  // Totaux annuels (somme des lignes = TOTAL du rapport à l'arrondi près)
  const totalDe = useCallback((sens: "export" | "import", a: number) => {
    const ls = lignesDe(sens, a);
    return ls.length ? ls.reduce((s, r) => s + (r.valeur ?? 0), 0) : null;
  }, [lignesDe]);

  const series = useMemo(() => {
    const sE = annees.map(a => ({ annee: a, valeur: totalDe("export", a) }));
    const sI = annees.map(a => ({ annee: a, valeur: totalDe("import", a) }));
    const sB = annees.map(a => {
      const e = totalDe("export", a), i = totalDe("import", a);
      return { annee: a, valeur: e != null && i != null ? e - i : null };
    });
    return { sE, sI, sB };
  }, [annees, totalDe]);

  // « À retenir » : faits saillants de l'année des KPIs, tous déduits des
  // données. Aucun texte en dur ne peut donc démentir les chiffres affichés
  // juste au-dessus, et la liste suit le curseur.
  const aRetenir = useMemo(() => {
    const somme = (l: { valeur: number | null }[]) => l.reduce((t, r) => t + (r.valeur ?? 0), 0);
    const exp = somme(data?.donnees.export.filter(r => r.annee === an) ?? []);
    const imp = somme(data?.donnees.import.filter(r => r.annee === an) ?? []);
    if (!exp && !imp) return [];
    const expP = somme(data?.donnees.export.filter(r => r.annee === an - 1) ?? []);
    const impP = somme(data?.donnees.import.filter(r => r.annee === an - 1) ?? []);
    const pct = (v: number | null) => v == null ? "—" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
    const m: string[] = [];
    if (expP && impP) {
      const dE = (exp - expP) / Math.abs(expP) * 100, dI = (imp - impP) / Math.abs(impP) * 100;
      m.push(`Les exportations ${dE >= 0 ? "progressent" : "reculent"} de ${pct(Math.abs(dE))} et les importations ${dI >= 0 ? "progressent" : "reculent"} de ${pct(Math.abs(dI))} par rapport à ${an - 1}.`);
      const soldeP = expP - impP;
      m.push(`Le déficit commercial ${Math.abs(exp - imp) > Math.abs(soldeP) ? "se creuse" : "se réduit"} : ${fmtMFCFA(exp - imp)} contre ${fmtMFCFA(soldeP)} en ${an - 1}, soit un taux de couverture de ${pct(imp ? exp / imp * 100 : null)}.`);
    }
    // Premier poste de chaque sens, « Autres produits » écarté : ce fourre-tout
    // domine le classement alors que ce n'est pas un produit.
    const premier = (sens: "export" | "import") => (data?.donnees[sens] ?? [])
      .filter(r => r.annee === an && r.produit !== "Autres produits")
      .sort((a, b) => (b.valeur ?? 0) - (a.valeur ?? 0))[0];
    const pe = premier("export"), pi = premier("import");
    if (pe) m.push(`Le premier poste d'exportation est « ${pe.produit.toLowerCase()} », ${pct(exp ? (pe.valeur ?? 0) / exp * 100 : null)} des ventes à l'étranger.`);
    if (pi) m.push(`Le premier poste d'importation est « ${pi.produit.toLowerCase()} », ${pct(imp ? (pi.valeur ?? 0) / imp * 100 : null)} des achats.`);
    const ce = classerPartenaires(pys, "export", anneeSeule(an), 1).lignes[0];
    const ci = classerPartenaires(pys, "import", anneeSeule(an), 1).lignes[0];
    // Tournures sans article : il dépendrait du nom du pays.
    if (ce) m.push(`Premier client du Sénégal : ${ce.nom}, ${pct(ce.part)} des exportations.`);
    if (ci) m.push(`Premier fournisseur : ${ci.nom}, ${pct(ci.part)} des importations.`);
    // Concentration : combien de clients absorbent la moitié des ventes.
    const tous = classerPartenaires(pys, "export", anneeSeule(an), 999).lignes;
    let c = 0, n = 0;
    for (const x of tous) { c += x.part ?? 0; n++; if (c >= 50) break; }
    if (c >= 50) m.push(`Les exportations sont concentrées : ${n} client${n > 1 ? "s" : ""} en absorbe${n > 1 ? "nt" : ""} la moitié.`);
    return m.slice(0, 6);
  }, [data, pys, an]);

  if (loading) return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 40px 80px", display: "grid", gap: 18 }}>
      <SkeletonKPIs n={4} />
      <SkeletonChartGrid n={1} cols={1} height={280} />
      <SkeletonRows n={8} h={32} />
    </div>
  );
  if (erreur) return <ErreurChargement onRetry={() => qData.refetch()} />;
  if (!data || !data.disponible) return <CommerceExterieurAttente />;

  const expTot = totalDe("export", an), impTot = totalDe("import", an);
  const expPrec = totalDe("export", an - 1), impPrec = totalDe("import", an - 1);
  // Période d'une section : par défaut la dernière année seule, comme avant.
  const per = (p: Periode | null): Periode => p ?? anneeSeule(dernier);
  // Commandes de période d'une section : le mode, puis le curseur. Passer en
  // intervalle l'ouvre sur toute la période couverte — point de départ naturel
  // d'une analyse pluriannuelle, que le curseur resserre ensuite. Revenir à
  // « Année » retient la dernière année de l'intervalle.
  const commandePeriode = (p: Periode | null, poser: (q: Periode) => void) => {
    const v = per(p);
    return (
      <>
        <SegmentNace options={MODES_PERIODE} valeur={v.intervalle ? "intervalle" : "annee"}
          onChange={m => poser(m === "annee" ? anneeSeule(v.fin)
            : { debut: annees[0], fin: dernier, intervalle: true })} />
        <CurseurPeriodeNace min={annees[0]} max={dernier} periode={v} onChange={poser} largeur={150} />
      </>
    );
  };
  const varDe = (v: number | null, prec: number | null) =>
    v != null && prec != null && prec !== 0 ? ((v - prec) / Math.abs(prec)) * 100 : null;
  const balance = expTot != null && impTot != null ? expTot - impTot : null;
  const balancePrec = expPrec != null && impPrec != null ? expPrec - impPrec : null;
  const taux = expTot != null && impTot != null && impTot !== 0 ? (expTot / impTot) * 100 : null;
  const tauxPrec = expPrec != null && impPrec != null && impPrec !== 0 ? (expPrec / impPrec) * 100 : null;
  const kpis = [
    { label: "Exportations", tag: "FAB", valeur: fmtMFCFA(expTot), variation: varDe(expTot, expPrec), rouge: false },
    { label: "Importations", tag: "CAF", valeur: fmtMFCFA(impTot), variation: varDe(impTot, impPrec), rouge: false },
    { label: "Balance commerciale", tag: "FAB − CAF", valeur: fmtMFCFA(balance), variation: null, rouge: (balance ?? 0) < 0,
      sous: balancePrec != null ? `${fmtMFCFA(balancePrec)} en ${an - 1}` : null },
    { label: "Taux de couverture", tag: null, valeur: taux != null ? `${taux.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—", variation: null, rouge: false,
      sous: tauxPrec != null ? `${tauxPrec.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % en ${an - 1}` : null },
  ];

  return (
    <div className="charge-in" style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 40px 80px" }}>
      {/* En-tête : titre + curseur des KPIs */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "var(--encre)", margin: 0 }}>Commerce extérieur du Sénégal</h2>
        <CurseurAnneeCommun min={annees[0]} max={dernier} value={an} onChange={setAnKpi} largeur={210} />
      </div>

      {/* KPIs de l'année */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.label} className="ds-carte" style={{ padding: "14px 16px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--bleu)", textTransform: "uppercase", lineHeight: 1.4, margin: 0 }}>{k.label}</p>
              {k.tag && <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--gris)", background: "var(--fond)", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{k.tag}</span>}
              <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--gris)", background: "var(--fond)", padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{an}</span>
            </div>
            <p className="ds-donnee" style={{ fontSize: "1.2rem", fontWeight: 800, color: k.rouge ? "var(--danger)" : "var(--encre)", lineHeight: 1.15, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.valeur}</p>
            <div style={{ marginTop: 6, minHeight: 14, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {k.variation != null && <Variation valeur={k.variation} annee={an - 1} taille={11} />}
              {"sous" in k && k.sous && <span style={{ fontSize: 10, color: "var(--gris)" }}>{k.sous}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* À retenir : ce que l'année dit, en quelques phrases */}
      {aRetenir.length > 0 && (
        <div className="ds-carte" style={{ padding: "18px 22px", marginBottom: 18,
          background: "linear-gradient(180deg, rgb(var(--bleu-rgb) / 0.05), rgb(var(--bleu-rgb) / 0.02))",
          border: "1px solid rgb(var(--bleu-rgb) / 0.14)" }}>
          <p style={{ fontSize: 10.5, fontWeight: 800, color: "var(--bleu)", letterSpacing: "0.12em",
            textTransform: "uppercase", margin: "0 0 12px" }}>À retenir</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: "9px 28px" }}>
            {aRetenir.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--bleu-action)", marginTop: 6.5, flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: "var(--encre)", margin: 0, lineHeight: 1.55, fontWeight: 500 }}>{t}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Évolution des échanges sur toute la période couverte */}
      <div className="ds-carte" style={{ padding: "18px 20px", marginBottom: 18 }}>
        <p style={{ fontSize: 10.5, fontWeight: 800, color: "var(--bleu)", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 12px" }}>
          Évolution des échanges — {annees[0]} à {annees[annees.length - 1]}
        </p>
        <GrapheSignature height={270} type="line" dualAxis={false} fmt={(v) => fmtMFCFA(v)} series={[
          { nom: "Exportations", couleur: NACE_BLEU, data: series.sE },
          { nom: "Importations", couleur: NACE_ORANGE, data: series.sI },
          { nom: "Balance", couleur: "var(--danger)", data: series.sB, dash: "6,4" },
        ]} />
      </div>

      {/* Produits : quatre nomenclatures du même commerce, de la plus
          synthétique à la plus fine. Elles ne s'emboîtent pas — ce sont
          quatre lectures indépendantes de l'ANSD — d'où une simple bascule,
          là où les zones géographiques se descendent au clic. */}
      {(() => {
        const p = per(perProd);
        const accent = prodSens === "export" ? NACE_BLEU : NACE_ORANGE;
        return (
          <>
            <EnTeteSectionNace n={1} titre="Produits" commandes={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <SegmentNace options={[{ v: "export" as ZoneSens, l: "Exportations" }, { v: "import" as ZoneSens, l: "Importations" }]}
                  valeur={prodSens} onChange={setProdSens} accent={accent} />
                {commandePeriode(perProd, setPerProd)}
              </div>
            } />
            <ProduitsNace periode={p} famille={prodFamille} setFamille={setProdFamille}
              sens={prodSens} mesure={prodMesure} setMesure={setProdMesure}
              principaux={data} gu={gu} regroupes={reg} chapitres={chap} />
          </>
        );
      })()}

      {/* Zone géographique : les trois granularités emboîtées du rapport
          (6 continents ⊃ 12 régions ⊃ ~190 pays). Bascules et curseur vivent
          dans l'en-tête ; la descente au clic agit sur la même portée. */}
      {(cont?.disponible || reg2?.disponible || pys?.disponible) && (() => {
        const p = per(perZone);
        const accent = zoneSens === "export" ? NACE_BLEU : NACE_ORANGE;
        return (
          <>
            <EnTeteSectionNace n={2} titre="Zone géographique" commandes={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <SegmentNace options={[{ v: "export" as ZoneSens, l: "Exportations" }, { v: "import" as ZoneSens, l: "Importations" }]}
                  valeur={zoneSens} onChange={setZoneSens} accent={accent} />
                {commandePeriode(perZone, setPerZone)}
              </div>
            } />
            <ZoneGeographique periode={p} cont={cont} reg={reg2} pys={pys}
              portee={zonePortee} setPortee={setZonePortee}
              sens={zoneSens} mesure={zoneMesure} setMesure={setZoneMesure} />

          </>
        );
      })()}


      {/* 03 · Partenaires par continent : un continent à la fois, sur toute la
          largeur — les cinq côte à côte tronquaient les noms et n'aidaient à
          comparer personne, chaque continent ayant ses propres partenaires. */}
      {pysEnCours && !pys && (
        <>
          <EnTeteSectionNace n={3} titre="Partenaires par continent" />
          <div className="ds-carte" style={{ padding: "18px 20px" }}><SkeletonRows n={10} h={30} /></div>
        </>
      )}
      {pys?.disponible && (() => {
        const p = per(perCont);
        const inter = estIntervalle(p);
        const ratt = reg2?.continents ?? pys.continents ?? {};
        const presents = CONTINENTS_ORDRE.filter(c => pys.donnees.export.some(
          r => r.annee >= p.debut && r.annee <= p.fin && ratt[r.region] === c));
        if (!presents.length) return null;
        // Un continent peut disparaître d'une année à l'autre : on retombe
        // alors sur le premier disponible plutôt que d'afficher une carte vide.
        const c = presents.includes(contSel) ? contSel : presents[0];
        const dansC = (r: NacePaysLigne) => ratt[r.region] === c;
        const clients = classerPartenaires(pys, "export", p, 10, contMesure, dansC);
        const fourn = classerPartenaires(pys, "import", p, 10, contMesure, dansC);
        // Tous les continents, pas seulement celui affiché : la bascule sert à
        // regarder, pas à décider de ce qu'on emporte.
        const exporterCont = () => ecrireClasseurNace(
          `NACE_Partenaires-par-continent_${suffixeFichier(contMesure, p)}.xlsx`,
          contexteNace(contMesure, p),
          feuillesPortees(pys, presents.map(x => ({ nom: x, garde: (r: NacePaysLigne) => ratt[r.region] === x })),
                          contMesure, p, true));
        return (
          <>
            <EnTeteSectionNace n={3} titre="Partenaires par continent" commandes={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <SegmentNace options={presents.map(x => ({ v: x, l: x }))} valeur={c} onChange={setContSel} />
                {commandePeriode(perCont, setPerCont)}
              </div>
            } />
            <div className="ds-carte" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Unité à droite de la note, comme la barre d'outils des
                  tableaux met Valeur/Volume à droite : même grammaire. */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <p style={{ fontSize: 11.5, color: "var(--gris)", fontWeight: 600, margin: 0, flex: 1, minWidth: 200 }}>
                  {inter ? `Classement par la somme ${p.debut}-${p.fin} des échanges ${AVEC_CONTINENT(c)}`
                    : `Parts calculées sur l'ensemble des échanges ${AVEC_CONTINENT(c)}`}
                </p>
                <SegmentNace options={[{ v: "valeur" as NaceMesure, l: "Valeur" }, { v: "poids" as NaceMesure, l: "Volume" }]}
                  valeur={contMesure} onChange={setContMesure} />
                <BoutonExcel construire={exporterCont}
                  titre={`Télécharger les ${presents.length} continents, clients et fournisseurs — ${contMesure === "valeur" ? "valeur" : "volume"}, ${libellePeriode(p)}`} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: inter ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))", gap: 22 }}>
                {/* Le rattachement régional est montré ici : dans un continent
                    donné il distingue les sous-ensembles — en Europe, la Suisse
                    et le Royaume-Uni relèvent des « autres pays », l'Espagne et
                    l'Italie de l'Union européenne. */}
                <TopPartenaires titre="Clients" lignes={clients.lignes} total={clients.total}
                  couleur={NACE_BLEU} montrerRegion intervalle={inter} mesure={contMesure} />
                <TopPartenaires titre="Fournisseurs" lignes={fourn.lignes} total={fourn.total}
                  couleur={NACE_ORANGE} montrerRegion intervalle={inter} mesure={contMesure} />
              </div>
            </div>
          </>
        );
      })()}

      {/* 04 · Partenaires par groupement économique : même lecture que la
          section 03, la portée étant cette fois une union régionale et non un
          continent. Le classement se limite aux membres, si bien que les parts
          se rapportent au seul commerce intra-groupement. */}
      {pysEnCours && !pys && (
        <>
          <EnTeteSectionNace n={4} titre="Partenaires par groupement économique" />
          <div className="ds-carte" style={{ padding: "18px 20px" }}><SkeletonRows n={8} h={30} /></div>
        </>
      )}
      {pys?.disponible && groupements.length > 0 && (() => {
        const p = per(perGrp);
        const inter = estIntervalle(p);
        const g = groupements.find(x => x.code === grpSel) ?? groupements[0];
        const membres = new Set(g.membres);
        // Le rapprochement au référentiel porte le code ISO : un partenaire
        // resté hors référentiel (code nul) ne peut appartenir à aucun
        // groupement, et « Autres pays » est déjà écarté du classement.
        const membre = (r: NacePaysLigne) => r.code_iso2 != null && membres.has(r.code_iso2);
        const clients = classerPartenaires(pys, "export", p, 20, grpMesure, membre);
        const fourn = classerPartenaires(pys, "import", p, 20, grpMesure, membre);
        // Tous les groupements du référentiel, pas seulement celui affiché.
        const exporterGrp = () => ecrireClasseurNace(
          `NACE_Partenaires-par-groupement_${suffixeFichier(grpMesure, p)}.xlsx`,
          [...contexteNace(grpMesure, p),
           `Composition des groupements : référentiel APIX — ${groupements.map(x => `${x.code} (${x.membres.length} membres)`).join(", ")}`],
          feuillesPortees(pys, groupements.map(x => {
            const m = new Set(x.membres);
            return { nom: x.code, garde: (r: NacePaysLigne) => r.code_iso2 != null && m.has(r.code_iso2) };
          }), grpMesure, p, false));
        if (!clients.lignes.length && !fourn.lignes.length) return null;
        return (
          <>
            <EnTeteSectionNace n={4} titre="Partenaires par groupement économique" commandes={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <SegmentNace options={groupements.map(x => ({ v: x.code, l: x.code }))} valeur={g.code} onChange={setGrpSel} />
                {commandePeriode(perGrp, setPerGrp)}
              </div>
            } />
            <div className="ds-carte" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {/* Le nom développé plutôt qu'un article accordé au sigle : il
                    dit ce que recouvre la bascule, et il vient du référentiel. */}
                <p style={{ fontSize: 11.5, color: "var(--gris)", fontWeight: 600, margin: 0, flex: 1, minWidth: 200 }}>
                  {inter ? `Classement par la somme ${p.debut}-${p.fin} des échanges avec les pays membres · ${g.nom_fr}`
                    : `Parts calculées sur l'ensemble des échanges avec les pays membres · ${g.nom_fr}`}
                </p>
                <SegmentNace options={[{ v: "valeur" as NaceMesure, l: "Valeur" }, { v: "poids" as NaceMesure, l: "Volume" }]}
                  valeur={grpMesure} onChange={setGrpMesure} />
                <BoutonExcel construire={exporterGrp}
                  titre={`Télécharger les ${groupements.length} groupements, clients et fournisseurs — ${grpMesure === "valeur" ? "valeur" : "volume"}, ${libellePeriode(p)}`} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: inter ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))", gap: 22 }}>
                {/* Pas de rattachement régional ici : tous les membres de la
                    CEDEAO comme de l'UEMOA relèvent de l'Afrique occidentale,
                    la colonne répéterait la même mention à chaque ligne. */}
                <TopPartenaires titre="Clients" lignes={clients.lignes} total={clients.total}
                  couleur={NACE_BLEU} intervalle={inter} mesure={grpMesure} />
                <TopPartenaires titre="Fournisseurs" lignes={fourn.lignes} total={fourn.total}
                  couleur={NACE_ORANGE} intervalle={inter} mesure={grpMesure} />
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

export default CommerceExterieurPanel;
