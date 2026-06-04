"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, Trash2, UploadCloud, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const IS: any = { background: "#F2F0EF", border: "1px solid #C5BFBB", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "var(--font-google-sans)" };
const LS: any = { fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 5, display: "block" };
const SEC: any = { fontSize: 11, fontWeight: 700, color: "#004f91", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #E8E5E3" };

type RefPays = { id: number; nom_fr: string; code_iso2: string | null; continent: string | null; region_geo: string | null; niveau_revenu: string | null };
type Serie = { annee_min: number; annee_max: number; nb: number };
type StatPays = { ref_pays_id: number; pays: string; code_iso2: string | null; series: Record<string, Serie> };

const SERIES_LABELS: Record<string, string> = {
  entrant_flux: "Flux entrants",
  sortant_flux: "Flux sortants",
  entrant_stock: "Stock entrants",
  sortant_stock: "Stock sortants",
};

function Flag({ code }: { code: string | null }) {
  if (!code) return <span style={{ fontSize: 18, marginRight: 8 }}>🌐</span>;
  const emoji = code.toUpperCase().split("").map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
  return <span style={{ fontSize: 18, marginRight: 8 }}>{emoji}</span>;
}

function FileZone({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${file ? "#004f91" : "#C5BFBB"}`,
        borderRadius: 10,
        padding: "18px 12px",
        textAlign: "center",
        cursor: "pointer",
        background: file ? "#EEF4FB" : "#F9F8F7",
        transition: "all .15s",
        position: "relative",
      }}
    >
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={e => onChange(e.target.files?.[0] || null)} />
      {file ? (
        <>
          <CheckCircle size={20} color="#004f91" style={{ marginBottom: 4 }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "#004f91" }}>{file.name}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{(file.size / 1024).toFixed(0)} Ko</div>
          <button
            onClick={e => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = ""; }}
            style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#999" }}
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <>
          <UploadCloud size={20} color="#AAA" style={{ marginBottom: 4 }} />
          <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
          <div style={{ fontSize: 11, color: "#AAA", marginTop: 2 }}>CSV ou Excel CNUCED</div>
        </>
      )}
    </div>
  );
}

export default function AdminIdePage() {
  const [paysList, setPaysList]   = useState<RefPays[]>([]);
  const [stats,    setStats]      = useState<StatPays[]>([]);
  const [loading,  setLoading]    = useState(true);

  const [refPaysId,    setRefPaysId]    = useState<number | "">("");
  const [fluxEntrant,  setFluxEntrant]  = useState<File | null>(null);
  const [fluxSortant,  setFluxSortant]  = useState<File | null>(null);
  const [stockEntrant, setStockEntrant] = useState<File | null>(null);
  const [stockSortant, setStockSortant] = useState<File | null>(null);

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [deleting, setDeleting] = useState<number | null>(null);

  async function loadData() {
    const [pr, st] = await Promise.all([
      fetch(`${API}/ide/pays-ref`).then(r => r.json()),
      fetch(`${API}/ide/cnuced/stats`).then(r => r.json()),
    ]);
    setPaysList(Array.isArray(pr) ? pr : []);
    setStats(Array.isArray(st) ? st : []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleImport() {
    if (!refPaysId) return;
    const hasFile = fluxEntrant || fluxSortant || stockEntrant || stockSortant;
    if (!hasFile) { setImportMsg({ ok: false, text: "Ajouter au moins un fichier Excel." }); return; }

    setImporting(true);
    setImportMsg(null);
    const fd = new FormData();
    fd.append("ref_pays_id", String(refPaysId));
    if (fluxEntrant)  fd.append("flux_entrant",  fluxEntrant);
    if (fluxSortant)  fd.append("flux_sortant",  fluxSortant);
    if (stockEntrant) fd.append("stock_entrant", stockEntrant);
    if (stockSortant) fd.append("stock_sortant", stockSortant);

    try {
      const res = await fetch(`${API}/ide/importer`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setImportMsg({ ok: true, text: `Import réussi pour ${data.pays} — ${data.insere} lignes insérées, ${data.mis_a_jour} mises à jour.` });
        setFluxEntrant(null); setFluxSortant(null); setStockEntrant(null); setStockSortant(null);
        setRefPaysId("");
        await loadData();
      } else {
        setImportMsg({ ok: false, text: data.detail || "Erreur lors de l'import." });
      }
    } catch (e: any) {
      setImportMsg({ ok: false, text: "Erreur réseau : " + e.message });
    }
    setImporting(false);
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

  const selectedPays = paysList.find(p => p.id === refPaysId);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto", fontFamily: "var(--font-google-sans)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>IDE — Investissements Directs Étrangers</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>Importez les séries CNUCED (flux/stock entrant/sortant) et gérez les données par pays.</p>

      {/* ── Section Import ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E5E3", padding: "24px 28px", marginBottom: 28 }}>
        <div style={SEC}>Importer des données CNUCED</div>

        <div style={{ marginBottom: 20 }}>
          <label style={LS}>Pays</label>
          <select value={refPaysId} onChange={e => setRefPaysId(e.target.value ? Number(e.target.value) : "")} style={IS}>
            <option value="">— Sélectionner un pays —</option>
            {paysList.map(p => (
              <option key={p.id} value={p.id}>{p.nom_fr}{p.continent ? ` (${p.continent})` : ""}</option>
            ))}
          </select>
          {selectedPays && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#666", display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Flag code={selectedPays.code_iso2} />
              {selectedPays.continent && <span style={{ background: "#F0F4FF", padding: "2px 8px", borderRadius: 20 }}>{selectedPays.continent}</span>}
              {selectedPays.region_geo && <span style={{ background: "#F0F4FF", padding: "2px 8px", borderRadius: 20 }}>{selectedPays.region_geo}</span>}
              {selectedPays.niveau_revenu && <span style={{ background: "#FFF8EC", padding: "2px 8px", borderRadius: 20 }}>{selectedPays.niveau_revenu}</span>}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <FileZone label="Flux entrants" file={fluxEntrant} onChange={setFluxEntrant} />
          <FileZone label="Flux sortants" file={fluxSortant} onChange={setFluxSortant} />
          <FileZone label="Stock entrants" file={stockEntrant} onChange={setStockEntrant} />
          <FileZone label="Stock sortants" file={stockSortant} onChange={setStockSortant} />
        </div>

        {importMsg && (
          <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13, background: importMsg.ok ? "#EDFBF1" : "#FFF2F2", color: importMsg.ok ? "#1a7a3c" : "#c0392b", border: `1px solid ${importMsg.ok ? "#B2EAC5" : "#F5C6CB"}` }}>
            {importMsg.text}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={importing || !refPaysId}
          style={{ background: importing || !refPaysId ? "#ccc" : "#004f91", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: importing || !refPaysId ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          {importing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
          {importing ? "Import en cours…" : "Importer"}
        </button>
      </div>

      {/* ── Section Stats ── */}
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
                  <td style={{ padding: "10px 12px", display: "flex", alignItems: "center" }}>
                    <Flag code={s.code_iso2} />
                    <span style={{ fontWeight: 600 }}>{s.pays}</span>
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
                        ) : (
                          <span style={{ color: "#CCC", fontSize: 18 }}>–</span>
                        )}
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
