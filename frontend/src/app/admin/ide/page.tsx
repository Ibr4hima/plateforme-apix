"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Link2, Loader2, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const SEC: any = { fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" };
const IS: any  = { background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };

type RefPays    = { id: number; nom_fr: string; code_iso2: string | null };
type StatPays   = { ref_pays_id: number; pays: string; code_iso2: string | null; series: Record<string, { annee_min: number; annee_max: number; nb: number }> };
type ImportResult  = { pays: string; ref_pays_id: number; insere: number; mis_a_jour: number };
type NonResolu  = { label: string; nb_lignes: number };
type ImportRes  = { pays: ImportResult[]; erreurs: string[]; non_resolus: NonResolu[] };

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
    const added = Array.from(newFiles);
    onChange([...files, ...added.filter(f => !files.some(e => e.name === f.name))]);
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
              <button onClick={() => onChange(files.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: 0 }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Autocomplete pour associer un label UNCTAD à un pays ref_pays
function AssociatePicker({ label, paysList, onSelect }: { label: string; paysList: RefPays[]; onSelect: (id: number, nom: string) => void }) {
  const [search, setSearch] = useState("");
  const [open,   setOpen]   = useState(false);
  const [chosen, setChosen] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = paysList.filter(p => p.nom_fr.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <input
        value={chosen || search}
        onChange={e => { setSearch(e.target.value); setChosen(""); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Rechercher dans ref_pays…"
        style={{ ...IS, borderColor: chosen ? "#004f91" : undefined }}
      />
      {open && filtered.length > 0 && !chosen && (
        <div style={{ position: "absolute", zIndex: 200, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #C5BFBB", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.1)", maxHeight: 220, overflowY: "auto", marginTop: 2 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => { setChosen(p.nom_fr); setSearch(""); setOpen(false); onSelect(p.id, p.nom_fr); }}
              style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F0F4FF")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <Flag code={p.code_iso2} />
              {p.nom_fr}
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

  const [importing,   setImporting]   = useState(false);
  const [importRes,   setImportRes]   = useState<ImportRes | null>(null);

  // Associations manuelles : label UNCTAD → { ref_pays_id, nom_fr }
  const [associations, setAssociations] = useState<Record<string, { id: number; nom: string }>>({});
  const [associating,  setAssociating]  = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshRes, setRefreshRes] = useState<any>(null);
  const [deleting,   setDeleting]   = useState<number | null>(null);

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
    setImporting(true);
    setImportRes(null);
    setAssociations({});
    try {
      const res  = await fetch(`${API}/ide/importer`, { method: "POST", body: buildFormData() });
      const data = await res.json();
      if (res.ok) {
        setImportRes(data);
        // Vider les fichiers seulement si tout est résolu
        if (!data.non_resolus?.length) {
          setFluxEntrant([]); setFluxSortant([]); setStockEntrant([]); setStockSortant([]);
        }
        await loadData();
      } else {
        setImportRes({ pays: [], erreurs: [data.detail || "Erreur inconnue"], non_resolus: [] });
      }
    } catch (e: any) {
      setImportRes({ pays: [], erreurs: ["Erreur réseau : " + e.message], non_resolus: [] });
    }
    setImporting(false);
  }

  async function handleAssocierEtReimporter() {
    const toAssociate = Object.entries(associations).filter(([, v]) => v.id);
    if (!toAssociate.length) return;

    setAssociating(true);
    // 1. Enregistrer chaque association
    for (const [label, { id }] of toAssociate) {
      await fetch(`${API}/ide/associer-pays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label_cnuced: label, ref_pays_id: id }),
      });
    }
    // 2. Réimporter avec les mêmes fichiers
    setAssociating(false);
    await handleImport();
  }

  async function handleRefresh() {
    setRefreshing(true); setRefreshRes(null);
    try {
      const res  = await fetch(`${API}/ide/rafraichir`, { method: "POST" });
      const data = await res.json();
      setRefreshRes(data);
      if (data.success) await loadData();
    } catch (e: any) {
      setRefreshRes({ success: false, erreur: "Erreur réseau : " + e.message });
    }
    setRefreshing(false);
  }

  async function handleDelete(rpid: number, pays: string) {
    if (!confirm(`Supprimer toutes les données IDE pour ${pays} ?`)) return;
    setDeleting(rpid);
    try { const res = await fetch(`${API}/ide/cnuced/pays/${rpid}`, { method: "DELETE" }); if (res.ok) await loadData(); } catch {}
    setDeleting(null);
  }

  const allAssociated = nonResolus.length > 0 && nonResolus.every(nr => associations[nr.label]?.id);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto", fontFamily: "var(--font-google-sans)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>IDE — Investissements Directs Étrangers</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>Importez les séries CNUCED (flux/stock entrant/sortant) pour un ou plusieurs pays simultanément.</p>

      {/* ── Import ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px", marginBottom: 20 }}>
        <div style={SEC}>Importer des données CNUCED</div>
        <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
          Déposez un ou plusieurs fichiers CSV par série. Le pays est détecté automatiquement depuis la colonne <strong>Economy_Label</strong>. Un seul fichier peut contenir plusieurs pays.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <MultiFileZone label="Flux entrants"  sublabel="1 ou N pays par fichier" files={fluxEntrant}  onChange={setFluxEntrant} />
          <MultiFileZone label="Flux sortants"  sublabel="1 ou N pays par fichier" files={fluxSortant}  onChange={setFluxSortant} />
          <MultiFileZone label="Stock entrants" sublabel="1 ou N pays par fichier" files={stockEntrant} onChange={setStockEntrant} />
          <MultiFileZone label="Stock sortants" sublabel="1 ou N pays par fichier" files={stockSortant} onChange={setStockSortant} />
        </div>

        {/* Résultats import */}
        {importRes && (
          <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {importRes.pays.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#EDFBF1", border: "1px solid #B2EAC5" }}>
                {importRes.pays.map(p => (
                  <div key={p.pays} style={{ fontSize: 13, color: "#1a7a3c" }}>
                    ✓ <strong>{p.pays}</strong> — {p.insere} insérées, {p.mis_a_jour} mises à jour
                  </div>
                ))}
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
          <div style={{ ...SEC, color: "#B7661B", borderBottomColor: "#FAD7A0" }}>
            {nonResolus.length} pays non reconnus — association manuelle
          </div>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
            Ces noms UNCTAD ne correspondent à aucun pays dans <strong>ref_pays</strong>. Associez-les une fois — la prochaine fois ils seront reconnus automatiquement.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nonResolus.map(nr => (
              <div key={nr.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#FFF9F0", borderRadius: 8, border: "1px solid #FAD7A0" }}>
                <div style={{ flex: "0 0 280px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#B7661B" }}>{nr.label}</div>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{nr.nb_lignes} lignes non importées</div>
                </div>
                <AssociatePicker
                  label={nr.label}
                  paysList={paysList}
                  onSelect={(id, nom) => setAssociations(prev => ({ ...prev, [nr.label]: { id, nom } }))}
                />
                {associations[nr.label] && (
                  <CheckCircle size={18} color="#27ae60" style={{ flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={handleAssocierEtReimporter}
              disabled={associating || !Object.values(associations).some(v => v.id)}
              style={{ background: associating || !Object.values(associations).some(v => v.id) ? "#ccc" : "#B7661B", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              {associating ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              {associating ? "Association en cours…" : allAssociated ? "Associer tout et réimporter" : "Associer les sélectionnés et réimporter"}
            </button>
            {!allAssociated && (
              <span style={{ fontSize: 12, color: "#999" }}>
                {Object.values(associations).filter(v => v.id).length}/{nonResolus.length} associés
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Auto-refresh ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "20px 28px", marginBottom: 20 }}>
        <div style={SEC}>Mise à jour automatique UNCTAD</div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: "#555", margin: 0, marginBottom: 6 }}>
              Récupère les nouvelles données directement depuis l'API UNCTAD pour tous les pays déjà importés. Tourne automatiquement <strong>chaque dimanche à 2h</strong>.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: unctadOk === null ? "#CCC" : unctadOk ? "#27ae60" : "#e74c3c" }} />
              {unctadOk === null ? "Vérification…"
                : unctadOk ? "Credentials configurés"
                : "Credentials non configurés — ajoutez UNCTAD_CLIENT_ID et UNCTAD_CLIENT_SECRET dans le .env"}
            </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing || !unctadOk}
            style={{ background: refreshing || !unctadOk ? "#ccc" : "#004f91", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: refreshing || !unctadOk ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flexShrink: 0 }}>
            {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {refreshing ? "Rafraîchissement…" : "Rafraîchir maintenant"}
          </button>
        </div>
        {refreshRes && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid", background: refreshRes.success ? "#EDFBF1" : "#FFF2F2", borderColor: refreshRes.success ? "#B2EAC5" : "#F5C6CB" }}>
            {refreshRes.success
              ? <>
                  {refreshRes.pays?.map((p: any) => <div key={p.pays} style={{ fontSize: 13, color: "#1a7a3c" }}>✓ <strong>{p.pays}</strong> — {p.insere} insérées, {p.mis_a_jour} mises à jour</div>)}
                  {refreshRes.erreurs?.map((e: any, i: number) => <div key={i} style={{ fontSize: 13, color: "#c0392b" }}>⚠ {e}</div>)}
                </>
              : <div style={{ fontSize: 13, color: "#c0392b" }}>✗ {refreshRes.erreur}</div>
            }
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px" }}>
        <div style={SEC}>Données importées par pays</div>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={24} color="#004f91" className="animate-spin" /></div>
        ) : stats.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#888", fontSize: 13 }}>Aucune donnée importée.</div>
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
              {stats.map(s => (
                <tr key={s.ref_pays_id} style={{ borderBottom: "1px solid #F0EEEC" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <Flag code={s.code_iso2} />
                      <span style={{ fontWeight: 600 }}>{s.pays}</span>
                    </div>
                  </td>
                  {Object.keys(SERIES_LABELS).map(k => {
                    const serie = s.series[k];
                    return (
                      <td key={k} style={{ padding: "10px 12px", textAlign: "center" }}>
                        {serie
                          ? <span style={{ background: "#EEF4FB", padding: "3px 10px", borderRadius: 20, fontSize: 12, color: "#004f91", whiteSpace: "nowrap" }}>{serie.annee_min}–{serie.annee_max} <span style={{ color: "#888" }}>({serie.nb})</span></span>
                          : <span style={{ color: "#CCC", fontSize: 18 }}>–</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <button onClick={() => handleDelete(s.ref_pays_id, s.pays)} disabled={deleting === s.ref_pays_id}
                      style={{ background: "none", border: "1px solid #e74c3c", color: "#e74c3c", borderRadius: 6, padding: "5px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      {deleting === s.ref_pays_id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Supprimer
                    </button>
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
