"use client";
import { useEchap } from "@/lib/useEchap";
import { useDialogue } from "@/lib/dialogue";
import { Skeleton, SkeletonKPIs, SkeletonChartGrid, SkeletonRows } from "@/components/shared/Skeleton";
import { useDebounced } from "@/lib/useDebounced";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { fmtUnite as fmt, fmtUSD, plageAnnees } from "@/lib/format";
import DrapeauPays from "@/components/shared/DrapeauPays";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet, Loader2, Pin, Search, Table, X } from "lucide-react";
import { EnteteFiltres, EntetePeriode, resumePeriode } from "@/components/shared/PanneauFiltres";
import { ACCENT_BLEU, ACCENT_ORANGE, AccentNace, StylesCurseurNace, pastilleCurseur, varsAccent, CurseurPlageNace } from "@/components/shared/CurseurNace";
import { demarrerRedimension } from "@/lib/redimension";
import { GrapheCard } from "@/components/charts/GrapheCardStatistiques";
import { API, sortContinents, BadgePeriode, GrapheMultiPays, NACE_BLEU, NACE_ORANGE } from "./partage";
import { useDonnees } from "@/lib/donnees";
import { usePeriodeChoisie } from "@/lib/periode";
import { useContinentsOuverts } from "@/lib/useContinentsOuverts";



// ── Panneau Flux bilatéraux (données commerciales) ────────────────────────────
type OptionPaysCom = { id: number; nom: string; code_iso3: string | null; continent: string | null; region_geo: string | null };
/** Une ligne du tableau partenaire × ressource. `rang` est le rang du
 *  partenaire dans le classement COMPLET, pas sa position dans la page — c'est
 *  ce qui donne son sens à une recherche hors du top 10. */
type PartenaireRessources = { nom: string; code_iso2?: string | null; rang?: number | null; total: number; valeurs: number[] };
/** Ce que lit un tableau de flux : une année, ou le cumul de la période. */
type Lecture = number | "cumul";
// ── Modal « Tableau de données » des flux bilatéraux ──────────────────────────
function ModalDonneesCommerce({ open, onClose, selId, vue, nomPays, anneesTabs }: {
  open: boolean; onClose: () => void; selId: number | null; vue: "exportateur" | "importateur";
  nomPays: string; anneesTabs: number[];
}) {
  useEchap(open, onClose);
  const dialTable = useDialogue(open, "Tableau de données des flux");
  // L'année affichée : celle qu'on a choisie, sinon la dernière. Rouvrir la
  // fenêtre revient à la dernière — décidé pendant le rendu, pas après.
  const [anneeChoisie, setAnnee] = useState<number | null>(null);
  const [ouvertVu, setOuvertVu] = useState(open);
  if (open !== ouvertVu) { setOuvertVu(open); if (open) setAnnee(null); }
  const annee = anneeChoisie !== null && anneesTabs.includes(anneeChoisie)
    ? anneeChoisie : (anneesTabs.length ? anneesTabs[anneesTabs.length - 1] : null);
  // Le détail de l'année vient du cache des données : une année déjà ouverte
  // se raffiche sans attente.
  type PartenaireDetail = { nom: string; total: number; lignes: { ressource: string; valeur: number }[] };
  const qDetail = useDonnees<{ partenaires?: PartenaireDetail[] }>(open && selId && annee != null
    ? `${API}/statistiques/commerce/detail?pays_id=${selId}&direction=${vue}&annee=${annee}` : null);
  const partenaires = useMemo(() => qDetail.data?.partenaires ?? [], [qDetail.data]);
  const charg = qDetail.isPending && open && !!selId && annee != null;
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState(false); // échec d'export : message transitoire
  const tabsRef = useRef<HTMLDivElement>(null);

  // Faire défiler l'onglet actif dans le champ de vision (l'année par défaut
  // est la dernière, sinon hors écran quand la période compte 20+ années)
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[data-actif="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [open, annee]);
  if (!open) return null;
  const expDir = vue === "exportateur";
  const colSelf = expDir ? "Exportateur" : "Importateur";
  const colPart = expDir ? "Importateur" : "Exportateur";
  const totalRows = partenaires.reduce((s, p) => s + Math.max(1, p.lignes.length), 0);
  const grand = partenaires.reduce((s, p) => s + p.total, 0);
  const TH: any = { padding: "12px 14px", fontSize: 9.5, fontWeight: 800, color: "var(--gris-fort)", background: "var(--carte-douce)", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "left", position: "sticky", top: 0, zIndex: 2, whiteSpace: "nowrap", border: "1px solid var(--bordure-forte)" };
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
      <div {...dialTable} onClick={e => e.stopPropagation()} style={{ background: "var(--carte)", borderRadius: 8, width: "100%", maxWidth: 1000, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--filet-carte)", boxShadow: "var(--ombre-2)", animation: "vueIn 0.22s ease" }}>
        <div style={{ padding: "18px 28px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--encre)", margin: 0 }}>Tableau de données</h2>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "var(--bleu)", background: "rgb(var(--bleu-rgb) / 0.08)", padding: "3px 10px", borderRadius: 999 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--bleu-action)" }} />{nomPays} · {expDir ? "Exportations" : "Importations"}</span>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--carte-douce)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--fond-creux2)"; }} onMouseLeave={e => { e.currentTarget.style.background = "var(--carte-douce)"; }}>
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
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, borderTopLeftRadius: 8 }}>{colSelf}</th>
                  <th style={TH}>{colPart}</th>
                  <th style={TH}>Ressource</th>
                  <th style={{ ...TH, textAlign: "right", borderTopRightRadius: 8 }}>Valeur</th>
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
            <button onClick={onClose} className="ds-bouton ds-bouton--secondaire">Fermer</button>
            <button onClick={exporterExcel} disabled={exporting} className="ds-bouton ds-bouton--primaire">
              {exporting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <FileSpreadsheet size={13} />} Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Les hauteurs que prennent, une fois remplies, une carte d'indicateur et une
