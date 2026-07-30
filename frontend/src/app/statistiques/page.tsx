"use client";

import NavActions from "@/components/layout/NavActions";
import GrapheSignature from "@/components/shared/GrapheMultiPays";
import BarreTitre, { BarreTitreSegment } from "@/components/shared/BarreTitre";
import { SkeletonKPIs, SkeletonChartGrid, SkeletonRows } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import { PALETTE_COMPARAISON as PALETTE, badge_gris, badgeDe } from "@/lib/couleurs";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fmtUnite as fmt, fmtUSD, fmtCompact as fmtValGen, fmtAxe } from "@/lib/format";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { d3, useD3Pret } from "@/lib/d3lazy";
import { ChevronDown, ChevronRight, FileSpreadsheet, Loader2, Plus, Search, SlidersHorizontal, Table, X } from "lucide-react";
import { badge_bleu, badge_orange } from "@/lib/couleurs";
import { useEtatUrl } from "@/lib/useEtatUrl";
import { drapeauEmoji } from "@/lib/drapeaux";
import PickerKpi, { BtnSwapKpi, STYLE_KPI_SWAP, type PickerItem } from "@/components/shared/PickerKpi";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardStatistiques";
import { GrapheConcentration } from "@/components/charts/GrapheConcentration";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Indicateur = { code: string; libelle: string; unite: string; categorie: string; ordre: number; derive: boolean };
type Pays = { id: number; nom: string; code_iso3: string; continent: string; region_geo: string | null };
type Donnee = { pays_id: number; pays: string; annee: number; indicateur: string; valeur: number | null };

// ── Regroupement des pays par continent ───────────────────────────────────────
const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie", "Autre"];
const MAX_KPI = 4;
const KPI_DEFAUT = ["population", "superficie", "pib", "pib_hab"];
function sortContinents(conts: string[]) {
  return [...conts].sort((a, b) => {
    const ia = CONT_ORDER.indexOf(a), ib = CONT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });
}

