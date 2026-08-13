"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Globe2, Link2, Loader2, Trash2, UploadCloud } from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";
import { confirmer } from "@/components/shared/Confirmation";
import BarreTitre from "@/components/shared/BarreTitre";
import { SkeletonRows } from "@/components/shared/Skeleton";
import {
  Avis, Carte, Case, ChampRecherche, Compteur, FileZone, Ligne, LigneVide, Segments, Tableau,
  IS, NUM, TD, TH, btnDanger, btnPrincipal, btnSecondaire,
} from "@/components/admin/UIAdmin";

import { API_BASE as API } from "@/lib/api";

type RefPays     = { id: number; nom_fr: string; code_iso2: string | null };
type StatPays    = { ref_pays_id: number; pays: string; code_iso2: string | null; series: Record<string, { annee_min: number; annee_max: number; nb: number }> };
type ImportResult= { pays: string; ref_pays_id: number; insere: number; mis_a_jour: number };
type NonResolu   = { label: string; nb_lignes: number };
type ProdRes     = { success: boolean; nb_lignes?: number; nb_pays?: number; non_resolus?: number; detail?: string };
type ImportRes   = { pays: ImportResult[]; erreurs: string[]; non_resolus: NonResolu[]; prod?: ProdRes | null };
type MergedPays  = StatPays & { hasData: boolean };

const SERIES_LABELS: Record<string, string> = {
  entrant_flux: "Flux entrants", sortant_flux: "Flux sortants",
  entrant_stock: "Stock entrants", sortant_stock: "Stock sortants",
};

function Drapeau({ code }: { code: string | null }) {
  if (!code) return <span style={{ fontSize: 16 }}>🌐</span>;
  const emoji = code.toUpperCase().split("").map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
  return <span style={{ fontSize: 16 }}>{emoji}</span>;
}

