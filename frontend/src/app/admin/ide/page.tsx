"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { CheckCircle, Link2, Loader2, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";
import { confirmer } from "@/components/shared/Confirmation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const SEC: any = { fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" };
const IS: any  = { background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };

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

function Flag({ code }: { code: string | null }) {
  if (!code) return <span style={{ fontSize: 18, marginRight: 8 }}>🌐</span>;
  const emoji = code.toUpperCase().split("").map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
  return <span style={{ fontSize: 18, marginRight: 8 }}>{emoji}</span>;
}

function MultiFileZone({ label, sublabel, files, onChange }: { label: string; sublabel: string; files: File[]; onChange: (f: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    onChange([...files, ...Array.from(newFiles).filter(f => !files.some(e => e.name === f.name))]);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        style={{ border: `2px dashed ${drag ? "#004f91" : files.length ? "#004f91" : "#C5BFBB"}`, borderRadius: 10, padding: "16px 12px", textAlign: "center", cursor: "pointer", background: drag ? "#E8F0FB" : files.length ? "#EEF4FB" : "#F9F8F7", transition: "all .15s", minHeight: 80 }}>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" multiple style={{ display: "none" }} onChange={e => addFiles(e.target.files)} />
        <UploadCloud size={18} color={files.length ? "#004f91" : "#AAA"} style={{ marginBottom: 4 }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: files.length ? "#004f91" : "#666" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#AAA", marginTop: 1 }}>{sublabel}</div>
      </div>
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {files.map((f, i) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F5F8FF", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <CheckCircle size={12} color="#004f91" />
                <span style={{ color: "#333", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <span style={{ color: "#888" }}>({(f.size / 1024).toFixed(0)} Ko)</span>
              </div>
              <button onClick={() => onChange(files.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: 0 }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <input value={chosen || search} onChange={e => { setSearch(e.target.value); setChosen(""); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Rechercher dans ref_pays…" style={{ ...IS, borderColor: chosen ? "#004f91" : undefined }} />
      {open && filtered.length > 0 && !chosen && (
        <div style={{ position: "absolute", zIndex: 200, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #C5BFBB", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.1)", maxHeight: 220, overflowY: "auto", marginTop: 2 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => { setChosen(p.nom_fr); setSearch(""); setOpen(false); onSelect(p.id, p.nom_fr); }}
              style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F0F4FF")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <Flag code={p.code_iso2} />{p.nom_fr}
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
  const [unctadOk, setUnctadOk] = useState<boolean | null>(null);

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

  const [refreshing,   setRefreshing]   = useState(false);
  const [refreshRes,   setRefreshRes]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [deleting,     setDeleting]     = useState<number | null>(null);

  async function loadData() {
    const [st, cfg, pr, sp] = await Promise.all([
      fetch(`${API}/ide/cnuced/stats`).then(r => r.json()),
      fetch(`${API}/ide/rafraichir/config`).then(r => r.json()),
      fetch(`${API}/ide/pays-ref`).then(r => r.json()),
      fetch(`${API}/ide/sync-prod/config`).then(r => r.json()).catch(() => ({ configured: false })),
    ]);
    setStats(Array.isArray(st) ? st : []);
    setUnctadOk(cfg?.configured ?? false);
    setPaysList(Array.isArray(pr) ? pr : []);
    setProdDispo(sp?.configured ?? false);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  // Fusionner tous les pays ref_pays avec les stats : importés d'abord, puis grisés
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

  async function handleRefresh() {
    if (!unctadOk) return;
    setRefreshing(true); setRefreshRes(null);
    try {
      const res  = await fetch(`${API}/ide/rafraichir`, { method: "POST", headers: await authHeaders() });
      const data = await res.json();
      if (data.success) {
        const nb = (data.pays || []).reduce((acc: number, p: any) => acc + p.insere + p.mis_a_jour, 0);
        setRefreshRes({ ok: true, msg: `${nb} lignes mises à jour pour ${data.pays?.length ?? 0} pays.` });
        await loadData();
      } else {
        setRefreshRes({ ok: false, msg: data.erreur || "Erreur inconnue" });
      }
    } catch (e: any) { setRefreshRes({ ok: false, msg: "Erreur réseau : " + e.message }); }
    setRefreshing(false);
  }

  async function handleDelete(rpid: number, pays: string) {
    if (!(await confirmer(`Supprimer toutes les données IDE pour ${pays} ?`))) return;
    setDeleting(rpid);
    try { const res = await fetch(`${API}/ide/cnuced/pays/${rpid}`, { method: "DELETE", headers: await authHeaders() }); if (res.ok) await loadData(); } catch {}
    setDeleting(null);
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto", fontFamily: "var(--font-google-sans)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>IDE — Investissements Directs Étrangers</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>Importez les séries CNUCED (flux/stock entrant/sortant) pour un ou plusieurs pays simultanément.</p>

      {/* ── Import ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px", marginBottom: 20 }}>
        <div style={SEC}>Importer des données CNUCED</div>
        {/* Découpage : par pays / par secteur */}
        <div style={{ display: "inline-flex", background: "#F2F0EF", borderRadius: 999, padding: 3, gap: 3, marginBottom: 8, marginRight: 12 }}>
          {([
            { v: "pays",    l: "Par pays" },
            { v: "secteur", l: "Par secteur" },
          ] as const).map(o => (
            <button key={o.v} onClick={() => { setDecoupage(o.v); if (o.v === "secteur" && categorie === "fluxstock") setCategorie("fusion"); }}
              style={{ padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: decoupage === o.v ? "#fff" : "transparent", color: decoupage === o.v ? "#004f91" : "#9aa5b4", boxShadow: decoupage === o.v ? "0 1px 4px rgba(0,0,0,0.10)" : "none", fontFamily: "var(--font-google-sans)", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {o.l}
            </button>
          ))}
        </div>
        {/* Catégorie de données */}
        <div style={{ display: "inline-flex", background: "#F2F0EF", borderRadius: 999, padding: 3, gap: 3, marginBottom: 8, marginRight: 12 }}>
          {([
            { v: "fluxstock",  l: "Flux & Stocks" },
            { v: "greenfield", l: "Greenfield" },
            { v: "fusion",     l: "Fusion & Acquisition" },
          ] as const).filter(o => decoupage === "pays" || o.v !== "fluxstock").map(o => (
            <button key={o.v} onClick={() => setCategorie(o.v)}
              style={{ padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: categorie === o.v ? "#fff" : "transparent", color: categorie === o.v ? "#004f91" : "#9aa5b4", boxShadow: categorie === o.v ? "0 1px 4px rgba(0,0,0,0.10)" : "none", fontFamily: "var(--font-google-sans)", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {o.l}
            </button>
          ))}
        </div>
        {/* Mode d'extraction (le découpage sectoriel n'existe qu'au format Annex tables) */}
        {decoupage === "pays" && (
        <div style={{ display: "inline-flex", background: "#F2F0EF", borderRadius: 999, padding: 3, gap: 3, marginBottom: 12 }}>
          {([
            { v: "annex",  l: "Format officiel (Annex tables)" },
            { v: "series", l: "Ancien format (séries)" },
          ] as const).map(o => (
            <button key={o.v} onClick={() => setFormatImport(o.v)}
              style={{ padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: formatImport === o.v ? "#fff" : "transparent", color: formatImport === o.v ? "#004f91" : "#9aa5b4", boxShadow: formatImport === o.v ? "0 1px 4px rgba(0,0,0,0.10)" : "none", fontFamily: "var(--font-google-sans)", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {o.l}
            </button>
          ))}
        </div>
        )}
        <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
          {decoupage === "secteur" ? (
            <>Déposez les Annex tables sectorielles du World Investment Report (Excel/CSV) : en-tête <strong>Sector/industry | 1990 | … | 2025</strong>, une ligne par secteur ou branche, années en colonnes. Les libellés sont résolus sur le référentiel CNUCED (secteurs et branches) ; la ligne <strong>Total</strong> est ignorée automatiquement.</>
          ) : formatImport === "annex" ? (
            <>Déposez les Annex tables du World Investment Report (Excel/CSV) : en-tête <strong>Region/economy | 1990 | … | 2025</strong>, une ligne par pays, années en colonnes. Les agrégats régionaux (World, Europe…) et les notes sont ignorés automatiquement.</>
          ) : (
            <>Déposez un ou plusieurs fichiers CSV par série. Le pays est détecté automatiquement depuis <strong>Economy_Label</strong> (format <strong>Economy_Label | Year | Value</strong>, 1 ligne par année). Un fichier peut contenir plusieurs pays.</>
          )}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          {decoupage === "secteur" ? (categorie === "fusion" ? (<>
            <MultiFileZone label="Valeur — ventes"  sublabel="Annex 09 · net sales by sector" files={fluxEntrant}  onChange={setFluxEntrant} />
            <MultiFileZone label="Valeur — achats"  sublabel="Annex 10 · net purchases by sector" files={fluxSortant}  onChange={setFluxSortant} />
            <MultiFileZone label="Nombre — ventes"  sublabel="Annex 11 · number by sector"    files={stockEntrant} onChange={setStockEntrant} />
            <MultiFileZone label="Nombre — achats"  sublabel="Annex 12 · number by sector"    files={stockSortant} onChange={setStockSortant} />
          </>) : (<>
            <MultiFileZone label="Valeur des projets annoncés" sublabel="Annex 15 · value by sector"  files={fluxEntrant}  onChange={setFluxEntrant} />
            <MultiFileZone label="Nombre de projets annoncés"  sublabel="Annex 18 · number by sector" files={stockEntrant} onChange={setStockEntrant} />
          </>)) : categorie === "fluxstock" ? (<>
            <MultiFileZone label="Flux entrants"  sublabel="1 ou N pays par fichier" files={fluxEntrant}  onChange={setFluxEntrant} />
            <MultiFileZone label="Flux sortants"  sublabel="1 ou N pays par fichier" files={fluxSortant}  onChange={setFluxSortant} />
            <MultiFileZone label="Stock entrants" sublabel="1 ou N pays par fichier" files={stockEntrant} onChange={setStockEntrant} />
            <MultiFileZone label="Stock sortants" sublabel="1 ou N pays par fichier" files={stockSortant} onChange={setStockSortant} />
          </>) : categorie === "greenfield" ? (<>
            <MultiFileZone label="Valeur — destination (entrants)" sublabel="Annex 14 · value by destination" files={fluxEntrant}  onChange={setFluxEntrant} />
            <MultiFileZone label="Valeur — source (sortants)"      sublabel="Annex 13 · value by source"      files={fluxSortant}  onChange={setFluxSortant} />
            <MultiFileZone label="Nombre — destination (entrants)" sublabel="Annex 17 · number by destination" files={stockEntrant} onChange={setStockEntrant} />
            <MultiFileZone label="Nombre — source (sortants)"      sublabel="Annex 16 · number by source"      files={stockSortant} onChange={setStockSortant} />
          </>) : (<>
            <MultiFileZone label="Valeur — ventes (entrants)"  sublabel="Annex 05 · net sales by seller"     files={fluxEntrant}  onChange={setFluxEntrant} />
            <MultiFileZone label="Valeur — achats (sortants)"  sublabel="Annex 06 · net purchases by purchaser" files={fluxSortant}  onChange={setFluxSortant} />
            <MultiFileZone label="Nombre — ventes (entrants)"  sublabel="Annex 07 · number by seller"        files={stockEntrant} onChange={setStockEntrant} />
            <MultiFileZone label="Nombre — achats (sortants)"  sublabel="Annex 08 · number by purchaser"     files={stockSortant} onChange={setStockSortant} />
          </>)}
        </div>
        {importRes && (
          <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {importRes.pays.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#EDFBF1", border: "1px solid #B2EAC5" }}>
                {importRes.pays.map(p => <div key={p.pays} style={{ fontSize: 13, color: "#1a7a3c" }}>✓ <strong>{p.pays}</strong> — {p.insere} insérées, {p.mis_a_jour} mises à jour</div>)}
              </div>
            )}
            {importRes.erreurs.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FFF2F2", border: "1px solid #F5C6CB" }}>
                {importRes.erreurs.map((e, i) => <div key={i} style={{ fontSize: 13, color: "#c0392b" }}>⚠ {e}</div>)}
              </div>
            )}
            {importRes.prod && (
              importRes.prod.success ? (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#EDF4FB", border: "1px solid #B8D4EE", fontSize: 13, color: "#004f91" }}>
                  ☁ <strong>Production synchronisée</strong> — {importRes.prod.nb_lignes} lignes pour {importRes.prod.nb_pays} pays{(importRes.prod.non_resolus ?? 0) > 0 ? ` · ${importRes.prod.non_resolus} libellés non résolus côté prod` : ""}
                </div>
              ) : (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FFF2F2", border: "1px solid #F5C6CB", fontSize: 13, color: "#c0392b" }}>
                  ⚠ Relais vers la production échoué : {importRes.prod.detail} — l&apos;import local a réussi, réessayez ou importez via l&apos;admin en ligne.
                </div>
              )
            )}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <button onClick={handleImport} disabled={importing || !hasFiles}
            style={{ background: importing || !hasFiles ? "#ccc" : "#004f91", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: importing || !hasFiles ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {importing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
            {importing ? "Import en cours…" : "Importer"}
          </button>
          {prodDispo && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#4a5568", cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={prodSync} onChange={e => setProdSync(e.target.checked)} style={{ width: 15, height: 15, accentColor: "#004f91", cursor: "pointer" }} />
              Envoyer aussi en <strong>production</strong>
            </label>
          )}
        </div>
      </div>

      {/* ── Pays non reconnus ── */}
      {nonResolus.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, border: "2px solid #F5A623", padding: "24px 28px", marginBottom: 20 }}>
          <div style={{ ...SEC, color: "#B7661B", borderBottomColor: "#FAD7A0" }}>{nonResolus.length} pays non reconnus — association manuelle</div>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>Associez-les une fois — ils seront reconnus automatiquement lors des prochains imports.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nonResolus.map(nr => (
              <div key={nr.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#FFF9F0", borderRadius: 8, border: "1px solid #FAD7A0" }}>
                <div style={{ flex: "0 0 280px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#B7661B" }}>{nr.label}</div>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{nr.nb_lignes} lignes non importées</div>
                </div>
                <AssociatePicker paysList={paysList} onSelect={(id, nom) => setAssociations(prev => ({ ...prev, [nr.label]: { id, nom } }))} />
                <button onClick={() => handleDeplacerVersAutre(nr.label)} disabled={!!associations[nr.label]}
                  title={`Créer « ${nr.label} » comme entrée du groupe Autre (entité non-pays : multinational, agrégat…)`}
                  style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 8, border: "1px solid #DFDBD7", background: "#F8F7F6", color: "#4a5568", fontSize: 12, fontWeight: 600, cursor: associations[nr.label] ? "default" : "pointer", opacity: associations[nr.label] ? 0.5 : 1, whiteSpace: "nowrap" }}>
                  Déplacer vers « Autre »
                </button>
                {associations[nr.label] && <CheckCircle size={18} color="#27ae60" style={{ flexShrink: 0 }} />}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={handleAssocierEtReimporter} disabled={associating || !Object.values(associations).some(v => v.id)}
              style={{ background: associating || !Object.values(associations).some(v => v.id) ? "#ccc" : "#B7661B", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              {associating ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              {associating ? "Association en cours…" : "Associer et réimporter"}
            </button>
            <span style={{ fontSize: 12, color: "#999" }}>{Object.values(associations).filter(v => v.id).length}/{nonResolus.length} associés</span>
          </div>
        </div>
      )}

      {/* ── Tableau pays ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px" }}>

        {/* En-tête avec compteur + refresh */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" }}>Données importées par pays</span>
            {!loading && (
              <span style={{ background: nbImportes === nbTotal ? "#EDFBF1" : "#EEF4FB", color: nbImportes === nbTotal ? "#1a7a3c" : "#004f91", border: `1px solid ${nbImportes === nbTotal ? "#B2EAC5" : "#BDD5F0"}`, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
                {nbImportes} / {nbTotal} pays
              </span>
            )}
          </div>
          <button onClick={handleRefresh} disabled={refreshing || !unctadOk}
            title={unctadOk ? "Rafraîchir depuis l'API UNCTAD" : "Credentials UNCTAD non configurés"}
            style={{ background: "none", border: "1px solid #C5BFBB", borderRadius: 8, padding: "6px 10px", cursor: unctadOk ? "pointer" : "not-allowed", color: unctadOk ? "#004f91" : "#CCC", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {refreshing ? "Actualisation…" : "Actualiser UNCTAD"}
          </button>
        </div>

        {/* Message résultat refresh */}
        {refreshRes && (
          <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", background: refreshRes.ok ? "#EDFBF1" : "#FFF2F2", border: `1px solid ${refreshRes.ok ? "#B2EAC5" : "#F5C6CB"}` }}>
            <span style={{ fontSize: 13, color: refreshRes.ok ? "#1a7a3c" : "#c0392b" }}>{refreshRes.ok ? "✓" : "✗"} {refreshRes.msg}</span>
            <button onClick={() => setRefreshRes(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}><X size={14} /></button>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={24} color="#004f91" className="animate-spin" /></div>
        ) : mergedPays.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#888", fontSize: 13 }}>Aucun pays dans ref_pays.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E8E5E3" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pays</th>
                {Object.keys(SERIES_LABELS).map(k => (
                  <th key={k} style={{ padding: "10px 12px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>{SERIES_LABELS[k]}</th>
                ))}
                <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#4a5568", textTransform: "uppercase", letterSpacing: "0.08em" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {mergedPays.map(s => (
                <tr key={s.ref_pays_id} style={{ borderBottom: "1px solid #F0EEEC", opacity: s.hasData ? 1 : 0.4, transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#FAFAF9")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <Flag code={s.code_iso2} />
                      <span style={{ fontWeight: s.hasData ? 600 : 400, color: s.hasData ? "#1a1a2e" : "#888" }}>{s.pays}</span>
                    </div>
                  </td>
                  {Object.keys(SERIES_LABELS).map(k => {
                    const serie = s.series[k];
                    return (
                      <td key={k} style={{ padding: "10px 12px", textAlign: "center" }}>
                        {serie
                          ? <span style={{ background: "#EEF4FB", padding: "3px 10px", borderRadius: 20, fontSize: 12, color: "#004f91", whiteSpace: "nowrap" }}>{serie.annee_min}–{serie.annee_max} <span style={{ color: "#888" }}>({serie.nb})</span></span>
                          : <span style={{ color: "#DDD" }}>–</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {s.hasData && (
                      <button onClick={() => handleDelete(s.ref_pays_id, s.pays)} disabled={deleting === s.ref_pays_id}
                        style={{ background: "none", border: "1px solid #e74c3c", color: "#e74c3c", borderRadius: 6, padding: "5px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                        {deleting === s.ref_pays_id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