// ── Pastilles (pays / période) ────────────────────────────────────────────────
function BadgePeriode({ children }: { children: React.ReactNode }) {
  return <span style={{ ...badge_gris, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" as const }}>{children}</span>;
}
function BadgeSerie({ couleur, children }: { couleur: string; children: React.ReactNode }) {
  return (
    <span style={{ ...badgeDe(couleur), fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" as const }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: couleur, display: "inline-block", flexShrink: 0 }} />
      {children}
    </span>
  );
}

// Bouton « + » rond en pointillés → popover de sélection de pays (par continent,
// recherche à focus auto, reste ouvert pour ajouter plusieurs pays d'affilée).
function BtnAjoutPays({ pays, exclus, plein, onPick, onOpenChange }: {
  pays: Pays[]; exclus: number[]; plein: boolean; onPick: (id: number) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(""); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  useEffect(() => { if (plein && open) { setOpen(false); setQ(""); } }, [plein, open]);

  const dispo = pays.filter(p => !exclus.includes(p.id)
    && (!q || p.nom.toLowerCase().includes(q.toLowerCase())));
  const groupes = sortContinents([...new Set(dispo.map(p => p.continent || "Autre"))])
    .map(c => [c, dispo.filter(p => (p.continent || "Autre") === c).sort((a, b) => a.nom.localeCompare(b.nom, "fr"))] as [string, Pays[]]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button onClick={() => !plein && setOpen(o => !o)} disabled={plein}
        aria-label="Comparer avec d'autres pays" title={plein ? "4 pays maximum" : "Comparer avec d'autres pays"}
        style={{ width: 28, height: 28, borderRadius: 999, border: `1.5px dashed ${plein ? "#D8D4D0" : open ? "#004f91" : "rgba(0,79,145,0.35)"}`,
          background: open ? "rgba(0,79,145,0.08)" : "rgba(255,255,255,0.7)", color: plein ? "#C5BFBB" : "#004f91",
          cursor: plein ? "not-allowed" : "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}
        onMouseEnter={e => { if (!plein) { e.currentTarget.style.borderColor = "#004f91"; e.currentTarget.style.background = "rgba(0,79,145,0.08)"; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = plein ? "#D8D4D0" : "rgba(0,79,145,0.35)"; e.currentTarget.style.background = "rgba(255,255,255,0.7)"; } }}>
        <Plus size={14} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, width: 300,
          border: "1px solid #E4E1DE", borderRadius: 12, background: "#fff", boxShadow: "var(--ombre-2)", overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: "1px solid #F2F0EF" }}>
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un pays…"
              style={{ width: "100%", boxSizing: "border-box" as const, background: "#FCFCFB", borderWidth: 1, borderStyle: "solid", borderColor: "#E2E1DE", borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)" }} />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" as const }}>
            {groupes.map(([continent, liste]) => (
              <div key={continent}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.04)", padding: "5px 12px", letterSpacing: "0.1em", textTransform: "uppercase" as const, position: "sticky" as const, top: 0 }}>{continent}</div>
                {liste.map(p => (
                  <button key={p.id} onClick={() => { onPick(p.id); setQ(""); inputRef.current?.focus(); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" as const, borderBottom: "1px solid #F2F0EF", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,79,145,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize: 12, color: "#1a1a2e", fontWeight: 500 }}>{p.nom}</span>
                  </button>
                ))}
              </div>
            ))}
            {dispo.length === 0 && <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center" as const, padding: "14px 0" }}>Aucun pays trouvé</p>}
          </div>
        </div>
      )}
    </div>
  );
}

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

const NACE_BLEU = "#004f91";    // exportations
const NACE_ORANGE = "#ca631f";  // importations

// Montants NACE en millions de FCFA
function fmtMFCFA(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md FCFA`;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} M FCFA`;
}
// Poids NACE en tonnes
function fmtTonnes(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Mt`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kt`;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} t`;
}
function VariationNace({ v }: { v: number | null }) {
  if (v == null || !isFinite(v)) return <span style={{ fontSize: 10.5, color: "#C5BFBB" }}>—</span>;
  const pos = v > 0, neg = v < 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 800, color: pos ? "#188038" : neg ? "#dc2626" : "#9aa5b4", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
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
  libelles?: number;                               // > 1 : ligne agrégée
  ouvrable?: boolean;                              // descend d'un niveau au clic
};

// Somme tolérante aux trous : le rapport imprime « - » pour une absence
// d'échange, que l'API rend en null. null + null reste null (donnée absente),
// null + valeur vaut la valeur.
const sommeNace = (a: number | null | undefined, b: number | null | undefined) =>
  a == null && b == null ? null : (a ?? 0) + (b ?? 0);

// Indexe une famille par modalité pour une année donnée, en sommant les
// doublons éventuels (deux libellés du rapport visant la même modalité).
function indexerNace<T extends { annee: number; valeur: number | null; poids: number | null }>(
  lignes: T[], cle: (r: T) => string, annee: number,
): Map<string, { v: number | null; p: number | null }> {
  const m = new Map<string, { v: number | null; p: number | null }>();
  for (const r of lignes) {
    if (r.annee !== annee) continue;
    const k = cle(r), a = m.get(k);
    m.set(k, { v: sommeNace(a?.v, r.valeur), p: sommeNace(a?.p, r.poids) });
  }
  return m;
}

function TableauClassementNace({ lignes, agregeSous, sens, mesure, colonne, drapeaux, top,
  entete, nomPortee, totalLibelle, onOuvrir, montrerParent, libelleParent, balance = true,
  granularite, uniteBascule }: {
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
  granularite?: React.ReactNode; uniteBascule?: React.ReactNode;
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

  const rangees = lignes.filter(l => l.nom !== agregeSous).sort((x, y) => mv(y) - mv(x));
  const agregee = agregeSous ? lignes.find(l => l.nom === agregeSous) ?? null : null;
  // Le total est celui de la portée affichée, pour que « Part » et « Cumul »
  // restent interprétables après une descente ou un changement de famille.
  const total = lignes.reduce((s, l) => s + Math.max(0, mv(l)), 0);
  const max = Math.max(1e-9, ...rangees.map(mv));

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

  const EN_TETE: React.CSSProperties = { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase" };
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
        title={ouvrable ? `Voir le détail de « ${l.nom} »` : undefined}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8,
          cursor: ouvrable ? "pointer" : "default", transition: "background .12s",
          background: epingle ? "#F5F4F2" : rang != null && rang % 2 === 0 ? "#F8F9FB" : "transparent" }}
        onMouseEnter={e => { if (ouvrable) e.currentTarget.style.background = "#F0F4F9"; }}
        onMouseLeave={e => { if (ouvrable) e.currentTarget.style.background = rang != null && rang % 2 === 0 ? "#F8F9FB" : "transparent"; }}>
        <span style={{ width: 24, flexShrink: 0 }}>
          {rang != null && (
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 3px", borderRadius: 10,
              background: podium ? couleur : "#EFEDEA", color: podium ? "#fff" : "#9aa5b4", fontSize: 10, fontWeight: 800 }}>{rang}</span>
          )}
        </span>
        {drapeaux && (epingle
          ? <span style={{ width: 20, flexShrink: 0, textAlign: "center", fontSize: 13, lineHeight: 1 }}>🌐</span>
          : <DrapeauPays iso={l.iso2} nom={l.nom} />)}
        <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "baseline", gap: 7 }}>
          <span title={l.nom} style={{ fontSize: 12.5, fontWeight: epingle ? 600 : 650, fontStyle: epingle ? "italic" : "normal",
            color: epingle ? "#9aa5b4" : "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nom}</span>
          {epingle && l.libelles != null && l.libelles > 1 &&
            <span style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b4", flexShrink: 0 }}>({l.libelles})</span>}
          {!epingle && montrerParent && l.parent && (
            <span title={l.parent} style={{ fontSize: 9.5, fontWeight: 700, color: "#9aa5b4", whiteSpace: "nowrap", flexShrink: 0 }}>
              {libelleParent ? libelleParent(l.parent) : l.parent}
            </span>
          )}
          {ouvrable && <ChevronRight size={12} style={{ color: "#C5BFBB", flexShrink: 0 }} />}
        </span>
        <span className="ds-donnee" style={{ width: 88, fontSize: 11.5, fontWeight: 800, color: epingle ? "#9aa5b4" : couleur, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtV(mv(l))}</span>
        <span style={{ width: 38, fontSize: 10, fontWeight: 700, color: epingle ? "#9aa5b4" : "#4a5568", textAlign: "right", flexShrink: 0 }}>
          {total > 0 ? `${(Math.max(0, mv(l)) / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—"}
        </span>
        <span style={{ width: 40, fontSize: 10, fontWeight: 650, color: "#C5BFBB", textAlign: "right", flexShrink: 0 }}>
          {rang != null && total > 0 ? `${((cumulDe.get(l.cle) ?? 0) / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %` : ""}
        </span>
        <span style={{ width: 58, textAlign: "right", flexShrink: 0 }}><VariationNace v={delta} /></span>
        {balance && (
          <span className="ds-donnee" style={{ width: 92, fontSize: 11, fontWeight: 800, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
            color: bal > 0 ? "#188038" : bal < 0 ? "#dc2626" : "#C5BFBB" }}>
            {bal > 0 ? "+" : bal < 0 ? "−" : ""}{fmtV(Math.abs(bal))}
          </span>
        )}
        <div style={{ width: "11%", height: 7, background: "#F2F0EF", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
          {mv(l) > 0 && <div style={{ height: "100%", width: `${Math.min(100, Math.max(2, mv(l) / max * 100))}%`, borderRadius: 99, background: couleur, opacity: epingle ? 0.3 : podium ? 0.9 : 0.55 }} />}
        </div>
      </div>
    );
  };

  if (!lignes.length) return null;
  return (
    <div className="ds-carte" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Barre d'outils du tableau : granularité et fil d'Ariane à gauche,
          unité de mesure à droite */}
      {(granularite || entete || uniteBascule) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {granularite}
          {entete}
          {uniteBascule && <span style={{ marginLeft: "auto" }}>{uniteBascule}</span>}
        </div>
      )}

      {/* Recherche : utile dès que la portée dépasse la vingtaine de lignes */}
      {rangees.length > 20 && (
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9aa5b4" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…"
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            style={{ width: "100%", paddingLeft: 30, paddingRight: 28, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: "1px solid #E8E5E3", background: "#F8F7F6", fontSize: 12, color: "#1a1a2e", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
          {q && <button onMouseDown={e => e.preventDefault()} onClick={() => setQ("")} aria-label="Effacer la recherche"
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "#9aa5b4" }} /></button>}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
        <span style={{ ...EN_TETE, width: 24, flexShrink: 0 }}>#</span>
        {drapeaux && <span style={{ width: 20, flexShrink: 0 }} />}
        <span style={{ ...EN_TETE, flex: 1 }}>{colonne}</span>
        <span style={{ ...EN_TETE, width: 88, textAlign: "right", flexShrink: 0 }}>{sens === "export" ? "Export" : "Import"}</span>
        <span style={{ ...EN_TETE, width: 38, textAlign: "right", flexShrink: 0 }}>Part</span>
        <span style={{ ...EN_TETE, width: 40, textAlign: "right", flexShrink: 0 }}>Cumul</span>
        <span style={{ ...EN_TETE, width: 58, textAlign: "right", flexShrink: 0 }}>vs n-1</span>
        {balance && (
          <span title="Exportations − importations, quel que soit le sens affiché"
            style={{ ...EN_TETE, width: 92, textAlign: "right", flexShrink: 0 }}>Balance</span>
        )}
        <span style={{ width: "11%", flexShrink: 0 }} />
      </div>

      {filtres.length === 0 ? (
        <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center", padding: "18px 0" }}>Aucun résultat pour « {q} ».</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {visibles.map(l => <Ligne key={l.cle} l={l} rang={rangDe.get(l.cle) ?? null} />)}
          {!q && !focus && filtres.length > top && (
            <button onClick={() => setTout(t => !t)}
              style={{ margin: "4px 0 2px", padding: "7px 0", borderRadius: 8, border: "1px dashed #D8D4D0", background: "transparent", cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: couleur, fontFamily: "var(--font-google-sans)" }}>
              {tout ? `Réduire au top ${top}` : `Voir les ${filtres.length - top} autres`}
            </button>
          )}
          {agregee && !q && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "1px 8px" }}>
                <span style={{ width: 24, textAlign: "center", color: "#C5BFBB", fontSize: 12, fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>⋮</span>
                <span style={{ flex: 1, height: 1, background: "#F2F0EF" }} />
              </div>
              <Ligne l={agregee} rang={null} />
            </>
          )}
          {/* Somme de la portée : elle égale le total imprimé par l'ANSD */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderTop: "1px solid #F2F0EF", marginTop: 4 }}>
            <span style={{ width: 24, flexShrink: 0 }} />
            {drapeaux && <span style={{ width: 20, flexShrink: 0 }} />}
            <span style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "#4a5568", textTransform: "uppercase" }}>{totalLibelle}</span>
            <span className="ds-donnee" style={{ width: 88, fontSize: 11.5, fontWeight: 800, color: couleur, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>{fmtV(total)}</span>
            <span style={{ width: 38, flexShrink: 0 }} /><span style={{ width: 40, flexShrink: 0 }} /><span style={{ width: 58, flexShrink: 0 }} />
            {balance && (() => {
              const bal = lignes.reduce((s, l) => s + balanceDe(l), 0);
              return (
                <span className="ds-donnee" style={{ width: 92, fontSize: 11, fontWeight: 800, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap",
                  color: bal > 0 ? "#188038" : bal < 0 ? "#dc2626" : "#C5BFBB" }}>
                  {bal > 0 ? "+" : bal < 0 ? "−" : ""}{fmtV(Math.abs(bal))}
                </span>
              );
            })()}
            <span style={{ width: "11%", flexShrink: 0 }} />
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

// Curseur d'année : même geste et même rendu que ceux du tableau de bord, où
// il pilote les KPIs d'une section. Ici il pilote TOUT l'onglet — KPIs, courbe
// d'évolution, produits, zones géographiques et chapitres suivent l'année.
function CurseurAnneeNace({ min, max, value, onChange, largeur = 210 }: {
  min: number; max: number; value: number; onChange: (a: number) => void; largeur?: number;
}) {
  if (!(max > min)) return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
      <style>{`
        .nace-curseur { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 999px;
          background: rgba(0,79,145,0.18); outline: none; cursor: pointer; }
        .nace-curseur::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 15px; height: 15px;
          border-radius: 50%; background: #004f91; border: 2.5px solid #fff; box-shadow: var(--ombre-1); cursor: grab; }
        .nace-curseur::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.12); }
        .nace-curseur::-moz-range-thumb { width: 15px; height: 15px; border-radius: 50%;
          background: #004f91; border: 2.5px solid #fff; box-shadow: var(--ombre-1); cursor: grab; }
        .nace-curseur::-moz-range-track { height: 4px; border-radius: 999px; background: rgba(0,79,145,0.18); }
      `}</style>
      <span style={{ fontSize: 10, color: "#9aa5b4", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{min}</span>
      <input type="range" min={min} max={max} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="nace-curseur" aria-label="Année affichée" style={{ width: largeur }} />
      <span style={{ fontSize: 12, fontWeight: 800, color: "#004f91", background: "rgba(0,79,145,0.08)", padding: "3px 11px", borderRadius: 999, fontVariantNumeric: "tabular-nums", minWidth: 46, textAlign: "center", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

// Bascule segmentée compacte, teintée du sens affiché (bleu à l'export,
// orange à l'import) pour que les commandes s'accordent aux valeurs.
function SegmentNace<T extends string>({ options, valeur, onChange, accent }: {
  options: { v: T; l: string }[]; valeur: T; onChange: (v: T) => void; accent?: string;
}) {
  return (
    <div style={{ display: "inline-flex", background: "#F2F0EF", borderRadius: 999, padding: 2, gap: 2, flexShrink: 0 }}>
      {options.map(o => {
        const actif = o.v === valeur;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            border: "none", cursor: "pointer", padding: "4px 13px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
            background: actif ? "#fff" : "transparent", color: actif ? (accent ?? "#004f91") : "#6b7684",
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
      <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(0,79,145,0.09)", color: "#004f91",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
        {String(n).padStart(2, "0")}
      </span>
      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.01em", whiteSpace: "nowrap", flexShrink: 0 }}>{titre}</h3>
      {commandes}
      <div style={{ flex: 1, height: 1, background: "rgba(16,26,46,0.12)" }} />
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

function ZoneGeographique({ an, cont, reg, pys, portee, setPortee, sens, mesure, setMesure }: {
  an: number; cont: NaceDataCont | null; reg: NaceDataReg | null; pys: NaceDataPays | null;
  portee: ZonePortee; setPortee: (p: ZonePortee) => void;
  sens: ZoneSens; mesure: NaceMesure; setMesure: (m: NaceMesure) => void;
}) {
  const { niveau, cont: zoomCont, reg: zoomReg } = portee;
  const autre: ZoneSens = sens === "export" ? "import" : "export";
  const ratt = reg?.continents ?? pys?.continents ?? {};
  const badgeSens = sens === "export" ? badge_bleu : badge_orange;
  const couleur = sens === "export" ? NACE_BLEU : NACE_ORANGE;

  const lignes: LigneClassement[] = useMemo(() => {
    // Un triplet d'index par niveau : sens affiché, sens opposé (balance) et
    // année précédente (variation).
    const trois = <T extends NaceLigneCle>(src: { export: T[]; import: T[] }, k: (r: T) => string,
                                           garde: (r: T) => boolean = () => true) => ({
      a: indexerNace(src[sens].filter(garde), k, an),
      b: indexerNace(src[autre].filter(garde), k, an),
      pr: indexerNace(src[sens].filter(garde), k, an - 1),
    });
    const monter = (cles: string[], i: ReturnType<typeof trois>,
                    extra: (nom: string) => Partial<LigneClassement>) =>
      cles.map(nom => ({
        cle: nom, nom,
        v: i.a.get(nom)?.v ?? null, p: i.a.get(nom)?.p ?? null,
        vAutre: i.b.get(nom)?.v ?? null, pAutre: i.b.get(nom)?.p ?? null,
        vPrec: i.pr.get(nom)?.v ?? null, pPrec: i.pr.get(nom)?.p ?? null,
        ...extra(nom),
      }));

    if (niveau === "continent") {
      if (!cont?.disponible) return [];
      const i = trois(cont.donnees, r => r.continent);
      // « Divers » n'a pas de région : le clic n'y mènerait à rien.
      return monter([...i.a.keys()], i, nom => ({
        ouvrable: Object.values(ratt).includes(nom) && nom !== "Divers",
      }));
    }
    if (niveau === "region") {
      if (!reg?.disponible) return [];
      const i = trois(reg.donnees, r => r.region);
      const cles = [...i.a.keys()].filter(n => !zoomCont || ratt[n] === zoomCont);
      return monter(cles, i, nom => ({ parent: ratt[nom] ?? null, ouvrable: true }));
    }
    if (!pys?.disponible) return [];
    // Au niveau pays, toutes les lignes « Autres pays » de la portée sont
    // fondues en une seule : ce n'est pas un pays, il n'a donc pas de rang.
    const k = (r: NacePaysLigne) => (r.pays === AUTRES_PAYS ? AUTRES_PAYS : `${r.region}·${r.pays}`);
    const garde = (r: NacePaysLigne) =>
      (!zoomReg || r.region === zoomReg) && (!zoomCont || ratt[r.region] === zoomCont);
    const i = trois(pys.donnees, k, garde);
    // Métadonnées (nom affiché, drapeau, région) et nombre de libellés fondus.
    const meta = new Map<string, NacePaysLigne>();
    const fondus = new Map<string, number>();
    for (const r of pys.donnees[sens]) {
      if (r.annee !== an || !garde(r)) continue;
      const key = k(r);
      if (!meta.has(key)) meta.set(key, r);
      fondus.set(key, (fondus.get(key) ?? 0) + r.libelles);
    }
    return monter([...i.a.keys()], i, key => {
      const m = meta.get(key);
      return {
        nom: m?.pays ?? key, iso2: m?.code_iso2 ?? null,
        parent: key === AUTRES_PAYS ? null : m?.region ?? null,
        libelles: fondus.get(key) ?? 1,
      };
    });
  }, [niveau, sens, autre, an, cont, reg, pys, ratt, zoomCont, zoomReg]);

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
        <SegmentNace options={[{ v: "valeur" as NaceMesure, l: "Valeur" }, { v: "poids" as NaceMesure, l: "Poids" }]}
          valeur={mesure} onChange={setMesure} accent={couleur} />
      }
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
                {i > 0 && <ChevronRight size={12} style={{ color: "#C5BFBB" }} />}
                <button onClick={() => setPortee(c.p)} disabled={dernier}
                  style={dernier
                    ? { ...badgeSens, fontWeight: 700, cursor: "default", fontFamily: "var(--font-google-sans)" }
                    : { border: "none", background: "transparent", padding: "4px 11px", borderRadius: 999,
                        fontSize: 11, fontWeight: 600, color: "#6b7684", cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>
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

// ── Partenaires : classements de pays, dérivés de la même famille ────────────
// Ces blocs complètent le tableau navigable de la zone géographique : celui-ci
// répond à « comment se répartit tel niveau », ceux-ci à « qui sont les
// premiers partenaires », mondialement puis dans chaque continent.
type Partenaire = { nom: string; iso2: string | null; region: string; valeur: number; part: number | null };

// `continent` restreint la portée ; la part se rapporte alors à ce continent,
// non au total mondial — c'est la lecture utile quand on regarde une zone.
function classerPartenaires(pys: NaceDataPays | null, sens: ZoneSens, an: number,
                            ratt: Record<string, string>, continent: string | null, top: number,
): { lignes: Partenaire[]; total: number } {
  if (!pys?.disponible) return { lignes: [], total: 0 };
  const agg = new Map<string, Partenaire>();
  // Le dénominateur inclut « Autres pays », que le classement exclut : la part
  // est celle du total de la portée, comme dans le tableau ci-dessus. La
  // rapporter aux seuls partenaires nommés la gonflerait — le Mali passerait
  // de 20,5 à 21,9 % des exportations, et les deux blocs se contrediraient.
  let total = 0;
  for (const r of pys.donnees[sens]) {
    if (r.annee !== an) continue;
    if (continent && ratt[r.region] !== continent) continue;
    total += r.valeur ?? 0;
    if (r.pays === AUTRES_PAYS) continue;
    const e = agg.get(r.pays) ?? { nom: r.pays, iso2: r.code_iso2, region: r.region, valeur: 0, part: null };
    e.valeur += r.valeur ?? 0;
    agg.set(r.pays, e);
  }
  // Un partenaire sans échange sur l'année n'en est pas un : sans ce filtre,
  // l'Océanie alignerait des lignes à zéro.
  const lignes = [...agg.values()].filter(l => l.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur).slice(0, top)
    .map(l => ({ ...l, part: total ? l.valeur / total * 100 : null }));
  return { lignes, total };
}

function TopPartenaires({ titre, lignes, total, couleur, montrerRegion }: {
  titre: string; lignes: Partenaire[]; total: number; couleur: string; montrerRegion?: boolean;
}) {
  // Le maximum est celui de la colonne : les barres comparent les partenaires
  // entre eux dans un sens donné, pas les deux sens l'un contre l'autre.
  const max = Math.max(1, ...lignes.map(l => l.valeur));
  return (
    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, margin: "0 8px 2px" }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: "#9aa5b4", letterSpacing: "0.09em", textTransform: "uppercase" }}>{titre}</span>
        {/* Total de la portée : c'est le dénominateur des parts affichées. */}
        <span className="ds-donnee" style={{ fontSize: 11, fontWeight: 800, color: couleur, whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums" }}>{fmtMFCFA(total)}</span>
      </div>
      {lignes.length === 0
        ? <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center", padding: "14px 0" }}>Aucun échange.</p>
        : lignes.map((l, i) => (
          <div key={l.nom} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0,
            padding: "4px 8px", borderRadius: 8, background: i % 2 === 1 ? "#F8F9FB" : "transparent" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20,
              borderRadius: 999, background: i < 3 ? couleur : "#EFEDEA", color: i < 3 ? "#fff" : "#9aa5b4",
              fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
            <DrapeauPays iso={l.iso2} nom={l.nom} />
            <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "baseline", gap: 7 }}>
              <span title={l.nom} style={{ fontSize: 12.5, fontWeight: 650, color: "#1a1a2e",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nom}</span>
              {montrerRegion && (
                <span title={l.region} style={{ fontSize: 9.5, fontWeight: 700, color: "#9aa5b4", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {REGION_COURT[l.region] ?? l.region}
                </span>
              )}
            </span>
            <span className="ds-donnee" style={{ width: 88, fontSize: 11.5, fontWeight: 800, color: couleur, textAlign: "right",
              flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtMFCFA(l.valeur)}</span>
            <span style={{ width: 40, fontSize: 10, fontWeight: 700, color: "#4a5568", textAlign: "right", flexShrink: 0 }}>
              {l.part != null ? `${l.part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—"}
            </span>
            <div style={{ width: "16%", height: 7, background: "#F2F0EF", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
              <div style={{ height: "100%", width: `${Math.max(2, l.valeur / max * 100)}%`, borderRadius: 99,
                background: couleur, opacity: i < 3 ? 0.9 : 0.55 }} />
            </div>
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

function ProduitsNace({ an, famille, setFamille, sens, mesure, setMesure,
  principaux, gu, regroupes, chapitres }: {
  an: number; famille: NaceFamille; setFamille: (f: NaceFamille) => void;
  sens: ZoneSens; mesure: NaceMesure; setMesure: (m: NaceMesure) => void;
  principaux: NaceData | null; gu: NaceDataGU | null;
  regroupes: NaceData | null; chapitres: NaceDataChap | null;
}) {
  const autre: ZoneSens = sens === "export" ? "import" : "export";
  const couleur = sens === "export" ? NACE_BLEU : NACE_ORANGE;

  const lignes: LigneClassement[] = useMemo(() => {
    const source = famille === "principaux" ? principaux
      : famille === "regroupes" ? regroupes
      : famille === "groupes" ? gu : chapitres;
    if (!source?.disponible) return [];
    // Chaque famille nomme sa modalité différemment ; on l'extrait par clé.
    const k = (r: Record<string, unknown>) =>
      String(r[famille === "groupes" ? "groupe" : famille === "chapitres" ? "chapitre" : "produit"]);
    const d = source.donnees as unknown as Record<ZoneSens, Record<string, unknown>[]>;
    const dd = d as unknown as Record<ZoneSens, (NaceLigneCle & Record<string, unknown>)[]>;
    const a = indexerNace(dd[sens], k, an);
    const b = indexerNace(dd[autre], k, an);
    const pr = indexerNace(dd[sens], k, an - 1);
    return [...a.keys()].map(nom => ({
      cle: nom, nom,
      v: a.get(nom)?.v ?? null, p: a.get(nom)?.p ?? null,
      vAutre: b.get(nom)?.v ?? null, pAutre: b.get(nom)?.p ?? null,
      vPrec: pr.get(nom)?.v ?? null, pPrec: pr.get(nom)?.p ?? null,
    }));
  }, [famille, sens, autre, an, principaux, gu, regroupes, chapitres]);

  const nom = FAMILLES_PRODUITS.find(f => f.v === famille)?.l ?? "Produits";
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
      nomPortee={nom} totalLibelle="Ensemble"
      granularite={<SegmentNace options={FAMILLES_PRODUITS} valeur={famille} onChange={setFamille} accent={couleur} />}
      uniteBascule={
        <SegmentNace options={[{ v: "valeur" as NaceMesure, l: "Valeur" }, { v: "poids" as NaceMesure, l: "Poids" }]}
          valeur={mesure} onChange={setMesure} accent={couleur} />
      }
    />
  );
}

function CommerceExterieurPanel() {
  const [data, setData] = useState<NaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [tick, setTick] = useState(0);
  // Une année par section, et non une seule pour tout l'onglet : on veut
  // pouvoir tenir un millésime sur les produits pendant qu'on en parcourt un
  // autre sur les zones. `null` = dernière année disponible.
  const [anKpi, setAnKpi] = useState<number | null>(null);
  const [anProd, setAnProd] = useState<number | null>(null);
  const [anZone, setAnZone] = useState<number | null>(null);
  const [anCont, setAnCont] = useState<number | null>(null);
  // Continent affiché en section 03 ; l'Afrique par défaut, premier partenaire
  // du Sénégal à l'export comme à l'import.
  const [contSel, setContSel] = useState("Afrique");
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
  const [reg, setReg] = useState<NaceData | null>(null);
  const [gu, setGu] = useState<NaceDataGU | null>(null);
  const [cont, setCont] = useState<NaceDataCont | null>(null);
  const [reg2, setReg2] = useState<NaceDataReg | null>(null);
  const [pys, setPys] = useState<NaceDataPays | null>(null);
  // La famille pays est la plus lourde des sept (tous partenaires, toutes
  // années) : sans indicateur dédié, la section 03 surgirait après coup et
  // ferait sauter la page. On lui réserve sa place le temps du chargement.
  const [pysEnCours, setPysEnCours] = useState(true);
  const [chap, setChap] = useState<NaceDataChap | null>(null);
  useEffect(() => {
    setLoading(true); setErreur(false);
    fetch(`${API}/nace/principaux-produits`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData).catch(() => setErreur(true)).finally(() => setLoading(false));
    fetch(`${API}/nace/produits-regroupes`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setReg).catch(() => setReg(null));
    fetch(`${API}/nace/groupes-utilisation`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setGu).catch(() => setGu(null));
    fetch(`${API}/nace/chapitres`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setChap).catch(() => setChap(null));
    fetch(`${API}/nace/continents`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setCont).catch(() => setCont(null));
    fetch(`${API}/nace/regions`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setReg2).catch(() => setReg2(null));
    setPysEnCours(true);
    fetch(`${API}/nace/pays`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setPys).catch(() => setPys(null)).finally(() => setPysEnCours(false));
  }, [tick]);

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
    const ratt = reg2?.continents ?? pys?.continents ?? {};
    const ce = classerPartenaires(pys, "export", an, ratt, null, 1).lignes[0];
    const ci = classerPartenaires(pys, "import", an, ratt, null, 1).lignes[0];
    // Tournures sans article : il dépendrait du nom du pays.
    if (ce) m.push(`Premier client du Sénégal : ${ce.nom}, ${pct(ce.part)} des exportations.`);
    if (ci) m.push(`Premier fournisseur : ${ci.nom}, ${pct(ci.part)} des importations.`);
    // Concentration : combien de clients absorbent la moitié des ventes.
    const tous = classerPartenaires(pys, "export", an, ratt, null, 999).lignes;
    let c = 0, n = 0;
    for (const x of tous) { c += x.part ?? 0; n++; if (c >= 50) break; }
    if (c >= 50) m.push(`Les exportations sont concentrées : ${n} client${n > 1 ? "s" : ""} en absorbe${n > 1 ? "nt" : ""} la moitié.`);
    return m.slice(0, 6);
  }, [data, pys, reg2, an]);

  if (loading) return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 40px 80px", display: "grid", gap: 18 }}>
      <SkeletonKPIs n={4} />
      <SkeletonChartGrid n={1} cols={1} height={280} />
      <SkeletonRows n={8} h={32} />
    </div>
  );
  if (erreur) return <ErreurChargement onRetry={() => setTick(t => t + 1)} />;
  if (!data || !data.disponible) return <CommerceExterieurAttente />;

  const expTot = totalDe("export", an), impTot = totalDe("import", an);
  const expPrec = totalDe("export", an - 1), impPrec = totalDe("import", an - 1);
  // Curseur de section : mêmes bornes que celui des KPIs, état indépendant.
  const curseur = (valeur: number | null, poser: (a: number) => void) => (
    <CurseurAnneeNace min={annees[0]} max={dernier} value={valeur ?? dernier} onChange={poser} largeur={150} />
  );
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
        <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "#1a1a2e", margin: 0 }}>Commerce extérieur du Sénégal</h2>
        <CurseurAnneeNace min={annees[0]} max={dernier} value={an} onChange={setAnKpi} />
      </div>

      {/* KPIs de l'année */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.label} className="ds-carte" style={{ padding: "14px 16px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", color: "#004f91", textTransform: "uppercase", lineHeight: 1.4, margin: 0 }}>{k.label}</p>
              {k.tag && <span style={{ fontSize: 8.5, fontWeight: 700, color: "#9aa5b4", background: "#F2F0EF", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{k.tag}</span>}
              <span style={{ fontSize: 8.5, fontWeight: 700, color: "#9aa5b4", background: "#F2F0EF", padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{an}</span>
            </div>
            <p className="ds-donnee" style={{ fontSize: "1.2rem", fontWeight: 800, color: k.rouge ? "#dc2626" : "#1a1a2e", lineHeight: 1.15, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.valeur}</p>
            <div style={{ marginTop: 6, minHeight: 14, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {k.variation != null && <><VariationNace v={k.variation} /><span style={{ fontSize: 10, color: "#9aa5b4" }}>par rapport à {an - 1}</span></>}
              {"sous" in k && k.sous && <span style={{ fontSize: 10, color: "#9aa5b4" }}>{k.sous}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* À retenir : ce que l'année dit, en quelques phrases */}
      {aRetenir.length > 0 && (
        <div className="ds-carte" style={{ padding: "18px 22px", marginBottom: 18,
          background: "linear-gradient(180deg, rgba(0,79,145,0.05), rgba(0,79,145,0.02))",
          border: "1px solid rgba(0,79,145,0.14)" }}>
          <p style={{ fontSize: 10.5, fontWeight: 800, color: "#004f91", letterSpacing: "0.12em",
            textTransform: "uppercase", margin: "0 0 12px" }}>À retenir</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: "9px 28px" }}>
            {aRetenir.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "#004f91", marginTop: 6.5, flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: "#2c3646", margin: 0, lineHeight: 1.55, fontWeight: 500 }}>{t}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Évolution des échanges sur toute la période couverte */}
      <div className="ds-carte" style={{ padding: "18px 20px", marginBottom: 18 }}>
        <p style={{ fontSize: 10.5, fontWeight: 800, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 12px" }}>
          Évolution des échanges — {annees[0]} à {annees[annees.length - 1]}
        </p>
        <GrapheSignature height={270} type="line" dualAxis={false} fmt={(v) => fmtMFCFA(v)} series={[
          { nom: "Exportations", couleur: NACE_BLEU, data: series.sE },
          { nom: "Importations", couleur: NACE_ORANGE, data: series.sI },
          { nom: "Balance", couleur: "#dc2626", data: series.sB, dash: "6,4" },
        ]} />
      </div>

      {/* Produits : quatre nomenclatures du même commerce, de la plus
          synthétique à la plus fine. Elles ne s'emboîtent pas — ce sont
          quatre lectures indépendantes de l'ANSD — d'où une simple bascule,
          là où les zones géographiques se descendent au clic. */}
      {(() => {
        const a = anProd ?? dernier;
        const accent = prodSens === "export" ? NACE_BLEU : NACE_ORANGE;
        return (
          <>
            <EnTeteSectionNace n={1} titre="Produits" commandes={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <SegmentNace options={[{ v: "export" as ZoneSens, l: "Exportations" }, { v: "import" as ZoneSens, l: "Importations" }]}
                  valeur={prodSens} onChange={setProdSens} accent={accent} />
                {curseur(anProd, setAnProd)}
              </div>
            } />
            <ProduitsNace an={a} famille={prodFamille} setFamille={setProdFamille}
              sens={prodSens} mesure={prodMesure} setMesure={setProdMesure}
              principaux={data} gu={gu} regroupes={reg} chapitres={chap} />
          </>
        );
      })()}

      {/* Zone géographique : les trois granularités emboîtées du rapport
          (6 continents ⊃ 12 régions ⊃ ~190 pays). Bascules et curseur vivent
          dans l'en-tête ; la descente au clic agit sur la même portée. */}
      {(cont?.disponible || reg2?.disponible || pys?.disponible) && (() => {
        const a = anZone ?? dernier;
        const accent = zoneSens === "export" ? NACE_BLEU : NACE_ORANGE;
        return (
          <>
            <EnTeteSectionNace n={2} titre="Zone géographique" commandes={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <SegmentNace options={[{ v: "export" as ZoneSens, l: "Exportations" }, { v: "import" as ZoneSens, l: "Importations" }]}
                  valeur={zoneSens} onChange={setZoneSens} accent={accent} />
                {curseur(anZone, setAnZone)}
              </div>
            } />
            <ZoneGeographique an={a} cont={cont} reg={reg2} pys={pys}
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
        const a = anCont ?? dernier;
        const ratt = reg2?.continents ?? pys.continents ?? {};
        const presents = CONTINENTS_ORDRE.filter(c =>
          pys.donnees.export.some(r => r.annee === a && ratt[r.region] === c));
        if (!presents.length) return null;
        // Un continent peut disparaître d'une année à l'autre : on retombe
        // alors sur le premier disponible plutôt que d'afficher une carte vide.
        const c = presents.includes(contSel) ? contSel : presents[0];
        const clients = classerPartenaires(pys, "export", a, ratt, c, 10);
        const fourn = classerPartenaires(pys, "import", a, ratt, c, 10);
        return (
          <>
            <EnTeteSectionNace n={3} titre="Partenaires par continent" commandes={
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <SegmentNace options={presents.map(x => ({ v: x, l: x }))} valeur={c} onChange={setContSel} />
                {curseur(anCont, setAnCont)}
              </div>
            } />
            <div className="ds-carte" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 11.5, color: "#9aa5b4", fontWeight: 600, margin: 0 }}>
                Parts calculées sur l&apos;ensemble des échanges {AVEC_CONTINENT(c)}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 22 }}>
                {/* Le rattachement régional est montré ici : dans un continent
                    donné il distingue les sous-ensembles — en Europe, la Suisse
                    et le Royaume-Uni relèvent des « autres pays », l'Espagne et
                    l'Italie de l'Union européenne. */}
                <TopPartenaires titre="Clients" lignes={clients.lignes} total={clients.total} couleur={NACE_BLEU} montrerRegion />
                <TopPartenaires titre="Fournisseurs" lignes={fourn.lignes} total={fourn.total} couleur={NACE_ORANGE} montrerRegion />
              </div>
            </div>
          </>
        );
      })()}
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
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 1000, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>
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
  const [repart, setRepart] = useState<{ ressources: string[]; partenaires: { nom: string; code_iso2?: string | null; total: number; valeurs: number[] }[] } | null>(null);
  // Vue Cumul / année des deux tableaux : année choisie + données dédiées
  const [anneePoids, setAnneePoids] = useState<number | null>(null);
  const [anneeRepart, setAnneeRepart] = useState<number | null>(null);
  const [topsAnnee, setTopsAnnee] = useState<{ annee: number; data: typeof tops } | null>(null);
  const [repartAnnee, setRepartAnnee] = useState<{ annee: number; data: typeof repart } | null>(null);
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

  // Données d'une année précise pour les tableaux (bascule Cumul / année)
  const anneePoidsD = useDebounced(anneePoids, 250);
  const anneeRepartD = useDebounced(anneeRepart, 250);
  useEffect(() => {
    if (!selId || anneePoidsD === null) { setTopsAnnee(null); return; }
    const annee = anneePoidsD;
    const p = new URLSearchParams({ pays_id: String(selId), direction: vue, annees: String(annee) });
    if (ressources.length && ressSel.length && ressSel.length < ressources.length) p.set("ressources", ressSel.join(","));
    fetch(`${API}/statistiques/commerce/tops?${p.toString()}`)
      .then(r => r.json()).then(d => setTopsAnnee({ annee, data: d }))
      .catch(() => setTopsAnnee({ annee, data: null }));
  }, [vue, selId, anneePoidsD, ressSel, ressources.length]);
  useEffect(() => {
    if (!selId || anneeRepartD === null) { setRepartAnnee(null); return; }
    const annee = anneeRepartD;
    const p = new URLSearchParams({ pays_id: String(selId), direction: vue, annees: String(annee) });
    if (ressources.length && ressSel.length && ressSel.length < ressources.length) p.set("ressources", ressSel.join(","));
    fetch(`${API}/statistiques/commerce/repartition?${p.toString()}`)
      .then(r => r.json()).then(d => setRepartAnnee({ annee, data: d }))
      .catch(() => setRepartAnnee({ annee, data: null }));
  }, [vue, selId, anneeRepartD, ressSel, ressources.length]);

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
        {/* Header : pays → bascule Exportations/Importations → période */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#004f91", flexShrink: 0 }} />
          <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "#1a1a2e", margin: 0 }}>{selPays?.nom || "—"}</h2>
          <div style={{ display: "inline-flex", background: "#F2F0EF", borderRadius: 999, padding: 3, gap: 3, flexShrink: 0 }}>
            {VUES_COM.map(o => {
              const actif = vue === o.v;
              return (
                <button key={o.v} onClick={() => setVue(o.v)}
                  style={{ padding: "5px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" as const,
                    background: actif ? "#fff" : "transparent", color: actif ? "#004f91" : "#9aa5b4",
                    boxShadow: actif ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s", fontFamily: "var(--font-google-sans)" }}>
                  {o.v === "exportateur" ? "Exportations" : "Importations"}
                </button>
              );
            })}
          </div>
          <BadgePeriode>{perLabel}</BadgePeriode>
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
            { label: expDir ? `1er client · ${ref ?? "—"}` : `1er fournisseur · ${ref ?? "—"}`, sub: "", value: kpis?.top_partenaire?.nom || "—", indicatif: kpis?.top_partenaire ? `${fmtUSD(kpis.top_partenaire.valeur)} ${enRef}` : "", text: true },
            { label: `1re ressource · ${ref ?? "—"}`, sub: "", value: kpis?.top_ressource?.ressource || "—", indicatif: kpis?.top_ressource ? `${fmtUSD(kpis.top_ressource.valeur)} ${enRef}` : "", text: true },
            { label: expDir ? "Part du 1er client" : "Part du 1er fournisseur", sub: `Concentration · ${ref ?? "—"}`, value: kpis?.part_top_partenaire != null ? `${kpis.part_top_partenaire.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—", indicatif: kpis?.top_partenaire?.nom ? `${expDir ? "vers" : "depuis"} ${kpis.top_partenaire.nom}` : "", text: false },
          ];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20, opacity: chargKpis ? 0.5 : 1, transition: "opacity 0.15s" }}>
              {cards.map((c, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "13px 14px", border: "1px solid rgba(16,26,46,0.12)", boxShadow: "none", transition: "border-color 0.18s", minWidth: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,79,145,0.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(16,26,46,0.12)"; }}>
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
          const balSerie = [{ nom: "Balance commerciale", couleur: "#004f91", data: balance.map(b => ({ annee: b.annee, valeur: b.balance })) }];
          const fluxSerie = [{ nom: expDir ? "Exportations" : "Importations", couleur: "#004f91", data: balance.map(b => ({ annee: b.annee, valeur: expDir ? b.exportations : b.importations })) }];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 20 }}>
              {/* 1. Évolution du total exporté / importé */}
              <GrapheCard titre={expDir ? "Évolution des exportations" : "Évolution des importations"} series={fluxSerie} grapheId={`stat_flux_${vue}_${selId}`} hideLegend hideSousTitre
                fullChildren={<GrapheMultiPays series={fluxSerie} height={340} type="line" fmt={(v: number | null) => fmtUSD(v)} />}>
                <GrapheMultiPays series={fluxSerie} height={160} type="line" fmt={(v: number | null) => fmtUSD(v)} />
              </GrapheCard>
              {/* Balance commerciale (partagée) */}
              <GrapheCard titre="Balance commerciale" series={balSerie} grapheId={`stat_balance_${selId}`} hideLegend hideSousTitre
                fullChildren={<GrapheMultiPays series={balSerie} height={340} type="line" fmt={(v: number | null) => fmtUSD(v)} />}>
                <GrapheMultiPays series={balSerie} height={160} type="line" fmt={(v: number | null) => fmtUSD(v)} />
              </GrapheCard>
            </div>
          );
        })()}

        {/* 4 & 5. Poids des ressources & Concentration — Cumul ou année au curseur */}
        {(() => {
          const expDir = vue === "exportateur";
          // Données de l'année visée — undefined tant qu'elles ne sont pas
          // arrivées POUR cette année (debounce et requête compris) → skeleton
          const topsPourAnnee = topsAnnee && topsAnnee.annee === anneePoids ? topsAnnee.data : undefined;
          const repartPourAnnee = repartAnnee && repartAnnee.annee === anneeRepart ? repartAnnee.data : undefined;
          const chargTopsAnnee = anneePoids !== null && topsPourAnnee === undefined;
          const chargRepartAnnee = anneeRepart !== null && repartPourAnnee === undefined;
          // Poids des ressources : top 8 + « Autres » (cumul ou année choisie)
          const topsAff = anneePoids !== null ? (topsPourAnnee ?? null) : tops;
          let donutData: { label: string; valeur: number }[] = [];
          if (topsAff && topsAff.ressources.length) {
            const top8 = topsAff.ressources.slice(0, 8);
            donutData = top8.map(r => ({ label: r.ressource, valeur: r.valeur }));
            const autres = (topsAff.total || 0) - top8.reduce((s, r) => s + r.valeur, 0);
            if (autres > 0.0001 && topsAff.ressources.length > 8) donutData.push({ label: "Autres", valeur: autres });
          }
          const repartAff = anneeRepart !== null ? (repartPourAnnee ?? null) : repart;
          const parts = repartAff?.partenaires || [];
          const resLabels = repartAff?.ressources || [];
          // Les cards restent tant que le cumul a des données (une année creuse affiche un état vide)
          if (!(tops?.ressources?.length) && !(repart?.partenaires?.length)) return null;
          const carte: React.CSSProperties = { background: "#fff", borderRadius: 14, border: "1px solid rgba(16,26,46,0.12)", padding: "16px 18px", minWidth: 0 };
          const titreStyle: React.CSSProperties = { fontWeight: 700, fontSize: 13.5, color: "#1a1a2e", margin: 0 };
          const enTete: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" };
          const Vide = ({ annee }: { annee: number }) => (
            <p style={{ fontSize: 12, color: "#9aa5b4", textAlign: "center", padding: "22px 0" }}>Aucune donnée pour {annee}.</p>
          );
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              {(tops?.ressources?.length || 0) > 0 && (
                <div style={carte}>
                  <div style={enTete}>
                    <h3 style={titreStyle}>{expDir ? "Poids des ressources exportées" : "Poids des ressources importées"}</h3>
                    <BarreCumulAnnee annees={anneesTabs} annee={anneePoids} onAnnee={setAnneePoids} />
                  </div>
                  {anneePoids !== null && chargTopsAnnee
                    ? <SkeletonRows n={Math.max(3, donutData.length || 6)} h={26} />
                    : donutData.length > 0
                    ? <TableauPoidsRessources data={donutData} total={topsAff?.total || 0} />
                    : anneePoids !== null && <Vide annee={anneePoids} />}
                </div>
              )}
              {(repart?.partenaires?.length || 0) > 0 && (
                <div style={carte}>
                  <div style={enTete}>
                    <h3 style={titreStyle}>{expDir ? "Exportations par destination et ressource" : "Importations par origine et ressource"}</h3>
                    <BarreCumulAnnee annees={anneesTabs} annee={anneeRepart} onAnnee={setAnneeRepart} />
                  </div>
                  {anneeRepart !== null && chargRepartAnnee
                    ? <SkeletonRows n={Math.max(3, parts.length || 6)} h={30} />
                    : parts.length > 0
                    ? <TableauPartenairesRessources partenaires={parts} ressources={resLabels} />
                    : anneeRepart !== null && <Vide annee={anneeRepart} />}
                </div>
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

// ── Bascule Cumul / année des tableaux de flux ────────────────────────────────
// Un seul curseur continu (non contrôlé : fluidité native) : tout à droite le
// Cumul de la période, puis en glissant vers la gauche les années en ordre
// décroissant. La pastille reflète la position (Cumul ou l'année).
function BarreCumulAnnee({ annees, annee, onAnnee }: { annees: number[]; annee: number | null; onAnnee: (a: number | null) => void }) {
  if (annees.length < 2) return null;
  // Positions 0..n-1 = années croissantes, position n = Cumul (extrémité droite)
  const n = annees.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
      <input type="range" min={0} max={n} step="any" defaultValue={n}
        onInput={e => { const i = Math.round(Number((e.target as HTMLInputElement).value)); onAnnee(i >= n ? null : annees[i]); }}
        aria-label="Cumul ou année"
        style={{ width: 190, accentColor: "#004f91", cursor: "pointer" }} />
      <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 11px", borderRadius: 999, background: "#004f91", color: "#fff", flexShrink: 0, minWidth: 44, textAlign: "center" }}>
        {annee ?? "Cumul"}
      </span>
    </span>
  );
}

// ── Tableau du poids des ressources (Flux bilatéraux) ─────────────────────────
// Tableau fixe : ressource · valeur · part du total · barre, total en pied.
function TableauPoidsRessources({ data, total }: { data: { label: string; valeur: number }[]; total: number }) {
  const somme = total || data.reduce((s, d) => s + d.valeur, 0) || 1;
  const max = Math.max(1e-9, ...data.map(d => d.valeur));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 2px" }}>
        <span style={{ flex: 1, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase" }}>Ressource</span>
        <span style={{ width: 84, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase", textAlign: "right" }}>Valeur</span>
        <span style={{ width: 56, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase", textAlign: "right" }}>Part</span>
        <span style={{ width: "34%", flexShrink: 0 }} />
      </div>
      {data.map((d, i) => {
        const autres = d.label === "Autres";
        const zebre = i % 2 === 1;
        return (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, background: zebre ? "#F8F9FB" : "transparent", transition: "background 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,79,145,0.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = zebre ? "#F8F9FB" : "transparent"; }}>
            <span title={d.label} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: autres ? "#9aa5b4" : "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <span style={{ width: 84, fontSize: 11.5, fontWeight: 800, color: autres ? "#9aa5b4" : "#004f91", textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>{fmtUSD(d.valeur)}</span>
            <span style={{ width: 56, fontSize: 10.5, fontWeight: 700, color: "#4a5568", textAlign: "right", flexShrink: 0 }}>{(d.valeur / somme * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span>
            <div style={{ width: "34%", height: 8, background: "#F2F0EF", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
              <div style={{ height: "100%", width: `${Math.max(1.5, d.valeur / max * 100)}%`, borderRadius: 99, background: autres ? "#C5BFBB" : "#004f91", opacity: autres ? 0.6 : 0.8 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tableau des flux par partenaire et ressource (Flux bilatéraux) ────────────
// Matrice fixe pays × ressources : rang (top 3 en bleu), drapeau, lignes
// zébrées, plus grande valeur de chaque pays en vert, colonne Total en bleu.

// Drapeau emoji (liste validée), image flagcdn sinon, globe pour les
// partenaires sans pays (« Bunkers », zones spéciales…)
function DrapeauPays({ iso, nom }: { iso?: string | null; nom: string }) {
  if (iso) {
    const emoji = drapeauEmoji(iso);
    if (emoji) return <span title={nom} style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`} alt="" title={nom}
      style={{ width: 20, height: 14, objectFit: "cover", borderRadius: 2.5, boxShadow: "0 0 0 1px rgba(15,40,80,0.14)", flexShrink: 0 }} />;
  }
  return <span title={nom} style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>🌐</span>;
}

function TableauPartenairesRessources({ partenaires, ressources }: {
  partenaires: { nom: string; code_iso2?: string | null; total: number; valeurs: number[] }[]; ressources: string[];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px 6px 8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase", borderBottom: "1px solid #ECEAE7", width: 34 }}>#</th>
            <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#9aa5b4", textTransform: "uppercase", borderBottom: "1px solid #ECEAE7" }}>Pays</th>
            {ressources.map(r => (
              <th key={r} style={{ textAlign: "right", padding: "8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", color: "#9aa5b4", textTransform: "uppercase", borderBottom: "1px solid #ECEAE7", whiteSpace: "nowrap" }}>{r}</th>
            ))}
            <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#004f91", textTransform: "uppercase", borderBottom: "1px solid #ECEAE7" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {partenaires.map((p, i) => {
            // Ressource dominante du partenaire : sa valeur ressort en vert
            const vMax = Math.max(0, ...p.valeurs.map(v => v ?? 0));
            const zebre = i % 2 === 1;
            const podium = i < 3;
            return (
            <tr key={p.nom} style={{ background: zebre ? "#F8F9FB" : "transparent", transition: "background 0.12s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(0,79,145,0.05)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = zebre ? "#F8F9FB" : "transparent"; }}>
              <td style={{ padding: "7px 6px 7px 10px", borderBottom: "1px solid #F2F0EF" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%",
                  background: podium ? "#004f91" : "#EFEDEA", color: podium ? "#fff" : "#9aa5b4", fontSize: 10.5, fontWeight: 800 }}>{i + 1}</span>
              </td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid #F2F0EF" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  <DrapeauPays iso={p.code_iso2} nom={p.nom} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1a1a2e", whiteSpace: "nowrap" }}>{p.nom}</span>
                </span>
              </td>
              {ressources.map((r, ri) => {
                const v = p.valeurs[ri] ?? 0;
                const dominante = v > 0 && v === vMax;
                return <td key={r} style={{ padding: "7px 10px", fontSize: 11.5, fontWeight: dominante ? 800 : v > 0 ? 600 : 400, color: dominante ? "#188038" : v > 0 ? "#1a1a2e" : "#C5BFBB", textAlign: "right", whiteSpace: "nowrap", borderBottom: "1px solid #F2F0EF", fontVariantNumeric: "tabular-nums" }}>{v > 0 ? fmtUSD(v) : "—"}</td>;
              })}
              <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 800, color: "#004f91", textAlign: "right", whiteSpace: "nowrap", borderBottom: "1px solid #F2F0EF", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(p.total)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
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
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>
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
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 1200, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>
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
  // Slot (0-3) dont le picker de remplacement est ouvert ; -1 = aucun
  const [pickerSlot, setPickerSlot] = useState(-1);
  // Popover d'ajout de pays ouvert → floute la zone KPIs + graphes derrière lui
  const [popoverOpen, setPopoverOpen] = useState(false);

  const MAX_SEL = 4; // 4 pays au plus en comparaison (comme la page IDE)
  // La vue bascule d'elle-même en comparatif dès qu'un 2ᵉ pays est ajouté.
  const estComparatif = selection.length > 1;
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

  const toggleCont = (c: string) => setOpenConts(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  // Remplacement en place (slot occupé) ou ajout (slot vide) du KPI choisi
  const remplacerKpi = (slot: number, code: string) => {
    setKpisEpingles(prev => slot < prev.length ? prev.map((c, i) => i === slot ? code : c) : [...prev, code]);
    setPickerSlot(-1);
  };

  // Ajout/retrait d'un pays : bascule automatiquement en comparatif au 2ᵉ pays ;
  // il en reste toujours au moins un ; plafond à MAX_SEL séries.
  const clickPays = (id: number) => {
    setSelection(prev => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter(x => x !== id) : prev;
      if (prev.length >= MAX_SEL) return prev;
      return [...prev, id];
    });
  };
  const retirerPays = (id: number) => setSelection(prev => prev.length > 1 ? prev.filter(x => x !== id) : prev);

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
  const indicateursAffiches = kpisEpingles.map(c => indicateurs.find(i => i.code === c)).filter(Boolean) as Indicateur[];

  const valeur = (paysId: number, code: string, annee: number) =>
    donnees.find(d => d.pays_id === paysId && d.indicateur === code && d.annee === annee)?.valeur ?? null;

  // Indicateurs proposés au remplacement (non épinglés), liste à plat
  const pickerItems: PickerItem[] = indicateurs.filter(i => !kpisEpingles.includes(i.code)).map(i => ({
    id: i.code, label: i.libelle, badge: refAnnee ? String(refAnnee) : null,
    valeur: fmt(selection.length ? valeur(selection[0], i.code, refAnnee) : null, i.unite),
    title: i.libelle,
  }));

  // État des filtres (pour badge + réinitialisation)
  const paysChange = selection.length > 1 || selection[0] !== senId;
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
                <span style={{ fontSize: 10, fontWeight: 700, color: "#004f91", background: "rgba(0,79,145,0.18)", padding: "1px 6px", borderRadius: 999 }}>{`${selection.length}/${MAX_SEL}`}</span>
              </div>
              {/* Sénégal épinglé (référence) */}
              {senId !== null && (() => {
                const sel = selection.includes(senId);
                const col = sel ? couleurPays(senId) : "#C5BFBB";
                return (
                  <div style={{ marginBottom: 8, marginLeft: 6 }}>
                    <button onClick={() => clickPays(senId)}
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
                            const disabled = !sel && selection.length >= MAX_SEL;
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
              {(() => {
                const perLabel = modeAnnees === "specifiques" && anneesSpec.length > 0
                  ? (anneesSpec.length === 1 ? `${anneesSpec[0]}` : `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length - 1]}`)
                  : `${anneeMin} — ${anneeMax}`;
                // Graphes : jeu fixe, indépendant des KPIs épinglés — indicateurs
                // par défaut (hors superficie) + densité de population et les 4
                // flux de commerce extérieur dès qu'un pays sélectionné a des données.
                const TRADE_CODES = ["importations_marchandises", "exportations_marchandises", "importations_services", "exportations_services"];
                const GRAPHES_SUP = ["densite", ...TRADE_CODES];
                const aDesDonnees = (code: string) => selection.some(id => anneesActives.some(a => valeur(id, code, a) !== null));
                const baseCodes = KPI_DEFAUT.filter(c => c !== "superficie");
                const codesGraphes = [...baseCodes, ...GRAPHES_SUP.filter(c => !baseCodes.includes(c) && aDesDonnees(c))];
                const graphIndics = codesGraphes.map(c => indicateurs.find(i => i.code === c)).filter(Boolean) as Indicateur[];
                return (
                <>
                  {/* Header : pays (ou pastilles en comparatif) → « + » → période */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" as const }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const, minWidth: 0 }}>
                      {estComparatif ? (
                        selection.map(id => (
                          <BadgeSerie key={id} couleur={couleurPays(id)}>
                            {paysNom(id)}
                            <button onClick={() => retirerPays(id)} aria-label={`Retirer ${paysNom(id)}`}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "inherit" }}>
                              <X size={11} />
                            </button>
                          </BadgeSerie>
                        ))
                      ) : (
                        <>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#004f91", flexShrink: 0 }} />
                          <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "#1a1a2e", margin: 0 }}>{paysNom(selection[0])}</h2>
                        </>
                      )}
                      <BtnAjoutPays pays={pays} exclus={selection} plein={selection.length >= MAX_SEL} onPick={clickPays} onOpenChange={setPopoverOpen} />
                      <BadgePeriode>{perLabel}</BadgePeriode>
                    </div>
                    <BoutonDonnees onClick={() => setShowTable(true)} dep={selection.join(",")} />
                  </div>

                  {/* KPIs + graphes — floutés tant que le popover d'ajout de pays est ouvert */}
                  <div style={{ filter: popoverOpen ? "blur(4px)" : "none", opacity: popoverOpen ? 0.6 : 1, pointerEvents: popoverOpen ? "none" : "auto", transition: "filter 0.2s, opacity 0.2s" }}>
                    {/* KPI cards — uniquement en vue pays (les KPIs ne concernent que le pays de référence),
                        remplaçables via l'icône révélée au survol */}
                    {!estComparatif && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
                        <style>{STYLE_KPI_SWAP}</style>
                        {indicateursAffiches.map((ind, slot) => {
                          const v = valeur(selection[0], ind.code, refAnnee);
                          const prec = valeur(selection[0], ind.code, refAnnee - 1);
                          const pickerOuvert = pickerSlot === slot;
                          return (
                            <div key={ind.code} className="kpi-card" onClick={() => setKpiActif({ ind, valeur: v, annee: refAnnee, precedent: prec })}
                              style={{ position: "relative", background: "#fff", borderRadius: 14, padding: "13px 14px", border: `1px solid ${pickerOuvert ? "rgba(0,79,145,0.35)" : "rgba(16,26,46,0.12)"}`, cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s", boxShadow: "none", minWidth: 0, zIndex: pickerOuvert ? 5 : undefined }}
                              onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--ombre-1)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(0,79,145,0.35)"; }}
                              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = pickerOuvert ? "rgba(0,79,145,0.35)" : "rgba(16,26,46,0.12)"; }}>
                              <BtnSwapKpi ouvert={pickerOuvert} onClick={() => setPickerSlot(pickerOuvert ? -1 : slot)} />
                              <div style={{ marginBottom: 7, paddingRight: 26 }}>
                                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#004f91", textTransform: "uppercase", lineHeight: 1.4 }}>{ind.libelle}</p>
                                <p style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.06em", color: "#9aa5b4", textTransform: "uppercase", marginTop: 2, lineHeight: 1.3 }}>Dernière année</p>
                              </div>
                              <p style={{ fontSize: "1.15rem", fontWeight: 800, color: ind.unite === "%" && v !== null && v < 0 ? "#dc2626" : "#1a1a2e", lineHeight: 1 }}>{fmt(v, ind.unite)}</p>
                              <p style={{ fontSize: 10, color: "#9aa5b4", marginTop: 5, lineHeight: 1 }}>en {refAnnee}</p>
                              {pickerOuvert && (
                                <PickerKpi items={pickerItems} alignDroite={slot >= 2}
                                  onPick={c => remplacerKpi(slot, c)} onClose={() => setPickerSlot(-1)} />
                              )}
                            </div>
                          );
                        })}
                        {Array.from({ length: Math.max(0, MAX_KPI - indicateursAffiches.length) }).map((_, i) => {
                          const slot = indicateursAffiches.length + i;
                          const pickerOuvert = pickerSlot === slot;
                          return (
                            <div key={`empty-${i}`} data-picker-trigger onClick={() => setPickerSlot(pickerOuvert ? -1 : slot)}
                              style={{ position: "relative", background: "#fff", borderRadius: 14, padding: "13px 14px", border: `1.5px dashed ${pickerOuvert ? "#004f91" : "#E8E5E3"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 90, cursor: "pointer", transition: "border-color 0.15s", zIndex: pickerOuvert ? 5 : undefined }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = "#004f91"; }}
                              onMouseLeave={e => { if (!pickerOuvert) e.currentTarget.style.borderColor = "#E8E5E3"; }}>
                              <span style={{ fontSize: 20, color: pickerOuvert ? "#004f91" : "#C5BFBB", lineHeight: 1 }}>+</span>
                              <span style={{ fontSize: 10, color: pickerOuvert ? "#004f91" : "#C5BFBB", textAlign: "center", lineHeight: 1.5 }}>Ajouter un<br />indicateur</span>
                              {pickerOuvert && (
                                <PickerKpi items={pickerItems} alignDroite={slot >= 2}
                                  onPick={c => remplacerKpi(slot, c)} onClose={() => setPickerSlot(-1)} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Graphes — floutés tant qu'un picker de remplacement de KPI est ouvert */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, filter: pickerSlot !== -1 ? "blur(4px)" : "none", opacity: pickerSlot !== -1 ? 0.6 : 1, pointerEvents: pickerSlot !== -1 ? "none" : "auto", transition: "filter 0.2s, opacity 0.2s" }}>
                      {graphIndics.map(ind => {
                        const series = selection.map(id => ({ nom: paysNom(id), couleur: couleurPays(id), data: anneesActives.map(a => ({ annee: a, valeur: valeur(id, ind.code, a) })) }));
                        return (
                          <GrapheCard key={ind.code} titre={ind.libelle} series={series} grapheId={`stat_${estComparatif ? "cmp_" : ""}${ind.code}`} hideLegend hideSousTitre
                            fullChildren={<GrapheMultiPays series={series} height={340} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} lineWidth={estComparatif ? 1.6 : undefined} />}>
                            <GrapheMultiPays series={series} height={145} type="line" fmt={(v: number | null) => fmt(v, ind.unite)} showDots={!estComparatif} lineWidth={estComparatif ? 1.4 : undefined} />
                          </GrapheCard>
                        );
                      })}
                    </div>
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