// ── Sélecteur de pays du référentiel (association manuelle) ───────────────────
function AssociatePicker({ paysList, onSelect }: { paysList: RefPays[]; onSelect: (id: number, nom: string) => void }) {
  const [search, setSearch] = useState("");
  const [open,   setOpen]   = useState(false);
  const [chosen, setChosen] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const filtered = paysList.filter(p => p.nom_fr.toLowerCase().includes(search.toLowerCase())).slice(0, 30);
  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input value={chosen || search} onChange={e => { setSearch(e.target.value); setChosen(""); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Rechercher un pays du référentiel…" style={{ ...IS, borderColor: chosen ? "var(--bleu)" : "var(--bordure-forte)" }} />
      {open && filtered.length > 0 && !chosen && (
        <div style={{ position: "absolute", zIndex: 200, top: "100%", left: 0, right: 0, background: "var(--carte)", border: "1px solid var(--bordure-forte)", borderRadius: 12, boxShadow: "var(--ombre-2)", maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => { setChosen(p.nom_fr); setSearch(""); setOpen(false); onSelect(p.id, p.nom_fr); }}
              style={{ padding: "8px 13px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--filet)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgb(var(--bleu-rgb) / 0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <Drapeau code={p.code_iso2} />{p.nom_fr}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminIdePage() {
  const [stats,    setStats]    = useState<StatPays[]>([]);
  const [paysList, setPaysList] = useState<RefPays[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [fluxEntrant,  setFluxEntrant]  = useState<File[]>([]);
  const [fluxSortant,  setFluxSortant]  = useState<File[]>([]);
  const [stockEntrant, setStockEntrant] = useState<File[]>([]);
  const [stockSortant, setStockSortant] = useState<File[]>([]);
  // Mode d'extraction : "annex" = Annex tables WIR (format officiel), "series" = ancien format séries
  const [formatImport, setFormatImport] = useState<"annex" | "series">("annex");
  // Catégorie de données : détermine l'interprétation des 4 zones de dépôt
  const [categorie, setCategorie] = useState<"fluxstock" | "greenfield" | "fusion">("fluxstock");
  // Découpage : par pays (Annex 01-08, 13-17) ou par secteur/branche (09-12, 15, 18)
  const [decoupage, setDecoupage] = useState<"pays" | "secteur">("pays");
  // Relais vers la production (visible seulement si PROD_SYNC_* est configuré côté backend)
  const [prodDispo, setProdDispo] = useState(false);
  const [prodSync,  setProdSync]  = useState(true);

  const [importing,    setImporting]    = useState(false);
  const [importRes,    setImportRes]    = useState<ImportRes | null>(null);
  const [associations, setAssociations] = useState<Record<string, { id: number; nom: string }>>({});
  const [associating,  setAssociating]  = useState(false);

  // Tableau : recherche, filtre d'affichage et sélection multiple
  const [q, setQ] = useState("");
  const [vue, setVue] = useState<"importes" | "tous">("importes");
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [suppression, setSuppression] = useState<{ total: number; faits: number } | null>(null);

  async function loadData() {
    const [st, pr, sp] = await Promise.all([
      fetch(`${API}/ide/cnuced/stats`).then(r => r.json()),
      fetch(`${API}/ide/pays-ref`).then(r => r.json()),
      fetch(`${API}/ide/sync-prod/config`).then(r => r.json()).catch(() => ({ configured: false })),
    ]);
    setStats(Array.isArray(st) ? st : []);
    setPaysList(Array.isArray(pr) ? pr : []);
    setProdDispo(sp?.configured ?? false);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  // Tous les pays du référentiel : ceux qui ont des données d'abord, puis les autres
  const mergedPays: MergedPays[] = useMemo(() => {
    const withData: MergedPays[] = stats.map(s => ({ ...s, hasData: true }));
    const importedIds = new Set(stats.map(s => s.ref_pays_id));
    const withoutData: MergedPays[] = paysList
      .filter(p => !importedIds.has(p.id))
      .map(p => ({ ref_pays_id: p.id, pays: p.nom_fr, code_iso2: p.code_iso2, series: {}, hasData: false }));
    return [...withData, ...withoutData];
  }, [stats, paysList]);

  const nbImportes = stats.length;
  const nbTotal    = paysList.length;

  const paysAffiches = useMemo(() => mergedPays
    .filter(p => vue === "tous" || p.hasData)
    .filter(p => !q || p.pays.toLowerCase().includes(q.toLowerCase())),
    [mergedPays, vue, q]);

  // Sélection : uniquement les pays qui ont des données (les autres n'ont rien à supprimer)
  const selectionnables = paysAffiches.filter(p => p.hasData).map(p => p.ref_pays_id);
  const nbSelec = selection.size;
  const toutSelectionne = selectionnables.length > 0 && selectionnables.every(id => selection.has(id));
  const partiellement = nbSelec > 0 && !toutSelectionne;
  const basculer = (id: number) => setSelection(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const basculerTout = () => setSelection(s => {
    if (selectionnables.every(id => s.has(id))) { const n = new Set(s); selectionnables.forEach(id => n.delete(id)); return n; }
    return new Set([...s, ...selectionnables]);
  });

  const hasFiles = fluxEntrant.length || fluxSortant.length || stockEntrant.length || stockSortant.length;
  const nonResolus: NonResolu[] = importRes?.non_resolus ?? [];

  function buildFormData() {
    const fd = new FormData();
    fd.append("format_import", formatImport);
    fd.append("categorie", categorie);
    if (prodDispo && prodSync) fd.append("dupliquer_prod", "1");
    // En sectoriel greenfield, seules 2 zones existent (valeur / nombre) :
    // on ignore d'éventuels fichiers restés dans les zones masquées.
    const sansSortants = decoupage === "secteur" && categorie === "greenfield";
    fluxEntrant.forEach(f  => fd.append("flux_entrant",  f));
    if (!sansSortants) fluxSortant.forEach(f => fd.append("flux_sortant", f));
    stockEntrant.forEach(f => fd.append("stock_entrant", f));
    if (!sansSortants) stockSortant.forEach(f => fd.append("stock_sortant", f));
    return fd;
  }

  async function handleImport() {
    if (!hasFiles) return;
    setImporting(true); setImportRes(null); setAssociations({});
    try {
      const url = decoupage === "secteur" ? `${API}/ide/importer-secteurs` : `${API}/ide/importer`;
      const res  = await fetch(url, { method: "POST", headers: await authHeaders(), body: buildFormData() });
      const data = await res.json();
      if (res.ok) {
        setImportRes(data);
        if (!data.non_resolus?.length) { setFluxEntrant([]); setFluxSortant([]); setStockEntrant([]); setStockSortant([]); }
        await loadData();
      } else {
        setImportRes({ pays: [], erreurs: [data.detail || "Erreur inconnue"], non_resolus: [] });
      }
    } catch (e: any) { setImportRes({ pays: [], erreurs: ["Erreur réseau : " + e.message], non_resolus: [] }); }
    setImporting(false);
  }

  async function handleAssocierEtReimporter() {
    const toAssociate = Object.entries(associations).filter(([, v]) => v.id);
    if (!toAssociate.length) return;
    setAssociating(true);
    for (const [label, { id }] of toAssociate) {
      await fetch(`${API}/ide/associer-pays`, { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ label_cnuced: label, ref_pays_id: id }) });
    }
    setAssociating(false);
    await handleImport();
  }

  // Entité non-pays (Multi-National, agrégat…) : crée une entrée ref_pays
  // minimale rattachée au groupe « Autre », puis la marque comme associée.
  async function handleDeplacerVersAutre(label: string) {
    try {
      const res = await fetch(`${API}/ide/creer-pays-autre`, { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ label }) });
      const d = await res.json();
      if (res.ok && d?.id) setAssociations(prev => ({ ...prev, [label]: { id: d.id, nom: `${d.nom_fr} (Autre)` } }));
    } catch { /* le bouton reste actif, l'admin peut réessayer */ }
  }

  // Suppression d'un ou plusieurs pays : une seule confirmation, progression affichée
  async function supprimerPays(ids: number[], libelle: string) {
    if (!ids.length) return;
    if (!(await confirmer(`Supprimer toutes les données IDE ${libelle} ?\n\nCette action est irréversible.`))) return;
    setSuppression({ total: ids.length, faits: 0 });
    const en_tete = await authHeaders();
    for (const [i, id] of ids.entries()) {
      try { await fetch(`${API}/ide/cnuced/pays/${id}`, { method: "DELETE", headers: en_tete }); } catch {}
      setSuppression({ total: ids.length, faits: i + 1 });
    }
    setSelection(new Set());
    await loadData();
    setSuppression(null);
  }

  const enSuppression = suppression !== null;

  // Zones de dépôt selon le découpage et la catégorie
  const zones = decoupage === "secteur"
    ? (categorie === "fusion"
      ? [
        { l: "Valeur — ventes", h: "Annex 09 · net sales by sector", f: fluxEntrant, s: setFluxEntrant },
        { l: "Valeur — achats", h: "Annex 10 · net purchases by sector", f: fluxSortant, s: setFluxSortant },
        { l: "Nombre — ventes", h: "Annex 11 · number by sector", f: stockEntrant, s: setStockEntrant },
        { l: "Nombre — achats", h: "Annex 12 · number by sector", f: stockSortant, s: setStockSortant },
      ] : [
        { l: "Valeur des projets annoncés", h: "Annex 15 · value by sector", f: fluxEntrant, s: setFluxEntrant },
        { l: "Nombre de projets annoncés", h: "Annex 18 · number by sector", f: stockEntrant, s: setStockEntrant },
      ])
    : categorie === "fluxstock"
      ? [
        { l: "Flux entrants", h: "1 ou N pays par fichier", f: fluxEntrant, s: setFluxEntrant },
        { l: "Flux sortants", h: "1 ou N pays par fichier", f: fluxSortant, s: setFluxSortant },
        { l: "Stock entrants", h: "1 ou N pays par fichier", f: stockEntrant, s: setStockEntrant },
        { l: "Stock sortants", h: "1 ou N pays par fichier", f: stockSortant, s: setStockSortant },
      ]
      : categorie === "greenfield"
        ? [
          { l: "Valeur — destination (entrants)", h: "Annex 14 · value by destination", f: fluxEntrant, s: setFluxEntrant },
          { l: "Valeur — source (sortants)", h: "Annex 13 · value by source", f: fluxSortant, s: setFluxSortant },
          { l: "Nombre — destination (entrants)", h: "Annex 17 · number by destination", f: stockEntrant, s: setStockEntrant },
          { l: "Nombre — source (sortants)", h: "Annex 16 · number by source", f: stockSortant, s: setStockSortant },
        ] : [
          { l: "Valeur — ventes (entrants)", h: "Annex 05 · net sales by seller", f: fluxEntrant, s: setFluxEntrant },
          { l: "Valeur — achats (sortants)", h: "Annex 06 · net purchases by purchaser", f: fluxSortant, s: setFluxSortant },
          { l: "Nombre — ventes (entrants)", h: "Annex 07 · number by seller", f: stockEntrant, s: setStockEntrant },
          { l: "Nombre — achats (sortants)", h: "Annex 08 · number by purchaser", f: stockSortant, s: setStockSortant },
        ];

  const aide = decoupage === "secteur"
    ? <>Annex tables sectorielles du World Investment Report (Excel/CSV) : en-tête <strong>Sector/industry | 1990 | … | 2025</strong>, une ligne par secteur ou branche, années en colonnes. Les libellés sont résolus sur le référentiel CNUCED ; la ligne <strong>Total</strong> est ignorée automatiquement.</>
    : formatImport === "annex"
    ? <>Annex tables du World Investment Report (Excel/CSV) : en-tête <strong>Region/economy | 1990 | … | 2025</strong>, une ligne par pays, années en colonnes. Les agrégats régionaux (World, Europe…) et les notes sont ignorés automatiquement.</>
    : <>Un ou plusieurs fichiers CSV par série. Le pays est détecté depuis <strong>Economy_Label</strong> (format <strong>Economy_Label | Year | Value</strong>, 1 ligne par année). Un fichier peut contenir plusieurs pays.</>;

  return (
    <div style={{ fontFamily: "var(--font-google-sans)" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(255,255,255,0.55)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}`}</style>

      {/* ── Bandeau orange (espace d'administration) ── */}
      <BarreTitre titre="Données IDE" compact ton="orange" pleineLargeur />

      <div style={{ padding: "28px 40px 80px", maxWidth: 1400, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Import ── */}
        <Carte titre="Importer des données CNUCED" aide={aide}>
          <div className="ro-w">
            {/* Paramètres de lecture */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <Segments value={decoupage}
                onChange={v => { setDecoupage(v); if (v === "secteur" && categorie === "fluxstock") setCategorie("fusion"); }}
                options={[{ v: "pays", l: "Par pays" }, { v: "secteur", l: "Par secteur" }] as const} />
              <Segments value={categorie} onChange={setCategorie}
                options={([
                  { v: "fluxstock", l: "Flux & Stocks" },
                  { v: "greenfield", l: "Greenfield" },
                  { v: "fusion", l: "Fusion & Acquisition" },
                ] as const).filter(o => decoupage === "pays" || o.v !== "fluxstock")} />
              {decoupage === "pays" && (
                <Segments value={formatImport} onChange={setFormatImport}
                  options={[{ v: "annex", l: "Format officiel (Annex tables)" }, { v: "series", l: "Ancien format (séries)" }] as const} />
              )}
            </div>

            {/* Zones de dépôt */}
            <div style={{ display: "grid", gridTemplateColumns: zones.length === 2 ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 18 }}>
              {zones.map(z => <FileZone key={z.l} compact label={z.l} hint={z.h} files={z.f} onChange={z.s} />)}
            </div>

            {/* Résultats */}
            {importRes && (
              <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {importRes.pays.length > 0 && (
                  <Avis ton="ok">{importRes.pays.map(p => <div key={p.pays}>✓ <strong>{p.pays}</strong> — {p.insere} insérées, {p.mis_a_jour} mises à jour</div>)}</Avis>
                )}
                {importRes.erreurs.length > 0 && (
                  <Avis ton="erreur">{importRes.erreurs.map((e, i) => <div key={i}>⚠ {e}</div>)}</Avis>
                )}
                {importRes.prod && (importRes.prod.success ? (
                  <Avis ton="info">☁ <strong>Production synchronisée</strong> — {importRes.prod.nb_lignes} lignes pour {importRes.prod.nb_pays} pays{(importRes.prod.non_resolus ?? 0) > 0 ? ` · ${importRes.prod.non_resolus} libellés non résolus côté prod` : ""}</Avis>
                ) : (
                  <Avis ton="erreur">⚠ Relais vers la production échoué : {importRes.prod.detail} — l&apos;import local a réussi, réessayez ou importez via l&apos;admin en ligne.</Avis>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <button onClick={handleImport} disabled={importing || !hasFiles} style={btnPrincipal(!importing && !!hasFiles)}>
                {importing ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <UploadCloud size={15} />}
                {importing ? "Import en cours…" : "Importer"}
              </button>
              {prodDispo && (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--texte)", cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" checked={prodSync} onChange={e => setProdSync(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--bleu)", cursor: "pointer" }} />
                  Envoyer aussi en <strong>production</strong>
                </label>
              )}
            </div>
          </div>
        </Carte>

        {/* ── Pays non reconnus ── */}
        {nonResolus.length > 0 && (
          <Carte accent="var(--orange)"
            titre={`${nonResolus.length} pays non reconnus — association manuelle`}
            aide="Associez-les une fois : ils seront reconnus automatiquement lors des prochains imports."
            extra={<Compteur n={Object.values(associations).filter(v => v.id).length} mot="associé" couleur="var(--orange)" />}>
            <div className="ro-w" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {nonResolus.map(nr => (
                <div key={nr.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgb(var(--orange-rgb) / 0.04)", borderRadius: 12, border: "1px solid rgb(var(--orange-rgb) / 0.18)", flexWrap: "wrap" }}>
                  <div style={{ flex: "0 0 240px", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nr.label}</div>
                    <div style={{ fontSize: 11, color: "var(--gris)", marginTop: 2 }}>{nr.nb_lignes} lignes non importées</div>
                  </div>
                  <AssociatePicker paysList={paysList} onSelect={(id, nom) => setAssociations(prev => ({ ...prev, [nr.label]: { id, nom } }))} />
                  <button onClick={() => handleDeplacerVersAutre(nr.label)} disabled={!!associations[nr.label]}
                    title={`Créer « ${nr.label} » comme entrée du groupe Autre (entité non-pays : multinational, agrégat…)`}
                    style={{ ...btnSecondaire, opacity: associations[nr.label] ? 0.5 : 1, cursor: associations[nr.label] ? "default" : "pointer" }}>
                    Déplacer vers « Autre »
                  </button>
                  {associations[nr.label] && <CheckCircle size={18} color="var(--vert)" style={{ flexShrink: 0 }} />}
                </div>
              ))}
              <button onClick={handleAssocierEtReimporter} disabled={associating || !Object.values(associations).some(v => v.id)}
                style={{ ...btnPrincipal(!associating && Object.values(associations).some(v => v.id), "var(--orange)"), marginTop: 6, alignSelf: "flex-start" }}>
                {associating ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Link2 size={15} />}
                {associating ? "Association en cours…" : "Associer et réimporter"}
              </button>
            </div>
          </Carte>
        )}

        {/* ── Couverture par pays ── */}
        <Carte titre="Données importées par pays"
          extra={
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <ChampRecherche value={q} onChange={setQ} placeholder="Rechercher un pays…" style={{ width: 230 }} />
              <Segments value={vue} onChange={setVue}
                options={[{ v: "importes", l: "Importés" }, { v: "tous", l: "Tous les pays" }] as const} />
              {!loading && <Compteur n={nbImportes} mot="pays importé" />}
            </div>
          }>

          {/* Barre de sélection multiple */}
          {nbSelec > 0 && (
            <div className="ro-w" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "rgb(var(--bleu-rgb) / 0.05)", border: "1px solid rgb(var(--bleu-rgb) / 0.18)" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--bleu)" }}>
                {nbSelec} pays sélectionné{nbSelec > 1 ? "s" : ""}
                {enSuppression && <span style={{ color: "var(--gris)", fontWeight: 500 }}> — suppression {suppression!.faits}/{suppression!.total}…</span>}
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setSelection(new Set())} disabled={enSuppression} style={btnSecondaire}>Tout désélectionner</button>
                <button onClick={() => supprimerPays([...selection], `de ${nbSelec} pays`)} disabled={enSuppression} style={btnDanger}>
                  {enSuppression ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />}
                  Supprimer la sélection
                </button>
              </div>
            </div>
          )}

          {loading ? <SkeletonRows n={8} /> : mergedPays.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 24px", color: "var(--gris)" }}>
              <Globe2 size={44} style={{ marginBottom: 14, opacity: 0.3 }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--texte)" }}>Aucun pays dans le référentiel</p>
            </div>
          ) : (
            <Tableau hauteurMax={620}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 42, paddingRight: 0 }} className="ro-w">
                    <Case checked={toutSelectionne} indeterminate={partiellement} onChange={basculerTout}
                      disabled={selectionnables.length === 0} titre="Tout sélectionner" />
                  </th>
                  <th style={{ ...TH, position: "sticky", left: 0, zIndex: 2 }}>Pays</th>
                  {Object.keys(SERIES_LABELS).map(k => <th key={k} style={{ ...TH, textAlign: "center" }}>{SERIES_LABELS[k]}</th>)}
                  <th style={{ ...TH, width: 56 }} className="ro-w" />
                </tr>
              </thead>
              <tbody>
                {paysAffiches.length === 0 ? <LigneVide colSpan={Object.keys(SERIES_LABELS).length + 3} texte="Aucun pays ne correspond à cette recherche." /> :
                paysAffiches.map(s => {
                  const coche = selection.has(s.ref_pays_id);
                  return (
                    <Ligne key={s.ref_pays_id} fond={coche ? "rgb(var(--bleu-rgb) / 0.05)" : undefined}
                      style={{ opacity: s.hasData ? 1 : 0.5 }}>
                      <td style={{ ...TD, paddingRight: 0 }} className="ro-w">
                        <Case checked={coche} onChange={() => basculer(s.ref_pays_id)} disabled={!s.hasData}
                          titre={s.hasData ? "Sélectionner" : "Aucune donnée à supprimer"} />
                      </td>
                      <td style={{ ...TD, position: "sticky", left: 0, background: coche ? "var(--bleu-voile)" : "var(--carte)", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <Drapeau code={s.code_iso2} />
                          <span style={{ fontWeight: s.hasData ? 700 : 500, color: s.hasData ? "var(--encre)" : "var(--gris)" }}>{s.pays}</span>
                        </span>
                      </td>
                      {Object.keys(SERIES_LABELS).map(k => {
                        const serie = s.series[k];
                        return (
                          <td key={k} style={{ ...TD, textAlign: "center" }}>
                            {serie ? (
                              <span style={{ ...NUM, background: "rgb(var(--bleu-rgb) / 0.06)", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: "var(--bleu)", whiteSpace: "nowrap" }}>
                                {serie.annee_min}–{serie.annee_max} <span style={{ color: "var(--gris)", fontWeight: 500 }}>({serie.nb})</span>
                              </span>
                            ) : <span style={{ color: "var(--sur-bleu)" }}>–</span>}
                          </td>
                        );
                      })}
                      <td style={{ ...TD, textAlign: "center" }} className="ro-w">
                        {s.hasData && (
                          <button onClick={() => supprimerPays([s.ref_pays_id], `pour ${s.pays}`)} disabled={enSuppression} title="Supprimer ses données"
                            style={{ background: "rgb(var(--danger-rgb) / 0.07)", border: "none", cursor: enSuppression ? "default" : "pointer", borderRadius: 999, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.15)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "rgb(var(--danger-rgb) / 0.07)")}>
                            <Trash2 size={13} style={{ color: "var(--danger)" }} />
                          </button>
                        )}
                      </td>
                    </Ligne>
                  );
                })}
              </tbody>
            </Tableau>
          )}

          {!loading && (
            <p style={{ fontSize: 11.5, color: "var(--gris)", marginTop: 10 }}>
              {nbImportes} pays sur {nbTotal} du référentiel ont des données IDE.
              {vue === "importes" && nbTotal > nbImportes ? " Basculez sur « Tous les pays » pour voir ceux qui n'en ont pas." : ""}
            </p>
          )}
        </Carte>
      </div>
    </div>
  );
}