// carte de graphe de cet onglet : les squelettes les reprennent, pour que rien
// ne bouge à l'arrivée des données.
const HAUTEUR_KPI = 102;
const HAUTEUR_GRAPHE = 330;

const VUES_COM: { v: "exportateur" | "importateur"; l: string }[] = [
  { v: "exportateur", l: "Exportateur" },
  { v: "importateur", l: "Importateur" },
];
function CommercePanel() {
  const [vue, setVue] = useState<"exportateur" | "importateur">("exportateur");
  // Le référentiel des filtres (années, ressources, pays) vient du cache React
  // Query. LES ÉTATS NE GARDENT QUE LES CHOIX : pays, période et ressources
  // par défaut se DÉDUISENT du référentiel pendant le rendu. Ils y étaient
  // recopiés par un effet, à partir de valeurs de départ inventées (2020 —
  // 2024, aucun pays) : la page demandait donc d'abord ces années-là, les
  // affichait, puis redemandait tout sur la vraie période.
  const qFiltres = useDonnees<{ annees: number[]; ressources: { nom_en: string; libelle: string }[]; pays: OptionPaysCom[] }>(`${API}/statistiques/commerce/filtres`);
  const annees = useMemo(() => (qFiltres.data?.annees ?? []).slice().sort((a: number, b: number) => a - b), [qFiltres.data]);
  const ressources = useMemo(() => qFiltres.data?.ressources ?? [], [qFiltres.data]);
  const paysOpts = useMemo(() => qFiltres.data?.pays ?? [], [qFiltres.data]);
  const senId = useMemo(() => paysOpts.find(p => p.code_iso3 === "SEN")?.id ?? null, [paysOpts]);
  // Le pays choisi, sinon le Sénégal (à défaut, le premier de la liste).
  const [selIdChoisi, setSelId] = useState<number | null>(null);
  const selId = selIdChoisi ?? senId ?? paysOpts[0]?.id ?? null;
  const loading = qFiltres.isPending;
  // Barre latérale
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [searchPays, setSearchPays] = useState("");
  const continents = useContinentsOuverts(searchPays);
  // Période
  const [modeAnnees, setModeAnnees] = useState<"plage" | "specifiques">("plage");
  const bornes = useMemo<[number, number]>(
    () => annees.length ? [annees[0], annees[annees.length - 1]] : [0, 0], [annees]);
  // La période réglée au curseur, sinon les bornes (lib/periode) : sans
  // réglage, les requêtes ne portent aucune année.
  const periode = usePeriodeChoisie(bornes[0], bornes[1]);
  const { anneeMin, anneeMax } = periode;
  const [anneesSpec, setAnneesSpec] = useState<number[]>([]);
  // Période « stabilisée » : les fetchs attendent la fin du drag / des clics
  // rapides au lieu de partir en rafale à chaque tick de slider.
  const anneeMinD = useDebounced(periode.choisieMin, 300);
  const anneeMaxD = useDebounced(periode.choisieMax, 300);
  const anneesSpecD = useDebounced(anneesSpec, 300);
  // Ressources sélectionnées (nom_en) — null : toutes, le défaut.
  const [ressChoisies, setRessChoisies] = useState<string[] | null>(null);
  const toutesRess = useMemo(() => ressources.map(r => r.nom_en), [ressources]);
  const ressSel = ressChoisies ?? toutesRess;
  const [qRess, setQRess] = useState("");
  // Recherche d'un partenaire hors du top 10 : le serveur classe tous les
  // partenaires et renvoie ceux dont le nom correspond, avec leur rang réel.
  const [rechPart, setRechPart] = useState("");
  const rechPartD = useDebounced(rechPart, 300);
  // Partenaires épinglés, par nom : ils restent affichés quels que soient le
  // top, la recherche ou l'année. Le serveur les recalcule à chaque requête —
  // la page ne conserve aucune valeur figée.
  const [partEpingles, setPartEpingles] = useState<string[]>([]);
  const clefEpingles = partEpingles.join("|");
  const togglePin = (nom: string) =>
    setPartEpingles(prev => prev.includes(nom) ? prev.filter(n => n !== nom) : [...prev, nom]);
  // Ce que lit chacun des deux tableaux du bas, réglé à son curseur : une
  // année, ou « cumul », la somme de la période. `null` : la lecture par
  // défaut, la dernière année (lectureDe, plus bas).
  const [choixPoids, setChoixPoids] = useState<Lecture | null>(null);
  const [choixRepart, setChoixRepart] = useState<Lecture | null>(null);
  const anneesTabs = useMemo(() => annees.filter(a => modeAnnees === "specifiques"
    ? anneesSpec.includes(a) : (a >= anneeMin && a <= anneeMax)), [annees, modeAnnees, anneesSpec, anneeMin, anneeMax]);
  const [showTable, setShowTable] = useState(false);

  const isResizing = useRef(false);
  const startResize = (e: React.MouseEvent) => demarrerRedimension(e, sidebarWidth, setSidebarWidth, isResizing, 220, 520);

  const erreur = qFiltres.isError;

  // ── Les données de la page, chacune sous sa clé-URL ──────────────────────
  // `garder` maintient l'affichage pendant les transitions (période tirée au
  // curseur, changement de direction) ; une combinaison déjà vue est servie du
  // cache sans réseau.
  const paramsPeriode = (avecVue: boolean) => {
    const p = new URLSearchParams(avecVue ? { pays_id: String(selId), direction: vue } : { pays_id: String(selId) });
    if (modeAnnees === "specifiques") { if (anneesSpecD.length) p.set("annees", anneesSpecD.join(",")); }
    else {
      if (anneeMinD != null) p.set("annee_min", String(anneeMinD));
      if (anneeMaxD != null) p.set("annee_max", String(anneeMaxD));
    }
    if (ressources.length && ressSel.length && ressSel.length < ressources.length) p.set("ressources", ressSel.join(","));
    return p;
  };

  const qKpis = useDonnees<any>(selId ? `${API}/statistiques/commerce/kpis?${paramsPeriode(true)}` : null, { garder: true });
  const kpis = selId ? qKpis.data ?? null : null;
  const chargKpis = qKpis.isFetching;

  const qBalance = useDonnees<any>(selId ? `${API}/statistiques/commerce/balance?${paramsPeriode(false)}` : null, { garder: true });
  const balance = useMemo(() => (selId && Array.isArray(qBalance.data) ? qBalance.data : []) as { annee: number; exportations: number; importations: number; balance: number }[], [selId, qBalance.data]);

  // ── Les deux tableaux du bas : la dernière année, sauf réglage ───────────
  // L'année par défaut est celle des indicateurs — la dernière de la
  // sélection qui a des données — dès que leur réponse porte sur la sélection
  // affichée ; d'ici là, la dernière année de la sélection : la même dans
  // presque tous les cas, et les tableaux partent sans attendre les
  // indicateurs. En mode « Années » sans année cochée, la sélection est toute
  // la période.
  const anneesLecture = anneesTabs.length ? anneesTabs : annees;
  const selectionPosee = periode.choisieMin === anneeMinD && periode.choisieMax === anneeMaxD && anneesSpec === anneesSpecD;
  const refSure = selectionPosee && kpis != null && !qKpis.isPlaceholderData;
  const anneeRef: number | null = refSure ? kpis.annee_ref ?? null : null;
  const anneeDefaut = anneeRef != null && anneesLecture.includes(anneeRef) ? anneeRef
    : anneesLecture.length ? anneesLecture[anneesLecture.length - 1] : null;
  // Une année réglée qui sort de la sélection rend la main au défaut.
  const parDefaut = (c: Lecture | null) => c !== "cumul" && (c === null || !anneesLecture.includes(c));
  const lectureDe = (c: Lecture | null): Lecture | null => parDefaut(c) ? anneeDefaut : c;
  const lecturePoids = lectureDe(choixPoids);
  const lectureRepart = lectureDe(choixRepart);
  // Pendant un glissé du curseur, la requête attend qu'il se pose ; la
  // première lecture connue part sans attendre.
  const lecturePoidsD = useDebounced(lecturePoids, 250) ?? lecturePoids;
  const lectureRepartD = useDebounced(lectureRepart, 250) ?? lectureRepart;

  type TopsCom = { partenaires: { nom: string; valeur: number }[]; ressources: { ressource: string; valeur: number }[]; total: number };
  type RepartCom = { ressources: string[]; partenaires: PartenaireRessources[] };
  // Une requête par tableau, pour ce qu'il montre : son année, ou la période
  // entière pour le cumul. La recherche d'un partenaire et les épingles ne
  // concernent que la répartition.
  const urlTableau = (lecture: Lecture | null, repartition: boolean) => {
    if (!selId || lecture === null) return null;
    let p: URLSearchParams;
    if (lecture === "cumul") p = paramsPeriode(true);
    else {
      p = new URLSearchParams({ pays_id: String(selId), direction: vue, annees: String(lecture) });
      if (ressources.length && ressSel.length && ressSel.length < ressources.length) p.set("ressources", ressSel.join(","));
    }
    if (repartition) {
      if (rechPartD.trim()) p.set("recherche", rechPartD.trim());
      if (clefEpingles) p.set("epingles", clefEpingles);
    }
    return `${API}/statistiques/commerce/${repartition ? "repartition" : "tops"}?${p}`;
  };
  // `garder` : pendant une recherche, une épingle ou un autre filtre,
  // l'ancienne réponse reste en place. Une autre lecture (autre année,
  // cumul) repasse en revanche par le squelette — c'est le signal que le
  // millésime a changé (useReponseLue).
  const qPoids = useDonnees<TopsCom>(urlTableau(lecturePoidsD, false), { garder: true });
  const qRepart = useDonnees<RepartCom>(urlTableau(lectureRepartD, true), { garder: true });
  const poidsLu = useReponseLue(qPoids, lecturePoidsD);
  const repartLu = useReponseLue(qRepart, lectureRepartD);
  // Ce que montre un tableau : la réponse de SA lecture — undefined tant
  // qu'elle n'est pas arrivée (squelette), null si la requête a échoué.
  const poids = poidsLu && poidsLu.lecture === lecturePoids ? poidsLu.data : undefined;
  const repart = repartLu && repartLu.lecture === lectureRepart ? repartLu.data : undefined;
  // Les indicateurs n'ont pas encore parlé pour cette sélection : une année
  // par défaut vide attend leur année plutôt que d'afficher « Aucune
  // donnée » une fraction de seconde.
  const defautProvisoire = !refSure && !qKpis.isError;
  // Rien sur la sélection (les indicateurs n'ont pas d'année) : pas de tableaux.
  const selectionVide = refSure && anneeRef == null;

  const span = Math.max(1, bornes[1] - bornes[0]);
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
  const toggleCont = continents.basculer;
  const toggleRess = (code: string) => setRessChoisies(prev => {
    const cour = prev ?? toutesRess;
    return cour.includes(code) ? (cour.length > 1 ? cour.filter(c => c !== code) : cour) : [...cour, code];
  });

  const perLabel = modeAnnees === "specifiques" && anneesSpec.length > 0
    ? (anneesSpec.length === 1 ? `${anneesSpec[0]}` : `${anneesSpec[0]} — ${anneesSpec[anneesSpec.length - 1]}`)
    : `${anneeMin} — ${anneeMax}`;
  const paysChange = selId !== senId;
  const periodeChange = modeAnnees === "specifiques" ? anneesSpec.length > 0 : (anneeMin !== bornes[0] || anneeMax !== bornes[1]);
  const ressChange = ressources.length > 0 && ressSel.length !== ressources.length;
  const nbFiltres = (paysChange ? 1 : 0) + (periodeChange ? 1 : 0) + (ressChange ? 1 : 0);
  const reinit = () => {
    setSelId(null); setModeAnnees("plage"); periode.remettre();
    setAnneesSpec([]); setRessChoisies(null);
  };

  const LBL: any = { fontSize: 11, fontWeight: 700, color: "var(--gris)", textTransform: "uppercase", letterSpacing: "0.1em" };
  const TH: any = { padding: "11px 16px", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--gris-fort)", whiteSpace: "nowrap" };
  const TD: any = { padding: "10px 16px", verticalAlign: "middle" };
  const ressFiltrees = ressources.filter(r => !qRess || (r.libelle || r.nom_en).toLowerCase().includes(qRess.toLowerCase()));

  // L'attente a LA FORME DE LA PAGE : la colonne de filtres à gauche, puis
  // l'en-tête, quatre indicateurs et deux graphes l'un sous l'autre. Elle
  // montrait cinq cartes et deux graphes côte à côte, sans colonne — tout se
  // redisposait à l'arrivée des données.
  if (loading) return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <aside style={{ width: sidebarWidth, flexShrink: 0, background: "var(--carte)", borderRight: "1px solid var(--bordure-forte)", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <EnteteFiltres nbFiltres={0} aDesFiltres={false} onReinit={() => {}} />
        <div style={{ padding: 16 }}>
          <Skeleton h={36} r={8} style={{ marginBottom: 18 }} />
          <SkeletonRows n={7} h={26} />
        </div>
      </aside>
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "32px 40px 80px" }}>
        <Skeleton w={320} h={34} r={8} style={{ marginBottom: 18 }} />
        <div style={{ marginBottom: 20 }}><SkeletonKPIs n={4} height={HAUTEUR_KPI} /></div>
        <SkeletonChartGrid n={2} cols={1} height={HAUTEUR_GRAPHE} />
      </div>
    </div>
  );
  // Les retours anticipés sont des enfants directs de la colonne de hauteur
  // fixe : sans conteneur défilant, un contenu un peu haut déborderait au lieu
  // de défiler.
  if (erreur) return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" }}>
      <ErreurChargement onRetry={() => qFiltres.refetch()} />
    </div>
  );
  if (!annees.length) return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", textAlign: "center", padding: "80px 24px", color: "var(--gris)" }}>
      <p style={{ fontSize: 16, fontWeight: 600, color: "var(--texte)" }}>Aucune donnée commerciale</p>
      <p style={{ fontSize: 14, marginTop: 6 }}>Les flux bilatéraux seront disponibles après import dans l&apos;administration.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* ── Barre de filtre ── */}
      <aside style={{ width: sidebarWidth, flexShrink: 0, background: "var(--carte)", borderRight: "1px solid var(--bordure-forte)", height: "100%", overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column" }}>
        <div onMouseDown={startResize} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10, background: "transparent" }} onMouseEnter={e => { e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.5)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} />
        <EnteteFiltres nbFiltres={nbFiltres} aDesFiltres={nbFiltres > 0} onReinit={reinit} />
        <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
          {/* Recherche pays */}
          <div style={{ position: "relative", marginBottom: 18 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--gris)" }} />
            <input value={searchPays} onChange={e => setSearchPays(e.target.value)} placeholder="Rechercher un pays…"
              className="ds-champ" style={{ height: 36, paddingLeft: 30, paddingRight: 8, fontSize: 12 }} />
            {searchPays && <button onClick={() => setSearchPays("")} aria-label="Effacer la recherche" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} style={{ color: "var(--gris)" }} /></button>}
          </div>
          <div style={{ height: 1, background: "var(--filet)", marginBottom: 18 }} />
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
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--gris)", fontWeight: 600, background: "var(--carte-douce)", padding: "1px 5px", borderRadius: 4 }}>Réf.</span>
                  </button>
                </div>
              );
            })()}
            <div style={{ height: 1, background: "var(--filet)", marginBottom: 8 }} />
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {/* « Autre » ne figure pas dans le filtre : ce sont des agrégats,
                  pas des pays de référence. Ils restent dans les données —
                  « Bunkers » tient sa place dans les tableaux de destinations. */}
              {sortContinents(Object.keys(groupedPays), true).map(continent => {
                const isOpen = continents.estOuvert(continent);
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
          <div style={{ height: 1, background: "var(--filet)", marginBottom: 18 }} />
          {/* Période */}
          <div style={{ marginBottom: 18 }}>
            <EntetePeriode marginBottom={12} resume={resumePeriode(anneeMin, anneeMax, modeAnnees === "specifiques" ? anneesSpec : undefined)} />
            <div className="ds-segments" style={{ display: "flex", gap: 3, padding: 3, marginBottom: 12 }}>
              {[{ v: "plage", l: "Plage" }, { v: "specifiques", l: "Années" }].map(m => (
                <button key={m.v} onClick={() => setModeAnnees(m.v as "plage" | "specifiques")} aria-pressed={modeAnnees === m.v}
                  className="ds-segment" style={{ flex: 1, padding: "7px 0" }}>
                  {m.l}
                </button>
              ))}
            </div>
            {modeAnnees === "plage" ? (
              <CurseurPlageNace min={bornes[0]} max={bornes[1]} debut={anneeMin} fin={anneeMax} ecartMin={0}
                onChange={(d, f) => periode.regler(d, f)} />
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3, marginBottom: 8 }}>
                  {Array.from({ length: span + 1 }, (_, i) => bornes[0] + i).map(a => {
                    const sel = anneesSpec.includes(a);
                    return (
                      <button key={a} onClick={() => setAnneesSpec(prev => sel ? prev.filter(x => x !== a) : [...prev, a].sort())}
                        style={{ padding: "5px 0", borderRadius: 7, border: `1px solid ${sel ? "var(--bleu)" : "var(--bordure-forte)"}`, cursor: "pointer", fontSize: 10, fontWeight: sel ? 700 : 400, textAlign: "center", background: sel ? "var(--bleu-action)" : "var(--carte-douce)", color: sel ? "var(--sur-bleu)" : "var(--texte)", transition: "all 0.1s" }}>
                        {a}
                      </button>
                    );
                  })}
                </div>
                {anneesSpec.length > 0 && <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={() => setAnneesSpec([])} style={{ fontSize: 11, color: "var(--gris)", background: "none", border: "none", cursor: "pointer" }}>Effacer</button></div>}
              </div>
            )}
          </div>
        </div>
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
          <div className="ds-segments" style={{ padding: 3, gap: 3, flexShrink: 0, background: "var(--fond-creux)", borderColor: "var(--bordure)" }}>
            {VUES_COM.map(o => {
              const actif = vue === o.v;
              return (
                <button key={o.v} onClick={() => setVue(o.v)} aria-pressed={actif} className="ds-segment"
                  style={{ padding: "5px 14px", color: actif ? (o.v === "exportateur" ? NACE_BLEU : NACE_ORANGE) : undefined }}>
                  {o.v === "exportateur" ? "Exportations" : "Importations"}
                </button>
              );
            })}
          </div>
          <BadgePeriode>{perLabel}</BadgePeriode>
          <button onClick={() => setShowTable(true)} className="ds-bouton ds-bouton--secondaire" style={{ marginLeft: "auto", gap: 7, padding: "0 16px", flexShrink: 0 }}>
            <Table size={14} color={accent.trait} /> Tableau de données
          </button>
        </div>

        {/* KPI cards — valeurs de la dernière année sélectionnée (sauf « Année record ») */}
        {(() => {
          const expDir = vue === "exportateur";
          const ref = kpis?.annee_ref;
          // Le millésime est porté par une PASTILLE, comme sur toutes les cartes
          // KPI de la plateforme — il sortait ici du libellé (« 1er client ·
          // 2023 ») et là d'un sous-titre, deux écritures pour la même chose.
          const cards = [
            { label: expDir ? "Total exportations" : "Total importations", annee: ref, sub: "", value: fmtUSD(kpis?.total ?? null), indicatif: "", text: false },
            { label: expDir ? "1er client" : "1er fournisseur", annee: ref, sub: "", value: kpis?.top_partenaire?.nom || "—", indicatif: kpis?.top_partenaire ? fmtUSD(kpis.top_partenaire.valeur) : "", text: true },
            { label: "1re ressource", annee: ref, sub: "", value: kpis?.top_ressource?.ressource || "—", indicatif: kpis?.top_ressource ? fmtUSD(kpis.top_ressource.valeur) : "", text: true },
            { label: expDir ? "Part du 1er client" : "Part du 1er fournisseur", annee: ref, sub: "Concentration", value: kpis?.part_top_partenaire != null ? `${kpis.part_top_partenaire.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—", indicatif: kpis?.top_partenaire?.nom ? `${expDir ? "vers" : "depuis"} ${kpis.top_partenaire.nom}` : "", text: false },
          ];
          // Avant la première réponse, les quatre places sont tenues : des
          // cartes à « — » auraient dit qu'il n'y a rien, alors que ça arrive.
          if (!kpis && qKpis.isPending) return <div style={{ marginBottom: 20 }}><SkeletonKPIs n={4} height={HAUTEUR_KPI} /></div>;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20, opacity: chargKpis ? 0.5 : 1, transition: "opacity 0.15s" }}>
              {cards.map((c, i) => (
                <div key={i} style={{ background: "var(--carte)", borderRadius: 8, padding: "13px 14px", border: "1px solid rgb(var(--encre-rgb) / 0.12)", boxShadow: "none", transition: "border-color 0.18s", minWidth: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent.piste; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgb(var(--encre-rgb) / 0.12)"; }}>
                  <div style={{ marginBottom: 7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", color: accent.trait, textTransform: "uppercase", lineHeight: 1.4 }}>{c.label}</p>
                      {c.annee != null && <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--gris)", background: "var(--bleu-voile)", padding: "1px 7px", borderRadius: 4, lineHeight: 1.5, flexShrink: 0 }}>{c.annee}</span>}
                    </div>
                    {c.sub && <p style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.06em", color: "var(--gris)", textTransform: "uppercase", marginTop: 2, lineHeight: 1.3 }}>{c.sub}</p>}
                  </div>
                  <p title={c.text ? c.value : undefined} style={{ fontSize: c.text ? "0.95rem" : "1.15rem", fontWeight: 800, color: "var(--encre)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: c.text ? "normal" : "nowrap", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{c.value}</p>
                  {c.indicatif && <p style={{ fontSize: 10, color: "var(--gris)", marginTop: 5, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.indicatif}</p>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Graphes — leur place est tenue pendant la première réponse */}
        {qBalance.isPending && <div style={{ marginBottom: 20 }}><SkeletonChartGrid n={2} cols={1} height={HAUTEUR_GRAPHE} /></div>}
        {balance.length > 0 && (() => {
          const expDir = vue === "exportateur";
          const balSerie = [{ nom: "Balance commerciale", couleur: accent.trait, data: balance.map(b => ({ annee: b.annee, valeur: b.balance })) }];
          const fluxSerie = [{ nom: expDir ? "Exportations" : "Importations", couleur: accent.trait, data: balance.map(b => ({ annee: b.annee, valeur: expDir ? b.exportations : b.importations })) }];
          return (
            // Un graphe par ligne, pleine largeur, sur place — comme dans
            // Investissements privés : pas de vignette à agrandir d'un clic.
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14, marginBottom: 20 }}>
              {/* 1. Évolution du total exporté / importé */}
              <GrapheCard titre={expDir ? "Évolution des exportations" : "Évolution des importations"} series={fluxSerie} grapheId={`stat_flux_${vue}_${selId}`} hideLegend hideSousTitre
                statique tag={plageAnnees(fluxSerie)} unite="USD">
                <GrapheMultiPays series={fluxSerie} height={240} type="line" fmt={(v: number | null) => fmtUSD(v)} />
              </GrapheCard>
              {/* Balance commerciale (partagée) */}
              <GrapheCard titre="Balance commerciale" series={balSerie} grapheId={`stat_balance_${selId}`} hideLegend hideSousTitre
                statique tag={plageAnnees(balSerie)} unite="USD">
                <GrapheMultiPays series={balSerie} height={240} type="line" fmt={(v: number | null) => fmtUSD(v)} />
              </GrapheCard>
            </div>
          );
        })()}

        {/* 4 & 5. Poids des ressources & répartition — la dernière année ;
            une autre année, ou le cumul, au curseur */}
        {(() => {
          const expDir = vue === "exportateur";
          if (selectionVide) return null;
          // Avant la première réponse, les deux tableaux tiennent leur place.
          if (poidsLu === null && repartLu === null) return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              {[9, 10].map(n => (
                <div key={n} style={{ background: "var(--carte)", borderRadius: 8, border: "1px solid var(--bordure)", padding: "16px 18px" }}>
                  <Skeleton w={280} h={14} r={4} style={{ marginBottom: 16 }} />
                  <SkeletonRows n={n} h={26} />
                </div>
              ))}
            </div>
          );
          // Poids des ressources : top 8 + « Autres »
          let donutData: { label: string; valeur: number }[] = [];
          if (poids && poids.ressources.length) {
            const top8 = poids.ressources.slice(0, 8);
            donutData = top8.map(r => ({ label: r.ressource, valeur: r.valeur }));
            const autres = (poids.total || 0) - top8.reduce((s, r) => s + r.valeur, 0);
            if (autres > 0.0001 && poids.ressources.length > 8) donutData.push({ label: "Autres", valeur: autres });
          }
          const parts = repart?.partenaires || [];
          const resLabels = repart?.ressources || [];
          // Squelette : la réponse de la lecture n'est pas arrivée, ou une
          // année par défaut encore provisoire est vide.
          const attentePoids = poids === undefined
            || (donutData.length === 0 && parDefaut(choixPoids) && defautProvisoire);
          const attenteRepart = repart === undefined
            || (parts.length === 0 && !rechPart.trim() && parDefaut(choixRepart) && defautProvisoire);
          const carte: React.CSSProperties = { background: "var(--carte)", borderRadius: 8, border: "1px solid rgb(var(--encre-rgb) / 0.12)", padding: "16px 18px", minWidth: 0 };
          const titreStyle: React.CSSProperties = { fontWeight: 700, fontSize: 13.5, color: "var(--encre)", margin: 0 };
          const enTete: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" };
          const Vide = ({ lecture }: { lecture: Lecture | null }) => (
            <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center", padding: "22px 0" }}>
              {lecture === "cumul" ? "Aucune donnée sur la période." : `Aucune donnée pour ${lecture}.`}
            </p>
          );
          // Une année creuse affiche un état vide, et la carte de répartition
          // reste montée pendant une recherche infructueuse : sinon le champ
          // disparaîtrait avec elle, et l'on ne pourrait plus corriger sa saisie.
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <div style={carte}>
                <div style={enTete}>
                  <h3 style={titreStyle}>{expDir ? "Poids des ressources exportées" : "Poids des ressources importées"}</h3>
                  <BarreCumulAnnee annees={anneesLecture} lecture={lecturePoids} onLecture={setChoixPoids} accent={accent} />
                </div>
                {attentePoids
                  ? <SkeletonRows n={Math.max(3, donutData.length || 6)} h={26} />
                  : donutData.length > 0
                  ? <TableauPoidsRessources data={donutData} total={poids?.total || 0} accent={accent} />
                  : <Vide lecture={lecturePoids} />}
              </div>
              <div style={carte}>
                <div style={enTete}>
                  <h3 style={titreStyle}>{expDir ? "Exportations par destination et ressource" : "Importations par origine et ressource"}</h3>
                  <ChampRecherchePartenaire valeur={rechPart} onChange={setRechPart} />
                  <BarreCumulAnnee annees={anneesLecture} lecture={lectureRepart} onLecture={setChoixRepart} accent={accent} />
                </div>
                {attenteRepart ? (
                  <SkeletonRows n={Math.max(3, parts.length || 6)} h={30} />
                ) : (
                  <>
                    {/* Une recherche sans résultat se dit même lorsque le
                        tableau n'est pas vide : les lignes qui restent sont
                        les épinglées, pas des correspondances. */}
                    {rechPart.trim() && parts.every(p => partEpingles.includes(p.nom)) && (
                      <p style={{ fontSize: 12, color: "var(--gris)", textAlign: "center", padding: parts.length ? "4px 0 12px" : "22px 0" }}>
                        Aucun pays ne correspond à « {rechPart.trim()} »{lectureRepart === "cumul" ? " sur la période" : ` en ${lectureRepart}`}.
                      </p>
                    )}
                    {parts.length > 0
                      ? <TableauPartenairesRessources partenaires={parts} ressources={resLabels} accent={accent}
                          epingles={partEpingles} onPin={togglePin} />
                      : !rechPart.trim() && <Vide lecture={lectureRepart} />}
                  </>
                )}
              </div>
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

// ── Recherche d'un partenaire dans le tableau des flux ────────────────────────
// Le tableau montre les dix premiers partenaires. Au-delà, il fallait ouvrir le
// tableau de données complet pour savoir ce que le Sénégal exporte vers la
// Belgique. Le champ interroge le classement entier et ramène les lignes
// correspondantes, rang réel compris — c'est le serveur qui cherche, la page
// n'a jamais que dix lignes en mémoire.
function ChampRecherchePartenaire({ valeur, onChange }: {
  valeur: string; onChange: (v: string) => void;
}) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      <Search size={12} style={{ position: "absolute", left: 9, color: "var(--gris)", pointerEvents: "none" }} />
      <input value={valeur} onChange={e => onChange(e.target.value)}
        placeholder="Rechercher un pays" aria-label="Rechercher un pays"
        className="ds-champ" style={{ width: 196, height: 34, padding: "0 24px 0 27px", fontSize: 11.5 }} />
      {valeur && (
        <button onClick={() => onChange("")} aria-label="Effacer la recherche"
          style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          <X size={11} style={{ color: "var(--gris)" }} />
        </button>
      )}
    </span>
  );
}

// ── Curseur des tableaux de flux : une année, ou le cumul ─────────────────────
// Même curseur que le commerce extérieur — bornes, poignée, pastille — pour
// qu'un seul geste se lise de la même façon d'un onglet à l'autre. La graduation
// diffère : les années croissantes, puis un cran de plus tout à droite pour le
// cumul de la période. La lecture par défaut est la dernière année.
function BarreCumulAnnee({ annees, lecture, onLecture, accent }: {
  annees: number[]; lecture: Lecture | null; onLecture: (l: Lecture) => void; accent: AccentNace;
}) {
  if (annees.length < 2 || lecture === null) return null;
  const n = annees.length;                       // position n = Cumul
  const i = lecture === "cumul" ? n : Math.max(0, annees.indexOf(lecture));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11, marginLeft: "auto", flexShrink: 0, ...varsAccent(accent) }}>
      <StylesCurseurNace />
      <span style={{ fontSize: 10, color: "var(--gris)", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{annees[0]}</span>
      <input type="range" min={0} max={n} step={1} value={i}
        onChange={e => { const k = Number(e.target.value); onLecture(k >= n ? "cumul" : annees[k]); }}
        aria-label="Année ou cumul" className="nace-curseur" style={{ width: 150 }} />
      <span style={pastilleCurseur(accent)}>{lecture === "cumul" ? "Cumul" : lecture}</span>
    </span>
  );
}

/** La dernière réponse arrivée pour un tableau, avec la lecture qu'elle sert.
 *  La requête garde l'ancienne réponse pendant qu'une autre charge (`garder`) :
 *  ce relevé dit À QUELLE LECTURE elle correspond, pour qu'un changement
 *  d'année repasse par le squelette au lieu de montrer un moment les chiffres
 *  d'une autre année. `data: null` : la requête a échoué. */
function useReponseLue<T>(q: { data: T | undefined; isPlaceholderData: boolean; isError: boolean },
  lecture: Lecture | null) {
  const [lue, setLue] = useState<{ lecture: Lecture; data: T | null } | null>(null);
  if (lecture !== null && !q.isPlaceholderData && (q.data !== undefined || q.isError)) {
    const data = q.isError ? null : (q.data as T);
    if (!lue || lue.lecture !== lecture || lue.data !== data) setLue({ lecture, data });
  }
  return lue;
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
            <div style={{ width: "34%", height: 8, background: "var(--carte-douce)", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
              <div style={{ height: "100%", width: `${Math.max(1.5, d.valeur / max * 100)}%`, borderRadius: 99, background: autres ? "var(--fond-creux2)" : accent.trait, opacity: autres ? 0.6 : 0.8 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tableau des flux par partenaire et ressource (Flux bilatéraux) ────────────
// Matrice pays × ressources : rang (top 3 en bleu), drapeau, lignes zébrées,
// plus grande valeur de chaque pays en vert, colonne Total en bleu.
//
// Les partenaires épinglés remontent en tête, séparés du reste par un filet —
// même geste que le tableau des années de la page IDE. Épingler sert à garder
// sous les yeux un pays cherché hors du top pendant qu'on fait varier la
// période ou qu'on cherche le suivant ; les valeurs restent celles du serveur,
// rien n'est figé côté page.
function TableauPartenairesRessources({ partenaires, ressources, accent, epingles, onPin }: {
  partenaires: PartenaireRessources[]; ressources: string[]; accent: AccentNace;
  epingles: string[]; onPin: (nom: string) => void;
}) {
  const pins = partenaires.filter(p => epingles.includes(p.nom));
  const libres = partenaires.filter(p => !epingles.includes(p.nom));
  const lignes = [...pins, ...libres];
  return (
    <div style={{ overflowX: "auto" }}>
      <style>{`.ligne-part .pin-fantome{opacity:0;transition:opacity .12s}
.ligne-part:hover .pin-fantome{opacity:1}
.ligne-part .pin-fantome:focus-visible{opacity:1}`}</style>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1px solid var(--bordure)", width: 22 }}><span className="sr-only">Épinglé</span></th>
            <th style={{ textAlign: "left", padding: "8px 6px 8px 4px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase", borderBottom: "1px solid var(--bordure)", width: 34 }}>#</th>
            <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gris)", textTransform: "uppercase", borderBottom: "1px solid var(--bordure)" }}>Pays</th>
            {ressources.map(r => (
              <th key={r} style={{ textAlign: "right", padding: "8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", color: "var(--gris)", textTransform: "uppercase", borderBottom: "1px solid var(--bordure)", whiteSpace: "nowrap" }}>{r}</th>
            ))}
            <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: accent.trait, textTransform: "uppercase", borderBottom: "1px solid var(--bordure)" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((p, i) => {
            // Ressource dominante du partenaire : sa valeur ressort en vert
            const vMax = Math.max(0, ...p.valeurs.map(v => v ?? 0));
            const epingle = epingles.includes(p.nom);
            const zebre = i % 2 === 1;
            const fond = epingle ? accent.voile : zebre ? "var(--carte-douce)" : "transparent";
            // Le rang vient du serveur : lors d'une recherche, la 37e destination
            // reste la 37e, elle ne devient pas la 1re parce qu'elle est seule.
            const rang = p.rang ?? i + 1;
            const podium = rang <= 3;
            // Le filet qui sépare les épinglés du reste du classement.
            const bordure = i === pins.length - 1 && libres.length > 0
              ? "2px solid var(--bordure-forte)" : "1px solid var(--bordure)";
            return (
            <tr key={p.nom} className="ligne-part" style={{ background: fond, transition: "background 0.12s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = accent.voile; }}
              onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = fond; }}>
              <td style={{ padding: "7px 0 7px 8px", borderBottom: bordure }}>
                <button className={epingle ? undefined : "pin-fantome"} onClick={() => onPin(p.nom)}
                  aria-label={epingle ? `Désépingler ${p.nom}` : `Épingler ${p.nom}`}
                  title={epingle ? "Désépingler" : "Épingler ce pays en tête du tableau"}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: epingle ? accent.trait : "var(--gris)" }}>
                  <Pin size={11} fill={epingle ? accent.trait : "none"} />
                </button>
              </td>
              <td style={{ padding: "7px 6px 7px 4px", borderBottom: bordure }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%",
                  background: podium ? accent.trait : "var(--sur-bleu)", color: podium ? "var(--sur-bleu)" : "var(--gris)", fontSize: rang > 99 ? 9 : 10.5, fontWeight: 800 }}>{rang}</span>
              </td>
              <td style={{ padding: "7px 10px", borderBottom: bordure }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  <DrapeauPays iso={p.code_iso2} nom={p.nom} />
                  <span style={{ fontSize: 12.5, fontWeight: epingle ? 800 : 700, color: "var(--encre)", whiteSpace: "nowrap" }}>{p.nom}</span>
                </span>
              </td>
              {ressources.map((r, ri) => {
                const v = p.valeurs[ri] ?? 0;
                const dominante = v > 0 && v === vMax;
                return <td key={r} style={{ padding: "7px 10px", fontSize: 11.5, fontWeight: dominante ? 800 : v > 0 ? 600 : 400, color: dominante ? "var(--vert)" : v > 0 ? "var(--encre)" : "var(--gris)", textAlign: "right", whiteSpace: "nowrap", borderBottom: bordure, fontVariantNumeric: "tabular-nums" }}>{v > 0 ? fmtUSD(v) : "—"}</td>;
              })}
              <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 800, color: accent.trait, textAlign: "right", whiteSpace: "nowrap", borderBottom: bordure, fontVariantNumeric: "tabular-nums" }}>{fmtUSD(p.total)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CommercePanel;
