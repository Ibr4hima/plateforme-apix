"use client";
import { useEchap } from "@/lib/useEchap";
import { useDialogue } from "@/lib/dialogue";
import GrapheSignature from "@/components/shared/GrapheMultiPays";
import { Fragment, useEffect, useRef, useState } from "react";
import { badge_bleu, badge_orange, badge_vert, badge_violet, badge_gris, badgeDe, voile } from "@/lib/couleurs";
import { X, Plus, Table, ChevronDown, FileSpreadsheet } from "lucide-react";
import { fmtKpi, type KpiResult } from "@/lib/ideKpis";
import { fmtMillionsUSD } from "@/lib/format";
import { IconeCached } from "@/components/shared/PickerKpi";
import { CurseurAnneeNace } from "@/components/shared/CurseurNace";


import { API_BASE as API } from "@/lib/api";
export { API };

// Valeurs CNUCED en millions USD → formatteur partagé (fr-FR, « Md $ / M $ »)
export const fmtVal = fmtMillionsUSD;

// ── Pastilles d'en-tête (période + séries) — styles badge_* de la plateforme ──
// Les 4 premières séries suivent les 4 teintes canoniques ; au-delà, badgeDe().
const BADGES_4 = [badge_bleu, badge_orange, badge_vert, badge_violet];
export function BadgePeriode({ children }: { children: React.ReactNode }) {
  return <span style={{ ...badge_gris, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" as const }}>{children}</span>;
}
export function BadgeSerie({ i, couleur, title, children }: { i: number; couleur: string; title?: string; children: React.ReactNode }) {
  return (
    <span title={title} style={{ ...(BADGES_4[i] ?? badgeDe(couleur)), fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" as const }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: couleur, display: "inline-block", flexShrink: 0 }} />
      {children}
    </span>
  );
}

// Séries par sous-type de données IDE (graphes, tableau de données, export).
// entrant = destination/ventes, sortant = source/achats selon la catégorie.
export const SERIES_TYPES: Record<string, { dir: string; ind: string; label: string; unite: "musd" | "nombre" }[]> = {
  fluxstock: [
    { dir: "entrant", ind: "flux",  label: "Flux entrants", unite: "musd" },
    { dir: "sortant", ind: "flux",  label: "Flux sortants", unite: "musd" },
    { dir: "entrant", ind: "stock", label: "Stock entrant", unite: "musd" },
    { dir: "sortant", ind: "stock", label: "Stock sortant", unite: "musd" },
  ],
  greenfield: [
    { dir: "entrant", ind: "greenfield_valeur", label: "Valeur des investissements greenfield reçus",             unite: "musd" },
    { dir: "sortant", ind: "greenfield_valeur", label: "Investissements greenfield émis à l'étranger", unite: "musd" },
    { dir: "entrant", ind: "greenfield_nombre", label: "Nombre de projets greenfield reçus",                      unite: "nombre" },
    { dir: "sortant", ind: "greenfield_nombre", label: "Nombre de projets greenfield émis à l'étranger",          unite: "nombre" },
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
export const fmtNombre = (v: number | null) => v === null || v === undefined ? "N/A" : Math.round(v).toLocaleString("fr-FR");

// ── Navigation entre catégories d'investissement ──────────────────────────────
// Sélecteur principal de la zone de contenu : Flux & Stocks / Greenfield / M&A.
const SOUS_TYPE_NAV = [
  { v: "fluxstock",  l: "Flux & Stocks" },
  { v: "greenfield", l: "Greenfield" },
  { v: "fusion",     l: "Fusion & Acquisition" },
] as const;

// ── Sélecteur VUE (Pays / Secteurs) + TYPE D'ANALYSE (barre de filtre) ────────
/** La catégorie d'ouverture d'une vue — son premier onglet de contenu.
 *  Secteurs n'offre pas Flux & Stocks : elle ouvre sur Greenfield. */
export const CATEGORIE_PREMIERE = { pays: "fluxstock", monde: "fluxstock", secteurs: "greenfield" } as const;

export function SelecteurVueAnalyse({ vueP, setVueP, typeAnalyse, setTypeAnalyse, allerAnalyse, setSousType }: {
  vueP: string; setVueP: (v: "pays"|"secteurs") => void;
  typeAnalyse: string; setTypeAnalyse: (v: any) => void;
  // Depuis la vue Secteurs, aller à Pays/Monde règle le sousOnglet du parent
  allerAnalyse?: (v: "pays"|"monde") => void;
  /** Remet la catégorie au premier onglet de la vue rejointe. */
  setSousType?: (v: "fluxstock"|"greenfield"|"fusion") => void;
}) {
  // VUE unifiée : Pays · Monde · Secteurs. Le « Type d'analyse » dédié a
  // disparu (la comparaison Pays se fait via le « + » de l'en-tête) ; seule la
  // vue Secteurs garde sa bascule Analyse sectorielle / comparative.
  const vueActive = vueP === "secteurs" ? "secteurs" : typeAnalyse; // "pays" | "monde" | "secteurs"
  const choisir = (v: "pays"|"monde"|"secteurs") => {
    // Changer de vue ouvre son PREMIER onglet de contenu, toujours. La
    // catégorie est un état partagé par les trois vues : sans cette remise à
    // zéro, quitter Secteurs/Greenfield pour Pays y arrivait sur Greenfield
    // au lieu de Flux & Stocks — un onglet hérité d'une vue qu'on vient de
    // quitter, jamais celui qu'on attend en entrant.
    if (v !== vueActive) setSousType?.(CATEGORIE_PREMIERE[v]);
    if (v === "secteurs") { setVueP("secteurs"); return; }
    setVueP("pays");
    if (vueP === "secteurs") allerAnalyse?.(v);
    else setTypeAnalyse(v); // ici typeAnalyse EST le sousOnglet (pays/monde)
  };
  const btn = (actif: boolean): React.CSSProperties => ({
    textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12,
    fontWeight: actif ? 700 : 500, background: actif ? "rgb(var(--bleu-rgb) / 0.08)" : "transparent",
    color: actif ? "var(--bleu)" : "var(--texte)", fontFamily: "var(--font-google-sans)",
  });
  return (
    <>
      <div style={{ marginBottom:16, paddingBottom:14, borderBottom:"1px solid var(--bordure)" }}>
        <p style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Vue</p>
        <div style={{ display:"flex", flexDirection:"column" as const, gap:2 }}>
          {([{ v:"pays", l:"Pays" }, { v:"monde", l:"Monde" }, { v:"secteurs", l:"Secteurs" }] as const).map(o => (
            <button key={o.v} onClick={() => choisir(o.v)} style={btn(vueActive === o.v)}>{o.l}</button>
          ))}
        </div>
      </div>
      {vueP === "secteurs" && (
        <div style={{ marginBottom:16, paddingBottom:14, borderBottom:"1px solid var(--bordure)" }}>
          <p style={{ fontSize:11, fontWeight:700, color:"var(--gris)", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:8 }}>Type d&apos;analyse</p>
          <div style={{ display:"flex", flexDirection:"column" as const, gap:2 }}>
            {[{ v: "secteur", l: "Analyse sectorielle" }, { v: "comparative", l: "Analyse comparative" }].map(o => (
              <button key={o.v} onClick={() => setTypeAnalyse(o.v)} style={btn(typeAnalyse === o.v)}>{o.l}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Bouton « + » d'ajout de pays à comparer (vue Pays) ───────────────────────
// Rond en pointillés à côté du pays de référence : popover avec recherche et
// liste groupée par continent ; jusqu'à 3 pays en plus (4 séries max). Le
// popover reste ouvert pour enchaîner les ajouts.
export function BtnAjoutPaysComp({ paysDispo, exclus, plein, onPick, onOpenChange }: {
  paysDispo: any[]; exclus: string[]; plein: boolean; onPick: (nom: string) => void;
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
  // Le parent floute le contenu derrière le popover
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  // Sélection au complet (4 pays) : fermeture automatique
  useEffect(() => { if (plein && open) { setOpen(false); setQ(""); } }, [plein, open]);

  const dispo = paysDispo.filter((p: any) => !exclus.includes(p.nom)
    && (!q || p.nom.toLowerCase().includes(q.toLowerCase())));
  const groupes = Object.entries(
    dispo.reduce((acc: any, p: any) => { const c = p.continent || "Autre"; (acc[c] ||= []).push(p); return acc; }, {})
  ).sort(([a], [b]) => (a as string).localeCompare(b as string));

  return (
    <div ref={ref} style={{ position:"relative", display:"inline-flex" }}>
      <button onClick={() => !plein && setOpen(o => !o)} disabled={plein}
        aria-label="Comparer avec d'autres pays" title={plein ? "4 pays maximum" : "Comparer avec d'autres pays"}
        style={{ width:28, height:28, borderRadius:999, border:`1.5px dashed ${plein ? "var(--bordure-forte)" : open ? "var(--bleu)" : "rgb(var(--bleu-rgb) / 0.35)"}`,
          background: open ? "rgb(var(--bleu-rgb) / 0.08)" : "rgb(var(--carte-rgb) / 0.7)", color: plein ? "var(--gris)" : "var(--bleu)",
          cursor: plein ? "not-allowed" : "pointer",
          display:"inline-flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s", flexShrink:0 }}
        onMouseEnter={e => { if (!plein) { e.currentTarget.style.borderColor = "var(--bleu)"; e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.08)"; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = plein ? "var(--bordure-forte)" : "rgb(var(--bleu-rgb) / 0.35)"; e.currentTarget.style.background = "rgb(var(--carte-rgb) / 0.7)"; } }}>
        <Plus size={14}/>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:60, width:300,
          border:"1px solid var(--bordure-forte)", borderRadius:12, background:"var(--carte)", boxShadow:"var(--ombre-2)", overflow:"hidden" }}>
          <div style={{ padding:8, borderBottom:"1px solid var(--bordure)" }}>
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un pays…"
              style={{ width:"100%", boxSizing:"border-box" as const, background:"var(--carte)", borderWidth:1, borderStyle:"solid", borderColor:"var(--bordure-forte)", borderRadius:9, padding:"8px 11px", fontSize:12.5, color:"var(--encre)", outline:"none", fontFamily:"var(--font-google-sans)" }} />
          </div>
          <div style={{ maxHeight:240, overflowY:"auto" as const }}>
            {groupes.map(([continent, pays]: any) => (
              <div key={continent}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.04)", padding:"5px 12px", letterSpacing:"0.1em", textTransform:"uppercase" as const, position:"sticky" as const, top:0 }}>{continent}</div>
                {pays.map((p: any) => (
                  <button key={p.nom} onClick={() => { onPick(p.nom); setQ(""); inputRef.current?.focus(); }}
                    style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"7px 14px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left" as const, borderBottom:"1px solid var(--bordure)", transition:"background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize:12, color:"var(--encre)", fontWeight:500 }}>{p.nom}</span>
                  </button>
                ))}
              </div>
            ))}
            {dispo.length === 0 && <p style={{ fontSize:12, color:"var(--gris)", textAlign:"center" as const, padding:"14px 0" }}>Aucun pays trouvé</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bouton « + » d'ajout de groupement (vue Monde) ────────────────────────────
// Même fonctionnement que l'ajout de pays : popover avec recherche, sections
// groupées, reste ouvert pour enchaîner, fermeture automatique à 4. Seuls les
// éléments compatibles avec la famille active sont proposés.
export function BtnAjoutGroupement({ groupements, exclus, type, plein, changer, onPick, onOpenChange }: {
  groupements: { code: string; nom_fr: string; categorie: string }[];
  exclus: string[];
  /** Type déjà sélectionné : seuls ses semblables sont proposés (null = tout) */
  type: "continent" | "region" | "groupe" | null;
  plein: boolean;
  /** Sur « Monde » : le bouton sert à CHANGER de vue (icône échanger), pas à ajouter */
  changer?: boolean;
  onPick: (code: string) => void; onOpenChange?: (open: boolean) => void;
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

  const match = (g: { code: string; nom_fr: string }) => !exclus.includes(g.code) && (!q || g.nom_fr.toLowerCase().includes(q.toLowerCase()) || g.code.toLowerCase().includes(q.toLowerCase()));
  const continents = groupements.filter(g => g.categorie === "continent");
  // Sections du même type que la sélection : continents entre eux, régions
  // entre elles, groupements entre eux (tout quand rien n'est sélectionné)
  const sections: { label: string; items: { code: string; nom_fr: string }[] }[] = [];
  if (type === null || type === "continent") {
    const cs = continents.filter(match);
    if (cs.length) sections.push({ label: "Continents", items: cs });
  }
  if (type === null || type === "region") {
    continents.forEach(cont => {
      const regs = groupements.filter(g => g.categorie === cont.nom_fr).filter(match);
      if (regs.length) sections.push({ label: cont.nom_fr, items: regs });
    });
  }
  if (type === null || type === "groupe") {
    const gs = groupements.filter(g => g.categorie === "groupe").filter(match);
    if (gs.length) sections.push({ label: "Groupements", items: gs });
  }

  return (
    <div ref={ref} style={{ position:"relative", display:"inline-flex" }}>
      <button onClick={() => !plein && setOpen(o => !o)} disabled={plein}
        aria-label={changer ? "Changer de vue" : "Comparer avec d'autres groupements"}
        title={plein ? "4 sélections maximum" : changer ? "Voir un continent, une région ou un groupement" : "Comparer avec d'autres groupements"}
        style={{ width:28, height:28, borderRadius:999, border:`1.5px dashed ${plein ? "var(--bordure-forte)" : open ? "var(--bleu)" : "rgb(var(--bleu-rgb) / 0.35)"}`,
          background: open ? "rgb(var(--bleu-rgb) / 0.08)" : "rgb(var(--carte-rgb) / 0.7)", color: plein ? "var(--gris)" : "var(--bleu)",
          cursor: plein ? "not-allowed" : "pointer",
          display:"inline-flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s", flexShrink:0 }}
        onMouseEnter={e => { if (!plein) { e.currentTarget.style.borderColor = "var(--bleu)"; e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.08)"; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = plein ? "var(--bordure-forte)" : "rgb(var(--bleu-rgb) / 0.35)"; e.currentTarget.style.background = "rgb(var(--carte-rgb) / 0.7)"; } }}>
        {changer ? <IconeCached size={13}/> : <Plus size={14}/>}
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:60, width:300,
          border:"1px solid var(--bordure-forte)", borderRadius:12, background:"var(--carte)", boxShadow:"var(--ombre-2)", overflow:"hidden" }}>
          <div style={{ padding:8, borderBottom:"1px solid var(--bordure)" }}>
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un groupement…"
              style={{ width:"100%", boxSizing:"border-box" as const, background:"var(--carte)", borderWidth:1, borderStyle:"solid", borderColor:"var(--bordure-forte)", borderRadius:9, padding:"8px 11px", fontSize:12.5, color:"var(--encre)", outline:"none", fontFamily:"var(--font-google-sans)" }} />
          </div>
          <div style={{ maxHeight:240, overflowY:"auto" as const }}>
            {sections.map(sec => (
              <div key={sec.label}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--bleu)", background:"rgb(var(--bleu-rgb) / 0.04)", padding:"5px 12px", letterSpacing:"0.1em", textTransform:"uppercase" as const, position:"sticky" as const, top:0 }}>{sec.label}</div>
                {sec.items.map(g => (
                  <button key={g.code} title={g.nom_fr} onClick={() => { onPick(g.code); setQ(""); if (changer) setOpen(false); else inputRef.current?.focus(); }}
                    style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"7px 14px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left" as const, borderBottom:"1px solid var(--bordure)", transition:"background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize:12, color:"var(--encre)", fontWeight:500 }}>{sec.label === "Groupements" ? g.code.replace(/_/g, " ") : g.nom_fr}</span>
                  </button>
                ))}
              </div>
            ))}
            {sections.length === 0 && <p style={{ fontSize:12, color:"var(--gris)", textAlign:"center" as const, padding:"14px 0" }}>Aucun résultat</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function SousTypeNav({ value, onChange, options }: { value: string; onChange: (v: "fluxstock"|"greenfield"|"fusion") => void; options?: readonly { v: "fluxstock"|"greenfield"|"fusion"; l: string }[] }) {
  return (
    <div style={{ display:"inline-flex", background:"var(--carte)", border:"1px solid var(--bordure)", borderRadius:999, padding:3, gap:3, boxShadow:"var(--ombre-1)" }}>
      {(options ?? SOUS_TYPE_NAV).map(o => {
        const actif = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)}
            style={{ padding:"6px 18px", borderRadius:999, border:"none", cursor:"pointer", fontSize:12.5, fontWeight:700, whiteSpace:"nowrap" as const,
              background: actif ? "var(--bleu-action)" : "transparent",
              color: actif ? "var(--sur-bleu)" : "var(--texte)",
              boxShadow: actif ? "0 2px 8px rgb(var(--ombre-rgb) / 0.30), inset 0 1px 0 rgba(255,255,255,0.12)" : "none",
              transition:"background 0.18s, box-shadow 0.18s, color 0.18s", fontFamily:"var(--font-google-sans)" }}
            onMouseEnter={e => { if (!actif) e.currentTarget.style.background = "var(--champ)"; }}
            onMouseLeave={e => { if (!actif) e.currentTarget.style.background = "transparent"; }}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

// Bornes de période des séries CNUCED — valeurs de repli avant la réponse API
export const ANNEE_MIN = 1990;
export const ANNEE_MAX = 2025;

// Bornes réelles depuis l'API, par catégorie de données (fluxstock /
// greenfield / fusion) : sliders et pastilles s'alignent sur la couverture du
// sous-type actif, et s'étendent automatiquement à chaque nouvel import.
// La réponse est mémorisée au niveau du module : chaque bascule d'onglet
// remonte le hook, mais la requête ne part qu'une fois par session.
let _bornesCnuced: Promise<any> | null = null;
export function useBornesCnuced(sousType: string = "fluxstock"): [number, number] {
  const [annees, setAnnees] = useState<any>(null);
  useEffect(() => {
    _bornesCnuced ??= fetch(`${API}/ide/cnuced/annees`).then(r => r.json())
      .catch(() => { _bornesCnuced = null; return null; });
    let actif = true;
    _bornesCnuced.then(d => { if (actif && d) setAnnees(d); });
    return () => { actif = false; };
  }, []);
  const cat = annees?.categories?.[sousType];
  return [
    cat?.annee_min ?? annees?.annee_min ?? ANNEE_MIN,
    cat?.annee_max ?? annees?.annee_max ?? ANNEE_MAX,
  ];
}

// ── Graphe D3 multi-pays ──────────────────────────────────────────────────────
export function GrapheMultiPays(props: {
  series: { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] }[];
  height?: number; type?: "line" | "bar"; titre?: string;
  fmt?: (v: number | null) => string; showDots?: boolean; lineWidth?: number;
}) {
  return <GrapheSignature {...props} fmt={props.fmt || fmtVal} />;
}

// ── Top 10 des années par flux entrants — barres classées ─────────────────────
export function TopAnneesFlux({ rows, grand }: { rows: { annee: number; valeur: number }[]; grand?: boolean }) {
  const max = rows.length ? rows[0].valeur : 1;
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: grand ? 8 : 4.5, padding: grand ? "4px 2px" : "2px 2px 0" }}>
      {rows.map((r, i) => (
        <div key={r.annee} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 16, fontSize: grand ? 11 : 9.5, fontWeight: 800, color: i < 3 ? "var(--bleu)" : "var(--gris)", textAlign: "right" as const, flexShrink: 0 }}>{i + 1}</span>
          <span style={{ width: 32, fontSize: grand ? 12 : 10.5, fontWeight: 700, color: "var(--encre)", flexShrink: 0 }}>{r.annee}</span>
          <div style={{ flex: 1, height: grand ? 12 : 8, background: "var(--fond)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(2, r.valeur / max * 100)}%`, borderRadius: 99,
              background: i === 0 ? "linear-gradient(90deg,var(--bleu-action),var(--bleu-action))" : "var(--bleu-action)", opacity: i === 0 ? 1 : Math.max(0.35, 1 - i * 0.08) }} />
          </div>
          <span style={{ width: grand ? 86 : 68, fontSize: grand ? 11.5 : 10, fontWeight: 700, color: "var(--bleu)", textAlign: "right" as const, flexShrink: 0, whiteSpace: "nowrap" as const }}>{fmtVal(r.valeur)}</span>
        </div>
      ))}
      {rows.length === 0 && <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center" as const, padding: "20px 0" }}>Aucune donnée</p>}
    </div>
  );
}

// ── Card tableau des nombres de projets (greenfield / M&A, vue Pays) ──────────
// Un tableau simple : année · nombre · nombre de l'année précédente · écart ·
// barre. Les huit années les plus récentes, le reste derrière « Afficher la
// suite ».
//
// Ce qui a été retiré, et pourquoi : le curseur d'exploration et l'épinglage
// (avec son bilan de comparaison) demandaient trois gestes pour lire ce que le
// tableau montre déjà — on vient ici compter des projets, pas instrumenter une
// série. La colonne « N-1 » donne la valeur de l'année précédente, et « vs
// N-1 » l'écart en NOMBRE (+3, −6) — pas un pourcentage : sur des effectifs
// d'une dizaine, « +300 % » dit moins que « +3 », et lire les deux nombres
// côte à côte dispense de tout calcul.
//
// L'année de pic porte un aplat bleu et une pastille PIC. S'il n'y a pas de
// pic — une seule année, ou plusieurs ex æquo au sommet — ni l'un ni l'autre :
// distinguer une ligne qui ne se distingue pas est un mensonge visuel.
export function CarteTableauAnnees({ titre, rows, accent = "var(--bleu)" }: { titre: string; rows: { annee: number; valeur: number | null }[]; accent?: string }) {
  const [tout, setTout] = useState(false);
  const FENETRE = 8;

  const valides = rows.filter(r => r.valeur !== null).sort((a, b) => a.annee - b.annee) as { annee: number; valeur: number }[];
  const nonNulles = valides.filter(r => r.valeur !== 0);
  const recentes = [...nonNulles].reverse();               // du plus récent au plus ancien
  const affichees = tout ? recentes : recentes.slice(0, FENETRE);
  const reste = recentes.length - affichees.length;
  const maxVal = Math.max(1, ...nonNulles.map(r => r.valeur));

  // Le pic n'existe que s'il se distingue : une valeur STRICTEMENT supérieure
  // à toutes les autres. Deux années ex æquo au sommet, ou des valeurs toutes
  // égales, ne donnent pas de pic.
  const anneePic = (() => {
    if (nonNulles.length < 2) return null;
    const mx = Math.max(...nonNulles.map(r => r.valeur));
    const sommet = nonNulles.filter(r => r.valeur === mx);
    return sommet.length === 1 ? sommet[0].annee : null;
  })();

  // Le millésime valorisé qui PRÉCÈDE : sa valeur, et l'écart en nombre.
  // « précède » au sens des données, pas de l'année civile — une année sans
  // donnée ne coupe pas la comparaison, elle la reporte.
  const precedentDe = (annee: number): number | null => {
    const i = valides.findIndex(r => r.annee === annee);
    return i <= 0 ? null : valides[i - 1].valeur;
  };
  const ecartDe = (annee: number): number | null => {
    const prec = precedentDe(annee);
    const v = valides.find(r => r.annee === annee)?.valeur;
    return prec === null || v === undefined ? null : v - prec;
  };

  const Ecart = ({ e }: { e: number | null }) => (
    <span style={{ fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums",
      color: e === null ? "var(--gris)" : e > 0 ? "var(--vert)" : e < 0 ? "var(--danger)" : "var(--gris)" }}>
      {e === null ? "—" : e === 0 ? "=" : `${e > 0 ? "+" : "−"}${fmtNombre(Math.abs(e))}`}
    </span>
  );

  return (
    <div style={{ background: "var(--carte)", borderRadius: 14, border: "1px solid rgb(var(--encre-rgb) / 0.12)", padding: "16px 18px", minWidth: 0, display: "flex", flexDirection: "column" as const, gap: 10 }}>
      <h3 style={{ fontWeight: 700, fontSize: 13.5, color: "var(--encre)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{titre}</h3>
      {valides.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center" as const, padding: "26px 0" }}>Aucune donnée</p>
      ) : (
        <>
          {/* En-tête du tableau */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
            <span style={{ width: 34, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const, flexShrink: 0 }}>Année</span>
            <span style={{ width: 34, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>Nb</span>
            <span style={{ width: 34, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>N-1</span>
            <span style={{ width: 48, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>vs N-1</span>
            <span style={{ flex: 1 }} />
            <span style={{ width: 34, flexShrink: 0 }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
            {affichees.map(r => {
              const pic = r.annee === anneePic;
              return (
                <div key={r.annee} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 8px", borderRadius: 8,
                  background: pic ? voile(accent, 8) : "transparent" }}>
                  <span style={{ width: 34, fontSize: 11.5, fontWeight: pic ? 800 : 600, color: "var(--encre)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{r.annee}</span>
                  <span style={{ width: 34, fontSize: 11.5, fontWeight: 800, color: accent, textAlign: "right" as const, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmtNombre(r.valeur)}</span>
                  {(() => { const prec = precedentDe(r.annee); return (
                    <span style={{ width: 34, fontSize: 11, fontWeight: 600, color: "var(--gris-fort)", textAlign: "right" as const, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {prec === null ? "—" : fmtNombre(prec)}
                    </span>
                  ); })()}
                  <span style={{ width: 48, textAlign: "right" as const, flexShrink: 0 }}><Ecart e={ecartDe(r.annee)} /></span>
                  <div style={{ flex: 1, height: 7, background: "var(--fond)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(2, r.valeur / maxVal * 100)}%`, borderRadius: 99, background: accent, opacity: pic ? 1 : 0.55 }} />
                  </div>
                  {pic
                    ? <span style={{ width: 34, fontSize: 7.5, fontWeight: 800, letterSpacing: "0.08em", color: accent, background: voile(accent, 16), padding: "2px 6px", borderRadius: 999, flexShrink: 0, textAlign: "center" as const, boxSizing: "border-box" as const }}>PIC</span>
                    : <span style={{ width: 34, flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>

          {reste > 0 && (
            <button onClick={() => setTout(true)}
              style={{ alignSelf: "center", marginTop: 2, padding: "6px 16px", borderRadius: 999, border: "1px solid var(--bordure-forte)",
                background: "var(--carte)", color: accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--champ)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--carte)"; }}>
              Afficher la suite ({reste})
            </button>
          )}
          {tout && recentes.length > FENETRE && (
            <button onClick={() => setTout(false)}
              style={{ alignSelf: "center", marginTop: 2, padding: "6px 16px", borderRadius: 999, border: "1px solid var(--bordure-forte)",
                background: "var(--carte)", color: "var(--texte)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>
              Réduire
            </button>
          )}
        </>
      )}
    </div>
  );
}


// ── Card tableau comparatif des nombres de projets (vue Pays, comparatif) ─────
// Une ligne par pays (pastille couleur · nombre · Δ vs N-1 · part · barre),
// triées par valeur. Le curseur bascule entre le Cumul de la période (tout à
// droite) et chaque année en glissant vers la gauche — sans requête, tout est
// déjà chargé.
export function CarteTableauComparatif({ titre, series, libelleLigne = "Pays" }: {
  titre: string;
  series: { nom: string; couleur: string; data: { annee: number; valeur: number | null }[] }[];
  libelleLigne?: string;
}) {
  const [annee, setAnnee] = useState<number | null>(null);

  const annees = [...new Set(series.flatMap(s => s.data.filter(d => d.valeur !== null).map(d => d.annee)))].sort((a, b) => a - b);
  const n = annees.length;
  // Valeur d'un pays : somme de la période (Cumul) ou valeur de l'année
  const valeurDe = (s: typeof series[number]): number | null => {
    if (annee === null) {
      const vs = s.data.filter(d => d.valeur !== null) as { annee: number; valeur: number }[];
      return vs.length ? vs.reduce((t, d) => t + d.valeur, 0) : null;
    }
    return s.data.find(d => d.annee === annee)?.valeur ?? null;
  };
  const deltaDe = (s: typeof series[number]): number | null => {
    if (annee === null) return null;
    const v = s.data.find(d => d.annee === annee)?.valeur;
    if (v === null || v === undefined) return null;
    const avant = s.data.filter(d => d.valeur !== null && d.annee < annee) as { annee: number; valeur: number }[];
    if (!avant.length) return null;
    const prec = avant[avant.length - 1];
    return prec.valeur === 0 ? null : (v - prec.valeur) / Math.abs(prec.valeur) * 100;
  };
  const lignes = series.map(s => ({ ...s, valeur: valeurDe(s), delta: deltaDe(s) }))
    .sort((a, b) => (b.valeur ?? -1) - (a.valeur ?? -1));
  const total = lignes.reduce((t, l) => t + Math.max(0, l.valeur ?? 0), 0);
  const max = Math.max(1e-9, ...lignes.map(l => l.valeur ?? 0));

  return (
    <div style={{ gridColumn: "1 / -1", background: "var(--carte)", borderRadius: 14, border: "1px solid rgb(var(--encre-rgb) / 0.12)", padding: "16px 18px", minWidth: 0, display: "flex", flexDirection: "column" as const, gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
        <h3 style={{ fontWeight: 700, fontSize: 13.5, color: "var(--encre)", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{titre}</h3>
        {n >= 2 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <CurseurAnneeNace min={0} max={n} value={annee == null ? n : Math.max(0, annees.indexOf(annee))}
              borne={annees[0]} pastille={annee ?? "Cumul"} ariaLabel="Cumul ou année"
              onChange={i => setAnnee(i >= n ? null : annees[i])} />
          </span>
        )}
      </div>

      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
        <span style={{ flex: 1, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const }}>{libelleLigne}</span>
        <span style={{ width: 44, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>Nb</span>
        <span style={{ width: 56, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>vs N-1</span>
        <span style={{ width: 44, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" as const, textAlign: "right" as const, flexShrink: 0 }}>Part</span>
        <span style={{ width: "30%", flexShrink: 0 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
        {lignes.map((l, i) => {
          const zebre = i % 2 === 1;
          return (
            <div key={l.nom} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: zebre ? "var(--carte-douce)" : "transparent", transition: "background 0.12s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = zebre ? "var(--carte-douce)" : "transparent"; }}>
              <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.couleur, flexShrink: 0 }} />
                <span title={l.nom} style={{ fontSize: 12, fontWeight: 700, color: "var(--encre)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{l.nom}</span>
              </span>
              <span style={{ width: 44, fontSize: 11.5, fontWeight: 800, color: l.valeur === null ? "var(--gris)" : "var(--bleu)", textAlign: "right" as const, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{l.valeur === null ? "—" : fmtNombre(l.valeur)}</span>
              <span style={{ width: 56, fontSize: 9.5, fontWeight: 700, textAlign: "right" as const, flexShrink: 0, whiteSpace: "nowrap" as const,
                color: l.delta === null ? "var(--gris)" : l.delta > 0 ? "var(--vert)" : l.delta < 0 ? "var(--danger)" : "var(--gris)" }}>
                {l.delta === null ? "—" : `${l.delta > 0 ? "▲" : l.delta < 0 ? "▼" : "="} ${Math.abs(l.delta).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`}
              </span>
              <span style={{ width: 44, fontSize: 10, fontWeight: 700, color: "var(--texte)", textAlign: "right" as const, flexShrink: 0 }}>
                {l.valeur !== null && total > 0 ? `${(Math.max(0, l.valeur) / total * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %` : "—"}
              </span>
              <div style={{ width: "30%", height: 8, background: "var(--fond)", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
                {l.valeur !== null && l.valeur > 0 && <div style={{ height: "100%", width: `${Math.max(2, l.valeur / max * 100)}%`, borderRadius: 99, background: l.couleur, opacity: 0.85 }} />}
              </div>
            </div>
          );
        })}
      </div>
      {annees.length === 0 && <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center" as const, padding: "16px 0" }}>Aucune donnée</p>}
    </div>
  );
}


// ── Export Excel (XLSX) ───────────────────────────────────────────────────────
async function exportXLSX(donnees: any[], paysSelectionnes: any[], periode: string, sousType: string = "fluxstock") {
  // SheetJS chargé à la demande (~400 Ko) : uniquement au clic Export
  const XLSX = await import("xlsx");
  const annees = [...new Set(donnees.map((d:any)=>d.annee))].sort() as number[];
  const series = (SERIES_TYPES[sousType] || SERIES_TYPES.fluxstock).map(s => ({
    dir: s.dir, ind: s.ind, label: s.unite === "musd" ? `${s.label} (M$ USD)` : s.label,
  }));

  const wb = XLSX.utils.book_new();

  paysSelectionnes.forEach((p:any) => {
    // En-tête : Indicateur | 1990 | 1991 | ...
    const header = ["Indicateur", ...annees.map(String)];
    const rows: (string|number|null)[][] = [header];

    series.forEach(s => {
      const row: (string|number|null)[] = [s.label];
      annees.forEach(a => {
        const r = donnees.find((d:any)=>d.pays===p.nom&&d.direction===s.dir&&d.indicateur===s.ind&&d.annee===a);
        const v = r?.valeur;
        row.push(v !== null && v !== undefined ? Number(v.toFixed(2)) : null);
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Largeur auto des colonnes
    const colWidths = rows[0].map((_:any, ci:number) => {
      const maxLen = Math.max(...rows.map(r => String(r[ci] ?? "").length));
      return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
    });
    ws["!cols"] = colWidths;

    // Nom de feuille = nom du pays (max 31 chars)
    XLSX.utils.book_append_sheet(wb, ws, p.nom.slice(0, 31));
  });

  XLSX.writeFile(wb, `IDE_CNUCED_${paysSelectionnes.map((p:any)=>p.nom.replace(/\s/g,"_")).join("_")}_${periode}.xlsx`);
}

// ── Modal données ─────────────────────────────────────────────────────────────
export function ModalDonnees({ open, onClose, donnees, paysSelectionnes, sousType = "fluxstock", entite = "pays" }: any) {
  useEchap(open, onClose);
  const dialTable = useDialogue(open, "Tableau de données");
  if (!open) return null;
  const annees = [...new Set(donnees.map((d:any)=>d.annee))].sort() as number[];
  const periode = annees.length ? `${annees[0]}_${annees[annees.length-1]}` : "all";
  const SERIES = (SERIES_TYPES[sousType] || SERIES_TYPES.fluxstock).map(s => ({ dir: s.dir, ind: s.ind, label: s.label, unite: s.unite }));

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgb(var(--encre-rgb) / 0.45)", backdropFilter:"blur(8px)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div {...dialTable} onClick={e=>e.stopPropagation()} style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:1200, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", border: "1px solid var(--bordure)", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid var(--bordure)", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"var(--encre)", margin:0, lineHeight:1.35, flexShrink:0 }}>Tableau de données</h2>
                {annees.length>0&&<span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:999, background:"var(--fond-creux2)", border:"1px solid var(--bordure-forte)", fontSize:10.5, fontWeight:700, color:"var(--encre)", letterSpacing:"0.02em", flexShrink:0 }}>
                  {annees[0]} — {annees[annees.length-1]}
                </span>}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, minWidth:0 }}>
                {paysSelectionnes.map((p:any)=>{
                  const marquee = (e:React.MouseEvent, reset:boolean) => {
                    const box = e.currentTarget.querySelector("[data-marquee]") as HTMLElement|null;
                    const sp = box?.firstElementChild as HTMLElement|null;
                    if (!box || !sp) return;
                    if (reset) { sp.style.transition="transform 0.4s ease"; sp.style.transform="translateX(0)"; return; }
                    const d = sp.scrollWidth - box.clientWidth;
                    if (d>0) { sp.style.transition=`transform ${Math.max(0.6,d/40)}s ease`; sp.style.transform=`translateX(-${d}px)`; }
                  };
                  return (
                    <span key={p.nom} title={p.label||p.nom}
                      onMouseEnter={e=>marquee(e,false)} onMouseLeave={e=>marquee(e,true)}
                      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:999, background:`${voile(p.couleur, 5)}`, border:`1px solid ${voile(p.couleur, 18)}`, fontSize:10.5, fontWeight:700, color:p.couleur, minWidth:0 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:p.couleur, display:"inline-block", flexShrink:0 }} />
                      <span data-marquee style={{ overflow:"hidden", whiteSpace:"nowrap" as const, minWidth:0 }}>
                        <span style={{ display:"inline-block" }}>{p.abrege||p.nom}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width:32, height:32, borderRadius:"50%", background:"var(--champ)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="var(--fond-creux2)";}} onMouseLeave={e=>{e.currentTarget.style.background="var(--champ)";}}>
              <X size={15} color="var(--texte)" />
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div style={{ overflowY:"auto" as const, flex:1, overflowX:"auto" as const }}>
          <table style={{ width:"100%", borderCollapse:"collapse" as const, fontSize:12 }}>
            <thead style={{ position:"sticky" as const, top:0, zIndex:2 }}>
              <tr style={{ background:"var(--carte-douce)" }}>
                <th style={{ padding:"11px 28px", textAlign:"left" as const, fontSize:10, fontWeight:800, color:"var(--texte)", letterSpacing:"0.1em", textTransform:"uppercase" as const, position:"sticky" as const, left:0, background:"var(--carte-douce)", borderRight:"1px solid var(--bordure)", borderBottom:"1px solid var(--bordure)", whiteSpace:"nowrap" as const, minWidth:170 }}>Indicateur</th>
                {annees.map(a=><th key={a} style={{ padding:"11px 12px", fontSize:10, fontWeight:800, color:"var(--texte)", letterSpacing:"0.06em", textAlign:"right" as const, minWidth:80, borderBottom:"1px solid var(--bordure)" }}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {paysSelectionnes.map((pays:any) => (
                <Fragment key={pays.nom}>
                  <tr>
                    <td colSpan={annees.length+1} style={{ padding:"12px 28px 6px", background:"var(--carte)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", background:pays.couleur, flexShrink:0 }} />
                        <span style={{ fontSize:12.5, fontWeight:800, color:pays.couleur }}>{pays.abrege||pays.nom}</span>
                      </div>
                    </td>
                  </tr>
                  {SERIES.map((s,si)=>(
                    <tr key={`${pays.nom}-${s.dir}-${s.ind}`}
                      style={{ borderBottom: si===SERIES.length-1?"1px solid var(--bordure)":"1px solid var(--filet)", background:"var(--carte)", transition:"background 0.1s" }}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--carte-douce)"}
                      onMouseLeave={e=>e.currentTarget.style.background="var(--carte)"}>
                      <td style={{ padding:"9px 28px 9px 44px", position:"sticky" as const, left:0, background:"inherit", borderRight:"1px solid var(--bordure)", whiteSpace:"nowrap" as const }}>
                        <span style={{ fontSize:12, color:"var(--texte)", fontWeight:500 }}>{s.label}</span>
                      </td>
                      {annees.map(a=>{
                        const r = donnees.find((d:any)=>d.pays===pays.nom&&d.direction===s.dir&&d.indicateur===s.ind&&d.annee===a);
                        const v = r?.valeur;
                        const display = v!==null&&v!==undefined ? (s.unite==="nombre" ? fmtNombre(v) : fmtVal(v)) : "—";
                        const color = v===null||v===undefined ? "var(--gris)" : v<0 ? "var(--danger)" : "var(--texte)";
                        return (
                          <td key={a} style={{ padding:"9px 12px", textAlign:"right" as const, fontSize:12, color, fontWeight:v!==null&&v!==undefined?600:400, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" as const }}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid var(--bordure)", background:"var(--carte-douce)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0, gap:10 }}>
          <span style={{ fontSize:11, color:"var(--gris)" }}>
            {paysSelectionnes.length} {entite} · {annees.length} années · {sousType === "fluxstock" ? "valeurs en M$ USD" : "valeurs en M$ USD, nombres en absolu"} · Source CNUCED
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid var(--bordure-forte)", background:"var(--carte)", color:"var(--texte)", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
              Fermer
            </button>
            <button onClick={()=>exportXLSX(donnees,paysSelectionnes,periode,sousType)}
              style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"var(--bleu-action)", color:"var(--sur-bleu)", fontSize:12.5, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, boxShadow:"0 3px 12px rgb(var(--ombre-rgb) / 0.25)", fontFamily:"var(--font-google-sans)" }}>
              <FileSpreadsheet size={13}/> Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 25 KPIs fixes ─────────────────────────────────────────────────────────────
// Les KPI proposés au remplacement dans les cartes de l'onglet Pays.
//
// Les indicateurs d'analyse de série — CAGR, momentum, tendance linéaire,
// accélération, taux moyens 5/10 ans, distance au pic, années de croissance,
// streak en cours — ont été retirés de la liste : ils demandent une lecture
// de statisticien là où ces cartes servent à donner un ordre de grandeur.
// Leur CALCUL reste dans lib/ideKpis (rien n'est perdu, la liste peut se
// rouvrir), seule l'offre est resserrée.
export const KPI_25_IDS = [
  "fe_last","fs_last","fn_last","se_last","ss_last","sn_last",
  "g_fe","g_se",
  "moy_fe","med_fe","max_fe","min_fe","std_fe",
  "r_fe_fs","regularite_fe","vs_moy_fe",
];

// ── Interprétation contextuelle d'un KPI ─────────────────────────────────────
function interpreterKpi(k: KpiResult, pays: string, couleur: string): string {
  if (k.valeur === null || k.valeur === undefined || isNaN(k.valeur)) return "Données insuffisantes pour interpréter cet indicateur.";
  const v = k.valeur;
  const fmt = fmtKpi(k);
  switch(k.id) {
    case "fe_last": return v>0?`En ${k.annee}, ${pays} a attiré ${fmt} d'IDE entrants. ${v>1000?"C'est un niveau significatif, reflétant une attractivité forte pour les investisseurs étrangers.":v>100?"C'est un flux modéré, cohérent avec une économie en développement.":"Ce flux relativement faible peut refléter un manque d'attractivité ou des conditions conjoncturelles défavorables."}`:`En ${k.annee}, les flux entrants sont négatifs (${fmt}), ce qui signifie que les investisseurs étrangers ont rapatrié plus de capital qu'ils n'en ont investi — un signal de désinvestissement.`;
    case "fs_last": return `En ${k.annee}, ${pays} a investi ${fmt} à l'étranger. ${v>0?v>500?"C'est un niveau élevé, indiquant que le pays est lui-même un exportateur significatif de capitaux.":"Cela reflète une capacité à investir au-delà des frontières, signe d'entreprises dynamiques.":"Un flux sortant négatif signifie un rapatriement de capitaux investis à l'étranger."}`;
    case "fn_last": return v>0?`Le flux net de ${fmt} est positif : ${pays} reçoit plus d'IDE qu'il n'en envoie. Le pays est en position d'attractivité nette.`:`Le flux net de ${fmt} est négatif : ${pays} exporte plus de capitaux qu'il n'en reçoit. Le pays investit davantage à l'étranger qu'il n'attire.`;
    case "se_last": return `Le stock d'IDE entrant est de ${fmt} en ${k.annee}. ${v>5000?"Ce stock élevé témoigne d'une présence importante et durable des investisseurs étrangers.":v>1000?"C'est un stock intermédiaire qui reflète une accumulation progressive des investissements étrangers.":"Ce stock encore limité indique que l'accumulation d'IDE reste à consolider."}`;
    case "ss_last": return `Le stock d'IDE sortant est de ${fmt} en ${k.annee}, représentant le cumul des investissements de ${pays} à l'étranger.`;
    case "sn_last": return v>0?`Avec un stock net de ${fmt}, ${pays} est un récepteur net d'IDE : il accueille plus de capital étranger qu'il n'en détient à l'étranger.`:`Avec un stock net négatif de ${fmt}, ${pays} possède davantage d'actifs à l'étranger qu'il n'en reçoit — profil atypique pour un pays en développement.`;
    case "g_fe": return v>0?`Les flux entrants ont augmenté de ${fmt} en ${k.annee} par rapport à l'année précédente. ${v>50?"Hausse très significative, probablement liée à un grand projet ou une réforme favorable.":v>20?"Croissance solide, signe d'une attractivité en amélioration.":"Légère progression positive."}`:`Les flux entrants ont baissé de ${fmt} en ${k.annee}. ${v<-50?"Chute sévère, probablement liée à une crise ou un retrait d'investisseurs majeurs.":v<-20?"Recul notable qui mérite attention.":"Légère contraction."}`;
    case "g_se": return v>0?`Le stock entrant a progressé de ${fmt}, confirmant l'accumulation continue d'IDE.`:`Le stock entrant a diminué de ${fmt}, ce qui peut indiquer des cessions ou dépréciations d'actifs étrangers.`;
    case "cagr_fe": return v>0?`Le CAGR de ${fmt} signifie qu'en moyenne, les flux entrants ont cru de ${fmt} par an sur la période. ${v>10?"C'est une croissance composée excellente.":v>5?"Croissance soutenue sur le long terme.":"Progression modeste mais régulière."}`:`Un CAGR négatif de ${fmt} indique une tendance à la baisse des flux entrants sur la période analysée.`;
    case "mom_fe": return v>0?`Sur les 5 dernières années, les flux entrants ont progressé de ${fmt}. La dynamique récente est positive.`:`Sur les 5 dernières années, les flux entrants ont reculé de ${fmt}. La tendance récente est préoccupante.`;
    case "moy_fe": return `La moyenne des flux entrants sur la période est de ${fmt} par an. C'est la valeur de référence pour évaluer si une année donnée est exceptionnelle ou en dessous de la normale.`;
    case "med_fe": return `La médiane des flux entrants est de ${fmt}. Elle est moins sensible aux valeurs extrêmes que la moyenne — si médiane < moyenne, cela suggère quelques grandes années tirent la moyenne vers le haut.`;
    case "max_fe": return `Le pic historique des flux entrants est de ${fmt}, atteint en ${k.annee}. Toute valeur récente proche de ce niveau est remarquable.`;
    case "min_fe": return `Le minimum historique est de ${fmt} en ${k.annee}. ${v<0?"Ce minimum négatif représente une phase de désinvestissement.":"C'est le plancher de référence pour contextualiser les flux faibles."}`;
    case "std_fe": return `L'écart-type de ${fmt} mesure la volatilité des flux entrants. ${v>500?"Forte variabilité — les flux sont très irréguliers d'une année à l'autre.":v>100?"Variabilité modérée.":"Flux relativement stables dans le temps."}`;
    case "trend_fe": return v>0?`La tendance linéaire de +${fmt}/an indique une progression structurelle des flux entrants sur la période. Le pays gagne en attractivité sur le long terme.`:`La tendance de ${fmt}/an révèle une érosion structurelle des flux entrants. Sans redressement, la trajectoire est préoccupante.`;
    case "accel_fe": return v>0?`L'accélération positive (${fmt}) montre que la 2e moitié de la période a été meilleure que la 1ère — la dynamique s'améliore.`:`L'accélération négative (${fmt}) indique que la tendance ralentit — la 2e moitié est moins bonne que la 1ère.`;
    case "tv5_fe": return v>0?`Sur 5 ans, le taux de croissance annuel des flux entrants est de ${fmt}. ${v>15?"Dynamique très forte.":v>5?"Croissance soutenue.":"Progression modeste."}`:`Taux de variation négatif sur 5 ans (${fmt}) — déclin récent des flux entrants.`;
    case "tv10_fe": return v>0?`Sur 10 ans, le taux annuel moyen est de ${fmt}. Cela confirme une trajectoire de fond ${v>10?"très positive":"positive"}.`:`Sur 10 ans, tendance négative (${fmt}). Déclin structurel sur la décennie.`;
    case "r_fe_fs": return v>1?`Avec un ratio de ${fmt}, ${pays} reçoit ${fmt} fois plus d'IDE qu'il n'en envoie. Position nette de récepteur.`:v<1?`Le ratio de ${fmt} indique que ${pays} investit davantage à l'étranger qu'il n'en reçoit — profil d'exportateur net de capitaux.`:`Équilibre parfait entre flux entrants et sortants.`;
    case "dist_max_fe": return v>=0?`Les flux entrants actuels sont au niveau de leur pic historique — performance maximale.`:`${Math.abs(v).toLocaleString("fr-FR",{maximumFractionDigits:1})} % en dessous du pic historique. ${Math.abs(v)<20?"Proche du sommet.":Math.abs(v)<50?"Récupération partielle.":"Loin du pic — fort potentiel de rebond."}`;
    case "regularite_fe": return `${fmt} des années ont connu des flux entrants positifs. ${v>80?"Très grande régularité — le pays attire des IDE de manière continue.":v>60?"Bonne régularité malgré quelques années de désinvestissement.":"Flux entrants irréguliers — forte dépendance à des cycles ou projets ponctuels."}`;
    case "vs_moy_fe": return v>0?`La dernière valeur est ${fmt} au-dessus de la moyenne historique. Performance récente supérieure à la norme.`:`La dernière valeur est ${fmt} en dessous de la moyenne historique. Performance récente inférieure à la normale.`;
    case "n_pos_fe": return `Sur la période, ${fmt} années ont connu une croissance des flux entrants. ${+fmt>20?"Majorité d'années positives — trajectoire haussière dominante.":"Autant ou plus d'années de baisse que de hausse."}`;
    case "cur_streak_fe": return +fmt>0?`${pays} enchaîne actuellement ${fmt} année${+fmt>1?"s":""} consécutive${+fmt>1?"s":""} de croissance des flux entrants. ${+fmt>=5?"Série impressionnante — momentum fort.":+fmt>=3?"Dynamique positive en cours.":"Début d'un cycle haussier."}`:(`${pays} n'est pas en série de croissance actuellement. La dernière année a vu les flux baisser.`);
    default: return `Cet indicateur mesure : ${k.description}`;
  }
}

/** Période réellement couverte par des séries de graphe — « 2004–2023 » —, pour
    la pastille des cartes statiques. Seuls les points renseignés comptent : une
    borne de filtre sans donnée annoncerait une profondeur qui n'existe pas. */
export function plageAnnees(series: any[]): string | undefined {
  const ys: number[] = (series || []).flatMap((s: any) => (s.data || []).filter((d: any) => d.valeur !== null).map((d: any) => d.annee));
  if (!ys.length) return undefined;
  const mn = Math.min(...ys), mx = Math.max(...ys);
  return mn === mx ? String(mn) : `${mn}–${mx}`;
}

// ── Découpe du libellé KPI : titre principal + précision (« dernière année », « période »…)
export function splitKpiTitre(label: string): { main: string; suffix: string | null } {
  const dashMatch = label.match(/^(.+?)\s*—\s*(.+)$/);
  if (dashMatch) return { main: dashMatch[1], suffix: dashMatch[2] };
  const parenMatch = label.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenMatch) return { main: parenMatch[1], suffix: parenMatch[2] };
  return { main: label, suffix: null };
}

// ── Mini modal KPI ────────────────────────────────────────────────────────────
/** `definition` : quand elle est fournie, la troisième section devient
    « Définition » — ce que l'indicateur mesure — au lieu de l'interprétation
    générée. Les KPIs greenfield / M&A l'utilisent : leur valeur est un montant
    brut publié par la CNUCED, qu'il faut définir plutôt que commenter. */
export function MiniModalKpi({ kpi, pays, couleur, definition, onClose }: { kpi: KpiResult|null; pays: string; couleur: string; definition?: string|null; onClose: ()=>void }) {
  useEchap(!!kpi, onClose);
  const dialKpi = useDialogue(!!kpi, "Fiche du KPI");
  if (!kpi) return null;
  const interp = interpreterKpi(kpi, pays, couleur);
  const isTrend = ["g_fe","g_se","cagr_fe","mom_fe","trend_fe","vs_moy_fe","accel_fe","tv5_fe","tv10_fe"].includes(kpi.id);
  const isPos = kpi.valeur !== null && kpi.valeur > 0;
  const isNeg = kpi.valeur !== null && kpi.valeur < 0;
  const signalColor = isTrend ? (isPos?"var(--vert)":isNeg?"var(--danger)":"var(--gris)") : couleur;
  const signalBg    = isTrend ? (isPos?"rgb(var(--vert-rgb) / 0.06)":isNeg?"rgb(var(--danger-rgb) / 0.05)":"var(--carte-douce)") : "rgb(var(--bleu-rgb) / 0.04)";
  const signalBorder= isTrend ? (isPos?"rgb(var(--vert-rgb) / 0.18)":isNeg?"rgb(var(--danger-rgb) / 0.18)":"var(--bordure)") : "rgb(var(--bleu-rgb) / 0.10)";
  const trendLabel  = isTrend ? (isPos?"Positif":isNeg?"Négatif":"Neutre") : null;
  const { main: titreMain, suffix: titreSuffix } = splitKpiTitre(kpi.label);
  // « dernière année » ne dit rien que la date du titre ne dise déjà.
  const precision = titreSuffix === "dernière année" ? null : titreSuffix;
  // Les quatre années qui précèdent celle du KPI — la dernière y figure déjà,
  // en grand, dans la section Valeur.
  const historique = (kpi.serie ?? [])
    .filter(p => kpi.annee == null || p.annee < kpi.annee)
    .slice(-4);
  const SecTitle = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize:10.5, fontWeight:700, color:"var(--bleu)", letterSpacing:"0.14em", textTransform:"uppercase" as const, marginBottom:10 }}>{children}</p>
  );

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgb(var(--encre-rgb) / 0.45)", backdropFilter:"blur(8px)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div {...dialKpi} onClick={e=>e.stopPropagation()} style={{ background:"var(--carte)", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"92vh", display:"flex", flexDirection:"column" as const, overflow:"hidden", border: "1px solid var(--bordure)", boxShadow:"var(--ombre-2)", animation:"vueIn 0.22s ease" }}>

        {/* En-tête fixe */}
        <div style={{ padding:"18px 28px 16px", borderBottom:"1px solid var(--bordure)", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              {/* L'année rejoint le titre, et le pays la même ligne. La
                  précision « dernière année » disparaît : la date la dit mieux.
                  Les autres précisions — « (vs N-1) », « (5 ans) » — portent du
                  sens et restent. */}
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" as const, minWidth:0 }}>
                <h2 style={{ fontWeight:800, fontSize:"1.1rem", color:"var(--encre)", margin:0, lineHeight:1.35, minWidth:0 }}>
                  {titreMain}
                  {kpi.annee && <span style={{ color:"var(--gris-fort)" }}>{` · ${kpi.annee}`}</span>}
                </h2>
                <span style={{ ...badgeDe(couleur), whiteSpace:"nowrap" as const }}>{pays}</span>
              </div>
              {(precision || trendLabel) && (
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const, marginTop:8 }}>
                  {precision && (
                    <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:"var(--texte)", background:"var(--champ)" }}>
                      {precision}
                    </span>
                  )}
                  {trendLabel && (
                    <span style={{ fontSize:10.5, fontWeight:700, padding:"3px 10px", borderRadius:999, color:signalColor, background:signalBg, border:`1px solid ${signalBorder}` }}>
                      {trendLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width:32, height:32, borderRadius:"50%", background:"var(--champ)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="var(--fond-creux2)";}} onMouseLeave={e=>{e.currentTarget.style.background="var(--champ)";}}>
              <X size={15} color="var(--texte)" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding:"22px 28px", overflowY:"auto" as const, flex:1, display:"flex", flexDirection:"column" as const, gap:22 }}>
          <div>
            <SecTitle>Valeur</SecTitle>
            <div style={{ background:signalBg, border:`1px solid ${signalBorder}`, borderRadius:12, padding:"16px 18px", display:"flex", alignItems:"baseline", gap:10 }}>
              <span style={{ fontSize:"2.2rem", fontWeight:800, color:signalColor, lineHeight:1, letterSpacing:"-0.02em" }}>{fmtKpi(kpi)}</span>
              {kpi.annee && <span style={{ fontSize:13, color:"var(--gris)", fontWeight:500 }}>en {kpi.annee}</span>}
            </div>
          </div>
          {historique.length > 0 && (
            <div>
              <SecTitle>Historique récent</SecTitle>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${historique.length},1fr)`, gap:8 }}>
                {historique.map(p => (
                  <div key={p.annee} style={{ background:"rgb(var(--bleu-rgb) / 0.04)", border:"1px solid rgb(var(--bleu-rgb) / 0.10)", borderRadius:10, padding:"8px 11px", minWidth:0 }}>
                    <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", color:"var(--bleu)", margin:"0 0 3px" }}>{p.annee}</p>
                    <p style={{ fontSize:12, fontWeight:700, color:"var(--encre)", margin:0, whiteSpace:"nowrap" as const, overflow:"hidden", textOverflow:"ellipsis" }}>
                      {fmtKpi({ ...kpi, valeur: p.v })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <SecTitle>{definition ? "Définition" : "Interprétation"}</SecTitle>
            <div style={{ background:"var(--carte-douce)", border:"1px solid var(--bordure)", borderRadius:12, padding:"14px 18px" }}>
              <p style={{ fontSize:13, color:"var(--encre)", lineHeight:1.75 }}>{definition || interp}</p>
            </div>
          </div>
        </div>

        {/* Pied fixe */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid var(--bordure)", background:"var(--carte-douce)", display:"flex", justifyContent:"flex-end", flexShrink:0 }}>
          <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid var(--bordure-forte)", background:"var(--carte)", color:"var(--texte)", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-google-sans)" }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers pays groupés ──────────────────────────────────────────────────────
const CONT_ORDER = ["Afrique", "Amérique", "Asie", "Europe", "Océanie"];
/**
 * Les continents à présenter, dans l'ordre.
 *
 * « Autre » est écarté : c'est le fourre-tout des entrées sans continent
 * renseigné — pour l'essentiel des agrégats de la CNUCED, pas des pays. Un
 * pays qui s'y trouverait deviendrait invisible dans la barre de filtres ;
 * c'est alors la donnée qu'il faut corriger, pas la liste.
 */
export function sortContinents(conts: string[]) {
  return [...conts].filter(c => c !== "Autre").sort((a, b) => {
    const ia = CONT_ORDER.indexOf(a), ib = CONT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });
}
export function groupByContinent(pays: any[]): Record<string, Record<string, any[]>> {
  const g: Record<string, Record<string, any[]>> = {};
  for (const p of pays) {
    const cont = p.continent || "Autre";
    const zone = p.region_geo || "Autre";
    if (!g[cont]) g[cont] = {};
    if (!g[cont][zone]) g[cont][zone] = [];
    g[cont][zone].push(p);
  }
  for (const cont of Object.keys(g))
    for (const zone of Object.keys(g[cont]))
      g[cont][zone].sort((a, b) => { if (a.nom === "Sénégal") return -1; if (b.nom === "Sénégal") return 1; return a.nom.localeCompare(b.nom, "fr"); });
  return g;
}

// ── Onglet Pays — analyse individuelle ────────────────────────────────────────
export function splitKpiLabel(label: string, dernAnnee: number): { main: string; badge: string | null } {
  const lastYearMatch = label.match(/^(.+?)\s*—\s*dernière année$/);
  if (lastYearMatch) return { main: lastYearMatch[1], badge: String(dernAnnee) };
  const parenMatch = label.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenMatch) return { main: parenMatch[1], badge: parenMatch[2] };
  return { main: label, badge: null };
}

// ── Bouton « Tableau de données » responsive (plein → « Données » → icône) ─────
export function BoutonDonnees({ onClick, dep }: { onClick: () => void; dep?: any }) {
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
      style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap: mode==="icone"?0:7, padding: mode==="icone"?"8px 10px":"8px 16px", borderRadius:999, border:"1px solid var(--bordure-forte)", background:"var(--carte)", color:"var(--bleu)", fontSize:12.5, fontWeight:700, cursor:"pointer", fontFamily:"var(--font-google-sans)", flexShrink:0, whiteSpace:"nowrap" as const }}
      onMouseEnter={e=>{e.currentTarget.style.background="var(--champ)";}} onMouseLeave={e=>{e.currentTarget.style.background="var(--carte)";}}>
      <Table size={14} />{mode!=="icone" && <span>{mode==="full"?"Tableau de données":"Données"}</span>}
    </button>
  );
}

// ── Case à cocher (sélection unique) ──────────────────────────────────────────
export const BDEF_NIVEAU_STYLE: Record<string,{color:string;fs:number;fw:number;base:string}> = {
  macro_secteur: { color:"var(--bleu)", fs:13,   fw:700, base:"var(--encre)" },
  groupe:        { color:"var(--orange)", fs:12.5, fw:600, base:"var(--encre)" },
  secteur:       { color:"var(--vert)", fs:12,   fw:500, base:"var(--texte)" },
};
export const BDEF_NIVEAU_LABEL: Record<string,string> = {
  macro_secteur:"Macro-secteur", groupe:"Groupe", secteur:"Secteur",
};

export function BdefRow({ label, niveau, selected, onSelect, expandable, expanded, onToggle }: {
  label:string; niveau?:string; selected:boolean;
  onSelect:()=>void; expandable?:boolean; expanded?:boolean; onToggle?:()=>void;
}) {
  const st = (niveau && BDEF_NIVEAU_STYLE[niveau]) || { color:"var(--bleu)", fs:12.5, fw:600, base:"var(--encre)" };
  const selBg = `${voile(st.color, 6)}`;
  const dotColor = niveau ? st.color : "var(--gris)";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      {expandable ? (
        <button onClick={onToggle} aria-label={expanded ? "Replier" : "Déplier"} style={{ background:"none", border:"none", cursor:"pointer", padding:2, display:"flex", flexShrink:0 }}>
          <ChevronDown size={12} style={{ color:"var(--gris)", transform:expanded?"rotate(0deg)":"rotate(-90deg)", transition:"transform 0.15s" }}/>
        </button>
      ) : <span style={{ width:16, flexShrink:0 }}/>}
      <button onClick={onSelect}
        style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 9px", borderRadius:8, border:"none", cursor:"pointer", background:(selected&&!niveau)?selBg:"transparent", textAlign:"left" as const, width:"100%" }}
        onMouseEnter={e=>{if(!(selected&&!niveau))(e.currentTarget as HTMLElement).style.background="var(--champ)";}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=(selected&&!niveau)?selBg:"transparent";}}>
        <div style={{ width:9, height:9, borderRadius:"50%", border:`2px solid ${selected?st.color:voile(dotColor, 60)}`, background:selected?st.color:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s" }}>
          {selected&&!niveau&&<div style={{ width:3, height:3, borderRadius:"50%", background:"var(--carte)" }}/>}
        </div>
        <span style={{ fontSize:st.fs, color:"var(--texte)", fontWeight:selected?700:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, letterSpacing:niveau==="macro_secteur"?"-0.01em":"0" }}>{label}</span>
      </button>
    </div>
  );
}

