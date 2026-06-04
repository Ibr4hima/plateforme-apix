"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const SEC: any = { fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" };

type StatPays = {
  ref_pays_id: number;
  pays: string;
  code_iso2: string | null;
  series: Record<string, { annee_min: number; annee_max: number; nb: number }>;
};
type ImportResult = { pays: string; ref_pays_id: number; insere: number; mis_a_jour: number };

const SERIES_LABELS: Record<string, string> = {
  entrant_flux:  "Flux entrants",
  sortant_flux:  "Flux sortants",
  entrant_stock: "Stock entrants",
  sortant_stock: "Stock sortants",
};

function Flag({ code }: { code: string | null }) {
  if (!code) return <span style={{ fontSize: 18, marginRight: 8 }}>🌐</span>;
  const emoji = code.toUpperCase().split("").map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
  return <span style={{ fontSize: 18, marginRight: 8 }}>{emoji}</span>;
}

// Zone de dépôt acceptant plusieurs fichiers
function MultiFileZone({
  label, sublabel, files, onChange,
}: { label: string; sublabel: string; files: File[]; onChange: (f: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const added = Array.from(newFiles);
    onChange([...files, ...added.filter(f => !files.some(e => e.name === f.name))]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${drag ? "#004f91" : files.length ? "#004f91" : "#C5BFBB"}`,
          borderRadius: 10,
          padding: "16px 12px",
          textAlign: "center",
          cursor: "pointer",
          background: drag ? "#E8F0FB" : files.length ? "#EEF4FB" : "#F9F8F7",
          transition: "all .15s",
          minHeight: 80,
        }}
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" multiple style={{ display: "none" }}
          onChange={e => addFiles(e.target.files)} />
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
              <button onClick={() => onChange(files.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: 0 }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminIdePage() {
  const [stats,   setStats]   = useState<StatPays[]>([]);
  const [loading, setLoading] = useState(true);
  const [unctadOk, setUnctadOk] = useState<boolean | null>(null);

  const [fluxEntrant,  setFluxEntrant]  = useState<File[]>([]);
  const [fluxSortant,  setFluxSortant]  = useState<File[]>([]);
  const [stockEntrant, setStockEntrant] = useState<File[]>([]);
  const [stockSortant, setStockSortant] = useState<File[]>([]);

  const [importing,   setImporting]   = useState(false);
  const [importRes,   setImportRes]   = useState<{ pays: ImportResult[]; erreurs: string[] } | null>(null);

  const [refreshing,  setRefreshing]  = useState(false);
  const [refreshRes,  setRefreshRes]  = useState<{ success: boolean; pays?: ImportResult[]; erreurs?: string[]; erreur?: string } | null>(null);

  const [deleting,    setDeleting]    = useState<number | null>(null);

  async function loadData() {
    const [st, cfg] = await Promise.all([
      fetch(`${API}/ide/cnuced/stats`).then(r => r.json()),
      fetch(`${API}/ide/rafraichir/config`).then(r => r.json()),
    ]);
    setStats(Array.isArray(st) ? st : []);
    setUnctadOk(cfg?.configured ?? false);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const hasFiles = fluxEntrant.length || fluxSortant.length || stockEntrant.length || stockSortant.length;

  async function handleImport() {
    if (!hasFiles) return;
    setImporting(true);
    setImportRes(null);
    const fd = new FormData();
    fluxEntrant.forEach(f  => fd.append("flux_entrant",  f));
    fluxSortant.forEach(f  => fd.append("flux_sortant",  f));
    stockEntrant.forEach(f => fd.append("stock_entrant", f));
    stockSortant.forEach(f => fd.append("stock_sortant", f));
    try {
      const res = await fetch(`${API}/ide/importer`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setImportRes(data);
        setFluxEntrant([]); setFluxSortant([]); setStockEntrant([]); setStockSortant([]);
        await loadData();
      } else {
        setImportRes({ pays: [], erreurs: [data.detail || "Erreur inconnue"] });
      }
    } catch (e: any) {
      setImportRes({ pays: [], erreurs: ["Erreur réseau : " + e.message] });
    }
    setImporting(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshRes(null);
    try {
      const res = await fetch(`${API}/ide/rafraichir`, { method: "POST" });
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
    try {
      const res = await fetch(`${API}/ide/cnuced/pays/${rpid}`, { method: "DELETE" });
      if (res.ok) await loadData();
    } catch {}
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
          Déposez un ou plusieurs fichiers CSV par série. Le pays est détecté automatiquement depuis la colonne <strong>Economy_Label</strong> de chaque fichier.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <MultiFileZone label="Flux entrants" sublabel="1 fichier par pays" files={fluxEntrant} onChange={setFluxEntrant} />
          <MultiFileZone label="Flux sortants" sublabel="1 fichier par pays" files={fluxSortant} onChange={setFluxSortant} />
          <MultiFileZone label="Stock entrants" sublabel="1 fichier par pays" files={stockEntrant} onChange={setStockEntrant} />
          <MultiFileZone label="Stock sortants" sublabel="1 fichier par pays" files={stockSortant} onChange={setStockSortant} />
        </div>

        {importRes && (
          <div style={{ marginBottom: 14 }}>
            {importRes.pays.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#EDFBF1", border: "1px solid #B2EAC5", marginBottom: 8 }}>
                {importRes.pays.map(p => (
                  <div key={p.pays} style={{ fontSize: 13, color: "#1a7a3c" }}>
                    ✓ <strong>{p.pays}</strong> — {p.insere} insérées, {p.mis_a_jour} mises à jour
                  </div>
                ))}
              </div>
            )}
            {importRes.erreurs.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FFF2F2", border: "1px solid #F5C6CB" }}>
                {importRes.erreurs.map((e, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#c0392b" }}>⚠ {e}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={importing || !hasFiles}
          style={{ background: importing || !hasFiles ? "#ccc" : "#004f91", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: importing || !hasFiles ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          {importing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
          {importing ? "Import en cours…" : "Importer"}
        </button>
      </div>

      {/* ── Auto-refresh ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "20px 28px", marginBottom: 20 }}>
        <div style={SEC}>Mise à jour automatique UNCTAD</div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: "#555", margin: 0, marginBottom: 6 }}>
              Récupère les nouvelles données directement depuis l'API UNCTAD pour tous les pays déjà importés.
              Tourne automatiquement <strong>chaque dimanche à 2h</strong> si les credentials sont configurés.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: unctadOk === null ? "#CCC" : unctadOk ? "#27ae60" : "#e74c3c",
              }} />
              {unctadOk === null ? "Vérification…"
                : unctadOk ? "Credentials configurés (UNCTAD_CLIENT_ID + UNCTAD_CLIENT_SECRET)"
                : "Credentials non configurés — ajoutez UNCTAD_CLIENT_ID et UNCTAD_CLIENT_SECRET dans le .env"}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || !unctadOk}
            style={{ background: refreshing || !unctadOk ? "#ccc" : "#004f91", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: refreshing || !unctadOk ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {refreshing ? "Rafraîchissement…" : "Rafraîchir maintenant"}
          </button>
        </div>

        {refreshRes && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid", background: refreshRes.success ? "#EDFBF1" : "#FFF2F2", borderColor: refreshRes.success ? "#B2EAC5" : "#F5C6CB" }}>
            {refreshRes.success ? (
              <>
                {refreshRes.pays?.map(p => (
                  <div key={p.pays} style={{ fontSize: 13, color: "#1a7a3c" }}>
                    ✓ <strong>{p.pays}</strong> — {p.insere} insérées, {p.mis_a_jour} mises à jour
                  </div>
                ))}
                {refreshRes.erreurs?.map((e, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#c0392b" }}>⚠ {e}</div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#c0392b" }}>✗ {refreshRes.erreur}</div>
            )}
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
                        {serie ? (
                          <span style={{ background: "#EEF4FB", padding: "3px 10px", borderRadius: 20, fontSize: 12, color: "#004f91", whiteSpace: "nowrap" }}>
                            {serie.annee_min}–{serie.annee_max}
                            <span style={{ color: "#888", marginLeft: 4 }}>({serie.nb})</span>
                          </span>
                        ) : <span style={{ color: "#CCC", fontSize: 18 }}>–</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <button
                      onClick={() => handleDelete(s.ref_pays_id, s.pays)}
                      disabled={deleting === s.ref_pays_id}
                      style={{ background: "none", border: "1px solid #e74c3c", color: "#e74c3c", borderRadius: 6, padding: "5px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
                    >
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
