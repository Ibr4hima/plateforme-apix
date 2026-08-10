"use client";
import { useEchap } from "@/lib/useEchap";
import { SkeletonKPIs, SkeletonChartGrid, SkeletonRows } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fmtUnite as fmt, fmtUSD } from "@/lib/format";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet, Loader2, Search, SlidersHorizontal, Table, X } from "lucide-react";
import { ACCENT_BLEU, ACCENT_ORANGE, AccentNace, StylesCurseurNace, pastilleCurseur, varsAccent } from "@/components/shared/CurseurNace";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardStatistiques";
import { API, sortContinents, BadgePeriode, GrapheMultiPays, NACE_BLEU, NACE_ORANGE } from "./partage";



// ── Panneau Flux bilatéraux (données commerciales) ────────────────────────────
type OptionPaysCom = { id: number; nom: string; code_iso3: string | null; continent: string | null; region_geo: string | null };
// ── Modal « Tableau de données » des flux bilatéraux ──────────────────────────
function ModalDonneesCommerce({ open, onClose, selId, vue, nomPays, anneesTabs }: {
  open: boolean; onClose: () => void; selId: number | null; vue: "exportateur" | "importateur";
  nomPays: string; anneesTabs: number[];
}) {
  useEchap(open, onClose);
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
  const TH: any = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--sur-bleu)", background: "var(--bleu-action)", letterSpacing: "0.03em", textAlign: "left", position: "sticky", top: 0, zIndex: 2, whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.28)" };
  const cell: any = { border: "1px solid var(--bordure-forte)", padding: "8px 14px", verticalAlign: "middle", fontSize: 12.5 };

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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgb(var(--encre-rgb) / 0.45)", backdropFilter: "blur(8px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes vueIn{from{opacity:0;transform:translateY(10px) scale(0.985);}to{opacity:1;transform:none;}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--carte)", borderRadius: 20, width: "100%", maxWidth: 1000, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>
        <div style={{ height: 4, background: "var(--bleu-action)", flexShrink: 0 }} />
        <div style={{ padding: "18px 28px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--encre)", margin: 0 }}>Tableau de données</h2>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.08)", padding: "3px 10px", borderRadius: 999 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--bleu-action)" }} />{nomPays} · {expDir ? "Exportations" : "Importations"}</span>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--champ)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--fond-creux2)"; }} onMouseLeave={e => { e.currentTarget.style.background = "var(--champ)"; }}>
              <X size={15} color="var(--texte)" />
            </button>
          </div>
          {/* Onglets années — défilement horizontal, onglet actif centré */}
          <div ref={tabsRef} style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--bordure)", overflowX: "auto", scrollbarWidth: "thin" }}>
            {anneesTabs.map(a => {
              const on = a === annee;
              return (
                <button key={a} onClick={() => setAnnee(a)} data-actif={on ? "true" : "false"}
                  style={{ padding: "9px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: on ? 800 : 600, color: on ? "var(--bleu)" : "var(--gris)", borderBottom: on ? "2px solid var(--bleu)" : "2px solid transparent", marginBottom: -1, fontFamily: "var(--font-google-sans)", flexShrink: 0 }}>
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
            <div style={{ textAlign: "center", padding: "40px", color: "var(--gris)", fontSize: 13 }}>Aucune donnée pour {annee}.</div>
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
                    const bg = pi % 2 === 0 ? "var(--carte)" : "var(--carte-douce)";
                    lignes.forEach((lg, li) => {
                      rows.push(
                        <tr key={`${pi}-${li}`}>
                          {firstOverall && <td rowSpan={totalRows} style={{ ...cell, fontWeight: 800, color: "var(--bleu)", textAlign: "center", background: "var(--bleu-voile)", verticalAlign: "middle" }}>{nomPays}</td>}
                          {li === 0 && <td rowSpan={lignes.length} style={{ ...cell, fontWeight: 700, color: "var(--encre)", verticalAlign: "middle", background: bg }} title={fmtUSD(p.total)}>{p.nom}</td>}
                          <td style={{ ...cell, color: "var(--texte)", background: bg }}>{lg.ressource}</td>
                          <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--bleu)", background: bg }} title={lg.valeur.toLocaleString("fr-FR") + " $"}>{fmtUSD(lg.valeur)}</td>
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
        <div style={{ padding: "14px 28px", borderTop: "1px solid var(--bordure)", background: "var(--carte-douce)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 10 }}>
          <span style={{ fontSize: 11.5, color: "var(--gris)" }}>{partenaires.length} {colPart.toLowerCase()}s · total {fmtUSD(grand)} en {annee}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {exportErr && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--danger)" }}>Échec de l&apos;export — réessayez.</span>}
            <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid var(--bordure-forte)", background: "var(--carte)", color: "var(--texte)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-google-sans)" }}>Fermer</button>
            <button onClick={exporterExcel} disabled={exporting}
              style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "var(--bleu-action)", color: "var(--sur-bleu)", fontSize: 12.5, fontWeight: 700, cursor: exporting ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 3px 12px rgb(var(--ombre-rgb) / 0.25)", fontFamily: "var(--font-google-sans)", opacity: exporting ? 0.7 : 1 }}>
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

  const LBL: any = { fontSize: 11, fontWeight: 700, color: "var(--gris)", textTransform: "uppercase", letterSpacing: "0.1em" };
  const TH: any = { padding: "11px 16px", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--gris-fort)", whiteSpace: "nowrap" };
  const TD: any = { padding: "10px 16px", verticalAlign: "middle" };
  const ressFiltrees = ressources.filter(r => !qRess || (r.libelle || r.nom_en).toLowerCase().includes(qRess.toLowerCase()));

  if (loading) return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "32px 40px 80px", display: "grid", gap: 18 }}>
      <SkeletonKPIs n={5} />
      <SkeletonChartGrid n={2} cols={2} height={320} />
    </div>
  );
  // Les retours anticipés sont des enfants directs de la colonne de hauteur
  // fixe : sans conteneur défilant, un contenu un peu haut déborderait au lieu
  // de défiler.
  if (erreur) return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" }}>
      <ErreurChargement onRetry={() => setTick(t => t + 1)} />
    </div>
  );
  if (!annees.length) return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", textAlign: "center", padding: "80px 24px", color: "var(--gris)" }}>
      <p style={{ fontSize: 16, fontWeight: 600, color: "var(--texte)" }}>Aucune donnée commerciale</p>
      <p style={{ fontSize: 14, marginTop: 6 }}>Les flux bilatéraux seront disponibles après import dans l&apos;administration.</p>
    </div>
  );

  return (
    <div className="charge-in" style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* ── Barre de filtre ── */}
      <aside style={{ width: sidebarOpen ? sidebarWidth : 52, flexShrink: 0, transition: isResizing.current ? "none" : "width 0.25s", background: "var(--carte)", borderRight: "1px solid var(--bordure-forte)", height: "100%", overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column" }}>
        {sidebarOpen && <div onMouseDown={startResize} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent" }} onMouseEnter={e => { e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.5)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />}
        <div style={{ padding: sidebarOpen ? "14px 16px 10px" : "12px 8px", borderBottom: "1px solid var(--bordure)", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", flexShrink: 0 }}>
          {sidebarOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--encre)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Filtres</span>}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setSidebarOpen(o => !o)} aria-label={sidebarOpen ? "Réduire les filtres" : "Afficher les filtres"} style={{ background: "rgb(var(--bleu-rgb) / 0.08)", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 5 }}>
              <SlidersHorizontal size={14} style={{ color: "var(--bleu)" }} />
              {sidebarOpen && nbFiltres > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.15)", borderRadius: 999, padding: "1px 5px" }}>{nbFiltres}</span>}
            </button>
            {sidebarOpen && nbFiltres > 0 && <button onClick={reinit} title="Tout réinitialiser" style={{ background: "rgb(var(--danger-rgb) / 0.08)", border: "1px solid rgb(var(--danger-rgb) / 0.20)", cursor: "pointer", borderRadius: 999, padding: "5px", display: "flex", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.08)"; }}>
              <X size={13} style={{ color: "var(--danger)" }} />
            </button>}
          </div>
        </div>
        {sidebarOpen && <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
          {/* Recherche pays */}
          <div style={{ position: "relative", marginBottom: 18 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--gris)" }} />
            <input value={searchPays} onChange={e => setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
              style={{ width: "100%", paddingLeft: 30, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid var(--bordure-forte)", background: "var(--carte-douce)", fontSize: 12, color: "var(--encre)", outline: "none", fontFamily: "var(--font-google-sans)", boxSizing: "border-box" }} />
            {searchPays && <button onClick={() => setSearchPays("")} aria-label="Effacer la recherche" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "var(--gris)" }} /></button>}
          </div>
          <div style={{ height: 1, background: "var(--fond)", marginBottom: 18 }} />
          {/* Pays */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={LBL}>Pays</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.18)", padding: "1px 6px", borderRadius: 999 }}>1</span>
            </div>
            {/* Sénégal épinglé (référence) */}
            {senId !== null && (() => {
              const sel = selId === senId;
              return (
                <div style={{ marginBottom: 8, marginLeft: 6 }}>
                  <button onClick={() => setSelId(senId)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left", width: "100%" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--carte-douce)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? "var(--bleu)" : "var(--bordure-forte)"}`, background: sel ? "var(--bleu-action)" : "transparent", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "var(--texte)", fontWeight: sel ? 700 : 400 }}>Sénégal</span>
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--gris)", fontWeight: 600, background: "var(--fond)", padding: "1px 5px", borderRadius: 4 }}>Réf.</span>
                  </button>
                </div>
              );
            })()}
            <div style={{ height: 1, background: "var(--fond)", marginBottom: 8 }} />
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {/* « Autre » ne figure pas dans le filtre : ce sont des agrégats,
                  pas des pays de référence. Ils restent dans les données —
                  « Bunkers » tient sa place dans les tableaux de destinations. */}
              {sortContinents(Object.keys(groupedPays), true).map(continent => {
                const isOpen = openConts.has(continent);
                const zones = groupedPays[continent];
                return (
                  <div key={continent} style={{ marginBottom: 6 }}>
                    <button onClick={() => toggleCont(continent)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: 7, background: "rgb(var(--bleu-rgb) / 0.04)", border: "none", cursor: "pointer", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--bleu)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{continent}</span>
                      <ChevronDown size={11} style={{ color: "var(--bleu)", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                    </button>
                    {isOpen && Object.entries(zones).sort(([a], [b]) => a.localeCompare(b, "fr")).map(([zone, paysInZone]) => (
                      <div key={zone} style={{ marginLeft: 6, marginBottom: 4 }}>
                        <p style={{ fontSize: 9, fontWeight: 600, color: "var(--gris)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "2px 8px", marginBottom: 2 }}>{zone}</p>
                        {paysInZone.map(p => {
                          const sel = selId === p.id;
                          if (p.id === senId) return (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, width: "100%", opacity: 0.35, cursor: "not-allowed" }}>
                              <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? "var(--bleu)" : "var(--bordure-forte)"}`, background: sel ? "var(--bleu-action)" : "transparent", flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "var(--texte)", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                              <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--gris)" }}>Réf.</span>
                            </div>
                          );
                          return (
                            <button key={p.id} onClick={() => setSelId(p.id)}
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", textAlign: "left", width: "100%" }}
                              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "var(--carte-douce)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                              <div style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${sel ? "var(--bleu)" : "var(--bordure-forte)"}`, background: sel ? "var(--bleu-action)" : "transparent", flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: "var(--texte)", fontWeight: sel ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
              {Object.keys(groupedPays).length === 0 && <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center", padding: "8px 0" }}>Aucun pays trouvé</p>}
            </div>
          </div>
          <div style={{ height: 1, background: "var(--fond)", marginBottom: 18 }} />
          {/* Période */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={LBL}>Période</span>
            </div>
            <div style={{ display: "flex", gap: 3, background: "var(--fond)", borderRadius: 9, padding: 3, marginBottom: 12 }}>
              {[{ v: "plage", l: "Plage" }, { v: "specifiques", l: "Années" }].map(m => (
                <button key={m.v} onClick={() => setModeAnnees(m.v as "plage" | "specifiques")}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: modeAnnees === m.v ? "var(--carte)" : "transparent", color: modeAnnees === m.v ? "var(--encre)" : "var(--gris)", boxShadow: modeAnnees === m.v ? "0 1px 4px rgb(var(--ombre-rgb) / 0.1)" : "none", transition: "all 0.15s" }}>
                  {m.l}
                </button>
              ))}
            </div>
            {modeAnnees === "plage" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ position: "relative", height: 24, marginBottom: 2 }}>
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 4, background: "var(--fond-creux2)", borderRadius: 2, transform: "translateY(-50%)" }} />
                  <div style={{ position: "absolute", top: "50%", left: `${((anneeMin - bornes[0]) / span) * 100}%`, width: `${Math.max(0, ((anneeMax - bornes[0]) / span) * 100 - ((anneeMin - bornes[0]) / span) * 100)}%`, height: 4, background: "var(--bleu-action)", borderRadius: 2, transform: "translateY(-50%)" }} />
                  <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMin}
                    onChange={e => { setPeriodeTouchee(true); setAnneeMin(Math.min(+e.target.value, anneeMax)); }}
                    className="drs-thumb" style={{ zIndex: anneeMin >= anneeMax ? 4 : 2 } as any} />
                  <input type="range" min={bornes[0]} max={bornes[1]} value={anneeMax}
                    onChange={e => { setPeriodeTouchee(true); setAnneeMax(Math.max(+e.target.value, anneeMin)); }}
                    className="drs-thumb" style={{ zIndex: 3 } as any} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.08)", padding: "2px 8px", borderRadius: 6 }}>{anneeMin}</span>
                  <span style={{ fontSize: 10, color: "var(--gris)" }}>—</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.08)", padding: "2px 8px", borderRadius: 6 }}>{anneeMax}</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--gris)", textAlign: "center" }}>{anneeMax - anneeMin + 1} année{anneeMax - anneeMin + 1 > 1 ? "s" : ""}</p>
              </div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3, marginBottom: 8 }}>
                  {Array.from({ length: span + 1 }, (_, i) => bornes[0] + i).map(a => {
                    const sel = anneesSpec.includes(a);
                    return (
                      <button key={a} onClick={() => { setPeriodeTouchee(true); setAnneesSpec(prev => sel ? prev.filter(x => x !== a) : [...prev, a].sort()); }}
                        style={{ padding: "5px 0", borderRadius: 5, border: `1px solid ${sel ? "var(--bleu)" : "var(--bordure-forte)"}`, cursor: "pointer", fontSize: 10, fontWeight: sel ? 700 : 400, textAlign: "center", background: sel ? "var(--bleu-action)" : "var(--carte-douce)", color: sel ? "var(--sur-bleu)" : "var(--texte)", transition: "all 0.1s" }}>
                        {a}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--texte)" }}>{anneesSpec.length > 0 ? `${anneesSpec.length} année${anneesSpec.length > 1 ? "s" : ""}` : ""}</span>
                  {anneesSpec.length > 0 && <button onClick={() => setAnneesSpec([])} style={{ fontSize: 11, color: "var(--gris)", background: "none", border: "none", cursor: "pointer" }}>Effacer</button>}
                </div>
              </div>
            )}
          </div>
        </div>}
      </aside>

      {/* ── Zone principale ── */}
      {/* L'accent suit le sens affiché — bleu à l'export, orange à l'import —
          comme dans le commerce extérieur : la couleur dit de quel flux on
          parle, sans qu'il faille relire la bascule. Le panneau de filtres
          reste bleu : il sélectionne, il ne montre pas de donnée. */}
      {(() => { const accent = vue === "exportateur" ? ACCENT_BLEU : ACCENT_ORANGE; return (
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "32px 40px 80px" }}>
        {/* Header : pays → bascule Exportations/Importations → période */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: accent.trait, flexShrink: 0 }} />
          <h2 style={{ fontWeight: 800, fontSize: "1.3rem", color: "var(--encre)", margin: 0 }}>{selPays?.nom || "—"}</h2>
          <div style={{ display: "inline-flex", background: "var(--fond)", borderRadius: 999, padding: 3, gap: 3, flexShrink: 0 }}>
            {VUES_COM.map(o => {
              const actif = vue === o.v;
              return (
                <button key={o.v} onClick={() => setVue(o.v)}
                  style={{ padding: "5px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" as const,
                    background: actif ? "var(--carte)" : "transparent", color: actif ? (o.v === "exportateur" ? NACE_BLEU : NACE_ORANGE) : "var(--gris)",
                    boxShadow: actif ? "0 1px 4px rgb(var(--ombre-rgb) / 0.1)" : "none", transition: "all 0.15s", fontFamily: "var(--font-google-sans)" }}>
                  {o.v === "exportateur" ? "Exportations" : "Importations"}
                </button>
              );
            })}
          </div>
          <BadgePeriode>{perLabel}</BadgePeriode>
          <button onClick={() => setShowTable(true)} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 999, border: "1px solid var(--bordure-forte)", background: "var(--carte)", color: accent.trait, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-google-sans)", flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--champ)"; }} onMouseLeave={e => { e.currentTarget.style.background = "var(--carte)"; }}>
            <Table size={14} /> Tableau de données
          </button>
        </div>

        {/* KPI cards — valeurs de la dernière année sélectionnée (sauf « Année record ») */}
        {(() => {
          const expDir = vue === "exportateur";
          const ref = kpis?.annee_ref;
          // Le millésime en chiffres tient lieu de sous-titre : « Dernière année »
          // ne disait rien que la valeur ne dise, et obligeait à répéter « en YYYY »
          // sous chaque chiffre. L'année figure déjà dans le libellé des cartes 2 et 3.
          const cards = [
            { label: expDir ? "Total exportations" : "Total importations", sub: ref ? String(ref) : "", value: fmtUSD(kpis?.total ?? null), indicatif: "", text: false },
            { label: expDir ? `1er client · ${ref ?? "—"}` : `1er fournisseur · ${ref ?? "—"}`, sub: "", value: kpis?.top_partenaire?.nom || "—", indicatif: kpis?.top_partenaire ? fmtUSD(kpis.top_partenaire.valeur) : "", text: true },
            { label: `1re ressource · ${ref ?? "—"}`, sub: "", value: kpis?.top_ressource?.ressource || "—", indicatif: kpis?.top_ressource ? fmtUSD(kpis.top_ressource.valeur) : "", text: true },
            { label: expDir ? "Part du 1er client" : "Part du 1er fournisseur", sub: `Concentration · ${ref ?? "—"}`, value: kpis?.part_top_partenaire != null ? `${kpis.part_top_partenaire.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—", indicatif: kpis?.top_partenaire?.nom ? `${expDir ? "vers" : "depuis"} ${kpis.top_partenaire.nom}` : "", text: false },
          ];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20, opacity: chargKpis ? 0.5 : 1, transition: "opacity 0.15s" }}>
              {cards.map((c, i) => (
                <div key={i} style={{ background: "var(--carte)", borderRadius: 14, padding: "13px 14px", border: "1px solid rgb(var(--encre-rgb) / 0.12)", boxShadow: "none", transition: "border-color 0.18s", minWidth: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent.piste; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgb(var(--encre-rgb) / 0.12)"; }}>
                  <div style={{ marginBottom: 7 }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", color: accent.trait, textTransform: "uppercase", lineHeight: 1.4 }}>{c.label}</p>
                    {c.sub && <p style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.06em", color: "var(--gris)", textTransform: "uppercase", marginTop: 2, lineHeight: 1.3 }}>{c.sub}</p>}
                  </div>
                  <p title={c.text ? c.value : undefined} style={{ fontSize: c.text ? "0.95rem" : "1.15rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: c.text ? "normal" : "nowrap", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{c.value}</p>
                  {c.indicatif && <p style={{ fontSize: 10, color: "var(--gris)", marginTop: 5, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.indicatif}</p>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Graphes */}
        {balance.length > 0 && (() => {
          const expDir = vue === "exportateur";
          const balSerie = [{ nom: "Balance commerciale", couleur: accent.trait, data: balance.map(b => ({ annee: b.annee, valeur: b.balance })) }];
          const fluxSerie = [{ nom: expDir ? "Exportations" : "Importations", couleur: accent.trait, data: balance.map(b => ({ annee: b.annee, valeur: expDir ? b.exportations : b.importations })) }];
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
          const carte: React.CSSProperties = { background: "var(--carte)", borderRadius: 14, border: "1px solid rgb(var(--encre-rgb) / 0.12)", padding: "16px 18px", minWidth: 0 };
          const titreStyle: React.CSSProperties = { fontWeight: 700, fontSize: 13.5, color: "var(--encre)", margin: 0 };
          const enTete: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" };
          const Vide = ({ annee }: { annee: number }) => (
            <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center", padding: "22px 0" }}>Aucune donnée pour {annee}.</p>
          );
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              {(tops?.ressources?.length || 0) > 0 && (
                <div style={carte}>
                  <div style={enTete}>
                    <h3 style={titreStyle}>{expDir ? "Poids des ressources exportées" : "Poids des ressources importées"}</h3>
                    <BarreCumulAnnee annees={anneesTabs} annee={anneePoids} onAnnee={setAnneePoids} accent={accent} />
                  </div>
                  {anneePoids !== null && chargTopsAnnee
                    ? <SkeletonRows n={Math.max(3, donutData.length || 6)} h={26} />
                    : donutData.length > 0
                    ? <TableauPoidsRessources data={donutData} total={topsAff?.total || 0} accent={accent} />
                    : anneePoids !== null && <Vide annee={anneePoids} />}
                </div>
              )}
              {(repart?.partenaires?.length || 0) > 0 && (
                <div style={carte}>
                  <div style={enTete}>
                    <h3 style={titreStyle}>{expDir ? "Exportations par destination et ressource" : "Importations par origine et ressource"}</h3>
                    <BarreCumulAnnee annees={anneesTabs} annee={anneeRepart} onAnnee={setAnneeRepart} accent={accent} />
                  </div>
                  {anneeRepart !== null && chargRepartAnnee
                    ? <SkeletonRows n={Math.max(3, parts.length || 6)} h={30} />
                    : parts.length > 0
                    ? <TableauPartenairesRessources partenaires={parts} ressources={resLabels} accent={accent} />
                    : anneeRepart !== null && <Vide annee={anneeRepart} />}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      ); })()}
      <ModalDonneesCommerce open={showTable} onClose={() => setShowTable(false)} selId={selId} vue={vue}
        nomPays={selPays?.nom || "—"} anneesTabs={anneesTabs} />
    </div>
  );
}

// ── Bascule Cumul / année des tableaux de flux ────────────────────────────────
// Même curseur que le commerce extérieur — bornes, poignée, pastille — pour
// qu'un seul geste se lise de la même façon d'un onglet à l'autre. La graduation
// diffère : les années croissantes, puis un cran de plus tout à droite pour le
// cumul de la période, qui est la lecture par défaut.
function BarreCumulAnnee({ annees, annee, onAnnee, accent }: {
  annees: number[]; annee: number | null; onAnnee: (a: number | null) => void; accent: AccentNace;
}) {
  if (annees.length < 2) return null;
  const n = annees.length;                       // position n = Cumul
  const i = annee == null ? n : Math.max(0, annees.indexOf(annee));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11, marginLeft: "auto", flexShrink: 0, ...varsAccent(accent) }}>
      <StylesCurseurNace />
      <span style={{ fontSize: 10, color: "var(--gris)", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{annees[0]}</span>
      <input type="range" min={0} max={n} step={1} value={i}
        onChange={e => { const k = Number(e.target.value); onAnnee(k >= n ? null : annees[k]); }}
        aria-label="Cumul ou année" className="nace-curseur" style={{ width: 150 }} />
      <span style={pastilleCurseur(accent)}>{annee ?? "Cumul"}</span>
    </span>
  );
}

// ── Tableau du poids des ressources (Flux bilatéraux) ─────────────────────────
// Tableau fixe : ressource · valeur · part du total · barre, total en pied.
function TableauPoidsRessources({ data, total, accent }: {
  data: { label: string; valeur: number }[]; total: number; accent: AccentNace;
}) {
  const somme = total || data.reduce((s, d) => s + d.valeur, 0) || 1;
  const max = Math.max(1e-9, ...data.map(d => d.valeur));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 2px" }}>
        <span style={{ flex: 1, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase" }}>Ressource</span>
        <span style={{ width: 84, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase", textAlign: "right" }}>Valeur</span>
        <span style={{ width: 56, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase", textAlign: "right" }}>Part</span>
        <span style={{ width: "34%", flexShrink: 0 }} />
      </div>
      {data.map((d, i) => {
        const autres = d.label === "Autres";
        const zebre = i % 2 === 1;
        return (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, background: zebre ? "var(--carte-douce)" : "transparent", transition: "background 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background = accent.voile; }}
            onMouseLeave={e => { e.currentTarget.style.background = zebre ? "var(--carte-douce)" : "transparent"; }}>
            <span title={d.label} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: autres ? "var(--gris)" : "var(--encre)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <span style={{ width: 84, fontSize: 11.5, fontWeight: 800, color: autres ? "var(--gris)" : accent.trait, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>{fmtUSD(d.valeur)}</span>
            <span style={{ width: 56, fontSize: 10.5, fontWeight: 700, color: "var(--texte)", textAlign: "right", flexShrink: 0 }}>{(d.valeur / somme * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span>
            <div style={{ width: "34%", height: 8, background: "var(--fond)", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
              <div style={{ height: "100%", width: `${Math.max(1.5, d.valeur / max * 100)}%`, borderRadius: 99, background: autres ? "var(--fond-creux2)" : accent.trait, opacity: autres ? 0.6 : 0.8 }} />
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


function TableauPartenairesRessources({ partenaires, ressources, accent }: {
  partenaires: { nom: string; code_iso2?: string | null; total: number; valeurs: number[] }[];
  ressources: string[]; accent: AccentNace;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px 6px 8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase", borderBottom: "1px solid var(--bordure)", width: 34 }}>#</th>
            <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase", borderBottom: "1px solid var(--bordure)" }}>Pays</th>
            {ressources.map(r => (
              <th key={r} style={{ textAlign: "right", padding: "8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", color: "var(--gris)", textTransform: "uppercase", borderBottom: "1px solid var(--bordure)", whiteSpace: "nowrap" }}>{r}</th>
            ))}
            <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: accent.trait, textTransform: "uppercase", borderBottom: "1px solid var(--bordure)" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {partenaires.map((p, i) => {
            // Ressource dominante du partenaire : sa valeur ressort en vert
            const vMax = Math.max(0, ...p.valeurs.map(v => v ?? 0));
            const zebre = i % 2 === 1;
            const podium = i < 3;
            return (
            <tr key={p.nom} style={{ background: zebre ? "var(--carte-douce)" : "transparent", transition: "background 0.12s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = accent.voile; }}
              onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = zebre ? "var(--carte-douce)" : "transparent"; }}>
              <td style={{ padding: "7px 6px 7px 10px", borderBottom: "1px solid var(--bordure)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%",
                  background: podium ? accent.trait : "var(--sur-bleu)", color: podium ? "var(--sur-bleu)" : "var(--gris)", fontSize: 10.5, fontWeight: 800 }}>{i + 1}</span>
              </td>
              <td style={{ padding: "7px 10px", borderBottom: "1px solid var(--bordure)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  <DrapeauPays iso={p.code_iso2} nom={p.nom} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--encre)", whiteSpace: "nowrap" }}>{p.nom}</span>
                </span>
              </td>
              {ressources.map((r, ri) => {
                const v = p.valeurs[ri] ?? 0;
                const dominante = v > 0 && v === vMax;
                return <td key={r} style={{ padding: "7px 10px", fontSize: 11.5, fontWeight: dominante ? 800 : v > 0 ? 600 : 400, color: dominante ? "var(--vert)" : v > 0 ? "var(--encre)" : "var(--gris)", textAlign: "right", whiteSpace: "nowrap", borderBottom: "1px solid var(--bordure)", fontVariantNumeric: "tabular-nums" }}>{v > 0 ? fmtUSD(v) : "—"}</td>;
              })}
              <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 800, color: accent.trait, textAlign: "right", whiteSpace: "nowrap", borderBottom: "1px solid var(--bordure)", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(p.total)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CommercePanel;
