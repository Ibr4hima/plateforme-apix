"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { CheckCircle, Link2, Loader2, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { authHeaders } from "@/lib/authHeaders";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const SEC: any = { fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" };
const IS: any  = { background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };

type RefPays     = { id: number; nom_fr: string; code_iso2: string | null };
type StatPays    = { ref_pays_id: number; pays: string; code_iso2: string | null; series: Record<string, { annee_min: number; annee_max: number; nb: number }> };
type ImportResult= { pays: string; ref_pays_id: number; insere: number; mis_a_jour: number };
type NonResolu   = { label: string; nb_lignes: number };
type ImportRes   = { pays: ImportResult[]; erreurs: string[]; non_resolus: NonResolu[] };
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

  const [importing,    setImporting]    = useState(false);
  const [importRes,    setImportRes]    = useState<ImportRes | null>(null);
  const [associations, setAssociations] = useState<Record<string, { id: number; nom: string }>>({});
  const [associating,  setAssociating]  = useState(false);

  const [refreshing,   setRefreshing]   = useState(false);
  const [refreshRes,   setRefreshRes]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [deleting,     setDeleting]     = useState<number | null>(null);

  async function loadData() {
    const [st, cfg, pr] = await Promise.all([
      fetch(`${API}/ide/cnuced/stats`).then(r => r.json()),
      fetch(`${API}/ide/rafraichir/config`).then(r => r.json()),
      fetch(`${API}/ide/pays-ref`).then(r => r.json()),
    ]);
    setStats(Array.isArray(st) ? st : []);
    setUnctadOk(cfg?.configured ?? false);
    setPaysList(Array.isArray(pr) ? pr : []);
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
    fluxEntrant.forEach(f  => fd.append("flux_entrant",  f));
    fluxSortant.forEach(f  => fd.append("flux_sortant",  f));
    stockEntrant.forEach(f => fd.append("stock_entrant", f));
    stockSortant.forEach(f => fd.append("stock_sortant", f));
    return fd;
  }

  async function handleImport() {
    if (!hasFiles) return;
    setImporting(true); setImportRes(null); setAssociations({});
    try {
      const res  = await fetch(`${API}/ide/importer`, { method: "POST", headers: await authHeaders(), body: buildFormData() });
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
    if (!confirm(`Supprimer toutes les données IDE pour ${pays} ?`)) return;
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
        <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
          Déposez un ou plusieurs fichiers CSV par série. Le pays est détecté automatiquement depuis <strong>Economy_Label</strong>. Un fichier peut contenir plusieurs pays.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <MultiFileZone label="Flux entrants"  sublabel="1 ou N pays par fichier" files={fluxEntrant}  onChange={setFluxEntrant} />
          <MultiFileZone label="Flux sortants"  sublabel="1 ou N pays par fichier" files={fluxSortant}  onChange={setFluxSortant} />
          <MultiFileZone label="Stock entrants" sublabel="1 ou N pays par fichier" files={stockEntrant} onChange={setStockEntrant} />
          <MultiFileZone label="Stock sortants" sublabel="1 ou N pays par fichier" files={stockSortant} onChange={setStockSortant} />
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
          </div>
        )}
        <button onClick={handleImport} disabled={importing || !hasFiles}
          style={{ background: importing || !hasFiles ? "#ccc" : "#004f91", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: importing || !hasFiles ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
          {importing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
          {importing ? "Import en cours…" : "Importer"}
        </button>
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
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#4a5568" }}>Pays</th>
                {Object.keys(SERIES_LABELS).map(k => (
                  <th key={k} style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600, color: "#4a5568" }}>{SERIES_LABELS[k]}</th>
                ))}
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600, color: "#4a5568" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {mergedPays.map(s => (
                <tr key={s.ref_pays_id} style={{ borderBottom: "1px solid #F0EEEC", opacity: s.hasData ? 1 : 0.4 }}>
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
